use axum::Json;
use axum::extract::{Query, State};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use super::proxy::MaClient;
use super::routes::rewrite_image_urls;
use crate::error::AppError;

#[derive(Deserialize)]
pub struct UriQuery {
    pub uri: String,
}

#[derive(Serialize)]
pub struct AlbumSummary {
    pub uri: String,
    pub name: String,
    pub image_url: Option<String>,
    pub year: Option<i64>,
}

/// One entry in a track's full artist credit list, from `artists[]`.
/// `artist`/`artist_uri` on `Track` keep pointing at the first entry so
/// existing consumers (queue tiles, search results) don't have to change;
/// this carries the rest so the album/artist screens can render "feat. X".
#[derive(Serialize)]
pub struct TrackArtist {
    pub name: String,
    pub uri: Option<String>,
}

#[derive(Serialize)]
pub struct Track {
    pub uri: String,
    pub name: String,
    pub artist: Option<String>,
    pub artist_uri: Option<String>,
    /// Full artist credit list, in MA's order. `artist`/`artist_uri` above
    /// duplicate `artists[0]` for existing consumers; screens that need
    /// featured artists derive them as `artists` beyond the first.
    pub artists: Vec<TrackArtist>,
    pub album: Option<String>,
    pub album_uri: Option<String>,
    pub image_url: Option<String>,
    pub duration: Option<i64>,
}

#[derive(Serialize)]
pub struct ArtistDetail {
    pub name: String,
    pub image_url: Option<String>,
    /// From `metadata.genres` on `music/artists/get_artist`. Absent-tolerant:
    /// empty when MA hasn't populated genres for this artist/provider, and
    /// also empty (rather than failing the page) if the best-effort
    /// `get_artist` fetch itself fails.
    pub genres: Vec<String>,
    /// From `metadata.description` on `music/artists/get_artist`. Null today
    /// for this household (MA only enriches library items, and this library
    /// is empty) — carried through so the artist page's bio section
    /// populates itself if that ever changes. Also null if the best-effort
    /// `get_artist` fetch itself fails.
    pub description: Option<String>,
    pub top_tracks: Vec<Track>,
    pub albums: Vec<AlbumSummary>,
}

/// Parse an MA URI like `spotify--yC8brUbw://track/2Xhd1kYKj2aee7JR3nIlRe`
/// into `(provider, media_type, item_id)`. Returns None if the URI shape
/// doesn't match. MA's per-item commands take `item_id` +
/// `provider_instance_id_or_domain`, not the composite URI.
fn parse_ma_uri(uri: &str) -> Option<(&str, &str, &str)> {
    let (provider, rest) = uri.split_once("://")?;
    let (media_type, item_id) = rest.split_once('/')?;
    Some((provider, media_type, item_id))
}

fn ma_item_args(uri: &str) -> Option<serde_json::Value> {
    let (provider, _media_type, item_id) = parse_ma_uri(uri)?;
    Some(serde_json::json!({
        "item_id": item_id,
        "provider_instance_id_or_domain": provider,
    }))
}

fn first_image_path(item: &serde_json::Value) -> Option<String> {
    item.get("metadata")
        .and_then(|m| m.get("images"))
        .and_then(|imgs| imgs.as_array())
        .and_then(|arr| arr.first())
        .and_then(|img| img.get("path"))
        .and_then(|p| p.as_str())
        .map(str::to_string)
}

fn first_artist_name_and_uri(item: &serde_json::Value) -> (Option<String>, Option<String>) {
    let first = item
        .get("artists")
        .and_then(|a| a.as_array())
        .and_then(|arr| arr.first());
    let name = first
        .and_then(|a| a.get("name"))
        .and_then(|n| n.as_str())
        .map(str::to_string);
    let uri = first
        .and_then(|a| a.get("uri"))
        .and_then(|u| u.as_str())
        .map(str::to_string);
    (name, uri)
}

/// The full `artists[]` credit list off an item (a track, in practice).
/// Absent-tolerant: an item with no `artists` array yields an empty list.
fn all_artists(item: &serde_json::Value) -> Vec<TrackArtist> {
    item.get("artists")
        .and_then(|a| a.as_array())
        .into_iter()
        .flatten()
        .filter_map(|a| {
            let name = a.get("name")?.as_str()?.to_string();
            let uri = a.get("uri").and_then(|u| u.as_str()).map(str::to_string);
            Some(TrackArtist { name, uri })
        })
        .collect()
}

/// `metadata.label` off an item — absent for most providers/items.
fn metadata_label(item: &serde_json::Value) -> Option<String> {
    item.get("metadata")
        .and_then(|m| m.get("label"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

/// `metadata.description` off an item. Null today for virtually everything
/// this household plays — MA only enriches metadata for library items, and
/// this library is empty — but carried through so the field populates
/// itself if that ever changes.
fn metadata_description(item: &serde_json::Value) -> Option<String> {
    item.get("metadata")
        .and_then(|m| m.get("description"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

/// `metadata.genres` off an item. Absent-tolerant: missing, null, or an
/// empty array all yield an empty list.
fn metadata_genres(item: &serde_json::Value) -> Vec<String> {
    item.get("metadata")
        .and_then(|m| m.get("genres"))
        .and_then(|v| v.as_array())
        .into_iter()
        .flatten()
        .filter_map(|g| g.as_str().map(str::to_string))
        .collect()
}

/// Run an MA command best-effort: on failure, log a warning and return
/// `None` instead of propagating the error. For enrichment calls layered on
/// top of a page's primary list (label/description/genres alongside the
/// track list) — this runs against a LAN service that has been unreachable
/// for stretches of this project, and a decorative field failing to load
/// must not blank a page that could otherwise render its tracks fine. The
/// primary track/album list calls stay fail-closed; only these do not.
async fn best_effort_command(
    client: &MaClient,
    command: &str,
    args: serde_json::Value,
    context: &str,
) -> Option<serde_json::Value> {
    match client.command(command, args).await {
        Ok(v) => Some(v),
        Err(e) => {
            tracing::warn!("{} failed, continuing without it: {}", context, e);
            None
        }
    }
}

/// Label + description derived from a best-effort `get_album` fetch.
/// `fetched` is `None` when the fetch itself failed — that degrades to
/// "absent", same as if MA had returned null for both fields.
fn album_metadata_from(fetched: Option<&serde_json::Value>) -> (Option<String>, Option<String>) {
    match fetched {
        Some(album) => (metadata_label(album), metadata_description(album)),
        None => (None, None),
    }
}

/// Genres + description derived from a best-effort `get_artist` fetch.
/// `fetched` is `None` when the fetch itself failed — that degrades to
/// "absent", same as if MA had returned null/empty for both fields.
fn artist_metadata_from(fetched: Option<&serde_json::Value>) -> (Vec<String>, Option<String>) {
    match fetched {
        Some(artist) => (metadata_genres(artist), metadata_description(artist)),
        None => (Vec::new(), None),
    }
}

fn album_summary(item: &serde_json::Value) -> Option<AlbumSummary> {
    let uri = item.get("uri")?.as_str()?.to_string();
    let name = item.get("name")?.as_str()?.to_string();
    Some(AlbumSummary {
        uri,
        name,
        image_url: first_image_path(item),
        year: item.get("year").and_then(|y| y.as_i64()),
    })
}

fn track_from(item: &serde_json::Value) -> Option<Track> {
    let uri = item.get("uri")?.as_str()?.to_string();
    let name = item.get("name")?.as_str()?.to_string();
    let (artist, artist_uri) = first_artist_name_and_uri(item);
    let artists = all_artists(item);
    let album = item.get("album");
    let album_name = album
        .and_then(|a| a.get("name"))
        .and_then(|n| n.as_str())
        .map(str::to_string);
    let album_uri = album
        .and_then(|a| a.get("uri"))
        .and_then(|u| u.as_str())
        .map(str::to_string);
    let image_url = first_image_path(item).or_else(|| album.and_then(first_image_path));
    let duration = item.get("duration").and_then(|d| d.as_i64());
    Some(Track {
        uri,
        name,
        artist,
        artist_uri,
        artists,
        album: album_name,
        album_uri,
        image_url,
        duration,
    })
}

pub async fn get_artist(
    State(pool): State<SqlitePool>,
    Query(q): Query<UriQuery>,
) -> Result<Json<ArtistDetail>, AppError> {
    let client = MaClient::from_config(&pool).await?;

    const TOP_TRACKS_CMD: &str = "music/artists/top_tracks";
    const ALBUMS_CMD: &str = "music/artists/artist_albums";
    const ARTIST_CMD: &str = "music/artists/get_artist";

    let args = ma_item_args(&q.uri)
        .ok_or_else(|| AppError::Internal(format!("invalid MA URI: {}", q.uri)))?;

    let mut top_tracks_raw: serde_json::Value =
        client.command(TOP_TRACKS_CMD, args.clone()).await?;
    rewrite_image_urls(&mut top_tracks_raw);

    let mut albums_raw: serde_json::Value = client.command(ALBUMS_CMD, args.clone()).await?;
    rewrite_image_urls(&mut albums_raw);

    // Genres/description live on the artist's own metadata, which the
    // top_tracks/artist_albums responses don't embed richly (the artist
    // object nested in artist_albums carries a null genres list even when
    // get_artist returns real ones) — verified live against music.home:8095.
    // Best-effort: this is enrichment on top of the tracks/albums above, so
    // a failure here degrades to absent genres/description rather than
    // failing the whole artist page.
    let artist_raw =
        best_effort_command(&client, ARTIST_CMD, args, "music/artists/get_artist").await;
    let (genres, description) = artist_metadata_from(artist_raw.as_ref());

    let top_tracks: Vec<Track> = top_tracks_raw
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(track_from)
        .collect();
    let albums: Vec<AlbumSummary> = albums_raw
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(album_summary)
        .collect();

    // Name + image come from the artist metadata embedded in the first album entry.
    let (name, image_url) = albums_raw
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|a| a.get("artists"))
        .and_then(|artists| artists.as_array())
        .and_then(|arr| arr.first())
        .map(|artist| {
            (
                artist
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                first_image_path(artist),
            )
        })
        .unwrap_or_default();

    Ok(Json(ArtistDetail {
        name,
        image_url,
        genres,
        description,
        top_tracks,
        albums,
    }))
}

#[derive(Serialize)]
pub struct AlbumDetail {
    pub name: String,
    pub artist: Option<String>,
    pub artist_uri: Option<String>,
    pub image_url: Option<String>,
    pub year: Option<i64>,
    /// From `metadata.label` on `music/albums/get_album`. Absent for
    /// providers/items MA hasn't populated a label for, and also absent
    /// (rather than failing the page) if the best-effort `get_album` fetch
    /// itself fails.
    pub label: Option<String>,
    /// From `metadata.description` on `music/albums/get_album`. Null today
    /// for this household (MA only enriches library items, and this library
    /// is empty) — carried through so the album page's description section
    /// populates itself if that ever changes. Also null if the best-effort
    /// `get_album` fetch itself fails.
    pub description: Option<String>,
    pub tracks: Vec<Track>,
}

pub async fn get_album(
    State(pool): State<SqlitePool>,
    Query(q): Query<UriQuery>,
) -> Result<Json<AlbumDetail>, AppError> {
    let client = MaClient::from_config(&pool).await?;

    const TRACKS_CMD: &str = "music/albums/album_tracks";
    const ALBUM_CMD: &str = "music/albums/get_album";

    let args = ma_item_args(&q.uri)
        .ok_or_else(|| AppError::Internal(format!("invalid MA URI: {}", q.uri)))?;

    let mut tracks_raw: serde_json::Value = client.command(TRACKS_CMD, args.clone()).await?;
    rewrite_image_urls(&mut tracks_raw);

    // Label/description live on the album's own metadata, which
    // album_tracks's embedded album block doesn't carry at all — verified
    // live against music.home:8095. Best-effort: this is enrichment on top
    // of the track list above, so a failure here degrades to absent label/
    // description rather than failing the whole album page.
    let album_raw = best_effort_command(&client, ALBUM_CMD, args, "music/albums/get_album").await;
    let (label, description) = album_metadata_from(album_raw.as_ref());

    let tracks: Vec<Track> = tracks_raw
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(track_from)
        .collect();

    // Album header: name / image / year live on each track's embedded album
    // block; the artist name+uri lives on the track's own `artists` array
    // (the embedded album block from album_tracks doesn't carry artists).
    let first_track = tracks_raw.as_array().and_then(|arr| arr.first());
    let header = first_track
        .and_then(|t| t.get("album"))
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let name = header
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    // album_tracks embeds a single `image` object on the album; the metadata
    // fallback covers other MA response shapes.
    let image_url = header
        .get("image")
        .and_then(|i| i.get("path"))
        .and_then(|p| p.as_str())
        .map(str::to_string)
        .or_else(|| first_image_path(&header));
    let year = header.get("year").and_then(|y| y.as_i64());
    let (artist, artist_uri) = first_track
        .map(first_artist_name_and_uri)
        .unwrap_or((None, None));

    Ok(Json(AlbumDetail {
        name,
        artist,
        artist_uri,
        image_url,
        year,
        label,
        description,
        tracks,
    }))
}

/// The function shape that pulls `artist_uri`/`album_uri` off an MA item —
/// `extract_uris_from_track`/`extract_uris_from_album` below.
type UriExtractor = fn(&serde_json::Value) -> (Option<String>, Option<String>);

/// Which MA command (and payload extractor) resolves `artist_uri`/
/// `album_uri` for a given play-log `media_type`, if any. Only tracks
/// (artist + album) and albums (artist only — an album has no `album_uri`
/// besides its own) are worth a lookup: a playlist has neither, and an
/// artist has no `artist_uri` pointing elsewhere.
fn uri_lookup_for(media_type: &str) -> Option<(&'static str, UriExtractor)> {
    match media_type {
        "track" => Some(("music/tracks/get_track", extract_uris_from_track)),
        "album" => Some(("music/albums/get_album", extract_uris_from_album)),
        _ => None,
    }
}

/// Derive `artist_uri`/`album_uri` from a best-effort lookup's result.
/// `extract` is `None` when the media type has no applicable lookup (see
/// `uri_lookup_for`); `fetched` is `None` when the lookup itself failed.
/// Either way this degrades to "neither resolved" — same as if the caller
/// had supplied nothing.
fn play_log_uris_from(
    extract: Option<UriExtractor>,
    fetched: Option<&serde_json::Value>,
) -> (Option<String>, Option<String>) {
    match (extract, fetched) {
        (Some(extract), Some(item)) => extract(item),
        _ => (None, None),
    }
}

/// Resolve `artist_uri`/`album_uri` for an explicit play the client didn't
/// already supply them for (see `routes::play`) — typically a quick-dial
/// replay of a row that itself started with null URIs, which would
/// otherwise propagate that null forward on every future replay. One MA
/// round-trip per explicit play (a user action, not a render) is an
/// acceptable cost. Best-effort: a failed or inapplicable lookup degrades to
/// `(None, None)`, exactly as if the caller had supplied nothing — logging
/// an explicit play must never fail because this enrichment did.
pub(super) async fn resolve_play_log_uris(
    client: &MaClient,
    uri: &str,
    media_type: &str,
) -> (Option<String>, Option<String>) {
    let lookup = uri_lookup_for(media_type);
    let extract = lookup.map(|(_, extract)| extract);

    let fetched = match lookup.and_then(|(cmd, _)| ma_item_args(uri).map(|args| (cmd, args))) {
        Some((cmd, args)) => {
            best_effort_command(client, cmd, args, "explicit-play URI enrichment").await
        }
        None => None,
    };

    play_log_uris_from(extract, fetched.as_ref())
}

/// One-off admin backfill: rows in `music_explicit_play_log` that predate the
/// artist_uri/album_uri columns have NULL for both. This walks distinct URIs
/// with missing values, asks MA for the item's full metadata, and updates
/// the log so Recently/Frequently tiles can offer "Go to artist" / "Go to album".
pub async fn backfill_uris(
    State(pool): State<SqlitePool>,
) -> Result<Json<BackfillReport>, AppError> {
    let client = MaClient::from_config(&pool).await?;

    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT DISTINCT uri, media_type FROM music_explicit_play_log \
         WHERE (artist_uri IS NULL OR album_uri IS NULL) \
         AND media_type IN ('track', 'album')",
    )
    .fetch_all(&pool)
    .await?;

    let mut updated = 0usize;
    let mut failed: Vec<String> = Vec::new();

    for (uri, media_type) in &rows {
        let (cmd, extract) = match uri_lookup_for(media_type) {
            Some(lookup) => lookup,
            None => continue,
        };

        let args = match ma_item_args(uri) {
            Some(a) => a,
            None => {
                failed.push(uri.clone());
                continue;
            }
        };

        let response: Result<serde_json::Value, _> = client.command(cmd, args).await;
        let item = match response {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(uri = %uri, error = %e, "backfill: MA lookup failed");
                failed.push(uri.clone());
                continue;
            }
        };

        let (artist_uri, album_uri) = extract(&item);
        if artist_uri.is_none() && album_uri.is_none() {
            failed.push(uri.clone());
            continue;
        }

        let rows_affected = sqlx::query(
            "UPDATE music_explicit_play_log SET \
                artist_uri = COALESCE(artist_uri, ?), \
                album_uri  = COALESCE(album_uri, ?) \
             WHERE uri = ?",
        )
        .bind(&artist_uri)
        .bind(&album_uri)
        .bind(uri)
        .execute(&pool)
        .await?
        .rows_affected();

        updated += rows_affected as usize;
    }

    Ok(Json(BackfillReport {
        distinct_uris_checked: rows.len(),
        rows_updated: updated,
        failed_uris: failed,
    }))
}

#[derive(Serialize)]
pub struct BackfillReport {
    pub distinct_uris_checked: usize,
    pub rows_updated: usize,
    pub failed_uris: Vec<String>,
}

fn extract_uris_from_track(item: &serde_json::Value) -> (Option<String>, Option<String>) {
    let (_, artist_uri) = first_artist_name_and_uri(item);
    let album_uri = item
        .get("album")
        .and_then(|a| a.get("uri"))
        .and_then(|u| u.as_str())
        .map(str::to_string);
    (artist_uri, album_uri)
}

fn extract_uris_from_album(item: &serde_json::Value) -> (Option<String>, Option<String>) {
    let (_, artist_uri) = first_artist_name_and_uri(item);
    (artist_uri, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ma_uri_splits_provider_type_id() {
        let (provider, media_type, id) =
            parse_ma_uri("spotify--yC8brUbw://track/2Xhd1kYKj2aee7JR3nIlRe").unwrap();
        assert_eq!(provider, "spotify--yC8brUbw");
        assert_eq!(media_type, "track");
        assert_eq!(id, "2Xhd1kYKj2aee7JR3nIlRe");
    }

    #[test]
    fn parse_ma_uri_handles_library() {
        let (provider, media_type, id) = parse_ma_uri("library://track/654").unwrap();
        assert_eq!(provider, "library");
        assert_eq!(media_type, "track");
        assert_eq!(id, "654");
    }

    #[test]
    fn parse_ma_uri_rejects_malformed() {
        assert!(parse_ma_uri("not-a-uri").is_none());
        assert!(parse_ma_uri("spotify://").is_none());
    }

    #[test]
    fn ma_item_args_uses_provider_and_item_id() {
        let args = ma_item_args("spotify--yC8brUbw://track/abc123").unwrap();
        assert_eq!(args["item_id"], "abc123");
        assert_eq!(args["provider_instance_id_or_domain"], "spotify--yC8brUbw");
    }

    #[test]
    fn track_from_extracts_artist_and_album_uris() {
        let raw = serde_json::json!({
            "uri": "spotify--x://track/1",
            "name": "Go",
            "artists": [{"name": "The Chemical Brothers", "uri": "spotify--x://artist/1"}],
            "album": {"name": "Born In The Echoes", "uri": "spotify--x://album/1"},
            "duration": 260,
        });
        let t = track_from(&raw).expect("track_from");
        assert_eq!(t.uri, "spotify--x://track/1");
        assert_eq!(t.artist.as_deref(), Some("The Chemical Brothers"));
        assert_eq!(t.artist_uri.as_deref(), Some("spotify--x://artist/1"));
        assert_eq!(t.album_uri.as_deref(), Some("spotify--x://album/1"));
        assert_eq!(t.duration, Some(260));
        // artists[] duplicates the single credit alongside the flattened fields.
        assert_eq!(t.artists.len(), 1);
        assert_eq!(t.artists[0].name, "The Chemical Brothers");
        assert_eq!(t.artists[0].uri.as_deref(), Some("spotify--x://artist/1"));
    }

    /// Trimmed capture of the first two `music/albums/album_tracks` entries
    /// from `music.home:8095` — see the fixture's own `_comment`. Track 1
    /// (Galvanize) genuinely carries two artist credits; track 2 (The Boxer)
    /// carries the ordinary single-artist case.
    const REAL_ALBUM_TRACKS_FIXTURE: &str =
        include_str!("../../../tests/fixtures/music_album_tracks_sample.json");

    #[test]
    fn track_from_captures_full_artist_list_from_real_multi_artist_track() {
        let fixture: serde_json::Value = serde_json::from_str(REAL_ALBUM_TRACKS_FIXTURE).unwrap();
        let galvanize = &fixture["tracks"][0];

        let t = track_from(galvanize).expect("track_from");
        assert_eq!(t.name, "Galvanize");
        // Flattened single-artist fields keep pointing at the first credit,
        // so existing consumers (queue tiles, search results) don't change.
        assert_eq!(t.artist.as_deref(), Some("The Chemical Brothers"));
        // Full credit list carries the featured artist the flattened field drops.
        assert_eq!(t.artists.len(), 2);
        assert_eq!(t.artists[0].name, "The Chemical Brothers");
        assert_eq!(t.artists[1].name, "Q-Tip");
        assert_eq!(
            t.artists[1].uri.as_deref(),
            Some("spotify--yC8brUbw://artist/3ZotbHeyVQKxQCPDJuQ4SU")
        );
    }

    #[test]
    fn track_from_real_single_artist_track_has_one_entry_artist_list() {
        let fixture: serde_json::Value = serde_json::from_str(REAL_ALBUM_TRACKS_FIXTURE).unwrap();
        let the_boxer = &fixture["tracks"][1];

        let t = track_from(the_boxer).expect("track_from");
        assert_eq!(t.name, "The Boxer");
        assert_eq!(t.artists.len(), 1);
        assert_eq!(t.artists[0].name, "The Chemical Brothers");
    }

    #[test]
    fn all_artists_is_absent_tolerant() {
        let raw = serde_json::json!({ "name": "No artists here" });
        assert!(all_artists(&raw).is_empty());
    }

    /// Trimmed capture of a real `music/albums/get_album` response — see the
    /// fixture's own `_comment`. `metadata.label` is genuinely populated
    /// ("Virgin Records"); `metadata.description` is genuinely null, the
    /// ordinary case for this household's empty library.
    const REAL_GET_ALBUM_FIXTURE: &str =
        include_str!("../../../tests/fixtures/music_get_album_sample.json");

    #[test]
    fn album_metadata_from_real_captured_payload() {
        let album: serde_json::Value = serde_json::from_str(REAL_GET_ALBUM_FIXTURE).unwrap();
        assert_eq!(metadata_label(&album).as_deref(), Some("Virgin Records"));
        assert_eq!(metadata_description(&album), None);
    }

    /// Trimmed capture of a real `music/artists/get_artist` response — see
    /// the fixture's own `_comment`. `metadata.genres` is genuinely
    /// populated; `metadata.description` is genuinely null even with
    /// `lazy: false, force_refresh: true` on the live probe.
    const REAL_GET_ARTIST_FIXTURE: &str =
        include_str!("../../../tests/fixtures/music_get_artist_sample.json");

    #[test]
    fn artist_metadata_from_real_captured_payload() {
        let artist: serde_json::Value = serde_json::from_str(REAL_GET_ARTIST_FIXTURE).unwrap();
        assert_eq!(
            metadata_genres(&artist),
            vec!["breakbeat", "big beat", "electronic", "alternative dance"]
        );
        assert_eq!(metadata_description(&artist), None);
    }

    #[test]
    fn metadata_helpers_are_absent_tolerant_when_metadata_is_missing() {
        let raw = serde_json::json!({ "name": "Bare-bones item" });
        assert_eq!(metadata_label(&raw), None);
        assert_eq!(metadata_description(&raw), None);
        assert!(metadata_genres(&raw).is_empty());
    }

    #[test]
    fn metadata_helpers_are_absent_tolerant_when_fields_are_null() {
        let raw = serde_json::json!({
            "metadata": { "label": null, "description": null, "genres": null }
        });
        assert_eq!(metadata_label(&raw), None);
        assert_eq!(metadata_description(&raw), None);
        assert!(metadata_genres(&raw).is_empty());
    }

    #[test]
    fn album_metadata_from_real_payload_when_fetch_succeeded() {
        let album: serde_json::Value = serde_json::from_str(REAL_GET_ALBUM_FIXTURE).unwrap();
        let (label, description) = album_metadata_from(Some(&album));
        assert_eq!(label.as_deref(), Some("Virgin Records"));
        assert_eq!(description, None);
    }

    /// The degraded path: `get_album` is a best-effort enrichment call
    /// layered on top of the album's (separately, fail-closed) track list —
    /// a failed fetch degrades to absent label/description, exactly as if
    /// MA had returned null for both, rather than failing the whole page.
    #[test]
    fn album_metadata_is_absent_when_the_best_effort_fetch_failed() {
        assert_eq!(album_metadata_from(None), (None, None));
    }

    #[test]
    fn artist_metadata_from_real_payload_when_fetch_succeeded() {
        let artist: serde_json::Value = serde_json::from_str(REAL_GET_ARTIST_FIXTURE).unwrap();
        let (genres, description) = artist_metadata_from(Some(&artist));
        assert_eq!(
            genres,
            vec!["breakbeat", "big beat", "electronic", "alternative dance"]
        );
        assert_eq!(description, None);
    }

    /// The degraded path: `get_artist` is a best-effort enrichment call
    /// layered on top of the artist's (separately, fail-closed) top-tracks/
    /// albums lists — a failed fetch degrades to absent genres/description,
    /// exactly as if MA had returned null/empty for both, rather than
    /// failing the whole page.
    #[test]
    fn artist_metadata_is_absent_when_the_best_effort_fetch_failed() {
        assert_eq!(artist_metadata_from(None), (Vec::new(), None));
    }

    #[test]
    fn uri_lookup_for_track_uses_get_track() {
        let (cmd, _) = uri_lookup_for("track").expect("track is applicable");
        assert_eq!(cmd, "music/tracks/get_track");
    }

    #[test]
    fn uri_lookup_for_album_uses_get_album() {
        let (cmd, _) = uri_lookup_for("album").expect("album is applicable");
        assert_eq!(cmd, "music/albums/get_album");
    }

    /// A playlist has neither an artist_uri nor an album_uri of its own —
    /// not a gap to fill, so no lookup applies.
    #[test]
    fn uri_lookup_for_playlist_is_not_applicable() {
        assert!(uri_lookup_for("playlist").is_none());
    }

    /// An artist has no artist_uri pointing elsewhere and no album_uri —
    /// not a gap to fill, so no lookup applies.
    #[test]
    fn uri_lookup_for_artist_is_not_applicable() {
        assert!(uri_lookup_for("artist").is_none());
    }

    #[test]
    fn uri_lookup_for_unknown_media_type_is_not_applicable() {
        assert!(uri_lookup_for("").is_none());
        assert!(uri_lookup_for("radio").is_none());
    }

    /// Trimmed capture of a real `music/tracks/get_track` response — see the
    /// fixture's own `_comment`. Confirms `artists[].uri`/`album.uri` are
    /// present at get_track's top level, the same shape `extract_uris_from_track`
    /// already reads off `album_tracks`/`get_album` entries.
    const REAL_GET_TRACK_FIXTURE: &str =
        include_str!("../../../tests/fixtures/music_get_track_sample.json");

    #[test]
    fn extract_uris_from_track_reads_real_captured_payload() {
        let track: serde_json::Value = serde_json::from_str(REAL_GET_TRACK_FIXTURE).unwrap();
        let (artist_uri, album_uri) = extract_uris_from_track(&track);
        assert_eq!(
            artist_uri.as_deref(),
            Some("spotify--yC8brUbw://artist/1GhPHrq36VKCY3ucVaZCfo")
        );
        assert_eq!(
            album_uri.as_deref(),
            Some("spotify--yC8brUbw://album/3XUVUh6hisN43r2eZAOJRD")
        );
    }

    #[test]
    fn extract_uris_from_album_reads_real_captured_payload() {
        let album: serde_json::Value = serde_json::from_str(REAL_GET_ALBUM_FIXTURE).unwrap();
        let (artist_uri, album_uri) = extract_uris_from_album(&album);
        assert_eq!(
            artist_uri.as_deref(),
            Some("spotify--yC8brUbw://artist/1GhPHrq36VKCY3ucVaZCfo")
        );
        // An album has no album_uri of its own to resolve.
        assert_eq!(album_uri, None);
    }

    /// "Not applicable for this media type" branch: no extractor at all, so
    /// the lookup is never even attempted.
    #[test]
    fn play_log_uris_from_is_absent_when_not_applicable() {
        let fetched = serde_json::json!({ "artists": [{ "uri": "spotify--x://artist/1" }] });
        assert_eq!(play_log_uris_from(None, Some(&fetched)), (None, None));
    }

    /// "Lookup failed" branch: an applicable extractor, but the best-effort
    /// MA fetch itself returned nothing.
    #[test]
    fn play_log_uris_from_is_absent_when_the_lookup_failed() {
        assert_eq!(
            play_log_uris_from(Some(extract_uris_from_track), None),
            (None, None)
        );
    }

    /// Success branch: an applicable extractor and a fetched item.
    #[test]
    fn play_log_uris_from_extracts_when_lookup_succeeded() {
        let track: serde_json::Value = serde_json::from_str(REAL_GET_TRACK_FIXTURE).unwrap();
        let (artist_uri, album_uri) =
            play_log_uris_from(Some(extract_uris_from_track), Some(&track));
        assert_eq!(
            artist_uri.as_deref(),
            Some("spotify--yC8brUbw://artist/1GhPHrq36VKCY3ucVaZCfo")
        );
        assert_eq!(
            album_uri.as_deref(),
            Some("spotify--yC8brUbw://album/3XUVUh6hisN43r2eZAOJRD")
        );
    }
}
