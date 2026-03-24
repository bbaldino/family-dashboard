use axum::Json;
use axum::extract::{Path, Query, State};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::proxy::MaClient;
use super::types::{PlayRequest, QueueCommand, SearchQuery, VolumeRequest};

async fn default_queue_id(pool: &SqlitePool) -> Result<String, AppError> {
    IntegrationConfig::new(pool, "music")
        .get("default_player")
        .await
}

pub async fn play(
    State(pool): State<SqlitePool>,
    Json(req): Json<PlayRequest>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    let queue_id = match req.queue_id {
        Some(id) => id,
        None => default_queue_id(&pool).await?,
    };

    let mut args = serde_json::json!({
        "queue_id": queue_id,
        "media": req.uri,
    });

    if req.radio == Some(true) {
        args["radio_mode"] = serde_json::Value::Bool(true);
    }

    client.command_void("player_queues/play_media", args).await
}

pub async fn pause(
    State(pool): State<SqlitePool>,
    body: Option<Json<QueueCommand>>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    let queue_id = match body.and_then(|b| b.0.queue_id) {
        Some(id) => id,
        None => default_queue_id(&pool).await?,
    };
    client
        .command_void(
            "player_queues/pause",
            serde_json::json!({ "queue_id": queue_id }),
        )
        .await
}

pub async fn resume(
    State(pool): State<SqlitePool>,
    body: Option<Json<QueueCommand>>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    let queue_id = match body.and_then(|b| b.0.queue_id) {
        Some(id) => id,
        None => default_queue_id(&pool).await?,
    };
    client
        .command_void(
            "player_queues/resume",
            serde_json::json!({ "queue_id": queue_id }),
        )
        .await
}

pub async fn stop(
    State(pool): State<SqlitePool>,
    body: Option<Json<QueueCommand>>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    let queue_id = match body.and_then(|b| b.0.queue_id) {
        Some(id) => id,
        None => default_queue_id(&pool).await?,
    };
    client
        .command_void(
            "player_queues/stop",
            serde_json::json!({ "queue_id": queue_id }),
        )
        .await
}

pub async fn next(
    State(pool): State<SqlitePool>,
    body: Option<Json<QueueCommand>>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    let queue_id = match body.and_then(|b| b.0.queue_id) {
        Some(id) => id,
        None => default_queue_id(&pool).await?,
    };
    client
        .command_void(
            "player_queues/next",
            serde_json::json!({ "queue_id": queue_id }),
        )
        .await
}

pub async fn previous(
    State(pool): State<SqlitePool>,
    body: Option<Json<QueueCommand>>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    let queue_id = match body.and_then(|b| b.0.queue_id) {
        Some(id) => id,
        None => default_queue_id(&pool).await?,
    };
    client
        .command_void(
            "player_queues/previous",
            serde_json::json!({ "queue_id": queue_id }),
        )
        .await
}

pub async fn set_volume(
    State(pool): State<SqlitePool>,
    Json(req): Json<VolumeRequest>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    client
        .command_void(
            "players/cmd/volume_set",
            serde_json::json!({
                "player_id": req.player_id,
                "volume_level": req.level,
            }),
        )
        .await
}

pub async fn get_players(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let data: serde_json::Value = client
        .command("players/all", serde_json::Value::Null)
        .await?;
    Ok(Json(data))
}

pub async fn search(
    State(pool): State<SqlitePool>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let data: serde_json::Value = client
        .command(
            "music/search",
            serde_json::json!({
                "search_query": params.q,
                "media_types": ["artist", "album", "playlist", "track"],
                "limit": 5,
            }),
        )
        .await?;
    Ok(Json(data))
}

pub async fn get_recent(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let data: serde_json::Value = client
        .command("music/recently_played_items", serde_json::Value::Null)
        .await?;
    Ok(Json(data))
}

pub async fn get_queue(
    State(pool): State<SqlitePool>,
    Path(queue_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let data: serde_json::Value = client
        .command(
            "player_queues/items",
            serde_json::json!({ "queue_id": queue_id }),
        )
        .await?;
    Ok(Json(data))
}
