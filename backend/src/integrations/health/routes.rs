use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

async fn base_url(pool: &SqlitePool) -> Result<String, AppError> {
    let config = IntegrationConfig::new(pool, INTEGRATION_ID);
    let raw = config.get_or("base_url", "http://health.home").await?;
    Ok(raw.trim_end_matches('/').to_string())
}

async fn proxy_get(url: &str) -> Result<serde_json::Value, AppError> {
    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("health request failed: {}", e)))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "health returned {}",
            resp.status()
        )));
    }
    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("health parse failed: {}", e)))
}

/// Proxy the homelab-health `/api/v1/status` array through to the frontend.
/// The dashboard is served over HTTPS while the health service runs HTTP on
/// the LAN, so a direct fetch would trip mixed-content. This handler also
/// strips the `config` field from each service — the upstream schema exposes
/// it and it can contain secrets (API keys, tokens).
pub async fn get_status(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let url = format!("{}/api/v1/status", base_url(&pool).await?);
    let mut body = proxy_get(&url).await?;
    strip_config(&mut body);
    Ok(Json(body))
}

#[derive(Deserialize)]
pub struct UptimeQuery {
    pub window: Option<u64>,
}

pub async fn get_uptime(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Query(params): Query<UptimeQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let window = params.window.unwrap_or(86400);
    let url = format!(
        "{}/api/v1/monitors/{}/uptime?window={}",
        base_url(&pool).await?,
        id,
        window
    );
    Ok(Json(proxy_get(&url).await?))
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<u64>,
}

pub async fn get_history(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Query(params): Query<HistoryQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(50);
    let url = format!(
        "{}/api/v1/monitors/{}/history?limit={}",
        base_url(&pool).await?,
        id,
        limit
    );
    Ok(Json(proxy_get(&url).await?))
}

fn strip_config(value: &mut serde_json::Value) {
    if let Some(arr) = value.as_array_mut() {
        for item in arr {
            if let Some(obj) = item.as_object_mut() {
                obj.remove("config");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_config_removes_config_from_each_service() {
        let mut v = serde_json::json!([
            {"id": 1, "name": "Foo", "status": "ok", "config": {"api_key": "SECRET"}},
            {"id": 2, "name": "Bar", "status": "critical", "config": {"token": "SECRET"}}
        ]);
        strip_config(&mut v);
        let arr = v.as_array().unwrap();
        assert!(!arr[0].as_object().unwrap().contains_key("config"));
        assert!(!arr[1].as_object().unwrap().contains_key("config"));
        assert_eq!(arr[0]["name"], "Foo");
        assert_eq!(arr[1]["status"], "critical");
    }
}
