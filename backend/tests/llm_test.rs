//! Integration coverage for `POST /api/llm/generate` (`llm::generate_route`,
//! wrapping `llm::generate`) — the single openai-compatible backend, and the
//! same no-logging discipline `platform::fetch` established: a prompt or its
//! generated response must never reach a log line, only the model name and,
//! on failure, the upstream status.

#[allow(dead_code)]
mod helpers;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

use helpers::{captured_logs, test_pool};

/// Spawns a local upstream standing in for an openai-compatible
/// `/v1/chat/completions` endpoint. Always answers `status`/`body` for any
/// path or method, and counts how many requests it received.
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

async fn test_server_with_llm_url(url: &str) -> TestServer {
    let pool = test_pool().await;
    sqlx::query("INSERT INTO config (key, value) VALUES ('llm.url', ?)")
        .bind(url)
        .execute(&pool)
        .await
        .expect("seed llm.url");
    let app = dashboard_backend::integrations::router(pool);
    TestServer::new(app)
}

#[tokio::test]
async fn generate_returns_the_upstream_text() {
    let (addr, _) = spawn_upstream(
        200,
        r#"{"choices":[{"message":{"content":"  the answer is 42  "}}]}"#,
    )
    .await;
    let server = test_server_with_llm_url(&format!("http://{addr}")).await;
    let resp = server
        .post("/llm/generate")
        .json(&json!({ "model": "test-model", "prompt": "what is the answer?" }))
        .await;
    resp.assert_status_ok();
    resp.assert_json(&json!({ "text": "the answer is 42" }));
}

#[tokio::test]
async fn a_non_2xx_upstream_is_a_500() {
    let (addr, _) = spawn_upstream(503, "upstream sad").await;
    let server = test_server_with_llm_url(&format!("http://{addr}")).await;
    let resp = server
        .post("/llm/generate")
        .json(&json!({ "model": "test-model", "prompt": "hello" }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn a_non_2xx_upstream_error_names_the_model_and_status_not_the_body() {
    let (addr, _) = spawn_upstream(503, "sensitive upstream diagnostic text").await;
    let server = test_server_with_llm_url(&format!("http://{addr}")).await;
    let resp = server
        .post("/llm/generate")
        .json(&json!({ "model": "my-special-model", "prompt": "hello" }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
    let body = resp.text();
    assert!(
        !body.contains("sensitive upstream diagnostic text"),
        "upstream body leaked into the response: {body}"
    );
}

#[tokio::test]
async fn an_unreachable_upstream_is_a_500() {
    // Port 1 on loopback: nothing listens, connection refused immediately.
    let server = test_server_with_llm_url("http://127.0.0.1:1").await;
    let resp = server
        .post("/llm/generate")
        .json(&json!({ "model": "test-model", "prompt": "hello" }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn the_prompt_and_response_text_never_reach_the_log() {
    // The hard rule this project has for anything that relays arbitrary
    // content (see `platform::fetch`): neither what we send an LLM nor what
    // it sends back may land in a log line. Exercise both the success path
    // (response text) and the failure path (upstream error body) since each
    // is a distinct place that content could leak from.
    let logs = captured_logs();

    // Success path: the prompt and the generated text must not appear.
    // These payloads are distinctive enough on their own to search the whole
    // captured log for directly — no need to scope by address or model
    // first, and doing so would be wrong here: a successful call logs
    // nothing of its own to scope by.
    let (addr, _) = spawn_upstream(
        200,
        r#"{"choices":[{"message":{"content":"t0p-s3cr3t-response-payload"}}]}"#,
    )
    .await;
    let server = test_server_with_llm_url(&format!("http://{addr}")).await;
    server
        .post("/llm/generate")
        .json(&json!({
            "model": "leak-check-model",
            "prompt": "t0p-s3cr3t-prompt-payload"
        }))
        .await
        .assert_status_ok();

    assert!(
        logs.lines_mentioning("t0p-s3cr3t-prompt-payload")
            .is_empty(),
        "the prompt reached the log"
    );
    assert!(
        logs.lines_mentioning("t0p-s3cr3t-response-payload")
            .is_empty(),
        "the response text reached the log"
    );

    // Failure path: the upstream's error body must not appear either, only
    // the model name and status. The error message deliberately carries no
    // URL (unlike `platform::fetch`'s `label`), so the marker to search the
    // log for is the model name itself, not the upstream's address.
    let (bad_addr, _) = spawn_upstream(503, "s3cr3t-upstream-diagnostic-body").await;
    let bad_server = test_server_with_llm_url(&format!("http://{bad_addr}")).await;
    let bad_marker = "leak-check-model-2";
    bad_server
        .post("/llm/generate")
        .json(&json!({
            "model": bad_marker,
            "prompt": "another-s3cr3t-prompt"
        }))
        .await
        .assert_status(StatusCode::INTERNAL_SERVER_ERROR);

    let bad_logged = logs.lines_mentioning(bad_marker);
    assert!(
        !bad_logged.is_empty(),
        "expected the non-2xx path to log something for {bad_marker}"
    );
    assert!(
        !bad_logged.contains("s3cr3t-upstream-diagnostic-body"),
        "the upstream error body reached the log: {bad_logged}"
    );
    assert!(
        !bad_logged.contains("another-s3cr3t-prompt"),
        "the prompt reached the log on the failure path: {bad_logged}"
    );
    assert!(
        bad_logged.contains(bad_marker),
        "the model name should still be in the log for debuggability: {bad_logged}"
    );
    assert!(
        bad_logged.contains("503"),
        "the upstream status should still be in the log: {bad_logged}"
    );
}

#[tokio::test]
async fn models_endpoint_still_lists_models_via_openai_compat() {
    let (addr, _) = spawn_upstream(200, r#"{"data":[{"id":"model-a"},{"id":"model-b"}]}"#).await;
    let server = test_server_with_llm_url(&format!("http://{addr}")).await;
    let resp = server.get("/llm/models").await;
    resp.assert_status_ok();
    resp.assert_json(&json!({
        "models": [{ "name": "model-a" }, { "name": "model-b" }]
    }));
}
