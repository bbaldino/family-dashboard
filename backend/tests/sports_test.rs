use axum_test::TestServer;
use serde_json::json;

// Only `test_app` is needed here; the log-capture helpers this module also
// carries belong to `fetch_test.rs`/`llm_test.rs`.
#[allow(dead_code)]
#[path = "helpers.rs"]
mod helpers;
use helpers::test_app;

/// The third state. `/games` has three distinct empty-ish outcomes and only
/// one of them is a problem:
///
/// 1. nobody has picked any teams — legitimately empty (this test),
/// 2. teams are tracked and nothing is on today — legitimately empty,
/// 3. ESPN refused and there was no stale cache — a failure that used to
///    render identically to 1 and 2, which is how a broken integration hid
///    for weeks.
///
/// So an untracked dashboard must report *nothing* unavailable, otherwise
/// the frontend would cry outage at someone who simply has no teams.
#[tokio::test]
async fn games_reports_nothing_unavailable_when_no_teams_are_tracked() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app);

    let resp = server.get("/sports/games").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();

    assert_eq!(body["games"], json!([]));
    assert_eq!(
        body["unavailableLeagues"],
        json!([]),
        "no tracked teams is a legitimately empty response, not a degraded one"
    );
}

#[test]
fn parse_summary_returns_some_for_sample_fixture() {
    let raw = include_str!("fixtures/mlb_summary_sample.json");
    let value: serde_json::Value = serde_json::from_str(raw).expect("fixture parses");
    let detail =
        dashboard_backend::integrations::sports::transform::parse_summary_to_live_detail(&value);
    assert!(
        detail.is_some(),
        "expected a LiveGameDetail from the sample summary"
    );
}

#[test]
fn parse_summary_returns_none_for_empty_object() {
    let detail = dashboard_backend::integrations::sports::transform::parse_summary_to_live_detail(
        &json!({}),
    );
    assert!(detail.is_none());
}

#[test]
fn test_transform_scoreboard_filters_tracked_teams() {
    // Recent for the same reason as test_transform_game_states: the window
    // filter drops stale games, so a fixed date eventually makes this assert
    // absence instead of filtering.
    let recent = (chrono::Utc::now() - chrono::Duration::hours(1)).to_rfc3339();
    let raw = json!({
        "events": [
            {
                "id": "1",
                "name": "Team A at Team B",
                "date": recent,
                "competitions": [{
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"id": "10", "shortDisplayName": "Team B", "abbreviation": "TB", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "10-5"}]
                        },
                        {
                            "homeAway": "away",
                            "team": {"id": "20", "shortDisplayName": "Team A", "abbreviation": "TA", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "8-7"}]
                        }
                    ],
                    "status": {
                        "type": {"name": "STATUS_SCHEDULED", "shortDetail": "3/16 - 8:00 PM"},
                        "displayClock": "0:00",
                        "period": 0
                    },
                    "broadcasts": [],
                    "venue": {"fullName": "Arena"},
                    "leaders": [],
                    "notes": []
                }]
            },
            {
                "id": "2",
                "name": "Team C at Team D",
                "date": "2026-03-16T21:00:00Z",
                "competitions": [{
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"id": "30", "shortDisplayName": "Team D", "abbreviation": "TD", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "12-3"}]
                        },
                        {
                            "homeAway": "away",
                            "team": {"id": "40", "shortDisplayName": "Team C", "abbreviation": "TC", "logo": ""},
                            "score": "0",
                            "records": [{"summary": "9-6"}]
                        }
                    ],
                    "status": {
                        "type": {"name": "STATUS_SCHEDULED", "shortDetail": "3/16 - 9:00 PM"},
                        "displayClock": "0:00",
                        "period": 0
                    },
                    "broadcasts": [],
                    "venue": {"fullName": "Stadium"},
                    "leaders": [],
                    "notes": []
                }]
            }
        ]
    });

    let tracked = vec!["10".to_string()];
    let games = dashboard_backend::integrations::sports::transform::transform_scoreboard(
        &raw, "nba", &tracked, 48.0,
    );
    assert_eq!(games.len(), 1);
    assert_eq!(games[0].id, "1");
    assert_eq!(games[0].home.id, "10");
}

#[test]
fn test_transform_game_states() {
    // Recent, not fixed. `transform_scoreboard` drops Final and Postponed
    // games older than its window (48h here), so a hardcoded date silently
    // stops exercising those two states the moment it ages past the window —
    // the assertions then fail on absence rather than on a wrong mapping.
    // This test is about status-name -> GameState, so the date has to stay
    // inside the window on every run.
    let recent = (chrono::Utc::now() - chrono::Duration::hours(1)).to_rfc3339();
    let make_event = |id: &str, status_name: &str| {
        json!({
            "id": id,
            "name": "Game",
            "date": recent,
            "competitions": [{
                "competitors": [
                    {
                        "homeAway": "home",
                        "team": {"id": "1", "shortDisplayName": "Home", "abbreviation": "HM", "logo": ""},
                        "score": "100",
                        "records": [{"summary": "10-5"}]
                    },
                    {
                        "homeAway": "away",
                        "team": {"id": "2", "shortDisplayName": "Away", "abbreviation": "AW", "logo": ""},
                        "score": "95",
                        "records": [{"summary": "8-7"}]
                    }
                ],
                "status": {
                    "type": {"name": status_name, "shortDetail": "Detail"},
                    "displayClock": "4:22",
                    "period": 3
                },
                "broadcasts": [],
                "venue": {"fullName": "Arena"},
                "leaders": [],
                "notes": []
            }]
        })
    };

    let raw = json!({
        "events": [
            make_event("1", "STATUS_IN_PROGRESS"),
            make_event("2", "STATUS_FINAL"),
            make_event("3", "STATUS_SCHEDULED"),
            make_event("4", "STATUS_POSTPONED"),
            make_event("5", "STATUS_HALFTIME"),
        ]
    });

    let tracked = vec!["1".to_string(), "2".to_string()];
    let games = dashboard_backend::integrations::sports::transform::transform_scoreboard(
        &raw, "nba", &tracked, 48.0,
    );

    use dashboard_backend::integrations::sports::types::GameState;
    let find_state = |id: &str| games.iter().find(|g| g.id == id).map(|g| &g.state);
    assert_eq!(find_state("1"), Some(&GameState::Live));
    assert_eq!(find_state("2"), Some(&GameState::Final));
    assert_eq!(find_state("3"), Some(&GameState::Upcoming));
    assert_eq!(find_state("4"), Some(&GameState::Postponed));
    assert_eq!(find_state("5"), Some(&GameState::Live)); // HALFTIME is Live
}

#[test]
fn test_transform_teams() {
    let raw = json!({
        "sports": [{
            "leagues": [{
                "teams": [
                    {
                        "team": {
                            "id": "9",
                            "shortDisplayName": "Warriors",
                            "displayName": "Golden State Warriors",
                            "abbreviation": "GSW",
                            "logos": [{"href": "https://example.com/gs.png"}]
                        }
                    },
                    {
                        "team": {
                            "id": "13",
                            "shortDisplayName": "Lakers",
                            "displayName": "Los Angeles Lakers",
                            "abbreviation": "LAL",
                            "logos": [{"href": "https://example.com/lal.png"}]
                        }
                    }
                ]
            }]
        }]
    });

    let teams = dashboard_backend::integrations::sports::transform::transform_teams(&raw, "nba");
    assert_eq!(teams.len(), 2);
    assert_eq!(teams[0].name, "Warriors");
    assert_eq!(teams[0].league, "nba");
    assert_eq!(teams[1].abbreviation, "LAL");
}

#[tokio::test]
async fn test_cache_ttl() {
    let cache = dashboard_backend::integrations::sports::cache::EspnCache::new();
    let data = json!({"test": true});

    cache.set("nba", data.clone()).await;

    assert!(cache.get("nba", 60).await.is_some());
    assert!(cache.get("nba", 0).await.is_none());
    assert!(cache.get_stale("nba").await.is_some());
    assert!(cache.get("xyz", 60).await.is_none());
    assert!(cache.get_stale("xyz").await.is_none());
}

#[tokio::test]
async fn test_cache_live_flag() {
    let cache = dashboard_backend::integrations::sports::cache::EspnCache::new();

    assert!(!cache.has_live_flag().await);
    cache.set_live_flag(true).await;
    assert!(cache.has_live_flag().await);
    cache.set_live_flag(false).await;
    assert!(!cache.has_live_flag().await);
}
