pub mod models;
pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "chores";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route(
            "/",
            axum::routing::get(routes::list_chores).post(routes::create_chore),
        )
        .route(
            "/{id}",
            axum::routing::put(routes::update_chore).delete(routes::delete_chore),
        )
        .route(
            "/{id}/assignments",
            axum::routing::put(routes::set_assignments),
        )
        .route("/assignments", axum::routing::get(routes::get_assignments))
        .route(
            "/assignments/{id}/complete",
            axum::routing::post(routes::complete_assignment),
        )
        .with_state(pool)
}
