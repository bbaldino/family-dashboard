use axum::Json;
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::proxy::MaClient;
use super::types::{ImageProxyQuery, PlayRequest, QueueCommand, SearchQuery, VolumeRequest};

/// Recursively rewrite image URLs in JSON to go through our backend proxy.
/// Looks for keys like "image", "image_url", "imageUrl" that contain URL strings.
fn rewrite_image_urls(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, val) in map.iter_mut() {
                if (key == "image" || key == "image_url" || key == "imageUrl") && val.is_string() {
                    if let Some(url) = val.as_str() {
                        if url.starts_with("http://") || url.starts_with("https://") {
                            *val = serde_json::Value::String(format!(
                                "/api/music/image?url={}",
                                urlencoding::encode(url)
                            ));
                        }
                    }
                } else {
                    rewrite_image_urls(val);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                rewrite_image_urls(item);
            }
        }
        _ => {}
    }
}

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
    let mut data: serde_json::Value = client
        .command("players/all", serde_json::Value::Null)
        .await?;
    rewrite_image_urls(&mut data);
    Ok(Json(data))
}

pub async fn search(
    State(pool): State<SqlitePool>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let mut data: serde_json::Value = client
        .command(
            "music/search",
            serde_json::json!({
                "search_query": params.q,
                "media_types": ["artist", "album", "playlist", "track"],
                "limit": 5,
            }),
        )
        .await?;
    rewrite_image_urls(&mut data);
    Ok(Json(data))
}

pub async fn get_recent(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let mut data: serde_json::Value = client
        .command("music/recently_played_items", serde_json::Value::Null)
        .await?;
    rewrite_image_urls(&mut data);
    Ok(Json(data))
}

pub async fn get_queue(
    State(pool): State<SqlitePool>,
    Path(queue_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let mut data: serde_json::Value = client
        .command(
            "player_queues/items",
            serde_json::json!({ "queue_id": queue_id }),
        )
        .await?;
    rewrite_image_urls(&mut data);
    Ok(Json(data))
}

pub async fn proxy_image(
    State(pool): State<SqlitePool>,
    Query(params): Query<ImageProxyQuery>,
) -> Result<impl IntoResponse, AppError> {
    let config = IntegrationConfig::new(&pool, "music");
    let service_url = config.get("service_url").await?;

    // Only allow proxying URLs that point to the configured MA instance
    if !params.url.starts_with(&service_url) {
        return Err(AppError::BadRequest(
            "URL does not match configured service".to_string(),
        ));
    }

    let client = reqwest::Client::new();
    let resp = client
        .get(&params.url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Image fetch failed: {}", e)))?;

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::Internal(format!("Image read failed: {}", e)))?;

    Ok(([(axum::http::header::CONTENT_TYPE, content_type)], bytes))
}
