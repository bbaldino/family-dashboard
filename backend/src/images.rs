//! The image-generation capability: turn a text prompt into an image via the
//! caas gateway (`POST {base}/images/generate`), with a persistent,
//! content-addressed disk cache so an identical (model, prompt) never hits the
//! gateway twice.
//!
//! Mirrors `llm`'s logging discipline (see that module's docs) for the same
//! reason: the base URL is operator-configured and a prompt can carry anything
//! the caller puts in it. The prompt, the returned base64, and the decoded
//! image bytes are NEVER logged or embedded in an error — errors carry the
//! model name and upstream status/code only.

use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::time::Duration;

use axum::{
    Router,
    extract::State,
    http::{HeaderName, header},
    response::{IntoResponse, Response},
    routing::post,
};
use base64::Engine;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

/// Shared client with the same 120s ceiling as `llm`: image generation can
/// legitimately run for tens of seconds, but the bound is required because
/// `POST /generate` is unauthenticated and LAN-reachable.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
});

const DEFAULT_MODEL: &str = "gemini-3.1-flash-image";
const DEFAULT_CACHE_DIR: &str = "image-cache";

/// A generated (or cached) image on disk. `path` points at the cache file;
/// `mime` is the sniffed content type; `cache_hit` says whether the gateway
/// was skipped.
pub struct ImageAsset {
    pub path: PathBuf,
    pub mime: &'static str,
    pub cache_hit: bool,
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/generate", post(generate_route))
        .with_state(pool)
}

/// The request body for `POST /generate`: `{"prompt", "model"?}`.
#[derive(Deserialize)]
pub struct GenerateRequest {
    pub prompt: String,
    pub model: Option<String>,
}

/// `POST /generate` — a thin HTTP wrapper over [`generate_image`]. Returns the
/// raw image bytes with the sniffed `Content-Type` and an `X-Cache: hit|miss`
/// header.
async fn generate_route(
    State(pool): State<SqlitePool>,
    axum::Json(req): axum::Json<GenerateRequest>,
) -> Result<Response, AppError> {
    let asset = generate_image(&pool, req.model.as_deref(), &req.prompt).await?;

    let bytes = tokio::fs::read(&asset.path)
        .await
        .map_err(|e| AppError::Internal(format!("failed to read cached image: {e}")))?;

    let cache = if asset.cache_hit { "hit" } else { "miss" };

    Ok((
        [
            (header::CONTENT_TYPE, asset.mime),
            (HeaderName::from_static("x-cache"), cache),
        ],
        bytes,
    )
        .into_response())
}

/// Generate an image from `prompt` against the configured caas gateway,
/// caching it content-addressed on disk. On a cache hit the gateway is not
/// called. `model` overrides the configured default when `Some`.
///
/// Never logs `prompt`, the returned base64, or the image bytes. On failure
/// the error carries the model name and, for a non-2xx response, the upstream
/// status and short error `code` — never the prompt or any response content.
pub async fn generate_image(
    pool: &SqlitePool,
    model: Option<&str>,
    prompt: &str,
) -> Result<ImageAsset, AppError> {
    let images = IntegrationConfig::new(pool, "images");

    // Base URL: prefer images.url, fall back to llm.url, else a clear error.
    let base = match images.get("url").await {
        Ok(url) => url,
        Err(_) => IntegrationConfig::new(pool, "llm")
            .get("url")
            .await
            .map_err(|_| AppError::BadRequest("images.url/llm.url not configured".to_string()))?,
    };

    let default_model = images.get_or("model", DEFAULT_MODEL).await?;
    let effective_model = model.unwrap_or(&default_model);

    let cache_dir_str = images.get_or("cache_dir", DEFAULT_CACHE_DIR).await?;
    let cache_dir = Path::new(&cache_dir_str);

    let stem = cache_stem(effective_model, prompt);

    // Cache HIT: return the stored file without touching the gateway.
    if let Some(asset) = lookup_cached(cache_dir, &stem) {
        return Ok(asset);
    }

    // Cache MISS: generate.
    tokio::fs::create_dir_all(cache_dir)
        .await
        .map_err(|e| AppError::Internal(format!("failed to create cache dir: {e}")))?;

    let resp = CLIENT
        .post(format!("{}/images/generate", base.trim_end_matches('/')))
        .json(&serde_json::json!({
            "prompt": prompt,
            "model": effective_model,
            "response_format": "b64_json",
        }))
        .send()
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "image gen request failed for model '{effective_model}': {}",
                e.without_url()
            ))
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        // Try to extract only the short `code`; never echo `message`.
        let code = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v["code"].as_str().map(str::to_string));
        return Err(AppError::Internal(match code {
            Some(code) => {
                format!("image gen returned {status} ({code}) for model '{effective_model}'")
            }
            None => format!("image gen returned {status} for model '{effective_model}'"),
        }));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        AppError::Internal(format!(
            "image gen parse failed for model '{effective_model}': {}",
            e.without_url()
        ))
    })?;

    let b64 = data["images"][0]["b64"].as_str().ok_or_else(|| {
        AppError::Internal(format!(
            "image gen response missing images[0].b64 for model '{effective_model}'"
        ))
    })?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|_| {
            AppError::Internal(format!(
                "image gen returned undecodable base64 for model '{effective_model}'"
            ))
        })?;

    let (ext, mime) = sniff_format(&bytes).ok_or_else(|| {
        AppError::Internal(format!(
            "image gen returned unrecognized image format for model '{effective_model}'"
        ))
    })?;

    let path = cache_dir.join(format!("{stem}.{ext}"));
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| AppError::Internal(format!("failed to write cached image: {e}")))?;

    Ok(ImageAsset {
        path,
        mime,
        cache_hit: false,
    })
}

/// The content-addressed cache filename stem for a (model, prompt) pair:
/// `sha256("{model}\n{prompt}")` encoded url-safe (no padding, no slashes).
fn cache_stem(model: &str, prompt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{model}\n{prompt}").as_bytes());
    let digest = hasher.finalize();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

/// Sniff an image's format from its leading magic bytes, returning
/// `(extension, mime)`. Recognizes JPEG and PNG; anything else is `None`.
fn sniff_format(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    const PNG_MAGIC: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("jpg", "image/jpeg"))
    } else if bytes.starts_with(&PNG_MAGIC) {
        Some(("png", "image/png"))
    } else {
        None
    }
}

/// Look for an already-cached image (either `{stem}.jpg` or `{stem}.png`) in
/// `cache_dir`. Returns a hit `ImageAsset` without touching the network.
fn lookup_cached(cache_dir: &Path, stem: &str) -> Option<ImageAsset> {
    for (ext, mime) in [("jpg", "image/jpeg"), ("png", "image/png")] {
        let path = cache_dir.join(format!("{stem}.{ext}"));
        if path.exists() {
            return Some(ImageAsset {
                path,
                mime,
                cache_hit: true,
            });
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_stem_is_deterministic() {
        let a = cache_stem("model-x", "a red barn");
        let b = cache_stem("model-x", "a red barn");
        assert_eq!(a, b);
    }

    #[test]
    fn cache_stem_differs_by_prompt() {
        let a = cache_stem("model-x", "a red barn");
        let b = cache_stem("model-x", "a blue barn");
        assert_ne!(a, b);
    }

    #[test]
    fn cache_stem_differs_by_model() {
        let a = cache_stem("model-x", "a red barn");
        let b = cache_stem("model-y", "a red barn");
        assert_ne!(a, b);
    }

    #[test]
    fn cache_stem_is_url_safe() {
        let stem = cache_stem("model-x", "a red barn");
        assert!(!stem.contains('/'));
        assert!(!stem.contains('+'));
        assert!(!stem.contains('='));
    }

    #[test]
    fn sniff_jpeg() {
        assert_eq!(
            sniff_format(&[0xFF, 0xD8, 0xFF, 0xE0, 0x00]),
            Some(("jpg", "image/jpeg"))
        );
    }

    #[test]
    fn sniff_png() {
        assert_eq!(
            sniff_format(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]),
            Some(("png", "image/png"))
        );
    }

    #[test]
    fn sniff_garbage_is_none() {
        assert_eq!(sniff_format(&[0x00, 0x01, 0x02, 0x03]), None);
        assert_eq!(sniff_format(&[]), None);
    }

    #[test]
    fn lookup_cached_finds_existing_jpg() {
        let dir = std::env::temp_dir().join(format!("images-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let stem = "abc123";
        std::fs::write(dir.join(format!("{stem}.jpg")), b"\xFF\xD8\xFF").unwrap();

        let hit = lookup_cached(&dir, stem).expect("should find cached jpg");
        assert!(hit.cache_hit);
        assert_eq!(hit.mime, "image/jpeg");
        assert_eq!(hit.path, dir.join("abc123.jpg"));

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn lookup_cached_miss_is_none() {
        let dir = std::env::temp_dir().join(format!("images-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();

        assert!(lookup_cached(&dir, "does-not-exist").is_none());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
