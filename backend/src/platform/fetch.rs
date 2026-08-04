//! The `fetch` capability: `POST /api/fetch`.
//!
//! A client supplies a URL; this relays the response and caches it. There is
//! deliberately no allowlist — see
//! `docs/superpowers/specs/2026-08-04-fetch-proxy-trust-model.md` for what
//! that accepts, why, and the triggers that should make us revisit it.
//!
//! The one rule kept here is that **no composed URL is ever logged**.
//! Credentials travel in query strings, so error messages carry the origin
//! and path only. That is what replaced the old `redact_secrets`, and it is
//! strictly safer: there is no encoding variant to miss.
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
use tokio::sync::RwLock;
use url::Url;

use crate::error::AppError;

/// Hard cap on distinct cache entries held across all callers. Bounds memory
/// only; it does not protect an upstream from being hit on every miss.
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

/// Per-response TTL cache keyed by the full request URL.
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

/// The request body: `{"url": "https://…", "ttl_secs": 600}`.
///
/// `ttl_secs` is optional and defaults to `0`, which means "do not cache".
/// Caching is opt-in per request because the caller knows how fast its
/// upstream changes and this module does not.
#[derive(Deserialize)]
pub struct FetchRequest {
    pub url: String,
    #[serde(default)]
    pub ttl_secs: u64,
}

/// A log-safe rendering of a URL: scheme, host, port, and path — never the
/// query, which is where credentials live.
fn safe_label(url: &Url) -> String {
    format!("{}{}", url.origin().ascii_serialization(), url.path())
}

/// `POST /api/fetch` — fetch a URL and relay its JSON body.
///
/// Errors:
/// - **400** — the URL will not parse, or its scheme is not `http`/`https`.
/// - **500** — the upstream was unreachable, returned a non-2xx, or sent a
///   body that would not parse as JSON. `AppError::Internal` renders a
///   generic body to the caller; the log carries origin and path only.
///
/// Caching: `ttl_secs > 0` reads and writes the cache, keyed on the full URL.
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

    if req.ttl_secs > 0
        && let Some(hit) = state.cache.get(url.as_str()).await
    {
        return Ok(Json(hit));
    }

    let resp = state
        .client
        .get(url.clone())
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

    let data: serde_json::Value = resp
        .json()
        .await
        // `resp.json()`'s error is `Kind::Decode`, which reqwest never
        // attaches a URL to today, so `without_url()` is a no-op here right
        // now -- kept anyway so this call site can't start leaking on some
        // future reqwest version that changes that, without anyone having to
        // notice and come back to add it.
        .map_err(|e| AppError::Internal(format!("{label} parse failed: {}", e.without_url())))?;

    if req.ttl_secs > 0 {
        state
            .cache
            .set(
                url.as_str().to_string(),
                data.clone(),
                Duration::from_secs(req.ttl_secs),
            )
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
