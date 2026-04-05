pub mod routes;

use axum::Router;
use std::sync::Arc;

pub fn router() -> Router {
    let state = routes::TriviaState {
        client: reqwest::Client::new(),
        cache: Arc::new(routes::TriviaCache::new()),
    };
    Router::new()
        .route("/question", axum::routing::get(routes::get_question))
        .with_state(state)
}
