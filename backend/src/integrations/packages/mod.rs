pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "packages";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/shipments", axum::routing::get(routes::get_shipments))
        .route(
            "/shipments/{id}/events",
            axum::routing::get(routes::get_shipment_events),
        )
        .with_state(pool)
}
