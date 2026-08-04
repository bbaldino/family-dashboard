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
//! param, a cache hit, a config change invalidating the cache, and the
//! reject-before-resolve ordering `invoke` depends on. TTL expiry, eviction,
//! and exhaustive error-mapping coverage are out of scope for this pass.

// This file only needs `test_pool` from the shared helpers module — the
// other exports (`test_app`, backed by an empty manifest) are unused here by
// design, since every test below needs its own manifest instead. Silence the
// resulting dead_code warning rather than pulling in an unused import.
#[allow(dead_code)]
mod helpers;

use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

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

/// Spawns a local upstream that answers `500` with a body echoing the query
/// string it received — verbatim (so the body carries the *url-encoded*
/// secret) and percent-decoded (so it carries the raw one). Real upstreams
/// echo a rejected credential back like this all the time, and `invoke`
/// splices that body straight into an `AppError::Internal` message that
/// `IntoResponse` then logs.
async fn spawn_echoing_500_upstream() -> (SocketAddr, Arc<Mutex<Option<String>>>) {
    let last_query: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let captured = last_query.clone();
    let app = Router::new().route(
        "/data",
        get(move |RawQuery(query): RawQuery| {
            let captured = captured.clone();
            async move {
                let query = query.unwrap_or_default();
                *captured.lock().unwrap() = Some(query.clone());
                let decoded = urlencoding::decode(&query)
                    .map(|c| c.into_owned())
                    .unwrap_or_else(|_| query.clone());
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("upstream rejected request: raw={decoded} encoded={query}"),
                )
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

/// Combines `spawn_counting_upstream` and `spawn_capturing_upstream`: counts
/// hits *and* records the most recent query string. Needed for the
/// cache-invalidation test below, which has to prove both that a second
/// request reached the upstream at all (the count) and that it carried the
/// *new* config value (the query), not just that a second call was made.
async fn spawn_counting_capturing_upstream()
-> (SocketAddr, Arc<AtomicUsize>, Arc<Mutex<Option<String>>>) {
    let hits = Arc::new(AtomicUsize::new(0));
    let hits_for_route = hits.clone();
    let last_query: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let captured = last_query.clone();
    let app = Router::new().route(
        "/data",
        get(move |RawQuery(query): RawQuery| {
            let hits = hits_for_route.clone();
            let captured = captured.clone();
            async move {
                hits.fetch_add(1, Ordering::SeqCst);
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
    (addr, hits, last_query)
}

/// A `tracing` writer that appends every formatted event into a shared
/// buffer, so a test can assert on what this process *logged* rather than
/// only on what it returned. Needed because `AppError::Internal` renders a
/// generic body to the caller and puts the real message in a
/// `tracing::error!` — which is exactly where a leaked secret would land,
/// and the only place it can be observed.
#[derive(Clone, Default)]
struct CapturedLogs(Arc<Mutex<Vec<u8>>>);

impl CapturedLogs {
    /// Every line logged by this test process so far that mentions
    /// `marker`. Tests share one global subscriber (only one may be
    /// installed per process) and run in parallel, so each redaction test
    /// names its own integration in the manifest and filters on that —
    /// otherwise an assertion could pass or fail on another test's output.
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

// --- Task 2: a config change must invalidate the cache ---

#[tokio::test]
async fn a_changed_config_value_produces_a_fresh_upstream_call_not_a_stale_hit() {
    // The scenario `cache_key`'s doc comment exists for: a corrected
    // `weather.lat`-style config value must be visible on the very next
    // request, not after `ttl_secs` (600 for weather) elapses. Proven at the
    // HTTP boundary, not just via the `cache_key` unit test, so it also
    // exercises `invoke`'s reordering (resolve before cache lookup).
    let (addr, hits, last_query) = spawn_counting_capturing_upstream().await;
    let pool = test_pool().await;
    sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
        .bind("test-integration.lat")
        .bind("37.2504")
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
                  "query": {{ "lat": "{{{{cfg:lat}}}}" }},
                  "ttl_secs": 600
                }}
              }}
            }}
          }}
        }}"#
    );
    let manifest = Arc::new(Manifest::from_json(&manifest_json).expect("test manifest parses"));
    let app = dashboard_backend::integrations::router(pool.clone(), manifest);
    let server = TestServer::new(app);

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
    assert!(
        last_query
            .lock()
            .unwrap()
            .clone()
            .unwrap_or_default()
            .contains("lat=37.2504"),
        "first call should carry the original configured latitude"
    );

    // An admin corrects the latitude, exactly as the config UI would.
    sqlx::query("UPDATE config SET value = ? WHERE key = ?")
        .bind("51.5072")
        .bind("test-integration.lat")
        .execute(&pool)
        .await
        .expect("update config");

    let second = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;
    second.assert_status_ok();
    assert_eq!(
        hits.load(Ordering::SeqCst),
        2,
        "a changed config value must miss the cache, not serve the stale entry for the \
         remaining 600s TTL"
    );
    assert!(
        last_query
            .lock()
            .unwrap()
            .clone()
            .unwrap_or_default()
            .contains("lat=51.5072"),
        "second call should carry the corrected latitude, not the stale one"
    );
}

#[tokio::test]
async fn an_undeclared_param_is_rejected_before_config_is_resolved() {
    // No config row is seeded for `test-integration.api_key`. If
    // `resolve_server_placeholders` ran before `reject_undeclared_params`,
    // this request would fail with a generic 500 (missing config, per
    // `a_missing_config_value_for_a_secret_placeholder_is_a_generic_internal_error`
    // above) instead of the 400 an undeclared param produces. Asserting 400
    // here pins `invoke`'s ordering — reject-then-resolve — rather than
    // leaving it true only because of source order nothing enforces.
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
        .json(&json!({ "params": { "not_declared": "x" } }))
        .await;

    resp.assert_status(StatusCode::BAD_REQUEST);
    assert!(
        last_query.lock().unwrap().is_none(),
        "rejected before the upstream is ever contacted"
    );
}

#[tokio::test]
async fn a_config_value_removed_after_caching_fails_the_next_request_instead_of_serving_stale() {
    // Fix Round 1: the flip side of the cache-invalidation test above.
    // Resolution now runs before the cache lookup on *every* request, not
    // just the first, so once a config row an endpoint depends on is
    // deleted, the next request must 500 rather than keep serving the
    // still-valid cached entry for the remainder of its 600s TTL. Asserting
    // the hit count stays at 1 is what makes this diagnostic rather than
    // merely red: it proves the failure happened at resolution, before the
    // upstream was ever asked again, not somewhere downstream.
    let (addr, hits, _last_query) = spawn_counting_capturing_upstream().await;
    let pool = test_pool().await;
    sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
        .bind("test-integration.lat")
        .bind("37.2504")
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
                  "query": {{ "lat": "{{{{cfg:lat}}}}" }},
                  "ttl_secs": 600
                }}
              }}
            }}
          }}
        }}"#
    );
    let manifest = Arc::new(Manifest::from_json(&manifest_json).expect("test manifest parses"));
    let app = dashboard_backend::integrations::router(pool.clone(), manifest);
    let server = TestServer::new(app);

    let first = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;
    first.assert_status_ok();
    assert_eq!(
        hits.load(Ordering::SeqCst),
        1,
        "first call must hit the upstream and populate the cache"
    );

    // An admin clears the config row entirely -- e.g. removing an
    // integration's setup without removing the manifest entry.
    sqlx::query("DELETE FROM config WHERE key = ?")
        .bind("test-integration.lat")
        .execute(&pool)
        .await
        .expect("delete config");

    let second = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;
    second.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(
        hits.load(Ordering::SeqCst),
        1,
        "a missing config value must fail at resolution, before the upstream is contacted \
         again -- if it were serving the stale cache entry instead, the status would be 200 \
         and the hit count would still be 1 for the wrong reason"
    );
}

// --- Final review, Important 1: the three `redact_secrets` call sites in
// `invoke` (`platform::fetch`) were covered by nothing. Both redaction unit
// tests call `redact_secrets` directly, so deleting any call site left the
// suite fully green while the branch's headline property — a secret never
// reaches a log — was broken. These two tests drive `invoke` end-to-end and
// assert on captured `tracing` output, so removing a call site turns them
// red.
//
// The third call site (the `resp.json()` parse failure) is deliberately not
// covered here: reqwest's decode error carries neither the request URL nor
// the response body, so its message cannot contain a secret in the first
// place and no assertion could tell the call site's presence from its
// absence. It stays as defence in depth against a future reqwest that does
// include one.

/// Deliberately not alphanumeric: `build_url` form-urlencodes a value into
/// the query string, so a secret of only `[A-Za-z0-9*._-]` has an identical
/// raw and encoded form and a test using one cannot tell a working
/// redaction from one that handles just the raw form (the Fix Round 1
/// Critical). `/`, `+`, `=` and `?` all change under encoding.
const ENCODING_SENSITIVE_SECRET: &str = "s3cr3t/v1+aG8=?x";

/// The leading run of the secret above, which *no* url-encoding alters — so
/// asserting a log does not contain this catches a leak of either form
/// without the test having to reimplement (and therefore agree with) the
/// encoder under test.
const SECRET_PREFIX: &str = "s3cr3t";

fn manifest_with_secret(integration: &str, base: &str) -> String {
    format!(
        r#"{{
          "version": 1,
          "integrations": {{
            "{integration}": {{
              "endpoints": {{
                "today": {{
                  "base": "{base}",
                  "path": "/data",
                  "query": {{ "appid": "{{{{secret:api_key}}}}" }},
                  "ttl_secs": 0
                }}
              }}
            }}
          }}
        }}"#
    )
}

#[tokio::test]
async fn a_secret_is_redacted_from_the_log_when_the_upstream_returns_an_error_body() {
    let logs = captured_logs();
    let integration = "redaction-non-2xx";
    let (addr, last_query) = spawn_echoing_500_upstream().await;
    let pool = test_pool().await;
    sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
        .bind(format!("{integration}.api_key"))
        .bind(ENCODING_SENSITIVE_SECRET)
        .execute(&pool)
        .await
        .expect("seed config");

    let manifest_json = manifest_with_secret(integration, &format!("http://{addr}"));
    let manifest = Arc::new(Manifest::from_json(&manifest_json).expect("test manifest parses"));
    let server = TestServer::new(dashboard_backend::integrations::router(pool, manifest));

    let resp = server
        .post(&format!("/fetch/{integration}/today"))
        .json(&json!({ "params": {} }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);

    // Premise check: the upstream really did receive (and therefore echo
    // back) the secret, so there was something to redact.
    let captured = last_query
        .lock()
        .unwrap()
        .clone()
        .expect("upstream should have been hit");
    assert!(
        captured.contains("appid="),
        "test premise broken: upstream never saw the secret, got query: {captured}"
    );

    let logged = logs.lines_mentioning(&format!("{integration}.today upstream returned"));
    assert!(
        !logged.is_empty(),
        "expected the non-2xx path to log something for {integration}"
    );
    assert!(
        !logged.contains(SECRET_PREFIX),
        "the secret reached the log in some form: {logged}"
    );
    assert!(
        logged.contains("[redacted]"),
        "the upstream body echoed the secret, so the log should show it redacted: {logged}"
    );
}

#[tokio::test]
async fn a_secret_is_redacted_from_the_log_when_the_upstream_is_unreachable() {
    let logs = captured_logs();
    let integration = "redaction-unreachable";

    // Bind then drop, so the port is real, unused, and refuses connections
    // immediately. reqwest's send error embeds the full request URL — query
    // string and all — which is exactly how a secret gets into a log.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("local addr");
    drop(listener);

    let pool = test_pool().await;
    sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
        .bind(format!("{integration}.api_key"))
        .bind(ENCODING_SENSITIVE_SECRET)
        .execute(&pool)
        .await
        .expect("seed config");

    let manifest_json = manifest_with_secret(integration, &format!("http://{addr}"));
    let manifest = Arc::new(Manifest::from_json(&manifest_json).expect("test manifest parses"));
    let server = TestServer::new(dashboard_backend::integrations::router(pool, manifest));

    let resp = server
        .post(&format!("/fetch/{integration}/today"))
        .json(&json!({ "params": {} }))
        .await;
    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);

    let logged = logs.lines_mentioning(&format!("{integration}.today request failed"));
    assert!(
        !logged.is_empty(),
        "expected the request-failure path to log something for {integration}"
    );
    assert!(
        !logged.contains(SECRET_PREFIX),
        "the secret reached the log in some form: {logged}"
    );
    assert!(
        logged.contains("[redacted]"),
        "reqwest's error embeds the request URL, so the log should show the secret \
         redacted out of it: {logged}"
    );
}

// --- Final review, Important 2: `{{cfg:key|default}}`. The deleted weather
// routes used `config.get_or("lat", "37.2504")`, so an install that had set
// only `weather.api_key` still worked; `{{cfg:lat}}` alone turned that into
// a 500 on every weather endpoint and a blank widget. The default lives in
// the manifest — one checked-in place, rather than the six call sites the
// Rust had. ---

/// A manifest whose single `lat` query slot is filled from `cfg:lat`, with
/// `default` appended after a `|` when one is given.
fn manifest_with_cfg_default(addr: SocketAddr, default: Option<&str>) -> String {
    let placeholder = match default {
        Some(default) => format!("{{{{cfg:lat|{default}}}}}"),
        None => "{{cfg:lat}}".to_string(),
    };
    format!(
        r#"{{
          "version": 1,
          "integrations": {{
            "test-integration": {{
              "endpoints": {{
                "today": {{
                  "base": "http://{addr}",
                  "path": "/data",
                  "query": {{ "lat": "{placeholder}" }},
                  "ttl_secs": 0
                }}
              }}
            }}
          }}
        }}"#
    )
}

#[tokio::test]
async fn an_absent_cfg_key_falls_back_to_the_manifest_default() {
    // No config row seeded at all — the fresh-install case, and the case of
    // a user clearing the field in the settings UI.
    let (addr, last_query) = spawn_capturing_upstream().await;
    let server = test_server_with_manifest(&manifest_with_cfg_default(addr, Some("37.2504"))).await;

    let resp = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;

    resp.assert_status_ok();
    let captured = last_query
        .lock()
        .unwrap()
        .clone()
        .expect("upstream should have been hit");
    assert!(
        captured.contains("lat=37.2504"),
        "an absent config key should fall back to the manifest default, got: {captured}"
    );
}

#[tokio::test]
async fn a_configured_value_wins_over_the_manifest_default() {
    let (addr, last_query) = spawn_capturing_upstream().await;
    let pool = test_pool().await;
    sqlx::query("INSERT INTO config (key, value) VALUES (?, ?)")
        .bind("test-integration.lat")
        .bind("51.5072")
        .execute(&pool)
        .await
        .expect("seed config");

    let manifest_json = manifest_with_cfg_default(addr, Some("37.2504"));
    let manifest = Arc::new(Manifest::from_json(&manifest_json).expect("test manifest parses"));
    let server = TestServer::new(dashboard_backend::integrations::router(pool, manifest));

    let resp = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;

    resp.assert_status_ok();
    let captured = last_query
        .lock()
        .unwrap()
        .clone()
        .expect("upstream should have been hit");
    assert!(
        captured.contains("lat=51.5072"),
        "a configured value must win over the default, not be shadowed by it: {captured}"
    );
}

#[tokio::test]
async fn an_absent_cfg_key_with_no_declared_default_is_still_an_error() {
    // The default is opt-in per placeholder: without a `|`, an absent key
    // stays a loud configuration error rather than silently becoming an
    // empty query value.
    let (addr, last_query) = spawn_capturing_upstream().await;
    let server = test_server_with_manifest(&manifest_with_cfg_default(addr, None)).await;

    let resp = server
        .post("/fetch/test-integration/today")
        .json(&json!({ "params": {} }))
        .await;

    resp.assert_status(StatusCode::INTERNAL_SERVER_ERROR);
    assert!(
        last_query.lock().unwrap().is_none(),
        "resolution must fail before the upstream is ever contacted"
    );
}

#[tokio::test]
async fn a_url_structural_default_cannot_escape_the_allowlist() {
    // A default is a manifest literal, but it must still be *only a value*.
    // It reaches the URL through the same `query_pairs_mut().append_pair`
    // call as a value read from the config table, so it is url-encoded into
    // the declared `lat` slot and can add neither a host, a scheme, nor an
    // extra query parameter — the same guarantee `{{param:…}}` values get.
    for hostile in [
        "//evil.example.com",
        "?x=1",
        "https://evil.example.com/steal",
    ] {
        let (addr, last_query) = spawn_capturing_upstream().await;
        let server =
            test_server_with_manifest(&manifest_with_cfg_default(addr, Some(hostile))).await;

        let resp = server
            .post("/fetch/test-integration/today")
            .json(&json!({ "params": {} }))
            .await;

        resp.assert_status_ok();
        let captured = last_query
            .lock()
            .unwrap()
            .clone()
            .expect("the request must still have gone to the allowlisted upstream");
        // The allowlisted upstream is the one that answered — a retargeted
        // request could not have reached it at all — and the hostile default
        // arrived as a single encoded value in the declared slot.
        assert!(
            captured.starts_with("lat=") && !captured.contains('&'),
            "a hostile default must stay one encoded query value, got: {captured}"
        );
        assert!(
            !captured.contains("//evil") && !captured.contains("?x=1"),
            "a hostile default must not survive unencoded, got: {captured}"
        );
    }
}
