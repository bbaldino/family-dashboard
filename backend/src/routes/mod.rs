pub mod chores;
pub mod lunch_menu;

use axum::Router;
use sqlx::SqlitePool;

use crate::models::google::GoogleOAuthConfig;

pub fn router(pool: SqlitePool, _google_config: GoogleOAuthConfig) -> Router {
    Router::new()
        .merge(chores::router(pool.clone()))
        .merge(lunch_menu::router(pool.clone()))
}
