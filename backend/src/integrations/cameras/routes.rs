use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use sqlx::SqlitePool;

use super::{FrigateClient, visits};
use crate::error::AppError;

pub async fn doorbell_today(
    State(pool): State<SqlitePool>,
) -> Result<axum::Json<visits::TodayResponse>, AppError> {
    let f = FrigateClient::from_config(&pool).await?;
    let now = chrono::Local::now();
    let after = visits::local_today_start(now);
    let url = format!(
        "{}/api/events?camera={}&label={}&after={}&has_clip=1&include_thumbnails=0&limit=200",
        f.base_url, f.camera, f.label, after
    );
    let raw: serde_json::Value = f
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Frigate request failed: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Frigate parse failed: {e}")))?;
    Ok(axum::Json(visits::build_today_response(
        &raw,
        f.gap_secs,
        f.min_score,
    )))
}

#[derive(Deserialize)]
pub struct SnapshotQuery {
    /// `?full=1` serves the full-frame `snapshot.jpg` (used for the player
    /// poster); the default is the person-crop `thumbnail.jpg` (list tiles).
    #[serde(default)]
    full: bool,
}

/// Proxy a Frigate event image for a visit's chosen event: the person-crop
/// `thumbnail.jpg` (list tiles) by default, or the full-frame `snapshot.jpg`
/// when `?full=1` is set (the wall player's poster wants the full frame).
pub async fn snapshot(
    State(pool): State<SqlitePool>,
    Path(event_id): Path<String>,
    Query(q): Query<SnapshotQuery>,
) -> Result<Response, AppError> {
    let f = FrigateClient::from_config(&pool).await?;
    let image = if q.full {
        "snapshot.jpg"
    } else {
        "thumbnail.jpg"
    };
    let url = format!("{}/api/events/{}/{}", f.base_url, event_id, image);
    let upstream = f
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Frigate snapshot failed: {e}")))?;
    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let bytes = upstream
        .bytes()
        .await
        .map_err(|e| AppError::Internal(format!("Frigate snapshot body failed: {e}")))?;
    // Only label the body an image and cache it on success. A non-2xx upstream
    // (e.g. an event with no snapshot yet) returns an error body that must not
    // be mislabeled `image/jpeg` and cached for an hour behind that event id.
    if status.is_success() {
        Ok((
            status,
            [
                (header::CONTENT_TYPE, "image/jpeg"),
                (header::CACHE_CONTROL, "public, max-age=3600"),
            ],
            bytes,
        )
            .into_response())
    } else {
        Ok((status, [(header::CACHE_CONTROL, "no-store")], bytes).into_response())
    }
}

/// Proxy a clip mp4, streaming Frigate's response straight through instead of
/// buffering the whole file first. Frigate's clips are faststart MP4s (moov
/// atom up front), so the `<video>` can begin playing as the bytes arrive
/// rather than waiting for the entire download.
///
/// Frigate does not support Range on `clip.mp4` — it answers `200`, never
/// `206` — so we relay `Accept-Ranges`/`Content-Range` only if it ever does,
/// and otherwise the browser progressively downloads and plays the full clip.
/// The inbound Range header is still forwarded so a future range-capable
/// Frigate would just work.
pub async fn clip(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Path(event_id): Path<String>,
) -> Result<Response, AppError> {
    let f = FrigateClient::from_config(&pool).await?;
    let url = format!("{}/api/events/{}/clip.mp4", f.base_url, event_id);
    let mut req = f.client.get(&url);
    if let Some(range) = headers.get(header::RANGE) {
        req = req.header(header::RANGE, range);
    }
    let upstream = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Frigate clip failed: {e}")))?;

    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let mut out = Response::builder().status(status);
    // Relay only what upstream actually provides — including a Content-Range /
    // Accept-Ranges pair if Frigate ever answers a range, but never claiming
    // range support it doesn't have.
    for name in [
        header::CONTENT_TYPE,
        header::CONTENT_LENGTH,
        header::CONTENT_RANGE,
        header::ACCEPT_RANGES,
    ] {
        if let Some(v) = upstream.headers().get(&name) {
            out = out.header(name, v);
        }
    }
    out.body(Body::from_stream(upstream.bytes_stream()))
        .map_err(|e| AppError::Internal(format!("clip response build failed: {e}")))
}
