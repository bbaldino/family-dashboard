pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "health";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/status", axum::routing::get(routes::get_status))
        .route("/uptime/{id}", axum::routing::get(routes::get_uptime))
        .route("/history/{id}", axum::routing::get(routes::get_history))
        .with_state(pool)
}
