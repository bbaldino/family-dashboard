pub mod config_helpers;
pub mod nutrislice;
pub mod weather;

pub use config_helpers::IntegrationConfig;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .nest("/nutrislice", nutrislice::router(pool.clone()))
        .nest("/weather", weather::router(pool.clone()))
}
