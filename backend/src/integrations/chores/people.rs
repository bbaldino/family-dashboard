use axum::{
    Json, Router,
    extract::{Multipart, Path, State},
    http::StatusCode,
    routing::{get, put},
};
use sqlx::SqlitePool;

use crate::error::AppError;

use super::models::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/people", get(list_people).post(create_person))
        .route("/people/{id}", put(update_person).delete(delete_person))
        .with_state(pool)
}

async fn list_people(State(pool): State<SqlitePool>) -> Result<Json<Vec<Person>>, AppError> {
    let rows = sqlx::query_as::<_, PersonRow>("SELECT * FROM people ORDER BY name")
        .fetch_all(&pool)
        .await?;
    let people: Vec<Person> = rows.into_iter().map(Person::from).collect();
    Ok(Json(people))
}

async fn create_person(
    State(pool): State<SqlitePool>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Person>), AppError> {
    let mut name = String::new();
    let mut color = String::from("#888888");
    let mut avatar: Option<Vec<u8>> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {e}")))?
    {
        match field.name().unwrap_or("") {
            "name" => {
                name = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read name: {e}")))?;
            }
            "color" => {
                color = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read color: {e}")))?;
            }
            "avatar" => {
                avatar = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| AppError::BadRequest(format!("Failed to read avatar: {e}")))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    if name.is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }

    let row = sqlx::query_as::<_, PersonRow>(
        "INSERT INTO people (name, color, avatar) VALUES (?, ?, ?) RETURNING *",
    )
    .bind(&name)
    .bind(&color)
    .bind(&avatar)
    .fetch_one(&pool)
    .await?;

    Ok((StatusCode::CREATED, Json(Person::from(row))))
}

async fn update_person(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    mut multipart: Multipart,
) -> Result<Json<Person>, AppError> {
    let existing = sqlx::query_as::<_, PersonRow>("SELECT * FROM people WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Person {} not found", id)))?;

    let mut name = existing.name;
    let mut color = existing.color;
    let mut avatar = existing.avatar;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {e}")))?
    {
        match field.name().unwrap_or("") {
            "name" => {
                name = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read name: {e}")))?;
            }
            "color" => {
                color = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read color: {e}")))?;
            }
            "avatar" => {
                avatar = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| AppError::BadRequest(format!("Failed to read avatar: {e}")))?
                        .to_vec(),
                );
            }
            _ => {}
        }
    }

    let row = sqlx::query_as::<_, PersonRow>(
        "UPDATE people SET name = ?, color = ?, avatar = ? WHERE id = ? RETURNING *",
    )
    .bind(&name)
    .bind(&color)
    .bind(&avatar)
    .bind(id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(Person::from(row)))
}

async fn delete_person(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM people WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Person {} not found", id)));
    }
    Ok(StatusCode::NO_CONTENT)
}
