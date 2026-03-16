use axum::Router;
use dashboard_backend::models::google::GoogleOAuthConfig;
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
    let google_config = GoogleOAuthConfig {
        client_id: String::new(),
        client_secret: String::new(),
        redirect_uri: String::new(),
    };
    let app = dashboard_backend::routes::router(pool.clone(), google_config);
    (app, pool)
}
