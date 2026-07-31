pub mod air_quality;
pub mod routes;

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use sqlx::SqlitePool;

use routes::WeatherState;

pub const INTEGRATION_ID: &str = "weather";

pub fn router(pool: SqlitePool) -> Router {
    // A bounded timeout on every outbound weather call (OpenWeather and
    // Open-Meteo alike) — this integration exists to be glanced at on a wall
    // display, and an unbounded reqwest client can hang a request as long as
    // the remote host lets it.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let state = WeatherState {
        pool,
        client,
        air_cache: Arc::new(air_quality::AirQualityCache::new()),
    };

    Router::new()
        .route("/current", axum::routing::get(routes::get_current))
        .route("/forecast", axum::routing::get(routes::get_forecast))
        .route("/air", axum::routing::get(routes::get_air))
        .with_state(state)
}
