use axum::{routing::get, Json, Router};

use crate::error::AppError;

pub fn router() -> Router {
    Router::new()
        .route("/weather/current", get(get_current))
        .route("/weather/forecast", get(get_forecast))
}

fn get_config() -> Result<(String, String, String), AppError> {
    let api_key = std::env::var("OPENWEATHER_API_KEY")
        .map_err(|_| AppError::Internal("OPENWEATHER_API_KEY not configured".to_string()))?;
    let lat = std::env::var("WEATHER_LAT").unwrap_or_else(|_| "37.2504".to_string());
    let lon = std::env::var("WEATHER_LON").unwrap_or_else(|_| "-121.9000".to_string());
    Ok((api_key, lat, lon))
}

async fn get_current() -> Result<Json<serde_json::Value>, AppError> {
    let (api_key, lat, lon) = get_config()?;

    let url = format!(
        "https://api.openweathermap.org/data/2.5/weather?lat={}&lon={}&appid={}&units=imperial",
        lat, lon, api_key
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Weather request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Weather API error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Weather parse failed: {}", e)))?;

    // Reshape into a cleaner format
    let main = &data["main"];
    let weather = &data["weather"][0];
    let wind = &data["wind"];

    Ok(Json(serde_json::json!({
        "temp": main["temp"],
        "feels_like": main["feels_like"],
        "temp_min": main["temp_min"],
        "temp_max": main["temp_max"],
        "humidity": main["humidity"],
        "condition": weather["main"],
        "description": weather["description"],
        "icon": weather["icon"],
        "wind_speed": wind["speed"],
        "wind_deg": wind["deg"],
    })))
}

async fn get_forecast() -> Result<Json<serde_json::Value>, AppError> {
    let (api_key, lat, lon) = get_config()?;

    let url = format!(
        "https://api.openweathermap.org/data/2.5/forecast?lat={}&lon={}&appid={}&units=imperial",
        lat, lon, api_key
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Forecast request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Forecast API error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Forecast parse failed: {}", e)))?;

    // The 5-day forecast returns 3-hour intervals. Aggregate into daily summaries.
    let empty_vec = vec![];
    let list = data["list"].as_array().unwrap_or(&empty_vec);

    let mut daily: std::collections::BTreeMap<String, DayAccumulator> =
        std::collections::BTreeMap::new();

    for entry in list {
        let dt = entry["dt"].as_i64().unwrap_or(0);
        let date = chrono::DateTime::from_timestamp(dt, 0)
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();

        let acc = daily.entry(date).or_insert_with(DayAccumulator::new);
        acc.temp_max = acc
            .temp_max
            .max(entry["main"]["temp_max"].as_f64().unwrap_or(0.0));
        acc.temp_min = if acc.temp_min == 0.0 {
            entry["main"]["temp_min"].as_f64().unwrap_or(0.0)
        } else {
            acc.temp_min
                .min(entry["main"]["temp_min"].as_f64().unwrap_or(999.0))
        };
        acc.humidity_sum += entry["main"]["humidity"].as_f64().unwrap_or(0.0);
        acc.pop_max = acc.pop_max.max(entry["pop"].as_f64().unwrap_or(0.0));
        acc.count += 1;

        // Use the midday (12:00-15:00) weather as representative
        let hour = chrono::DateTime::from_timestamp(dt, 0)
            .map(|d| d.format("%H").to_string().parse::<u32>().unwrap_or(0))
            .unwrap_or(0);
        if (12..=15).contains(&hour) || acc.condition.is_empty() {
            acc.condition = entry["weather"][0]["main"]
                .as_str()
                .unwrap_or("")
                .to_string();
            acc.description = entry["weather"][0]["description"]
                .as_str()
                .unwrap_or("")
                .to_string();
            acc.icon = entry["weather"][0]["icon"]
                .as_str()
                .unwrap_or("")
                .to_string();
        }
    }

    let days: Vec<serde_json::Value> = daily
        .into_iter()
        .map(|(date, acc)| {
            serde_json::json!({
                "date": date,
                "temp_max": (acc.temp_max * 10.0).round() / 10.0,
                "temp_min": (acc.temp_min * 10.0).round() / 10.0,
                "humidity": (acc.humidity_sum / acc.count as f64).round(),
                "pop": (acc.pop_max * 100.0).round(),
                "condition": acc.condition,
                "description": acc.description,
                "icon": acc.icon,
            })
        })
        .collect();

    // Also include hourly data (next 24 hours)
    let hourly: Vec<serde_json::Value> = list
        .iter()
        .take(8)
        .map(|entry| {
            serde_json::json!({
                "dt": entry["dt"],
                "temp": entry["main"]["temp"],
                "condition": entry["weather"][0]["main"],
                "description": entry["weather"][0]["description"],
                "icon": entry["weather"][0]["icon"],
                "pop": ((entry["pop"].as_f64().unwrap_or(0.0)) * 100.0).round(),
                "humidity": entry["main"]["humidity"],
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "daily": days,
        "hourly": hourly,
    })))
}

struct DayAccumulator {
    temp_max: f64,
    temp_min: f64,
    humidity_sum: f64,
    pop_max: f64,
    count: usize,
    condition: String,
    description: String,
    icon: String,
}

impl DayAccumulator {
    fn new() -> Self {
        Self {
            temp_max: f64::MIN,
            temp_min: 0.0,
            humidity_sum: 0.0,
            pop_max: 0.0,
            count: 0,
            condition: String::new(),
            description: String::new(),
            icon: String::new(),
        }
    }
}
