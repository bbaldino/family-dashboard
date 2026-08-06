pub mod cache;
pub mod enrichment;
pub mod espn;
pub mod final_recap;
pub mod preview;
pub mod recap;
pub mod replay;
pub mod routes;
pub mod transform;
pub mod types;

use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "sports";

/// ESPN's edge (Akamai) rejects requests whose `User-Agent` it does not
/// recognise as a known HTTP client, and reqwest sends no `User-Agent` at
/// all by default — so every `site.api.espn.com` call was getting a 403.
///
/// Measured against `/baseball/mlb/scoreboard` on 2026-08-06:
///
/// | User-Agent | |
/// |---|---|
/// | *(none — reqwest's default)* | 403 |
/// | `reqwest/0.13` | 403 |
/// | `DashboardApp/1.0 (family kitchen dashboard)` | 403 |
/// | a current Chrome UA | 403 |
/// | `curl/8.5.0`, `python-requests/2.31.0`, `aiohttp/3.9.1` | 200 |
/// | `curl/8.5.0 DashboardApp/1.0` | 200 |
///
/// Leading with a recognised token is what gets through; the trailing
/// product is kept so ESPN's logs still say who this actually is, rather
/// than impersonating curl outright. It is not checked against the TLS
/// fingerprint — an allow-listed UA succeeds from curl's, Python's and
/// reqwest's stacks alike — so this is sufficient on its own.
///
/// This is upstream policy we do not control, and it changed under us: the
/// integration worked for months, then began failing silently. Expect to
/// revisit it if ESPN tightens further.
const ESPN_USER_AGENT: &str = "curl/8.5.0 DashboardApp/1.0";

pub fn router(pool: SqlitePool) -> Router {
    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    let state = routes::SportsState {
        pool,
        cache: cache::EspnCache::new(),
        client: reqwest::Client::builder()
            .user_agent(ESPN_USER_AGENT)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new()),
        preview_cache: Arc::new(preview::PreviewCache::new()),
        final_recap_cache: Arc::new(final_recap::FinalRecapCache::new()),
        enrichment_cache: Arc::new(enrichment::EnrichmentCache::new()),
        recap_cache: Arc::new(recap::RecapCache::new()),
        replayer: replay::Replayer::from_env().map(Arc::new),
        start_timer: Arc::new(tokio::sync::Mutex::new(None)),
        events_tx,
    };

    Router::new()
        .route("/games", axum::routing::get(routes::get_games))
        .route("/teams", axum::routing::get(routes::get_teams))
        .route("/teams/search", axum::routing::get(routes::search_teams))
        .route("/preview", axum::routing::get(routes::get_preview))
        .route("/final-recap", axum::routing::get(routes::get_final_recap))
        .route("/events", axum::routing::get(routes::events))
        .with_state(state)
}
