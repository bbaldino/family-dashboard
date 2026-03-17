pub mod espn;
pub mod transform;
pub mod types;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "sports";

pub fn router(_pool: SqlitePool) -> Router {
    Router::new()
}
