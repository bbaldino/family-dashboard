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

/// Rewrite HTTP image URLs in queue states to use the backend proxy.
/// HTTPS URLs are left as-is since they don't cause mixed content issues.
fn rewrite_image_urls(queues: &mut [QueueState]) {
    for q in queues.iter_mut() {
        if let Some(ref mut item) = q.current_item
            && let Some(ref url) = item.image_url
            && url.starts_with("http://")
        {
            item.image_url = Some(proxy_image_url(url));
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

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let mut queues = build_queue_states(&players, &queues_raw, now);
    rewrite_image_urls(&mut queues);
    Ok(SseEvent::State { queues })
}

/// Transform MA's raw players + queues JSON into our simplified QueueState list.
/// `now` (unix seconds) ages the external-source elapsed snapshot forward.
fn build_queue_states(
    players: &serde_json::Value,
    queues: &serde_json::Value,
    now: i64,
) -> Vec<QueueState> {
    let empty = vec![];
    let queue_arr = queues.as_array().unwrap_or(&empty);

    queue_arr
        .iter()
        .map(|q| {
            let queue_id = q["queue_id"].as_str().unwrap_or("").to_string();
            let display_name = q["display_name"].as_str().unwrap_or("Unknown").to_string();
            let player = find_player(players, &queue_id);
            let state = queue_state(q, player);

            let current_item = q
                .get("current_item")
                .and_then(|item| track_info_from_current_item(item, q));

            // External-source playback (e.g. MA's Spotify Connect plugin) leaves
            // the queue's current_item as a generic placeholder with no artist
            // (media_item.name == "Spotify Connect", artists == []). The real
            // metadata lives on the associated player's current_media, so fall
            // back to that when current_item is absent or artist-less.
            let current_item = match current_item {
                Some(ref info) if !info.artist.is_empty() => current_item,
                _ => player
                    .and_then(|p| p.get("current_media"))
                    .and_then(|cm| {
                        // An idle queue's clock is frozen (MA 2.10), so a
                        // player-driven stream reads its own snapshot.
                        let clock = if player_driven_state(q, player).is_some() {
                            cm
                        } else {
                            q
                        };
                        track_info_from_current_media(cm, clock, state == "playing", now)
                    })
                    .or(current_item),
            };

            let volume_level = player
                .and_then(|p| p["volume_level"].as_f64())
                .map(|v| v as i32);

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

/// Build a `TrackInfo` from a queue's raw `current_item` JSON (and its
/// parent queue object, for the `elapsed_time` fallback). Returns `None` if
/// `current_item` is null/absent — an idle queue has no current track.
///
/// Every field beyond name/artist is absent-tolerant: MA's payload shape
/// varies by provider, so a local file may carry none of year/label/
/// track_number/source while a Spotify track carries all of them.
fn track_info_from_current_item(
    item: &serde_json::Value,
    q: &serde_json::Value,
) -> Option<TrackInfo> {
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
        image_url: media_item["metadata"]["images"]
            .as_array()
            .and_then(|imgs| imgs.first())
            .and_then(|img| img["path"].as_str())
            .or_else(|| {
                media_item["image"]
                    .as_object()
                    .and_then(|img| img.get("path").or_else(|| img.get("url")))
                    .and_then(|u| u.as_str())
            })
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
        uri: media_item["uri"].as_str().map(String::from),
        year: media_item["album"]["year"].as_i64(),
        label: media_item["metadata"]["label"].as_str().map(String::from),
        track_number: media_item["track_number"].as_i64(),
        source: media_item["provider"].as_str().map(String::from),
    })
}

/// The player behind a queue: the one whose `player_id` is the queue's id, or
/// whose `active_source` points at it (a grouped follower playing the
/// leader's queue).
fn find_player<'a>(
    players: &'a serde_json::Value,
    queue_id: &str,
) -> Option<&'a serde_json::Value> {
    players.as_array()?.iter().find(|player| {
        player["active_source"].as_str() == Some(queue_id)
            || player["player_id"].as_str() == Some(queue_id)
    })
}

/// A queue's playback state, corrected for external-source playback. Under
/// Spotify Connect (MA 2.10+) Spotify owns the queue, so MA's own queue reads
/// `idle` while its player is playing a track it was handed — the player's
/// `playback_state` is then the truth. An idle queue only defers to a player
/// that actually holds media, so a genuinely idle player stays idle.
fn queue_state(q: &serde_json::Value, player: Option<&serde_json::Value>) -> String {
    player_driven_state(q, player)
        .unwrap_or_else(|| q["state"].as_str().unwrap_or("idle"))
        .to_string()
}

/// The player's state when it, not MA's queue, is driving playback: the
/// queue is idle but the player holds media and is playing or paused.
fn player_driven_state<'a>(
    q: &serde_json::Value,
    player: Option<&'a serde_json::Value>,
) -> Option<&'a str> {
    if q["state"].as_str().unwrap_or("idle") != "idle" {
        return None;
    }
    player
        .filter(|p| !p["current_media"].is_null())
        .and_then(|p| p["playback_state"].as_str().or_else(|| p["state"].as_str()))
        .filter(|s| matches!(*s, "playing" | "paused"))
}

/// Age an elapsed-time snapshot forward to "now". MA's `elapsed_time` is a
/// point-in-time snapshot taken at
/// `elapsed_time_last_updated` (unix seconds), not a live clock, so the true
/// current elapsed is the snapshot plus however long has passed since. Pure
/// and clamped to `[0, duration]` when the duration is known.
fn live_elapsed(
    elapsed_time: f64,
    last_updated: Option<i64>,
    duration: Option<f64>,
    now: i64,
) -> i64 {
    let raw = match last_updated {
        Some(ts) => elapsed_time + (now - ts).max(0) as f64,
        None => elapsed_time,
    };
    let clamped = match duration {
        Some(d) => raw.clamp(0.0, d.max(0.0)),
        None => raw.max(0.0),
    };
    clamped as i64
}

/// Build a `TrackInfo` from a player's `current_media` field. This is the
/// fallback source for external-source playback (e.g. MA's Spotify Connect
/// plugin), where the queue's `current_item` is only a generic placeholder
/// and the real track metadata lives here instead. Unlike a queue's
/// `current_item`, `current_media` has no year/label/track_number/source, so
/// those are always `None`. Returns `None` if `title` is absent or empty.
///
/// Elapsed comes from `clock`, which the caller picks by who drives playback:
/// - The queue (MA 2.9, where a Connect queue reads playing): there, at a
///   track change MA emitted `player_updated` with the new title but the
///   previous track's position on `current_media`, then silently reset it,
///   so only the queue's `elapsed_time` was right throughout.
/// - `current_media` itself (MA 2.10, where the queue sits idle): the idle
///   queue's clock is frozen, while the player's snapshot resets cleanly at
///   each track change.
///
/// `playing` gates aging the snapshot forward to `now`.
fn track_info_from_current_media(
    cm: &serde_json::Value,
    clock: &serde_json::Value,
    playing: bool,
    now: i64,
) -> Option<TrackInfo> {
    let name = cm["title"].as_str().unwrap_or("");
    if name.is_empty() {
        return None;
    }
    Some(TrackInfo {
        name: name.to_string(),
        artist: cm["artist"].as_str().unwrap_or("").to_string(),
        album: cm["album"].as_str().map(String::from),
        image_url: cm["image_url"].as_str().map(String::from),
        duration: cm["duration"].as_f64().map(|d| d as i64),
        elapsed: clock["elapsed_time"].as_f64().map(|elapsed_time| {
            // Stamped in unix seconds (fractional on the queue). Only a
            // playing snapshot is aged: a paused one is where playback stopped.
            let last_updated = clock["elapsed_time_last_updated"]
                .as_f64()
                .map(|t| t as i64)
                .filter(|_| playing);
            live_elapsed(elapsed_time, last_updated, cm["duration"].as_f64(), now)
        }),
        uri: cm["uri"].as_str().map(String::from),
        year: None,
        label: None,
        track_number: None,
        source: None,
    })
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
/// Note: queue_time_updated is excluded — elapsed time is ticked locally on the frontend.
const RELEVANT_EVENTS: &[&str] = &["player_updated", "queue_updated"];

/// SSE handler: connects to MA WebSocket and streams state updates to the client.
pub async fn events(
    State(pool): State<SqlitePool>,
) -> Result<impl axum::response::IntoResponse, AppError> {
    // Read config up front to fail fast if misconfigured.
    let config = IntegrationConfig::new(&pool, "music");
    let service_url = config.get("service_url").await?;
    let token = config.get("api_token").await?;
    let ws_url = ws_url_from_service_url(&service_url);

    let (tx, rx) = mpsc::channel::<Event>(64);

    // Fetch initial state before returning the SSE stream. This is
    // best-effort: a transient MA HTTP hiccup here must not fail the
    // handler, since an `EventSource` that receives an error status on
    // connect closes permanently on the client. `ws_relay_loop` will push a
    // fresh snapshot once it connects, so a skipped snapshot here is
    // recovered from shortly after.
    match fetch_full_state(&pool).await {
        Ok(initial_state) => {
            let initial_json =
                serde_json::to_string(&initial_state).unwrap_or_else(|_| "{}".to_string());
            let _ = tx
                .send(Event::default().event("state").data(initial_json))
                .await;
        }
        Err(e) => {
            tracing::warn!("Failed to fetch initial MA state: {}", e);
        }
    }

    // Spawn background task to read WS and feed events into the channel.
    tokio::spawn(ws_relay_loop(pool.clone(), ws_url, token, tx));

    // Convert the mpsc receiver into an SSE-compatible stream.
    let stream = tokio_stream::wrappers::ReceiverStream::new(rx).map(Ok::<_, Infallible>);

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

/// Log a track play to the database if it's a new track (different from last seen).
async fn maybe_log_play(pool: &SqlitePool, state: &SseEvent, last_track_uri: &mut Option<String>) {
    let queues = match state {
        SseEvent::State { queues } => queues,
        _ => return,
    };

    // Find the currently playing queue
    let playing = queues.iter().find(|q| q.state == "playing");
    let current_uri = playing
        .and_then(|q| q.current_item.as_ref())
        .and_then(|item| item.uri.clone());

    if current_uri.is_none() || current_uri == *last_track_uri {
        return;
    }
    *last_track_uri = current_uri.clone();

    if let Some(q) = playing
        && let Some(ref item) = q.current_item
        && let Some(ref uri) = item.uri
    {
        let _ = sqlx::query(
                    "INSERT INTO music_play_log (uri, name, artist, album, image_url) VALUES (?, ?, ?, ?, ?)",
                )
                .bind(uri)
                .bind(&item.name)
                .bind(&item.artist)
                .bind(&item.album)
                .bind(&item.image_url)
                .execute(pool)
                .await;
    }
}

/// Background loop: maintain a WebSocket connection to MA and relay events.
async fn ws_relay_loop(pool: SqlitePool, ws_url: String, token: String, tx: mpsc::Sender<Event>) {
    let mut backoff = Duration::from_secs(1);
    let max_backoff = Duration::from_secs(30);
    let mut last_track_uri: Option<String> = None;

    loop {
        match connect_and_auth(&ws_url, &token).await {
            Ok(ws_stream) => {
                tracing::info!("Connected to MA WebSocket at {}", ws_url);
                backoff = Duration::from_secs(1); // Reset backoff on successful connect.

                // Push a fresh snapshot now that we're (re)connected, so the
                // client resyncs any state that changed while the socket was
                // down (including a failed initial fetch in `events()`)
                // without needing a page reload.
                match fetch_full_state(&pool).await {
                    Ok(state) => {
                        maybe_log_play(&pool, &state, &mut last_track_uri).await;
                        let json =
                            serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string());
                        let event = Event::default().event("state").data(json);
                        if tx.send(event).await.is_err() {
                            tracing::debug!("SSE client disconnected");
                            return;
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to fetch MA state on reconnect: {}", e);
                    }
                }

                let (_write, mut read) = ws_stream.split();

                loop {
                    match read.next().await {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&text) {
                                let event_type = msg["event"].as_str().unwrap_or("");

                                if RELEVANT_EVENTS.contains(&event_type) {
                                    match fetch_full_state(&pool).await {
                                        Ok(state) => {
                                            maybe_log_play(&pool, &state, &mut last_track_uri)
                                                .await;
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

#[cfg(test)]
mod tests {
    use super::*;

    /// MA's `elapsed_time` on `current_media` is a snapshot taken at
    /// `elapsed_time_last_updated`; the live helper must age it forward by
    /// however long has passed since.
    #[test]
    fn live_elapsed_ages_the_snapshot_forward_to_now() {
        let last_updated = 1_800_000_000;
        let now = last_updated + 92;
        assert_eq!(live_elapsed(70.0, Some(last_updated), None, now), 162);
    }

    /// A snapshot aged forward past the track's duration clamps to the
    /// duration rather than reporting an elapsed time longer than the track.
    #[test]
    fn live_elapsed_clamps_to_duration() {
        let last_updated = 1_800_000_000;
        let now = last_updated + 1_000;
        assert_eq!(
            live_elapsed(280.0, Some(last_updated), Some(300.0), now),
            300
        );
    }

    /// Without a `last_updated` timestamp there's nothing to age by, so the
    /// raw elapsed value passes through unchanged.
    #[test]
    fn live_elapsed_returns_raw_value_when_last_updated_is_missing() {
        assert_eq!(live_elapsed(211.0, None, Some(290.0), 1_800_000_500), 211);
    }

    /// Clock skew that would put `last_updated` in the future must never
    /// drive the result negative.
    #[test]
    fn live_elapsed_never_goes_negative() {
        let now = 1_800_000_000;
        let last_updated = now + 50; // last_updated is "in the future"
        assert_eq!(live_elapsed(0.0, Some(last_updated), None, now), 0);
    }

    /// Trimmed capture of a real `player_queues/all` entry from
    /// `music.home:8095` — see the fixture file's own `_comment` for what
    /// was dropped and why. `metadata.label` is genuinely `null` here; that
    /// is the common real-world case, not a stand-in for a missing test.
    const REAL_QUEUE_FIXTURE: &str =
        include_str!("../../../tests/fixtures/music_queue_current_item.json");

    #[test]
    fn track_info_from_real_captured_payload() {
        let q: serde_json::Value = serde_json::from_str(REAL_QUEUE_FIXTURE).unwrap();
        let info = track_info_from_current_item(&q["current_item"], &q)
            .expect("fixture has a current_item");

        assert_eq!(info.name, "Knee Socks");
        assert_eq!(info.artist, "Arctic Monkeys");
        assert_eq!(info.album.as_deref(), Some("AM"));
        assert_eq!(
            info.uri.as_deref(),
            Some("spotify--yC8brUbw://track/2LGdO5MtFdyphi2EihANZG")
        );
        assert_eq!(info.duration, Some(257));
        assert_eq!(info.year, Some(2013));
        assert_eq!(info.track_number, Some(11));
        assert_eq!(info.source.as_deref(), Some("spotify--yC8brUbw"));
        // Real, common case: MA hadn't populated a label for this track.
        assert_eq!(info.label, None);
    }

    #[test]
    fn track_info_is_absent_tolerant_when_new_fields_are_missing() {
        // Shaped like a bare-bones provider payload (e.g. some local files)
        // that carries none of the new fields.
        let q = serde_json::json!({
            "current_item": {
                "media_item": {
                    "name": "Some Track",
                    "artists": [{ "name": "Some Artist" }],
                }
            }
        });
        let info =
            track_info_from_current_item(&q["current_item"], &q).expect("current_item present");

        assert_eq!(info.name, "Some Track");
        assert_eq!(info.artist, "Some Artist");
        assert_eq!(info.year, None);
        assert_eq!(info.label, None);
        assert_eq!(info.track_number, None);
        assert_eq!(info.source, None);
    }

    #[test]
    fn track_info_picks_up_label_when_present() {
        // Synthetic: every current_item reachable live during this session
        // had a null label (see the real-payload test above), so this
        // exercises the extraction path with a populated value instead —
        // MA does populate metadata.label for some providers/items (verified
        // via a direct music/albums/get_album call, which returned
        // "Warner Records" for a Muse album).
        let q = serde_json::json!({
            "current_item": {
                "media_item": {
                    "name": "Track",
                    "artists": [{ "name": "Artist" }],
                    "metadata": { "label": "Warner Records" },
                }
            }
        });
        let info =
            track_info_from_current_item(&q["current_item"], &q).expect("current_item present");

        assert_eq!(info.label.as_deref(), Some("Warner Records"));
    }

    #[test]
    fn track_info_from_current_item_returns_none_when_null() {
        let q = serde_json::json!({ "current_item": null });
        assert!(track_info_from_current_item(&q["current_item"], &q).is_none());
    }

    /// External-source playback (e.g. MA's Spotify Connect plugin): the
    /// queue's `current_item` is a generic placeholder
    /// (`media_item.name == "Spotify Connect"`, `artists == []`), but the
    /// associated player's `current_media` carries the real track metadata.
    /// `build_queue_states` must fall back to the player when the queue item
    /// has no real artist.
    #[test]
    fn build_queue_states_falls_back_to_player_current_media_for_external_source() {
        let players = serde_json::json!([
            {
                "player_id": "upb827eb0e4dec",
                "active_source": "upb827eb0e4dec",
                "state": "playing",
                "current_media": {
                    "uri": "spotify_connect--DaDytfpf://audio_source/main",
                    "media_type": "audio_source",
                    "title": "Apocalypse",
                    "artist": "Cigarettes After Sex",
                    "album": "Cigarettes After Sex",
                    "image_url": "https://i.scdn.co/image/ab67616d00001e02dfed999f959177dfc4f33cdc",
                    "duration": 290,
                    "queue_item_id": "7dd0a1ae9f634fb5aff91cbc62e67213"
                }
            }
        ]);
        let queues = serde_json::json!([
            {
                "queue_id": "upb827eb0e4dec",
                "display_name": "Kitchen",
                "state": "playing",
                "items": 1,
                "elapsed_time": 211.0,
                "current_item": { "media_item": { "name": "Spotify Connect", "artists": [] } }
            }
        ]);

        let states = build_queue_states(&players, &queues, 1_800_000_000);
        assert_eq!(states.len(), 1);
        let info = states[0].current_item.as_ref().expect("expected a track");

        assert_eq!(info.name, "Apocalypse");
        assert_eq!(info.artist, "Cigarettes After Sex");
        assert_eq!(info.album.as_deref(), Some("Cigarettes After Sex"));
        assert_eq!(info.duration, Some(290));
        assert_eq!(info.elapsed, Some(211));
        assert_eq!(
            info.uri.as_deref(),
            Some("spotify_connect--DaDytfpf://audio_source/main")
        );
    }

    /// Spotify Connect under MA 2.10, from a live capture on 2026-09-29: Spotify
    /// owns the queue, so MA's queue reads `idle` with no `current_item` while
    /// the player itself is `playing` a track. Reading the queue's state
    /// showed a playing stream as paused.
    const CONNECT_TRACK_START: i64 = 1_790_706_434;

    fn connect_on_ma_2_10(playback_state: &str) -> (serde_json::Value, serde_json::Value) {
        let players = serde_json::json!([
            {
                "player_id": "b8:27:eb:0e:4d:ec",
                "name": "Kitchen",
                "playback_state": playback_state,
                "active_source": "spotify_connect://audio_source/b8:27:eb:0e:4d:ec",
                "current_media": {
                    "uri": "spotify_connect://audio_source/b8:27:eb:0e:4d:ec",
                    "title": "Linger - Remastered 2026",
                    "artist": "The Cranberries",
                    "duration": 274,
                    "elapsed_time": 0,
                    "elapsed_time_last_updated": CONNECT_TRACK_START
                }
            }
        ]);
        let queues = serde_json::json!([
            {
                "queue_id": "b8:27:eb:0e:4d:ec",
                "display_name": "Kitchen",
                "state": "idle",
                "items": 1,
                // Frozen: MA 2.10 stops ticking an idle queue's clock.
                "elapsed_time": 29.18,
                "elapsed_time_last_updated": 1_790_704_499.18,
                "current_item": null
            }
        ]);
        (players, queues)
    }

    #[test]
    fn an_idle_queue_takes_its_players_state_during_external_playback() {
        for playback_state in ["playing", "paused"] {
            let (players, queues) = connect_on_ma_2_10(playback_state);
            let states = build_queue_states(&players, &queues, CONNECT_TRACK_START + 154);
            assert_eq!(states[0].state, playback_state);
            let info = states[0].current_item.as_ref().expect("expected a track");
            assert_eq!(info.name, "Linger - Remastered 2026");
        }
    }

    /// The idle queue's clock is frozen under 2.10 — aging it ran every
    /// Connect track straight to its duration. The position comes from the
    /// player's own snapshot, which resets at each track change (checked
    /// live across a track change on 2026-09-29).
    #[test]
    fn external_playback_takes_its_position_from_the_player() {
        let (players, queues) = connect_on_ma_2_10("playing");
        let states = build_queue_states(&players, &queues, CONNECT_TRACK_START + 154);
        let info = states[0].current_item.as_ref().expect("expected a track");
        assert_eq!(info.elapsed, Some(154));
    }

    /// A paused snapshot is where playback stopped; aging it forward would
    /// run the position on while nothing plays.
    #[test]
    fn a_paused_position_is_not_aged() {
        let (mut players, queues) = connect_on_ma_2_10("paused");
        players[0]["current_media"]["elapsed_time"] = serde_json::json!(80);
        let states = build_queue_states(&players, &queues, CONNECT_TRACK_START + 600);
        let info = states[0].current_item.as_ref().expect("expected a track");
        assert_eq!(info.elapsed, Some(80));
    }

    /// A player that is idle itself, or has nothing loaded, doesn't override
    /// an idle queue — only a player actually holding a track does.
    #[test]
    fn an_idle_queue_stays_idle_without_a_playing_player() {
        let (players, queues) = connect_on_ma_2_10("idle");
        assert_eq!(build_queue_states(&players, &queues, 0)[0].state, "idle");

        let (mut players, queues) = connect_on_ma_2_10("playing");
        players[0]["current_media"] = serde_json::Value::Null;
        assert_eq!(build_queue_states(&players, &queues, 0)[0].state, "idle");
    }

    /// Regression: normal MA playback (the queue's `current_item` carries a
    /// real name/artist) must keep coming from `current_item`, not be
    /// overridden by the player's `current_media` even when both exist and
    /// disagree. This pins the year/track_number fields that only
    /// `current_item` carries.
    #[test]
    fn build_queue_states_prefers_queue_current_item_for_normal_playback() {
        let players = serde_json::json!([
            {
                "player_id": "upb827eb0e4dec",
                "active_source": "upb827eb0e4dec",
                "state": "playing",
                "current_media": {
                    "title": "Some Other Song",
                    "artist": "Some Other Artist",
                }
            }
        ]);
        let queues = serde_json::json!([
            {
                "queue_id": "upb827eb0e4dec",
                "display_name": "Kitchen",
                "state": "playing",
                "items": 1,
                "current_item": {
                    "media_item": {
                        "name": "Knee Socks",
                        "artists": [{ "name": "Arctic Monkeys" }],
                        "album": { "name": "AM", "year": 2013 },
                        "track_number": 11,
                    }
                }
            }
        ]);

        let states = build_queue_states(&players, &queues, 1_800_000_000);
        assert_eq!(states.len(), 1);
        let info = states[0].current_item.as_ref().expect("expected a track");

        assert_eq!(info.name, "Knee Socks");
        assert_eq!(info.artist, "Arctic Monkeys");
        assert_eq!(info.year, Some(2013));
        assert_eq!(info.track_number, Some(11));
    }

    /// Regression, from a live MA WebSocket capture at a Spotify Connect
    /// track change: `player_updated` arrives with the new title but the
    /// previous track's position (346s into a 209s song) on `current_media`,
    /// freshly stamped, while the queue's clock has already reset. The
    /// position must come from the queue, or the progress bar sits at the
    /// end of the song for the whole track.
    #[test]
    fn build_queue_states_takes_external_source_position_from_the_queue_clock() {
        let now = 1_790_470_600;
        let players = serde_json::json!([
            {
                "player_id": "upb827eb0e4dec",
                "active_source": "upb827eb0e4dec",
                "current_media": {
                    "title": "stupid song",
                    "artist": "Some Artist",
                    "duration": 209,
                    "elapsed_time": 346,
                    "elapsed_time_last_updated": now,
                }
            }
        ]);
        let queues = serde_json::json!([
            {
                "queue_id": "upb827eb0e4dec",
                "display_name": "Kitchen",
                "state": "playing",
                "elapsed_time": 1.4789,
                "elapsed_time_last_updated": (now - 10) as f64 + 0.6,
                "current_item": { "media_item": { "name": "Spotify Connect", "artists": [] } }
            }
        ]);

        let states = build_queue_states(&players, &queues, now);
        let info = states[0].current_item.as_ref().expect("expected a track");

        assert_eq!(info.name, "stupid song");
        assert_eq!(info.duration, Some(209));
        assert_eq!(info.elapsed, Some(11));
    }
}
