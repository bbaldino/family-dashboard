use serde::{Deserialize, Serialize};

/// The subset of a Frigate `/api/events` record we use. `top_score` lives
/// under `data.top_score` in Frigate's payload; `parse_events` pulls it up
/// so the rest of the code sees a flat field.
#[derive(Debug, Clone, Deserialize)]
pub struct FrigateEvent {
    pub id: String,
    pub start_time: f64,
    #[serde(default)]
    pub end_time: Option<f64>,
    #[serde(default)]
    pub top_score: f64,
}

/// Parse Frigate's `/api/events` array, lifting `data.top_score` (falling back
/// to a top-level `top_score`) onto each event.
pub fn parse_events(raw: &serde_json::Value) -> Vec<FrigateEvent> {
    raw.as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|e| {
                    let id = e.get("id")?.as_str()?.to_string();
                    let start_time = e.get("start_time")?.as_f64()?;
                    let end_time = e.get("end_time").and_then(|v| v.as_f64());
                    let top_score = e
                        .get("data")
                        .and_then(|d| d.get("top_score"))
                        .and_then(|v| v.as_f64())
                        .or_else(|| e.get("top_score").and_then(|v| v.as_f64()))
                        .unwrap_or(0.0);
                    Some(FrigateEvent {
                        id,
                        start_time,
                        end_time,
                        top_score,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

#[derive(Debug, Clone, Serialize)]
pub struct Visit {
    pub id: String,
    pub start: f64,
    pub end: f64,
    pub count: usize,
    pub clip_event_ids: Vec<String>,
    pub snapshot_event_id: String,
    pub duration_s: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TodayResponse {
    pub visits: Vec<Visit>,
}

pub fn local_today_start(now: chrono::DateTime<chrono::Local>) -> i64 {
    now.date_naive()
        .and_hms_opt(0, 0, 0)
        .and_then(|dt| dt.and_local_timezone(chrono::Local).single())
        .map(|dt| dt.timestamp())
        .unwrap_or_else(|| now.timestamp())
}

/// Group events into visits: consecutive events whose gap <= `gap_secs` are one
/// visit. Input may be any order; output is newest-visit-first, and each
/// visit's `clip_event_ids` are chronological. Events below `min_score` drop.
pub fn group_visits(events: &[FrigateEvent], gap_secs: i64, min_score: f64) -> Vec<Visit> {
    let mut kept: Vec<&FrigateEvent> = events.iter().filter(|e| e.top_score >= min_score).collect();
    kept.sort_by(|a, b| a.start_time.total_cmp(&b.start_time));

    let mut visits: Vec<Visit> = Vec::new();
    for e in kept {
        let end = e.end_time.unwrap_or(e.start_time);
        match visits.last_mut() {
            Some(v) if (e.start_time - v.end) <= gap_secs as f64 => {
                v.end = end.max(v.end);
                v.count += 1;
                v.clip_event_ids.push(e.id.clone());
                // best-scoring event drives the snapshot; recomputed below.
            }
            _ => visits.push(Visit {
                id: e.id.clone(),
                start: e.start_time,
                end,
                count: 1,
                clip_event_ids: vec![e.id.clone()],
                snapshot_event_id: e.id.clone(),
                duration_s: (end - e.start_time).round() as i64,
            }),
        }
    }

    // Pick the highest-score event per visit for the snapshot, set duration.
    let score_of = |id: &str| {
        events
            .iter()
            .find(|e| e.id == id)
            .map(|e| e.top_score)
            .unwrap_or(0.0)
    };
    for v in visits.iter_mut() {
        v.duration_s = (v.end - v.start).round() as i64;
        if let Some(best) = v
            .clip_event_ids
            .iter()
            .max_by(|a, b| score_of(a).total_cmp(&score_of(b)))
        {
            v.snapshot_event_id = best.clone();
        }
    }

    visits.reverse(); // newest first
    visits
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ev(id: &str, start: f64, end: f64, score: f64) -> FrigateEvent {
        FrigateEvent {
            id: id.into(),
            start_time: start,
            end_time: Some(end),
            top_score: score,
        }
    }

    #[test]
    fn groups_consecutive_events_and_orders_newest_first() {
        // Two clips 30s apart (one visit) at t=1000; a lone clip at t=5000.
        let evs = vec![
            ev("a", 1000.0, 1035.0, 0.9),
            ev("b", 1065.0, 1100.0, 0.8),
            ev("c", 5000.0, 5002.0, 0.95),
        ];
        let visits = group_visits(&evs, 8 * 60, 0.6);
        assert_eq!(visits.len(), 2);
        // newest first
        assert_eq!(visits[0].id, "c");
        assert_eq!(visits[1].count, 2);
        assert_eq!(visits[1].clip_event_ids, vec!["a", "b"]);
        // best (highest score) chosen for the snapshot
        assert_eq!(visits[1].snapshot_event_id, "a");
        assert_eq!(visits[1].duration_s, 100); // 1100 - 1000
    }

    #[test]
    fn drops_events_below_min_score() {
        let evs = vec![ev("a", 1000.0, 1002.0, 0.4), ev("b", 1001.0, 1003.0, 0.95)];
        let visits = group_visits(&evs, 8 * 60, 0.6);
        assert_eq!(visits.len(), 1);
        assert_eq!(visits[0].clip_event_ids, vec!["b"]);
    }

    #[test]
    fn local_today_start_is_midnight() {
        use chrono::TimeZone;
        let now = chrono::Local
            .with_ymd_and_hms(2026, 9, 21, 17, 11, 30)
            .unwrap();
        let start = local_today_start(now);
        let midnight = chrono::Local
            .with_ymd_and_hms(2026, 9, 21, 0, 0, 0)
            .unwrap()
            .timestamp();
        assert_eq!(start, midnight);
    }
}
