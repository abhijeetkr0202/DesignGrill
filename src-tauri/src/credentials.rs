//! OS credential store access. Keys are written here and read only by `ai_http`;
//! no command returns a stored key to the frontend.

use crate::error::AppError;
use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "DesignGrill";
const MAX_KEY_LEN: usize = 512;

pub fn validate_provider(provider: &str) -> Result<(), AppError> {
    if crate::ai_http::provider_spec(provider).is_some() {
        Ok(())
    } else {
        Err(AppError::Invalid(format!("unknown provider '{provider}'")))
    }
}

fn entry(provider: &str) -> Result<Entry, AppError> {
    validate_provider(provider)?;
    Entry::new(SERVICE, &format!("api-key:{provider}")).map_err(map_err)
}

fn map_err(e: KeyringError) -> AppError {
    AppError::Credential(match e {
        KeyringError::NoDefaultStore => {
            "no credential store is available on this system".to_string()
        }
        KeyringError::NoStorageAccess(_) => "access to the credential store was denied".to_string(),
        other => other.to_string(),
    })
}

pub fn set_key(provider: &str, key: &str) -> Result<(), AppError> {
    let key = key.trim();
    if key.is_empty()
        || key.len() > MAX_KEY_LEN
        || key.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return Err(AppError::Invalid("API key has an invalid format".into()));
    }
    entry(provider)?.set_password(key).map_err(map_err)
}

pub fn get_key(provider: &str) -> Result<Option<String>, AppError> {
    match entry(provider)?.get_password() {
        Ok(k) => Ok(Some(k)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(map_err(e)),
    }
}

pub fn delete_key(provider: &str) -> Result<(), AppError> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(map_err(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_providers_and_malformed_keys() {
        assert!(set_key("evil", "sk-123").is_err());
        assert!(set_key("openai", "").is_err());
        assert!(set_key("openai", "has space inside").is_err());
        assert!(set_key("openai", "line\nbreak").is_err());
        assert!(set_key("openai", &"k".repeat(MAX_KEY_LEN + 1)).is_err());
    }
}
