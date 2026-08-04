//! Integration coverage for the `/fetch/{integration}/{endpoint}` handler
//! (`platform::fetch::invoke`) — the actual axum handler wired through the
//! full router, not just the pure `build_url`/`cache_key` helpers already
//! covered by `platform::fetch`'s own unit tests.
//!
//! Before this file, `helpers::test_app()` installed an empty manifest
//! (`{"version":1,"integrations":{}}`), so no integration test could ever
//! reach `/api/fetch` at all. Each test here builds its own manifest instead,
//! pointing at a local axum listener that stands in for the upstream — the
//! same technique `platform::fetch`'s redirect test uses.
//!
//! Scope is deliberately narrow: unknown integration/endpoint, an undeclared
//! param, and a cache hit. TTL expiry, eviction, and exhaustive error-mapping
//! coverage are out of scope for this pass.

// This file only needs `test_pool` from the shared helpers module — the
// other exports (`test_app`, backed by an empty manifest) are unused here by
// design, since every test below needs its own manifest instead. Silence the
// resulting dead_code warning rather than pulling in an unused import.
#[allow(dead_code)]
mod helpers;

use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use axum::extract::RawQuery;
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use axum_test::TestServer;
use dashboard_backend::platform::manifest::Manifest;
use serde_json::json;

use helpers::test_pool;

/// Spawns a local upstream that counts how many times it's been hit and
/// always returns the same small JSON body. Standing in for a real
/// integration's upstream (ZenQuotes, Home Assistant, etc.).
async fn spawn_counting_upstream() -> (SocketAddr, Arc<AtomicUsize>) {
    let hits = Arc::new(AtomicUsize::new(0));
    let hits_for_route = hits.clone();
    let app = Router::new().route(
        "/data",
        get(move || {
            let hits = hits_for_route.clone();
            async move {
                hits.fetch_add(1, Ordering::SeqCst);
                Json(json!({ "value": "ok" }))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind local upstream");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (addr, hits)
}

/// Spawns a local upstream that records the query string of the most
/// recent request it received (`None` until first hit) and returns a small
/// JSON body. Standing in for a real upstream so a test can assert *what
/// value it actually received* — the only way to prove a
/// `{{secret:…}}`/`{{cfg:…}}` placeholder resolved to the household's
/// configured value and not something a client supplied.
async fn spawn_capturing_upstream() -> (SocketAddr, Arc<Mutex<Option<String>>>) {
    let last_query: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let captured = last_query.clone();
    let app = Router::new().route(
        "/data",
        get(move |RawQuery(query): RawQuery| {
            let captured = captured.clone();
            async move {
                *captured.lock().unwrap() = Some(query.unwrap_or_default());
                Json(json!({ "value": "ok" }))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind local upstream");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (addr, last_query)
}

/// A manifest declaring a single `test-integration.today` endpoint pointing
/// at `addr`, with `ttl_secs: 60` so caching is exercised, and no declared
/// query params.
fn manifest_for(addr: SocketAddr) -> String {
    format!(
        r#"{{
          "version": 1,
          "integrations": {{
            "test-integration": {{
              "endpoints": {{
                "today": {{
                  "base": "http://{addr}",
                  "path": "/data",
                  "query": {{}},
                  "ttl_secs": 60
                }}
              }}
            }}
          }}
        }}"#
    )
}

async fn test_server_with_manifest(manifest_json: &str) -> TestServer {
    let pool = test_pool().await;
    let manifest = Arc::new(Manifest::from_json(manifest_json).expect("test manifest parses"));
    let app = dashboard_backend::integrations::router(pool, manifest);
    TestServer::new(app)
}

#[tokio::test]
async fn unknown_integration_is_not_found() {
    let (addr, _hits) = spawn_counting_upstream().await;
    let server = test_server_with_manifest(&manifest_for(addr)).await;

    let resp = server
        .post("/fetch/does-not-exist/today")
        .json(&json!({ "params": {} }))
        .await;

    resp.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn unknown_endpoint_is_not_found() {
    let (addr, _hits) = spawn_counting_upstream().await;
    let server = test_server_with_manifest(&manifest_for(addr)).await;

    let resp = server
        .post("/fetch/test-integration/does-not-exist")
        .json(&json!({ "params": {} }))
        .await;

    resp.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn a_param_the_endpoint_does_not_declare_is_bad_request() {
    let (addr, hits) = spawn_counting_upstream().await;
    let server = test_server_with_manifest(&manifest_for(addr)).await;

    let resp = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": { "not_declared": "x" } }))
        .await;

    resp.assert_status(StatusCode::BAD_REQUEST);
    // Rejected before ever reaching the upstream.
    assert_eq!(hits.load(Ordering::SeqCst), 0);
}

#[tokio::test]
async fn an_identical_second_call_is_served_from_cache() {
    let (addr, hits) = spawn_counting_upstream().await;
    let server = test_server_with_manifest(&manifest_for(addr)).await;

    let first = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;
    first.assert_status_ok();
    assert_eq!(
        hits.load(Ordering::SeqCst),
        1,
        "first call must hit the upstream"
    );

    let second = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;
    second.assert_status_ok();
    assert_eq!(
        hits.load(Ordering::SeqCst),
        1,
        "second identical call must be served from cache, not hit the upstream again"
    );
    assert_eq!(
        first.json::<serde_json::Value>(),
        second.json::<serde_json::Value>()
    );
}

// --- Fix Round 1, Important 5: `resolve_server_placeholders` exercised at
// the actual HTTP boundary, not just via the pure `build_url`/helper-level
// unit tests in `platform::fetch`. This is the whole slice's invariant in
// one place: the upstream receives the *configured* secret, and a client
// cannot substitute its own value for it. ---

#[tokio::test]
async fn a_secret_placeholder_is_filled_from_config_and_a_client_cannot_override_it() {
    let (addr, last_query) = spawn_capturing_upstream().await;
    let pool = test_pool().await;
    sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
        .bind("test-integration.api_key")
        .bind("HOUSEHOLD_KEY")
        .execute(&pool)
        .await
        .expect("seed config");

    let manifest_json = format!(
        r#"{{
          "version": 1,
          "integrations": {{
            "test-integration": {{
              "endpoints": {{
                "today": {{
                  "base": "http://{addr}",
                  "path": "/data",
                  "query": {{ "appid": "{{{{secret:api_key}}}}" }},
                  "ttl_secs": 0
                }}
              }}
            }}
          }}
        }}"#
    );
    let manifest = Arc::new(Manifest::from_json(&manifest_json).expect("test manifest parses"));
    let app = dashboard_backend::integrations::router(pool, manifest);
    let server = TestServer::new(app);

    // A client attempting to supply the secret's own key name is rejected
    // as an undeclared param -- `appid`'s placeholder is `secret:api_key`,
    // not `param:api_key`, so nothing declares `api_key` as client input.
    let attack = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": { "api_key": "evil" } }))
        .await;
    attack.assert_status(StatusCode::BAD_REQUEST);
    assert!(
        last_query.lock().unwrap().is_none(),
        "an attacker's rejected request must never reach the upstream at all"
    );

    // A legitimate request with no params still resolves the secret from
    // config and the upstream receives the household's configured value.
    let ok = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;
    ok.assert_status_ok();
    let captured = last_query
        .lock()
        .unwrap()
        .clone()
        .expect("upstream should have been hit");
    assert!(
        captured.contains("appid=HOUSEHOLD_KEY"),
        "upstream should receive the configured secret, got query: {captured}"
    );
}

#[tokio::test]
async fn a_missing_config_value_for_a_secret_placeholder_is_a_generic_internal_error() {
    // No config row seeded for `test-integration.api_key` -- this is the
    // Fix Round 1, Minor 6 case: a missing config value must not surface
    // to an unauthenticated caller as a 400 naming the config key.
    let (addr, last_query) = spawn_capturing_upstream().await;
    let pool = test_pool().await;

    let manifest_json = format!(
        r#"{{
          "version": 1,
          "integrations": {{
            "test-integration": {{
              "endpoints": {{
                "today": {{
                  "base": "http://{addr}",
                  "path": "/data",
                  "query": {{ "appid": "{{{{secret:api_key}}}}" }},
                  "ttl_secs": 0
                }}
              }}
            }}
          }}
        }}"#
    );
    let manifest = Arc::new(Manifest::from_json(&manifest_json).expect("test manifest parses"));
    let app = dashboard_backend::integrations::router(pool, manifest);
    let server = TestServer::new(app);

    let resp = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;

    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
    let body = resp.json::<serde_json::Value>();
    let message = body["error"].as_str().unwrap_or_default();
    assert!(
        !message.contains("test-integration.api_key") && !message.contains("Configure in admin"),
        "the generic 500 body must not disclose the config namespace: {message}"
    );
    assert!(
        last_query.lock().unwrap().is_none(),
        "resolution must fail before the upstream is ever contacted"
    );
}
