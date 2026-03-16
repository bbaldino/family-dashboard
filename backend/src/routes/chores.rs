use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::chore::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/chores", get(list_chores).post(create_chore))
        .route("/chores/{id}", put(update_chore).delete(delete_chore))
        .route("/chores/{id}/assignments", put(set_assignments))
        .route("/chores/assignments", get(get_assignments))
        .route(
            "/chores/assignments/{id}/complete",
            post(complete_assignment),
        )
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
    let chore = sqlx::query_as::<_, Chore>(
        "INSERT INTO chores (name, description) VALUES (?, ?) RETURNING *",
    )
    .bind(&input.name)
    .bind(&input.description)
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
    let chore = sqlx::query_as::<_, Chore>(
        "UPDATE chores SET name = ?, description = ? WHERE id = ? RETURNING *",
    )
    .bind(&name)
    .bind(&description)
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

async fn set_assignments(
    State(pool): State<SqlitePool>,
    Path(chore_id): Path<i64>,
    Json(input): Json<SetAssignments>,
) -> Result<Json<Vec<ChoreAssignment>>, AppError> {
    sqlx::query("SELECT id FROM chores WHERE id = ?")
        .bind(chore_id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Chore {} not found", chore_id)))?;
    sqlx::query("DELETE FROM chore_assignments WHERE chore_id = ?")
        .bind(chore_id)
        .execute(&pool)
        .await?;
    for entry in &input.assignments {
        sqlx::query(
            "INSERT INTO chore_assignments (chore_id, child_name, day_of_week) VALUES (?, ?, ?)",
        )
        .bind(chore_id)
        .bind(&entry.child_name)
        .bind(entry.day_of_week)
        .execute(&pool)
        .await?;
    }
    let assignments =
        sqlx::query_as::<_, ChoreAssignment>("SELECT * FROM chore_assignments WHERE chore_id = ?")
            .bind(chore_id)
            .fetch_all(&pool)
            .await?;
    Ok(Json(assignments))
}

async fn get_assignments(
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<AssignmentWithStatus>>, AppError> {
    let date = params
        .get("date")
        .ok_or_else(|| AppError::BadRequest("date parameter required".to_string()))?;
    let parsed = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid date format, use YYYY-MM-DD".to_string()))?;
    let day_of_week = parsed.format("%w").to_string().parse::<i32>().unwrap();
    let assignments = sqlx::query_as::<_, AssignmentWithStatus>(
        "SELECT ca.id, ca.chore_id, c.name as chore_name, ca.child_name, ca.day_of_week,
         CASE WHEN cc.id IS NOT NULL THEN 1 ELSE 0 END as completed
         FROM chore_assignments ca
         JOIN chores c ON c.id = ca.chore_id
         LEFT JOIN chore_completions cc ON cc.assignment_id = ca.id AND cc.completed_date = ?1
         WHERE ca.day_of_week = ?2
         ORDER BY c.name, ca.child_name",
    )
    .bind(date)
    .bind(day_of_week)
    .fetch_all(&pool)
    .await?;
    Ok(Json(assignments))
}

async fn complete_assignment(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Json(input): Json<CompleteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("SELECT id FROM chore_assignments WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Assignment {} not found", id)))?;
    sqlx::query(
        "INSERT OR IGNORE INTO chore_completions (assignment_id, completed_date) VALUES (?, ?)",
    )
    .bind(id)
    .bind(&input.date)
    .execute(&pool)
    .await?;
    Ok(Json(serde_json::json!({"status": "completed"})))
}
