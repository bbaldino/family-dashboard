use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, put},
};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;

use super::models::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/chores", get(list_chores).post(create_chore))
        .route("/chores/{id}", put(update_chore).delete(delete_chore))
        .route("/chores/by-tags", get(chores_by_tags))
        .with_state(pool)
}

async fn list_chores(State(pool): State<SqlitePool>) -> Result<Json<Vec<Chore>>, AppError> {
    let chores = sqlx::query_as::<_, Chore>("SELECT * FROM chores ORDER BY name")
        .fetch_all(&pool)
        .await?;
    Ok(Json(chores))
}

async fn create_chore(
    State(pool): State<SqlitePool>,
    Json(input): Json<CreateChore>,
) -> Result<(StatusCode, Json<Chore>), AppError> {
    let chore_type = input.chore_type.unwrap_or_else(|| "regular".to_string());
    let tags = serde_json::to_string(&input.tags.unwrap_or_default())
        .map_err(|e| AppError::Internal(format!("Failed to serialize tags: {e}")))?;
    let pick_from_tags = serde_json::to_string(&input.pick_from_tags.unwrap_or_default())
        .map_err(|e| AppError::Internal(format!("Failed to serialize pick_from_tags: {e}")))?;

    let chore = sqlx::query_as::<_, Chore>(
        "INSERT INTO chores (name, description, chore_type, tags, pick_from_tags) VALUES (?, ?, ?, ?, ?) RETURNING *",
    )
    .bind(&input.name)
    .bind(&input.description)
    .bind(&chore_type)
    .bind(&tags)
    .bind(&pick_from_tags)
    .fetch_one(&pool)
    .await?;

    Ok((StatusCode::CREATED, Json(chore)))
}

async fn update_chore(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Json(input): Json<UpdateChore>,
) -> Result<Json<Chore>, AppError> {
    let existing = sqlx::query_as::<_, Chore>("SELECT * FROM chores WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Chore {} not found", id)))?;

    let name = input.name.unwrap_or(existing.name);
    let description = if input.description.is_some() {
        input.description
    } else {
        existing.description
    };
    let chore_type = input.chore_type.unwrap_or(existing.chore_type);
    let tags = match input.tags {
        Some(t) => serde_json::to_string(&t)
            .map_err(|e| AppError::Internal(format!("Failed to serialize tags: {e}")))?,
        None => existing.tags,
    };
    let pick_from_tags = match input.pick_from_tags {
        Some(t) => serde_json::to_string(&t)
            .map_err(|e| AppError::Internal(format!("Failed to serialize pick_from_tags: {e}")))?,
        None => existing.pick_from_tags,
    };

    let chore = sqlx::query_as::<_, Chore>(
        "UPDATE chores SET name = ?, description = ?, chore_type = ?, tags = ?, pick_from_tags = ? WHERE id = ? RETURNING *",
    )
    .bind(&name)
    .bind(&description)
    .bind(&chore_type)
    .bind(&tags)
    .bind(&pick_from_tags)
    .bind(id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(chore))
}

async fn delete_chore(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM chores WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Chore {} not found", id)));
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
struct TagsQuery {
    tags: String,
}

async fn chores_by_tags(
    State(pool): State<SqlitePool>,
    Query(params): Query<TagsQuery>,
) -> Result<Json<Vec<Chore>>, AppError> {
    let requested_tags: Vec<&str> = params.tags.split(',').map(|s| s.trim()).collect();

    let all_chores = sqlx::query_as::<_, Chore>("SELECT * FROM chores ORDER BY name")
        .fetch_all(&pool)
        .await?;

    let filtered: Vec<Chore> = all_chores
        .into_iter()
        .filter(|chore| {
            let chore_tags: Vec<String> = serde_json::from_str(&chore.tags).unwrap_or_default();
            requested_tags
                .iter()
                .any(|rt| chore_tags.iter().any(|ct| ct == rt))
        })
        .collect();

    Ok(Json(filtered))
}
