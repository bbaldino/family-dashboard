pub mod chores;
pub mod config;
pub mod config_helpers;
pub mod daily_quote;
pub mod driving_time;
pub mod google_calendar;
pub mod health;
pub mod jokes;
pub mod music;
pub mod nutrislice;
pub mod on_this_day;
pub mod packages;
pub mod sports;
pub mod trivia;
pub mod weather;
pub mod word_of_the_day;

pub use config_helpers::IntegrationConfig;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(
    pool: SqlitePool,
    manifest: std::sync::Arc<crate::platform::manifest::Manifest>,
) -> Router {
    Router::new()
        .nest("/chores", chores::router(pool.clone()))
        .nest("/config", config::router(pool.clone()))
        .nest("/nutrislice", nutrislice::router(pool.clone()))
        .nest("/weather", weather::router(pool.clone()))
        .nest("/google-calendar", google_calendar::router(pool.clone()))
        .nest("/google", google_calendar::auth::router(pool.clone()))
        .nest("/health", health::router(pool.clone()))
        .nest("/packages", packages::router(pool.clone()))
        .nest("/sports", sports::router(pool.clone()))
        .nest("/driving-time", driving_time::router(pool.clone()))
        .nest("/music", music::router(pool.clone()))
        .nest("/llm", crate::llm::router(pool.clone()))
        .nest("/on-this-day", on_this_day::router(pool.clone()))
        .nest("/daily-quote", daily_quote::router())
        .nest("/jokes", jokes::router())
        .nest("/trivia", trivia::router())
        .nest("/word-of-the-day", word_of_the_day::router())
        .nest("/fetch", crate::platform::fetch::router(manifest))
}
