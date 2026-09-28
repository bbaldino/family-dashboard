// ─── Scores ───────────────────────────────────────────────────────────────

fn competitor<'a>(comp: &'a serde_json::Value, side: &str) -> Option<&'a serde_json::Value> {
    comp.get("competitors")?
        .as_array()?
        .iter()
        .find(|c| c.get("homeAway").and_then(|h| h.as_str()) == Some(side))
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
/// finals most-recent-first. Only postponed games (`post` but never
/// completed) are dropped here — they're no result; the page caps the rest.
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
                "post" if super::team::is_final(event) => GameStatus::Final,
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

    /// A postponed game is `post` but not completed: never a "Final" 0–0.
    #[test]
    fn a_postponed_game_is_not_a_final() {
        let mut ppd = event("NYM", "ATL", "post", "Postponed", "2026-09-27T23:10Z");
        ppd["status"]["type"]["completed"] = serde_json::json!(false);
        let mut done = event("KC", "LV", "post", "Final", "2026-09-27T20:25Z");
        done["status"]["type"]["completed"] = serde_json::json!(true);
        let s = parse_slate(&serde_json::json!({ "events": [ppd, done] }), "SF");
        assert!(
            s.rows
                .iter()
                .all(|r| r.state != GameStatus::Final || r.a == "KC"),
            "{:?}",
            s.rows
        );
        assert_eq!(s.total, 1);
    }

    #[test]
    fn an_empty_scoreboard_is_an_empty_slate() {
        let s = parse_slate(&serde_json::Value::Null, "SF");
        assert!(s.rows.is_empty());
        assert_eq!(s.total, 0);
    }
}
