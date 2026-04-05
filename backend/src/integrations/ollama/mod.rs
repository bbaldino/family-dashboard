pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/models", axum::routing::get(routes::get_models))
        .with_state(pool)
}
