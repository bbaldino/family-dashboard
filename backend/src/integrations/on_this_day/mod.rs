pub mod routes;
pub mod types;

use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "on_this_day";

pub fn router(pool: SqlitePool) -> Router {
    let state = routes::OnThisDayState {
        pool,
        client: reqwest::Client::new(),
        cache: Arc::new(routes::OnThisDayCache::new()),
    };

    Router::new()
        .route("/events", axum::routing::get(routes::get_events))
        .with_state(state)
}
