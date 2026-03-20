use axum::Json;
use axum::extract::{Query, State};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;
use super::cache::DrivingTimeCache;

#[derive(Clone)]
pub struct DrivingTimeState {
    pub pool: SqlitePool,
    pub cache: DrivingTimeCache,
    pub client: reqwest::Client,
}

#[derive(Deserialize)]
pub struct DrivingTimeQuery {
    destination: String,
    event_start: Option<String>,
}

fn compute_cache_ttl(event_start: Option<&str>) -> u64 {
    let Some(start_str) = event_start else {
        return 1800; // 30 min default
    };
    let Ok(start) = chrono::DateTime::parse_from_rfc3339(start_str) else {
        return 1800;
    };
    let now = chrono::Utc::now();
    let minutes_until = (start.with_timezone(&chrono::Utc) - now).num_minutes();

    if minutes_until > 120 {
        1800 // 30 min
    } else if minutes_until > 60 {
        900 // 15 min
    } else if minutes_until > 30 {
        600 // 10 min
    } else {
        300 // 5 min
    }
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

    let ttl = compute_cache_ttl(query.event_start.as_deref());

    // Check cache
    if let Some((duration_secs, duration_text)) = state.cache.get(&query.destination, ttl).await {
        return Ok(Json(serde_json::json!({
            "durationSeconds": duration_secs,
            "durationText": duration_text,
            "bufferMinutes": buffer_minutes,
        })));
    }

    // Call Google Routes API
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

            state
                .cache
                .set(
                    &query.destination,
                    Some(duration_secs),
                    Some(duration_text.clone()),
                )
                .await;

            Ok(Json(serde_json::json!({
                "durationSeconds": duration_secs,
                "durationText": duration_text,
                "bufferMinutes": buffer_minutes,
            })))
        }
        _ => {
            // Cache the failure for 1 hour to avoid re-hitting for bad addresses
            state.cache.set(&query.destination, None, None).await;

            Ok(Json(serde_json::json!({
                "durationSeconds": null,
                "durationText": null,
                "bufferMinutes": buffer_minutes,
            })))
        }
    }
}
