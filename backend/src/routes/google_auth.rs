use axum::{
    Json, Router,
    extract::{Query, State},
    response::Redirect,
    routing::get,
};
use serde::Deserialize;
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::google::GoogleOAuthConfig;

#[derive(Clone)]
pub struct GoogleAuthState {
    pub pool: SqlitePool,
    pub config: GoogleOAuthConfig,
}

pub fn router(pool: SqlitePool, config: GoogleOAuthConfig) -> Router {
    let state = GoogleAuthState { pool, config };
    Router::new()
        .route("/google/auth", get(google_auth))
        .route("/google/callback", get(google_callback))
        .with_state(state)
}

async fn google_auth(State(state): State<GoogleAuthState>) -> Redirect {
    let client_id = urlencoding::encode(&state.config.client_id);
    let redirect_uri = urlencoding::encode(&state.config.redirect_uri);
    let scope = urlencoding::encode("https://www.googleapis.com/auth/calendar.readonly");

    let url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         client_id={}&redirect_uri={}&response_type=code&scope={}&\
         access_type=offline&prompt=consent",
        client_id, redirect_uri, scope
    );

    Redirect::temporary(&url)
}

#[derive(Debug, Deserialize)]
struct CallbackParams {
    code: String,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
}

async fn google_callback(
    State(state): State<GoogleAuthState>,
    Query(params): Query<CallbackParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = reqwest::Client::new();

    let mut form = HashMap::new();
    form.insert("code", params.code.as_str());
    form.insert("client_id", state.config.client_id.as_str());
    form.insert("client_secret", state.config.client_secret.as_str());
    form.insert("redirect_uri", state.config.redirect_uri.as_str());
    form.insert("grant_type", "authorization_code");

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Token exchange failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(AppError::Internal(format!(
            "Token exchange error: {}",
            body
        )));
    }

    let token_resp: TokenResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse token response: {}", e)))?;

    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(token_resp.expires_in);
    let expires_at_str = expires_at.to_rfc3339();

    let refresh_token = token_resp
        .refresh_token
        .ok_or_else(|| AppError::Internal("No refresh token received".to_string()))?;

    sqlx::query(
        "INSERT INTO google_tokens (id, access_token, refresh_token, expires_at) \
         VALUES (1, ?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET \
         access_token = excluded.access_token, \
         refresh_token = excluded.refresh_token, \
         expires_at = excluded.expires_at",
    )
    .bind(&token_resp.access_token)
    .bind(&refresh_token)
    .bind(&expires_at_str)
    .execute(&state.pool)
    .await?;

    Ok(Json(serde_json::json!({"status": "authenticated"})))
}
