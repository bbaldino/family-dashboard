//! The `fetch` capability: `POST /api/fetch`.
//!
//! A client supplies a URL; this relays the response and caches it. There is
//! deliberately no allowlist — see
//! `docs/superpowers/specs/2026-08-04-fetch-proxy-trust-model.md` for what
//! that accepts, why, and the triggers that should make us revisit it.
//!
//! The one rule kept here is that **no composed URL, header, or body is ever
//! logged**. Credentials travel in query strings, headers, and request
//! bodies alike, so error messages carry the origin and path only — never
//! the query, never a header name/value, never the body. That is what
//! replaced the old `redact_secrets`, and it is strictly safer: there is no
//! encoding variant to miss.
//!
//! That rule has one trap: `reqwest::Error`'s own `Display` appends
//! `" for url (...)"` -- full query string included -- to any error that
//! carries a URL, which a `send()` failure always does. Every `map_err` on a
//! `reqwest::Error` in [`invoke`] must call `.without_url()` first, or the
//! error's own formatting silently reintroduces exactly what `safe_label`
//! was built to avoid.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::RwLock;
use url::Url;

use crate::error::AppError;

/// Hard cap on distinct cache entries held across all callers. Bounds the
/// *number* of entries, not their size.
///
/// `expect: "text"` (see [`Expect`]) makes that distinction matter: a scraped
/// HTML page can be a hundred-plus kilobytes, versus a typical JSON payload's
/// low single-digit kilobytes, so 500 entries no longer implies a small
/// worst-case footprint. No response-size cap was added for it. A cap that
/// rejects a legitimate page is worse than the memory it saves, and the
/// realistic worst case here is small: entries this large only come from
/// `expect: "text"`, which as of this writing has exactly one caller
/// (`word-of-the-day`, one Merriam-Webster RSS feed, refreshed on an hourly
/// TTL) — nowhere near 500 distinct large entries. Revisit if a second
/// high-volume text caller shows up, or add real memory pressure monitoring
/// instead of guessing at a byte limit.
const MAX_CACHE_ENTRIES: usize = 500;

#[derive(Clone)]
pub struct PlatformState {
    pub client: reqwest::Client,
    pub cache: Arc<ResponseCache>,
}

struct CacheEntry {
    value: serde_json::Value,
    inserted_at: Instant,
    ttl: Duration,
}

/// Per-response TTL cache keyed by the full request — method, URL, headers,
/// and body (see [`cache_key`]), not the URL alone.
///
/// Entries are purged lazily — `get` treats an expired entry as a miss, and
/// `set` drops expired entries before enforcing [`MAX_CACHE_ENTRIES`].
/// Eviction is oldest-insert, not true LRU.
#[derive(Default)]
pub struct ResponseCache {
    entries: RwLock<BTreeMap<String, CacheEntry>>,
}

impl ResponseCache {
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
        guard.retain(|_, entry| entry.inserted_at.elapsed() < entry.ttl);

        if guard.len() >= MAX_CACHE_ENTRIES
            && let Some(oldest) = guard
                .iter()
                .min_by_key(|(_, entry)| entry.inserted_at)
                .map(|(k, _)| k.clone())
        {
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

/// The request body: `{"url", "method"?, "headers"?, "body"?, "expect"?,
/// "ttl_secs"?}`.
///
/// `method` defaults to GET and is restricted to the verbs an integration
/// legitimately needs — an upstream API call, not arbitrary HTTP. `headers`
/// and `body` exist because real APIs need them: Google's Routes API, for
/// example, needs `POST`, two `X-Goog-*` headers, and a JSON body — driven
/// by a client integration on the frontend, not a Rust router. `expect`
/// defaults to `"json"`, so every caller that predates it is unaffected; see
/// [`Expect`] for what `"text"` does.
#[derive(Deserialize)]
pub struct FetchRequest {
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub body: Option<serde_json::Value>,
    #[serde(default)]
    pub expect: Option<String>,
    #[serde(default)]
    pub ttl_secs: u64,
}

/// Verbs an integration may ask for. Deliberately not `TRACE`/`CONNECT`, and
/// not an open passthrough: this is for calling upstream APIs.
fn parse_method(raw: Option<&str>) -> Result<reqwest::Method, AppError> {
    match raw.unwrap_or("GET").to_ascii_uppercase().as_str() {
        "GET" => Ok(reqwest::Method::GET),
        "POST" => Ok(reqwest::Method::POST),
        "PUT" => Ok(reqwest::Method::PUT),
        "PATCH" => Ok(reqwest::Method::PATCH),
        "DELETE" => Ok(reqwest::Method::DELETE),
        other => Err(AppError::BadRequest(format!(
            "unsupported method {other:?}"
        ))),
    }
}

/// How to interpret the upstream response body.
///
/// `Json` is today's behaviour: parse as JSON, return as-is. `Text` exists
/// for upstreams that are not JSON at all — `word-of-the-day` fetches
/// Merriam-Webster's Word of the Day RSS feed, which a `resp.json()` call
/// can only ever fail on. The response is still wrapped as JSON
/// (`{"text": "<body>"}`) so every caller of this endpoint can assume a
/// JSON response and never branch on `Content-Type`.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Expect {
    Json,
    Text,
}

impl Expect {
    fn as_str(self) -> &'static str {
        match self {
            Expect::Json => "json",
            Expect::Text => "text",
        }
    }
}

/// Parses the `expect` field. Defaults to `Json`, mirroring how
/// [`parse_method`] defaults to `GET` — every caller that predates this
/// field keeps working unchanged.
fn parse_expect(raw: Option<&str>) -> Result<Expect, AppError> {
    match raw.unwrap_or("json") {
        "json" => Ok(Expect::Json),
        "text" => Ok(Expect::Text),
        other => Err(AppError::BadRequest(format!(
            "unsupported expect {other:?}"
        ))),
    }
}

/// Cache key for a request. JSON rather than a hand-joined string so no
/// separator collision is possible, and `BTreeMap` serialises in sorted order
/// so header ordering does not produce distinct keys for identical requests.
///
/// Method and body are part of the key because a GET and a POST to the same
/// URL are different resources; without them the second would be served the
/// first's cached response. `expect` is part of it for the same reason: a
/// `text`-wrapped `{"text": ...}` response and a parsed JSON response for the
/// same URL are different shapes, so a `text` and a `json` request to the
/// same URL must not share an entry — without this, whichever request
/// populated the cache first would silently dictate the shape the other one
/// gets back.
fn cache_key(
    url: &Url,
    method: &reqwest::Method,
    headers: &BTreeMap<String, String>,
    body: Option<&serde_json::Value>,
    expect: Expect,
) -> String {
    serde_json::to_string(&(
        method.as_str(),
        url.as_str(),
        headers,
        body,
        expect.as_str(),
    ))
    .unwrap_or_else(|_| url.to_string())
}

/// A log-safe rendering of a URL: scheme, host, port, and path — never the
/// query, which is where credentials live.
fn safe_label(url: &Url) -> String {
    format!("{}{}", url.origin().ascii_serialization(), url.path())
}

/// `POST /api/fetch` — fetch a URL and relay its body, as JSON or as text
/// wrapped in JSON depending on `expect` (see [`Expect`]).
///
/// Errors:
/// - **400** — the URL will not parse, its scheme is not `http`/`https`, the
///   method is unsupported, a header is invalid, or `expect` is neither
///   `"json"` nor `"text"` (and not omitted).
/// - **500** — the upstream was unreachable, returned a non-2xx, or (for
///   `expect: "json"`) sent a body that would not parse as JSON.
///   `AppError::Internal` renders a generic body to the caller; the log
///   carries origin and path only — never the response body, which for a
///   `text` request is exactly what a caller asked to relay.
///
/// Caching: `ttl_secs > 0` reads and writes the cache, keyed on the full
/// request (method, URL, headers, body, and expect — see [`cache_key`]).
/// Concurrent misses are not single-flighted — each reaches the upstream.
pub async fn invoke(
    State(state): State<PlatformState>,
    Json(req): Json<FetchRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let url =
        Url::parse(&req.url).map_err(|e| AppError::BadRequest(format!("not a valid URL: {e}")))?;

    // The only guard kept. Without it a caller could reach `file://` and read
    // the container's filesystem, which is a different class of problem from
    // reaching a LAN host over HTTP.
    if !matches!(url.scheme(), "http" | "https") {
        return Err(AppError::BadRequest(format!(
            "scheme {:?} is not http or https",
            url.scheme()
        )));
    }

    let label = safe_label(&url);

    let method = parse_method(req.method.as_deref())?;
    let expect = parse_expect(req.expect.as_deref())?;

    // Build the header map up front so an invalid name or value is a 400
    // rather than a surprise at send time.
    let mut headers = reqwest::header::HeaderMap::new();
    for (name, value) in &req.headers {
        let name = reqwest::header::HeaderName::from_bytes(name.as_bytes())
            .map_err(|_| AppError::BadRequest(format!("invalid header name {name:?}")))?;
        let value = reqwest::header::HeaderValue::from_str(value)
            // Deliberately does NOT echo the value — it may be a credential.
            .map_err(|_| AppError::BadRequest(format!("invalid value for header {name}")))?;
        headers.insert(name, value);
    }

    let key = cache_key(&url, &method, &req.headers, req.body.as_ref(), expect);

    if req.ttl_secs > 0
        && let Some(hit) = state.cache.get(&key).await
    {
        return Ok(Json(hit));
    }

    let mut builder = state.client.request(method, url.clone()).headers(headers);
    if let Some(body) = &req.body {
        builder = builder.json(body);
    }
    let resp = builder
        .send()
        .await
        // reqwest's `Error::Display` appends `" for url (...)"` -- including
        // the query string -- whenever the error carries one, which a send
        // failure always does. `without_url()` strips it so `label` (origin
        // + path only) is genuinely the only URL information in this
        // message, not undone by the error's own formatting.
        .map_err(|e| AppError::Internal(format!("{label} request failed: {}", e.without_url())))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "{label} upstream returned {}",
            resp.status()
        )));
    }

    // Neither arm below ever puts the response body itself into an error
    // message or a log — only `label` (origin + path) and the underlying
    // `reqwest::Error`'s own text, which for a decode/read failure describes
    // *why* it failed, not the bytes that failed to decode.
    let data: serde_json::Value = match expect {
        Expect::Json => resp
            .json()
            .await
            // `resp.json()`'s error is `Kind::Decode`, which reqwest never
            // attaches a URL to today, so `without_url()` is a no-op here
            // right now -- kept anyway so this call site can't start leaking
            // on some future reqwest version that changes that, without
            // anyone having to notice and come back to add it.
            .map_err(|e| {
                AppError::Internal(format!("{label} parse failed: {}", e.without_url()))
            })?,
        Expect::Text => {
            let text = resp.text().await.map_err(|e| {
                AppError::Internal(format!("{label} read failed: {}", e.without_url()))
            })?;
            json!({ "text": text })
        }
    };

    if req.ttl_secs > 0 {
        state
            .cache
            .set(key, data.clone(), Duration::from_secs(req.ttl_secs))
            .await;
    }
    Ok(Json(data))
}

/// Builds the outbound client. Pulled out of `router` so the test below
/// exercises the exact construction path rather than a copy of it.
fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        // Redirects stay disabled. With no allowlist this matters more, not
        // less: following a 3xx would let whatever the upstream returns today
        // decide which host this process contacts next.
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

/// Builds the fetch router, mounted by `integrations::router` under `/fetch`.
pub fn router() -> Router {
    let state = PlatformState {
        client: build_client(),
        cache: Arc::new(ResponseCache::new()),
    };

    Router::new()
        .route("/", axum::routing::post(invoke))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_label_drops_the_query() {
        let url =
            Url::parse("https://api.example.com/v1/thing?appid=secret&units=imperial").unwrap();
        let label = safe_label(&url);
        assert_eq!(label, "https://api.example.com/v1/thing");
        assert!(!label.contains("secret"));
        assert!(!label.contains("appid"));
    }

    #[test]
    fn safe_label_keeps_a_non_default_port() {
        let url = Url::parse("http://192.168.1.42:8095/api/x?token=t").unwrap();
        assert_eq!(safe_label(&url), "http://192.168.1.42:8095/api/x");
    }
}
