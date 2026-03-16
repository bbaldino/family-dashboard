use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{get, put},
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::lunch_menu::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/lunch-menu", get(get_lunch_menu))
        .route("/lunch-menu/{week}", put(upsert_lunch_menu))
        .with_state(pool)
}

async fn get_lunch_menu(
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<LunchMenuResponse>, AppError> {
    let week = params
        .get("week")
        .ok_or_else(|| AppError::BadRequest("week parameter required".to_string()))?;

    let menu = sqlx::query_as::<_, LunchMenu>("SELECT * FROM lunch_menus WHERE week_of = ?")
        .bind(week)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("No menu found for week {}", week)))?;

    let days: Vec<LunchDay> = serde_json::from_str(&menu.menu_data)
        .map_err(|e| AppError::Internal(format!("Failed to parse menu data: {}", e)))?;

    Ok(Json(LunchMenuResponse {
        week_of: menu.week_of,
        days,
    }))
}

async fn upsert_lunch_menu(
    State(pool): State<SqlitePool>,
    Path(week): Path<String>,
    Json(input): Json<UpsertLunchMenu>,
) -> Result<Json<LunchMenuResponse>, AppError> {
    let menu_data = serde_json::to_string(&input.days)
        .map_err(|e| AppError::Internal(format!("Failed to serialize menu data: {}", e)))?;

    sqlx::query(
        "INSERT INTO lunch_menus (week_of, menu_data) VALUES (?, ?)
         ON CONFLICT(week_of) DO UPDATE SET menu_data = excluded.menu_data",
    )
    .bind(&week)
    .bind(&menu_data)
    .execute(&pool)
    .await?;

    Ok(Json(LunchMenuResponse {
        week_of: week,
        days: input.days,
    }))
}
