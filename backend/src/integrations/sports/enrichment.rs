use serde::Serialize;

#[derive(Debug, Default, Clone, Serialize)]
pub struct TeamEnrichment {
    pub recent_games: Vec<RecentGame>,
    pub prior_season: Option<PriorSeason>,
    pub news: Vec<NewsItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecentGame {
    pub won: bool,
    pub team_score: i64,
    pub opp_score: i64,
    pub opp_abbr: String,
    pub is_home: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PriorSeason {
    pub season: i32,
    pub record: String,
    pub postseason_games: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct NewsItem {
    pub headline: String,
}

pub fn sport_path(league: &str) -> Option<(&'static str, &'static str)> {
    match league.to_ascii_lowercase().as_str() {
        "mlb" => Some(("baseball", "mlb")),
        "nba" => Some(("basketball", "nba")),
        "nfl" => Some(("football", "nfl")),
        "nhl" => Some(("hockey", "nhl")),
        _ => None,
    }
}

pub fn render(enrichment: &TeamEnrichment, team_name: &str) -> String {
    let mut parts: Vec<String> = Vec::new();
    if !enrichment.recent_games.is_empty() {
        parts.push(render_recent_games(team_name, &enrichment.recent_games));
    }
    if let Some(prior) = &enrichment.prior_season {
        parts.push(render_prior_season(team_name, prior));
    }
    if !enrichment.news.is_empty() {
        parts.push(render_news(team_name, &enrichment.news));
    }
    parts.join("\n")
}

fn render_recent_games(team_name: &str, games: &[RecentGame]) -> String {
    let items: Vec<String> = games
        .iter()
        .map(|g| {
            let vs_at = if g.is_home { "vs" } else { "at" };
            let wl = if g.won { "W" } else { "L" };
            format!(
                "{} {}-{} {} {}",
                wl, g.team_score, g.opp_score, vs_at, g.opp_abbr
            )
        })
        .collect();
    format!("{} last {}: {}", team_name, items.len(), items.join(", "))
}

fn render_prior_season(team_name: &str, prior: &PriorSeason) -> String {
    let post = match prior.postseason_games {
        0 => "missed playoffs".to_string(),
        n => format!("{} postseason games", n),
    };
    format!("{} {}: {}, {}", team_name, prior.season, prior.record, post)
}

fn render_news(team_name: &str, news: &[NewsItem]) -> String {
    let bullets: Vec<String> = news.iter().map(|n| format!("- {}", n.headline)).collect();
    format!("{} news:\n{}", team_name, bullets.join("\n"))
}
