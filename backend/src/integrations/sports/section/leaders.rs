use super::LeaderCategory;

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
pub(super) async fn build_leaders(
    state: &super::super::routes::SportsState,
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

    let index = match super::super::espn::fetch_json(
        &state.client,
        &super::super::espn::leaders_url(sport, league, year),
    )
    .await
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
            && let Ok(v) = super::super::espn::fetch_json(&state.client, r).await
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
