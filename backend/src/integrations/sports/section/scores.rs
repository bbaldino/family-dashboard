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
}
