use axum::Json;
use axum::extract::{Query, State};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

pub async fn get_menu(
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let config = IntegrationConfig::new(&pool, INTEGRATION_ID);

    let date = params
        .get("date")
        .ok_or_else(|| AppError::BadRequest("date parameter required (YYYY/MM/DD)".to_string()))?;

    let school = config.get_or("school", "bagby-elementary-school").await?;
    let district = config.get_or("district", "cambriansd").await?;
    let menu_type = config.get_or("menu_type", "lunch").await?;

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
