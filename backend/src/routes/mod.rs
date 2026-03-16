pub mod chores;

use axum::Router;
use sqlx::SqlitePool;

use crate::models::google::GoogleOAuthConfig;

pub fn router(pool: SqlitePool, _google_config: GoogleOAuthConfig) -> Router {
    Router::new().merge(chores::router(pool.clone()))
}
