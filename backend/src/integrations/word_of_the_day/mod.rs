pub mod routes;

use std::sync::Arc;

use axum::Router;

pub fn router() -> Router {
    let state = routes::WordState {
        client: reqwest::Client::new(),
        cache: Arc::new(routes::WordCache::new()),
    };
    Router::new()
        .route("/today", axum::routing::get(routes::get_today))
        .with_state(state)
}
