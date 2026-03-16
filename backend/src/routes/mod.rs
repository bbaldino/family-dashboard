pub mod config;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new().merge(config::router(pool.clone()))
}
