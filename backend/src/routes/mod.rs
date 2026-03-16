use axum::Router;
use sqlx::SqlitePool;

#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

pub fn router(pool: SqlitePool, _google_config: GoogleOAuthConfig) -> Router {
    Router::new().with_state(pool)
}
