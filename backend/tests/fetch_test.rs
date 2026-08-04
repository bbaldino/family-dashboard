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

// This file only needs `test_pool` from the shared helpers module — the
// other export (`test_app`) is unused here by design, since every test below
// builds its own server via `test_server`. Silence the resulting dead_code
// warning rather than pulling in an unused import.
#[allow(dead_code)]
mod helpers;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex, OnceLock};

use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

use helpers::test_pool;

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

/// A `tracing` writer that appends every formatted event into a shared
/// buffer, so a test can assert on what this process *logged* rather than
/// only on what it returned. Needed because `AppError::Internal` renders a
/// generic body to the caller and puts the real message in a
/// `tracing::error!` — which is exactly where a leaked query string would
/// land, and the only place it can be observed.
#[derive(Clone, Default)]
struct CapturedLogs(Arc<Mutex<Vec<u8>>>);

impl CapturedLogs {
    /// Every line logged by this test process so far that mentions
    /// `marker`. Tests share one global subscriber (only one may be
    /// installed per process) and run in parallel, so each test filters on
    /// something unique to it — here, the random port of its own spawned
    /// upstream — otherwise an assertion could pass or fail on another
    /// test's output.
    fn lines_mentioning(&self, marker: &str) -> String {
        let bytes = self.0.lock().expect("log buffer not poisoned");
        String::from_utf8_lossy(&bytes)
            .lines()
            .filter(|line| line.contains(marker))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

impl std::io::Write for CapturedLogs {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0
            .lock()
            .expect("log buffer not poisoned")
            .extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for CapturedLogs {
    type Writer = CapturedLogs;

    fn make_writer(&'a self) -> Self::Writer {
        self.clone()
    }
}

/// Installs the capturing subscriber the first time it is called and hands
/// back the shared buffer. `set_global_default` may only succeed once per
/// process, hence the `OnceLock`.
fn captured_logs() -> &'static CapturedLogs {
    static LOGS: OnceLock<CapturedLogs> = OnceLock::new();
    LOGS.get_or_init(|| {
        let logs = CapturedLogs::default();
        let subscriber = tracing_subscriber::fmt()
            .with_writer(logs.clone())
            .with_ansi(false)
            .with_max_level(tracing::Level::TRACE)
            .finish();
        tracing::subscriber::set_global_default(subscriber)
            .expect("no other global tracing subscriber in this test process");
        logs
    })
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
