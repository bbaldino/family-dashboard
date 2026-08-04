//! The `fetch` capability: `POST /api/fetch/{integration}/{endpoint}`.
//!
//! This module is the SSRF boundary. The service it runs in is reachable
//! without authentication from a home LAN that also hosts Home Assistant,
//! the Unraid and Proxmox admin UIs, and the reverse proxy's own admin
//! API, so "which host does this process contact" must never be a
//! function of request data. It isn't: hosts and paths come only from
//! `super::manifest`, and a request contributes names (looked up) and
//! values (url-encoded into manifest-declared query slots).
//!
//! See [`invoke`] for the request contract and [`build_url`] for how a
//! declared endpoint becomes a URL.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Path, State};
use axum::{Json, Router};
use serde::Deserialize;
use tokio::sync::RwLock;
use url::Url;

use super::manifest::{Endpoint, Manifest, validate_endpoint_url};
use crate::error::AppError;

/// Hard cap on the number of distinct cache entries the process holds across
/// *all* endpoints combined — `entries` is one global `BTreeMap`, not one
/// per endpoint. Declared-param validation (see `declared_params`) bounds
/// *which* param names reach the cache key, but not the values an attacker
/// can send for a legitimate param (e.g. a search `q`), so the cache still
/// needs a ceiling: without one, a loop of distinct values is a guaranteed
/// cache miss every time and grows an otherwise-unbounded `BTreeMap`
/// forever. This bounds memory only — it does not protect the upstream from
/// being hit on every miss, and because the map is shared, a flood of
/// distinct values against one endpoint can evict another endpoint's
/// entries too.
const MAX_CACHE_ENTRIES: usize = 500;

/// Everything `invoke` needs, built once in `router` and shared by every
/// request.
///
/// The three fields are the whole security posture: `manifest` is the
/// allowlist (the only source of hosts and paths this process will contact),
/// `client` has redirects disabled so that allowlist binds every hop rather
/// than just the first, and `cache` collapses repeat requests so N clients
/// polling the same endpoint cost one upstream call.
#[derive(Clone)]
pub struct PlatformState {
    pub manifest: Arc<Manifest>,
    pub client: reqwest::Client,
    pub cache: Arc<ResponseCache>,
}

struct CacheEntry {
    value: serde_json::Value,
    inserted_at: Instant,
    ttl: Duration,
}

/// Per-response TTL cache, keyed by `cache_key` and shared across every
/// integration and endpoint.
///
/// Each entry carries its own TTL because the manifest sets `ttl_secs` per
/// endpoint. Entries are purged lazily — `get` treats an expired entry as a
/// miss, and `set` drops expired entries before enforcing
/// [`MAX_CACHE_ENTRIES`]; nothing sweeps in the background. Eviction is
/// oldest-insert rather than true LRU, which means a long-TTL entry is
/// always the first candidate even when it is the most-read one. That is
/// acceptable while endpoints declare few params, and worth revisiting when
/// one takes a high-cardinality param.
#[derive(Default)]
pub struct ResponseCache {
    entries: RwLock<BTreeMap<String, CacheEntry>>,
}

impl ResponseCache {
    /// An empty cache. Built once per process in [`router`].
    pub fn new() -> Self {
        Self::default()
    }

    async fn get(&self, key: &str) -> Option<serde_json::Value> {
        let guard = self.entries.read().await;
        let entry = guard.get(key)?;
        (entry.inserted_at.elapsed() < entry.ttl).then(|| entry.value.clone())
    }

    async fn set(&self, key: String, value: serde_json::Value, ttl: Duration) {
        let mut guard = self.entries.write().await;

        // Drop anything already expired before considering the cap, so a
        // slow trickle of distinct params doesn't get artificially capped
        // while genuinely stale entries linger and take up space for
        // nothing.
        guard.retain(|_, entry| entry.inserted_at.elapsed() < entry.ttl);

        if guard.len() >= MAX_CACHE_ENTRIES
            && let Some(oldest) = guard
                .iter()
                .min_by_key(|(_, entry)| entry.inserted_at)
                .map(|(k, _)| k.clone())
        {
            // Evict the single oldest entry to make room. Not a full LRU —
            // just enough to keep an attacker-driven flood of distinct
            // param values from growing this map forever, on a service
            // that sees a handful of low-traffic integrations on a home
            // LAN.
            guard.remove(&oldest);
        }

        guard.insert(
            key,
            CacheEntry {
                value,
                inserted_at: Instant::now(),
                ttl,
            },
        );
    }
}

/// Cache key for a request. Built from a JSON encoding of
/// `(integration, endpoint, params)` rather than a hand-joined string:
/// `BTreeMap`'s `Serialize` impl always emits keys in sorted order, so the
/// same params produce the same key regardless of client ordering, and JSON
/// escaping means no separator collision is possible — a naive
/// `"{i}::{e}::{k}={v}"` join let `params = {"x": "1::y=2"}` collide with
/// `params = {"x": "1", "y": "2"}`, letting one client's cached response
/// leak to another client that sent different params for a different
/// upstream URL.
pub fn cache_key(integration: &str, endpoint: &str, params: &BTreeMap<String, String>) -> String {
    serde_json::to_string(&(integration, endpoint, params))
        .expect("a tuple of strings and a BTreeMap<String, String> always serializes")
}

/// The set of param names this endpoint's query template actually
/// references, e.g. `{"q"}` for a query map containing
/// `{"q": "{{param:q}}"}`. Used to reject params the manifest doesn't
/// declare before they can reach `cache_key` — otherwise `build_url`
/// silently ignores undeclared params while `cache_key` still hashes them
/// in, so a client could vary an irrelevant param to poison or bypass the
/// cache despite `build_url` producing the exact same upstream URL either
/// way.
fn declared_params(endpoint: &Endpoint) -> BTreeSet<&str> {
    endpoint
        .query
        .values()
        .filter_map(|template| {
            template
                .strip_prefix("{{param:")
                .and_then(|rest| rest.strip_suffix("}}"))
        })
        .collect()
}

/// Rejects any param name the endpoint's query template doesn't declare.
/// Called from `invoke` *before* `cache_key` is computed (see the doc
/// comment on `cache_key` for why an undeclared param must never reach it)
/// and again from `build_url`, whose own unit tests construct `Endpoint`
/// values directly and call it without going through `invoke` at all. The
/// duplication keeps the invariant true in both places rather than relying
/// on caller ordering alone.
fn reject_undeclared_params(
    endpoint: &Endpoint,
    params: &BTreeMap<String, String>,
) -> Result<(), AppError> {
    let declared = declared_params(endpoint);
    if let Some(bad) = params.keys().find(|k| !declared.contains(k.as_str())) {
        return Err(AppError::BadRequest(format!(
            "param '{}' is not declared by this endpoint",
            bad
        )));
    }
    Ok(())
}

/// Build the upstream URL from the manifest, substituting only `{{param:…}}`
/// placeholders in query values. `base` and `path` come from the manifest
/// and can never be influenced by the request — that is the SSRF boundary.
///
/// `path` is resolved against `base` and origin-checked by
/// `validate_endpoint_url` (see its doc comment in `manifest.rs` for why the
/// check is a post-resolution origin comparison rather than a blacklist of
/// path shapes). `base` may also already carry its own path or query
/// (`https://host/a?b=c`), which is a well-formed URL and passes the
/// manifest validation; `Url::join` with a root-anchored path reference
/// *replaces* the base's path, query, and fragment entirely (RFC 3986
/// §5.3), so the base's own path/query never leaks into the result. The
/// explicit `set_query(None)` / `set_fragment(None)` below are not
/// redundant, though: if `path` itself embeds a literal `?` or `#` (e.g.
/// `path = "/a?b=c"`, which passes `validate_endpoint_url` — a query string
/// in the *reference* is not an origin change), those become part of the
/// resolved URL's query/fragment via the same §5.3 resolution and need to
/// be stripped explicitly before this function appends its own query pairs,
/// or the manifest's `path` field could smuggle extra query parameters past
/// the declared `query` map.
pub fn build_url(
    endpoint: &Endpoint,
    params: &BTreeMap<String, String>,
) -> Result<String, AppError> {
    let base = Url::parse(&endpoint.base).map_err(|e| {
        AppError::Internal(format!(
            "endpoint base {:?} is not a valid URL: {}",
            endpoint.base, e
        ))
    })?;

    // `Manifest::from_json` already checked this at boot, but this function
    // re-parses `base` from scratch rather than reusing that validated
    // `Url`, so without re-checking the scheme here the per-request guard
    // would be weaker than the boot guard: a manifest field that somehow
    // changed shape between boot and request (or a caller that builds an
    // `Endpoint` directly, as the unit tests below do) could otherwise
    // resolve a `file://` or other non-http(s) base.
    if !matches!(base.scheme(), "http" | "https") {
        return Err(AppError::Internal(format!(
            "endpoint base {:?} must be http or https",
            endpoint.base
        )));
    }

    let mut url = validate_endpoint_url(&base, &endpoint.path).map_err(AppError::Internal)?;
    url.set_query(None);
    url.set_fragment(None);

    reject_undeclared_params(endpoint, params)?;

    let mut pairs: Vec<(String, String)> = Vec::new();
    for (key, template) in &endpoint.query {
        let value = if let Some(name) = template
            .strip_prefix("{{param:")
            .and_then(|r| r.strip_suffix("}}"))
        {
            params
                .get(name)
                .cloned()
                .ok_or_else(|| AppError::BadRequest(format!("missing required param '{}'", name)))?
        } else {
            template.clone()
        };
        pairs.push((key.clone(), value));
    }

    if !pairs.is_empty() {
        let mut qp = url.query_pairs_mut();
        for (k, v) in &pairs {
            qp.append_pair(k, v);
        }
    }

    Ok(url.to_string())
}

/// The request body: `{"params": {"name": "value", …}}`.
///
/// Deliberately the *only* thing a client controls beyond naming an
/// integration and endpoint. Values here are substituted into
/// `{{param:name}}` placeholders that the **manifest** declared, and are
/// url-encoded as query values — they cannot introduce a parameter, a path
/// segment, a host, or a scheme.
///
/// The body is optional; an absent body is equivalent to `{"params": {}}`.
/// A param the endpoint does not declare is rejected rather than ignored
/// (see `reject_undeclared_params`), so a typo'd param name fails loudly
/// instead of silently producing a URL the caller did not intend.
#[derive(Deserialize, Default)]
pub struct FetchRequest {
    #[serde(default)]
    pub params: BTreeMap<String, String>,
}

/// `POST /api/fetch/{integration}/{endpoint}` — the generic upstream call
/// that replaces per-integration Rust.
///
/// A client names an integration and an endpoint and supplies *values*. It
/// never supplies a URL, a path, or a host: those come only from the
/// checked-in manifest, which is validated at boot. That is the SSRF
/// boundary this whole module exists to hold, and it matters because this
/// process sits on a LAN alongside Home Assistant, the Unraid and Proxmox
/// admin UIs, and the reverse proxy's own admin API, and is reachable
/// without authentication.
///
/// On success the upstream's JSON body is relayed verbatim.
///
/// Errors:
/// - **404** — no such integration or endpoint in the manifest. Returned
///   before any URL is built, so an unknown name costs nothing.
/// - **400** — a param the endpoint does not declare, or a
///   `{{param:…}}` placeholder the request did not supply a value for.
/// - **500** — the upstream was unreachable, returned a non-2xx, or sent a
///   body that would not parse as JSON. The upstream's own message is
///   included for the log; `AppError::Internal` renders a generic body to
///   the caller, so it is not disclosed over the wire.
///
/// Caching: when `ttl_secs > 0`, a hit returns immediately and a miss stores
/// the response. Endpoints with `ttl_secs == 0` neither read nor write the
/// cache. Concurrent misses are *not* single-flighted — each reaches the
/// upstream — which is fine at one dashboard's request volume but is the
/// first thing to revisit if a short-TTL endpoint gains several consumers.
pub async fn invoke(
    State(state): State<PlatformState>,
    Path((integration, endpoint)): Path<(String, String)>,
    body: Option<Json<FetchRequest>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let req = body.map(|Json(b)| b).unwrap_or_default();

    let ep = state
        .manifest
        .endpoint(&integration, &endpoint)
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "no endpoint {}.{} in manifest",
                integration, endpoint
            ))
        })?;

    // Must run before `cache_key` is computed: `cache_key` hashes every
    // param the client sent, declared or not, and `build_url` silently
    // ignores anything undeclared. Checking here first keeps that
    // ordering an invariant of `invoke` itself rather than something that
    // only happens to hold because `build_url` is called later.
    reject_undeclared_params(ep, &req.params)?;

    let key = cache_key(&integration, &endpoint, &req.params);
    if ep.ttl_secs > 0
        && let Some(hit) = state.cache.get(&key).await
    {
        return Ok(Json(hit));
    }

    let url = build_url(ep, &req.params)?;
    let resp = state.client.get(&url).send().await.map_err(|e| {
        AppError::Internal(format!(
            "{}.{} request failed: {}",
            integration, endpoint, e
        ))
    })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "{}.{} upstream returned {}: {}",
            integration, endpoint, status, text
        )));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        AppError::Internal(format!("{}.{} parse failed: {}", integration, endpoint, e))
    })?;

    if ep.ttl_secs > 0 {
        state
            .cache
            .set(key, data.clone(), Duration::from_secs(ep.ttl_secs))
            .await;
    }
    Ok(Json(data))
}

/// Builds the `reqwest::Client` used for every outbound `/api/fetch` call.
/// Pulled out of `router` so the test below exercises the exact
/// construction path rather than a copy of it.
fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        // The manifest allowlists a *base host*, not "wherever that host's
        // first response points next." Without this, a 3xx from an
        // otherwise-allowlisted upstream (reqwest 0.13's default is to
        // follow up to 10 redirects) could steer the request to any host on
        // the LAN — including Home Assistant, Unraid, Proxmox, or the
        // reverse-proxy admin API — and the response would be relayed
        // verbatim to an unauthenticated caller. Disabling redirects
        // entirely (rather than re-checking the origin on each hop) keeps
        // the allowlist meaning what it says: every request this process
        // makes goes to a host named in the checked-in manifest, full stop.
        // If a real upstream ever needs a redirect followed, the fix is to
        // point `base`/`path` at the destination directly, which is an
        // auditable manifest change instead of a runtime decision made by
        // whatever the upstream happens to return today.
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

/// Builds the fetch capability's router, mounted by `integrations::router`
/// under `/fetch` so the full path is `/api/fetch/{integration}/{endpoint}`.
///
/// Takes the manifest rather than loading it, because `main` loads it once at
/// startup and panics on a bad one — a malformed manifest must stop the
/// process, not surface as a per-request failure. The client and cache are
/// built here and shared by every request via [`PlatformState`].
pub fn router(manifest: Arc<Manifest>) -> Router {
    let state = PlatformState {
        manifest,
        client: build_client(),
        cache: Arc::new(ResponseCache::new()),
    };

    Router::new()
        .route("/{integration}/{endpoint}", axum::routing::post(invoke))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn ep() -> Endpoint {
        Endpoint {
            base: "https://zenquotes.io".into(),
            path: "/api/today".into(),
            query: BTreeMap::from([("units".to_string(), "imperial".to_string())]),
            ttl_secs: 60,
        }
    }

    #[test]
    fn builds_the_url_from_the_manifest_only() {
        let url = build_url(&ep(), &BTreeMap::new()).unwrap();
        assert_eq!(url, "https://zenquotes.io/api/today?units=imperial");
    }

    #[test]
    fn params_are_url_encoded_into_the_template_not_concatenated() {
        let mut e = ep();
        e.query.insert("q".to_string(), "{{param:q}}".to_string());
        let params = BTreeMap::from([("q".to_string(), "a b&c=d".to_string())]);
        let url = build_url(&e, &params).unwrap();
        assert!(url.contains("q=a+b%26c%3Dd") || url.contains("q=a%20b%26c%3Dd"));
        // The critical property: an injected value cannot add a parameter.
        assert_eq!(url.matches('?').count(), 1);
    }

    #[test]
    fn an_unresolved_placeholder_is_an_error_not_a_literal() {
        let mut e = ep();
        e.query
            .insert("q".to_string(), "{{param:missing}}".to_string());
        assert!(build_url(&e, &BTreeMap::new()).is_err());
    }

    #[test]
    fn cache_key_varies_with_params() {
        let a = cache_key("daily-quote", "today", &BTreeMap::new());
        let b = cache_key(
            "daily-quote",
            "today",
            &BTreeMap::from([("x".to_string(), "1".to_string())]),
        );
        assert_ne!(a, b);
    }

    #[test]
    fn cache_key_does_not_collide_across_a_naive_separator() {
        // Under a hand-joined "{i}::{e}::{k}={v}" scheme, these two param
        // maps produced the identical string "daily-quote::today::x=1::y=2"
        // -- one client's cached response would leak to another client who
        // sent different params. The JSON encoding can't collide like this
        // because param count and boundaries are structural, not textual.
        let a = cache_key(
            "daily-quote",
            "today",
            &BTreeMap::from([("x".to_string(), "1::y=2".to_string())]),
        );
        let b = cache_key(
            "daily-quote",
            "today",
            &BTreeMap::from([
                ("x".to_string(), "1".to_string()),
                ("y".to_string(), "2".to_string()),
            ]),
        );
        assert_ne!(a, b);
    }

    #[test]
    fn rejects_a_param_the_endpoint_does_not_declare() {
        // build_url ignores params that don't match a `{{param:…}}`
        // template, but they must never reach the cache key or the request
        // is accepted at all -- otherwise an attacker can vary an
        // irrelevant param name to grow the cache with entries that all
        // resolve to the exact same upstream URL.
        let params = BTreeMap::from([("not_declared".to_string(), "x".to_string())]);
        assert!(build_url(&ep(), &params).is_err());
    }

    #[test]
    fn rejects_a_non_http_scheme_base_even_when_it_bypasses_manifest_validation() {
        // Manifest deserialization already rejects a non-http(s) base at boot, but
        // build_url re-parses `endpoint.base` from scratch rather than
        // reusing that validated Url — so a directly-constructed Endpoint
        // (as every test in this module does) must be re-checked here too,
        // or the per-request guard would be weaker than the boot guard.
        let mut e = ep();
        e.base = "file:///etc/passwd".into();
        assert!(build_url(&e, &BTreeMap::new()).is_err());
    }

    // --- Paths that resolve off the declared origin ---

    #[test]
    fn rejects_a_path_that_is_actually_an_absolute_url_to_another_host() {
        let mut e = ep();
        e.path = "https://evil.example.com/steal".into();
        assert!(build_url(&e, &BTreeMap::new()).is_err());
    }

    #[test]
    fn rejects_a_scheme_relative_path_that_would_retarget_the_host() {
        let mut e = ep();
        e.path = "//evil.example.com/steal".into();
        assert!(build_url(&e, &BTreeMap::new()).is_err());
    }

    #[test]
    fn rejects_a_path_with_dot_dot_traversal() {
        let mut e = ep();
        e.path = "/api/../../secret".into();
        assert!(build_url(&e, &BTreeMap::new()).is_err());
    }

    #[test]
    fn rejects_a_path_not_anchored_at_root() {
        // Without a leading `/`, `Url::join` merges relative to the base's
        // own directory instead of replacing the path outright, which is
        // not the semantics build_url promises.
        let mut e = ep();
        e.path = "api/today".into();
        assert!(build_url(&e, &BTreeMap::new()).is_err());
    }

    #[test]
    fn a_base_with_its_own_path_and_query_does_not_leak_into_the_result() {
        let mut e = ep();
        e.base = "https://host.example.com/existing/path?already=here".into();
        e.query = BTreeMap::new();
        let url = build_url(&e, &BTreeMap::new()).unwrap();
        assert_eq!(url, "https://host.example.com/api/today");
    }

    #[test]
    fn a_path_with_an_embedded_query_string_does_not_survive() {
        // `path = "/a?b=c"` passes validate_endpoint_url (a query string in
        // the *reference* isn't an origin change), so `set_query(None)`
        // right after the join is genuinely load-bearing, not defensive
        // dead code: without it, the manifest's path field could smuggle
        // an extra query parameter past the declared `query` map.
        let mut e = ep();
        e.path = "/a?b=c".into();
        e.query = BTreeMap::new();
        let url = build_url(&e, &BTreeMap::new()).unwrap();
        assert_eq!(url, "https://zenquotes.io/a");
    }

    #[test]
    fn a_path_with_an_embedded_fragment_does_not_survive() {
        let mut e = ep();
        e.path = "/a#b".into();
        e.query = BTreeMap::new();
        let url = build_url(&e, &BTreeMap::new()).unwrap();
        assert_eq!(url, "https://zenquotes.io/a");
    }

    #[test]
    fn documents_why_join_alone_is_not_enough_for_absolute_paths() {
        // build_url rejects these paths outright (see the two tests above),
        // so this documents *why*: plugging them straight into `Url::join`
        // without the guard would silently retarget the host, which is
        // exactly the SSRF this module exists to prevent.
        let base = Url::parse("https://zenquotes.io").unwrap();

        let joined = base.join("https://evil.example.com/steal").unwrap();
        assert_eq!(joined.host_str(), Some("evil.example.com"));

        let joined = base.join("//evil.example.com/steal").unwrap();
        assert_eq!(joined.host_str(), Some("evil.example.com"));
    }

    // --- Fix Round 1: the router's client must not follow redirects ---

    #[tokio::test]
    async fn the_platform_client_does_not_follow_a_redirect_to_another_host() {
        // Two local servers: an "internal" one standing in for something on
        // the LAN that must never be reachable through the fetch proxy
        // (Home Assistant, Unraid, etc.), and an "allowlisted" one standing
        // in for a real manifest base that 302s to it. If build_client()
        // followed redirects (reqwest's default), this test would observe
        // the internal server's body. It must not.
        use axum::response::Redirect;
        use axum::routing::get;

        let internal_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let internal_addr = internal_listener.local_addr().unwrap();
        let internal_app = Router::new().route(
            "/secret",
            get(|| async { Json(serde_json::json!({"leaked": true})) }),
        );
        tokio::spawn(async move {
            axum::serve(internal_listener, internal_app).await.unwrap();
        });

        let redirect_target = format!("http://{internal_addr}/secret");
        let allowlisted_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let allowlisted_addr = allowlisted_listener.local_addr().unwrap();
        let allowlisted_app = Router::new().route(
            "/redirect",
            get(move || {
                let target = redirect_target.clone();
                async move { Redirect::temporary(&target) }
            }),
        );
        tokio::spawn(async move {
            axum::serve(allowlisted_listener, allowlisted_app)
                .await
                .unwrap();
        });

        let client = build_client();
        let resp = client
            .get(format!("http://{allowlisted_addr}/redirect"))
            .send()
            .await
            .unwrap();

        assert!(
            resp.status().is_redirection(),
            "client followed the redirect instead of stopping at it; got status {}",
            resp.status()
        );
    }
}
