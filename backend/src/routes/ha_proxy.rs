use axum::{extract::Query, routing::get, Json, Router};
use std::collections::HashMap;

use crate::error::AppError;

pub fn router() -> Router {
    Router::new().route("/ha/weather-forecast", get(get_weather_forecast))
}

async fn get_weather_forecast(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let entity_id = params
        .get("entity_id")
        .map(|s| s.as_str())
        .unwrap_or("weather.home");

    let ha_url =
        std::env::var("HA_URL").unwrap_or_else(|_| "http://192.168.1.42:8123".to_string());
    let ha_token = std::env::var("HA_TOKEN").map_err(|_| {
        AppError::Internal("HA_TOKEN not configured in backend .env".to_string())
    })?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}/api/services/weather/get_forecasts?return_response",
            ha_url
        ))
        .header("Authorization", format!("Bearer {}", ha_token))
        .json(&serde_json::json!({
            "entity_id": entity_id,
            "type": "daily"
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("HA request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("HA returned error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("HA parse failed: {}", e)))?;

    // Extract the forecast array from the nested response
    let forecast = data
        .get("service_response")
        .and_then(|sr| sr.get(entity_id))
        .and_then(|w| w.get("forecast"))
        .cloned()
        .unwrap_or(serde_json::json!([]));

    Ok(Json(forecast))
}
