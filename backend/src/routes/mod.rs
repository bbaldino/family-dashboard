pub mod chores;
pub mod config;
pub mod google_auth;
pub mod google_calendar;
pub mod ha_proxy;
pub mod nutrislice;
pub mod weather;

use axum::Router;
use sqlx::SqlitePool;

use crate::models::google::GoogleOAuthConfig;

pub fn router(pool: SqlitePool, google_config: GoogleOAuthConfig) -> Router {
    Router::new()
        .merge(chores::router(pool.clone()))
        .merge(nutrislice::router())
        .merge(config::router(pool.clone()))
        .merge(ha_proxy::router())
        .merge(weather::router())
        .merge(google_auth::router(pool.clone(), google_config.clone()))
        .merge(google_calendar::router(pool.clone(), google_config.clone()))
}
