//! Outbound HTTP to AI providers. The API key is read from the OS credential store here
//! and never crosses into the webview. Hosts are fixed per provider; redirects are refused.

use crate::credentials;
use crate::error::AppError;
use reqwest::header::{HeaderName, HeaderValue};
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::Notify;

const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES: usize = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const MAX_TIMEOUT_MS: u64 = 300_000;

pub struct ProviderSpec {
    pub base_url: &'static str,
    auth_header: Option<&'static str>,
    extra_headers: &'static [(&'static str, &'static str)],
}

pub fn provider_spec(provider: &str) -> Option<ProviderSpec> {
    match provider {
        "openai" => Some(ProviderSpec {
            base_url: "https://api.openai.com",
            auth_header: None,
            extra_headers: &[],
        }),
        "anthropic" => Some(ProviderSpec {
            base_url: "https://api.anthropic.com",
            auth_header: Some("x-api-key"),
            extra_headers: &[("anthropic-version", "2023-06-01")],
        }),
        _ => None,
    }
}

pub fn validate_path(path: &str) -> Result<(), AppError> {
    let ok_chars = path.chars().all(|c| {
        c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '-' | '.' | '?' | '=' | '&' | ':')
    });
    if !path.starts_with("/v1/")
        || path.len() > 256
        || path.contains("..")
        || path.contains("//")
        || !ok_chars
    {
        return Err(AppError::Invalid("request path is not allowed".into()));
    }
    Ok(())
}

fn validate_request_id(id: &str) -> Result<(), AppError> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::Invalid("invalid request id".into()));
    }
    Ok(())
}

fn ai_err(kind: &'static str, message: impl Into<String>) -> AppError {
    AppError::Ai {
        kind,
        message: message.into(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    pub provider: String,
    pub method: String,
    pub path: String,
    pub body: Option<String>,
    pub request_id: String,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    pub status: u16,
    pub body: String,
    pub retry_after_seconds: Option<u64>,
}

pub struct AiState {
    client: Client,
    pending: Mutex<HashMap<String, Arc<Notify>>>,
}

impl AiState {
    pub fn new() -> Result<Self, AppError> {
        let client = Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .https_only(true)
            .connect_timeout(Duration::from_secs(15))
            .user_agent(concat!("DesignGrill/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| ai_err("network", format!("cannot initialise HTTP client: {e}")))?;
        Ok(Self {
            client,
            pending: Mutex::new(HashMap::new()),
        })
    }

    pub fn cancel(&self, request_id: &str) {
        if let Ok(map) = self.pending.lock() {
            if let Some(n) = map.get(request_id) {
                n.notify_one();
            }
        }
    }

    pub async fn request(&self, req: AiRequest) -> Result<AiResponse, AppError> {
        validate_request_id(&req.request_id)?;
        let spec = provider_spec(&req.provider)
            .ok_or_else(|| AppError::Invalid(format!("unknown provider '{}'", req.provider)))?;
        validate_path(&req.path)?;
        let method = match req.method.as_str() {
            "GET" => Method::GET,
            "POST" => Method::POST,
            _ => return Err(AppError::Invalid("method not allowed".into())),
        };
        if req.body.as_ref().is_some_and(|b| b.len() > MAX_BODY_BYTES) {
            return Err(AppError::Invalid("request body is too large".into()));
        }
        let key = credentials::get_key(&req.provider)?
            .ok_or_else(|| ai_err("missing-key", "no API key is stored for this provider"))?;

        let notify = Arc::new(Notify::new());
        self.pending
            .lock()
            .map_err(|_| ai_err("unknown", "internal lock poisoned"))?
            .insert(req.request_id.clone(), notify.clone());
        let _guard = PendingGuard {
            state: self,
            id: req.request_id.clone(),
        };

        let timeout = Duration::from_millis(
            req.timeout_ms
                .unwrap_or(DEFAULT_TIMEOUT_MS)
                .clamp(1_000, MAX_TIMEOUT_MS),
        );
        let url = format!("{}{}", spec.base_url, req.path);
        let work = self.execute(&spec, &key, method, &url, req.body);

        tokio::select! {
            res = tokio::time::timeout(timeout, work) => match res {
                Ok(inner) => inner,
                Err(_) => Err(ai_err("timeout", "the provider did not respond in time")),
            },
            _ = notify.notified() => Err(ai_err("cancelled", "the request was cancelled")),
        }
    }

    async fn execute(
        &self,
        spec: &ProviderSpec,
        key: &str,
        method: Method,
        url: &str,
        body: Option<String>,
    ) -> Result<AiResponse, AppError> {
        let mut builder = self
            .client
            .request(method, url)
            .header("accept", "application/json");
        let mut secret = HeaderValue::from_str(&match spec.auth_header {
            None => format!("Bearer {key}"),
            Some(_) => key.to_string(),
        })
        .map_err(|_| {
            ai_err(
                "invalid-credentials",
                "the stored API key contains invalid characters",
            )
        })?;
        secret.set_sensitive(true);
        builder = builder.header(
            HeaderName::from_static(spec.auth_header.unwrap_or("authorization")),
            secret,
        );
        for (name, value) in spec.extra_headers {
            builder = builder.header(*name, *value);
        }
        if let Some(b) = body {
            builder = builder.header("content-type", "application/json").body(b);
        }

        let mut resp = builder.send().await.map_err(map_reqwest)?;
        let status = resp.status().as_u16();
        let retry_after_seconds = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.trim().parse::<u64>().ok());
        let mut buf: Vec<u8> = Vec::new();
        while let Some(chunk) = resp.chunk().await.map_err(map_reqwest)? {
            if buf.len() + chunk.len() > MAX_RESPONSE_BYTES {
                return Err(ai_err(
                    "malformed-response",
                    "the provider response was too large",
                ));
            }
            buf.extend_from_slice(&chunk);
        }
        let body = String::from_utf8_lossy(&buf).replace(key, "[REDACTED]");
        Ok(AiResponse {
            status,
            body,
            retry_after_seconds,
        })
    }
}

struct PendingGuard<'a> {
    state: &'a AiState,
    id: String,
}

impl Drop for PendingGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut map) = self.state.pending.lock() {
            map.remove(&self.id);
        }
    }
}

fn map_reqwest(e: reqwest::Error) -> AppError {
    if e.is_timeout() {
        ai_err("timeout", "the connection to the provider timed out")
    } else if e.is_connect() {
        ai_err(
            "network",
            "could not connect to the provider; check your network connection",
        )
    } else {
        ai_err("network", "the network request to the provider failed")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_providers_have_specs() {
        assert!(provider_spec("openai").is_some());
        assert!(provider_spec("anthropic").is_some());
        assert!(provider_spec("example").is_none());
        assert!(provider_spec("openai")
            .unwrap()
            .base_url
            .starts_with("https://"));
    }

    #[test]
    fn path_validation_blocks_traversal_and_foreign_paths() {
        assert!(validate_path("/v1/chat/completions").is_ok());
        assert!(validate_path("/v1/models?limit=100").is_ok());
        assert!(validate_path("/v2/anything").is_err());
        assert!(validate_path("/v1/../admin").is_err());
        assert!(validate_path("//evil.example/v1/x").is_err());
        assert!(validate_path("/v1/x@evil.example").is_err());
        assert!(validate_path("/v1/x#frag").is_err());
        assert!(validate_path("v1/x").is_err());
    }

    #[test]
    fn request_ids_are_restricted() {
        assert!(validate_request_id("req-123_abc").is_ok());
        assert!(validate_request_id("").is_err());
        assert!(validate_request_id("bad id").is_err());
    }

    #[tokio::test]
    async fn rejects_disallowed_methods_before_touching_the_network() {
        let state = AiState::new().unwrap();
        let res = state
            .request(AiRequest {
                provider: "openai".into(),
                method: "DELETE".into(),
                path: "/v1/models".into(),
                body: None,
                request_id: "r1".into(),
                timeout_ms: None,
            })
            .await;
        assert!(matches!(res, Err(AppError::Invalid(_))));
    }
}
