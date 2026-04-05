pub mod routes;
pub mod types;

use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "on_this_day";

pub fn router(pool: SqlitePool) -> Router {
    let client = reqwest::Client::builder()
        .user_agent("DashboardApp/1.0 (family kitchen dashboard)")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let state = routes::OnThisDayState {
        pool,
        client,
        cache: Arc::new(routes::OnThisDayCache::new()),
    };

    Router::new()
        .route("/events", axum::routing::get(routes::get_events))
        .with_state(state)
}
