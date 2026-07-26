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

#[derive(Serialize)]
pub struct Track {
    pub uri: String,
    pub name: String,
    pub artist: Option<String>,
    pub artist_uri: Option<String>,
    pub album: Option<String>,
    pub album_uri: Option<String>,
    pub image_url: Option<String>,
}

#[derive(Serialize)]
pub struct ArtistDetail {
    pub name: String,
    pub image_url: Option<String>,
    pub top_tracks: Vec<Track>,
    pub albums: Vec<AlbumSummary>,
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
    Some(Track {
        uri,
        name,
        artist,
        artist_uri,
        album: album_name,
        album_uri,
        image_url,
    })
}

pub async fn get_artist(
    State(pool): State<SqlitePool>,
    Query(q): Query<UriQuery>,
) -> Result<Json<ArtistDetail>, AppError> {
    let client = MaClient::from_config(&pool).await?;

    const TOP_TRACKS_CMD: &str = "music/artists/artist_toptracks";
    const ALBUMS_CMD: &str = "music/artists/artist_albums";

    let mut top_tracks_raw: serde_json::Value = client
        .command(TOP_TRACKS_CMD, serde_json::json!({ "item_uri": q.uri }))
        .await
        .unwrap_or(serde_json::json!([]));
    rewrite_image_urls(&mut top_tracks_raw);

    let mut albums_raw: serde_json::Value = client
        .command(ALBUMS_CMD, serde_json::json!({ "item_uri": q.uri }))
        .await
        .unwrap_or(serde_json::json!([]));
    rewrite_image_urls(&mut albums_raw);

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
    pub tracks: Vec<Track>,
}

pub async fn get_album(
    State(pool): State<SqlitePool>,
    Query(q): Query<UriQuery>,
) -> Result<Json<AlbumDetail>, AppError> {
    let client = MaClient::from_config(&pool).await?;

    const TRACKS_CMD: &str = "music/albums/album_tracks";

    let mut tracks_raw: serde_json::Value = client
        .command(TRACKS_CMD, serde_json::json!({ "item_uri": q.uri }))
        .await
        .unwrap_or(serde_json::json!([]));
    rewrite_image_urls(&mut tracks_raw);

    let tracks: Vec<Track> = tracks_raw
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(track_from)
        .collect();

    // Album header data pulled from the first track's album block.
    let header = tracks_raw
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|t| t.get("album"))
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let name = header
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let image_url = first_image_path(&header);
    let (artist, artist_uri) = first_artist_name_and_uri(&header);

    Ok(Json(AlbumDetail {
        name,
        artist,
        artist_uri,
        image_url,
        tracks,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn track_from_extracts_artist_and_album_uris() {
        let raw = serde_json::json!({
            "uri": "spotify--x://track/1",
            "name": "Go",
            "artists": [{"name": "The Chemical Brothers", "uri": "spotify--x://artist/1"}],
            "album": {"name": "Born In The Echoes", "uri": "spotify--x://album/1"},
        });
        let t = track_from(&raw).expect("track_from");
        assert_eq!(t.uri, "spotify--x://track/1");
        assert_eq!(t.artist.as_deref(), Some("The Chemical Brothers"));
        assert_eq!(t.artist_uri.as_deref(), Some("spotify--x://artist/1"));
        assert_eq!(t.album_uri.as_deref(), Some("spotify--x://album/1"));
    }
}
