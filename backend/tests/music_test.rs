// This file only needs `test_pool` from the shared helpers module; the
// log-capture helpers added for `fetch_test.rs`/`llm_test.rs` go unused
// here. Silence the resulting dead_code warning rather than pulling in an
// unused import.
#[allow(dead_code)]
mod helpers;

use axum::body::to_bytes;
use axum::http::{Request, StatusCode};
use helpers::test_pool;
use sqlx::Row;
use tower::ServiceExt;

#[tokio::test]
async fn play_log_persists_artist_and_album_uris() {
    let pool = test_pool().await;
    sqlx::query(
        "INSERT INTO music_explicit_play_log \
         (uri, media_type, name, artist, album, image_url, artist_uri, album_uri) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind("spotify--x://track/1")
    .bind("track")
    .bind("Go")
    .bind("The Chemical Brothers")
    .bind("Born In The Echoes")
    .bind::<Option<&str>>(None)
    .bind("spotify--x://artist/2")
    .bind("spotify--x://album/3")
    .execute(&pool)
    .await
    .expect("insert");

    let row = sqlx::query("SELECT artist_uri, album_uri FROM music_explicit_play_log")
        .fetch_one(&pool)
        .await
        .expect("row");
    assert_eq!(
        row.get::<Option<String>, _>("artist_uri").as_deref(),
        Some("spotify--x://artist/2")
    );
    assert_eq!(
        row.get::<Option<String>, _>("album_uri").as_deref(),
        Some("spotify--x://album/3")
    );
}

async fn seed_play(
    pool: &sqlx::SqlitePool,
    uri: &str,
    artist_uri: Option<&str>,
    album_uri: Option<&str>,
) {
    sqlx::query(
        "INSERT INTO music_explicit_play_log \
         (uri, media_type, name, artist, album, image_url, artist_uri, album_uri) \
         VALUES (?, 'track', 'X', 'Y', 'Z', NULL, ?, ?)",
    )
    .bind(uri)
    .bind(artist_uri)
    .bind(album_uri)
    .execute(pool)
    .await
    .expect("insert");
}

#[tokio::test]
async fn top_tracks_includes_uris() {
    let (app, pool) = helpers::test_app().await;
    seed_play(
        &pool,
        "spotify--x://track/1",
        Some("spotify--x://artist/1"),
        Some("spotify--x://album/1"),
    )
    .await;

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/music/top-tracks")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let item = &json.as_array().unwrap()[0];
    assert_eq!(item["artist_uri"], "spotify--x://artist/1");
    assert_eq!(item["album_uri"], "spotify--x://album/1");
}

#[tokio::test]
async fn recent_includes_uris_and_null_when_missing() {
    let (app, pool) = helpers::test_app().await;
    seed_play(
        &pool,
        "spotify--x://track/2",
        Some("spotify--x://artist/2"),
        None,
    )
    .await;

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/music/recent")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let item = &json.as_array().unwrap()[0];
    assert_eq!(item["artist_uri"], "spotify--x://artist/2");
    assert!(item["album_uri"].is_null());
}
