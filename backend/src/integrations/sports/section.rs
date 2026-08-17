//! Aggregation for the Sporting Page — the `/sports/section` endpoint.
//!
//! Turns the per-league ESPN feeds (scoreboard, team detail, standings, news,
//! season leaders) into one `SportsSection`: leagues ranked by season type,
//! the top one or two rendered as full tracks, the rest as brief "elsewhere"
//! entries. The frontend lays this out verbatim; see `section-types.ts` there
//! for the matching shape.

use serde::Serialize;

use super::espn;

// ─── Output shape (mirrors the frontend `SportsSection`) ─────────────────

#[derive(Serialize, Default)]
pub struct SportsSection {
    pub fixtures: Vec<Fixture>,
    pub clock: Vec<ClockEntry>,
    pub standfirst: String,
    pub leagues: Vec<SportsTrack>,
    pub elsewhere: Vec<ElsewhereEntry>,
}

#[derive(Serialize)]
pub struct Fixture {
    pub team: String,
    pub detail: String,
}

#[derive(Serialize)]
pub struct ClockEntry {
    pub league: String,
    pub detail: String,
}

#[derive(Serialize)]
pub struct SportsTrack {
    pub league: String,
    pub team: String,
    #[serde(rename = "seasonType")]
    pub season_type: String,
    pub record: String,
    pub standing: String,
    pub home: String,
    pub away: String,
    pub next: String,
    pub headline: String,
    pub dek: String,
    pub caption: String,
    pub more: Vec<MoreStory>,
    pub table: StandingsTable,
    #[serde(rename = "scoresLabel")]
    pub scores_label: String,
    pub scores: Vec<ScoreRow>,
    pub leaders: Vec<LeaderCategory>,
    pub hot: Vec<StreakRow>,
    pub cold: Vec<StreakRow>,
}

#[derive(Serialize)]
pub struct MoreStory {
    pub h: String,
    pub dek: String,
    pub meta: String,
}

#[derive(Serialize)]
pub struct StandingsTable {
    pub title: String,
    pub sub: String,
    pub rows: Vec<TableRow>,
}

#[derive(Serialize)]
pub struct TableRow {
    pub t: String,
    pub w: i64,
    pub l: i64,
    pub pct: String,
    pub gb: String,
    pub strk: String,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub me: bool,
}

#[derive(Serialize)]
pub struct ScoreRow {
    pub a: String,
    #[serde(rename = "as")]
    pub away_score: i64,
    pub h: String,
    pub hs: i64,
    pub star: String,
    pub line: String,
}

#[derive(Serialize, serde::Deserialize)]
pub struct LeaderCategory {
    pub cat: String,
    pub abbr: String,
    /// `[name, team, value]` per leader.
    pub rows: Vec<[String; 3]>,
}

#[derive(Serialize)]
pub struct StreakRow {
    pub t: String,
    pub rec: String,
    pub strk: String,
}

#[derive(Serialize)]
pub struct ElsewhereEntry {
    pub league: String,
    pub team: String,
    /// `null` off-season, a real `0-0` in preseason.
    pub record: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    pub note: String,
    pub story: BriefStory,
}

#[derive(Serialize)]
pub struct BriefStory {
    pub h: String,
    pub meta: String,
}

// ─── Season ranking ──────────────────────────────────────────────────────

/// Where a season type sits in the priority order that decides which leagues
/// lead. Lower is higher priority: a regular season outranks a preseason, so a
/// league mid-season is never buried under one only in exhibition play. An
/// unknown type sorts last, above nothing.
pub fn season_rank(season_type: &str) -> u8 {
    match season_type {
        "Regular Season" => 0,
        "Postseason" => 1,
        "Preseason" => 2,
        // off-season / unknown
        _ => 3,
    }
}

/// The masthead's season-clock detail for one league, from its `season` block.
///
/// - before the season opens → "N days out" (the countdown)
/// - preseason → "preseason" (plus the week, when the feed carries one)
/// - regular season with a week (football) → "week N of M"
/// - regular season without one (baseball, basketball) → "N days left"
/// - anything else → the season type, lowercased
///
/// `now`, `start`, `end` are dates; `week` is the current week number when the
/// feed reports one (football only), and `total_weeks` the calendar length.
pub fn clock_detail(
    season_type: &str,
    now: chrono::NaiveDate,
    start: Option<chrono::NaiveDate>,
    end: Option<chrono::NaiveDate>,
    week: Option<i64>,
    total_weeks: Option<usize>,
) -> String {
    if let Some(start) = start
        && now < start
    {
        let days = (start - now).num_days();
        return format!("{days} days out");
    }
    match season_type {
        "Preseason" => match week {
            Some(w) => format!("preseason wk {w}"),
            None => "preseason".to_string(),
        },
        "Regular Season" => match (week, total_weeks) {
            (Some(w), Some(total)) => format!("week {w} of {total}"),
            _ => match end {
                Some(end) if end >= now => format!("{} days left", (end - now).num_days()),
                _ => "regular season".to_string(),
            },
        },
        other => other.to_lowercase(),
    }
}

// ─── Team detail ─────────────────────────────────────────────────────────

pub struct TeamDetail {
    pub record: String,
    pub standing: String,
    pub home: String,
    pub away: String,
    pub next: String,
}

fn record_summary(team: &serde_json::Value, kind: &str) -> String {
    team.get("record")
        .and_then(|r| r.get("items"))
        .and_then(|i| i.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|it| it.get("type").and_then(|t| t.as_str()) == Some(kind))
        })
        .and_then(|it| it.get("summary"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string()
}

/// The lead's team facts from a `/teams/{id}` payload. `next` is the next
/// event's short name with its date (`MIL @ LAD · Sun Aug 16`), or empty when
/// none is scheduled. ESPN's road split is filed under `"road"`; the frontend
/// labels it "Away".
pub fn parse_team_detail(team: &serde_json::Value) -> TeamDetail {
    let next = team
        .get("nextEvent")
        .and_then(|n| n.as_array())
        .and_then(|arr| arr.first())
        .map(|e| {
            let name = e
                .get("shortName")
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .to_string();
            let when = e
                .get("date")
                .and_then(|d| d.as_str())
                // ESPN emits minute-precision timestamps (`...T20:10Z`) that
                // strict RFC3339 rejects; `parse_espn_timestamp` handles both.
                .and_then(super::transform::parse_espn_timestamp)
                .map(|dt| dt.format("%a %b %-d").to_string())
                .unwrap_or_default();
            if when.is_empty() {
                name
            } else {
                format!("{name} · {when}")
            }
        })
        .unwrap_or_default();

    TeamDetail {
        record: record_summary(team, "total"),
        standing: team
            .get("standingSummary")
            .and_then(|s| s.as_str())
            .unwrap_or("")
            .to_string(),
        home: record_summary(team, "home"),
        away: record_summary(team, "road"),
        next,
    }
}

// ─── Standings ───────────────────────────────────────────────────────────

struct StandingEntry {
    abbr: String,
    division: String,
    w: i64,
    l: i64,
    pct: String,
    gb: String,
    strk: String,
}

/// Flatten a standings tree into `(division_name, entry)` pairs. ESPN nests
/// league → division → entries; the division is the deepest group that carries
/// entries, which is what a table wants to lead with.
fn flatten_standings(node: &serde_json::Value, division: &str, out: &mut Vec<StandingEntry>) {
    if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
        for child in children {
            let name = child
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or(division);
            if let Some(entries) = child
                .get("standings")
                .and_then(|s| s.get("entries"))
                .and_then(|e| e.as_array())
            {
                for e in entries {
                    if let Some(entry) = parse_standing_entry(e, name) {
                        out.push(entry);
                    }
                }
            }
            flatten_standings(child, name, out);
        }
    }
}

fn stat<'a>(e: &'a serde_json::Value, name: &str) -> Option<&'a serde_json::Value> {
    e.get("stats")
        .and_then(|s| s.as_array())?
        .iter()
        .find(|s| s.get("name").and_then(|n| n.as_str()) == Some(name))
        .and_then(|s| s.get("displayValue"))
}

fn parse_standing_entry(e: &serde_json::Value, division: &str) -> Option<StandingEntry> {
    let abbr = e
        .get("team")
        .and_then(|t| t.get("abbreviation"))
        .and_then(|a| a.as_str())?
        .to_string();
    let num = |name: &str| {
        stat(e, name)
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<i64>().ok())
    };
    Some(StandingEntry {
        abbr,
        division: division.to_string(),
        w: num("wins").unwrap_or(0),
        l: num("losses").unwrap_or(0),
        pct: stat(e, "winPercent")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        // ESPN gives the leader "-"; the page reads better with an em dash.
        gb: match stat(e, "gamesBehind").and_then(|v| v.as_str()) {
            Some("-") | Some("0") | None => "—".to_string(),
            Some(other) => other.to_string(),
        },
        strk: stat(e, "streak")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    })
}

pub struct StandingsResult {
    pub title: String,
    pub rows: Vec<TableRow>,
    pub hot: Vec<StreakRow>,
    pub cold: Vec<StreakRow>,
}

/// The followed team's division table, plus league-wide "hot"/"cold" streak
/// lists. The table shows the team's own division (its actual race); hot/cold
/// scan every team in the league, since a form sidebar is about the league, not
/// one division.
pub fn parse_standings(standings: &serde_json::Value, team_abbr: &str) -> StandingsResult {
    let mut all = Vec::new();
    flatten_standings(standings, "", &mut all);

    let my_division = all
        .iter()
        .find(|e| e.abbr == team_abbr)
        .map(|e| e.division.clone())
        .unwrap_or_default();

    let rows: Vec<TableRow> = all
        .iter()
        .filter(|e| e.division == my_division)
        .map(|e| TableRow {
            t: e.abbr.clone(),
            w: e.w,
            l: e.l,
            pct: e.pct.clone(),
            gb: e.gb.clone(),
            strk: e.strk.clone(),
            me: e.abbr == team_abbr,
        })
        .collect();

    // Streak lists, league-wide. A streak is like "W8" / "L3"; sort by its
    // magnitude so the longest runs lead.
    let magnitude = |s: &str| s.get(1..).and_then(|n| n.parse::<i64>().ok()).unwrap_or(0);
    let mut hot: Vec<&StandingEntry> = all.iter().filter(|e| e.strk.starts_with('W')).collect();
    let mut cold: Vec<&StandingEntry> = all.iter().filter(|e| e.strk.starts_with('L')).collect();
    hot.sort_by_key(|e| std::cmp::Reverse(magnitude(&e.strk)));
    cold.sort_by_key(|e| std::cmp::Reverse(magnitude(&e.strk)));

    let to_streak = |e: &&StandingEntry| StreakRow {
        t: e.abbr.clone(),
        rec: format!("{}-{}", e.w, e.l),
        strk: e.strk.clone(),
    };

    StandingsResult {
        title: my_division,
        rows,
        hot: hot.iter().take(3).map(to_streak).collect(),
        cold: cold.iter().take(3).map(to_streak).collect(),
    }
}

// ─── Scores + standouts ──────────────────────────────────────────────────

fn competitor<'a>(comp: &'a serde_json::Value, side: &str) -> Option<&'a serde_json::Value> {
    comp.get("competitors")?
        .as_array()?
        .iter()
        .find(|c| c.get("homeAway").and_then(|h| h.as_str()) == Some(side))
}

fn abbr_score(c: &serde_json::Value) -> (String, i64) {
    let abbr = c
        .get("team")
        .and_then(|t| t.get("abbreviation"))
        .and_then(|a| a.as_str())
        .unwrap_or("")
        .to_string();
    let score = c
        .get("score")
        .and_then(|s| s.as_str())
        .and_then(|s| s.parse::<i64>().ok())
        .or_else(|| c.get("score").and_then(|s| s.as_i64()))
        .unwrap_or(0);
    (abbr, score)
}

/// The standout performer for a finished game — the first entry of the first
/// leader category the competition carries. Free: the scoreboard already ships
/// it, no summary fetch needed.
fn game_standout(comp: &serde_json::Value) -> (String, String) {
    let leader = comp
        .get("leaders")
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.first())
        .and_then(|c| c.get("leaders"))
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.first());
    let name = leader
        .and_then(|l| l.get("athlete"))
        .and_then(|a| a.get("shortName"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();
    let line = leader
        .and_then(|l| l.get("displayValue"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    (name, line)
}

/// Every finished game on a scoreboard as a `ScoreRow`, the followed team's own
/// game first — it is the one row that must never fall past the display cap.
pub fn parse_scores(scoreboard: &serde_json::Value, team_abbr: &str) -> Vec<ScoreRow> {
    let mut rows: Vec<ScoreRow> = scoreboard
        .get("events")
        .and_then(|e| e.as_array())
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter_map(|event| {
            let comp = event.get("competitions")?.as_array()?.first()?;
            let state = event
                .get("status")
                .and_then(|s| s.get("type"))
                .and_then(|t| t.get("state"))
                .and_then(|s| s.as_str());
            if state != Some("post") {
                return None;
            }
            let (a, away_score) = abbr_score(competitor(comp, "away")?);
            let (h, hs) = abbr_score(competitor(comp, "home")?);
            let (star, line) = game_standout(comp);
            Some(ScoreRow {
                a,
                away_score,
                h,
                hs,
                star,
                line,
            })
        })
        .collect();

    // The followed team's game leads the slate.
    rows.sort_by_key(|r| r.a != team_abbr && r.h != team_abbr);
    rows
}

// ─── News ────────────────────────────────────────────────────────────────

/// Normalise a string to lowercase alphanumerics, for comparing a headline
/// against its description.
fn normalise(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

/// A description that only echoes its headline carries no information as text —
/// mostly video segments whose "description" repeats the title. Drop those.
fn is_headline_echo(headline: &str, description: &str) -> bool {
    let (h, d) = (normalise(headline), normalise(description));
    d.is_empty() || d == h || h.contains(&d) || d.contains(&h)
}

/// The number of teams an article is tagged with. A genuine team story tags one
/// or two; a league round-up tags twenty or thirty. `<= 3` separates them.
fn team_tag_count(article: &serde_json::Value) -> usize {
    article
        .get("categories")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|c| c.get("type").and_then(|t| t.as_str()) == Some("team"))
                .count()
        })
        .unwrap_or(0)
}

/// ESPN's recap deks open with a stray em-dash byline marker (`"— Logan
/// Henderson allowed one run…"`). Strip it so the dek reads clean — and so the
/// standfirst, which is the lead dek, doesn't collide with the frontend's own
/// trailing "— warmly, the house".
fn clean_dek(dek: &str) -> String {
    dek.trim_start_matches('—').trim_start().to_string()
}

pub struct NewsShape {
    pub headline: String,
    pub dek: String,
    /// The lead story's meta line, for an Elsewhere entry that shows one story.
    pub lead_meta: String,
    pub more: Vec<MoreStory>,
}

fn article_meta(article: &serde_json::Value) -> String {
    let when = article
        .get("published")
        .and_then(|p| p.as_str())
        .and_then(super::transform::parse_espn_timestamp)
        .map(|dt| dt.format("%a %b %-d").to_string())
        .unwrap_or_default();
    let kind = article.get("type").and_then(|t| t.as_str()).unwrap_or("");
    match (when.is_empty(), kind.is_empty()) {
        (false, false) => format!("{when} · {kind}"),
        (false, true) => when,
        _ => kind.to_string(),
    }
}

/// The lead story and two follow-ups from a team's news feed, after dropping
/// league round-ups (too many team tags) and headline-echo items (no text
/// beyond the headline). Everything left is a real, readable team story.
pub fn shape_news(articles: &[serde_json::Value]) -> NewsShape {
    let kept: Vec<&serde_json::Value> = articles
        .iter()
        .filter(|a| {
            let headline = a.get("headline").and_then(|h| h.as_str()).unwrap_or("");
            let desc = a.get("description").and_then(|d| d.as_str()).unwrap_or("");
            !headline.is_empty() && team_tag_count(a) <= 3 && !is_headline_echo(headline, desc)
        })
        .collect();

    let text = |a: &serde_json::Value, key: &str| {
        a.get(key)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };

    NewsShape {
        headline: kept
            .first()
            .map(|a| text(a, "headline"))
            .unwrap_or_default(),
        dek: kept
            .first()
            .map(|a| clean_dek(&text(a, "description")))
            .unwrap_or_default(),
        lead_meta: kept.first().map(|a| article_meta(a)).unwrap_or_default(),
        more: kept
            .iter()
            .skip(1)
            .take(2)
            .map(|a| MoreStory {
                h: text(a, "headline"),
                dek: clean_dek(&text(a, "description")),
                meta: article_meta(a),
            })
            .collect(),
    }
}

// ─── Season block (from the scoreboard) ──────────────────────────────────

pub struct SeasonInfo {
    pub season_type: String,
    pub start: Option<chrono::NaiveDate>,
    pub end: Option<chrono::NaiveDate>,
    pub week: Option<i64>,
    pub total_weeks: Option<usize>,
    pub year: i32,
}

fn parse_date(v: Option<&serde_json::Value>) -> Option<chrono::NaiveDate> {
    v.and_then(|d| d.as_str())
        .map(|s| &s[..s.len().min(10)])
        .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
}

/// The season block every scoreboard carries — the source for both the ranking
/// (via `season.type.name`) and the masthead clock.
pub fn parse_season(scoreboard: &serde_json::Value) -> SeasonInfo {
    let league = scoreboard
        .get("leagues")
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.first());
    let season = league.and_then(|l| l.get("season"));
    let season_type = season
        .and_then(|s| s.get("type"))
        .and_then(|t| t.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .to_string();
    SeasonInfo {
        season_type,
        start: parse_date(season.and_then(|s| s.get("startDate"))),
        end: parse_date(season.and_then(|s| s.get("endDate"))),
        week: scoreboard
            .get("week")
            .and_then(|w| w.get("number"))
            .and_then(|n| n.as_i64()),
        total_weeks: league
            .and_then(|l| l.get("calendar"))
            .and_then(|c| c.as_array())
            .map(|a| a.len()),
        year: season
            .and_then(|s| s.get("year"))
            .and_then(|y| y.as_i64())
            .unwrap_or(0) as i32,
    }
}

// ─── Leaders ─────────────────────────────────────────────────────────────

/// The leader categories to show for a league, as
/// `(espn_category_name, display_name, abbreviation)`. League-specific — a
/// baseball page leads with HR/AVG/ERA, a basketball one with PPG/RPG/APG — and
/// deliberately ordered, since the frontend takes the first few. An empty slice
/// (a league we have no map for, or one whose season hasn't produced leaders
/// yet) yields no leaders, which the page renders as simply absent.
fn league_leader_cats(league: &str) -> &'static [(&'static str, &'static str, &'static str)] {
    match league {
        "mlb" => &[
            ("homeRuns", "Home runs", "HR"),
            ("avg", "Batting average", "AVG"),
            ("RBIs", "Runs batted in", "RBI"),
            ("ERA", "Earned run average", "ERA"),
            ("strikeouts", "Strikeouts", "K"),
        ],
        "nba" => &[
            ("pointsPerGame", "Points", "PPG"),
            ("reboundsPerGame", "Rebounds", "RPG"),
            ("assistsPerGame", "Assists", "APG"),
            ("fieldGoalPercentage", "Field goal %", "FG%"),
            ("stealsPerGame", "Steals", "SPG"),
        ],
        "nhl" => &[
            ("goals", "Goals", "G"),
            ("assists", "Assists", "A"),
            ("points", "Points", "PTS"),
            ("wins", "Wins", "W"),
            ("savePct", "Save %", "SV%"),
        ],
        "nfl" => &[
            ("passingYards", "Passing yards", "YDS"),
            ("rushingYards", "Rushing yards", "YDS"),
            ("receivingYards", "Receiving yards", "YDS"),
            ("passingTouchdowns", "Passing TDs", "TD"),
            ("totalTackles", "Tackles", "TCK"),
        ],
        _ => &[],
    }
}

/// The headline figure for a leader, formatted for its category. The core API's
/// own `displayValue` is the athlete's whole stat line, not this one number, so
/// the category's `value` is formatted here instead: batting-style rates to a
/// leading-dot `.322`, ERA-style to two places, per-game to one, counts whole.
fn format_leader_value(category: &str, value: f64) -> String {
    match category {
        "avg"
        | "onBasePct"
        | "slugAvg"
        | "opponentAvg"
        | "fieldGoalPercentage"
        | "FreeThrowPct"
        | "3PointPct"
        | "savePct" => {
            let s = format!("{value:.3}");
            s.strip_prefix('0').map(str::to_string).unwrap_or(s)
        }
        "ERA" | "WHIP" | "OPS" | "avgGoalsAgainst" => format!("{value:.2}"),
        c if c.ends_with("PerGame") => format!("{value:.1}"),
        _ => format!("{}", value.round() as i64),
    }
}

/// The resolved leader board for a league, cached — athlete and team are
/// `$ref`s in the core API, so five categories three deep is ~30 fetches. A day
/// is far fresher than leaders move, and one request warms the whole page.
async fn build_leaders(
    state: &super::routes::SportsState,
    sport: &str,
    league: &str,
    year: i32,
) -> Vec<LeaderCategory> {
    let cats = league_leader_cats(league);
    if cats.is_empty() || year == 0 {
        return Vec::new();
    }

    let cache_key = format!("leaders:{league}:{year}");
    if let Some(cached) = state.cache.get(&cache_key, 12 * 3600).await
        && let Ok(parsed) = serde_json::from_value::<Vec<LeaderCategory>>(cached)
    {
        return parsed;
    }

    let index = match espn::fetch_json(&state.client, &espn::leaders_url(sport, league, year)).await
    {
        Ok(v) => v,
        // Leaders are enrichment: a league whose season hasn't produced them yet
        // (a 404) leaves the column empty rather than failing the whole page.
        Err(_) => return Vec::new(),
    };

    // Resolve each `$ref` at most once — athletes and teams recur across
    // categories (a slugger tops HR and AVG both).
    let mut memo: std::collections::HashMap<String, serde_json::Value> =
        std::collections::HashMap::new();
    // Two passes: gather every ref and fetch each once into `memo`, then build
    // reading from it. Kept separate so the fetch loop's `&mut memo` never
    // overlaps the build pass's reads.
    let empty = Vec::new();
    let index_cats = index
        .get("categories")
        .and_then(|c| c.as_array())
        .unwrap_or(&empty);
    let mut refs: Vec<String> = Vec::new();
    for (espn_name, _, _) in cats {
        if let Some(cat) = index_cats
            .iter()
            .find(|c| c.get("name").and_then(|n| n.as_str()) == Some(espn_name))
        {
            for leader in cat
                .get("leaders")
                .and_then(|l| l.as_array())
                .unwrap_or(&empty)
                .iter()
                .take(3)
            {
                for key in ["athlete", "team"] {
                    if let Some(r) = leader
                        .get(key)
                        .and_then(|x| x.get("$ref"))
                        .and_then(|s| s.as_str())
                    {
                        refs.push(r.to_string());
                    }
                }
            }
        }
    }
    for r in &refs {
        if !memo.contains_key(r)
            && let Ok(v) = espn::fetch_json(&state.client, r).await
        {
            memo.insert(r.clone(), v);
        }
    }

    let mut out = Vec::new();
    for (espn_name, disp, abbr) in cats {
        let Some(cat) = index_cats
            .iter()
            .find(|c| c.get("name").and_then(|n| n.as_str()) == Some(espn_name))
        else {
            continue;
        };
        let mut rows = Vec::new();
        for leader in cat
            .get("leaders")
            .and_then(|l| l.as_array())
            .unwrap_or(&empty)
            .iter()
            .take(3)
        {
            let value = leader.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let athlete = leader
                .get("athlete")
                .and_then(|a| a.get("$ref"))
                .and_then(|s| s.as_str())
                .and_then(|r| memo.get(r).cloned());
            let team = leader
                .get("team")
                .and_then(|t| t.get("$ref"))
                .and_then(|s| s.as_str())
                .and_then(|r| memo.get(r).cloned());
            let name = athlete
                .as_ref()
                .and_then(|a| a.get("shortName").or_else(|| a.get("displayName")))
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();
            let team_abbr = team
                .as_ref()
                .and_then(|t| t.get("abbreviation"))
                .and_then(|a| a.as_str())
                .unwrap_or("")
                .to_string();
            rows.push([name, team_abbr, format_leader_value(espn_name, value)]);
        }
        if !rows.is_empty() {
            out.push(LeaderCategory {
                cat: disp.to_string(),
                abbr: abbr.to_string(),
                rows,
            });
        }
    }

    if let Ok(v) = serde_json::to_value(&out) {
        state.cache.set(&cache_key, v).await;
    }
    out
}

// ─── Route orchestration ─────────────────────────────────────────────────

/// One league's fetched inputs, before it is shaped into a track or an
/// elsewhere entry.
struct LeagueCtx {
    league_id: String,
    sport: &'static str,
    league: &'static str,
    team_id: String,
    /// The team object from `/teams/{id}` (the `team` field, unwrapped).
    team: serde_json::Value,
    season: SeasonInfo,
    scoreboard: serde_json::Value,
}

fn team_str<'a>(ctx: &'a LeagueCtx, key: &str) -> &'a str {
    ctx.team.get(key).and_then(|v| v.as_str()).unwrap_or("")
}

async fn build_track(
    state: &super::routes::SportsState,
    ctx: &LeagueCtx,
    detail: &TeamDetail,
    scores_label: &str,
) -> SportsTrack {
    let abbr = team_str(ctx, "abbreviation");

    let standings = espn::fetch_json(&state.client, &espn::standings_url(ctx.sport, ctx.league))
        .await
        .unwrap_or(serde_json::Value::Null);
    let standings = parse_standings(&standings, abbr);

    let news = espn::fetch_json(
        &state.client,
        &espn::team_news_url(ctx.sport, ctx.league, &ctx.team_id),
    )
    .await
    .ok()
    .and_then(|v| v.get("articles").and_then(|a| a.as_array()).cloned())
    .unwrap_or_default();
    let news = shape_news(&news);

    let leaders = build_leaders(state, ctx.sport, ctx.league, ctx.season.year).await;

    SportsTrack {
        league: ctx.league_id.to_uppercase(),
        team: team_str(ctx, "displayName").to_string(),
        season_type: ctx.season.season_type.clone(),
        record: detail.record.clone(),
        standing: detail.standing.clone(),
        home: detail.home.clone(),
        away: detail.away.clone(),
        next: detail.next.clone(),
        headline: news.headline,
        dek: news.dek,
        // No real photo caption in the feed; the plate stands in for the art.
        caption: String::new(),
        more: news.more,
        table: StandingsTable {
            // No sub: the division title stands alone. The mock's contextual
            // subs ("top of the table", "six to play") can't be generated
            // without an editorial line the feed doesn't carry, and repeating
            // the standing here just echoes the lead above it.
            title: standings.title,
            sub: String::new(),
            rows: standings.rows,
        },
        scores_label: scores_label.to_string(),
        scores: parse_scores(&ctx.scoreboard, abbr),
        leaders,
        hot: standings.hot,
        cold: standings.cold,
    }
}

/// A below-the-fold league: its followed team's status and one headline. Off
/// the top rank, so it gets no track. A record present (preseason `0-0`) shows
/// with a tag; absent (off-season) shows the countdown alone.
fn build_elsewhere(
    ctx: &LeagueCtx,
    detail: &TeamDetail,
    now: chrono::NaiveDate,
    news: &NewsShape,
) -> ElsewhereEntry {
    let in_season = season_rank(&ctx.season.season_type) < 3;
    let record = if in_season && !detail.record.is_empty() {
        Some(detail.record.clone())
    } else {
        None
    };
    let tag = match ctx.season.season_type.as_str() {
        "Preseason" => Some("preseason".to_string()),
        _ => None,
    };
    let note = clock_note(&ctx.season, now, detail);

    ElsewhereEntry {
        league: ctx.league_id.to_uppercase(),
        team: ctx
            .team
            .get("displayName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        record,
        tag,
        note,
        story: BriefStory {
            h: news.headline.clone(),
            meta: news.lead_meta.clone(),
        },
    }
}

/// The prose note under an elsewhere team — a countdown before the season opens
/// ("Season opens Sep 30 · 44 days out"), the next game once it has, or a bare
/// season-type phrase as a fallback.
fn clock_note(season: &SeasonInfo, now: chrono::NaiveDate, detail: &TeamDetail) -> String {
    if let Some(start) = season.start
        && now < start
    {
        let days = (start - now).num_days();
        return format!(
            "Season opens {} · {} days out",
            start.format("%b %-d"),
            days
        );
    }
    if !detail.next.is_empty() {
        return format!("Next: {}", detail.next);
    }
    season.season_type.to_lowercase()
}

/// The Sporting Page — `/sports/section`.
pub async fn get_section(
    axum::extract::State(state): axum::extract::State<super::routes::SportsState>,
) -> Result<axum::Json<SportsSection>, crate::error::AppError> {
    let config = crate::integrations::IntegrationConfig::new(&state.pool, super::INTEGRATION_ID);
    let tracked: Vec<super::types::TrackedTeam> =
        config.get_json_or("tracked_teams", vec![]).await?;
    if tracked.is_empty() {
        return Ok(axum::Json(SportsSection::default()));
    }

    let today = chrono::Utc::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);
    let scores_label = format!("{}'s", yesterday.format("%A"));
    let dates = format!("{}-{}", yesterday.format("%Y%m%d"), today.format("%Y%m%d"));

    // One league context per tracked league (first tracked team wins its league).
    let mut ctxs: Vec<LeagueCtx> = Vec::new();
    for &(league_id, sport, league) in super::types::LEAGUES {
        let Some(team) = tracked.iter().find(|t| t.league == league_id) else {
            continue;
        };
        let Ok(scoreboard) = espn::fetch_scoreboard(&state.client, sport, league, &dates).await
        else {
            continue;
        };
        let Ok(team_payload) = espn::fetch_json(
            &state.client,
            &espn::team_detail_url(sport, league, &team.team_id),
        )
        .await
        else {
            continue;
        };
        let team_obj = team_payload.get("team").cloned().unwrap_or(team_payload);
        ctxs.push(LeagueCtx {
            league_id: league_id.to_string(),
            sport,
            league,
            team_id: team.team_id.clone(),
            season: parse_season(&scoreboard),
            team: team_obj,
            scoreboard,
        });
    }
    if ctxs.is_empty() {
        return Ok(axum::Json(SportsSection::default()));
    }

    // Rank leagues; the top rank (at most two) leads, the rest go to Elsewhere.
    ctxs.sort_by_key(|c| season_rank(&c.season.season_type));
    let top_rank = season_rank(&ctxs[0].season.season_type);

    let details: Vec<TeamDetail> = ctxs.iter().map(|c| parse_team_detail(&c.team)).collect();

    // Fixtures and clock cover every tracked league, in configured order.
    let fixtures: Vec<Fixture> = ctxs
        .iter()
        .zip(&details)
        .map(|(c, d)| Fixture {
            team: shorten_team(team_str(c, "displayName")),
            detail: if d.next.is_empty() {
                clock_note(&c.season, today, d)
            } else {
                d.next.clone()
            },
        })
        .collect();
    let clock: Vec<ClockEntry> = ctxs
        .iter()
        .map(|c| ClockEntry {
            league: c.league_id.to_uppercase(),
            detail: clock_detail(
                &c.season.season_type,
                today,
                c.season.start,
                c.season.end,
                c.season.week,
                c.season.total_weeks,
            ),
        })
        .collect();

    let mut leagues = Vec::new();
    let mut elsewhere = Vec::new();
    for (ctx, detail) in ctxs.iter().zip(&details) {
        let at_top = season_rank(&ctx.season.season_type) == top_rank;
        if at_top && leagues.len() < 2 {
            leagues.push(build_track(&state, ctx, detail, &scores_label).await);
        } else {
            // Elsewhere still wants one headline, so fetch this league's news.
            let news = espn::fetch_json(
                &state.client,
                &espn::team_news_url(ctx.sport, ctx.league, &ctx.team_id),
            )
            .await
            .ok()
            .and_then(|v| v.get("articles").and_then(|a| a.as_array()).cloned())
            .unwrap_or_default();
            elsewhere.push(build_elsewhere(ctx, detail, today, &shape_news(&news)));
        }
    }

    // The lead story's dek stands in as the standfirst — a real sentence about
    // the day's biggest result. A cross-league LLM summary could replace it,
    // the same path preview and recap already use.
    let standfirst = leagues.first().map(|t| t.dek.clone()).unwrap_or_default();

    Ok(axum::Json(SportsSection {
        fixtures,
        clock,
        standfirst,
        leagues,
        elsewhere,
    }))
}

/// A team's short name for the fixtures ear — the last word of its display name
/// ("Los Angeles Dodgers" → "Dodgers"), matching the mock's ear.
fn shorten_team(display: &str) -> String {
    display
        .split_whitespace()
        .last()
        .unwrap_or(display)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(s: &str) -> chrono::NaiveDate {
        chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn shortens_a_team_to_its_last_word() {
        assert_eq!(shorten_team("Los Angeles Dodgers"), "Dodgers");
        assert_eq!(shorten_team("Warriors"), "Warriors");
    }

    #[test]
    fn leader_values_format_by_category() {
        assert_eq!(format_leader_value("homeRuns", 35.0), "35");
        assert_eq!(format_leader_value("avg", 0.322), ".322");
        assert_eq!(format_leader_value("ERA", 1.76), "1.76");
        assert_eq!(format_leader_value("pointsPerGame", 28.4), "28.4");
        assert_eq!(format_leader_value("fieldGoalPercentage", 0.523), ".523");
    }

    #[test]
    fn a_league_without_a_leader_map_yields_none() {
        assert!(league_leader_cats("xfl").is_empty());
        assert!(!league_leader_cats("mlb").is_empty());
    }

    fn game(
        away: &str,
        a_s: i64,
        home: &str,
        h_s: i64,
        star: &str,
        line: &str,
    ) -> serde_json::Value {
        serde_json::json!({
            "status": { "type": { "state": "post" } },
            "competitions": [{
                "competitors": [
                    { "homeAway": "away", "team": { "abbreviation": away }, "score": a_s.to_string() },
                    { "homeAway": "home", "team": { "abbreviation": home }, "score": h_s.to_string() },
                ],
                "leaders": [{ "leaders": [{ "athlete": { "shortName": star }, "displayValue": line }] }],
            }],
        })
    }

    #[test]
    fn parses_finals_with_their_standouts() {
        let sb = serde_json::json!({ "events": [game("KC", 4, "LAD", 5, "M. Muncy", "2-5, RBI, walk-off")] });
        let rows = parse_scores(&sb, "LAD");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].a, "KC");
        assert_eq!(rows[0].away_score, 4);
        assert_eq!(rows[0].h, "LAD");
        assert_eq!(rows[0].hs, 5);
        assert_eq!(rows[0].star, "M. Muncy");
        assert_eq!(rows[0].line, "2-5, RBI, walk-off");
    }

    #[test]
    fn the_followed_teams_game_leads_the_slate() {
        let sb = serde_json::json!({ "events": [
            game("CLE", 4, "DET", 6, "x", "y"),
            game("KC", 4, "LAD", 5, "M. Muncy", "walk-off"),
        ] });
        // LAD's game is second in the feed but must lead the rows.
        let rows = parse_scores(&sb, "LAD");
        assert_eq!(rows.first().map(|r| r.h.as_str()), Some("LAD"));
    }

    #[test]
    fn scores_skip_games_that_are_not_final() {
        let mut pre = game("KC", 0, "LAD", 0, "", "");
        pre["status"]["type"]["state"] = serde_json::json!("pre");
        let sb = serde_json::json!({ "events": [pre] });
        assert!(parse_scores(&sb, "LAD").is_empty());
    }

    fn article(headline: &str, desc: &str, team_tags: usize) -> serde_json::Value {
        let cats: Vec<_> = (0..team_tags)
            .map(|_| serde_json::json!({ "type": "team" }))
            .collect();
        serde_json::json!({
            "headline": headline,
            "description": desc,
            "type": "Story",
            "published": "2026-08-12T14:00Z",
            "categories": cats,
        })
    }

    #[test]
    fn news_drops_league_roundups_and_keeps_team_stories() {
        let articles = vec![
            article(
                "10 storylines that will shape the season",
                "A league-wide look.",
                30,
            ),
            article("Muncy walks it off", "A single scored Ohtani to end it.", 2),
            article(
                "Snell strikes out ten",
                "Back from the IL after three months.",
                1,
            ),
        ];
        let n = shape_news(&articles);
        // The 30-team round-up is skipped; the first real team story leads.
        assert_eq!(n.headline, "Muncy walks it off");
        assert_eq!(n.dek, "A single scored Ohtani to end it.");
        assert_eq!(n.more.len(), 1);
        assert_eq!(n.more[0].h, "Snell strikes out ten");
        assert_eq!(n.more[0].meta, "Wed Aug 12 · Story");
    }

    #[test]
    fn news_drops_headline_echo_items() {
        let articles = vec![
            // A video whose description just repeats the headline.
            article(
                "Royals vs. Dodgers: Game Highlights",
                "Royals vs. Dodgers: Game Highlights",
                2,
            ),
            article(
                "Real story with a real dek",
                "Something that isn't the headline.",
                1,
            ),
        ];
        let n = shape_news(&articles);
        assert_eq!(n.headline, "Real story with a real dek");
    }

    #[test]
    fn parses_team_detail_record_splits_and_next() {
        let team = serde_json::json!({
            "record": { "items": [
                { "type": "total", "summary": "74-51" },
                { "type": "home", "summary": "37-26" },
                { "type": "road", "summary": "37-25" },
            ] },
            "standingSummary": "1st in NL West",
            "nextEvent": [{ "shortName": "MIL @ LAD", "date": "2026-08-16T20:10Z" }],
        });
        let d = parse_team_detail(&team);
        assert_eq!(d.record, "74-51");
        assert_eq!(d.home, "37-26");
        assert_eq!(d.away, "37-25"); // ESPN "road" → "Away"
        assert_eq!(d.standing, "1st in NL West");
        assert_eq!(d.next, "MIL @ LAD · Sun Aug 16");
    }

    #[test]
    fn team_detail_next_is_empty_with_no_scheduled_event() {
        let team = serde_json::json!({ "record": { "items": [] }, "nextEvent": [] });
        assert_eq!(parse_team_detail(&team).next, "");
    }

    fn standings_fixture() -> serde_json::Value {
        // Two divisions in one league, so the table must pick the team's own.
        let entry = |abbr: &str, w: i64, l: i64, gb: &str, strk: &str| {
            serde_json::json!({
                "team": { "abbreviation": abbr },
                "stats": [
                    { "name": "wins", "displayValue": w.to_string() },
                    { "name": "losses", "displayValue": l.to_string() },
                    { "name": "winPercent", "displayValue": ".600" },
                    { "name": "gamesBehind", "displayValue": gb },
                    { "name": "streak", "displayValue": strk },
                ],
            })
        };
        serde_json::json!({
            "children": [
                { "name": "NL West", "standings": { "entries": [
                    entry("LAD", 74, 51, "-", "W2"),
                    entry("SD", 70, 55, "4", "L3"),
                ] } },
                { "name": "NL East", "standings": { "entries": [
                    entry("ATL", 80, 45, "-", "W8"),
                    entry("NYM", 60, 65, "20", "L1"),
                ] } },
            ]
        })
    }

    #[test]
    fn standings_table_is_the_teams_own_division() {
        let r = parse_standings(&standings_fixture(), "LAD");
        assert_eq!(r.title, "NL West");
        assert_eq!(
            r.rows.iter().map(|x| x.t.as_str()).collect::<Vec<_>>(),
            ["LAD", "SD"]
        );
        assert!(r.rows.iter().find(|x| x.t == "LAD").unwrap().me);
        // The leader's games-behind reads as an em dash, not "-".
        assert_eq!(r.rows[0].gb, "—");
    }

    #[test]
    fn form_scans_the_whole_league_not_just_the_division() {
        let r = parse_standings(&standings_fixture(), "LAD");
        // ATL's W8 (other division) leads the hot list over LAD's W2.
        assert_eq!(r.hot.first().map(|s| s.t.as_str()), Some("ATL"));
        assert_eq!(r.hot.first().map(|s| s.strk.as_str()), Some("W8"));
        // SD's L3 leads the cold list.
        assert_eq!(r.cold.first().map(|s| s.t.as_str()), Some("SD"));
    }

    #[test]
    fn regular_season_outranks_preseason_and_offseason() {
        assert!(season_rank("Regular Season") < season_rank("Preseason"));
        assert!(season_rank("Preseason") < season_rank("off-season nonsense"));
        assert!(season_rank("Regular Season") < season_rank("Postseason"));
    }

    #[test]
    fn clock_counts_down_before_the_season_opens() {
        // NBA on 2026-08-17, opening 2026-09-30.
        let d = clock_detail(
            "Regular Season",
            date("2026-08-17"),
            Some(date("2026-09-30")),
            Some(date("2027-06-26")),
            None,
            None,
        );
        assert_eq!(d, "44 days out");
    }

    #[test]
    fn clock_shows_the_week_for_a_league_that_reports_one() {
        let d = clock_detail(
            "Regular Season",
            date("2026-10-01"),
            Some(date("2026-09-01")),
            Some(date("2027-02-01")),
            Some(3),
            Some(18),
        );
        assert_eq!(d, "week 3 of 18");
    }

    #[test]
    fn clock_falls_back_to_days_left_without_a_week() {
        // MLB mid-season, no week concept.
        let d = clock_detail(
            "Regular Season",
            date("2026-08-17"),
            Some(date("2026-02-19")),
            Some(date("2026-11-12")),
            None,
            None,
        );
        assert_eq!(d, "87 days left");
    }

    #[test]
    fn clock_names_preseason_with_its_week() {
        let d = clock_detail(
            "Preseason",
            date("2026-08-17"),
            Some(date("2026-08-06")),
            Some(date("2027-02-16")),
            Some(2),
            None,
        );
        assert_eq!(d, "preseason wk 2");
    }
}
