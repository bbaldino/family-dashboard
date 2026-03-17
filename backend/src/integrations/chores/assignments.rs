use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;

use super::models::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route(
            "/assignments",
            get(list_assignments).post(create_assignment),
        )
        .route("/assignments/{id}", delete(delete_assignment))
        .route("/assignments/{id}/complete", post(complete_assignment))
        .route("/assignments/{id}/uncomplete", post(uncomplete_assignment))
        .route("/assignments/{id}/pick", post(pick_chore))
        .route("/assignments/{id}/clear-pick", post(clear_pick))
        .with_state(pool)
}

#[derive(Debug, Deserialize)]
struct WeekQuery {
    week_of: String,
}

async fn list_assignments(
    State(pool): State<SqlitePool>,
    Query(params): Query<WeekQuery>,
) -> Result<Json<Vec<AssignmentResponse>>, AppError> {
    let rows = sqlx::query_as::<_, AssignmentRow>(
        r#"SELECT
            a.id, a.chore_id, a.person_id, a.week_of, a.day_of_week,
            a.picked_chore_id, a.completed,
            c.name as chore_name, c.chore_type, c.tags as chore_tags,
            p.name as person_name, p.color as person_color,
            pc.name as picked_chore_name
        FROM assignments a
        JOIN chores c ON c.id = a.chore_id
        JOIN people p ON p.id = a.person_id
        LEFT JOIN chores pc ON pc.id = a.picked_chore_id
        WHERE a.week_of = ?1
        ORDER BY p.name, a.day_of_week"#,
    )
    .bind(&params.week_of)
    .fetch_all(&pool)
    .await?;

    let assignments: Vec<AssignmentResponse> =
        rows.into_iter().map(AssignmentResponse::from).collect();
    Ok(Json(assignments))
}

async fn create_assignment(
    State(pool): State<SqlitePool>,
    Json(input): Json<CreateAssignment>,
) -> Result<(StatusCode, Json<AssignmentResponse>), AppError> {
    // Insert the assignment
    let id = sqlx::query_scalar::<_, i64>(
        "INSERT INTO assignments (chore_id, person_id, week_of, day_of_week) VALUES (?, ?, ?, ?) RETURNING id",
    )
    .bind(input.chore_id)
    .bind(input.person_id)
    .bind(&input.week_of)
    .bind(input.day_of_week)
    .fetch_one(&pool)
    .await?;

    // Fetch back with JOINs
    let row = sqlx::query_as::<_, AssignmentRow>(
        r#"SELECT
            a.id, a.chore_id, a.person_id, a.week_of, a.day_of_week,
            a.picked_chore_id, a.completed,
            c.name as chore_name, c.chore_type, c.tags as chore_tags,
            p.name as person_name, p.color as person_color,
            pc.name as picked_chore_name
        FROM assignments a
        JOIN chores c ON c.id = a.chore_id
        JOIN people p ON p.id = a.person_id
        LEFT JOIN chores pc ON pc.id = a.picked_chore_id
        WHERE a.id = ?1"#,
    )
    .bind(id)
    .fetch_one(&pool)
    .await?;

    Ok((StatusCode::CREATED, Json(AssignmentResponse::from(row))))
}

async fn delete_assignment(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM assignments WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Assignment {} not found", id)));
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn complete_assignment(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query("UPDATE assignments SET completed = 1 WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Assignment {} not found", id)));
    }
    Ok(Json(serde_json::json!({"status": "completed"})))
}

async fn uncomplete_assignment(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query("UPDATE assignments SET completed = 0 WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Assignment {} not found", id)));
    }
    Ok(Json(serde_json::json!({"status": "uncompleted"})))
}

async fn pick_chore(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Json(input): Json<PickChore>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query("UPDATE assignments SET picked_chore_id = ? WHERE id = ?")
        .bind(input.chore_id)
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Assignment {} not found", id)));
    }
    Ok(Json(serde_json::json!({"status": "picked"})))
}

async fn clear_pick(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query("UPDATE assignments SET picked_chore_id = NULL WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Assignment {} not found", id)));
    }
    Ok(Json(serde_json::json!({"status": "pick_cleared"})))
}
