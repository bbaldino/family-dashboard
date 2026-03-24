pub mod proxy;
pub mod routes;
pub mod sse;
pub mod types;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "music";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/play", axum::routing::post(routes::play))
        .route("/pause", axum::routing::post(routes::pause))
        .route("/resume", axum::routing::post(routes::resume))
        .route("/stop", axum::routing::post(routes::stop))
        .route("/next", axum::routing::post(routes::next))
        .route("/previous", axum::routing::post(routes::previous))
        .route("/volume", axum::routing::post(routes::set_volume))
        .route("/players", axum::routing::get(routes::get_players))
        .route("/search", axum::routing::get(routes::search))
        .route("/recent", axum::routing::get(routes::get_recent))
        .route("/queue/{queue_id}", axum::routing::get(routes::get_queue))
        .route("/events", axum::routing::get(sse::events))
        .with_state(pool)
}
