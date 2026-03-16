pub mod config_helpers;

pub use config_helpers::IntegrationConfig;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(_pool: SqlitePool) -> Router {
    Router::new()
    // Integrations will be added here as they migrate
}
