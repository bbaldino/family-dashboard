pub mod routes;

use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "word-of-the-day";

pub fn router(pool: SqlitePool) -> Router {
    let state = routes::WordState {
        pool,
        client: reqwest::Client::new(),
        cache: Arc::new(routes::WordCache::new()),
    };
    Router::new()
        .route("/today", axum::routing::get(routes::get_today))
        .with_state(state)
}
