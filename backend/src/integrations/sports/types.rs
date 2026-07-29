use serde::{Deserialize, Serialize};

/// A team in a game (home or away)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameTeam {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
    pub logo: String,
    pub record: Option<String>,
    pub score: Option<i32>,
    pub winner: Option<bool>,
    /// Primary team color as a hex string without leading '#', e.g. "0e3386".
    pub color: Option<String>,
    /// Alternate/secondary team color, same format.
    pub alt_color: Option<String>,
    /// Total hits in the current/just-played game (MLB scoreboard).
    pub hits: Option<u32>,
    /// Total errors in the current/just-played game (MLB scoreboard).
    pub errors: Option<u32>,
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
    pub athlete_id: Option<String>,
    pub team: Option<String>, // "home" | "away" (None for featured athletes that aren't per-team)
    pub headshot_url: Option<String>,
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

/// Sport-specific live game situation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum GameSituation {
    Mlb {
        outs: u8,
        on_first: bool,
        on_second: bool,
        on_third: bool,
        balls: Option<u8>,
        strikes: Option<u8>,
        batter: Option<String>,
        pitcher: Option<String>,
    },
    Nba {},
    Nhl {},
    Nfl {},
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
    pub situation: Option<GameSituation>,
    pub last_play: Option<String>,
    pub headline: Option<String>,
    pub linescores: Vec<LinescoreEntry>,
    pub athletes: Vec<GameAthlete>,
    pub espn_url: Option<String>,
    pub live_detail: Option<LiveGameDetail>,
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

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WinProbability {
    pub home: f32,
    pub away: f32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PitcherInfo {
    pub id: String,
    pub name: String,
    pub headshot_url: Option<String>,
    pub hand: Option<String>,
    pub era: Option<String>,
    pub pitches_today: Option<u32>,
    pub record: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatterInfo {
    pub id: String,
    pub name: String,
    pub headshot_url: Option<String>,
    pub hand: Option<String>,
    pub avg: Option<String>,
    pub hr: Option<u32>,
    pub rbi: Option<u32>,
    pub today_line: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Matchup {
    pub pitcher: PitcherInfo,
    pub batter: BatterInfo,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Play {
    pub id: String,
    pub text: String,
    pub inning_half: Option<String>,
    pub inning_number: Option<u32>,
    pub scoring: bool,
    pub team_id: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameLeader {
    pub category: String, // "Hitting" | "Pitching"
    pub player_name: String,
    pub display_value: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameLeaders {
    pub home: Vec<GameLeader>,
    pub away: Vec<GameLeader>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MlbLiveDetail {
    pub matchup: Option<Matchup>,
    pub recent_plays: Vec<Play>,
    /// All scoring plays in chronological order. Used as a fallback when
    /// scoring_recap isn't (yet) available.
    pub scoring_plays: Vec<Play>,
    /// Scoring plays in the current, incomplete half-inning — shown raw
    /// next to the recap of everything that came before.
    pub in_progress_scoring: Vec<Play>,
    /// LLM-generated narrative summary of every scoring play in completed
    /// half-innings. None if not (yet) generated; the cache fills it
    /// asynchronously after an inning transition.
    pub scoring_recap: Option<ScoringRecap>,
    pub leaders: GameLeaders,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScoringRecap {
    pub text: String,
    pub through_inning: Option<InningRef>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InningRef {
    pub half: String,
    pub number: u32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(tag = "sport", rename_all = "lowercase")]
pub enum SportSpecificLive {
    Mlb(MlbLiveDetail),
    // Nba(NbaLiveDetail) — future
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LiveGameDetail {
    pub win_probability: Option<WinProbability>,
    #[serde(flatten)]
    pub sport_specific: SportSpecificLive,
}
