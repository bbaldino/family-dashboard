use crate::error::AppError;

const ESPN_BASE: &str = "https://site.api.espn.com/apis/site/v2/sports";

/// The `dates=` range to ask ESPN's scoreboard for, as `YYYYMMDD-YYYYMMDD`.
///
/// The scoreboard endpoint takes no date at all if you don't give it one, and
/// what it returns then is *not* today: at 14:33 UTC on 2026-08-10 an undated
/// request answered with the whole of the 9th, every game `post`. The column
/// went on reporting an off-day all morning while that night's first pitch was
/// already on the schedule. So the date is always sent explicitly.
///
/// The range is derived from `window_hours` rather than fixed, because that is
/// the filter the payload has to survive: `transform_scoreboard` keeps finals
/// that started within `window_hours` behind us and games starting within
/// `window_hours` ahead, so a fetch narrower than that silently starves it.
/// One extra day on each end covers the offset between ESPN's game-day
/// numbering — a 7:10pm Pacific game sits on the 10th's slate but carries a
/// UTC timestamp on the 11th — and the UTC date this is computed from.
pub fn scoreboard_date_range(now: chrono::DateTime<chrono::Utc>, window_hours: f64) -> String {
    let span = chrono::Duration::days(1 + (window_hours / 24.0).ceil().max(0.0) as i64);
    let start = (now - span).format("%Y%m%d");
    let end = (now + span).format("%Y%m%d");
    format!("{}-{}", start, end)
}

pub async fn fetch_scoreboard(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    dates: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!(
        "{}/{}/{}/scoreboard?dates={}",
        ESPN_BASE, sport, league, dates
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "ESPN API error ({}): {}",
            status, body
        )));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN parse failed: {}", e)))
}

pub async fn fetch_teams(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!("{}/{}/{}/teams?limit=100", ESPN_BASE, sport, league);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN teams request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "ESPN teams API error ({}): {}",
            status, body
        )));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN teams parse failed: {}", e)))
}

pub async fn fetch_summary(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
    event_id: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!(
        "{}/{}/{}/summary?event={}",
        ESPN_BASE, sport, league, event_id
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN summary request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "ESPN summary API error ({}): {}",
            status, body
        )));
    }

    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("ESPN summary parse failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(s: &str) -> chrono::DateTime<chrono::Utc> {
        chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%SZ")
            .expect("fixture parses")
            .and_utc()
    }

    /// Split a `YYYYMMDD-YYYYMMDD` range back into its two dates.
    fn bounds(range: &str) -> (chrono::NaiveDate, chrono::NaiveDate) {
        let (a, b) = range.split_once('-').expect("range has two halves");
        let p = |s: &str| chrono::NaiveDate::parse_from_str(s, "%Y%m%d").expect("half parses");
        (p(a), p(b))
    }

    #[test]
    fn formats_as_an_espn_date_range() {
        let range = scoreboard_date_range(at("2026-08-10T14:33:00Z"), 24.0);
        assert_eq!(range, "20260808-20260812");
    }

    /// The property that actually matters, and the one the bug violated: every
    /// game `transform_scoreboard` would keep has to be *in* the payload. It
    /// keeps finals up to `window_hours` behind and starts up to
    /// `window_hours` ahead, so both edges must fall inside the range.
    #[test]
    fn covers_every_game_the_window_filter_would_keep() {
        for window in [6.0, 24.0, 48.0, 72.0] {
            let now = at("2026-08-10T14:33:00Z");
            let (start, end) = bounds(&scoreboard_date_range(now, window));
            let earliest = (now - chrono::Duration::minutes((window * 60.0) as i64)).date_naive();
            let latest = (now + chrono::Duration::minutes((window * 60.0) as i64)).date_naive();
            assert!(
                start <= earliest,
                "window {window}: {start} must reach back to {earliest}"
            );
            assert!(
                end >= latest,
                "window {window}: {end} must reach forward to {latest}"
            );
        }
    }

    /// A 7:10pm Pacific game sits on ESPN's 10th slate but timestamps as the
    /// 11th in UTC. Computing the range from a UTC instant therefore has to
    /// carry slack, or an evening request loses that night's own game — the
    /// exact failure that made this worth fixing carefully.
    #[test]
    fn pads_beyond_the_window_for_espn_game_day_offset() {
        let now = at("2026-08-11T02:10:00Z"); // 7:10pm Pacific on the 10th
        let (start, end) = bounds(&scoreboard_date_range(now, 24.0));
        let slate = chrono::NaiveDate::from_ymd_opt(2026, 8, 10).unwrap();
        assert!(
            start < slate && slate < end,
            "the 10th's slate must sit inside {start}..{end}"
        );
        // Slack on both sides, not just whatever the window rounds to.
        assert!(start <= chrono::NaiveDate::from_ymd_opt(2026, 8, 9).unwrap());
        assert!(end >= chrono::NaiveDate::from_ymd_opt(2026, 8, 12).unwrap());
    }

    #[test]
    fn a_wider_window_asks_for_a_wider_range() {
        let now = at("2026-08-10T14:33:00Z");
        let (narrow_start, narrow_end) = bounds(&scoreboard_date_range(now, 24.0));
        let (wide_start, wide_end) = bounds(&scoreboard_date_range(now, 96.0));
        assert!(wide_start < narrow_start);
        assert!(wide_end > narrow_end);
    }
}
