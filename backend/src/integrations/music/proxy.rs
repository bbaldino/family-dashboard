use crate::error::AppError;
use crate::integrations::config_helpers::IntegrationConfig;
use serde::de::DeserializeOwned;
use sqlx::SqlitePool;

use super::types::MaCommand;

pub struct MaClient {
    base_url: String,
    token: String,
    client: reqwest::Client,
}

impl MaClient {
    pub async fn from_config(pool: &SqlitePool) -> Result<Self, AppError> {
        let config = IntegrationConfig::new(pool, "music");
        let base_url = config.get("service_url").await?;
        let token = config.get("api_token").await?;
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
            client: reqwest::Client::new(),
        })
    }

    pub async fn command<T: DeserializeOwned>(
        &self,
        command: &str,
        args: serde_json::Value,
    ) -> Result<T, AppError> {
        let body = MaCommand {
            message_id: uuid::Uuid::new_v4().to_string(),
            command: command.to_string(),
            args,
        };

        let response = self
            .client
            .post(format!("{}/api", self.base_url))
            .bearer_auth(&self.token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("MA request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response
                .text()
                .await
                .unwrap_or_else(|_| "unknown error".to_string());
            return Err(AppError::Internal(format!(
                "MA returned error {}: {}",
                status, text
            )));
        }

        response
            .json::<T>()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse MA response: {}", e)))
    }

    pub async fn command_void(
        &self,
        command: &str,
        args: serde_json::Value,
    ) -> Result<(), AppError> {
        let body = MaCommand {
            message_id: uuid::Uuid::new_v4().to_string(),
            command: command.to_string(),
            args,
        };

        let response = self
            .client
            .post(format!("{}/api", self.base_url))
            .bearer_auth(&self.token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("MA request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response
                .text()
                .await
                .unwrap_or_else(|_| "unknown error".to_string());
            return Err(AppError::Internal(format!(
                "MA returned error {}: {}",
                status, text
            )));
        }

        Ok(())
    }
}
