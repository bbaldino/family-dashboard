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
use super::routes::proxied_image_url;
use super::types::{QueueState, SseEvent, TrackInfo};

/// Derive the WebSocket URL from the MA service URL.
fn ws_url_from_service_url(service_url: &str) -> String {
    let ws = service_url
        .replace("https://", "wss://")
        .replace("http://", "ws://");
    format!("{}/ws", ws.trim_end_matches('/'))
}

/// Point each queue's current image at where the page should load it from
/// (see `proxied_image_url`).
fn rewrite_image_urls(queues: &mut [QueueState], service_url: &str) {
    for q in queues.iter_mut() {
        if let Some(ref mut item) = q.current_item
            && let Some(proxied) = item
                .image_url
                .as_deref()
                .and_then(|u| proxied_image_url(u, service_url))
        {
            item.image_url = Some(proxied);
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
    rewrite_image_urls(&mut queues, client.base_url());
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

            // MA's player is the source of truth for what is playing now: its
            // `current_media` is MA's own final view — the group leader's for
            // a grouped player, a live external source's own (Spotify
            // Connect), the queue's current item with the queue's clock for
            // MA playback, or a radio stream's live metadata. The queue is
            // only a fallback for the moment between tracks when the player
            // holds no media, or when no player matches.
            let state = player
                .and_then(|p| p["playback_state"].as_str().or_else(|| p["state"].as_str()))
                .or_else(|| q["state"].as_str())
                .unwrap_or("idle")
                .to_string();
            let queue_item = q
                .get("current_item")
                .and_then(|item| track_info_from_current_item(item, q));
            let current_item = match player.map(|p| &p["current_media"]) {
                Some(cm) if has_title(cm) => {
                    let mut info = track_info_from_current_media(cm, state == "playing", now);
                    if same_queue_item(cm, q) {
                        enrich_from_queue_item(&mut info, queue_item);
                    }
                    Some(info)
                }
                _ => queue_item,
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

/// The player behind a queue: the one whose `player_id` is the queue's id,
/// else one whose `active_source` points at it (a grouped follower playing
/// the leader's queue).
fn find_player<'a>(
    players: &'a serde_json::Value,
    queue_id: &str,
) -> Option<&'a serde_json::Value> {
    let players = players.as_array()?;
    players
        .iter()
        .find(|p| p["player_id"].as_str() == Some(queue_id))
        .or_else(|| {
            players
                .iter()
                .find(|p| p["active_source"].as_str() == Some(queue_id))
        })
}

fn has_title(cm: &serde_json::Value) -> bool {
    cm["title"].as_str().is_some_and(|t| !t.is_empty())
}

/// Whether the player's media is the queue's own current item — MA playback
/// rather than an external source or a stale leftover queue.
fn same_queue_item(cm: &serde_json::Value, q: &serde_json::Value) -> bool {
    let id = cm["queue_item_id"].as_str();
    id.is_some() && id == q["current_item"]["queue_item_id"].as_str()
}

/// `current_media` carries no year, label, track number or source; take them
/// from the queue item it was built from.
fn enrich_from_queue_item(info: &mut TrackInfo, queue_item: Option<TrackInfo>) {
    if let Some(item) = queue_item {
        info.year = item.year;
        info.label = item.label;
        info.track_number = item.track_number;
        info.source = item.source;
    }
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

/// Build a `TrackInfo` from a player's `current_media` — MA's final view of
/// what the player is playing. It has no year/label/track_number/source (see
/// `enrich_from_queue_item`). Callers check `has_title` first.
///
/// The position is `current_media`'s own snapshot, aged forward to `now` only
/// while `playing` (a paused snapshot is where playback stopped).
fn track_info_from_current_media(cm: &serde_json::Value, playing: bool, now: i64) -> TrackInfo {
    TrackInfo {
        name: cm["title"].as_str().unwrap_or("").to_string(),
        artist: cm["artist"].as_str().unwrap_or("").to_string(),
        album: cm["album"].as_str().map(String::from),
        image_url: cm["image_url"].as_str().map(String::from),
        duration: cm["duration"].as_f64().map(|d| d as i64),
        elapsed: cm["elapsed_time"].as_f64().map(|elapsed_time| {
            let last_updated = cm["elapsed_time_last_updated"]
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
    }
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

    /// An idle player stays idle, whatever its queue says.
    #[test]
    fn an_idle_player_reads_idle() {
        let (players, queues) = connect_on_ma_2_10("idle");
        assert_eq!(build_queue_states(&players, &queues, 0)[0].state, "idle");
    }

    /// Live capture, 2026-09-29: the player streams Spotify Connect while its
    /// queue still holds 25 leftover items from earlier MA playback, current
    /// item "Go". The leftover has a real artist, which is what used to win.
    #[test]
    fn a_stale_leftover_queue_never_names_the_song() {
        let (players, mut queues) = connect_on_ma_2_10("playing");
        queues[0]["items"] = serde_json::json!(25);
        queues[0]["current_item"] = serde_json::json!({
            "queue_item_id": "c1f0",
            "name": "The Chemical Brothers/Q-Tip - Go",
            "duration": 260,
            "media_item": {
                "name": "Go",
                "artists": [{ "name": "The Chemical Brothers" }],
                "album": { "name": "Born in the Echoes", "year": 2015 },
                "track_number": 3
            }
        });
        let states = build_queue_states(&players, &queues, CONNECT_TRACK_START + 30);
        let info = states[0].current_item.as_ref().expect("expected a track");
        assert_eq!(info.name, "Linger - Remastered 2026");
        assert_eq!(info.artist, "The Cranberries");
        assert_eq!(info.duration, Some(274));
        assert_eq!(info.elapsed, Some(30));
        // Not the leftover item's credits either.
        assert_eq!(info.year, None);
        assert_eq!(info.track_number, None);
    }

    /// MA playback: MA builds `current_media` from the queue's current item
    /// (same `queue_item_id`), so the player names the song and the queue item
    /// fills in the credits `current_media` lacks.
    #[test]
    fn ma_playback_takes_credits_from_the_matching_queue_item() {
        let players = serde_json::json!([
            {
                "player_id": "kitchen",
                "playback_state": "playing",
                "active_source": "kitchen",
                "current_media": {
                    "uri": "spotify--yC8brUbw://track/2LGdO5MtFdyphi2EihANZG",
                    "title": "Knee Socks",
                    "artist": "Arctic Monkeys",
                    "album": "AM",
                    "duration": 257,
                    "queue_item_id": "qi-1",
                    "elapsed_time": 40,
                    "elapsed_time_last_updated": 1_800_000_000
                }
            }
        ]);
        let queues = serde_json::json!([
            {
                "queue_id": "kitchen",
                "display_name": "Kitchen",
                "state": "playing",
                "current_item": {
                    "queue_item_id": "qi-1",
                    "media_item": {
                        "name": "Knee Socks",
                        "artists": [{ "name": "Arctic Monkeys" }],
                        "album": { "name": "AM", "year": 2013 },
                        "track_number": 11,
                        "provider": "spotify--yC8brUbw"
                    }
                }
            }
        ]);
        let states = build_queue_states(&players, &queues, 1_800_000_010);
        let info = states[0].current_item.as_ref().expect("expected a track");
        assert_eq!(info.name, "Knee Socks");
        assert_eq!(info.elapsed, Some(50));
        assert_eq!(info.year, Some(2013));
        assert_eq!(info.track_number, Some(11));
        assert_eq!(info.source.as_deref(), Some("spotify--yC8brUbw"));
    }

    /// Between tracks MA's player holds no media; the queue item fills in.
    #[test]
    fn with_no_player_media_the_queue_item_fills_in() {
        let (mut players, mut queues) = connect_on_ma_2_10("playing");
        players[0]["current_media"] = serde_json::Value::Null;
        queues[0]["current_item"] = serde_json::json!({
            "media_item": { "name": "Next Up", "artists": [{ "name": "Someone" }] }
        });
        let states = build_queue_states(&players, &queues, 0);
        let info = states[0].current_item.as_ref().expect("expected a track");
        assert_eq!(info.name, "Next Up");
    }

    /// A grouped follower also points its `active_source` at the leader's
    /// queue; the queue's own player (the leader) is the one to read.
    #[test]
    fn the_queues_own_player_beats_a_grouped_follower() {
        let players = serde_json::json!([
            { "player_id": "deck", "active_source": "kitchen", "playback_state": "paused",
              "volume_level": 10, "current_media": null },
            { "player_id": "kitchen", "active_source": "kitchen", "playback_state": "playing",
              "volume_level": 40,
              "current_media": { "title": "Leader Song", "artist": "A" } }
        ]);
        let queues = serde_json::json!([
            { "queue_id": "kitchen", "display_name": "Kitchen", "state": "playing" }
        ]);
        let states = build_queue_states(&players, &queues, 0);
        assert_eq!(states[0].state, "playing");
        assert_eq!(states[0].volume_level, Some(40));
        assert_eq!(
            states[0].current_item.as_ref().map(|i| i.name.as_str()),
            Some("Leader Song")
        );
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
}
