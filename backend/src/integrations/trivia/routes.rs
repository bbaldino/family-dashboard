use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::error::AppError;

const CACHE_TTL_SECS: u64 = 24 * 60 * 60; // 24 hours
const OPENTDB_URL: &str = "https://opentdb.com/api.php?amount=1&difficulty=easy&type=multiple";

#[derive(Clone)]
pub struct TriviaState {
    pub client: reqwest::Client,
    pub cache: Arc<TriviaCache>,
}

pub struct TriviaCache {
    data: RwLock<Option<(TriviaResponse, Instant)>>,
}

impl TriviaCache {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
        }
    }

    async fn get(&self) -> Option<TriviaResponse> {
        let guard = self.data.read().await;
        if let Some((response, created_at)) = guard.as_ref() {
            if created_at.elapsed().as_secs() < CACHE_TTL_SECS {
                return Some(response.clone());
            }
        }
        None
    }

    async fn set(&self, response: TriviaResponse) {
        let mut guard = self.data.write().await;
        *guard = Some((response, Instant::now()));
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TriviaResponse {
    pub question: String,
    pub category: String,
    pub choices: Vec<String>,
    pub correct_index: usize,
}

#[derive(Debug, Deserialize)]
struct OpenTdbResponse {
    results: Vec<OpenTdbQuestion>,
}

#[derive(Debug, Deserialize)]
struct OpenTdbQuestion {
    question: String,
    category: String,
    correct_answer: String,
    incorrect_answers: Vec<String>,
}

fn decode_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&apos;", "'")
        .replace("&oacute;", "ó")
        .replace("&eacute;", "é")
        .replace("&ntilde;", "ñ")
        .replace("&uuml;", "ü")
        .replace("&ouml;", "ö")
        .replace("&auml;", "ä")
        .replace("&iuml;", "ï")
        .replace("&lrm;", "")
        .replace("&shy;", "")
}

pub async fn get_question(
    State(state): State<TriviaState>,
) -> Result<Json<TriviaResponse>, AppError> {
    if let Some(cached) = state.cache.get().await {
        return Ok(Json(cached));
    }

    let resp = state
        .client
        .get(OPENTDB_URL)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("OpenTDB request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "OpenTDB returned status {}",
            resp.status()
        )));
    }

    let data: OpenTdbResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("OpenTDB parse failed: {}", e)))?;

    let q = data
        .results
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Internal("OpenTDB returned no results".to_string()))?;

    let question = decode_html_entities(&q.question);
    let category = decode_html_entities(&q.category);
    let correct = decode_html_entities(&q.correct_answer);
    let mut incorrect: Vec<String> = q
        .incorrect_answers
        .iter()
        .map(|s| decode_html_entities(s))
        .collect();

    // Deterministic placement: insert correct answer at position derived from question length
    let insert_pos = question.len() % (incorrect.len() + 1);
    incorrect.insert(insert_pos, correct);
    let choices = incorrect;
    let correct_index = insert_pos;

    let response = TriviaResponse {
        question,
        category,
        choices,
        correct_index,
    };

    state.cache.set(response.clone()).await;

    Ok(Json(response))
}
