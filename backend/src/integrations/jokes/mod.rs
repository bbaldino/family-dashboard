pub mod routes;

use std::sync::Arc;

use axum::Router;

pub fn router() -> Router {
    let state = routes::JokesState {
        client: reqwest::Client::new(),
        cache: Arc::new(routes::JokesCache::new()),
    };

    Router::new()
        .route("/today", axum::routing::get(routes::get_today))
        .with_state(state)
}
