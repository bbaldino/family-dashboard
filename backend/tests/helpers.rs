use axum::Router;
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

pub async fn test_app() -> (Router, SqlitePool) {
    let pool = test_pool().await;
    let app = dashboard_backend::integrations::router(pool.clone());
    (app, pool)
}
