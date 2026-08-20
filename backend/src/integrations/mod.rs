pub mod chores;
pub mod config;
pub mod config_helpers;
pub mod google_calendar;
pub mod health;
pub mod house;
pub mod music;
pub mod sports;

pub use config_helpers::IntegrationConfig;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .nest("/chores", chores::router(pool.clone()))
        .nest("/config", config::router(pool.clone()))
        .nest("/google-calendar", google_calendar::router(pool.clone()))
        .nest("/google", google_calendar::auth::router(pool.clone()))
        .nest("/health", health::router(pool.clone()))
        .nest("/house", house::router(pool.clone()))
        .nest("/sports", sports::router(pool.clone()))
        .nest("/music", music::router(pool.clone()))
        .nest("/llm", crate::llm::router(pool.clone()))
        .nest("/fetch", crate::platform::fetch::router())
}
