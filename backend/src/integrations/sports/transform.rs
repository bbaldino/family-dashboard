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

    Some(LiveGameDetail {
        win_probability: parse_win_probability(summary),
        sport_specific: SportSpecificLive::Mlb(MlbLiveDetail {
            matchup: parse_matchup(summary),
            pitch_sequence: parse_pitch_sequence(summary),
            recent_plays: parse_recent_plays(summary, 5),
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

fn parse_matchup(summary: &serde_json::Value) -> Option<Matchup> {
    let situation = summary["situation"].as_object()?;
    let pitcher_raw = situation.get("pitcher")?;
    let batter_raw = situation.get("batter")?;

    Some(Matchup {
        pitcher: extract_pitcher_info(pitcher_raw),
        batter: extract_batter_info(batter_raw),
    })
}

fn extract_pitcher_info(node: &serde_json::Value) -> PitcherInfo {
    let athlete = &node["athlete"];
    let id = athlete["id"].as_str().unwrap_or("").to_string();
    PitcherInfo {
        headshot_url: if id.is_empty() {
            None
        } else {
            Some(format!(
                "https://a.espncdn.com/i/headshots/mlb/players/full/{}.png",
                id
            ))
        },
        id,
        name: athlete["displayName"].as_str().unwrap_or("").to_string(),
        hand: athlete["hand"]["abbreviation"].as_str().map(String::from),
        era: node["summary"].as_str().map(String::from),
        pitches_today: node["pitchesThrown"].as_u64().map(|n| n as u32),
        record: athlete["record"].as_str().map(String::from),
    }
}

fn extract_batter_info(node: &serde_json::Value) -> BatterInfo {
    let athlete = &node["athlete"];
    let id = athlete["id"].as_str().unwrap_or("").to_string();
    BatterInfo {
        headshot_url: if id.is_empty() {
            None
        } else {
            Some(format!(
                "https://a.espncdn.com/i/headshots/mlb/players/full/{}.png",
                id
            ))
        },
        id,
        name: athlete["displayName"].as_str().unwrap_or("").to_string(),
        hand: athlete["batsAndThrows"].as_str().map(String::from),
        avg: node["summary"].as_str().map(String::from),
        hr: node["statistics"][1]["displayValue"]
            .as_str()
            .and_then(|s| s.parse::<u32>().ok()),
        rbi: node["statistics"][2]["displayValue"]
            .as_str()
            .and_then(|s| s.parse::<u32>().ok()),
        today_line: node["statistics"][0]["displayValue"]
            .as_str()
            .map(String::from),
    }
}

fn parse_pitch_sequence(summary: &serde_json::Value) -> Vec<Pitch> {
    summary["atBats"]
        .as_array()
        .and_then(|abs| abs.last())
        .and_then(|ab| ab["plays"].as_array())
        .map(|plays| {
            plays
                .iter()
                .map(|p| Pitch {
                    kind: classify_pitch(p),
                    speed_mph: p["pitchVelocity"].as_u64().map(|n| n as u32),
                    pitch_type: p["pitchType"]["text"].as_str().map(String::from),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn classify_pitch(play: &serde_json::Value) -> String {
    let type_text = play["type"]["text"].as_str().unwrap_or("");
    match type_text.to_ascii_lowercase().as_str() {
        s if s.contains("ball") => "ball",
        s if s.contains("called strike") => "called_strike",
        s if s.contains("swinging strike") || s.contains("strike (swinging)") => "swinging_strike",
        s if s.contains("foul") => "foul",
        _ => "in_play",
    }
    .to_string()
}

fn parse_recent_plays(summary: &serde_json::Value, n: usize) -> Vec<Play> {
    summary["plays"]
        .as_array()
        .map(|plays| {
            plays
                .iter()
                .rev()
                .take(n)
                .map(|p| Play {
                    id: p["id"].as_str().unwrap_or("").to_string(),
                    text: p["text"].as_str().unwrap_or("").to_string(),
                    inning_half: p["period"]["type"].as_str().map(String::from),
                    inning_number: p["period"]["number"].as_u64().map(|n| n as u32),
                    scoring: p["scoringPlay"].as_bool().unwrap_or(false),
                })
                .collect()
        })
        .unwrap_or_default()
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
