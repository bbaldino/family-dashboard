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
use sqlx::SqlitePool;
use tokio::sync::RwLock;
use url::Url;

use super::manifest::{Endpoint, Manifest, split_cfg_default, validate_endpoint_url};
use crate::error::AppError;
use crate::integrations::IntegrationConfig;

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
    pub pool: SqlitePool,
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
/// `(integration, endpoint, params, cfg)` rather than a hand-joined string:
/// `BTreeMap`'s `Serialize` impl always emits keys in sorted order, so the
/// same params produce the same key regardless of client ordering, and JSON
/// escaping means no separator collision is possible — a naive
/// `"{i}::{e}::{k}={v}"` join let `params = {"x": "1::y=2"}` collide with
/// `params = {"x": "1", "y": "2"}`, letting one client's cached response
/// leak to another client that sent different params for a different
/// upstream URL.
///
/// `resolved` is every `{{cfg:…}}`/`{{secret:…}}` value `invoke` read from
/// the config table for this request (see `resolve_server_placeholders`).
/// Folding the **non-secret** half into the key is what makes a config edit
/// (e.g. a corrected `weather.lat`) take effect immediately instead of
/// waiting out the entry's `ttl_secs` — two requests with identical params
/// but a different resolved `cfg:` value must land on different cache
/// entries, or the corrected value is invisible until the stale entry
/// expires. Secrets are deliberately excluded: a cache key lives in memory
/// and is exactly the kind of thing that ends up in a debug log or a metric
/// label, so a rotated secret changing the key would put the credential
/// somewhere it doesn't belong. The cost is that a rotated secret's cache
/// entry, if pre-existing, is served stale until its TTL expires — bounded,
/// and the right trade against leaking a credential.
pub fn cache_key(
    integration: &str,
    endpoint: &str,
    params: &BTreeMap<String, String>,
    resolved: &BTreeMap<String, String>,
) -> String {
    // Secrets are deliberately excluded — see this function's doc comment.
    let cfg: BTreeMap<&str, &str> = resolved
        .iter()
        .filter(|(k, _)| !k.starts_with("secret:"))
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    serde_json::to_string(&(integration, endpoint, params, &cfg))
        .expect("strings and BTreeMaps of strings always serialize")
}

/// Placeholder kinds the *manifest* may use that the client may not supply.
/// Kept separate from `declared_params` on purpose: that function answers
/// "what may a client send", and a value drawn from config must never appear
/// in its answer.
///
/// The `cfg:`/`secret:` split is advisory, not enforced by anything at
/// request time: both prefixes read the identical config row, and the
/// prefix is the *sole* signal `redact_secrets` uses to decide what to
/// scrub from a logged error. A manifest entry that writes `cfg:api_key`
/// for a real secret gets it logged in plaintext on every upstream
/// failure. `Manifest`'s boot-time validation (`manifest.rs`) rejects a
/// `cfg:` placeholder whose key name looks like a secret as a best-effort
/// backstop, but that is a name-substring heuristic, not a proof — choose
/// `secret:` for anything actually sensitive.
const SERVER_PREFIXES: [&str; 2] = ["cfg:", "secret:"];

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

/// Reads every `{{cfg:…}}` / `{{secret:…}}` an endpoint references out of the
/// config table, keyed by the placeholder's inner text (`"cfg:lat"`,
/// `"cfg:lat|37.2504"`, `"secret:api_key"`).
///
/// A `cfg:` placeholder may declare a default after a `|` (see
/// `manifest::split_cfg_default`), which is used when the config table has
/// no row for the key — restoring the `IntegrationConfig::get_or` behaviour
/// the per-integration Rust routes had, so an install that has only set
/// `weather.api_key` gets the fallback coordinates rather than a generic 500
/// and a blank widget. A *database* error still propagates either way; only
/// "no such row" takes the default, and only when one is declared.
/// `secret:` never takes a default (the manifest rejects one at boot).
///
/// The resolved value — default or not — reaches the URL through exactly one
/// path, `build_url`'s `query_pairs_mut().append_pair`, so a default is a
/// url-encoded query *value* and no more able to introduce a host, scheme,
/// or extra parameter than a value read from the database.
///
/// Done here rather than inside `build_url` so that `build_url` stays sync
/// and pure — its tests construct `Endpoint`s directly and must not need a
/// database.
async fn resolve_server_placeholders(
    endpoint: &Endpoint,
    integration: &str,
    pool: &SqlitePool,
) -> Result<BTreeMap<String, String>, AppError> {
    let config = IntegrationConfig::new(pool, integration);
    let mut resolved = BTreeMap::new();

    for template in endpoint.query.values() {
        let Some(inner) = template
            .strip_prefix("{{")
            .and_then(|r| r.strip_suffix("}}"))
        else {
            continue;
        };
        if !SERVER_PREFIXES.iter().any(|p| inner.starts_with(p)) {
            continue;
        }
        if resolved.contains_key(inner) {
            continue;
        }
        // `cfg:` may carry a `|default`; `secret:` may not, so its key is
        // taken whole (a `|` there is rejected at boot, not silently read as
        // part of the key name).
        let (key, default) = match inner.strip_prefix("cfg:") {
            Some(after) => split_cfg_default(after),
            None => (inner.split_once(':').map(|(_, k)| k).unwrap_or(inner), None),
        };
        // A missing value is a configuration error, not a request error, so
        // it must not reach the caller as `get`'s own 400 — that would hand
        // an unauthenticated LAN caller the config namespace and "not set"
        // reasoning of a home server's admin settings. Mapped to
        // `AppError::Internal` instead: the caller gets a generic 500, and
        // the actionable "Config 'x.y' not set. Configure in admin
        // settings." message still reaches the log via `Internal`'s
        // `tracing::error!` — the message that was missing the day a stale
        // music.service_url read as "never configured".
        //
        // `get_or` rather than `get` when the manifest declared a default:
        // it distinguishes "no row" (take the default) from a real database
        // error (still propagates), which a `get(...).unwrap_or(default)`
        // would flatten into "silently use the fallback whenever SQLite is
        // unhappy".
        let value = match default {
            Some(default) => config.get_or(key, default).await,
            None => config.get(key).await,
        }
        .map_err(|e| {
            AppError::Internal(format!(
                "resolving placeholder '{{{{{inner}}}}}' for integration '{integration}': {e}"
            ))
        })?;
        resolved.insert(inner.to_string(), value);
    }
    Ok(resolved)
}

/// Replaces any resolved **secret** value with `[redacted]`. Applied to every
/// message derived from a URL before it reaches an `AppError`, because
/// `reqwest` embeds the full request URL — query string included — in its
/// own error text, and `AppError` messages are logged.
///
/// Scrubs both the raw value and its form-urlencoded form. `build_url` puts
/// `value` into the URL via `query_pairs_mut().append_pair`, which
/// form-urlencodes it — so a `reqwest` error, which embeds the *encoded*
/// request URL, contains the raw value only when it happens to consist
/// entirely of `[A-Za-z0-9*._-]`. OpenWeather's key is hex today, but this
/// is a general-purpose capability, and a base64 token, a JWT, or anything
/// containing `/ + = : ~ !` or a space would otherwise sail through
/// unredacted: `.replace(value, …)` alone is a silent no-op on exactly the
/// secrets most worth protecting. The raw form is still checked too, for an
/// upstream body that echoes the key back unencoded.
///
/// Encoded form first, then raw. Order matters for a secret ending in a
/// character encoding expands — `"abc%"` encodes to `"abc%25"`, and a
/// raw-first pass matches the `"abc%"` prefix of that and leaves
/// `"[redacted]25"` behind. No leak either way (the secret is gone in both
/// orderings), but the encoded-first pass consumes the whole token and
/// leaves a message that reads as intended.
fn redact_secrets(message: &str, resolved: &BTreeMap<String, String>) -> String {
    let mut out = message.to_string();
    for (placeholder, value) in resolved {
        if placeholder.starts_with("secret:") && !value.is_empty() {
            let encoded: String = url::form_urlencoded::byte_serialize(value.as_bytes()).collect();
            if encoded != *value {
                out = out.replace(encoded.as_str(), "[redacted]");
            }

            out = out.replace(value.as_str(), "[redacted]");
        }
    }
    out
}

/// Build the upstream URL from the manifest, substituting `{{param:…}}`
/// placeholders from the request and `{{cfg:…}}` / `{{secret:…}}`
/// placeholders from `resolved` (values already read from the config table
/// by [`resolve_server_placeholders`]). `base` and `path` come from the
/// manifest and can never be influenced by the request — that is the SSRF
/// boundary.
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
    resolved: &BTreeMap<String, String>,
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
        let inner = template
            .strip_prefix("{{")
            .and_then(|r| r.strip_suffix("}}"));

        let value = match inner {
            Some(name) if name.starts_with("param:") => {
                let name = &name["param:".len()..];
                params.get(name).cloned().ok_or_else(|| {
                    AppError::BadRequest(format!("missing required param '{}'", name))
                })?
            }
            Some(name) if SERVER_PREFIXES.iter().any(|p| name.starts_with(p)) => resolved
                .get(name)
                .cloned()
                .ok_or_else(|| AppError::Internal(format!("unresolved placeholder '{}'", name)))?,
            _ => template.clone(),
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
/// - **500** — a `{{cfg:…}}`/`{{secret:…}}` placeholder this endpoint
///   references has no config value set and declares no manifest default
///   (`{{cfg:key|default}}`), or the upstream was unreachable,
///   returned a non-2xx, or sent a body that would not parse as JSON. The
///   underlying message is included for the log — with any resolved secret
///   scrubbed by `redact_secrets` first — and `AppError::Internal` renders
///   only a generic body to the caller, so neither the secret nor (for the
///   missing-config case) the config key name is disclosed over the wire.
///
/// Caching: when `ttl_secs > 0`, a hit returns immediately and a miss stores
/// the response. Endpoints with `ttl_secs == 0` neither read nor write the
/// cache. Concurrent misses are *not* single-flighted — each reaches the
/// upstream — which is fine at one dashboard's request volume but is the
/// first thing to revisit if a short-TTL endpoint gains several consumers.
/// Config resolution runs before the cache lookup (see `cache_key`'s doc
/// comment), so if a `{{cfg:…}}`/`{{secret:…}}` value an endpoint depends on
/// is removed, the *next* request 500s instead of continuing to serve the
/// still-cached response for the rest of its TTL. That is deliberate: a
/// misconfiguration surfaces immediately rather than silently for up to
/// `ttl_secs` longer.
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

    // Must run before `resolve_server_placeholders` and `cache_key`: both of
    // those trust every param the client sent, and `build_url` silently
    // ignores anything undeclared. Checking here first keeps that ordering
    // an invariant of `invoke` itself rather than something that only
    // happens to hold because `build_url` is called later.
    reject_undeclared_params(ep, &req.params)?;

    // Resolution now happens *before* the cache lookup, not after. `cache_key`
    // folds the resolved (non-secret) config into the key so that a changed
    // `cfg:` value — e.g. a corrected `weather.lat` — misses the cache
    // instead of serving a stale entry for up to `ttl_secs`. That means
    // every request, including a cache hit, now pays for a config read. On a
    // local SQLite file that's cheap, and it's the whole point: don't
    // "optimize" this back to resolving after the cache check, or a config
    // edit goes back to silently waiting out the TTL again.
    let resolved = resolve_server_placeholders(ep, &integration, &state.pool).await?;

    let key = cache_key(&integration, &endpoint, &req.params, &resolved);
    if ep.ttl_secs > 0
        && let Some(hit) = state.cache.get(&key).await
    {
        return Ok(Json(hit));
    }

    let url = build_url(ep, &req.params, &resolved)?;

    let resp = state.client.get(&url).send().await.map_err(|e| {
        AppError::Internal(format!(
            "{}.{} request failed: {}",
            integration,
            endpoint,
            redact_secrets(&e.to_string(), &resolved)
        ))
    })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "{}.{} upstream returned {}: {}",
            integration,
            endpoint,
            status,
            redact_secrets(&text, &resolved)
        )));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        AppError::Internal(format!(
            "{}.{} parse failed: {}",
            integration,
            endpoint,
            redact_secrets(&e.to_string(), &resolved)
        ))
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
/// built here and shared by every request via [`PlatformState`]. `pool` is
/// threaded through so `invoke` can resolve `{{cfg:…}}` / `{{secret:…}}`
/// placeholders from the config table.
pub fn router(manifest: Arc<Manifest>, pool: SqlitePool) -> Router {
    let state = PlatformState {
        manifest,
        client: build_client(),
        cache: Arc::new(ResponseCache::new()),
        pool,
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
        let url = build_url(&ep(), &BTreeMap::new(), &BTreeMap::new()).unwrap();
        assert_eq!(url, "https://zenquotes.io/api/today?units=imperial");
    }

    #[test]
    fn params_are_url_encoded_into_the_template_not_concatenated() {
        let mut e = ep();
        e.query.insert("q".to_string(), "{{param:q}}".to_string());
        let params = BTreeMap::from([("q".to_string(), "a b&c=d".to_string())]);
        let url = build_url(&e, &params, &BTreeMap::new()).unwrap();
        assert!(url.contains("q=a+b%26c%3Dd") || url.contains("q=a%20b%26c%3Dd"));
        // The critical property: an injected value cannot add a parameter.
        assert_eq!(url.matches('?').count(), 1);
    }

    #[test]
    fn an_unresolved_placeholder_is_an_error_not_a_literal() {
        let mut e = ep();
        e.query
            .insert("q".to_string(), "{{param:missing}}".to_string());
        assert!(build_url(&e, &BTreeMap::new(), &BTreeMap::new()).is_err());
    }

    #[test]
    fn cache_key_varies_with_params() {
        let a = cache_key("daily-quote", "today", &BTreeMap::new(), &BTreeMap::new());
        let b = cache_key(
            "daily-quote",
            "today",
            &BTreeMap::from([("x".to_string(), "1".to_string())]),
            &BTreeMap::new(),
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
            &BTreeMap::new(),
        );
        let b = cache_key(
            "daily-quote",
            "today",
            &BTreeMap::from([
                ("x".to_string(), "1".to_string()),
                ("y".to_string(), "2".to_string()),
            ]),
            &BTreeMap::new(),
        );
        assert_ne!(a, b);
    }

    #[test]
    fn cache_key_varies_with_resolved_config_but_not_with_secrets() {
        let a = BTreeMap::from([
            ("cfg:lat".to_string(), "37.2504".to_string()),
            ("secret:api_key".to_string(), "KEY_ONE".to_string()),
        ]);
        let moved = BTreeMap::from([
            ("cfg:lat".to_string(), "51.5072".to_string()),
            ("secret:api_key".to_string(), "KEY_ONE".to_string()),
        ]);
        let rotated = BTreeMap::from([
            ("cfg:lat".to_string(), "37.2504".to_string()),
            ("secret:api_key".to_string(), "KEY_TWO".to_string()),
        ]);
        let p = BTreeMap::new();

        assert_ne!(
            cache_key("weather", "current", &p, &a),
            cache_key("weather", "current", &p, &moved),
            "a changed config value must not hit a stale entry"
        );
        assert_eq!(
            cache_key("weather", "current", &p, &a),
            cache_key("weather", "current", &p, &rotated),
            "a rotated secret must not enter the cache key"
        );
    }

    #[test]
    fn rejects_a_param_the_endpoint_does_not_declare() {
        // build_url ignores params that don't match a `{{param:…}}`
        // template, but they must never reach the cache key or the request
        // is accepted at all -- otherwise an attacker can vary an
        // irrelevant param name to grow the cache with entries that all
        // resolve to the exact same upstream URL.
        let params = BTreeMap::from([("not_declared".to_string(), "x".to_string())]);
        assert!(build_url(&ep(), &params, &BTreeMap::new()).is_err());
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
        assert!(build_url(&e, &BTreeMap::new(), &BTreeMap::new()).is_err());
    }

    // --- Paths that resolve off the declared origin ---

    #[test]
    fn rejects_a_path_that_is_actually_an_absolute_url_to_another_host() {
        let mut e = ep();
        e.path = "https://evil.example.com/steal".into();
        assert!(build_url(&e, &BTreeMap::new(), &BTreeMap::new()).is_err());
    }

    #[test]
    fn rejects_a_scheme_relative_path_that_would_retarget_the_host() {
        let mut e = ep();
        e.path = "//evil.example.com/steal".into();
        assert!(build_url(&e, &BTreeMap::new(), &BTreeMap::new()).is_err());
    }

    #[test]
    fn rejects_a_path_with_dot_dot_traversal() {
        let mut e = ep();
        e.path = "/api/../../secret".into();
        assert!(build_url(&e, &BTreeMap::new(), &BTreeMap::new()).is_err());
    }

    #[test]
    fn rejects_a_path_not_anchored_at_root() {
        // Without a leading `/`, `Url::join` merges relative to the base's
        // own directory instead of replacing the path outright, which is
        // not the semantics build_url promises.
        let mut e = ep();
        e.path = "api/today".into();
        assert!(build_url(&e, &BTreeMap::new(), &BTreeMap::new()).is_err());
    }

    #[test]
    fn a_base_with_its_own_path_and_query_does_not_leak_into_the_result() {
        let mut e = ep();
        e.base = "https://host.example.com/existing/path?already=here".into();
        e.query = BTreeMap::new();
        let url = build_url(&e, &BTreeMap::new(), &BTreeMap::new()).unwrap();
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
        let url = build_url(&e, &BTreeMap::new(), &BTreeMap::new()).unwrap();
        assert_eq!(url, "https://zenquotes.io/a");
    }

    #[test]
    fn a_path_with_an_embedded_fragment_does_not_survive() {
        let mut e = ep();
        e.path = "/a#b".into();
        e.query = BTreeMap::new();
        let url = build_url(&e, &BTreeMap::new(), &BTreeMap::new()).unwrap();
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

    // --- Task 1: server-resolved {{cfg:}} / {{secret:}} placeholders ---

    /// The whole risk of this slice in one test. `appid` is filled from a
    /// *secret*, not a param — a client that sends `api_key` must be
    /// rejected, not quietly allowed to substitute its own value for the
    /// household's OpenWeather key.
    #[test]
    fn a_client_cannot_supply_a_value_for_a_secret_slot() {
        let ep = Endpoint {
            base: "https://api.openweathermap.org".into(),
            path: "/data/2.5/weather".into(),
            query: BTreeMap::from([
                ("appid".to_string(), "{{secret:api_key}}".to_string()),
                ("lat".to_string(), "{{cfg:lat}}".to_string()),
            ]),
            ttl_secs: 600,
        };
        // Nothing in this endpoint declares a param, so every one of these is
        // an undeclared param and must be refused.
        for name in ["api_key", "lat", "appid"] {
            let params = BTreeMap::from([(name.to_string(), "attacker".to_string())]);
            assert!(
                reject_undeclared_params(&ep, &params).is_err(),
                "client-supplied '{}' must be rejected, not substituted",
                name
            );
        }
        assert!(declared_params(&ep).is_empty());
    }

    #[test]
    fn cfg_and_secret_placeholders_are_substituted_from_resolved_values() {
        let ep = Endpoint {
            base: "https://api.openweathermap.org".into(),
            path: "/data/2.5/weather".into(),
            query: BTreeMap::from([
                ("appid".to_string(), "{{secret:api_key}}".to_string()),
                ("lat".to_string(), "{{cfg:lat}}".to_string()),
                ("units".to_string(), "imperial".to_string()),
            ]),
            ttl_secs: 600,
        };
        let resolved = BTreeMap::from([
            ("secret:api_key".to_string(), "KEY123".to_string()),
            ("cfg:lat".to_string(), "37.2504".to_string()),
        ]);
        let url = build_url(&ep, &BTreeMap::new(), &resolved).unwrap();
        assert!(url.contains("appid=KEY123"));
        assert!(url.contains("lat=37.2504"));
        assert!(url.contains("units=imperial"));
    }

    #[test]
    fn an_unresolved_server_placeholder_is_an_error_not_a_literal() {
        let ep = Endpoint {
            base: "https://example.com".into(),
            path: "/x".into(),
            query: BTreeMap::from([("appid".to_string(), "{{secret:api_key}}".to_string())]),
            ttl_secs: 0,
        };
        let err = build_url(&ep, &BTreeMap::new(), &BTreeMap::new()).unwrap_err();
        // Must not send the literal "{{secret:api_key}}" upstream.
        assert!(format!("{:?}", err).contains("api_key"));
    }

    /// A resolved secret must never appear in an error, because `AppError`
    /// messages are logged. `reqwest` puts the whole URL in its own errors,
    /// so anything derived from a URL has to be scrubbed first.
    #[test]
    fn redaction_removes_secret_values_from_a_message() {
        let resolved = BTreeMap::from([
            ("secret:api_key".to_string(), "SUPERSECRET".to_string()),
            ("cfg:lat".to_string(), "37.2504".to_string()),
        ]);
        let msg = "error sending request for url \
                   (https://api.openweathermap.org/data/2.5/weather?appid=SUPERSECRET&lat=37.2504)";
        let scrubbed = redact_secrets(msg, &resolved);
        assert!(!scrubbed.contains("SUPERSECRET"));
        assert!(scrubbed.contains("[redacted]"));
        // Non-secret config is not scrubbed — it is useful in a log and is
        // not sensitive.
        assert!(scrubbed.contains("37.2504"));
    }

    /// Fix Round 1, Critical 1: `build_url` form-urlencodes a secret's
    /// value on the way into the URL, but `reqwest`'s own error text embeds
    /// that *encoded* URL — so a raw-value-only `.replace` is a no-op for
    /// any secret containing a character urlencoding changes (`/ + = : ~ !`,
    /// a space, …), which a base64 token or a JWT very much does. Built
    /// from a real `build_url` output rather than a hand-written literal so
    /// this test tracks the actual encoder instead of an assumption about
    /// it — `SUPERSECRET` above is alphanumeric and would pass even with
    /// the bug present.
    #[test]
    fn redaction_removes_a_secret_that_needed_url_encoding() {
        let ep = Endpoint {
            base: "https://api.openweathermap.org".into(),
            path: "/data/2.5/weather".into(),
            query: BTreeMap::from([
                ("appid".to_string(), "{{secret:api_key}}".to_string()),
                ("lat".to_string(), "{{cfg:lat}}".to_string()),
            ]),
            ttl_secs: 600,
        };
        let secret = "aGVsbG8rd29ybGQ/Zm9v=";
        let resolved = BTreeMap::from([
            ("secret:api_key".to_string(), secret.to_string()),
            ("cfg:lat".to_string(), "37.2504".to_string()),
        ]);
        let url = build_url(&ep, &BTreeMap::new(), &resolved).unwrap();
        // Sanity check on the premise: the built URL must actually carry
        // the *encoded* form, not the raw secret, or this test isn't
        // exercising the bug it exists to catch.
        assert!(
            !url.contains(secret),
            "test premise broken: build_url did not encode the secret, so this test cannot \
             distinguish the fix from its absence"
        );

        let msg = format!("error sending request for url ({url})");
        let scrubbed = redact_secrets(&msg, &resolved);
        assert!(!scrubbed.contains(secret));
        assert!(scrubbed.contains("[redacted]"));
        assert!(scrubbed.contains("37.2504"));
    }

    /// Final review, Minor 7: a secret ending in `%` encodes to
    /// `…%25`, and replacing the raw form *first* matched only its `…%`
    /// prefix inside that, leaving a stray `25` glued to the placeholder.
    /// Never a leak — the secret is gone either way — but
    /// `[redacted]25` reads like part of a value rather than a redaction,
    /// which is the kind of thing that sends someone hunting for a bug
    /// that isn't there.
    #[test]
    fn redaction_of_a_secret_containing_a_percent_leaves_no_stray_encoding() {
        let secret = "abc%";
        let resolved = BTreeMap::from([("secret:api_key".to_string(), secret.to_string())]);

        let encoded: String = url::form_urlencoded::byte_serialize(secret.as_bytes()).collect();
        assert_eq!(
            encoded, "abc%25",
            "test premise: the encoder must expand '%' for this case to exist"
        );

        let scrubbed = redact_secrets(&format!("upstream said: appid={encoded}"), &resolved);
        assert_eq!(scrubbed, "upstream said: appid=[redacted]");
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
