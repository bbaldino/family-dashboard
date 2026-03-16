use dashboard_backend::{db, routes};
use std::net::SocketAddr;
use tower_http::services::ServeDir;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let pool = db::init_pool().await;

    let google_config = dashboard_backend::models::google::GoogleOAuthConfig {
        client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
        client_secret: std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
        redirect_uri: std::env::var("GOOGLE_REDIRECT_URI")
            .unwrap_or_else(|_| "http://localhost:3000/api/google/callback".to_string()),
    };

    let api_routes = routes::router(pool.clone(), google_config);

    let app = axum::Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new("static"));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
