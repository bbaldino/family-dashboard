use axum::Json;
use axum::extract::{Query, State};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

#[derive(Clone)]
pub struct DrivingTimeState {
    pub pool: SqlitePool,
    pub client: reqwest::Client,
}

#[derive(Deserialize)]
pub struct DrivingTimeQuery {
    destination: String,
}

pub async fn get_driving_time(
    State(state): State<DrivingTimeState>,
    Query(query): Query<DrivingTimeQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let gc_config = IntegrationConfig::new(&state.pool, "google-cloud");
    let api_key = gc_config.get("api_key").await?;

    let dt_config = IntegrationConfig::new(&state.pool, INTEGRATION_ID);
    let home_address = dt_config.get("home_address").await?;
    let buffer_minutes: i64 = dt_config
        .get_or("buffer_minutes", "5")
        .await?
        .parse()
        .unwrap_or(5);

    let body = serde_json::json!({
        "origin": { "address": home_address },
        "destination": { "address": query.destination },
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE"
    });

    let resp = state
        .client
        .post("https://routes.googleapis.com/directions/v2:computeRoutes")
        .header("X-Goog-Api-Key", &api_key)
        .header("X-Goog-FieldMask", "routes.duration")
        .json(&body)
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let data: serde_json::Value = r
                .json()
                .await
                .map_err(|e| AppError::Internal(format!("Routes API parse error: {}", e)))?;

            let duration_str = data["routes"][0]["duration"].as_str().unwrap_or("0s");

            // Parse "1080s" → 1080
            let duration_secs: i64 = duration_str.trim_end_matches('s').parse().unwrap_or(0);

            let duration_text = if duration_secs >= 3600 {
                let hours = duration_secs / 3600;
                let mins = (duration_secs % 3600) / 60;
                if mins > 0 {
                    format!("{} hr {} min", hours, mins)
                } else {
                    format!("{} hr", hours)
                }
            } else {
                format!("{} min", (duration_secs + 59) / 60)
            };

            Ok(Json(serde_json::json!({
                "durationSeconds": duration_secs,
                "durationText": duration_text,
                "bufferMinutes": buffer_minutes,
            })))
        }
        _ => Ok(Json(serde_json::json!({
            "durationSeconds": null,
            "durationText": null,
            "bufferMinutes": buffer_minutes,
        }))),
    }
}
