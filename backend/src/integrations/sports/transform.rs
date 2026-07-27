use crate::integrations::sports::types::*;

/// ESPN's scoreboard timestamps come in two shapes:
///   "2026-10-05T04:00:00Z"  — strict RFC 3339
///   "2026-10-05T04:00Z"     — minute precision, no seconds; NOT valid RFC 3339
/// chrono::DateTime::parse_from_rfc3339 rejects the second form outright,
/// which used to silently drop games months out through the window filter.
fn parse_espn_timestamp(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&chrono::Utc));
    }
    let padded = if s.ends_with('Z') && s.matches(':').count() == 1 {
        format!("{}:00Z", &s[..s.len() - 1])
    } else {
        return None;
    };
    chrono::DateTime::parse_from_rfc3339(&padded)
        .ok()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

pub fn transform_scoreboard(
    raw: &serde_json::Value,
    league_id: &str,
    tracked_team_ids: &[String],
    window_hours: f64,
) -> Vec<Game> {
    let now = chrono::Utc::now();
    let empty = vec![];
    let events = raw["events"].as_array().unwrap_or(&empty);

    events
        .iter()
        .filter_map(|event| {
            let competition = &event["competitions"][0];
            let game = parse_game(event, competition, league_id)?;

            if !tracked_team_ids.is_empty()
                && !tracked_team_ids.contains(&game.home.id)
                && !tracked_team_ids.contains(&game.away.id)
            {
                return None;
            }

            if game.state != GameState::Live {
                match parse_espn_timestamp(&game.start_time) {
                    Some(start_utc) => {
                        let hours_diff = (now - start_utc).num_minutes() as f64 / 60.0;
                        if game.state == GameState::Final || game.state == GameState::Postponed {
                            if hours_diff > window_hours {
                                return None;
                            }
                        } else if -hours_diff > window_hours {
                            return None;
                        }
                    }
                    None => {
                        tracing::warn!(
                            "sports: dropping game {} with unparseable start_time {:?}",
                            game.id,
                            game.start_time
                        );
                        return None;
                    }
                }
            }

            Some(game)
        })
        .collect()
}

fn parse_game(
    event: &serde_json::Value,
    competition: &serde_json::Value,
    league_id: &str,
) -> Option<Game> {
    let id = event["id"].as_str()?.to_string();
    let name = event["name"].as_str().unwrap_or("").to_string();
    let start_time = event["date"].as_str().unwrap_or("").to_string();

    let venue = competition["venue"]["fullName"]
        .as_str()
        .map(|s| s.to_string());

    let broadcast = competition["broadcasts"]
        .as_array()
        .and_then(|b| b.first())
        .and_then(|b| b["names"].as_array())
        .and_then(|names| names.first())
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let playoff_round = competition["notes"]
        .as_array()
        .and_then(|notes| notes.first())
        .and_then(|note| note["headline"].as_str())
        .map(|s| s.to_string());

    let status = &competition["status"];
    let status_name = status["type"]["name"]
        .as_str()
        .unwrap_or("STATUS_SCHEDULED");
    let state = match status_name {
        "STATUS_IN_PROGRESS" | "STATUS_HALFTIME" | "STATUS_END_PERIOD" => GameState::Live,
        "STATUS_FINAL" | "STATUS_FINAL_OT" => GameState::Final,
        "STATUS_POSTPONED" => GameState::Postponed,
        _ => GameState::Upcoming,
    };

    let clock = status["displayClock"].as_str().map(|s| s.to_string());
    let period = status["period"].as_i64().map(|p| p as i32);
    let period_label = status["type"]["shortDetail"]
        .as_str()
        .map(|s| s.to_string());

    let competitors = competition["competitors"].as_array()?;
    let mut home = None;
    let mut away = None;
    for comp in competitors {
        let team_data = parse_team(comp);
        if comp["homeAway"].as_str() == Some("home") {
            home = Some(team_data);
        } else {
            away = Some(team_data);
        }
    }

    let leaders = parse_leaders(competition, league_id, 2);
    let all_leaders = parse_leaders(competition, league_id, 20);

    let situation = if state == GameState::Live {
        match league_id {
            "mlb" => parse_mlb_situation(&competition["situation"]),
            "nba" => Some(GameSituation::Nba {}),
            "nhl" => Some(GameSituation::Nhl {}),
            "nfl" => Some(GameSituation::Nfl {}),
            _ => None,
        }
    } else {
        None
    };

    let last_play = if state == GameState::Live {
        parse_last_play(competition)
    } else {
        None
    };

    let headline = if state == GameState::Final {
        parse_headline(competition)
    } else {
        None
    };

    let linescores = parse_linescores(competition);
    let athletes = parse_athletes(competition);

    // ESPN game URL from links
    let espn_url = competition["links"]
        .as_array()
        .and_then(|links| {
            links
                .iter()
                .find(|l| l["text"].as_str() == Some("Gamecast"))
        })
        .and_then(|l| l["href"].as_str())
        .or_else(|| {
            event["links"]
                .as_array()
                .and_then(|links| links.first())
                .and_then(|l| l["href"].as_str())
        })
        .map(|s| s.to_string());

    Some(Game {
        id,
        league: league_id.to_string(),
        state,
        name,
        start_time,
        venue,
        broadcast,
        playoff_round,
        home: home?,
        away: away?,
        clock,
        period,
        period_label,
        leaders,
        all_leaders,
        situation,
        last_play,
        headline,
        linescores,
        athletes,
        espn_url,
        live_detail: None,
    })
}

fn parse_team(competitor: &serde_json::Value) -> GameTeam {
    let team = &competitor["team"];
    let score_str = competitor["score"].as_str().unwrap_or("");
    let score = score_str.parse::<i32>().ok();
    let winner = competitor["winner"].as_bool();
    let record = competitor["records"]
        .as_array()
        .and_then(|r| r.first())
        .and_then(|r| r["summary"].as_str())
        .map(|s| s.to_string());

    GameTeam {
        id: team["id"].as_str().unwrap_or("").to_string(),
        name: team["shortDisplayName"]
            .as_str()
            .or_else(|| team["displayName"].as_str())
            .unwrap_or("")
            .to_string(),
        abbreviation: team["abbreviation"].as_str().unwrap_or("").to_string(),
        logo: team["logo"].as_str().unwrap_or("").to_string(),
        record,
        score,
        winner,
        color: team["color"].as_str().map(String::from),
        alt_color: team["alternateColor"].as_str().map(String::from),
        hits: competitor["hits"].as_u64().map(|n| n as u32),
        errors: competitor["errors"].as_u64().map(|n| n as u32),
    }
}

fn parse_leaders(competition: &serde_json::Value, _league_id: &str, max: usize) -> Vec<Leader> {
    let empty = vec![];
    let leaders_arr = competition["leaders"].as_array().unwrap_or(&empty);

    let home_id = competition["competitors"]
        .as_array()
        .and_then(|c| {
            c.iter()
                .find(|comp| comp["homeAway"].as_str() == Some("home"))
        })
        .and_then(|c| c["team"]["id"].as_str())
        .unwrap_or("");

    let mut result = Vec::new();
    for category in leaders_arr {
        if let Some(top) = category["leaders"].as_array().and_then(|l| l.first()) {
            let athlete = &top["athlete"];
            let name = athlete["shortName"]
                .as_str()
                .or_else(|| athlete["displayName"].as_str())
                .unwrap_or("")
                .to_string();

            let stat_value = top["displayValue"].as_str().unwrap_or("").to_string();
            let stat_name = category["shortDisplayName"]
                .as_str()
                .or_else(|| category["displayName"].as_str())
                .unwrap_or("")
                .to_string();

            let team_id = athlete["team"]["id"].as_str().unwrap_or("");
            let team = if team_id == home_id { "home" } else { "away" };

            result.push(Leader {
                team: team.to_string(),
                name,
                stats: format!("{} {}", stat_value, stat_name),
            });
        }
        if result.len() >= max {
            break;
        }
    }
    result
}

fn parse_linescores(competition: &serde_json::Value) -> Vec<LinescoreEntry> {
    let competitors = match competition["competitors"].as_array() {
        Some(c) => c,
        None => return vec![],
    };

    let home = competitors
        .iter()
        .find(|c| c["homeAway"].as_str() == Some("home"));
    let away = competitors
        .iter()
        .find(|c| c["homeAway"].as_str() == Some("away"));

    let (Some(home), Some(away)) = (home, away) else {
        return vec![];
    };

    let home_scores = home["linescores"].as_array();
    let away_scores = away["linescores"].as_array();

    let (Some(home_scores), Some(away_scores)) = (home_scores, away_scores) else {
        return vec![];
    };

    let len = home_scores.len().max(away_scores.len());
    (0..len)
        .map(|i| LinescoreEntry {
            period: (i + 1) as i32,
            home_score: home_scores
                .get(i)
                .and_then(|s| s["displayValue"].as_str())
                .unwrap_or("-")
                .to_string(),
            away_score: away_scores
                .get(i)
                .and_then(|s| s["displayValue"].as_str())
                .unwrap_or("-")
                .to_string(),
        })
        .collect()
}

fn parse_athletes(competition: &serde_json::Value) -> Vec<GameAthlete> {
    let mut result = Vec::new();

    // Probable pitchers (MLB upcoming games)
    let empty = vec![];
    let competitors = competition["competitors"].as_array().unwrap_or(&empty);
    for comp in competitors {
        let team = comp["homeAway"].as_str().map(String::from);
        if let Some(probables) = comp["probables"].as_array() {
            for prob in probables {
                let athlete = &prob["athlete"];
                let name = athlete["displayName"].as_str().unwrap_or("").to_string();
                if name.is_empty() {
                    continue;
                }
                let athlete_id = json_id(&athlete["id"]);
                let headshot_url = athlete_id.as_deref().map(mlb_headshot_url);
                let stats = prob["statistics"]
                    .as_array()
                    .map(|stats| {
                        stats
                            .iter()
                            .filter_map(|s| {
                                let abbr = s["abbreviation"].as_str()?;
                                let val = s["displayValue"].as_str()?;
                                Some(format!("{} {}", val, abbr))
                            })
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .filter(|s| !s.is_empty());
                result.push(GameAthlete {
                    name,
                    stats,
                    role: "probable".to_string(),
                    athlete_id,
                    team: team.clone(),
                    headshot_url,
                });
            }
        }
    }

    // Featured athletes (winning/losing pitcher for finals)
    if let Some(featured) = competition["status"]["featuredAthletes"].as_array() {
        for athlete in featured {
            let inner = &athlete["athlete"];
            let name = inner["displayName"].as_str().unwrap_or("").to_string();
            if name.is_empty() {
                continue;
            }
            let role = athlete["displayName"].as_str().unwrap_or("").to_string();
            let athlete_id = json_id(&inner["id"]);
            let headshot_url = athlete_id.as_deref().map(mlb_headshot_url);
            result.push(GameAthlete {
                name,
                stats: None,
                role,
                athlete_id,
                team: None,
                headshot_url,
            });
        }
    }

    result
}

fn parse_mlb_situation(situation: &serde_json::Value) -> Option<GameSituation> {
    if situation.is_null() {
        return None;
    }
    Some(GameSituation::Mlb {
        outs: situation["outs"].as_u64().unwrap_or(0) as u8,
        on_first: situation["onFirst"].as_bool().unwrap_or(false),
        on_second: situation["onSecond"].as_bool().unwrap_or(false),
        on_third: situation["onThird"].as_bool().unwrap_or(false),
        balls: situation["balls"].as_u64().map(|v| v as u8),
        strikes: situation["strikes"].as_u64().map(|v| v as u8),
        batter: situation["batter"]["athlete"]["displayName"]
            .as_str()
            .map(|s| s.to_string()),
        pitcher: situation["pitcher"]["athlete"]["displayName"]
            .as_str()
            .map(|s| s.to_string()),
    })
}

fn parse_last_play(competition: &serde_json::Value) -> Option<String> {
    competition["situation"]["lastPlay"]["text"]
        .as_str()
        .map(|s| s.to_string())
}

fn parse_headline(competition: &serde_json::Value) -> Option<String> {
    competition["headlines"]
        .as_array()
        .and_then(|h| h.first())
        .and_then(|h| h["description"].as_str())
        .map(|s| s.to_string())
}

pub fn parse_summary_to_live_detail(summary: &serde_json::Value) -> Option<LiveGameDetail> {
    // Bail if the payload doesn't look like a real summary (e.g. error response)
    if !summary.is_object() || summary.get("header").is_none() {
        return None;
    }

    let scoring_plays = parse_scoring_plays(summary);
    let in_progress_scoring = current_inning_scoring(summary, &scoring_plays);
    Some(LiveGameDetail {
        win_probability: parse_win_probability(summary),
        sport_specific: SportSpecificLive::Mlb(MlbLiveDetail {
            matchup: parse_matchup(summary),
            recent_plays: parse_recent_plays(summary, 5),
            scoring_plays,
            in_progress_scoring,
            scoring_recap: None,
            leaders: parse_game_leaders(summary),
        }),
    })
}

fn parse_win_probability(summary: &serde_json::Value) -> Option<WinProbability> {
    let wp = summary["winprobability"].as_array()?.last()?;
    let home = wp["homeWinPercentage"].as_f64().unwrap_or(0.0) as f32;
    Some(WinProbability {
        home,
        away: 1.0 - home,
    })
}

/// ESPN's summary returns `situation.pitcher = { playerId }` and
/// `situation.batter = { playerId }` — just IDs, no nested athlete data.
/// The athlete details + stats live in `boxscore.players[].statistics[].athletes[]`
/// keyed by `type: "pitching"` / `type: "batting"`. We look up the current
/// player in the right stat group and read everything from there.
fn parse_matchup(summary: &serde_json::Value) -> Option<Matchup> {
    let situation = summary["situation"].as_object()?;
    let pitcher_id = json_id(&situation.get("pitcher")?["playerId"])?;
    let batter_id = json_id(&situation.get("batter")?["playerId"])?;

    let pitcher = find_box_entry(summary, &pitcher_id, "pitching")
        .map(|(entry, stats)| pitcher_info_from_box(entry, &stats))?;
    let batter = find_box_entry(summary, &batter_id, "batting")
        .map(|(entry, stats)| batter_info_from_box(entry, &stats))?;

    Some(Matchup { pitcher, batter })
}

/// ESPN's JSON inconsistently encodes athlete IDs as either strings ("42001")
/// or numbers (30508). Accept both and return a string.
fn json_id(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn mlb_headshot_url(id: &str) -> String {
    format!(
        "https://a.espncdn.com/i/headshots/mlb/players/full/{}.png",
        id
    )
}

/// Find `boxscore.players[].statistics[].athletes[]` entry matching `player_id`
/// in the stat group of type `stat_type` ("pitching" or "batting"). Returns
/// the entry node plus a key→value map of that group's stats for the player.
fn find_box_entry<'a>(
    summary: &'a serde_json::Value,
    player_id: &str,
    stat_type: &str,
) -> Option<(
    &'a serde_json::Value,
    std::collections::HashMap<String, String>,
)> {
    let teams = summary["boxscore"]["players"].as_array()?;
    for team in teams {
        let Some(groups) = team["statistics"].as_array() else {
            continue;
        };
        for group in groups {
            if group["type"].as_str() != Some(stat_type) {
                continue;
            }
            let Some(athletes) = group["athletes"].as_array() else {
                continue;
            };
            for entry in athletes {
                if json_id(&entry["athlete"]["id"]).as_deref() == Some(player_id) {
                    return Some((entry, box_stats_map(entry, group)));
                }
            }
        }
    }
    None
}

fn box_stats_map(
    entry: &serde_json::Value,
    group: &serde_json::Value,
) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    if let (Some(keys), Some(stats)) = (group["keys"].as_array(), entry["stats"].as_array()) {
        for (k, v) in keys.iter().zip(stats.iter()) {
            if let (Some(k), Some(v)) = (k.as_str(), v.as_str()) {
                map.insert(k.to_string(), v.to_string());
            }
        }
    }
    map
}

fn pitcher_info_from_box(
    entry: &serde_json::Value,
    stats: &std::collections::HashMap<String, String>,
) -> PitcherInfo {
    let athlete = &entry["athlete"];
    let id = json_id(&athlete["id"]).unwrap_or_default();
    // ESPN provides headshot.href directly in the boxscore — prefer it over
    // constructing the URL.
    let headshot_url = athlete["headshot"]["href"]
        .as_str()
        .map(String::from)
        .or_else(|| {
            if id.is_empty() {
                None
            } else {
                Some(mlb_headshot_url(&id))
            }
        });
    PitcherInfo {
        headshot_url,
        id,
        name: athlete["displayName"].as_str().unwrap_or("").to_string(),
        hand: None,
        era: stats.get("ERA").cloned(),
        pitches_today: stats.get("pitches").and_then(|s| s.parse().ok()),
        record: None,
    }
}

fn batter_info_from_box(
    entry: &serde_json::Value,
    stats: &std::collections::HashMap<String, String>,
) -> BatterInfo {
    let athlete = &entry["athlete"];
    let id = json_id(&athlete["id"]).unwrap_or_default();
    let headshot_url = athlete["headshot"]["href"]
        .as_str()
        .map(String::from)
        .or_else(|| {
            if id.is_empty() {
                None
            } else {
                Some(mlb_headshot_url(&id))
            }
        });
    BatterInfo {
        headshot_url,
        id,
        name: athlete["displayName"].as_str().unwrap_or("").to_string(),
        hand: None,
        avg: stats.get("avg").cloned(),
        hr: stats.get("homeRuns").and_then(|s| s.parse().ok()),
        rbi: stats.get("RBIs").and_then(|s| s.parse().ok()),
        today_line: stats.get("hits-atBats").cloned(),
    }
}

/// Most-recent N at-bat outcomes (e.g. "Betts struck out looking.").
/// Filters `summary.plays` to the `play-result` rows since those carry the
/// human-readable narrative; everything else in `.plays` is per-pitch or
/// inning-transition chatter that's too noisy for a glance card.
fn parse_recent_plays(summary: &serde_json::Value, n: usize) -> Vec<Play> {
    let Some(plays) = summary["plays"].as_array() else {
        return Vec::new();
    };
    plays
        .iter()
        .rev()
        .filter(|p| p["type"]["type"].as_str() == Some("play-result"))
        .take(n)
        .map(play_from_value)
        .collect()
}

/// Return the scoring plays that belong to the still-in-progress half-inning,
/// i.e. share `(inning_half, inning_number)` with the most recent play. Returns
/// an empty list if the game is final (every half-inning is "completed" in that
/// case, so nothing is in-progress).
pub fn current_inning_scoring(summary: &serde_json::Value, scoring: &[Play]) -> Vec<Play> {
    if summary["header"]["competitions"][0]["status"]["type"]["state"].as_str() == Some("post") {
        return Vec::new();
    }
    let Some(last) = summary["plays"].as_array().and_then(|a| a.last()) else {
        return Vec::new();
    };
    let half = last["period"]["type"].as_str().map(String::from);
    let number = last["period"]["number"].as_u64().map(|n| n as u32);
    if half.is_none() || number.is_none() {
        return Vec::new();
    }
    scoring
        .iter()
        .filter(|p| p.inning_half == half && p.inning_number == number)
        .cloned()
        .collect()
}

/// All scoring plays from the game in chronological order.
fn parse_scoring_plays(summary: &serde_json::Value) -> Vec<Play> {
    let Some(plays) = summary["plays"].as_array() else {
        return Vec::new();
    };
    plays
        .iter()
        .filter(|p| p["scoringPlay"].as_bool().unwrap_or(false))
        .map(play_from_value)
        .collect()
}

fn play_from_value(p: &serde_json::Value) -> Play {
    Play {
        id: p["id"].as_str().unwrap_or("").to_string(),
        text: p["text"].as_str().unwrap_or("").to_string(),
        inning_half: p["period"]["type"].as_str().map(String::from),
        inning_number: p["period"]["number"].as_u64().map(|n| n as u32),
        team_id: json_id(&p["team"]["id"]),
        scoring: p["scoringPlay"].as_bool().unwrap_or(false),
    }
}

fn parse_game_leaders(summary: &serde_json::Value) -> GameLeaders {
    let groups = summary["leaders"].as_array().cloned().unwrap_or_default();
    let mut home = Vec::new();
    let mut away = Vec::new();

    for team_group in groups {
        let is_home = team_group["team"]["homeAway"].as_str() == Some("home");
        if let Some(categories) = team_group["leaders"].as_array() {
            for cat in categories {
                let category = cat["displayName"].as_str().unwrap_or("").to_string();
                if let Some(leaders) = cat["leaders"].as_array() {
                    for leader in leaders {
                        let item = GameLeader {
                            category: category.clone(),
                            player_name: leader["athlete"]["displayName"]
                                .as_str()
                                .unwrap_or("")
                                .to_string(),
                            display_value: leader["displayValue"]
                                .as_str()
                                .unwrap_or("")
                                .to_string(),
                        };
                        if is_home {
                            home.push(item);
                        } else {
                            away.push(item);
                        }
                    }
                }
            }
        }
    }

    GameLeaders { home, away }
}

pub fn transform_teams(raw: &serde_json::Value, league_id: &str) -> Vec<TeamInfo> {
    let empty = vec![];
    let sports = raw["sports"].as_array().unwrap_or(&empty);
    let teams_arr = sports
        .first()
        .and_then(|s| s["leagues"].as_array())
        .and_then(|l| l.first())
        .and_then(|l| l["teams"].as_array())
        .unwrap_or(&empty);

    teams_arr
        .iter()
        .filter_map(|entry| {
            let team = &entry["team"];
            Some(TeamInfo {
                id: team["id"].as_str()?.to_string(),
                name: team["shortDisplayName"]
                    .as_str()
                    .or_else(|| team["displayName"].as_str())?
                    .to_string(),
                display_name: team["displayName"].as_str()?.to_string(),
                abbreviation: team["abbreviation"].as_str().unwrap_or("").to_string(),
                logo: team["logos"]
                    .as_array()
                    .and_then(|l| l.first())
                    .and_then(|l| l["href"].as_str())
                    .unwrap_or("")
                    .to_string(),
                league: league_id.to_string(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_espn_timestamp_accepts_strict_rfc3339() {
        let dt = parse_espn_timestamp("2026-10-05T04:00:00Z").expect("parse");
        assert_eq!(dt.to_rfc3339(), "2026-10-05T04:00:00+00:00");
    }

    #[test]
    fn parse_espn_timestamp_accepts_minute_precision_no_seconds() {
        let dt = parse_espn_timestamp("2026-10-05T04:00Z").expect("parse");
        assert_eq!(dt.to_rfc3339(), "2026-10-05T04:00:00+00:00");
    }

    #[test]
    fn parse_espn_timestamp_rejects_gibberish() {
        assert!(parse_espn_timestamp("not-a-timestamp").is_none());
        assert!(parse_espn_timestamp("").is_none());
    }
}
