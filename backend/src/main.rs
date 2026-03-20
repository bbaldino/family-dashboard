use dashboard_backend::{db, integrations};
use std::net::SocketAddr;
use tower_http::services::{ServeDir, ServeFile};

/// One-time migration: copy google-calendar OAuth credentials to google-cloud prefix.
async fn migrate_google_cloud_config(pool: &sqlx::SqlitePool) {
    let keys = ["client_id", "client_secret", "redirect_uri"];
    for key in keys {
        let new_key = format!("google-cloud.{}", key);
        let existing: Option<String> = sqlx::query_scalar("SELECT value FROM config WHERE key = ?")
            .bind(&new_key)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

        if existing.is_some() {
            continue;
        }

        let old_key = format!("google-calendar.{}", key);
        let old_value: Option<String> =
            sqlx::query_scalar("SELECT value FROM config WHERE key = ?")
                .bind(&old_key)
                .fetch_optional(pool)
                .await
                .unwrap_or(None);

        if let Some(value) = old_value {
            let _ = sqlx::query(
                "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            )
            .bind(&new_key)
            .bind(&value)
            .execute(pool)
            .await;
            tracing::info!("Migrated {} -> {}", old_key, new_key);
        }
    }
}

#[tokio::main]
async fn main() {
    // Load .env file if present (won't error if missing)
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt::init();

    let pool = db::init_pool().await;
    migrate_google_cloud_config(&pool).await;

    let api_routes = integrations::router(pool.clone());

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
