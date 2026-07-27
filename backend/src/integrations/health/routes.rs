use axum::Json;
use axum::extract::State;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

/// Proxy the homelab-health `/api/v1/status` array through to the frontend.
/// The dashboard is served over HTTPS while the health service runs HTTP on
/// the LAN, so a direct fetch would trip mixed-content. This handler also
/// strips the `config` field from each service — the upstream schema exposes
/// it and it can contain secrets (API keys, tokens).
pub async fn get_status(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let config = IntegrationConfig::new(&pool, INTEGRATION_ID);
    let base_url = config.get_or("base_url", "http://health.home").await?;

    let url = format!("{}/api/v1/status", base_url.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("health request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "health returned {}",
            resp.status()
        )));
    }

    let mut body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("health parse failed: {}", e)))?;

    strip_config(&mut body);
    Ok(Json(body))
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
