pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "weather";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/current", axum::routing::get(routes::get_current))
        .route("/forecast", axum::routing::get(routes::get_forecast))
        .with_state(pool)
}
