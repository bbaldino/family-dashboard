use axum::{
    Json, Router,
    extract::{Path, State},
    routing::get,
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/", get(get_all_config))
        .route("/{key}", get(get_config).put(set_config))
        .with_state(pool)
}

async fn get_all_config(
    State(pool): State<SqlitePool>,
) -> Result<Json<HashMap<String, String>>, AppError> {
    let rows = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM config")
        .fetch_all(&pool)
        .await?;
    let map: HashMap<String, String> = rows.into_iter().collect();
    Ok(Json(map))
}

async fn get_config(
    State(pool): State<SqlitePool>,
    Path(key): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let row = sqlx::query_as::<_, (String,)>("SELECT value FROM config WHERE key = ?")
        .bind(&key)
        .fetch_optional(&pool)
        .await?;

    match row {
        Some((value,)) => Ok(Json(serde_json::json!({ "key": key, "value": value }))),
        None => Err(AppError::NotFound(format!(
            "Config key '{}' not found",
            key
        ))),
    }
}

async fn set_config(
    State(pool): State<SqlitePool>,
    Path(key): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let value = body
        .get("value")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("'value' field required".to_string()))?;

    sqlx::query(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(value)
    .execute(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "key": key, "value": value })))
}
