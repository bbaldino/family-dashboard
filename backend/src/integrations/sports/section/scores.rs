use super::ScoreRow;

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

#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GameStatus {
    Live,
    Upcoming,
    Final,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScoreLine {
    pub a: String,
    #[serde(rename = "as")]
    pub away_score: i64,
    pub h: String,
    pub hs: i64,
    pub state: GameStatus,
    /// ESPN's own short status: "Final", "Final/10", "Top 7th", "7:10 PM".
    pub detail: String,
    pub starts_at: String,
    pub mine: bool,
}

#[derive(serde::Serialize, Debug)]
pub struct ScoreSlate {
    pub rows: Vec<ScoreLine>,
    pub total: usize,
}

/// Every game on the (yesterday + today) scoreboard: the followed team's game
/// first, then live games, then today's upcoming ones soonest-first, then
/// finals most-recent-first. Nothing is dropped here — the page caps.
pub fn parse_slate(scoreboard: &serde_json::Value, team_abbr: &str) -> ScoreSlate {
    let mut rows: Vec<ScoreLine> = scoreboard
        .get("events")
        .and_then(|e| e.as_array())
        .map(Vec::as_slice)
        .unwrap_or_default()
        .iter()
        .filter_map(|event| {
            let comp = event.get("competitions")?.as_array()?.first()?;
            let state = match event["status"]["type"]["state"].as_str()? {
                "in" => GameStatus::Live,
                "pre" => GameStatus::Upcoming,
                "post" => GameStatus::Final,
                _ => return None,
            };
            let away = competitor(comp, "away")?;
            let home = competitor(comp, "home")?;
            let abbr = |c: &serde_json::Value| {
                c["team"]["abbreviation"].as_str().unwrap_or("").to_string()
            };
            let (a, h) = (abbr(away), abbr(home));
            Some(ScoreLine {
                mine: a == team_abbr || h == team_abbr,
                away_score: super::team::score_of(&away["score"]).unwrap_or(0),
                hs: super::team::score_of(&home["score"]).unwrap_or(0),
                a,
                h,
                state,
                detail: event["status"]["type"]["shortDetail"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
                starts_at: event["date"].as_str().unwrap_or("").to_string(),
            })
        })
        .collect();

    // ISO-8601 UTC timestamps in one format sort correctly as text.
    rows.sort_by(|x, y| {
        let rank = |r: &ScoreLine| match (r.mine, r.state) {
            (true, _) => 0,
            (_, GameStatus::Live) => 1,
            (_, GameStatus::Upcoming) => 2,
            (_, GameStatus::Final) => 3,
        };
        rank(x).cmp(&rank(y)).then_with(|| match x.state {
            GameStatus::Final => y.starts_at.cmp(&x.starts_at),
            _ => x.starts_at.cmp(&y.starts_at),
        })
    });
    let total = rows.len();
    ScoreSlate { rows, total }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    fn event(away: &str, home: &str, state: &str, detail: &str, date: &str) -> serde_json::Value {
        serde_json::json!({
            "date": date,
            "status": { "type": { "state": state, "shortDetail": detail } },
            "competitions": [{ "competitors": [
                { "homeAway": "away", "team": { "abbreviation": away }, "score": "3" },
                { "homeAway": "home", "team": { "abbreviation": home }, "score": "1" },
            ] }],
        })
    }

    #[test]
    fn the_slate_orders_mine_then_live_then_upcoming_then_finals() {
        let sb = serde_json::json!({ "events": [
            event("KC", "LV", "post", "Final", "2026-09-27T20:25Z"),
            event("PHI", "ATL", "pre", "7:10 PM", "2026-09-28T23:10Z"),
            event("NYY", "BOS", "in", "Top 7th", "2026-09-28T17:05Z"),
            event("BUF", "MIA", "post", "Final", "2026-09-27T17:00Z"),
            event("ARI", "SF", "post", "Final", "2026-09-27T20:05Z"),
        ] });
        let s = parse_slate(&sb, "SF");
        let order: Vec<(&str, &str)> = s
            .rows
            .iter()
            .map(|r| (r.a.as_str(), r.h.as_str()))
            .collect();
        assert_eq!(
            order,
            [
                ("ARI", "SF"),
                ("NYY", "BOS"),
                ("PHI", "ATL"),
                ("KC", "LV"),
                ("BUF", "MIA")
            ]
        );
        assert!(s.rows[0].mine);
        assert_eq!(s.rows[1].state, GameStatus::Live);
        assert_eq!(s.rows[1].detail, "Top 7th");
        assert_eq!(s.rows[2].state, GameStatus::Upcoming);
        assert_eq!(s.rows[2].starts_at, "2026-09-28T23:10Z");
        assert_eq!(s.total, 5);
    }

    #[test]
    fn an_empty_scoreboard_is_an_empty_slate() {
        let s = parse_slate(&serde_json::Value::Null, "SF");
        assert!(s.rows.is_empty());
        assert_eq!(s.total, 0);
    }
}
