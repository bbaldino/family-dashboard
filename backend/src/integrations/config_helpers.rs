use crate::error::AppError;
use sqlx::SqlitePool;

pub struct IntegrationConfig<'a> {
    pool: &'a SqlitePool,
    prefix: &'a str,
}

impl<'a> IntegrationConfig<'a> {
    pub fn new(pool: &'a SqlitePool, prefix: &'a str) -> Self {
        Self { pool, prefix }
    }

    pub async fn get(&self, key: &str) -> Result<String, AppError> {
        let full_key = format!("{}.{}", self.prefix, key);
        sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
            .bind(&full_key)
            .fetch_optional(self.pool)
            .await?
            .ok_or_else(|| {
                AppError::BadRequest(format!(
                    "Config '{}.{}' not set. Configure in admin settings.",
                    self.prefix, key
                ))
            })
    }

    pub async fn get_or(&self, key: &str, default: &str) -> Result<String, AppError> {
        let full_key = format!("{}.{}", self.prefix, key);
        Ok(
            sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
                .bind(&full_key)
                .fetch_optional(self.pool)
                .await?
                .unwrap_or_else(|| default.to_string()),
        )
    }

    pub async fn get_json<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<T, AppError> {
        let value = self.get(key).await?;
        serde_json::from_str(&value).map_err(|e| {
            AppError::Internal(format!(
                "Failed to parse config '{}.{}': {}",
                self.prefix, key, e
            ))
        })
    }

    pub async fn get_json_or<T: serde::de::DeserializeOwned>(
        &self,
        key: &str,
        default: T,
    ) -> Result<T, AppError> {
        let full_key = format!("{}.{}", self.prefix, key);
        match sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
            .bind(&full_key)
            .fetch_optional(self.pool)
            .await?
        {
            Some(value) => serde_json::from_str(&value)
                .map_err(|e| AppError::Internal(format!("Failed to parse config: {}", e))),
            None => Ok(default),
        }
    }
}
