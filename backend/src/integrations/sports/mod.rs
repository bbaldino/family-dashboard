pub mod cache;
pub mod enrichment;
pub mod espn;
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

pub fn router(pool: SqlitePool) -> Router {
    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    let state = routes::SportsState {
        pool,
        cache: cache::EspnCache::new(),
        client: reqwest::Client::new(),
        preview_cache: Arc::new(preview::PreviewCache::new()),
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
        .route("/events", axum::routing::get(routes::events))
        .with_state(state)
}
