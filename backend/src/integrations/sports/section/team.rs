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
                .and_then(super::super::transform::parse_espn_timestamp)
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

// ─── Card games: LAST result, NEXT game ────────────────────────────────────

use super::super::transform::{json_id, parse_espn_timestamp};

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LastGame {
    pub result: String,
    pub score: String,
    pub opponent: String,
    pub home_away: String,
    pub starts_at: String,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NextGame {
    pub opponent: String,
    pub home_away: String,
    pub starts_at: String,
    pub tv: Option<String>,
    pub label: Option<String>,
}

/// A score in any of ESPN's shapes: a string on the scoreboard, a number in
/// some feeds, a `{ value, displayValue }` object on schedules.
pub fn score_of(v: &serde_json::Value) -> Option<i64> {
    match v {
        serde_json::Value::String(s) => s.parse().ok(),
        serde_json::Value::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|f| f as i64)),
        serde_json::Value::Object(o) => o
            .get("displayValue")
            .and_then(|d| d.as_str())
            .and_then(|s| s.parse().ok())
            .or_else(|| o.get("value").and_then(|x| x.as_f64()).map(|f| f as i64)),
        _ => None,
    }
}

/// The team object's own `nextEvent[]` (a `/teams/{id}` payload).
pub fn team_events(team: &serde_json::Value) -> Vec<&serde_json::Value> {
    team.get("nextEvent")
        .and_then(|n| n.as_array())
        .map(|a| a.iter().collect())
        .unwrap_or_default()
}

/// A schedule payload's `events[]`.
pub fn schedule_events(schedule: &serde_json::Value) -> Vec<&serde_json::Value> {
    schedule
        .get("events")
        .and_then(|e| e.as_array())
        .map(|a| a.iter().collect())
        .unwrap_or_default()
}

/// `pre` / `in` / `post`. Scoreboard events carry status at the top; team
/// detail and schedule events carry it on the competition.
fn event_state(event: &serde_json::Value) -> &str {
    event["status"]["type"]["state"]
        .as_str()
        .or_else(|| event["competitions"][0]["status"]["type"]["state"].as_str())
        .unwrap_or("")
}

/// `(mine, theirs)` competitors of an event, by team id.
fn sides<'a>(
    event: &'a serde_json::Value,
    team_id: &str,
) -> Option<(&'a serde_json::Value, &'a serde_json::Value)> {
    let cs = event["competitions"][0]["competitors"].as_array()?;
    let mine = cs
        .iter()
        .find(|c| json_id(&c["id"]).as_deref() == Some(team_id))?;
    let theirs = cs
        .iter()
        .find(|c| json_id(&c["id"]).as_deref() != Some(team_id))?;
    Some((mine, theirs))
}

/// The broadcast to name: a national TV network first, then the TV feed in
/// the team's own market, then whatever is listed first.
pub fn pick_tv(event: &serde_json::Value, home_away: &str) -> Option<String> {
    let bs = event["competitions"][0]["broadcasts"].as_array()?;
    let name = |b: &serde_json::Value| b["media"]["shortName"].as_str().map(String::from);
    let is_tv = |b: &&serde_json::Value| b["type"]["shortName"].as_str() == Some("TV");
    let market = |b: &serde_json::Value| {
        b["market"]["type"]
            .as_str()
            .unwrap_or("")
            .to_ascii_lowercase()
    };
    bs.iter()
        .filter(is_tv)
        .find(|b| market(b) == "national")
        .or_else(|| bs.iter().filter(is_tv).find(|b| market(b) == home_away))
        .or_else(|| bs.first())
        .and_then(name)
}

/// `"NLDS - Game 1"` → `"NLDS Game 1"`; `None` when the event has no note.
pub fn round_label(event: &serde_json::Value) -> Option<String> {
    event["competitions"][0]["notes"][0]["headline"]
        .as_str()
        .filter(|h| !h.is_empty())
        .map(|h| h.replace(" - ", " "))
}

/// The card's LAST (latest finished game) and NEXT (earliest game not yet
/// started, at or after `now`) from any mix of team-detail, schedule and
/// scoreboard events. A finished `nextEvent` is therefore a LAST candidate
/// like any other — the stale-next bug can't recur.
pub fn card_games<'a>(
    candidates: impl IntoIterator<Item = &'a serde_json::Value>,
    team_id: &str,
    now: chrono::DateTime<chrono::Utc>,
) -> (Option<LastGame>, Option<NextGame>) {
    let mut last: Option<(chrono::DateTime<chrono::Utc>, LastGame)> = None;
    let mut next: Option<(chrono::DateTime<chrono::Utc>, NextGame)> = None;

    for event in candidates {
        let Some(starts_at) = event["date"].as_str() else {
            continue;
        };
        let Some(start) = parse_espn_timestamp(starts_at) else {
            continue;
        };
        let Some((mine, theirs)) = sides(event, team_id) else {
            continue;
        };
        let home_away = mine["homeAway"].as_str().unwrap_or("").to_string();
        let opponent = theirs["team"]["abbreviation"]
            .as_str()
            .unwrap_or("")
            .to_string();

        match event_state(event) {
            "post" => {
                let (Some(m), Some(t)) = (score_of(&mine["score"]), score_of(&theirs["score"]))
                else {
                    continue;
                };
                if last.as_ref().is_some_and(|(d, _)| *d >= start) {
                    continue;
                }
                let result = match m.cmp(&t) {
                    std::cmp::Ordering::Greater => "W",
                    std::cmp::Ordering::Less => "L",
                    std::cmp::Ordering::Equal => "T",
                };
                last = Some((
                    start,
                    LastGame {
                        result: result.to_string(),
                        score: format!("{m}–{t}"),
                        opponent,
                        home_away,
                        starts_at: starts_at.to_string(),
                    },
                ));
            }
            "pre" if start >= now => {
                if next.as_ref().is_some_and(|(d, _)| *d <= start) {
                    continue;
                }
                next = Some((
                    start,
                    NextGame {
                        tv: pick_tv(event, &home_away),
                        label: round_label(event),
                        opponent,
                        home_away,
                        starts_at: starts_at.to_string(),
                    },
                ));
            }
            _ => {}
        }
    }
    (last.map(|(_, g)| g), next.map(|(_, g)| g))
}

#[cfg(test)]
mod tests {
    use super::*;

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

    const STALE_49ERS: &str =
        include_str!("../../../../tests/fixtures/section/nfl_team_detail_49ers_stale_next.json");
    const DODGERS_POST: &str = include_str!(
        "../../../../tests/fixtures/section/mlb_team_detail_dodgers_postseason_next.json"
    );
    const DODGERS_SCHEDULE: &str =
        include_str!("../../../../tests/fixtures/enrichment/espn_schedule_dodgers_2026.json");

    fn at(s: &str) -> chrono::DateTime<chrono::Utc> {
        chrono::DateTime::parse_from_rfc3339(s)
            .unwrap()
            .with_timezone(&chrono::Utc)
    }

    /// The day after ARI @ SF, the team feed's `nextEvent` still pointed at
    /// that finished game. It must become LAST, never NEXT.
    #[test]
    fn a_finished_next_event_is_the_last_game_not_the_next() {
        let v: serde_json::Value = serde_json::from_str(STALE_49ERS).unwrap();
        let (last, next) = card_games(team_events(&v["team"]), "25", at("2026-09-28T12:00:00Z"));
        let last = last.expect("the finished game is the last result");
        assert_eq!(last.result, "W");
        assert_eq!(last.score, "36–30");
        assert_eq!(last.opponent, "ARI");
        assert_eq!(last.home_away, "home");
        assert!(next.is_none());
    }

    /// Schedule events carry scores as `{ displayValue }` objects; the last
    /// completed game and the first upcoming one are picked by date.
    #[test]
    fn schedule_gives_last_and_next_around_now() {
        let schedule: serde_json::Value = serde_json::from_str(DODGERS_SCHEDULE).unwrap();
        let (last, next) = card_games(schedule_events(&schedule), "19", at("2026-07-27T00:00:00Z"));
        let last = last.unwrap();
        assert_eq!(
            (
                last.result.as_str(),
                last.score.as_str(),
                last.opponent.as_str()
            ),
            ("L", "3–8", "NYM")
        );
        assert_eq!(last.home_away, "away");
        let next = next.unwrap();
        assert_eq!(next.opponent, "SEA");
        assert_eq!(next.home_away, "home");
        assert_eq!(next.starts_at, "2026-07-29T02:10Z");
        // No national TV; the Dodgers' own home broadcast, not the stream.
        assert_eq!(next.tv.as_deref(), Some("Sportsnet LA"));
    }

    #[test]
    fn a_postseason_placeholder_is_next_with_its_round_label() {
        let v: serde_json::Value = serde_json::from_str(DODGERS_POST).unwrap();
        let (_, next) = card_games(team_events(&v["team"]), "19", at("2026-09-28T12:00:00Z"));
        let next = next.unwrap();
        assert_eq!(next.opponent, "TBD");
        assert_eq!(next.label.as_deref(), Some("NLDS Game 1"));
        assert_eq!(next.tv.as_deref(), Some("FOX"));
    }

    #[test]
    fn scores_parse_in_every_shape_espn_uses() {
        assert_eq!(score_of(&serde_json::json!("9")), Some(9));
        assert_eq!(score_of(&serde_json::json!(4)), Some(4));
        assert_eq!(
            score_of(&serde_json::json!({ "displayValue": "8", "value": 8.0 })),
            Some(8)
        );
        assert_eq!(score_of(&serde_json::json!({ "value": 3.0 })), Some(3));
        assert_eq!(score_of(&serde_json::Value::Null), None);
    }

    #[test]
    fn no_candidates_means_no_games() {
        let (last, next) = card_games(
            Vec::<&serde_json::Value>::new(),
            "19",
            at("2026-07-27T00:00:00Z"),
        );
        assert!(last.is_none() && next.is_none());
    }
}
