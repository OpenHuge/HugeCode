use serde_json::Value;

use super::oauth_pool::{
    OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY, OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY, OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES,
};
use super::{normalize_openai_compat_base_url, oauth_pool, LOCAL_CODEX_CLI_ACCOUNT_SOURCE};

fn extract_account_metadata_string(metadata: &Value, keys: &[&str]) -> Option<String> {
    let object = metadata.as_object()?;
    keys.iter().find_map(|key| {
        object
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

pub(super) fn extract_oauth_credential_source_from_metadata(metadata: &Value) -> Option<String> {
    extract_account_metadata_string(
        metadata,
        &[
            "credentialSource",
            "credential_source",
            "authSource",
            "auth_source",
        ],
    )
}

pub(super) fn extract_oauth_auth_mode_from_metadata(metadata: &Value) -> Option<String> {
    extract_account_metadata_string(metadata, &["authMode", "auth_mode"])
}

pub(super) fn should_route_oauth_via_chatgpt_codex_backend(
    credential_source: Option<&str>,
    auth_mode: Option<&str>,
) -> bool {
    let uses_access_token = credential_source
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .is_some_and(|source| source.contains("access_token"));
    if uses_access_token {
        return true;
    }

    auth_mode
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .is_some_and(|mode| mode == "chatgpt")
}

pub(super) fn extract_openai_compat_base_url_from_metadata(metadata: &Value) -> Option<String> {
    let object = metadata.as_object()?;
    OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES
        .iter()
        .find_map(|key| {
            object
                .get(*key)
                .and_then(Value::as_str)
                .and_then(normalize_openai_compat_base_url)
        })
}

pub(super) fn redact_oauth_account_metadata(metadata: &Value) -> Value {
    let mut object = metadata.as_object().cloned().unwrap_or_default();
    let has_plaintext_api_key = OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES.iter().any(|key| {
        object
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|entry| !entry.is_empty())
    });
    let has_encrypted_api_key = object
        .get(OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY)
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|entry| !entry.is_empty());
    let has_plaintext_refresh_token =
        OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES
            .iter()
            .any(|key| {
                object
                    .get(*key)
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .is_some_and(|entry| !entry.is_empty())
            });
    let has_encrypted_refresh_token = object
        .get(OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY)
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|entry| !entry.is_empty());
    let local_cli_credential_available = object
        .get("credentialAvailable")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        && object
            .get("localCliManaged")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        && object
            .get("source")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|source| source == LOCAL_CODEX_CLI_ACCOUNT_SOURCE);
    let has_api_key =
        has_plaintext_api_key || has_encrypted_api_key || local_cli_credential_available;
    let compat_base_url = OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES
        .iter()
        .find_map(|key| {
            object
                .get(*key)
                .and_then(Value::as_str)
                .and_then(normalize_openai_compat_base_url)
        });

    for key in OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES {
        object.remove(*key);
    }
    object.remove(OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY);
    for key in OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES {
        object.remove(*key);
    }
    object.remove(OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY);
    for key in OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES {
        object.remove(*key);
    }

    if has_api_key {
        object.insert("apiKeyConfigured".to_string(), Value::Bool(true));
    }
    if has_plaintext_refresh_token || has_encrypted_refresh_token {
        object.insert("refreshTokenAvailable".to_string(), Value::Bool(true));
    }
    if let Some(base_url) = compat_base_url {
        object.insert("compatBaseUrl".to_string(), Value::String(base_url));
    }

    Value::Object(object)
}

pub(super) fn redact_oauth_account_summary(
    mut account: oauth_pool::OAuthAccountSummary,
) -> oauth_pool::OAuthAccountSummary {
    account.metadata = redact_oauth_account_metadata(&account.metadata);
    account
}
