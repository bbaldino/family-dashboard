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
pub(super) fn rewrite_image_urls(value: &mut serde_json::Value, service_url: &str) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, val) in map.iter_mut() {
                if (key == "image" || key == "image_url" || key == "imageUrl") && val.is_string() {
                    if let Some(proxied) =
                        val.as_str().and_then(|u| proxied_image_url(u, service_url))
                    {
                        *val = serde_json::Value::String(proxied);
                    }
                } else {
                    rewrite_image_urls(val, service_url);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                rewrite_image_urls(item, service_url);
            }
        }
        _ => {}
    }
}

/// The path an image should be loaded from, or `None` when it can load as-is.
/// Only plain-http images need our proxy (mixed content); https is fine.
///
/// MA's own `/imageproxy` URLs are built on MA's base address, which need not
/// match `music.service_url` textually (an IP vs `music.home`) even though
/// it is the same server — and the proxy only forwards URLs under the
/// configured service. Such a URL is rebased onto `service_url` first.
pub(super) fn proxied_image_url(url: &str, service_url: &str) -> Option<String> {
    if !url.starts_with("http://") {
        return None;
    }
    let rebased = url::Url::parse(url)
        .ok()
        .filter(|u| u.path().starts_with("/imageproxy"))
        .map(|u| {
            let query = u.query().map(|q| format!("?{q}")).unwrap_or_default();
            format!("{}{}{}", service_url.trim_end_matches('/'), u.path(), query)
        });
    let target = rebased.as_deref().unwrap_or(url);
    Some(format!(
        "/api/music/image?url={}",
        urlencoding::encode(target)
    ))
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
/// to it, leaving the rest of the queue in place, so a fresh pick would play
/// over a stale queue. MA's `replace` clears the queue first. Map the app's
/// `play` (and the default) to `replace`; the enqueue-without-replacing modes
/// pass through. (How radio rides on top of this is `play_plan`.)
fn ma_enqueue_option(mode: Option<&str>) -> &'static str {
    match mode {
        Some("next") => "next",
        Some("add") => "add",
        Some("replace_next") => "replace_next",
        _ => "replace",
    }
}

/// One MA `player_queues/play_media` call: what to enqueue, and how.
#[derive(Debug, PartialEq)]
struct PlayMediaCall {
    media: String,
    option: &'static str,
}

/// The `play_media` calls a play request becomes.
#[derive(Debug, PartialEq)]
enum PlayPlan {
    /// No radio: enqueue the item as asked.
    Plain(PlayMediaCall),
    /// Radio from a track: play the chosen track on its own first, then add
    /// the station behind it. MA 2.10 recency-gates a radio pool, so a seed
    /// played recently was dropped and the station started elsewhere; playing
    /// it explicitly keeps the user's pick first whatever the pool decides.
    TrackThenRadio {
        track: PlayMediaCall,
        radio: PlayMediaCall,
    },
    /// Radio from an album/artist/playlist: start the station itself — there
    /// is no single chosen song to put first — with a plain play of the item
    /// as the fallback.
    Radio {
        radio: PlayMediaCall,
        fallback: PlayMediaCall,
    },
}

/// MA 2.10's endless-mix radio for an item. Replaces the deprecated
/// `radio_mode` flag, which MA now rewrites into this URI anyway.
fn radio_playlist_uri(uri: &str) -> String {
    format!("radio_playlist://playlist/{uri}")
}

/// Plan the `play_media` calls for a request. Radio applies only to a fresh
/// pick (the app's "play", MA's `replace`): adding a station onto an existing
/// queue would replace its upcoming tail with the station's pool.
fn play_plan(
    uri: &str,
    media_type: Option<&str>,
    radio: bool,
    enqueue_mode: Option<&str>,
) -> PlayPlan {
    let option = ma_enqueue_option(enqueue_mode);
    let item = PlayMediaCall {
        media: uri.to_string(),
        option,
    };
    if !radio || option != "replace" {
        return PlayPlan::Plain(item);
    }
    let is_track = match media_type {
        Some(t) => t == "track",
        None => uri.contains("://track/"),
    };
    if is_track {
        PlayPlan::TrackThenRadio {
            track: item,
            radio: PlayMediaCall {
                media: radio_playlist_uri(uri),
                option: "add",
            },
        }
    } else {
        PlayPlan::Radio {
            radio: PlayMediaCall {
                media: radio_playlist_uri(uri),
                option: "replace",
            },
            fallback: item,
        }
    }
}

/// Carry out a plan through `send` (one `play_media` call each). A station
/// that can't be built never costs the user their pick: after a track radio's
/// track is playing, a failed station step is only logged; a refused
/// album/artist station falls back to playing the item plainly.
async fn run_play_plan<F, Fut>(plan: PlayPlan, mut send: F) -> Result<(), AppError>
where
    F: FnMut(PlayMediaCall) -> Fut,
    Fut: std::future::Future<Output = Result<(), AppError>>,
{
    match plan {
        PlayPlan::Plain(call) => send(call).await,
        PlayPlan::TrackThenRadio { track, radio } => {
            send(track).await?;
            let media = radio.media.clone();
            if let Err(err) = send(radio).await {
                tracing::warn!("adding the radio station failed ({err}); playing {media} alone");
            }
            Ok(())
        }
        PlayPlan::Radio { radio, fallback } => match send(radio).await {
            Ok(()) => Ok(()),
            Err(err) => {
                tracing::warn!(
                    "starting the radio station failed ({err}); playing {} plainly",
                    fallback.media
                );
                send(fallback).await
            }
        },
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

    let plan = play_plan(
        &req.uri,
        req.media_type.as_deref(),
        req.radio == Some(true),
        req.enqueue_mode.as_deref(),
    );
    run_play_plan(plan, |c: PlayMediaCall| {
        client.command_void(
            "player_queues/play_media",
            serde_json::json!({ "queue_id": queue_id, "media": c.media, "option": c.option }),
        )
    })
    .await?;

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
    rewrite_image_urls(&mut data, client.base_url());
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
    rewrite_image_urls(&mut data, client.base_url());
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
    rewrite_image_urls(&mut data, client.base_url());
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

    /// Live capture, 2026-09-30: MA builds `/imageproxy` URLs on its own base
    /// address (an IP), while `music.service_url` names it `music.home`. The
    /// image proxy only forwards URLs under the configured service, so the
    /// same server's art was refused until rebased.
    #[test]
    fn an_ma_imageproxy_url_is_rebased_onto_the_configured_service() {
        let url = "http://192.168.1.220:8095/imageproxy/5e9932723bc2c671fe8e4ec1a0b6fcf0b9c9dbb255ecdee73b53f7d91bac6cfb?size=512&fmt=jpg";
        assert_eq!(
            proxied_image_url(url, "http://music.home:8095").as_deref(),
            Some(
                "/api/music/image?url=http%3A%2F%2Fmusic.home%3A8095%2Fimageproxy%2F5e9932723bc2c671fe8e4ec1a0b6fcf0b9c9dbb255ecdee73b53f7d91bac6cfb%3Fsize%3D512%26fmt%3Djpg"
            )
        );
    }

    /// Other plain-http images are proxied unchanged (the proxy's own check
    /// decides what it will fetch); https images need no proxy at all.
    #[test]
    fn other_images_are_proxied_as_is_or_left_alone() {
        assert_eq!(
            proxied_image_url(
                "http://music.home:8095/some/art.jpg",
                "http://music.home:8095"
            )
            .as_deref(),
            Some("/api/music/image?url=http%3A%2F%2Fmusic.home%3A8095%2Fsome%2Fart.jpg")
        );
        assert_eq!(
            proxied_image_url("https://i.scdn.co/image/abc", "http://music.home:8095"),
            None
        );
    }

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
        // into the existing queue, leaving its stale tail in place.
        assert_eq!(ma_enqueue_option(Some("play")), "replace");
        assert_eq!(ma_enqueue_option(None), "replace");
    }

    #[test]
    fn enqueue_without_replacing_modes_pass_through() {
        assert_eq!(ma_enqueue_option(Some("next")), "next");
        assert_eq!(ma_enqueue_option(Some("add")), "add");
    }

    const TRACK: &str = "spotify--yC8brUbw://track/5QLHGv0DfpeXLNFo7SFEy1";
    const ALBUM: &str = "spotify--yC8brUbw://album/1HHsUi7OKkS4ySwvc3QaH1";

    fn call(media: &str, option: &'static str) -> PlayMediaCall {
        PlayMediaCall {
            media: media.to_string(),
            option,
        }
    }

    /// MA 2.10 recency-gates a radio pool, so a seed played recently was
    /// dropped and the station started elsewhere ("1979" on 2026-10-04). The
    /// chosen track now plays on its own first, and the station is added
    /// behind it.
    #[test]
    fn a_track_radio_plays_the_track_then_adds_the_station_behind_it() {
        assert_eq!(
            play_plan(TRACK, Some("track"), true, None),
            PlayPlan::TrackThenRadio {
                track: call(TRACK, "replace"),
                radio: call(&format!("radio_playlist://playlist/{TRACK}"), "add"),
            }
        );
    }

    #[test]
    fn a_track_is_recognised_from_its_uri_when_no_media_type_is_sent() {
        assert!(matches!(
            play_plan(TRACK, None, true, None),
            PlayPlan::TrackThenRadio { .. }
        ));
    }

    /// Album and artist radio have no single chosen song: start the station
    /// itself, falling back to playing the item plainly if MA refuses it.
    #[test]
    fn an_album_radio_starts_the_station_with_a_plain_fallback() {
        assert_eq!(
            play_plan(ALBUM, Some("album"), true, None),
            PlayPlan::Radio {
                radio: call(&format!("radio_playlist://playlist/{ALBUM}"), "replace"),
                fallback: call(ALBUM, "replace"),
            }
        );
    }

    #[test]
    fn without_radio_or_when_enqueueing_it_is_one_plain_call() {
        assert_eq!(
            play_plan(TRACK, Some("track"), false, None),
            PlayPlan::Plain(call(TRACK, "replace"))
        );
        // Radio only applies to a fresh pick: a dynamic pool added onto an
        // existing queue would replace its upcoming tail.
        assert_eq!(
            play_plan(TRACK, Some("track"), true, Some("add")),
            PlayPlan::Plain(call(TRACK, "add"))
        );
    }

    /// Runs a plan against a fake MA that records each call and fails the
    /// ones whose media is listed in `failing`.
    async fn run(plan: PlayPlan, failing: &[&str]) -> (Result<(), AppError>, Vec<PlayMediaCall>) {
        let sent = std::sync::Mutex::new(Vec::new());
        let result = run_play_plan(plan, |c: PlayMediaCall| {
            let fail = failing.contains(&c.media.as_str());
            sent.lock().unwrap().push(c);
            async move {
                if fail {
                    Err(AppError::Internal("MA refused".to_string()))
                } else {
                    Ok(())
                }
            }
        })
        .await;
        (result, sent.into_inner().unwrap())
    }

    #[tokio::test]
    async fn a_failed_station_step_keeps_the_chosen_track_playing() {
        let radio = format!("radio_playlist://playlist/{TRACK}");
        let (result, sent) = run(play_plan(TRACK, Some("track"), true, None), &[&radio]).await;
        assert!(result.is_ok());
        assert_eq!(sent, vec![call(TRACK, "replace"), call(&radio, "add")]);
    }

    #[tokio::test]
    async fn a_failed_track_step_fails_the_request_without_adding_a_station() {
        let (result, sent) = run(play_plan(TRACK, Some("track"), true, None), &[TRACK]).await;
        assert!(result.is_err());
        assert_eq!(sent, vec![call(TRACK, "replace")]);
    }

    #[tokio::test]
    async fn a_refused_album_station_falls_back_to_a_plain_play() {
        let radio = format!("radio_playlist://playlist/{ALBUM}");
        let (result, sent) = run(play_plan(ALBUM, Some("album"), true, None), &[&radio]).await;
        assert!(result.is_ok());
        assert_eq!(sent, vec![call(&radio, "replace"), call(ALBUM, "replace")]);
    }
}
