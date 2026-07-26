use axum::Json;
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::proxy::MaClient;
use super::types::{
    GroupRequest, ImageProxyQuery, PlayRequest, QueueCommand, SearchQuery, UngroupRequest,
    VolumeRequest,
};

#[derive(serde::Deserialize)]
pub struct TopTracksQuery {
    pub limit: Option<i64>,
}

pub async fn top_tracks(
    State(pool): State<SqlitePool>,
    Query(params): Query<TopTracksQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(20);
    // Counts only explicit picks (search taps, recently/frequently re-taps,
    // ForYou playlist picks). This mirrors Recently Played's data source so
    // both sections reflect the user's choices rather than auto-advance /
    // radio followups in MA's queue.
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, i64, i64)>(
        "SELECT uri, name, artist, album, image_url, COUNT(*) as play_count, MAX(played_at) as last_played \
         FROM music_explicit_play_log \
         GROUP BY uri \
         ORDER BY play_count DESC, last_played DESC \
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(&pool)
    .await?;

    let items: Vec<serde_json::Value> = rows
        .into_iter()
        .map(
            |(uri, name, artist, album, image_url, play_count, last_played)| {
                serde_json::json!({
                    "uri": uri,
                    "name": name,
                    "artist": artist,
                    "album": album,
                    "image_url": image_url,
                    "play_count": play_count,
                    "last_played": last_played,
                })
            },
        )
        .collect();

    Ok(Json(serde_json::json!(items)))
}

/// Recursively rewrite image URLs in JSON to go through our backend proxy.
/// Looks for keys like "image", "image_url", "imageUrl" that contain URL strings.
fn rewrite_image_urls(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, val) in map.iter_mut() {
                if (key == "image" || key == "image_url" || key == "imageUrl") && val.is_string() {
                    if let Some(url) = val.as_str() {
                        // Only proxy HTTP URLs (mixed content). HTTPS URLs are fine as-is.
                        if url.starts_with("http://") {
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

    // Default to "play" (replaces the queue) so a fresh pick doesn't continue
    // into leftovers from a previous session. Caller can override with "next"
    // or "add" to enqueue without replacing.
    let option = req
        .enqueue_mode
        .as_deref()
        .filter(|m| matches!(*m, "play" | "replace" | "next" | "replace_next" | "add"))
        .unwrap_or("play");

    let mut args = serde_json::json!({
        "queue_id": queue_id,
        "media": req.uri,
        "option": option,
    });

    if req.radio == Some(true) {
        args["radio_mode"] = serde_json::Value::Bool(true);
    }

    client
        .command_void("player_queues/play_media", args)
        .await?;

    // Log the explicit selection so Recently Played reflects what the user
    // actually chose, not whatever ESPN/MA auto-advanced to next.
    let _ = sqlx::query(
        "INSERT INTO music_explicit_play_log \
         (uri, media_type, name, artist, album, image_url, artist_uri, album_uri) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&req.uri)
    .bind(req.media_type.as_deref().unwrap_or(""))
    .bind(req.name.as_deref().unwrap_or(""))
    .bind(req.artist.as_deref().unwrap_or(""))
    .bind(&req.album)
    .bind(&req.image_url)
    .bind(&req.artist_uri)
    .bind(&req.album_uri)
    .execute(&pool)
    .await;

    Ok(())
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

/// Set the group's combined volume. Only meaningful when player_id is the
/// leader of a sync group; MA scales every member's individual volume to
/// reach the requested level.
pub async fn set_group_volume(
    State(pool): State<SqlitePool>,
    Json(req): Json<VolumeRequest>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    client
        .command_void(
            "players/cmd/group_volume_set",
            serde_json::json!({
                "player_id": req.player_id,
                "volume_level": req.level,
            }),
        )
        .await
}

/// Add `player_id` into `target_player`'s sync group.
/// MA command: `players/cmd/group(target_player, player_id)`.
pub async fn group(
    State(pool): State<SqlitePool>,
    Json(req): Json<GroupRequest>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    client
        .command_void(
            "players/cmd/group",
            serde_json::json!({
                "target_player": req.target_player,
                "player_id": req.player_id,
            }),
        )
        .await
}

/// Remove `player_id` from whatever sync group it's in.
/// MA command: `players/cmd/ungroup(player_id)`.
pub async fn ungroup(
    State(pool): State<SqlitePool>,
    Json(req): Json<UngroupRequest>,
) -> Result<(), AppError> {
    let client = MaClient::from_config(&pool).await?;
    client
        .command_void(
            "players/cmd/ungroup",
            serde_json::json!({
                "player_id": req.player_id,
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
    let started = std::time::Instant::now();
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
    let ma_elapsed_ms = started.elapsed().as_millis();
    rewrite_image_urls(&mut data);
    let count = |k: &str| {
        data.get(k)
            .and_then(|v| v.as_array())
            .map(|a| a.len())
            .unwrap_or(0)
    };
    tracing::info!(
        query = %params.q,
        ma_ms = ma_elapsed_ms,
        tracks = count("tracks"),
        artists = count("artists"),
        albums = count("albums"),
        playlists = count("playlists"),
        "music search returned"
    );
    Ok(Json(data))
}

pub async fn get_recent(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Most-recent explicit selection per URI, newest first. Keeps the list
    // showing only what the user chose to play (not radio followups or
    // album auto-advance).
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            i64,
        ),
    >(
        "SELECT uri, media_type, name, artist, album, image_url, MAX(played_at) as last_played \
         FROM music_explicit_play_log \
         GROUP BY uri \
         ORDER BY last_played DESC \
         LIMIT 30",
    )
    .fetch_all(&pool)
    .await?;

    let items: Vec<serde_json::Value> = rows
        .into_iter()
        .map(
            |(uri, media_type, name, artist, album, image_url, last_played)| {
                serde_json::json!({
                    "uri": uri,
                    "media_type": media_type,
                    "name": name,
                    "artist": artist,
                    "album": album,
                    "image_url": image_url,
                    "last_played": last_played,
                })
            },
        )
        .collect();

    Ok(Json(serde_json::json!(items)))
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

/// Debug: send an arbitrary MA command. POST { command: "...", args: {...} }.
pub async fn debug_command(
    State(pool): State<SqlitePool>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let command = req["command"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("missing 'command'".into()))?;
    let args = req.get("args").cloned().unwrap_or(serde_json::Value::Null);
    let result: serde_json::Value = client.command(command, args).await?;
    Ok(Json(result))
}

/// Debug: dump every MA player and queue with all fields intact. Useful for
/// inspecting toggles MA doesn't expose in its UI (radio_mode, dont_stop_the_music,
/// repeat_mode, crossfade, etc.) without juggling MA auth tokens manually.
pub async fn debug_players(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = MaClient::from_config(&pool).await?;
    let players: serde_json::Value = client
        .command("players/all", serde_json::Value::Null)
        .await?;
    let queues: serde_json::Value = client
        .command("player_queues/all", serde_json::Value::Null)
        .await?;
    Ok(Json(serde_json::json!({
        "players": players,
        "queues": queues,
    })))
}

pub async fn proxy_image(
    State(pool): State<SqlitePool>,
    Query(params): Query<ImageProxyQuery>,
) -> Result<impl IntoResponse, AppError> {
    let config = IntegrationConfig::new(&pool, "music");
    let service_url = config.get("service_url").await?;
    let service_url = service_url.trim_end_matches('/');

    // Only allow proxying URLs that point to the configured MA instance
    if !params.url.starts_with(service_url) {
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
