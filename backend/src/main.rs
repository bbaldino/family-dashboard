use dashboard_backend::{db, integrations, routes};
use std::net::SocketAddr;
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() {
    // Load .env file if present (won't error if missing)
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt::init();

    let pool = db::init_pool().await;

    let google_config = dashboard_backend::models::google::GoogleOAuthConfig {
        client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
        client_secret: std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
        redirect_uri: std::env::var("GOOGLE_REDIRECT_URI")
            .unwrap_or_else(|_| "http://localhost:3042/api/google/callback".to_string()),
    };

    let api_routes =
        routes::router(pool.clone(), google_config).merge(integrations::router(pool.clone()));

    // SPA fallback: serve static files, but fall back to index.html for client-side routes
    let spa_service =
        ServeDir::new("static").not_found_service(ServeFile::new("static/index.html"));

    let app = axum::Router::new()
        .nest("/api", api_routes)
        .fallback_service(spa_service);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3042);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
