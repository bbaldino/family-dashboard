pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "nutrislice";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/menu", axum::routing::get(routes::get_menu))
        .with_state(pool)
}
