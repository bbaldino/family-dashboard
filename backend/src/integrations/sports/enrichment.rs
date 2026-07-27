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

pub fn parse_recent_games(
    schedule_json: &serde_json::Value,
    team_id: &str,
    limit: usize,
) -> Vec<RecentGame> {
    let mut games: Vec<(String, RecentGame)> = schedule_json
        .get("events")
        .and_then(|e| e.as_array())
        .into_iter()
        .flatten()
        .filter_map(|event| parse_one_event(event, team_id))
        .collect();
    // date sort desc — newest first
    games.sort_by(|a, b| b.0.cmp(&a.0));
    games.into_iter().take(limit).map(|(_, g)| g).collect()
}

fn parse_one_event(event: &serde_json::Value, team_id: &str) -> Option<(String, RecentGame)> {
    let comp = event.get("competitions")?.as_array()?.first()?;
    let status = comp.get("status")?.get("type")?;
    if !status.get("completed")?.as_bool().unwrap_or(false) {
        return None;
    }
    let date = event.get("date")?.as_str()?.to_string();
    let competitors = comp.get("competitors")?.as_array()?;

    let (self_c, opp_c) = if competitors.first()?.get("id")?.as_str()? == team_id {
        (competitors.first()?, competitors.get(1)?)
    } else if competitors.get(1)?.get("id")?.as_str()? == team_id {
        (competitors.get(1)?, competitors.first()?)
    } else {
        return None;
    };

    let team_score = self_c.get("score")?.get("value")?.as_f64()? as i64;
    let opp_score = opp_c.get("score")?.get("value")?.as_f64()? as i64;
    let won = self_c.get("winner")?.as_bool().unwrap_or(false);
    let is_home = self_c.get("homeAway")?.as_str()? == "home";
    let opp_abbr = opp_c
        .get("team")
        .and_then(|t| t.get("abbreviation"))
        .and_then(|a| a.as_str())
        .unwrap_or("?")
        .to_string();

    Some((
        date,
        RecentGame {
            won,
            team_score,
            opp_score,
            opp_abbr,
            is_home,
        },
    ))
}

pub async fn fetch_recent_games(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    team_id: &str,
    current_year: i32,
    limit: usize,
) -> Vec<RecentGame> {
    let mut games =
        fetch_schedule_and_parse(client, sport, league, team_id, current_year, limit).await;
    if games.len() < limit {
        let extra = limit - games.len();
        let last_year =
            fetch_schedule_and_parse(client, sport, league, team_id, current_year - 1, limit).await;
        // last-year games are older by definition; append after this-year games.
        games.extend(last_year.into_iter().take(extra));
    }
    games
}

async fn fetch_schedule_and_parse(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    team_id: &str,
    year: i32,
    limit: usize,
) -> Vec<RecentGame> {
    let url = format!(
        "https://site.web.api.espn.com/apis/site/v2/sports/{}/{}/teams/{}/schedule?season={}",
        sport, league, team_id, year
    );
    match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => match r.json::<serde_json::Value>().await {
            Ok(json) => parse_recent_games(&json, team_id, limit),
            Err(e) => {
                tracing::warn!(url = %url, error = %e, "enrichment: schedule parse failed");
                Vec::new()
            }
        },
        Ok(r) => {
            tracing::info!(url = %url, status = %r.status(), "enrichment: schedule non-200");
            Vec::new()
        }
        Err(e) => {
            tracing::warn!(url = %url, error = %e, "enrichment: schedule request failed");
            Vec::new()
        }
    }
}
