pub mod cache;
pub mod espn;
pub mod routes;
pub mod transform;
pub mod types;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "sports";

pub fn router(pool: SqlitePool) -> Router {
    let state = routes::SportsState {
        pool,
        cache: cache::EspnCache::new(),
        client: reqwest::Client::new(),
    };

    Router::new()
        .route("/games", axum::routing::get(routes::get_games))
        .route("/teams", axum::routing::get(routes::get_teams))
        .route("/teams/search", axum::routing::get(routes::search_teams))
        .with_state(state)
}
