use crate::error::AppError;

const ESPN_BASE: &str = "https://site.api.espn.com/apis/site/v2/sports";

pub async fn fetch_scoreboard(
    client: &reqwest::Client,
    sport: &str,
    league: &str,
) -> Result<serde_json::Value, AppError> {
    let url = format!("{}/{}/{}/scoreboard", ESPN_BASE, sport, league);
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
