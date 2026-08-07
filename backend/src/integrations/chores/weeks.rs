use std::collections::HashMap;

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use chrono::Datelike;
use sqlx::SqlitePool;

use crate::error::AppError;

use super::models::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/weeks/copy", post(copy_week))
        .route("/weeks/rotate", post(rotate_week))
        .route("/today", get(today))
        .with_state(pool)
}

async fn copy_week(
    State(pool): State<SqlitePool>,
    Json(input): Json<CopyWeek>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    // One transaction for the whole copy. Failing partway through the inserts
    // used to leave the target week half filled, with nothing to say which
    // half; now the target is either fully copied or untouched. Any early
    // return below drops the transaction, which rolls it back.
    let mut tx = pool.begin().await?;

    // Fetch all assignments for source week
    let source_assignments = sqlx::query_as::<_, (i64, i64, i32)>(
        "SELECT chore_id, person_id, day_of_week FROM assignments WHERE week_of = ?",
    )
    .bind(&input.from_week)
    .fetch_all(&mut *tx)
    .await?;

    if source_assignments.is_empty() {
        return Err(AppError::NotFound(format!(
            "No assignments found for week {}",
            input.from_week
        )));
    }

    // Refuse a target week that already has assignments. This used to append,
    // so copying twice silently duplicated every assignment. Clearing the
    // target instead would be worse: it would destroy a week somebody filled
    // in by hand, without asking.
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assignments WHERE week_of = ?")
        .bind(&input.to_week)
        .fetch_one(&mut *tx)
        .await?;

    if existing > 0 {
        return Err(AppError::BadRequest(format!(
            "Week {} already has {} assignment(s) — clear it before copying into it",
            input.to_week, existing
        )));
    }

    // Insert copies for the target week
    for (chore_id, person_id, day_of_week) in &source_assignments {
        sqlx::query(
            "INSERT INTO assignments (chore_id, person_id, week_of, day_of_week, completed, picked_chore_id) VALUES (?, ?, ?, ?, 0, NULL)",
        )
        .bind(chore_id)
        .bind(person_id)
        .bind(&input.to_week)
        .bind(day_of_week)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "status": "copied",
            "count": source_assignments.len()
        })),
    ))
}

async fn rotate_week(
    State(pool): State<SqlitePool>,
    Json(input): Json<RotateWeek>,
) -> Result<Json<serde_json::Value>, AppError> {
    // One transaction for the whole rotation. Failing partway used to leave
    // some chores shifted and the rest where they were — a week nobody can
    // read. Any early return below drops the transaction, which rolls it back.
    let mut tx = pool.begin().await?;

    // Get all people ordered by ID
    let people = sqlx::query_as::<_, (i64,)>("SELECT id FROM people ORDER BY id")
        .fetch_all(&mut *tx)
        .await?;

    if people.len() < 2 {
        return Err(AppError::BadRequest(
            "Need at least 2 people to rotate".to_string(),
        ));
    }

    // Build rotation mapping: person[i] -> person[(i+1) % len]
    let len = people.len();
    let mut mapping: HashMap<i64, i64> = HashMap::new();
    for i in 0..len {
        mapping.insert(people[i].0, people[(i + 1) % len].0);
    }

    // Get all assignments for the week
    let assignments =
        sqlx::query_as::<_, (i64, i64)>("SELECT id, person_id FROM assignments WHERE week_of = ?")
            .bind(&input.week)
            .fetch_all(&mut *tx)
            .await?;

    // Update each assignment with the rotated person
    for (assignment_id, person_id) in &assignments {
        if let Some(&new_person_id) = mapping.get(person_id) {
            sqlx::query("UPDATE assignments SET person_id = ? WHERE id = ?")
                .bind(new_person_id)
                .bind(assignment_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "status": "rotated",
        "assignments_updated": assignments.len()
    })))
}

#[derive(Debug, sqlx::FromRow)]
struct TodayRow {
    id: i64,
    chore_id: i64,
    person_id: i64,
    picked_chore_id: Option<i64>,
    completed: i32,
    chore_name: String,
    chore_type: String,
    chore_tags: String,
    person_name: String,
    person_color: String,
    person_avatar: Option<Vec<u8>>,
    picked_chore_name: Option<String>,
}

async fn today(State(pool): State<SqlitePool>) -> Result<Json<TodayResponse>, AppError> {
    let now = chrono::Local::now().naive_local().date();
    let weekday = now.weekday().num_days_from_monday() as i64;
    let monday = now - chrono::Duration::days(weekday);
    let week_of = monday.format("%Y-%m-%d").to_string();
    let day_of_week = weekday as i32;

    let rows = sqlx::query_as::<_, TodayRow>(
        r#"SELECT
            a.id, a.chore_id, a.person_id,
            a.picked_chore_id, a.completed,
            c.name as chore_name, c.chore_type, c.tags as chore_tags,
            p.name as person_name, p.color as person_color, p.avatar as person_avatar,
            pc.name as picked_chore_name
        FROM assignments a
        JOIN chores c ON c.id = a.chore_id
        JOIN people p ON p.id = a.person_id
        LEFT JOIN chores pc ON pc.id = a.picked_chore_id
        WHERE a.week_of = ?1 AND a.day_of_week = ?2
        ORDER BY p.name"#,
    )
    .bind(&week_of)
    .bind(day_of_week)
    .fetch_all(&pool)
    .await?;

    // Group by person_id
    let mut person_map: HashMap<i64, (PersonRef, Vec<TodayAssignment>)> = HashMap::new();
    let mut person_order: Vec<i64> = Vec::new();
    let mut completed_count: i64 = 0;
    let total_count = rows.len() as i64;

    for row in rows {
        if row.completed != 0 {
            completed_count += 1;
        }

        let tags: Vec<String> = serde_json::from_str(&row.chore_tags).unwrap_or_default();

        let picked_chore = match (row.picked_chore_id, row.picked_chore_name) {
            (Some(id), Some(name)) => Some(ChoreRef {
                id,
                name,
                chore_type: "regular".to_string(),
                tags: vec![],
            }),
            _ => None,
        };

        let assignment = TodayAssignment {
            id: row.id,
            chore: ChoreRef {
                id: row.chore_id,
                name: row.chore_name,
                chore_type: row.chore_type,
                tags,
            },
            picked_chore,
            completed: row.completed != 0,
        };

        let entry = person_map.entry(row.person_id).or_insert_with(|| {
            person_order.push(row.person_id);
            (
                PersonRef {
                    id: row.person_id,
                    name: row.person_name.clone(),
                    color: row.person_color.clone(),
                    avatar: row.person_avatar.as_deref().map(|data| {
                        let encoded = base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            data,
                        );
                        format!("data:image/png;base64,{encoded}")
                    }),
                },
                Vec::new(),
            )
        });
        entry.1.push(assignment);
    }

    let persons: Vec<PersonAssignments> = person_order
        .into_iter()
        .filter_map(|pid| {
            person_map
                .remove(&pid)
                .map(|(person, assignments)| PersonAssignments {
                    person,
                    assignments,
                })
        })
        .collect();

    Ok(Json(TodayResponse {
        persons,
        completed_count,
        total_count,
    }))
}
