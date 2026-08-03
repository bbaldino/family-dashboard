use std::time::Instant;

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::error::AppError;

const OPEN_METEO_BASE: &str = "https://air-quality-api.open-meteo.com/v1/air-quality";

/// How long a fetched reading stays "fresh" before we prefer a new fetch —
/// AQI/UV/pollen all drift over tens of minutes, not seconds, unlike a live
/// scoreboard, so this is far more generous than the sports live-game cache.
const FRESH_TTL_SECS: u64 = 15 * 60;

/// The subset of Open-Meteo's `current` block we care about. Field names
/// (`us_aqi`, `uv_index`, `<species>_pollen`) were verified live against
/// `https://air-quality-api.open-meteo.com/v1/air-quality` and match the
/// brief exactly. One correction found live, not in the brief: pollen
/// coverage is Europe-only (Open-Meteo's CAMS European regional model) — a
/// US lat/lon (this dashboard's configured default) always returns `null`
/// for every `*_pollen` field, while `uv_index` and `us_aqi` are global and
/// populated. We pass all of them through as `Option`s rather than
/// special-casing pollen, so the reshape degrades the same way regardless of
/// *why* a field is missing.
#[derive(Debug, Deserialize, Default)]
struct OpenMeteoCurrent {
    us_aqi: Option<f64>,
    uv_index: Option<f64>,
    alder_pollen: Option<f64>,
    birch_pollen: Option<f64>,
    grass_pollen: Option<f64>,
    mugwort_pollen: Option<f64>,
    olive_pollen: Option<f64>,
    ragweed_pollen: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    current: Option<OpenMeteoCurrent>,
}

/// The stable shape we actually hand the frontend — never Open-Meteo's raw
/// response. Every field is independently optional so a partial upstream
/// response (pollen null, AQI present, which is the normal case for a US
/// location) degrades one figure at a time instead of blanking the whole
/// cell.
#[derive(Debug, Clone, Serialize, Default)]
pub struct AirQuality {
    pub aqi: Option<i64>,
    pub aqi_level: Option<String>,
    pub uv_index: Option<f64>,
    pub uv_level: Option<String>,
    pub pollen: Option<f64>,
    pub pollen_level: Option<String>,
}

/// US EPA AQI bands (https://www.airnow.gov/aqi/aqi-basics/), 0-500 scale.
/// Slugs, not display words — the frontend owns how tight a label ("GOOD",
/// "V.UNHLTHY") fits the strip's fixed cell width.
fn aqi_level(aqi: i64) -> &'static str {
    match aqi {
        i64::MIN..=50 => "good",
        51..=100 => "moderate",
        101..=150 => "unhealthy_sensitive",
        151..=200 => "unhealthy",
        201..=300 => "very_unhealthy",
        _ => "hazardous",
    }
}

/// WHO/EPA UV index bands (https://www.epa.gov/sunsafety/uv-index-scale-0).
fn uv_level(uv: f64) -> &'static str {
    match uv {
        u if u < 3.0 => "low",
        u if u < 6.0 => "moderate",
        u if u < 8.0 => "high",
        u if u < 11.0 => "very_high",
        _ => "extreme",
    }
}

/// Pollen has no single published cross-species scale the way AQI and UV
/// do — the US National Allergy Bureau and UK Met Office both publish
/// *per-species* breakpoints that vary by an order of magnitude (tree
/// pollen's "high" starts around 90 grains/m3, grass's around 50). Since we
/// reduce six species to one figure (the max reading — the usual approach,
/// per the brief) before we know which species it came from, exact
/// per-species breakpoints don't apply. This buckets the max against the
/// UK Met Office's grass-pollen scale as a general-purpose approximation:
/// none / low / moderate / high / very-high at 0 / 30 / 50 / 150 grains/m3.
/// Documented here, in one place, rather than left implicit.
fn pollen_level(max_grains: f64) -> &'static str {
    match max_grains {
        m if m <= 0.0 => "none",
        m if m <= 30.0 => "low",
        m if m <= 50.0 => "moderate",
        m if m <= 150.0 => "high",
        _ => "very_high",
    }
}

fn reshape(current: OpenMeteoCurrent) -> AirQuality {
    let aqi = current.us_aqi.map(|v| v.round() as i64);
    let aqi_lvl = aqi.map(aqi_level).map(str::to_string);

    let uv = current.uv_index;
    let uv_lvl = uv.map(uv_level).map(str::to_string);

    // Max across species, ignoring absent ones — `None` only when every
    // species is `None` (the US case, always).
    let pollen_max = [
        current.alder_pollen,
        current.birch_pollen,
        current.grass_pollen,
        current.mugwort_pollen,
        current.olive_pollen,
        current.ragweed_pollen,
    ]
    .into_iter()
    .flatten()
    .fold(None::<f64>, |acc, v| Some(acc.map_or(v, |a| a.max(v))));
    let pollen_lvl = pollen_max.map(pollen_level).map(str::to_string);

    AirQuality {
        aqi,
        aqi_level: aqi_lvl,
        uv_index: uv,
        uv_level: uv_lvl,
        pollen: pollen_max,
        pollen_level: pollen_lvl,
    }
}

async fn fetch(client: &reqwest::Client, lat: &str, lon: &str) -> Result<AirQuality, AppError> {
    let url = format!(
        "{}?latitude={}&longitude={}&current=us_aqi,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen",
        OPEN_METEO_BASE, lat, lon
    );

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Open-Meteo request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Open-Meteo error ({}): {}",
            status, body
        )));
    }

    let data: OpenMeteoResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Open-Meteo parse failed: {}", e)))?;

    Ok(reshape(data.current.unwrap_or_default()))
}

struct CacheEntry {
    data: AirQuality,
    fetched_at: Instant,
}

/// A single-slot cache — the dashboard has one configured location, unlike
/// sports' per-league keys — with the same fetch/stale-fallback shape as
/// `sports::cache::EspnCache`: fresh-if-recent, otherwise serve the last
/// good reading rather than nothing while Open-Meteo is slow or down.
pub struct AirQualityCache {
    entry: RwLock<Option<CacheEntry>>,
}

impl AirQualityCache {
    pub fn new() -> Self {
        Self {
            entry: RwLock::new(None),
        }
    }

    async fn get_fresh(&self) -> Option<AirQuality> {
        let guard = self.entry.read().await;
        guard.as_ref().and_then(|e| {
            if e.fetched_at.elapsed().as_secs() < FRESH_TTL_SECS {
                Some(e.data.clone())
            } else {
                None
            }
        })
    }

    async fn get_stale(&self) -> Option<AirQuality> {
        let guard = self.entry.read().await;
        guard.as_ref().map(|e| e.data.clone())
    }

    async fn set(&self, data: AirQuality) {
        let mut guard = self.entry.write().await;
        *guard = Some(CacheEntry {
            data,
            fetched_at: Instant::now(),
        });
    }
}

impl Default for AirQualityCache {
    fn default() -> Self {
        Self::new()
    }
}

/// The current air-quality reading, isolated from any Open-Meteo failure:
/// fresh cache hit, else a live fetch, else the last good reading, else an
/// all-`None` `AirQuality`. This never returns `Err` — a slow or dead third
/// party must never fail the response the strip's other four cells (sun,
/// hourly, wind/humidity) don't even depend on, and the UV/AQI/pollen cells
/// degrade individually via the `Option`s instead.
pub async fn get_air_quality(
    client: &reqwest::Client,
    cache: &AirQualityCache,
    lat: &str,
    lon: &str,
) -> AirQuality {
    if let Some(fresh) = cache.get_fresh().await {
        return fresh;
    }

    match fetch(client, lat, lon).await {
        Ok(data) => {
            cache.set(data.clone()).await;
            data
        }
        Err(e) => {
            tracing::warn!("Open-Meteo air-quality fetch failed, falling back: {}", e);
            cache.get_stale().await.unwrap_or_default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aqi_level_boundaries() {
        assert_eq!(aqi_level(0), "good");
        assert_eq!(aqi_level(50), "good");
        assert_eq!(aqi_level(51), "moderate");
        assert_eq!(aqi_level(100), "moderate");
        assert_eq!(aqi_level(101), "unhealthy_sensitive");
        assert_eq!(aqi_level(150), "unhealthy_sensitive");
        assert_eq!(aqi_level(151), "unhealthy");
        assert_eq!(aqi_level(200), "unhealthy");
        assert_eq!(aqi_level(201), "very_unhealthy");
        assert_eq!(aqi_level(300), "very_unhealthy");
        assert_eq!(aqi_level(301), "hazardous");
        assert_eq!(aqi_level(500), "hazardous");
    }

    #[test]
    fn uv_level_boundaries() {
        assert_eq!(uv_level(0.0), "low");
        assert_eq!(uv_level(2.9), "low");
        assert_eq!(uv_level(3.0), "moderate");
        assert_eq!(uv_level(5.9), "moderate");
        assert_eq!(uv_level(6.0), "high");
        assert_eq!(uv_level(7.9), "high");
        assert_eq!(uv_level(8.0), "very_high");
        assert_eq!(uv_level(10.9), "very_high");
        assert_eq!(uv_level(11.0), "extreme");
        assert_eq!(uv_level(15.0), "extreme");
    }

    #[test]
    fn pollen_level_boundaries() {
        assert_eq!(pollen_level(0.0), "none");
        assert_eq!(pollen_level(30.0), "low");
        assert_eq!(pollen_level(50.0), "moderate");
        assert_eq!(pollen_level(150.0), "high");
        assert_eq!(pollen_level(150.1), "very_high");
    }

    #[test]
    fn reshape_takes_max_pollen_species_and_ignores_nulls() {
        let current = OpenMeteoCurrent {
            us_aqi: Some(55.0),
            uv_index: Some(10.55),
            alder_pollen: None,
            birch_pollen: Some(4.0),
            grass_pollen: Some(12.0),
            mugwort_pollen: None,
            olive_pollen: Some(2.0),
            ragweed_pollen: None,
        };
        let out = reshape(current);
        assert_eq!(out.aqi, Some(55));
        assert_eq!(out.aqi_level.as_deref(), Some("moderate"));
        assert_eq!(out.uv_index, Some(10.55));
        assert_eq!(out.uv_level.as_deref(), Some("very_high"));
        assert_eq!(out.pollen, Some(12.0));
        assert_eq!(out.pollen_level.as_deref(), Some("low"));
    }

    /// The real-world case for this dashboard's US location: every pollen
    /// species is `null` from Open-Meteo (Europe-only coverage) while AQI
    /// and UV are still populated. Pollen degrades to `None`, not `0`.
    #[test]
    fn reshape_handles_all_pollen_null() {
        let current = OpenMeteoCurrent {
            us_aqi: Some(55.0),
            uv_index: Some(10.55),
            ..Default::default()
        };
        let out = reshape(current);
        assert_eq!(out.aqi, Some(55));
        assert_eq!(out.pollen, None);
        assert_eq!(out.pollen_level, None);
    }

    #[test]
    fn reshape_handles_everything_missing() {
        let out = reshape(OpenMeteoCurrent::default());
        assert_eq!(out.aqi, None);
        assert_eq!(out.aqi_level, None);
        assert_eq!(out.uv_index, None);
        assert_eq!(out.uv_level, None);
        assert_eq!(out.pollen, None);
        assert_eq!(out.pollen_level, None);
    }
}
