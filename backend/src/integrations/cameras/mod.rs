pub mod routes;
pub mod visits;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "cameras";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route(
            "/doorbell/today",
            axum::routing::get(routes::doorbell_today),
        )
        .route("/snapshot/{event_id}", axum::routing::get(routes::snapshot))
        .route("/clip/{event_id}", axum::routing::get(routes::clip))
        .with_state(pool)
}

pub struct FrigateClient {
    pub base_url: String,
    pub camera: String,
    pub label: String,
    pub min_score: f64,
    pub gap_secs: i64,
    client: reqwest::Client,
}

impl FrigateClient {
    pub async fn from_config(pool: &SqlitePool) -> Result<Self, crate::error::AppError> {
        let cfg = crate::integrations::config_helpers::IntegrationConfig::new(pool, INTEGRATION_ID);
        let base_url = cfg.get_or("frigate_url", "http://frigate:5000").await?;
        let camera = cfg.get_or("doorbell_camera", "doorbell").await?;
        let label = cfg.get_or("label", "person").await?;
        let min_score = cfg.get_or("min_score", "0.6").await?.parse().unwrap_or(0.6);
        let gap_minutes: i64 = cfg
            .get_or("visit_gap_minutes", "8")
            .await?
            .parse()
            .unwrap_or(8);
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            camera,
            label,
            min_score,
            gap_secs: gap_minutes * 60,
            client: reqwest::Client::new(),
        })
    }
}
