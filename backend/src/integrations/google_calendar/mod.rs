pub mod auth;
pub mod models;
pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "google-calendar";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .merge(auth::router(pool.clone()))
        .merge(routes::router(pool.clone()))
}
