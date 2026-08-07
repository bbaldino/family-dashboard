use dashboard_backend::{db, integrations};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
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

/// One-time migration: grid's layout settings were stored under a global
/// `dashboard.` prefix, which read as app-wide config but only ever drove the
/// grid theme. They belong to the theme, so they move to `theme.grid.`.
///
/// Copies rather than moves, and skips any key already present at the
/// destination, so re-running at every boot is a no-op and never overwrites a
/// value the user has since edited.
async fn migrate_grid_theme_config(pool: &sqlx::SqlitePool) {
    let keys = ["columns", "rows", "hidden"];
    for key in keys {
        let new_key = format!("theme.grid.{}", key);
        let existing: Option<String> = sqlx::query_scalar("SELECT value FROM config WHERE key = ?")
            .bind(&new_key)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

        if existing.is_some() {
            continue;
        }

        let old_key = format!("dashboard.{}", key);
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

/// One-time migration: which calendars the dashboard shows was stored under
/// `google-calendar.`, back when Google Calendar was a single integration.
/// It is now a *provider* — an authenticated connection and the operations it
/// answers — and "which calendars, in which window, in which widget" is its
/// consumers' policy, so the key moves to the `calendar` integration that
/// owns the week strip and the month grid.
///
/// Copies rather than moves, and skips a destination that already exists, so
/// re-running at every boot is a no-op and never overwrites a selection the
/// user has since edited.
async fn migrate_calendar_config(pool: &sqlx::SqlitePool) {
    let new_key = "calendar.calendar_ids";
    let existing: Option<String> = sqlx::query_scalar("SELECT value FROM config WHERE key = ?")
        .bind(new_key)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

    if existing.is_some() {
        return;
    }

    let old_key = "google-calendar.calendar_ids";
    let old_value: Option<String> = sqlx::query_scalar("SELECT value FROM config WHERE key = ?")
        .bind(old_key)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

    if let Some(value) = old_value {
        let _ = sqlx::query(
            "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(new_key)
        .bind(&value)
        .execute(pool)
        .await;
        tracing::info!("Migrated {} -> {}", old_key, new_key);
    }
}

#[tokio::main]
async fn main() {
    // Load .env file if present (won't error if missing)
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt::init();

    let pool = db::init_pool().await;
    migrate_google_cloud_config(&pool).await;
    migrate_grid_theme_config(&pool).await;
    migrate_calendar_config(&pool).await;

    let api_routes = integrations::router(pool.clone());

    // SPA fallback: serve static files, but fall back to index.html for client-side routes
    let spa_service =
        ServeDir::new("static").not_found_service(ServeFile::new("static/index.html"));

    // The doorbell page is embedded cross-origin and receives `@font-face`
    // rules pointing back at /fonts (see the frontend's
    // `data/doorbell/theming.ts`). Fonts are CORS-restricted even when
    // requested from plain CSS, so without these headers every face fails to
    // load and silently degrades to a generic family. Scoped to /fonts rather
    // than applied to the whole app: these are public static assets with
    // nothing to leak, and the API has no business being readable
    // cross-origin.
    let fonts_service = axum::Router::new()
        .fallback_service(ServeDir::new("static/fonts"))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([axum::http::Method::GET, axum::http::Method::HEAD]),
        );

    // Runtime config endpoint — serves env vars to the frontend so they don't
    // need to be baked in at build time.
    let runtime_config = axum::Router::new().route(
        "/runtime-config",
        axum::routing::get(|| async {
            axum::Json(serde_json::json!({
                "ha_url": std::env::var("HA_URL").ok(),
                "ha_token": std::env::var("HA_TOKEN").ok(),
            }))
        }),
    );

    let app = axum::Router::new()
        .nest("/api", api_routes)
        .nest("/api", runtime_config)
        .nest("/fonts", fonts_service)
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

#[cfg(test)]
mod config_migration_tests {
    use super::{migrate_calendar_config, migrate_grid_theme_config};
    use sqlx::SqlitePool;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
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

    async fn set_config(pool: &SqlitePool, key: &str, value: &str) {
        sqlx::query(
            "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value)
        .execute(pool)
        .await
        .expect("Failed to set config");
    }

    async fn get_config(pool: &SqlitePool, key: &str) -> Option<String> {
        sqlx::query_scalar("SELECT value FROM config WHERE key = ?")
            .bind(key)
            .fetch_optional(pool)
            .await
            .unwrap_or(None)
    }

    #[tokio::test]
    async fn copies_dashboard_keys_to_the_theme_grid_prefix() {
        let pool = test_pool().await;
        set_config(&pool, "dashboard.columns", "10").await;
        set_config(&pool, "dashboard.rows", "7").await;
        set_config(&pool, "dashboard.hidden", "sports,lunch").await;

        migrate_grid_theme_config(&pool).await;

        assert_eq!(
            get_config(&pool, "theme.grid.columns").await.as_deref(),
            Some("10")
        );
        assert_eq!(
            get_config(&pool, "theme.grid.rows").await.as_deref(),
            Some("7")
        );
        assert_eq!(
            get_config(&pool, "theme.grid.hidden").await.as_deref(),
            Some("sports,lunch")
        );

        // This is a copy, not a move. Nothing reads `dashboard.*` any more,
        // but the source keys must still survive: a rollback to an older
        // build would need them, and deleting a user's config on a one-way
        // assumption is not worth the few bytes it saves.
        assert_eq!(
            get_config(&pool, "dashboard.columns").await.as_deref(),
            Some("10")
        );
        assert_eq!(
            get_config(&pool, "dashboard.rows").await.as_deref(),
            Some("7")
        );
        assert_eq!(
            get_config(&pool, "dashboard.hidden").await.as_deref(),
            Some("sports,lunch")
        );
    }

    #[tokio::test]
    async fn does_not_clobber_an_existing_destination_value() {
        // Re-running at every boot must be a no-op once the user has edited
        // the new key — otherwise every restart resets their setting.
        let pool = test_pool().await;
        set_config(&pool, "dashboard.columns", "10").await;
        set_config(&pool, "theme.grid.columns", "12").await;

        migrate_grid_theme_config(&pool).await;

        assert_eq!(
            get_config(&pool, "theme.grid.columns").await.as_deref(),
            Some("12")
        );
    }

    #[tokio::test]
    async fn is_a_no_op_when_no_dashboard_keys_exist() {
        let pool = test_pool().await;
        migrate_grid_theme_config(&pool).await;
        assert_eq!(get_config(&pool, "theme.grid.columns").await, None);
    }

    const SELECTED: &str = r#"["family@group.calendar.google.com","work"]"#;

    #[tokio::test]
    async fn copies_calendar_ids_to_the_calendar_prefix() {
        let pool = test_pool().await;
        set_config(&pool, "google-calendar.calendar_ids", SELECTED).await;

        migrate_calendar_config(&pool).await;

        assert_eq!(
            get_config(&pool, "calendar.calendar_ids").await.as_deref(),
            Some(SELECTED)
        );

        // A copy, not a move — same reasoning as the grid keys above. The
        // `google-calendar` *provider* still exists and still owns the OAuth
        // connection; only this one key changed hands, and a build from
        // before the split would still be looking for it here.
        assert_eq!(
            get_config(&pool, "google-calendar.calendar_ids")
                .await
                .as_deref(),
            Some(SELECTED)
        );
    }

    #[tokio::test]
    async fn does_not_clobber_an_existing_calendar_ids_value() {
        // The one way this migration could lose something a person chose by
        // hand: once the calendar integration's own key has been edited, a
        // reboot must not drag the stale `google-calendar` value back over it.
        let pool = test_pool().await;
        set_config(&pool, "google-calendar.calendar_ids", SELECTED).await;
        set_config(&pool, "calendar.calendar_ids", r#"["home"]"#).await;

        migrate_calendar_config(&pool).await;

        assert_eq!(
            get_config(&pool, "calendar.calendar_ids").await.as_deref(),
            Some(r#"["home"]"#)
        );
    }

    #[tokio::test]
    async fn is_a_no_op_when_no_calendar_ids_exists() {
        let pool = test_pool().await;
        migrate_calendar_config(&pool).await;
        assert_eq!(get_config(&pool, "calendar.calendar_ids").await, None);
    }
}
