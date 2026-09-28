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
}
