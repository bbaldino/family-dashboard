use axum::{extract::Query, routing::get, Json, Router};
use std::collections::HashMap;

use crate::error::AppError;

pub fn router() -> Router {
    Router::new().route("/nutrislice/menu", get(get_menu))
}

async fn get_menu(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let date = params
        .get("date")
        .ok_or_else(|| AppError::BadRequest("date parameter required (YYYY/MM/DD)".to_string()))?;

    let school = params
        .get("school")
        .map(|s| s.as_str())
        .unwrap_or("bagby-elementary-school");

    let district = params
        .get("district")
        .map(|s| s.as_str())
        .unwrap_or("cambriansd");

    let menu_type = params
        .get("type")
        .map(|s| s.as_str())
        .unwrap_or("lunch");

    let url = format!(
        "https://{}.api.nutrislice.com/menu/api/weeks/school/{}/menu-type/{}/{}?format=json",
        district, school, menu_type, date
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("NutriSlice request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "NutriSlice returned {}",
            resp.status()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("NutriSlice parse failed: {}", e)))?;

    Ok(Json(body))
}
