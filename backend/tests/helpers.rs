use std::str::FromStr;

use axum::Router;
use dashboard_backend::platform::manifest::Manifest;
use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;

pub async fn test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .expect("Failed to create test database");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    pool
}

fn test_manifest() -> std::sync::Arc<Manifest> {
    std::sync::Arc::new(
        Manifest::from_str(r#"{"version":1,"integrations":{}}"#)
            .expect("empty test manifest parses"),
    )
}

pub async fn test_app() -> (Router, SqlitePool) {
    let pool = test_pool().await;
    let app = dashboard_backend::integrations::router(pool.clone(), test_manifest());
    (app, pool)
}
