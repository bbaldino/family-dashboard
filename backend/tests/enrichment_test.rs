use dashboard_backend::integrations::sports::enrichment::{
    NewsItem, PriorSeason, RecentGame, TeamEnrichment, render, sport_path,
};

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
