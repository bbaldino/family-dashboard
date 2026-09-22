use axum::extract::State;
use sqlx::SqlitePool;

use super::{FrigateClient, visits};
use crate::error::AppError;

pub async fn doorbell_today(
    State(pool): State<SqlitePool>,
) -> Result<axum::Json<visits::TodayResponse>, AppError> {
    let f = FrigateClient::from_config(&pool).await?;
    let now = chrono::Local::now();
    let after = visits::local_today_start(now);
    let url = format!(
        "{}/api/events?camera={}&label={}&after={}&has_clip=1&include_thumbnails=0&limit=200",
        f.base_url, f.camera, f.label, after
    );
    let raw: serde_json::Value = f
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Frigate request failed: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Frigate parse failed: {e}")))?;
    Ok(axum::Json(visits::build_today_response(
        &raw,
        f.gap_secs,
        f.min_score,
    )))
}
