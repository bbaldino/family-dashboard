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
    /// empty when MA hasn't populated genres for this artist/provider.
    pub genres: Vec<String>,
    /// From `metadata.description` on `music/artists/get_artist`. Null today
    /// for this household (MA only enriches library items, and this library
    /// is empty) — carried through so the artist page's bio section
    /// populates itself if that ever changes.
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
    let artist_raw: serde_json::Value = client.command(ARTIST_CMD, args).await?;
    let genres = metadata_genres(&artist_raw);
    let description = metadata_description(&artist_raw);

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
    /// providers/items MA hasn't populated a label for.
    pub label: Option<String>,
    /// From `metadata.description` on `music/albums/get_album`. Null today
    /// for this household (MA only enriches library items, and this library
    /// is empty) — carried through so the album page's description section
    /// populates itself if that ever changes.
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
    // live against music.home:8095.
    let album_raw: serde_json::Value = client.command(ALBUM_CMD, args).await?;
    let label = metadata_label(&album_raw);
    let description = metadata_description(&album_raw);

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
        let (cmd, extract): (
            &str,
            fn(&serde_json::Value) -> (Option<String>, Option<String>),
        ) = match media_type.as_str() {
            "track" => ("music/tracks/get_track", extract_uris_from_track),
            "album" => ("music/albums/get_album", extract_uris_from_album),
            _ => continue,
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
}
