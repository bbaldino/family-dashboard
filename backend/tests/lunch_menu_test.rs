use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

#[path = "helpers.rs"]
mod helpers;
use helpers::test_app;

#[tokio::test]
async fn test_upsert_and_get_lunch_menu() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let menu = json!({
        "days": [
            {"day": "Monday", "items": ["Pizza", "Salad"]},
            {"day": "Tuesday", "items": ["Tacos", "Rice"]}
        ]
    });

    let response = server.put("/lunch-menu/2026-03-16").json(&menu).await;
    response.assert_status_ok();

    let response = server.get("/lunch-menu?week=2026-03-16").await;
    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["week_of"], "2026-03-16");
    assert_eq!(body["days"][0]["day"], "Monday");
    assert_eq!(body["days"][0]["items"][0], "Pizza");
    assert_eq!(body["days"][1]["day"], "Tuesday");
}

#[tokio::test]
async fn test_missing_menu_returns_404() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let response = server.get("/lunch-menu?week=2099-01-01").await;
    response.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_upsert_replaces_existing() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let menu1 = json!({
        "days": [
            {"day": "Monday", "items": ["Pizza"]}
        ]
    });
    server.put("/lunch-menu/2026-03-16").json(&menu1).await;

    let menu2 = json!({
        "days": [
            {"day": "Monday", "items": ["Burgers", "Fries"]}
        ]
    });
    server.put("/lunch-menu/2026-03-16").json(&menu2).await;

    let response = server.get("/lunch-menu?week=2026-03-16").await;
    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["days"][0]["items"][0], "Burgers");
    assert_eq!(body["days"][0]["items"][1], "Fries");
}
