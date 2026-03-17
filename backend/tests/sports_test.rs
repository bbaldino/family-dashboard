mod helpers;

use serde_json::json;

#[test]
fn test_transform_scoreboard_filters_tracked_teams() {
    let raw = json!({
        "events": [
            {
                "id": "1",
                "name": "Team A at Team B",
                "date": "2026-03-16T20:00:00Z",
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
    let make_event = |id: &str, status_name: &str| {
        json!({
            "id": id,
            "name": "Game",
            "date": "2026-03-16T20:00:00Z",
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
