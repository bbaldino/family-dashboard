use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Path, State};
use axum::{Json, Router};
use serde::Deserialize;
use tokio::sync::RwLock;
use url::Url;

use super::manifest::{Endpoint, Manifest};
use crate::error::AppError;

#[derive(Clone)]
pub struct PlatformState {
    pub manifest: Arc<Manifest>,
    pub client: reqwest::Client,
    pub cache: Arc<ResponseCache>,
}

#[derive(Default)]
pub struct ResponseCache {
    entries: RwLock<BTreeMap<String, (serde_json::Value, Instant)>>,
}

impl ResponseCache {
    pub fn new() -> Self {
        Self::default()
    }

    async fn get(&self, key: &str, ttl: Duration) -> Option<serde_json::Value> {
        let guard = self.entries.read().await;
        let (value, at) = guard.get(key)?;
        (at.elapsed() < ttl).then(|| value.clone())
    }

    async fn set(&self, key: String, value: serde_json::Value) {
        self.entries
            .write()
            .await
            .insert(key, (value, Instant::now()));
    }
}

pub fn cache_key(integration: &str, endpoint: &str, params: &BTreeMap<String, String>) -> String {
    // BTreeMap iterates in key order, so the same params always produce the
    // same key regardless of the order the client sent them.
    let mut key = format!("{integration}::{endpoint}");
    for (k, v) in params {
        key.push_str(&format!("::{k}={v}"));
    }
    key
}

/// Build the upstream URL from the manifest, substituting only `{{param:…}}`
/// placeholders in query values. `base` and `path` come from the manifest and
/// can never be influenced by the request — that is the SSRF boundary — but
/// `path` still gets two checks before it's used:
///
/// 1. It must be a plain, root-anchored path (`/api/today`), never an
///    absolute URL (`https://evil.example.com/x`) or a network-path
///    reference (`//evil.example.com/x`). `Url::join` treats both of those
///    as license to replace the authority — see
///    `documents_why_join_alone_is_not_enough_for_absolute_paths` below for
///    a direct demonstration. Rejecting them here means a malformed or
///    generated manifest entry can retarget the *path* on the declared host
///    at worst, never the host itself.
/// 2. It must not contain a `..` segment, so it can't walk the resolved
///    request outside the sub-path the manifest entry declares (it still
///    can't leave the host — dot-segment removal is bounded by the URL
///    root — but a manifest bug or generator could otherwise aim a
///    "daily-quote" entry at an unrelated path on the same host).
///
/// `base` may also already carry its own path or query
/// (`https://host/a?b=c`), which is a well-formed URL and passes Task 3's
/// manifest validation. Naive `base + path` string concatenation against
/// that produces a malformed URL. `Url::join` with a root-anchored path
/// reference instead *replaces* the base's path, query, and fragment
/// entirely (RFC 3986 §5.3) — the base's own path/query never leaks into
/// the result. `url.set_query(None)` right after is defense in depth for
/// that same property, not load-bearing on its own.
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

    if endpoint.path.contains("://")
        || endpoint.path.starts_with("//")
        || !endpoint.path.starts_with('/')
        || endpoint.path.split('/').any(|segment| segment == "..")
    {
        return Err(AppError::Internal(format!(
            "endpoint path {:?} must be a plain, root-anchored path with no \
             scheme, no network-path reference, and no '..' segments",
            endpoint.path
        )));
    }

    let mut url = base
        .join(&endpoint.path)
        .map_err(|e| AppError::Internal(format!("failed to resolve endpoint url: {}", e)))?;
    url.set_query(None);

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

#[derive(Deserialize, Default)]
pub struct FetchRequest {
    #[serde(default)]
    pub params: BTreeMap<String, String>,
}

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

    let key = cache_key(&integration, &endpoint, &req.params);
    if ep.ttl_secs > 0
        && let Some(hit) = state
            .cache
            .get(&key, Duration::from_secs(ep.ttl_secs))
            .await
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
        state.cache.set(key, data.clone()).await;
    }
    Ok(Json(data))
}

pub fn router(manifest: Arc<Manifest>) -> Router {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let state = PlatformState {
        manifest,
        client,
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
            method: "GET".into(),
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

    // --- The two gaps deferred from Task 3's review ---

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
}
