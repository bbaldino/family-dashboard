use axum::Json;
use axum::extract::{Path, State};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

const DEFAULT_SERVICE_URL: &str = "http://localhost:4000/api/ext/packages";

async fn service_url(pool: &SqlitePool) -> Result<String, AppError> {
    let config = IntegrationConfig::new(pool, INTEGRATION_ID);
    let url = config.get_or("service_url", DEFAULT_SERVICE_URL).await?;
    Ok(url.trim_end_matches('/').to_string())
}

async fn proxy_get(pool: &SqlitePool, path: &str) -> Result<Json<serde_json::Value>, AppError> {
    let base = service_url(pool).await?;
    let url = format!("{}{}", base, path);

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| AppError::Internal(format!("Packages service unavailable: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Packages service error ({}): {}",
            status, body
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Packages parse error: {}", e)))?;

    Ok(Json(data))
}

pub async fn get_shipments(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    proxy_get(&pool, "/shipments").await
}

pub async fn get_shipment_events(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    proxy_get(&pool, &format!("/shipments/{}/events", id)).await
}
