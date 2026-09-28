use super::{StreakRow, TableRow};

// ─── Standings ───────────────────────────────────────────────────────────

struct StandingEntry {
    abbr: String,
    division: String,
    w: i64,
    l: i64,
    pct: String,
    gb: String,
    strk: String,
    last10: Option<String>,
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
        last10: stat(e, "Last Ten Games")
            .and_then(|v| v.as_str())
            .map(String::from),
    })
}

/// The followed team's own form, for its card.
pub struct TeamStanding {
    pub streak: String,
    pub last10: Option<String>,
}

pub struct StandingsResult {
    pub title: String,
    pub rows: Vec<TableRow>,
    pub hot: Vec<StreakRow>,
    pub cold: Vec<StreakRow>,
    pub team: Option<TeamStanding>,
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

    let mut division_entries: Vec<&StandingEntry> =
        all.iter().filter(|e| e.division == my_division).collect();
    // ESPN's entry order is incidental, not a ranking (a team 20+ games back
    // can appear before a division leader). Sort best-to-worst on the
    // reliable numeric fields — wins descending, then losses ascending —
    // rather than the string `gb`/`pct` fields, which sort lexically wrong
    // ("23.5" before "4.0").
    division_entries.sort_by(|a, b| b.w.cmp(&a.w).then(a.l.cmp(&b.l)));

    let rows: Vec<TableRow> = division_entries
        .iter()
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

    let team = all
        .iter()
        .find(|e| e.abbr == team_abbr)
        .map(|e| TeamStanding {
            streak: e.strk.clone(),
            last10: e.last10.clone(),
        });

    StandingsResult {
        title: my_division,
        rows,
        hot: hot.iter().take(3).map(to_streak).collect(),
        cold: cold.iter().take(3).map(to_streak).collect(),
        team,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn standings_rows_are_sorted_best_to_worst_not_espns_entry_order() {
        // ESPN's entries list a team 40 games back (a WSH analog) BEFORE two
        // better teams in the division — the feed's incidental order, not a
        // ranking. The table must still come out sorted by record.
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
        let standings = serde_json::json!({
            "children": [
                { "name": "NL East", "standings": { "entries": [
                    entry("WSH", 50, 90, "40", "L2"),
                    entry("PHI", 90, 50, "-", "W4"),
                    entry("ATL", 80, 60, "10", "W1"),
                ] } },
            ]
        });
        let r = parse_standings(&standings, "PHI");
        assert_eq!(
            r.rows.iter().map(|x| x.t.as_str()).collect::<Vec<_>>(),
            ["PHI", "ATL", "WSH"]
        );
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

    const NL_DIVISIONS: &str =
        include_str!("../../../../tests/fixtures/section/mlb_standings_nl_divisions.json");

    #[test]
    fn division_level_standings_give_the_teams_own_division() {
        let v: serde_json::Value = serde_json::from_str(NL_DIVISIONS).unwrap();
        let r = parse_standings(&v, "LAD");
        assert_eq!(r.title, "National League West");
        assert_eq!(
            r.rows.iter().map(|x| x.t.as_str()).collect::<Vec<_>>(),
            ["LAD", "SD", "ARI", "SF", "COL"]
        );
    }

    #[test]
    fn the_followed_team_carries_its_streak_and_last_ten() {
        let v: serde_json::Value = serde_json::from_str(NL_DIVISIONS).unwrap();
        let t = parse_standings(&v, "LAD")
            .team
            .expect("LAD is in the standings");
        assert_eq!(t.streak, "W3");
        assert_eq!(t.last10.as_deref(), Some("8-2"));
    }

    /// A failed standings fetch arrives as `Null`: no rows, no team, no panic.
    #[test]
    fn missing_standings_yield_an_empty_table() {
        let r = parse_standings(&serde_json::Value::Null, "LAD");
        assert!(r.rows.is_empty());
        assert!(r.team.is_none());
    }

    #[test]
    fn standings_url_asks_for_divisions() {
        assert!(super::super::super::espn::standings_url("baseball", "mlb").ends_with("?level=3"));
    }
}
