mod helpers;

use helpers::test_pool;
use sqlx::Row;

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
