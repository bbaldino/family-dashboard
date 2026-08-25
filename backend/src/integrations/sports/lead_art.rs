//! Editorial "wire photo" engraving art for the broadsheet Sports screen's
//! lead story. `GET /lead-art?league=…&team=…&headline=…` composes a prompt
//! and runs it through the shared image capability, returning the image bytes.
//!
//! Like `images` and `llm`, the composed prompt is never logged or embedded in
//! an error — it can carry a caller-supplied headline.

use axum::extract::{Query, State};
use axum::response::Response;
use serde::Deserialize;

use crate::error::AppError;

#[derive(Deserialize)]
pub struct LeadArtQuery {
    pub league: String,
    pub team: String,
    pub headline: String,
}

/// `GET /lead-art` — generate (or serve cached) engraving art for the lead
/// story and return the raw image bytes with an `X-Cache: hit|miss` header.
pub async fn get_lead_art(
    State(state): State<super::routes::SportsState>,
    Query(q): Query<LeadArtQuery>,
) -> Result<Response, AppError> {
    if q.headline.trim().is_empty() || q.team.trim().is_empty() {
        return Err(AppError::BadRequest(
            "lead-art requires team and headline".to_string(),
        ));
    }

    let prompt = lead_art_prompt(&q.league, &q.team, &q.headline);
    let asset = crate::images::generate_image(&state.pool, None, &prompt).await?;
    crate::images::image_response(asset).await
}

/// Map a league identifier to a plain-English sport phrase for the prompt.
/// Case-insensitive substring match; falls back to the trimmed league string
/// itself for anything unrecognised.
fn sport_for_league(league: &str) -> &str {
    let l = league.to_lowercase();
    if l.contains("mlb") {
        "baseball"
    } else if l.contains("nba") {
        "basketball"
    } else if l.contains("nfl") {
        "american football"
    } else if l.contains("nhl") {
        "ice hockey"
    } else if l.contains("mls")
        || l.contains("soccer")
        || l.contains("epl")
        || l.contains("premier")
    {
        "soccer"
    } else {
        league.trim()
    }
}

/// Compose the engraving-art prompt for a lead story.
fn lead_art_prompt(league: &str, team: &str, headline: &str) -> String {
    let sport = sport_for_league(league);
    let team = team.trim();
    let headline = headline.trim();
    format!(
        "A high-contrast black-and-white newspaper engraving illustration for a sports section \
         — fine pen-and-ink stipple and cross-hatching, ink on cream newsprint, dramatic \
         editorial article art. Depict a {sport} scene evoking the {team}. Mood: {headline}. \
         Wide horizontal composition, single clear subject centered, generous margins. \
         Absolutely no text, no words, no letters, no numbers, no logos, and no scoreboards \
         anywhere in the image."
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_includes_team_sport_headline_and_guard() {
        let prompt = lead_art_prompt("MLB", "Tampa Bay Rays", "a late-inning comeback");
        assert!(prompt.contains("Tampa Bay Rays"), "should include team");
        assert!(prompt.contains("baseball"), "should include mapped sport");
        assert!(
            prompt.contains("a late-inning comeback"),
            "should include headline"
        );
        assert!(prompt.contains("no text"), "should include no-text guard");
        assert!(prompt.contains("no logos"), "should include no-logos guard");
    }

    #[test]
    fn sport_for_league_maps_known_leagues() {
        assert_eq!(sport_for_league("MLB"), "baseball");
        assert_eq!(sport_for_league("mlb"), "baseball");
        assert_eq!(sport_for_league("NBA"), "basketball");
    }

    #[test]
    fn sport_for_league_falls_back_to_trimmed_input() {
        assert_eq!(sport_for_league("  XYZ League  "), "XYZ League");
    }

    #[test]
    fn prompt_is_deterministic() {
        let a = lead_art_prompt("NBA", "Boston Celtics", "a defensive stand");
        let b = lead_art_prompt("NBA", "Boston Celtics", "a defensive stand");
        assert_eq!(a, b);
    }
}
