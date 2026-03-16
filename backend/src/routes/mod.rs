pub mod chores;
pub mod google_auth;
pub mod google_calendar;
pub mod lunch_menu;

use axum::Router;
use sqlx::SqlitePool;

use crate::models::google::GoogleOAuthConfig;

pub fn router(pool: SqlitePool, google_config: GoogleOAuthConfig) -> Router {
    Router::new()
        .merge(chores::router(pool.clone()))
        .merge(lunch_menu::router(pool.clone()))
        .merge(google_auth::router(pool.clone(), google_config.clone()))
        .merge(google_calendar::router(pool.clone(), google_config.clone()))
}
