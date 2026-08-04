use std::collections::BTreeMap;
use std::str::FromStr;

use serde::Deserialize;
use url::Url;

use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct Manifest {
    pub version: u32,
    pub integrations: BTreeMap<String, IntegrationEntry>,
}

#[derive(Debug, Deserialize)]
pub struct IntegrationEntry {
    pub endpoints: BTreeMap<String, Endpoint>,
}

#[derive(Debug, Deserialize)]
pub struct Endpoint {
    /// The allowlist. A request may never influence this value.
    pub base: String,
    pub path: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub query: BTreeMap<String, String>,
    #[serde(default)]
    pub ttl_secs: u64,
}

fn default_method() -> String {
    "GET".to_string()
}

impl FromStr for Manifest {
    type Err = AppError;

    fn from_str(raw: &str) -> Result<Self, Self::Err> {
        let manifest: Manifest = serde_json::from_str(raw)
            .map_err(|e| AppError::Internal(format!("manifest parse failed: {}", e)))?;

        // Validated at load, not at request time: a malformed base is a
        // deployment error, and an integration that could reach an arbitrary
        // scheme (or an empty host) would turn this service into an open
        // proxy on the LAN. A prefix check isn't enough here — "https://" on
        // its own satisfies `starts_with("https://")` while naming no host —
        // so the base is parsed as a real URL and both the scheme and the
        // presence of a host are checked explicitly.
        for (id, entry) in &manifest.integrations {
            for (name, ep) in &entry.endpoints {
                let valid = Url::parse(&ep.base).is_ok_and(|url| {
                    matches!(url.scheme(), "http" | "https") && url.host().is_some()
                });
                if !valid {
                    return Err(AppError::Internal(format!(
                        "manifest: {}.{} base must be an absolute http(s) URL with a host, got {:?}",
                        id, name, ep.base
                    )));
                }
            }
        }
        Ok(manifest)
    }
}

impl Manifest {
    pub fn load(path: &str) -> Result<Self, AppError> {
        let raw = std::fs::read_to_string(path)
            .map_err(|e| AppError::Internal(format!("manifest {} unreadable: {}", path, e)))?;
        Self::from_str(&raw)
    }

    pub fn endpoint(&self, integration: &str, endpoint: &str) -> Option<&Endpoint> {
        self.integrations.get(integration)?.endpoints.get(endpoint)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "version": 1,
      "integrations": {
        "daily-quote": { "endpoints": { "today": {
          "base": "https://zenquotes.io", "path": "/api/today",
          "method": "GET", "query": {}, "ttl_secs": 86400 } } }
      }
    }"#;

    #[test]
    fn resolves_a_declared_endpoint() {
        let m = Manifest::from_str(SAMPLE).expect("parses");
        let ep = m.endpoint("daily-quote", "today").expect("found");
        assert_eq!(ep.base, "https://zenquotes.io");
        assert_eq!(ep.ttl_secs, 86400);
    }

    #[test]
    fn unknown_integration_or_endpoint_is_none() {
        let m = Manifest::from_str(SAMPLE).unwrap();
        assert!(m.endpoint("daily-quote", "nope").is_none());
        assert!(m.endpoint("nope", "today").is_none());
    }

    #[test]
    fn rejects_a_base_that_is_not_absolute_https_or_http() {
        let bad = SAMPLE.replace("https://zenquotes.io", "/etc/passwd");
        assert!(Manifest::from_str(&bad).is_err());
    }

    #[test]
    fn rejects_a_non_http_scheme() {
        let file_scheme = SAMPLE.replace("https://zenquotes.io", "file:///etc/passwd");
        assert!(Manifest::from_str(&file_scheme).is_err());

        let gopher_scheme = SAMPLE.replace("https://zenquotes.io", "gopher://evil.example");
        assert!(Manifest::from_str(&gopher_scheme).is_err());
    }

    #[test]
    fn rejects_an_empty_base() {
        let empty = SAMPLE.replace("https://zenquotes.io", "");
        assert!(Manifest::from_str(&empty).is_err());
    }

    #[test]
    fn rejects_a_hostless_base() {
        // "https://" alone satisfies a naive `starts_with("https://")` check
        // while naming no host at all — the case this module exists to
        // catch, since it's indistinguishable from a typo'd manifest entry
        // that would otherwise resolve to nothing (or, with a differently
        // malformed value, somewhere unintended).
        let hostless = SAMPLE.replace("https://zenquotes.io", "https://");
        assert!(Manifest::from_str(&hostless).is_err());
    }

    #[test]
    fn rejects_a_scheme_relative_base() {
        let scheme_relative = SAMPLE.replace("https://zenquotes.io", "//evil.example.com");
        assert!(Manifest::from_str(&scheme_relative).is_err());
    }

    #[test]
    fn error_message_names_the_integration_and_endpoint() {
        let bad = SAMPLE.replace("https://zenquotes.io", "/etc/passwd");
        let err = Manifest::from_str(&bad).unwrap_err().to_string();
        assert!(
            err.contains("daily-quote"),
            "error should name the integration: {err}"
        );
        assert!(
            err.contains("today"),
            "error should name the endpoint: {err}"
        );
    }
}
