use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fmt::Write as _;

use super::{LocalCodexCliAuthProfile, OAuthAccountUpsertInput, OAuthPoolStore};

const CODEX_AUTH_JSON_IMPORT_ACCOUNT_ID_PREFIX: &str = "codex-auth-json:";
pub(super) const CODEX_AUTH_JSON_IMPORT_ACCOUNT_SOURCE: &str = "codex_auth_json_import";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeCodexAuthJsonCompatibleFormat {
    pub(super) format_id: String,
    pub(super) file_name: String,
    pub(super) content_type: String,
    pub(super) content: String,
    pub(super) notes: Vec<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeCodexAuthJsonImportResponse {
    pub(super) account_id: Option<String>,
    pub(super) display_name: Option<String>,
    pub(super) email: Option<String>,
    pub(super) imported: bool,
    pub(super) updated: bool,
    pub(super) source_label: Option<String>,
    pub(super) formats: Vec<RuntimeCodexAuthJsonCompatibleFormat>,
    pub(super) message: Option<String>,
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

fn short_sha256_hex(input: &str) -> String {
    let digest = Sha256::digest(input.as_bytes());
    let mut output = String::with_capacity(24);
    for byte in digest.iter().take(12) {
        let _ = write!(&mut output, "{byte:02x}");
    }
    output
}

fn resolve_runtime_account_id_from_auth_json_profile(profile: &LocalCodexCliAuthProfile) -> String {
    let seed = [
        profile.external_account_id.as_deref(),
        profile.email.as_deref(),
        profile.api_credential_source.as_deref(),
        profile.api_credential.as_deref(),
        profile.refresh_token.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .filter(|entry| !entry.is_empty())
    .collect::<Vec<_>>()
    .join("|");
    format!(
        "{CODEX_AUTH_JSON_IMPORT_ACCOUNT_ID_PREFIX}{}",
        short_sha256_hex(seed.as_str())
    )
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn build_codex_auth_json_compatible_formats(
    profile: &LocalCodexCliAuthProfile,
    account_id: &str,
) -> Result<Vec<RuntimeCodexAuthJsonCompatibleFormat>, String> {
    let display_name = profile
        .email
        .as_deref()
        .or(profile.external_account_id.as_deref())
        .unwrap_or(account_id);
    let normalized_codex_auth = json!({
        "auth_mode": profile.auth_mode,
        "OPENAI_API_KEY": profile.openai_api_key,
        "last_refresh": profile.last_refresh,
        "tokens": {
            "id_token": profile.id_token,
            "access_token": profile.access_token,
            "refresh_token": profile.refresh_token,
            "account_id": profile.external_account_id,
        }
    });
    let cpa_payload = json!({
        "type": "openai",
        "provider": "codex",
        "name": display_name,
        "account_id": account_id,
        "external_account_id": profile.external_account_id,
        "email": profile.email,
        "auth_mode": profile.auth_mode,
        "credential_type": profile.api_credential_source,
        "api_key": profile.api_credential,
        "access_token": profile.access_token,
        "refresh_token": profile.refresh_token,
        "id_token": profile.id_token,
        "plan": profile.plan_type,
        "default_chatgpt_workspace_id": profile.default_chatgpt_workspace_id,
        "chatgpt_workspaces": profile.chatgpt_workspaces,
    });
    let sub2api_payload = json!({
        "provider": "openai",
        "adapter": "codex",
        "name": display_name,
        "base_url": "https://api.openai.com/v1",
        "api_key": profile.api_credential,
        "credential_source": profile.api_credential_source,
        "access_token": profile.access_token,
        "refresh_token": profile.refresh_token,
        "id_token": profile.id_token,
        "account_id": profile.external_account_id,
        "metadata": {
            "runtime_account_id": account_id,
            "email": profile.email,
            "auth_mode": profile.auth_mode,
            "plan": profile.plan_type,
            "default_chatgpt_workspace_id": profile.default_chatgpt_workspace_id,
        }
    });
    let new_api_payload = json!({
        "type": "codex",
        "provider": "openai",
        "name": display_name,
        "base_url": "https://api.openai.com/v1",
        "key": profile.api_credential,
        "api_key": profile.api_credential,
        "access_token": profile.access_token,
        "refresh_token": profile.refresh_token,
        "id_token": profile.id_token,
        "account_id": profile.external_account_id,
        "email": profile.email,
        "metadata": {
            "runtime_account_id": account_id,
            "credential_source": profile.api_credential_source,
            "auth_mode": profile.auth_mode,
            "plan": profile.plan_type,
            "default_chatgpt_workspace_id": profile.default_chatgpt_workspace_id,
            "chatgpt_workspaces": profile.chatgpt_workspaces,
        }
    });
    let mut env_lines = Vec::new();
    if let Some(api_key) = profile.api_credential.as_deref() {
        env_lines.push(format!("OPENAI_API_KEY={}", shell_single_quote(api_key)));
    }
    if let Some(access_token) = profile.access_token.as_deref() {
        env_lines.push(format!(
            "CODEX_ACCESS_TOKEN={}",
            shell_single_quote(access_token)
        ));
    }
    if let Some(refresh_token) = profile.refresh_token.as_deref() {
        env_lines.push(format!(
            "CODEX_REFRESH_TOKEN={}",
            shell_single_quote(refresh_token)
        ));
    }
    if let Some(id_token) = profile.id_token.as_deref() {
        env_lines.push(format!("CODEX_ID_TOKEN={}", shell_single_quote(id_token)));
    }
    if let Some(account_id_value) = profile.external_account_id.as_deref() {
        env_lines.push(format!(
            "CODEX_ACCOUNT_ID={}",
            shell_single_quote(account_id_value)
        ));
    }

    Ok(vec![
        RuntimeCodexAuthJsonCompatibleFormat {
            format_id: "codex-auth-json".to_string(),
            file_name: "auth.codex.json".to_string(),
            content_type: "application/json".to_string(),
            content: serde_json::to_string_pretty(&normalized_codex_auth)
                .map_err(|error| format!("serialize normalized codex auth json: {error}"))?,
            notes: vec!["Codex CLI auth.json-compatible token bundle.".to_string()],
        },
        RuntimeCodexAuthJsonCompatibleFormat {
            format_id: "cpa".to_string(),
            file_name: "codex.cpa.json".to_string(),
            content_type: "application/json".to_string(),
            content: serde_json::to_string_pretty(&cpa_payload)
                .map_err(|error| format!("serialize CPA-compatible auth json: {error}"))?,
            notes: vec!["CPA-compatible OpenAI provider token bundle.".to_string()],
        },
        RuntimeCodexAuthJsonCompatibleFormat {
            format_id: "sub2api".to_string(),
            file_name: "codex.sub2api.json".to_string(),
            content_type: "application/json".to_string(),
            content: serde_json::to_string_pretty(&sub2api_payload)
                .map_err(|error| format!("serialize Sub2API-compatible auth json: {error}"))?,
            notes: vec!["Sub2API-compatible OpenAI adapter token bundle.".to_string()],
        },
        RuntimeCodexAuthJsonCompatibleFormat {
            format_id: "new-api".to_string(),
            file_name: "codex.new-api.json".to_string(),
            content_type: "application/json".to_string(),
            content: serde_json::to_string_pretty(&new_api_payload)
                .map_err(|error| format!("serialize new-api-compatible auth json: {error}"))?,
            notes: vec!["new-api-compatible OpenAI/Codex channel token bundle.".to_string()],
        },
        RuntimeCodexAuthJsonCompatibleFormat {
            format_id: "openai-compatible-env".to_string(),
            file_name: "codex-openai.env".to_string(),
            content_type: "text/x-shellscript".to_string(),
            content: env_lines.join("\n"),
            notes: vec!["Shell env bundle for OpenAI-compatible clients.".to_string()],
        },
    ])
}

pub(super) fn import_codex_auth_json_content(
    oauth_pool: &OAuthPoolStore,
    auth_json: &str,
    source_label: Option<&str>,
) -> Result<RuntimeCodexAuthJsonImportResponse, String> {
    let trimmed = auth_json.trim();
    if trimmed.is_empty() {
        return Err("Codex auth.json content is empty.".to_string());
    }
    let payload: Value = serde_json::from_str(trimmed)
        .map_err(|error| format!("parse Codex auth.json content: {error}"))?;
    let profile =
        super::local_codex_cli_sessions::parse_local_codex_cli_auth_profile_from_value(&payload)
            .ok_or_else(|| {
                "Codex auth.json did not contain a usable account or token.".to_string()
            })?;
    let api_credential_available = profile
        .api_credential
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let refresh_token_available = profile
        .refresh_token
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    if !api_credential_available && !refresh_token_available {
        return Err(
            "Codex auth.json does not contain an API credential or refresh token.".to_string(),
        );
    }
    let oauth_secret_key_configured = oauth_pool
        .diagnostics()
        .map(|entry| entry.oauth_secret_key_configured)
        .unwrap_or(false);
    if !oauth_secret_key_configured {
        return Err(
            "CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is required to import Codex auth.json content."
                .to_string(),
        );
    }

    let account_id = resolve_runtime_account_id_from_auth_json_profile(&profile);
    let was_existing = oauth_pool
        .list_accounts(Some("codex"))
        .map_err(|error| format!("list existing codex oauth accounts: {error}"))?
        .into_iter()
        .any(|entry| entry.account_id == account_id);
    let source_label = normalize_optional_text(source_label);
    let formats = build_codex_auth_json_compatible_formats(&profile, account_id.as_str())?;

    let chatgpt_workspaces = profile.chatgpt_workspaces.clone();
    let default_chatgpt_workspace_id = profile.default_chatgpt_workspace_id.clone();
    let external_account_id = profile.external_account_id.clone();
    let email = profile.email.clone();
    let display_name = profile
        .email
        .clone()
        .or_else(|| profile.external_account_id.clone())
        .or_else(|| Some(account_id.clone()));
    let mut metadata = serde_json::Map::new();
    metadata.insert(
        "source".to_string(),
        Value::String(CODEX_AUTH_JSON_IMPORT_ACCOUNT_SOURCE.to_string()),
    );
    metadata.insert("authJsonImported".to_string(), Value::Bool(true));
    metadata.insert("credentialAvailable".to_string(), Value::Bool(true));
    if let Some(label) = source_label.as_deref() {
        metadata.insert("sourceLabel".to_string(), Value::String(label.to_string()));
    }
    if let Some(auth_mode) = profile.auth_mode.as_deref() {
        metadata.insert("authMode".to_string(), Value::String(auth_mode.to_string()));
    }
    if let Some(plan_type) = profile.plan_type.as_deref() {
        metadata.insert("planType".to_string(), Value::String(plan_type.to_string()));
    }
    if let Some(last_refresh) = profile.last_refresh.as_deref() {
        metadata.insert(
            "lastRefresh".to_string(),
            Value::String(last_refresh.to_string()),
        );
    }
    if let Some(credential_source) = profile.api_credential_source.as_deref() {
        metadata.insert(
            "credentialSource".to_string(),
            Value::String(credential_source.to_string()),
        );
    }
    if let Some(api_credential) = profile.api_credential.as_deref() {
        metadata.insert(
            "apiKey".to_string(),
            Value::String(api_credential.to_string()),
        );
    }
    if let Some(refresh_token) = profile.refresh_token.as_deref() {
        metadata.insert(
            "refreshToken".to_string(),
            Value::String(refresh_token.to_string()),
        );
    }
    if let Some(email_value) = email.as_deref() {
        metadata.insert("email".to_string(), Value::String(email_value.to_string()));
    }
    if let Some(default_workspace_id) = default_chatgpt_workspace_id.as_deref() {
        metadata.insert(
            "defaultChatgptWorkspaceId".to_string(),
            Value::String(default_workspace_id.to_string()),
        );
    }
    if let Some(workspaces) = chatgpt_workspaces.as_ref() {
        metadata.insert(
            "chatgptWorkspaces".to_string(),
            serde_json::to_value(workspaces).unwrap_or_else(|_| Value::Array(Vec::new())),
        );
    }

    oauth_pool
        .upsert_account(OAuthAccountUpsertInput {
            account_id: account_id.clone(),
            provider: "codex".to_string(),
            external_account_id,
            email: email.clone(),
            display_name: display_name.clone(),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(Value::Object(metadata)),
        })
        .map_err(|error| format!("import Codex auth.json account: {}", error.message()))?;

    Ok(RuntimeCodexAuthJsonImportResponse {
        account_id: Some(account_id),
        display_name,
        email,
        imported: !was_existing,
        updated: was_existing,
        source_label,
        formats,
        message: Some(if was_existing {
            "Updated Codex account from auth.json.".to_string()
        } else {
            "Imported Codex account from auth.json.".to_string()
        }),
    })
}

#[cfg(test)]
mod tests {
    use super::{import_codex_auth_json_content, CODEX_AUTH_JSON_IMPORT_ACCOUNT_SOURCE};
    use crate::OAuthPoolStore;
    use serde_json::json;

    const TEST_SECRET_KEY_B64: &str = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

    #[test]
    fn import_codex_auth_json_content_imports_pasted_tokens_and_returns_formats() {
        let store = OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64))
            .expect("open oauth pool store with secret key");
        let auth_json = json!({
            "auth_mode": "chatgpt",
            "last_refresh": "2026-04-01T12:00:00Z",
            "tokens": {
                "access_token": "access-token-from-auth-json",
                "refresh_token": "refresh-token-from-auth-json",
                "account_id": "acct-auth-json"
            }
        })
        .to_string();

        let response = import_codex_auth_json_content(&store, auth_json.as_str(), Some("pasted"))
            .expect("import codex auth json");

        let account_id = response.account_id.as_deref().expect("account id");
        assert!(account_id.starts_with("codex-auth-json:"));
        assert!(response.imported);
        assert!(!response.updated);
        assert_eq!(response.source_label.as_deref(), Some("pasted"));
        assert!(response
            .formats
            .iter()
            .any(|entry| entry.format_id == "cpa" && entry.content.contains("access-token")));
        assert!(response
            .formats
            .iter()
            .any(|entry| entry.format_id == "sub2api"));
        assert!(response
            .formats
            .iter()
            .any(|entry| entry.format_id == "new-api"));

        let imported = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == account_id)
            .expect("imported auth json account");
        assert_eq!(
            imported.external_account_id.as_deref(),
            Some("acct-auth-json")
        );
        assert_eq!(
            imported
                .metadata
                .get("source")
                .and_then(serde_json::Value::as_str),
            Some(CODEX_AUTH_JSON_IMPORT_ACCOUNT_SOURCE)
        );
        assert_eq!(
            imported
                .metadata
                .get("credentialSource")
                .and_then(serde_json::Value::as_str),
            Some("access_token")
        );
    }

    #[test]
    fn import_codex_auth_json_content_requires_secret_key_for_token_storage() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let auth_json = json!({
            "auth_mode": "chatgpt",
            "tokens": {
                "access_token": "access-token-from-auth-json",
                "account_id": "acct-auth-json"
            }
        })
        .to_string();

        let error = import_codex_auth_json_content(&store, auth_json.as_str(), Some("pasted"))
            .expect_err("missing secret key should fail");

        assert!(error.contains("CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY"));
    }
}
