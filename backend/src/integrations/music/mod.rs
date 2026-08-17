pub mod browse;
pub mod proxy;
pub mod routes;
pub mod sse;
pub mod types;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "music";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/play", axum::routing::post(routes::play))
        .route("/pause", axum::routing::post(routes::pause))
        .route("/resume", axum::routing::post(routes::resume))
        .route("/stop", axum::routing::post(routes::stop))
        .route("/next", axum::routing::post(routes::next))
        .route("/previous", axum::routing::post(routes::previous))
        .route("/volume", axum::routing::post(routes::set_volume))
        .route(
            "/group-volume",
            axum::routing::post(routes::set_group_volume),
        )
        .route("/group", axum::routing::post(routes::group))
        .route("/ungroup", axum::routing::post(routes::ungroup))
        .route("/players", axum::routing::get(routes::get_players))
        .route("/search", axum::routing::get(routes::search))
        .route("/recent", axum::routing::get(routes::get_recent))
        .route("/top-tracks", axum::routing::get(routes::top_tracks))
        .route("/queue/{queue_id}", axum::routing::get(routes::get_queue))
        .route("/_debug/players", axum::routing::get(routes::debug_players))
        .route(
            "/_debug/command",
            axum::routing::post(routes::debug_command),
        )
        .route("/events", axum::routing::get(sse::events))
        .route("/image", axum::routing::get(routes::proxy_image))
        .route("/artist", axum::routing::get(browse::get_artist))
        .route("/album", axum::routing::get(browse::get_album))
        .route("/playlists", axum::routing::get(browse::get_playlists))
        .route(
            "/_admin/backfill_uris",
            axum::routing::post(browse::backfill_uris),
        )
        .with_state(pool)
}
