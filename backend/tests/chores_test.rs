use axum::http::StatusCode;
use axum_test::TestServer;
use axum_test::multipart::MultipartForm;
use chrono::Datelike;
use serde_json::json;

#[path = "helpers.rs"]
mod helpers;
use helpers::test_app;

// ── Helper: insert a person via SQL (avoids multipart complexity in every test) ──

async fn insert_person(pool: &sqlx::SqlitePool, name: &str, color: &str) -> i64 {
    sqlx::query_scalar::<_, i64>("INSERT INTO people (name, color) VALUES (?, ?) RETURNING id")
        .bind(name)
        .bind(color)
        .fetch_one(pool)
        .await
        .unwrap()
}

// ── Helper: create a chore via the API ──

async fn create_chore_json(server: &TestServer, body: serde_json::Value) -> serde_json::Value {
    let resp = server.post("/chores/chores").json(&body).await;
    resp.assert_status(StatusCode::CREATED);
    resp.json::<serde_json::Value>()
}

// ── Helper: create an assignment via the API ──

async fn create_assignment_json(server: &TestServer, body: serde_json::Value) -> serde_json::Value {
    let resp = server.post("/chores/assignments").json(&body).await;
    resp.assert_status(StatusCode::CREATED);
    resp.json::<serde_json::Value>()
}

// ═══════════════════════════════════════════════════════════════════════
// 1. People CRUD
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_create_person_multipart() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let form = MultipartForm::new()
        .add_text("name", "Alice")
        .add_text("color", "#ff0000");

    let resp = server.post("/chores/people").multipart(form).await;
    resp.assert_status(StatusCode::CREATED);

    let body: serde_json::Value = resp.json();
    assert_eq!(body["name"], "Alice");
    assert_eq!(body["color"], "#ff0000");
    assert!(body["id"].is_number());
}

#[tokio::test]
async fn test_list_people() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    insert_person(&pool, "Alice", "#ff0000").await;
    insert_person(&pool, "Bob", "#00ff00").await;

    let resp = server.get("/chores/people").await;
    resp.assert_status_ok();
    let people: Vec<serde_json::Value> = resp.json();
    assert_eq!(people.len(), 2);
    // Ordered by name
    assert_eq!(people[0]["name"], "Alice");
    assert_eq!(people[1]["name"], "Bob");
}

#[tokio::test]
async fn test_delete_person() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let person_id = insert_person(&pool, "ToDelete", "#000000").await;

    let resp = server.delete(&format!("/chores/people/{person_id}")).await;
    resp.assert_status(StatusCode::NO_CONTENT);

    // Verify gone
    let list: Vec<serde_json::Value> = server.get("/chores/people").await.json();
    assert_eq!(list.len(), 0);
}

// ═══════════════════════════════════════════════════════════════════════
// 2. Chore CRUD
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_create_regular_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let chore = create_chore_json(&server, json!({"name": "Dishes", "tags": ["kitchen"]})).await;

    assert_eq!(chore["name"], "Dishes");
    assert_eq!(chore["chore_type"], "regular");
    assert!(chore["id"].is_number());
}

#[tokio::test]
async fn test_create_meta_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let chore = create_chore_json(
        &server,
        json!({
            "name": "Bonus Pick",
            "chore_type": "meta",
            "pick_from_tags": ["bonus"]
        }),
    )
    .await;

    assert_eq!(chore["name"], "Bonus Pick");
    assert_eq!(chore["chore_type"], "meta");
    assert_eq!(chore["pick_from_tags"], json!(["bonus"]));
}

#[tokio::test]
async fn test_list_chores() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    create_chore_json(&server, json!({"name": "A"})).await;
    create_chore_json(
        &server,
        json!({"name": "B", "chore_type": "meta", "pick_from_tags": ["bonus"]}),
    )
    .await;

    let resp = server.get("/chores/chores").await;
    resp.assert_status_ok();
    let chores: Vec<serde_json::Value> = resp.json();
    assert_eq!(chores.len(), 2);
}

#[tokio::test]
async fn test_chores_by_tags() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    create_chore_json(&server, json!({"name": "No Tags"})).await;
    create_chore_json(&server, json!({"name": "Tagged", "tags": ["bonus"]})).await;
    create_chore_json(
        &server,
        json!({"name": "Also Tagged", "tags": ["bonus", "extra"]}),
    )
    .await;

    let resp = server.get("/chores/chores/by-tags?tags=bonus").await;
    resp.assert_status_ok();
    let chores: Vec<serde_json::Value> = resp.json();
    assert_eq!(chores.len(), 2);
    assert!(chores.iter().all(|c| c["name"] != "No Tags"));
}

#[tokio::test]
async fn test_delete_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let chore = create_chore_json(&server, json!({"name": "Delete Me"})).await;
    let id = chore["id"].as_i64().unwrap();

    let resp = server.delete(&format!("/chores/chores/{id}")).await;
    resp.assert_status(StatusCode::NO_CONTENT);

    let list: Vec<serde_json::Value> = server.get("/chores/chores").await.json();
    assert_eq!(list.len(), 0);
}

// ═══════════════════════════════════════════════════════════════════════
// 3. Assignments
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_create_assignment() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let person_id = insert_person(&pool, "Alice", "#ff0000").await;
    let chore = create_chore_json(&server, json!({"name": "Dishes"})).await;
    let chore_id = chore["id"].as_i64().unwrap();

    let assignment = create_assignment_json(
        &server,
        json!({
            "chore_id": chore_id,
            "person_id": person_id,
            "week_of": "2026-03-16",
            "day_of_week": 0
        }),
    )
    .await;

    assert!(assignment["id"].is_number());
    assert_eq!(assignment["chore"]["id"], chore_id);
    assert_eq!(assignment["person"]["id"], person_id);
    assert_eq!(assignment["completed"], false);
}

#[tokio::test]
async fn test_get_assignments_for_week() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let person_id = insert_person(&pool, "Alice", "#ff0000").await;
    let chore = create_chore_json(&server, json!({"name": "Dishes"})).await;
    let chore_id = chore["id"].as_i64().unwrap();

    create_assignment_json(
        &server,
        json!({
            "chore_id": chore_id,
            "person_id": person_id,
            "week_of": "2026-03-16",
            "day_of_week": 0
        }),
    )
    .await;

    let resp = server.get("/chores/assignments?week=2026-03-16").await;
    resp.assert_status_ok();
    let assignments: Vec<serde_json::Value> = resp.json();
    assert_eq!(assignments.len(), 1);

    // Verify nested shape
    let a = &assignments[0];
    assert!(a["chore"].is_object());
    assert!(a["person"].is_object());
    assert_eq!(a["chore"]["name"], "Dishes");
    assert_eq!(a["person"]["name"], "Alice");
    assert_eq!(a["week_of"], "2026-03-16");
    assert_eq!(a["day_of_week"], 0);
}

#[tokio::test]
async fn test_complete_and_uncomplete_assignment() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let person_id = insert_person(&pool, "Alice", "#ff0000").await;
    let chore = create_chore_json(&server, json!({"name": "Dishes"})).await;
    let chore_id = chore["id"].as_i64().unwrap();

    let assignment = create_assignment_json(
        &server,
        json!({
            "chore_id": chore_id,
            "person_id": person_id,
            "week_of": "2026-03-16",
            "day_of_week": 0
        }),
    )
    .await;
    let assignment_id = assignment["id"].as_i64().unwrap();

    // Complete
    let resp = server
        .post(&format!("/chores/assignments/{assignment_id}/complete"))
        .await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["status"], "completed");

    // Verify via list
    let assignments: Vec<serde_json::Value> = server
        .get("/chores/assignments?week=2026-03-16")
        .await
        .json();
    assert_eq!(assignments[0]["completed"], true);

    // Uncomplete
    let resp = server
        .post(&format!("/chores/assignments/{assignment_id}/uncomplete"))
        .await;
    resp.assert_status_ok();

    let assignments: Vec<serde_json::Value> = server
        .get("/chores/assignments?week=2026-03-16")
        .await
        .json();
    assert_eq!(assignments[0]["completed"], false);
}

// ═══════════════════════════════════════════════════════════════════════
// 4. Meta-chore pick
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_pick_and_clear_pick() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let person_id = insert_person(&pool, "Alice", "#ff0000").await;

    // Create a meta-chore and a bonus chore
    let meta_chore = create_chore_json(
        &server,
        json!({
            "name": "Bonus Pick",
            "chore_type": "meta",
            "pick_from_tags": ["bonus"]
        }),
    )
    .await;
    let meta_chore_id = meta_chore["id"].as_i64().unwrap();

    let bonus_chore =
        create_chore_json(&server, json!({"name": "Water Plants", "tags": ["bonus"]})).await;
    let bonus_chore_id = bonus_chore["id"].as_i64().unwrap();

    // Create assignment for the meta-chore
    let assignment = create_assignment_json(
        &server,
        json!({
            "chore_id": meta_chore_id,
            "person_id": person_id,
            "week_of": "2026-03-16",
            "day_of_week": 0
        }),
    )
    .await;
    let assignment_id = assignment["id"].as_i64().unwrap();

    // Pick the bonus chore
    let resp = server
        .post(&format!("/chores/assignments/{assignment_id}/pick"))
        .json(&json!({"chore_id": bonus_chore_id}))
        .await;
    resp.assert_status_ok();

    // Verify picked_chore is set
    let assignments: Vec<serde_json::Value> = server
        .get("/chores/assignments?week=2026-03-16")
        .await
        .json();
    assert_eq!(assignments[0]["picked_chore"]["id"], bonus_chore_id);
    assert_eq!(assignments[0]["picked_chore"]["name"], "Water Plants");

    // Clear pick
    let resp = server
        .post(&format!("/chores/assignments/{assignment_id}/clear-pick"))
        .await;
    resp.assert_status_ok();

    // Verify picked_chore is null
    let assignments: Vec<serde_json::Value> = server
        .get("/chores/assignments?week=2026-03-16")
        .await
        .json();
    assert!(assignments[0]["picked_chore"].is_null());
}

// ═══════════════════════════════════════════════════════════════════════
// 5. Week copy
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_week_copy() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let person_id = insert_person(&pool, "Alice", "#ff0000").await;
    let chore = create_chore_json(&server, json!({"name": "Dishes"})).await;
    let chore_id = chore["id"].as_i64().unwrap();

    // Create a meta-chore with a pick to verify pick is cleared on copy
    let meta = create_chore_json(
        &server,
        json!({"name": "Meta", "chore_type": "meta", "pick_from_tags": ["bonus"]}),
    )
    .await;
    let meta_id = meta["id"].as_i64().unwrap();

    let bonus = create_chore_json(&server, json!({"name": "Bonus", "tags": ["bonus"]})).await;
    let bonus_id = bonus["id"].as_i64().unwrap();

    // Create assignments in week A
    create_assignment_json(
        &server,
        json!({
            "chore_id": chore_id,
            "person_id": person_id,
            "week_of": "2026-03-16",
            "day_of_week": 0
        }),
    )
    .await;

    let meta_assignment = create_assignment_json(
        &server,
        json!({
            "chore_id": meta_id,
            "person_id": person_id,
            "week_of": "2026-03-16",
            "day_of_week": 1
        }),
    )
    .await;
    let meta_assignment_id = meta_assignment["id"].as_i64().unwrap();

    // Complete first assignment and pick for meta assignment
    server
        .post(&format!(
            "/chores/assignments/{}/complete",
            // Get the first assignment's id
            {
                let assignments: Vec<serde_json::Value> = server
                    .get("/chores/assignments?week=2026-03-16")
                    .await
                    .json();
                assignments
                    .iter()
                    .find(|a| a["chore"]["name"] == "Dishes")
                    .unwrap()["id"]
                    .as_i64()
                    .unwrap()
            }
        ))
        .await;

    server
        .post(&format!("/chores/assignments/{meta_assignment_id}/pick"))
        .json(&json!({"chore_id": bonus_id}))
        .await;

    // Copy week A to week B
    let resp = server
        .post("/chores/weeks/copy")
        .json(&json!({
            "from_week": "2026-03-16",
            "to_week": "2026-03-23"
        }))
        .await;
    resp.assert_status(StatusCode::CREATED);

    // Verify week B
    let week_b: Vec<serde_json::Value> = server
        .get("/chores/assignments?week=2026-03-23")
        .await
        .json();
    assert_eq!(week_b.len(), 2);

    // All should be uncompleted and have no picked_chore
    for a in &week_b {
        assert_eq!(a["completed"], false);
        assert!(a["picked_chore"].is_null());
        assert_eq!(a["week_of"], "2026-03-23");
    }

    // Same chores and people
    let chore_names: Vec<&str> = week_b
        .iter()
        .map(|a| a["chore"]["name"].as_str().unwrap())
        .collect();
    assert!(chore_names.contains(&"Dishes"));
    assert!(chore_names.contains(&"Meta"));
}

// ═══════════════════════════════════════════════════════════════════════
// 6. Week rotate
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_week_rotate() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let alice_id = insert_person(&pool, "Alice", "#ff0000").await;
    let bob_id = insert_person(&pool, "Bob", "#00ff00").await;

    let chore_a = create_chore_json(&server, json!({"name": "Dishes"})).await;
    let chore_b = create_chore_json(&server, json!({"name": "Trash"})).await;

    // Alice does Dishes on Monday, Bob does Trash on Monday
    create_assignment_json(
        &server,
        json!({
            "chore_id": chore_a["id"],
            "person_id": alice_id,
            "week_of": "2026-03-16",
            "day_of_week": 0
        }),
    )
    .await;
    create_assignment_json(
        &server,
        json!({
            "chore_id": chore_b["id"],
            "person_id": bob_id,
            "week_of": "2026-03-16",
            "day_of_week": 0
        }),
    )
    .await;

    // Rotate
    let resp = server
        .post("/chores/weeks/rotate")
        .json(&json!({"week": "2026-03-16"}))
        .await;
    resp.assert_status_ok();

    // After rotation: Alice->Bob, Bob->Alice
    let assignments: Vec<serde_json::Value> = server
        .get("/chores/assignments?week=2026-03-16")
        .await
        .json();
    assert_eq!(assignments.len(), 2);

    for a in &assignments {
        let chore_name = a["chore"]["name"].as_str().unwrap();
        let person_name = a["person"]["name"].as_str().unwrap();
        match chore_name {
            "Dishes" => assert_eq!(person_name, "Bob", "Dishes should now be Bob's"),
            "Trash" => assert_eq!(person_name, "Alice", "Trash should now be Alice's"),
            _ => panic!("Unexpected chore: {chore_name}"),
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// 7. Today endpoint
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn test_today_endpoint() {
    let (app, pool) = test_app().await;
    let server = TestServer::new(app);

    let person_id = insert_person(&pool, "Alice", "#ff0000").await;
    let chore = create_chore_json(&server, json!({"name": "Dishes"})).await;
    let chore_id = chore["id"].as_i64().unwrap();

    // Compute today's Monday and day_of_week the same way the endpoint does
    let now = chrono::Local::now().naive_local().date();
    let weekday = now.weekday().num_days_from_monday() as i64;
    let monday = now - chrono::Duration::days(weekday);
    let week_of = monday.format("%Y-%m-%d").to_string();
    let day_of_week = weekday as i32;

    create_assignment_json(
        &server,
        json!({
            "chore_id": chore_id,
            "person_id": person_id,
            "week_of": week_of,
            "day_of_week": day_of_week
        }),
    )
    .await;

    let resp = server.get("/chores/today").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();

    assert!(body["persons"].is_array());
    let persons = body["persons"].as_array().unwrap();
    assert_eq!(persons.len(), 1);

    let person = &persons[0];
    assert_eq!(person["person"]["name"], "Alice");
    assert!(person["assignments"].is_array());
    let assignments = person["assignments"].as_array().unwrap();
    assert_eq!(assignments.len(), 1);
    assert_eq!(assignments[0]["chore"]["name"], "Dishes");
    assert_eq!(assignments[0]["completed"], false);

    assert_eq!(body["total_count"], 1);
    assert_eq!(body["completed_count"], 0);
}
