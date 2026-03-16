use axum::{
    Json, Router,
    extract::{Query, State},
    routing::get,
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::google::*;

#[derive(Clone)]
pub struct CalendarState {
    pub pool: SqlitePool,
    pub config: GoogleOAuthConfig,
}

pub fn router(pool: SqlitePool, config: GoogleOAuthConfig) -> Router {
    let state = CalendarState { pool, config };
    Router::new()
        .route("/google/calendars", get(list_calendars))
        .route("/google/events", get(list_events))
        .with_state(state)
}

async fn get_valid_token(state: &CalendarState) -> Result<String, AppError> {
    let token = sqlx::query_as::<_, GoogleToken>("SELECT * FROM google_tokens WHERE id = 1")
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Not authenticated with Google".to_string()))?;

    let expires_at = chrono::DateTime::parse_from_rfc3339(&token.expires_at)
        .map_err(|e| AppError::Internal(format!("Failed to parse expires_at: {}", e)))?;

    let now = chrono::Utc::now();
    let buffer = chrono::Duration::minutes(5);

    if expires_at - buffer > now {
        return Ok(token.access_token);
    }

    // Token expired or about to expire, refresh it
    let client = reqwest::Client::new();
    let mut form = HashMap::new();
    form.insert("client_id", state.config.client_id.as_str());
    form.insert("client_secret", state.config.client_secret.as_str());
    form.insert("refresh_token", token.refresh_token.as_str());
    form.insert("grant_type", "refresh_token");

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Token refresh failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(AppError::Internal(format!("Token refresh error: {}", body)));
    }

    #[derive(serde::Deserialize)]
    struct RefreshResponse {
        access_token: String,
        expires_in: i64,
    }

    let refresh_resp: RefreshResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse refresh response: {}", e)))?;

    let new_expires_at = chrono::Utc::now() + chrono::Duration::seconds(refresh_resp.expires_in);
    let new_expires_at_str = new_expires_at.to_rfc3339();

    sqlx::query("UPDATE google_tokens SET access_token = ?, expires_at = ? WHERE id = 1")
        .bind(&refresh_resp.access_token)
        .bind(&new_expires_at_str)
        .execute(&state.pool)
        .await?;

    Ok(refresh_resp.access_token)
}

async fn list_calendars(
    State(state): State<CalendarState>,
) -> Result<Json<Vec<CalendarListEntry>>, AppError> {
    let token = get_valid_token(&state).await?;

    let client = reqwest::Client::new();
    let resp = client
        .get("https://www.googleapis.com/calendar/v3/users/me/calendarList")
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Calendar API error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(AppError::Internal(format!("Calendar API error: {}", body)));
    }

    let calendar_list: CalendarListResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse calendar list: {}", e)))?;

    Ok(Json(calendar_list.items))
}

#[derive(serde::Deserialize)]
struct EventsParams {
    calendar: String,
    start: String,
    end: String,
}

async fn list_events(
    State(state): State<CalendarState>,
    Query(params): Query<EventsParams>,
) -> Result<Json<Vec<CalendarEvent>>, AppError> {
    let token = get_valid_token(&state).await?;

    let calendar_id = urlencoding::encode(&params.calendar);
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/{}/events",
        calendar_id
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .bearer_auth(&token)
        .query(&[
            ("timeMin", params.start.as_str()),
            ("timeMax", params.end.as_str()),
            ("singleEvents", "true"),
            ("orderBy", "startTime"),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Events API error: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(AppError::Internal(format!("Events API error: {}", body)));
    }

    let events_resp: EventsListResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse events: {}", e)))?;

    Ok(Json(events_resp.items.unwrap_or_default()))
}
