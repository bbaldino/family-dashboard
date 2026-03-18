use serde::{Deserialize, Serialize};

/// A team in a game (home or away)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTeam {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
    pub logo: String,
    pub record: Option<String>,
    pub score: Option<i32>,
    pub winner: Option<bool>,
}

/// A stat leader line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Leader {
    pub team: String,
    pub name: String,
    pub stats: String,
}

/// A linescore entry (one period/inning)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinescoreEntry {
    pub period: i32,
    pub home_score: String,
    pub away_score: String,
}

/// A probable pitcher or featured athlete
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameAthlete {
    pub name: String,
    pub stats: Option<String>,
    pub role: String,
}

/// Game state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GameState {
    Live,
    Final,
    Upcoming,
    Postponed,
}

/// A single game in our API response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub league: String,
    pub state: GameState,
    pub name: String,
    pub start_time: String,
    pub venue: Option<String>,
    pub broadcast: Option<String>,
    pub playoff_round: Option<String>,
    pub home: GameTeam,
    pub away: GameTeam,
    pub clock: Option<String>,
    pub period: Option<i32>,
    pub period_label: Option<String>,
    pub leaders: Vec<Leader>,
    pub all_leaders: Vec<Leader>,
    pub situation: Option<String>,
    pub linescores: Vec<LinescoreEntry>,
    pub athletes: Vec<GameAthlete>,
    pub espn_url: Option<String>,
}

/// Response for GET /api/sports/games
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GamesResponse {
    pub games: Vec<Game>,
    pub has_live: bool,
}

/// A team for the team picker
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamInfo {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub abbreviation: String,
    pub logo: String,
    pub league: String,
}

/// Response for GET /api/sports/teams
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamsResponse {
    pub teams: Vec<TeamInfo>,
}

/// Tracked team entry stored in config JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackedTeam {
    pub league: String,
    pub team_id: String,
}

/// Supported leagues
pub const LEAGUES: &[(&str, &str, &str)] = &[
    ("nba", "basketball", "nba"),
    ("nfl", "football", "nfl"),
    ("mlb", "baseball", "mlb"),
    ("nhl", "hockey", "nhl"),
];
