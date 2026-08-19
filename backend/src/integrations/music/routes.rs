use axum::Json;
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::browse;
use super::proxy::MaClient;
use super::types::{
    GroupRequest, ImageProxyQuery, PlayRequest, QueueCommand, SearchQuery, UngroupRequest,
    VolumeRequest,
};

/// Whether an explicit play's request already carries enough to skip the
/// URI-enrichment lookup. True the moment the client supplied either URI —
/// a play from search, an artist page, or an album page always does (an
/// album play only ever has `artist_uri`, since an album has no `album_uri`
/// of its own — that's still "supplied", not a gap). False only when the
/// client gave neither, the common case for a quick-dial replay of a row
/// that itself started null.
fn client_supplied_uris(artist_uri: &Option<String>, album_uri: &Option<String>) -> bool {
    artist_uri.is_some() || album_uri.is_some()
}

#[derive(serde::Deserialize)]
pub struct TopTracksQuery {
    pub limit: Option<i64>,
}

pub async fn top_tracks(
    State(pool): State<SqlitePool>,
    Query(params): Query<TopTracksQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(20);
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            i64,
            i64,
        ),
    >(
        "SELECT uri, name, artist, album, image_url, artist_uri, album_uri, \
                COUNT(*) as play_count, MAX(played_at) as last_played \
         FROM music_explicit_play_log \
         GROUP BY uri \
         ORDER BY play_count DESC, last_played DESC \
         LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&pool)
    .await?;

    let items: Vec<serde_json::Value> = rows
        .into_iter()
        .map(
            |(
                uri,
                name,
                artist,
                album,
                image_url,
                artist_uri,
                album_uri,
                play_count,
                last_played,
            )| {
                serde_json::json!({
                    "uri": uri,
                    "name": name,
                    "artist": artist,
                    "album": album,
                    "image_url": image_url,
                    "artist_uri": artist_uri,
                    "album_uri": album_uri,
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
pub(super) fn rewrite_image_urls(value: &mut serde_json::Value) {
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

/// Translate the app's enqueue intent (`EnqueueMode` in `music-context.ts`) to a
/// Music Assistant queue option.
///
/// The app's `play` means "replace the queue and start now." MA's *own* `play`
/// option does not do that: it inserts the item after the current one and jumps
/// to it, leaving the rest of the queue in place — and with `radio_mode` it
/// never enters dynamic mode, so the queue keeps its `radio_source` but
/// `is_dynamic` stays false and playback stops after the seed instead of
/// continuing the station. MA's `replace` clears the queue and, for a radio
/// seed, starts a continuous dynamic station. Map the app's `play` (and the
/// default) to `replace`; the enqueue-without-replacing modes pass through.
fn ma_enqueue_option(mode: Option<&str>) -> &'static str {
    match mode {
        Some("next") => "next",
        Some("add") => "add",
        Some("replace_next") => "replace_next",
        _ => "replace",
    }
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

    // The app's "play" means "replace the queue and start now" (music-context.ts).
    // `ma_enqueue_option` maps it to MA's "replace" — not MA's own "play", which
    // only inserts and never engages radio's dynamic mode.
    let option = ma_enqueue_option(req.enqueue_mode.as_deref());

    let args = |radio: bool| {
        let mut args = serde_json::json!({
            "queue_id": queue_id,
            "media": req.uri,
            "option": option,
        });
        if radio {
            args["radio_mode"] = serde_json::Value::Bool(true);
        }
        args
    };

    let wants_radio = req.radio == Some(true);
    let result = client
        .command_void("player_queues/play_media", args(wants_radio))
        .await;

    // Radio mode asks MA to seed a station from the chosen item, which it can
    // only do via a provider that supports `similar_tracks`. Spotify is the
    // only such provider here, it advertises the feature, and the call fails
    // anyway — verified against this instance (MA 2.9.10): the identical
    // request returns 200 without `radio_mode` and 500 with it, rejected in
    // ~45ms. So a plain tap on a track, which always asks for radio, could
    // never play anything.
    //
    // Falling back rather than dropping radio outright: when the station can
    // be built the user gets it, and when it can't they still get the track
    // they asked for, instead of silence. If provider support is restored,
    // this quietly stops firing.
    match result {
        Ok(()) => {}
        Err(err) if wants_radio => {
            tracing::warn!(
                "play_media with radio_mode failed ({err}); retrying without radio for {}",
                req.uri
            );
            client
                .command_void("player_queues/play_media", args(false))
                .await?;
        }
        Err(err) => return Err(err),
    }

    // Log the explicit selection so Recently Played reflects what the user
    // actually chose, not whatever ESPN/MA auto-advanced to next.
    //
    // If the client already supplied artist_uri/album_uri, trust those and
    // skip the lookup. Otherwise this is very often a quick-dial replay of a
    // row that itself started with null URIs — without resolving them here,
    // that null just propagates forward through every future replay. One MA
    // round-trip per explicit play (a user action, not a render) is an
    // acceptable cost; playback has already been kicked off above, so the
    // lookup can't delay it.
    let (artist_uri, album_uri) = if client_supplied_uris(&req.artist_uri, &req.album_uri) {
        (req.artist_uri.clone(), req.album_uri.clone())
    } else {
        let media_type = req.media_type.as_deref().unwrap_or("");
        browse::resolve_play_log_uris(&client, &req.uri, media_type).await
    };

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
    .bind(&artist_uri)
    .bind(&album_uri)
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
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            i64,
        ),
    >(
        "SELECT uri, media_type, name, artist, album, image_url, artist_uri, album_uri, \
                MAX(played_at) as last_played \
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
            |(
                uri,
                media_type,
                name,
                artist,
                album,
                image_url,
                artist_uri,
                album_uri,
                last_played,
            )| {
                serde_json::json!({
                    "uri": uri,
                    "media_type": media_type,
                    "name": name,
                    "artist": artist,
                    "album": album,
                    "image_url": image_url,
                    "artist_uri": artist_uri,
                    "album_uri": album_uri,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_supplied_uris_true_when_artist_uri_present() {
        assert!(client_supplied_uris(
            &Some("spotify--x://artist/1".to_string()),
            &None
        ));
    }

    /// Either URI alone counts as "supplied" — e.g. an album play only ever
    /// carries artist_uri (an album has no album_uri of its own), which is
    /// still a real value the client gave us, not a gap to fill.
    #[test]
    fn client_supplied_uris_true_when_only_album_uri_present() {
        assert!(client_supplied_uris(
            &None,
            &Some("spotify--x://album/1".to_string())
        ));
    }

    #[test]
    fn client_supplied_uris_false_when_neither_present() {
        assert!(!client_supplied_uris(&None, &None));
    }

    #[test]
    fn play_maps_to_ma_replace_so_a_fresh_pick_clears_the_queue() {
        // The app's "play" is "replace and start"; MA's own "play" would insert
        // into the existing queue and never engage radio's dynamic mode.
        assert_eq!(ma_enqueue_option(Some("play")), "replace");
        assert_eq!(ma_enqueue_option(None), "replace");
    }

    #[test]
    fn enqueue_without_replacing_modes_pass_through() {
        assert_eq!(ma_enqueue_option(Some("next")), "next");
        assert_eq!(ma_enqueue_option(Some("add")), "add");
    }
}
