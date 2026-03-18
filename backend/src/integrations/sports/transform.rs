use crate::integrations::sports::types::*;

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
                if let Ok(start) = chrono::DateTime::parse_from_rfc3339(&game.start_time) {
                    let start_utc = start.with_timezone(&chrono::Utc);
                    let hours_diff = (now - start_utc).num_minutes() as f64 / 60.0;
                    if game.state == GameState::Final || game.state == GameState::Postponed {
                        if hours_diff > window_hours {
                            return None;
                        }
                    } else {
                        if -hours_diff > window_hours {
                            return None;
                        }
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

    let situation = if league_id == "mlb" && state == GameState::Live {
        parse_mlb_situation(&competition["situation"])
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
        linescores,
        athletes,
        espn_url,
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
        if let Some(probables) = comp["probables"].as_array() {
            for prob in probables {
                let name = prob["athlete"]["displayName"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                if name.is_empty() {
                    continue;
                }
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
                });
            }
        }
    }

    // Featured athletes (winning/losing pitcher for finals)
    if let Some(featured) = competition["status"]["featuredAthletes"].as_array() {
        for athlete in featured {
            let name = athlete["athlete"]["displayName"]
                .as_str()
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }
            let role = athlete["displayName"].as_str().unwrap_or("").to_string();
            result.push(GameAthlete {
                name,
                stats: None,
                role,
            });
        }
    }

    result
}

fn parse_mlb_situation(situation: &serde_json::Value) -> Option<String> {
    if situation.is_null() {
        return None;
    }
    let outs = situation["outs"].as_i64().unwrap_or(0);
    let on_first = situation["onFirst"].as_bool().unwrap_or(false);
    let on_second = situation["onSecond"].as_bool().unwrap_or(false);
    let on_third = situation["onThird"].as_bool().unwrap_or(false);

    let mut runners = Vec::new();
    if on_first {
        runners.push("1st");
    }
    if on_second {
        runners.push("2nd");
    }
    if on_third {
        runners.push("3rd");
    }

    let outs_str = if outs == 1 {
        "1 out".to_string()
    } else {
        format!("{} outs", outs)
    };
    if runners.is_empty() {
        Some(outs_str)
    } else {
        Some(format!(
            "{} · Runner{} on {}",
            outs_str,
            if runners.len() > 1 { "s" } else { "" },
            runners.join(", ")
        ))
    }
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
