pub mod chores;
pub mod config;
pub mod config_helpers;
pub mod google_calendar;
pub mod nutrislice;
pub mod weather;

pub use config_helpers::IntegrationConfig;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .nest("/chores", chores::router(pool.clone()))
        .nest("/config", config::router(pool.clone()))
        .nest("/nutrislice", nutrislice::router(pool.clone()))
        .nest("/weather", weather::router(pool.clone()))
        .nest("/google-calendar", google_calendar::router(pool.clone()))
}
