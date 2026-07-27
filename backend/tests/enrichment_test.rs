use dashboard_backend::integrations::sports::enrichment::{
    NewsItem, PriorSeason, RecentGame, TeamEnrichment, parse_recent_games, render, sport_path,
};
use std::fs;

#[test]
fn sport_path_maps_known_leagues() {
    assert_eq!(sport_path("mlb"), Some(("baseball", "mlb")));
    assert_eq!(sport_path("NBA"), Some(("basketball", "nba")));
    assert_eq!(sport_path("nfl"), Some(("football", "nfl")));
    assert_eq!(sport_path("cricket"), None);
}

#[test]
fn render_empty_enrichment_is_empty() {
    let e = TeamEnrichment::default();
    assert_eq!(render(&e, "Dodgers"), "");
}

#[test]
fn render_combines_all_three_blocks() {
    let e = TeamEnrichment {
        recent_games: vec![RecentGame {
            won: true,
            team_score: 5,
            opp_score: 2,
            opp_abbr: "SF".into(),
            is_home: true,
        }],
        prior_season: Some(PriorSeason {
            season: 2025,
            record: "93-69".into(),
            postseason_games: 17,
        }),
        news: vec![NewsItem {
            headline: "Dodgers beat Mets 8-3".into(),
        }],
    };
    let out = render(&e, "Dodgers");
    assert!(out.contains("Dodgers last 1: W 5-2 vs SF"));
    assert!(out.contains("Dodgers 2025: 93-69, 17 postseason games"));
    assert!(out.contains("- Dodgers beat Mets 8-3"));
}

#[test]
fn parse_recent_games_extracts_last_completed_games() {
    let raw = fs::read_to_string("tests/fixtures/enrichment/espn_schedule_dodgers_2025.json")
        .expect("fixture read");
    let json: serde_json::Value = serde_json::from_str(&raw).expect("fixture parse");
    let games = parse_recent_games(&json, "19", 5);
    assert_eq!(games.len(), 5, "want 5 recent completed games");
    assert!(
        !games[0].opp_abbr.is_empty() && games[0].opp_abbr != "?",
        "want a real opponent abbreviation, got: {:?}",
        games[0].opp_abbr,
    );
    for g in &games {
        assert!(g.team_score >= 0);
        assert!(g.opp_score >= 0);
    }
}

#[test]
fn parse_recent_games_skips_incomplete_events() {
    let raw = fs::read_to_string("tests/fixtures/enrichment/espn_schedule_dodgers_2026.json")
        .expect("fixture read");
    let json: serde_json::Value = serde_json::from_str(&raw).expect("fixture parse");

    let expected_completed = json["events"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|e| {
            e["competitions"][0]["status"]["type"]["completed"]
                .as_bool()
                .unwrap_or(false)
        })
        .count();

    let games = parse_recent_games(&json, "19", 10_000);
    assert_eq!(games.len(), expected_completed);
}

#[test]
fn parse_recent_games_returns_empty_for_wrong_team() {
    let raw = fs::read_to_string("tests/fixtures/enrichment/espn_schedule_dodgers_2025.json")
        .expect("fixture read");
    let json: serde_json::Value = serde_json::from_str(&raw).expect("fixture parse");
    let games = parse_recent_games(&json, "9999", 5);
    assert!(games.is_empty(), "no games for a team not in the schedule");
}
