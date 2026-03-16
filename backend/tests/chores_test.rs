use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

#[path = "helpers.rs"]
mod helpers;
use helpers::test_app;

#[tokio::test]
async fn test_create_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);
    let response = server
        .post("/chores")
        .json(&json!({"name": "Take out trash", "description": "Both bins"}))
        .await;
    response.assert_status(StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["name"], "Take out trash");
    assert!(body["id"].is_number());
}

#[tokio::test]
async fn test_list_chores() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);
    server.post("/chores").json(&json!({"name": "A"})).await;
    server.post("/chores").json(&json!({"name": "B"})).await;
    let response = server.get("/chores").await;
    response.assert_status_ok();
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 2);
}

#[tokio::test]
async fn test_update_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);
    let resp = server.post("/chores").json(&json!({"name": "Old"})).await;
    let id = resp.json::<serde_json::Value>()["id"].as_i64().unwrap();
    let response = server
        .put(&format!("/chores/{}", id))
        .json(&json!({"name": "New"}))
        .await;
    response.assert_status_ok();
    assert_eq!(response.json::<serde_json::Value>()["name"], "New");
}

#[tokio::test]
async fn test_delete_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);
    let resp = server
        .post("/chores")
        .json(&json!({"name": "Delete me"}))
        .await;
    let id = resp.json::<serde_json::Value>()["id"].as_i64().unwrap();
    server
        .delete(&format!("/chores/{}", id))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let list: Vec<serde_json::Value> = server.get("/chores").await.json();
    assert_eq!(list.len(), 0);
}

#[tokio::test]
async fn test_assignments_and_completion() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);
    let resp = server
        .post("/chores")
        .json(&json!({"name": "Dishes"}))
        .await;
    let chore_id = resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    // Set assignments (Monday = 1)
    server
        .put(&format!("/chores/{}/assignments", chore_id))
        .json(&json!({"assignments": [{"child_name": "Alice", "day_of_week": 1}]}))
        .await
        .assert_status_ok();

    // Get assignments for a Monday (2026-03-16 is Monday)
    let resp = server.get("/chores/assignments?date=2026-03-16").await;
    resp.assert_status_ok();
    let assignments: Vec<serde_json::Value> = resp.json();
    assert_eq!(assignments.len(), 1);
    assert_eq!(assignments[0]["completed"], false);

    // Complete it
    let assignment_id = assignments[0]["id"].as_i64().unwrap();
    server
        .post(&format!("/chores/assignments/{}/complete", assignment_id))
        .json(&json!({"date": "2026-03-16"}))
        .await
        .assert_status_ok();

    // Verify completed
    let resp = server.get("/chores/assignments?date=2026-03-16").await;
    let assignments: Vec<serde_json::Value> = resp.json();
    assert_eq!(assignments[0]["completed"], true);
}
