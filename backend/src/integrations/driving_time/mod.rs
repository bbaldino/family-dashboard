pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "driving-time";

pub fn router(pool: SqlitePool) -> Router {
    let state = routes::DrivingTimeState {
        pool,
        client: reqwest::Client::new(),
    };

    Router::new()
        .route("/", axum::routing::get(routes::get_driving_time))
        .with_state(state)
}
