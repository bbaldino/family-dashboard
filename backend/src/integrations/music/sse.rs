use std::convert::Infallible;
use std::time::Duration;

use axum::extract::State;
use axum::response::sse::{Event, Sse};
use futures::{SinkExt, StreamExt};
use sqlx::SqlitePool;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::error::AppError;
use crate::integrations::config_helpers::IntegrationConfig;

use super::proxy::MaClient;
use super::types::{QueueState, SseEvent, TrackInfo};

/// Derive the WebSocket URL from the MA service URL.
fn ws_url_from_service_url(service_url: &str) -> String {
    let ws = service_url
        .replace("https://", "wss://")
        .replace("http://", "ws://");
    format!("{}/ws", ws.trim_end_matches('/'))
}

/// Rewrite a direct MA image URL to go through our backend proxy.
fn proxy_image_url(url: &str) -> String {
    format!("/api/music/image?url={}", urlencoding::encode(url))
}

/// Rewrite all image URLs in queue states to use the backend proxy.
fn rewrite_image_urls(queues: &mut [QueueState]) {
    for q in queues.iter_mut() {
        if let Some(ref mut item) = q.current_item {
            if let Some(ref url) = item.image_url {
                item.image_url = Some(proxy_image_url(url));
            }
        }
    }
}

/// Fetch current queue state from MA via the HTTP API and build an SseEvent::State.
async fn fetch_full_state(pool: &SqlitePool) -> Result<SseEvent, AppError> {
    let client = MaClient::from_config(pool).await?;

    let players: serde_json::Value = client
        .command("players/all", serde_json::Value::Null)
        .await?;
    let queues_raw: serde_json::Value = client
        .command("player_queues/all", serde_json::Value::Null)
        .await?;

    let mut queues = build_queue_states(&players, &queues_raw);
    rewrite_image_urls(&mut queues);
    Ok(SseEvent::State { queues })
}

/// Transform MA's raw players + queues JSON into our simplified QueueState list.
fn build_queue_states(players: &serde_json::Value, queues: &serde_json::Value) -> Vec<QueueState> {
    let empty = vec![];
    let queue_arr = queues.as_array().unwrap_or(&empty);

    queue_arr
        .iter()
        .map(|q| {
            let queue_id = q["queue_id"].as_str().unwrap_or("").to_string();
            let display_name = q["display_name"].as_str().unwrap_or("Unknown").to_string();
            let state = q["state"].as_str().unwrap_or("idle").to_string();

            let current_item = q.get("current_item").and_then(|item| {
                if item.is_null() {
                    return None;
                }
                let media_item = if item.get("media_item").is_some() {
                    &item["media_item"]
                } else {
                    item
                };
                Some(TrackInfo {
                    name: media_item["name"].as_str().unwrap_or("").to_string(),
                    artist: media_item["artists"]
                        .as_array()
                        .and_then(|a| a.first())
                        .and_then(|a| a["name"].as_str())
                        .or_else(|| media_item["artist"].as_str())
                        .unwrap_or("")
                        .to_string(),
                    album: media_item["album"]
                        .as_object()
                        .and_then(|a| a.get("name"))
                        .and_then(|n| n.as_str())
                        .or_else(|| media_item["album"].as_str())
                        .map(String::from),
                    image_url: media_item["image"]
                        .as_object()
                        .and_then(|img| img.get("url"))
                        .and_then(|u| u.as_str())
                        .or_else(|| media_item["image"].as_str())
                        .map(String::from),
                    duration: item["duration"]
                        .as_f64()
                        .or_else(|| media_item["duration"].as_f64())
                        .map(|d| d as i64),
                    elapsed: item["elapsed_time"]
                        .as_f64()
                        .or_else(|| q["elapsed_time"].as_f64())
                        .map(|d| d as i64),
                })
            });

            // Try to find volume from the player associated with this queue.
            let volume_level = find_player_volume(players, &queue_id);

            QueueState {
                queue_id,
                display_name,
                state,
                current_item,
                volume_level,
            }
        })
        .collect()
}

/// Look up the volume level for a player queue from the players list.
fn find_player_volume(players: &serde_json::Value, queue_id: &str) -> Option<i32> {
    let empty = vec![];
    let player_arr = players.as_array().unwrap_or(&empty);
    for player in player_arr {
        let active_source = player["active_source"].as_str().unwrap_or("");
        let player_id = player["player_id"].as_str().unwrap_or("");
        if active_source == queue_id || player_id == queue_id {
            return player["volume_level"].as_f64().map(|v| (v * 100.0) as i32);
        }
    }
    None
}

/// Connect to MA WebSocket and authenticate.
/// MA pushes events automatically after auth — no subscribe command needed.
async fn connect_and_auth(
    ws_url: &str,
    token: &str,
) -> Result<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    String,
> {
    let (ws_stream, _) = tokio_tungstenite::connect_async(ws_url)
        .await
        .map_err(|e| format!("WebSocket connect failed: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // Read server info message (sent immediately on connect, before auth).
    let server_info = read
        .next()
        .await
        .ok_or_else(|| "No server info received".to_string())?
        .map_err(|e| format!("Server info error: {}", e))?;

    let schema_version = if let Message::Text(ref text) = server_info {
        let info: serde_json::Value = serde_json::from_str(text).unwrap_or_default();
        info["schema_version"].as_u64().unwrap_or(28)
    } else {
        28
    };

    // Authenticate with schema_version so the server keeps the connection open.
    let auth_msg = serde_json::json!({
        "command": "auth",
        "args": { "token": token },
        "message_id": "auth",
        "schema_version": schema_version,
    });
    write
        .send(Message::Text(auth_msg.to_string().into()))
        .await
        .map_err(|e| format!("Failed to send auth: {}", e))?;

    // Wait for auth response.
    if let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                let resp: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
                if resp.get("error_code").is_some() {
                    return Err(format!("Auth failed: {}", text));
                }
            }
            Ok(_) => {}
            Err(e) => return Err(format!("Auth response error: {}", e)),
        }
    }

    // Reunite the split stream — events will arrive automatically.
    let ws_stream = read.reunite(write).expect("reunite should succeed");
    Ok(ws_stream)
}

/// Events that trigger a state refresh.
const RELEVANT_EVENTS: &[&str] = &["player_updated", "queue_updated", "queue_time_updated"];

/// SSE handler: connects to MA WebSocket and streams state updates to the client.
pub async fn events(
    State(pool): State<SqlitePool>,
) -> Result<impl axum::response::IntoResponse, AppError> {
    // Read config up front to fail fast if misconfigured.
    let config = IntegrationConfig::new(&pool, "music");
    let service_url = config.get("service_url").await?;
    let token = config.get("api_token").await?;
    let ws_url = ws_url_from_service_url(&service_url);

    // Fetch initial state before returning the SSE stream.
    let initial_state = fetch_full_state(&pool).await?;

    let (tx, rx) = mpsc::channel::<Event>(64);

    // Send initial state snapshot.
    let initial_json = serde_json::to_string(&initial_state).unwrap_or_else(|_| "{}".to_string());
    let _ = tx
        .send(Event::default().event("state").data(initial_json))
        .await;

    // Spawn background task to read WS and feed events into the channel.
    tokio::spawn(ws_relay_loop(pool.clone(), ws_url, token, tx));

    // Convert the mpsc receiver into an SSE-compatible stream.
    let stream =
        tokio_stream::wrappers::ReceiverStream::new(rx).map(|event| Ok::<_, Infallible>(event));

    let sse = Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keepalive"),
    );

    // Headers to prevent nginx/reverse proxies from buffering the SSE stream
    Ok((
        [
            (axum::http::header::CACHE_CONTROL, "no-cache"),
            (
                axum::http::header::HeaderName::from_static("x-accel-buffering"),
                "no",
            ),
        ],
        sse,
    ))
}

/// Background loop: maintain a WebSocket connection to MA and relay events.
async fn ws_relay_loop(pool: SqlitePool, ws_url: String, token: String, tx: mpsc::Sender<Event>) {
    let mut backoff = Duration::from_secs(1);
    let max_backoff = Duration::from_secs(30);

    loop {
        match connect_and_auth(&ws_url, &token).await {
            Ok(ws_stream) => {
                tracing::info!("Connected to MA WebSocket at {}", ws_url);
                backoff = Duration::from_secs(1); // Reset backoff on successful connect.

                let (_write, mut read) = ws_stream.split();

                loop {
                    match read.next().await {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&text) {
                                let event_type = msg["event"].as_str().unwrap_or("");

                                if RELEVANT_EVENTS.contains(&event_type) {
                                    match fetch_full_state(&pool).await {
                                        Ok(state) => {
                                            let json = serde_json::to_string(&state)
                                                .unwrap_or_else(|_| "{}".to_string());
                                            let event = Event::default().event("state").data(json);
                                            if tx.send(event).await.is_err() {
                                                tracing::debug!("SSE client disconnected");
                                                return;
                                            }
                                        }
                                        Err(e) => {
                                            tracing::warn!("Failed to fetch MA state: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                        Some(Ok(Message::Close(_))) | None => {
                            tracing::warn!("MA WebSocket closed");
                            break;
                        }
                        Some(Ok(_)) => {
                            // Ignore ping/pong/binary frames.
                        }
                        Some(Err(e)) => {
                            tracing::warn!("MA WebSocket error: {}", e);
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to connect to MA WebSocket: {}", e);
            }
        }

        // If the SSE client has disconnected, stop trying to reconnect.
        if tx.is_closed() {
            tracing::debug!("SSE channel closed, stopping WS relay");
            return;
        }

        tracing::info!("Reconnecting to MA WebSocket in {:?}...", backoff);
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(max_backoff);
    }
}
