//! Integration coverage for `POST /api/fetch` (`platform::fetch::invoke`) —
//! the actual axum handler wired through the full router, not just the pure
//! `safe_label` unit tests already covered in `platform::fetch` itself.
//!
//! There is no manifest and no allowlist any more — see
//! `docs/superpowers/specs/2026-08-04-fetch-proxy-trust-model.md`. A caller
//! supplies a URL directly; this suite covers scheme validation, upstream
//! error mapping, caching, redirect handling, and the one property that
//! replaced secret redaction: a composed URL's query string never reaches a
//! log line.

// This file only needs `test_pool` and the log-capture helpers from the
// shared helpers module — the other export (`test_app`) is unused here by
// design, since every test below builds its own server via `test_server`.
// Silence the resulting dead_code warning rather than pulling in an unused
// import.
#[allow(dead_code)]
mod helpers;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

use helpers::{captured_logs, test_pool};

/// Spawns a local upstream that always answers `status`/`body` for any
/// path or method, and counts how many requests it has received. Standing
/// in for a real integration's upstream.
async fn spawn_upstream(status: u16, body: &'static str) -> (SocketAddr, Arc<Mutex<usize>>) {
    let hits = Arc::new(Mutex::new(0usize));
    let hits_for_route = hits.clone();
    let status = StatusCode::from_u16(status).expect("valid status code");
    let app = axum::Router::new().fallback(move || {
        let hits = hits_for_route.clone();
        async move {
            *hits.lock().expect("hits mutex not poisoned") += 1;
            (status, body)
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind local upstream");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (addr, hits)
}

/// A single request as the stub upstream in [`spawn_capturing_upstream`] saw
/// it: method, lower-cased header names, the raw body, and `Content-Type`.
#[derive(Clone, Debug, Default)]
struct CapturedRequest {
    method: String,
    headers: std::collections::HashMap<String, String>,
    body: String,
    content_type: Option<String>,
}

/// Spawns a local upstream that records the last request it received —
/// method, headers (names lower-cased, matching HTTP's case-insensitivity),
/// body, and `Content-Type` — and always answers 200 with a small JSON body.
/// Standing in for a real integration's upstream when a test needs to
/// inspect what `invoke` actually sent, not just count hits.
async fn spawn_capturing_upstream() -> (SocketAddr, Arc<Mutex<Option<CapturedRequest>>>) {
    let captured = Arc::new(Mutex::new(None));
    let captured_for_route = captured.clone();
    let app = axum::Router::new().fallback(move |req: axum::extract::Request| {
        let captured = captured_for_route.clone();
        async move {
            let method = req.method().to_string();
            let content_type = req
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(str::to_string);
            let headers = req
                .headers()
                .iter()
                .map(|(name, value)| {
                    (
                        name.as_str().to_ascii_lowercase(),
                        value.to_str().unwrap_or_default().to_string(),
                    )
                })
                .collect();
            let body_bytes = axum::body::to_bytes(req.into_body(), usize::MAX)
                .await
                .unwrap_or_default();
            let body = String::from_utf8_lossy(&body_bytes).to_string();
            *captured.lock().expect("capture mutex not poisoned") = Some(CapturedRequest {
                method,
                headers,
                body,
                content_type,
            });
            (StatusCode::OK, r#"{"ok":true}"#)
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind local upstream");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (addr, captured)
}

/// Spawns a local upstream that 303s any request to `target`, counting how
/// many times it was hit itself. Used to prove a redirect is never followed
/// — the second server (`target`) should never see a request at all.
async fn spawn_redirect(target: &str) -> (SocketAddr, Arc<Mutex<usize>>) {
    let hits = Arc::new(Mutex::new(0usize));
    let hits_for_route = hits.clone();
    let target = target.to_string();
    let app = axum::Router::new().fallback(move || {
        let hits = hits_for_route.clone();
        let target = target.clone();
        async move {
            *hits.lock().expect("hits mutex not poisoned") += 1;
            axum::response::Redirect::to(&target)
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind local upstream");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (addr, hits)
}

async fn test_server() -> TestServer {
    let pool = test_pool().await;
    let app = dashboard_backend::integrations::router(pool);
    TestServer::new(app)
}

#[tokio::test]
async fn relays_the_upstream_json_body() {
    let (addr, _) = spawn_upstream(200, r#"{"ok":true}"#).await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/thing") }))
        .await;
    resp.assert_status_ok();
    resp.assert_json(&json!({ "ok": true }));
}

#[tokio::test]
async fn rejects_a_non_http_scheme() {
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": "file:///etc/passwd" }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn rejects_an_unparseable_url() {
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": "not a url" }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn a_non_2xx_upstream_is_a_500() {
    let (addr, _) = spawn_upstream(503, "upstream sad").await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/thing") }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn a_non_json_body_is_a_500() {
    let (addr, _) = spawn_upstream(200, "<html>not json</html>").await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/thing") }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn an_unreachable_upstream_is_a_500() {
    let server = test_server().await;
    // Port 1 on loopback: nothing listens, connection refused immediately.
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": "http://127.0.0.1:1/thing" }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn a_redirect_is_not_followed() {
    // The upstream 303s to a second server. With Policy::none() the 303 is
    // itself the response, which is non-2xx, so this is a 500 and the second
    // server is never contacted.
    let (target_addr, target_hits) = spawn_upstream(200, r#"{"reached":true}"#).await;
    let (addr, _) = spawn_redirect(&format!("http://{target_addr}/secret")).await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/start") }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(
        *target_hits.lock().unwrap(),
        0,
        "redirect target must never be contacted"
    );
}

#[tokio::test]
async fn a_cached_response_does_not_hit_the_upstream_again() {
    let (addr, hits) = spawn_upstream(200, r#"{"n":1}"#).await;
    let server = test_server().await;
    let body = json!({ "url": format!("http://{addr}/thing"), "ttl_secs": 60 });
    server.post("/fetch").json(&body).await.assert_status_ok();
    server.post("/fetch").json(&body).await.assert_status_ok();
    assert_eq!(
        *hits.lock().unwrap(),
        1,
        "second request must be served from cache"
    );
}

#[tokio::test]
async fn ttl_zero_does_not_cache() {
    let (addr, hits) = spawn_upstream(200, r#"{"n":1}"#).await;
    let server = test_server().await;
    let body = json!({ "url": format!("http://{addr}/thing") }); // ttl_secs absent -> 0
    server.post("/fetch").json(&body).await.assert_status_ok();
    server.post("/fetch").json(&body).await.assert_status_ok();
    assert_eq!(
        *hits.lock().unwrap(),
        2,
        "no caching without an explicit ttl"
    );
}

#[tokio::test]
async fn different_urls_are_cached_separately() {
    let (addr, hits) = spawn_upstream(200, r#"{"n":1}"#).await;
    let server = test_server().await;
    server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/a"), "ttl_secs": 60 }))
        .await
        .assert_status_ok();
    server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/b"), "ttl_secs": 60 }))
        .await
        .assert_status_ok();
    assert_eq!(
        *hits.lock().unwrap(),
        2,
        "distinct URLs are distinct cache keys"
    );
}

#[tokio::test]
async fn the_query_string_never_reaches_the_error_message() {
    // The whole reason `redact_secrets` is gone: nothing composes a URL into
    // a log line any more. A secret lives in the query, so asserting the
    // query is absent — from both the response body *and* the log line — is
    // asserting the secret is absent.
    let logs = captured_logs();
    let (addr, _) = spawn_upstream(503, "upstream sad").await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/thing?appid=s3cr3t-key%2Fvalue&units=imperial") }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
    let body = resp.text();
    assert!(
        !body.contains("s3cr3t"),
        "raw secret leaked into the response body"
    );
    assert!(
        !body.contains("appid"),
        "query string leaked into the response body"
    );

    // `AppError::Internal` already genericises the body above, so the real
    // proof is the log line, which is where the pre-existing redaction bug
    // this replaced would have shown up.
    let marker = addr.to_string();
    let logged = logs.lines_mentioning(&marker);
    assert!(
        !logged.is_empty(),
        "expected the non-2xx path to log something for {marker}"
    );
    assert!(
        !logged.contains("s3cr3t"),
        "the secret reached the log: {logged}"
    );
    assert!(
        !logged.contains("appid"),
        "the query string reached the log: {logged}"
    );
    assert!(
        logged.contains(&format!("http://{addr}/thing")),
        "the log should still carry origin and path: {logged}"
    );
}

#[tokio::test]
async fn the_query_string_never_reaches_the_log_when_the_upstream_is_unreachable() {
    // Regression coverage for a leak the non-2xx test above could not catch:
    // reqwest's `Error::Display` appends `" for url (...)"` -- full query
    // string included -- to a send failure, which happens on exactly this
    // path (nothing listens on port 1, so the connection is refused
    // immediately) and nowhere else in `invoke`. Without `.without_url()` on
    // that `map_err`, `safe_label` would be built correctly and then undone
    // by the error's own formatting. The secret below deliberately contains
    // `/`, `+`, `=`, and `?` -- percent-encoded into the URL -- so this is
    // sensitive to a leak of either the raw or the encoded form, not just
    // one.
    let logs = captured_logs();
    let marker = "/unreachable-leak-check";
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({
            "url": format!(
                "http://127.0.0.1:1{marker}?appid=s3cr3t%2Fv1%2BaG8%3D%3Fx&units=imperial"
            )
        }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);

    let logged = logs.lines_mentioning(marker);
    assert!(
        !logged.is_empty(),
        "expected the request-failure path to log something for {marker}"
    );
    assert!(
        !logged.contains("s3cr3t"),
        "the secret reached the log: {logged}"
    );
    assert!(
        !logged.contains("appid"),
        "the query string reached the log: {logged}"
    );
    assert!(
        logged.contains(&format!("http://127.0.0.1:1{marker}")),
        "the log should still carry origin and path: {logged}"
    );
}

#[tokio::test]
async fn issues_a_post_with_a_json_body() {
    let (addr, captured) = spawn_capturing_upstream().await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({
            "url": format!("http://{addr}/compute"),
            "method": "POST",
            "body": { "origin": "a", "destination": "b" }
        }))
        .await;
    resp.assert_status_ok();
    let req = captured
        .lock()
        .unwrap()
        .clone()
        .expect("upstream was called");
    assert_eq!(req.method, "POST");
    assert_eq!(req.body, r#"{"destination":"b","origin":"a"}"#);
    assert_eq!(req.content_type.as_deref(), Some("application/json"));
}

#[tokio::test]
async fn forwards_declared_headers() {
    let (addr, captured) = spawn_capturing_upstream().await;
    let server = test_server().await;
    server
        .post("/fetch")
        .json(&json!({
            "url": format!("http://{addr}/x"),
            "headers": { "X-Goog-Api-Key": "k123", "X-Goog-FieldMask": "routes.duration" }
        }))
        .await
        .assert_status_ok();
    let req = captured.lock().unwrap().clone().unwrap();
    assert_eq!(
        req.headers.get("x-goog-api-key").map(String::as_str),
        Some("k123")
    );
    assert_eq!(
        req.headers.get("x-goog-fieldmask").map(String::as_str),
        Some("routes.duration")
    );
}

#[tokio::test]
async fn defaults_to_get_with_no_body() {
    let (addr, captured) = spawn_capturing_upstream().await;
    let server = test_server().await;
    server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/x") }))
        .await
        .assert_status_ok();
    let req = captured.lock().unwrap().clone().unwrap();
    assert_eq!(req.method, "GET");
    assert!(req.body.is_empty());
}

#[tokio::test]
async fn rejects_an_unsupported_method() {
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": "https://example.com/x", "method": "TRACE" }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn rejects_an_invalid_header_name() {
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({
            "url": "https://example.com/x",
            "headers": { "Bad\nName": "v" }
        }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn rejects_an_invalid_header_value() {
    // Also pins that the error names the header without echoing the value:
    // the value here is deliberately not valid UTF-8/visible-ASCII (a bare
    // newline), so if the handler ever started interpolating it, this would
    // be the test to catch that.
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({
            "url": "https://example.com/x",
            "headers": { "X-Custom": "bad\nvalue" }
        }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
    let body = resp.text();
    assert!(
        body.contains("X-Custom") || body.to_ascii_lowercase().contains("x-custom"),
        "error should name the header: {body}"
    );
    assert!(
        !body.contains("bad\nvalue") && !body.contains("bad"),
        "error should not echo the header value: {body}"
    );
}

#[tokio::test]
async fn the_cache_key_distinguishes_method_and_body() {
    // Same URL, different request => must not serve one from the other's entry.
    let (addr, hits) = spawn_upstream(200, r#"{"n":1}"#).await;
    let server = test_server().await;
    let url = format!("http://{addr}/x");

    server
        .post("/fetch")
        .json(&json!({ "url": url, "ttl_secs": 60 }))
        .await
        .assert_status_ok();
    server
        .post("/fetch")
        .json(&json!({ "url": url, "method": "POST", "ttl_secs": 60 }))
        .await
        .assert_status_ok();
    server
        .post("/fetch")
        .json(&json!({ "url": url, "method": "POST", "body": {"a":1}, "ttl_secs": 60 }))
        .await
        .assert_status_ok();
    server
        .post("/fetch")
        .json(&json!({ "url": url, "method": "POST", "body": {"a":1}, "ttl_secs": 60 }))
        .await
        .assert_status_ok();

    assert_eq!(
        *hits.lock().unwrap(),
        3,
        "only the identical repeat may be a cache hit"
    );
}

#[tokio::test]
async fn headers_and_body_never_reach_the_log() {
    // The reason redaction was removed: nothing composes credentials into a
    // log line. Headers and bodies carry them just as query strings do.
    let logs = captured_logs();
    let (addr, _) = spawn_upstream(503, "upstream sad").await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({
            "url": format!("http://{addr}/x"),
            "method": "POST",
            "headers": { "Authorization": "Bearer s3cr3t/v1+aG8=?x" },
            "body": { "api_key": "b0dy-s3cr3t" }
        }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);

    let marker = addr.to_string();
    let logged = logs.lines_mentioning(&marker);
    assert!(
        !logged.is_empty(),
        "log capture produced nothing — the assertion below would be vacuous"
    );
    assert!(
        !logged.contains("s3cr3t"),
        "header secret leaked into the log"
    );
    assert!(
        !logged.contains("b0dy-s3cr3t"),
        "body secret leaked into the log"
    );
    assert!(
        !logged.contains("Authorization"),
        "header name leaked into the log"
    );
    assert!(
        logged.contains(&format!("http://{addr}/x")),
        "origin+path should still be logged"
    );
}

#[tokio::test]
async fn expect_text_wraps_the_body_as_json() {
    let (addr, _) = spawn_upstream(200, "<html><body>hello</body></html>").await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/page"), "expect": "text" }))
        .await;
    resp.assert_status_ok();
    resp.assert_json(&json!({ "text": "<html><body>hello</body></html>" }));
}

#[tokio::test]
async fn omitting_expect_still_parses_json_and_posts_body_unchanged() {
    // Pins that an existing caller — one that has never heard of `expect` —
    // is unaffected: the response is still parsed JSON, and the outbound
    // request `invoke` sends upstream is byte-for-byte what it always was.
    let (addr, captured) = spawn_capturing_upstream().await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({
            "url": format!("http://{addr}/compute"),
            "method": "POST",
            "body": { "origin": "a", "destination": "b" }
        }))
        .await;
    resp.assert_status_ok();
    resp.assert_json(&json!({ "ok": true }));
    let req = captured
        .lock()
        .unwrap()
        .clone()
        .expect("upstream was called");
    assert_eq!(req.body, r#"{"destination":"b","origin":"a"}"#);
    assert_eq!(req.content_type.as_deref(), Some("application/json"));
}

#[tokio::test]
async fn rejects_an_unsupported_expect_value() {
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": "https://example.com/x", "expect": "xml" }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn a_text_request_and_a_json_request_do_not_share_a_cache_entry() {
    // The important regression: `expect` must be part of the cache key.
    // Delete it from `cache_key` and this fails — a `text` request served
    // from a `json` entry (or vice versa) would return the wrong shape
    // entirely, not just stale data.
    let (addr, hits) = spawn_upstream(200, r#"{"n":1}"#).await;
    let server = test_server().await;
    let url = format!("http://{addr}/shared");

    let json_resp = server
        .post("/fetch")
        .json(&json!({ "url": url, "ttl_secs": 60 }))
        .await;
    json_resp.assert_status_ok();
    json_resp.assert_json(&json!({ "n": 1 }));

    let text_resp = server
        .post("/fetch")
        .json(&json!({ "url": url, "expect": "text", "ttl_secs": 60 }))
        .await;
    text_resp.assert_status_ok();
    text_resp.assert_json(&json!({ "text": r#"{"n":1}"# }));

    assert_eq!(
        *hits.lock().unwrap(),
        2,
        "a json request and a text request to the same URL must each reach the upstream, \
         not share a cache entry"
    );
}

#[tokio::test]
async fn a_text_response_body_never_reaches_the_log() {
    // The one security property this module keeps: a response body is never
    // logged. A `text` response is body content like any other JSON payload
    // — nothing distinguishes it at the logging boundary, so a distinctive
    // marker in the HTML body must never show up in captured logs, even
    // though this request errors out and `AppError::Internal` logs a message
    // for it.
    let logs = captured_logs();
    let marker = "distinctive-html-marker-should-never-be-logged";
    let (addr, _) = spawn_upstream(
        503,
        "<html>distinctive-html-marker-should-never-be-logged</html>",
    )
    .await;
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({ "url": format!("http://{addr}/page"), "expect": "text" }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);

    let marker_addr = addr.to_string();
    let logged = logs.lines_mentioning(&marker_addr);
    assert!(
        !logged.is_empty(),
        "expected the non-2xx path to log something for {marker_addr}"
    );
    assert!(
        !logged.contains(marker),
        "the response body leaked into the log: {logged}"
    );
}

#[tokio::test]
async fn headers_and_body_never_reach_the_log_when_the_upstream_is_unreachable() {
    // The test above only exercises the non-2xx arm. This mirrors
    // `the_query_string_never_reaches_the_log_when_the_upstream_is_unreachable`
    // but for headers/body: reqwest's `Error::Display` reattaching the full
    // URL to a `send()` failure is exactly where the previous round's leak
    // lived, and it is untouched by the non-2xx test above. Secrets
    // deliberately contain `/`, `+`, `=`, and `?` so this is sensitive to a
    // leak of either the raw or the percent-encoded form, not just one.
    let logs = captured_logs();
    let marker = "/unreachable-leak-check-headers-body";
    let server = test_server().await;
    let resp = server
        .post("/fetch")
        .json(&json!({
            "url": format!("http://127.0.0.1:1{marker}"),
            "method": "POST",
            "headers": { "Authorization": "Bearer s3cr3t/v1+aG8=?x" },
            "body": { "api_key": "b0dy-s3cr3t/v1+aG8=?x" }
        }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);

    let logged = logs.lines_mentioning(marker);
    assert!(
        !logged.is_empty(),
        "expected the request-failure path to log something for {marker}"
    );
    assert!(
        !logged.contains("s3cr3t"),
        "a secret reached the log: {logged}"
    );
    assert!(
        !logged.contains("Authorization"),
        "the header name reached the log: {logged}"
    );
    assert!(
        logged.contains(&format!("http://127.0.0.1:1{marker}")),
        "the log should still carry origin and path: {logged}"
    );
}
