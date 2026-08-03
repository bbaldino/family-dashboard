use axum::Json;
use axum::extract::{Path, Query, State};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

async fn base_url(pool: &SqlitePool) -> Result<String, AppError> {
    let config = IntegrationConfig::new(pool, INTEGRATION_ID);
    let raw = config.get_or("base_url", "http://health.home").await?;
    Ok(raw.trim_end_matches('/').to_string())
}

async fn proxy_get(url: &str) -> Result<serde_json::Value, AppError> {
    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("health request failed: {}", e)))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "health returned {}",
            resp.status()
        )));
    }
    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("health parse failed: {}", e)))
}

/// Proxy the homelab-health `/api/v1/status` array through to the frontend.
/// The dashboard is served over HTTPS while the health service runs HTTP on
/// the LAN, so a direct fetch would trip mixed-content. This handler also
/// strips the `config` field from each service — the upstream schema exposes
/// it and it can contain secrets (API keys, tokens).
pub async fn get_status(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    let url = format!("{}/api/v1/status", base_url(&pool).await?);
    let mut body = proxy_get(&url).await?;
    strip_config(&mut body);
    Ok(Json(body))
}

#[derive(Deserialize)]
pub struct UptimeQuery {
    pub window: Option<u64>,
}

pub async fn get_uptime(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Query(params): Query<UptimeQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let window = params.window.unwrap_or(86400);
    let url = format!(
        "{}/api/v1/monitors/{}/uptime?window={}",
        base_url(&pool).await?,
        id,
        window
    );
    Ok(Json(proxy_get(&url).await?))
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<u64>,
}

pub async fn get_history(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Query(params): Query<HistoryQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(50);
    let url = format!(
        "{}/api/v1/monitors/{}/history?limit={}",
        base_url(&pool).await?,
        id,
        limit
    );
    Ok(Json(proxy_get(&url).await?))
}

#[derive(Deserialize)]
pub struct IncidentsQuery {
    pub since: Option<i64>,
    pub until: Option<i64>,
    pub monitor_id: Option<i64>,
    pub limit: Option<u64>,
}

/// Proxy the cross-monitor incident ledger (`/api/v1/incidents`).
///
/// Same reason as the rest of this module: the dashboard is served over HTTPS
/// and the health service is plain HTTP on the LAN, so the browser would refuse
/// a direct call as mixed content.
///
/// Every parameter is passed through rather than defaulted here — upstream owns
/// the defaults (a 7-day window, 50 rows, clamped 1..500), and duplicating them
/// would give us two places to disagree about what a ledger is.
/// Timestamps past this are certainly not epoch *seconds*. Year 2100.
///
/// `Date.now()` in JavaScript returns milliseconds, and passing it here is the
/// easy mistake — 1.7e12 is a valid integer, so it parses, and upstream answers
/// `200 []` because nothing matches a window in the year 5138. An empty ledger
/// and a mistyped timestamp then look identical, which is exactly the
/// unknown-versus-fine collapse this screen avoids everywhere else.
///
/// Deliberately the same bound homelab-health uses (v0.3.1). A looser one here
/// would leave a band — roughly year 2100 to 5000 — that we wave through and
/// they reject, so the two of us would disagree about the same timestamp and
/// the caller would get a 400 from whichever layer they happened to reach.
const MAX_PLAUSIBLE_EPOCH_SECS: i64 = 4_102_444_800;

fn check_epoch_secs(name: &str, value: i64) -> Result<(), AppError> {
    if value > MAX_PLAUSIBLE_EPOCH_SECS {
        return Err(AppError::BadRequest(format!(
            "{} looks like milliseconds ({}); this API takes epoch seconds",
            name, value
        )));
    }
    Ok(())
}

pub async fn get_incidents(
    State(pool): State<SqlitePool>,
    Query(params): Query<IncidentsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut query: Vec<String> = Vec::new();
    if let Some(since) = params.since {
        check_epoch_secs("since", since)?;
        query.push(format!("since={}", since));
    }
    if let Some(until) = params.until {
        check_epoch_secs("until", until)?;
        query.push(format!("until={}", until));
    }
    if let Some(monitor_id) = params.monitor_id {
        query.push(format!("monitor_id={}", monitor_id));
    }
    if let Some(limit) = params.limit {
        query.push(format!("limit={}", limit));
    }
    let suffix = if query.is_empty() {
        String::new()
    } else {
        format!("?{}", query.join("&"))
    };
    let url = format!("{}/api/v1/incidents{}", base_url(&pool).await?, suffix);
    Ok(Json(proxy_get(&url).await?))
}

fn strip_config(value: &mut serde_json::Value) {
    if let Some(arr) = value.as_array_mut() {
        for item in arr {
            if let Some(obj) = item.as_object_mut() {
                obj.remove("config");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_config_removes_config_from_each_service() {
        let mut v = serde_json::json!([
            {"id": 1, "name": "Foo", "status": "ok", "config": {"api_key": "SECRET"}},
            {"id": 2, "name": "Bar", "status": "critical", "config": {"token": "SECRET"}}
        ]);
        strip_config(&mut v);
        let arr = v.as_array().unwrap();
        assert!(!arr[0].as_object().unwrap().contains_key("config"));
        assert!(!arr[1].as_object().unwrap().contains_key("config"));
        assert_eq!(arr[0]["name"], "Foo");
        assert_eq!(arr[1]["status"], "critical");
    }
}
