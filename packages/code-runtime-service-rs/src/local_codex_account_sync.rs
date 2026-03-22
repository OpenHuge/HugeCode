use base64::{
    engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD},
    Engine as _,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use super::{
    LocalCodexCliAuthProfile, OAuthAccountUpsertInput, OAuthPoolStore, LOCAL_CODEX_CLI_ACCOUNT_ID,
    LOCAL_CODEX_CLI_ACCOUNT_SOURCE, LOCAL_CODEX_CLI_DISABLED_REASON_CREDENTIAL_MISSING,
    LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING,
};

#[derive(Debug, Deserialize)]
struct CockpitToolsCodexAccountIndex {
    #[serde(default)]
    accounts: Vec<CockpitToolsCodexAccountIndexEntry>,
}

#[derive(Debug, Deserialize)]
struct CockpitToolsCodexAccountIndexEntry {
    id: String,
}

#[derive(Debug, Deserialize)]
struct CockpitToolsCodexAccountRecord {
    id: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    user_id: Option<String>,
    #[serde(default)]
    plan_type: Option<String>,
    #[serde(default)]
    account_id: Option<String>,
    #[serde(default)]
    organization_id: Option<String>,
    #[serde(default)]
    account_name: Option<String>,
    #[serde(default)]
    account_structure: Option<String>,
    tokens: CockpitToolsCodexTokens,
}

#[derive(Debug, Deserialize)]
struct CockpitToolsCodexTokens {
    #[serde(default)]
    id_token: Option<String>,
    #[serde(default)]
    access_token: Option<String>,
    #[serde(default)]
    refresh_token: Option<String>,
}

pub(super) fn resolve_local_codex_cli_profile_for_account(
    account: &super::oauth_pool::OAuthAccountSummary,
) -> Option<LocalCodexCliAuthProfile> {
    if !is_local_codex_cli_managed_account(account) {
        return None;
    }
    super::local_codex_cli_sessions::load_local_codex_cli_auth_profile()
}

pub(super) fn resolve_local_codex_cli_api_credential_from_profile(
    account: &super::oauth_pool::OAuthAccountSummary,
    local_codex_cli_profile: Option<&LocalCodexCliAuthProfile>,
) -> Option<String> {
    if !is_local_codex_cli_managed_account(account) {
        return None;
    }

    local_codex_cli_profile
        .and_then(|profile| profile.api_credential.as_deref())
        .map(str::trim)
        .filter(|credential| !credential.is_empty())
        .map(str::to_string)
}

pub(super) fn resolve_local_codex_cli_fallback_api_credential_from_profile(
    account: &super::oauth_pool::OAuthAccountSummary,
    local_codex_cli_profile: Option<&LocalCodexCliAuthProfile>,
    primary_credential: &str,
) -> Option<String> {
    if !is_local_codex_cli_managed_account(account) {
        return None;
    }
    let profile = local_codex_cli_profile?;
    let primary = primary_credential.trim();
    if primary.is_empty() {
        return None;
    }

    [
        profile.openai_api_key.as_deref(),
        profile.access_token.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|candidate| !candidate.is_empty() && *candidate != primary)
    .map(str::to_string)
}

pub(super) fn resolve_local_codex_cli_refresh_token_from_profile(
    account: &super::oauth_pool::OAuthAccountSummary,
    local_codex_cli_profile: Option<&LocalCodexCliAuthProfile>,
) -> Option<String> {
    if !is_local_codex_cli_managed_account(account) {
        return None;
    }
    local_codex_cli_profile
        .and_then(|profile| profile.refresh_token.as_deref())
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(str::to_string)
}

pub(super) fn resolve_local_codex_cli_id_token_from_profile(
    account: &super::oauth_pool::OAuthAccountSummary,
    local_codex_cli_profile: Option<&LocalCodexCliAuthProfile>,
) -> Option<String> {
    if !is_local_codex_cli_managed_account(account) {
        return None;
    }
    local_codex_cli_profile
        .and_then(|profile| profile.id_token.as_deref())
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(str::to_string)
}

pub(super) fn resolve_oauth_api_key_for_account(
    oauth_pool: &OAuthPoolStore,
    account: &super::oauth_pool::OAuthAccountSummary,
    local_codex_cli_profile: Option<&LocalCodexCliAuthProfile>,
) -> Result<Option<String>, String> {
    match oauth_pool.resolve_api_key_from_metadata(&account.metadata) {
        Ok(Some(api_key)) => Ok(Some(api_key)),
        Ok(None) => Ok(resolve_local_codex_cli_api_credential_from_profile(
            account,
            local_codex_cli_profile,
        )),
        Err(error) => {
            if let Some(api_key) = resolve_local_codex_cli_api_credential_from_profile(
                account,
                local_codex_cli_profile,
            ) {
                return Ok(Some(api_key));
            }
            Err(error)
        }
    }
}

pub(super) fn classify_oauth_api_key_resolution_error(error: &str) -> &'static str {
    let normalized = error.trim().to_ascii_lowercase();
    if normalized.contains("decrypt")
        || normalized.contains("encrypted oauth")
        || normalized.contains("oauth_secret_key")
    {
        "decrypt_failed"
    } else {
        "auth_missing"
    }
}

const COCKPIT_TOOLS_STORAGE_PATH_ENV: &str = "CODE_RUNTIME_COCKPIT_TOOLS_STORAGE_PATH";
const COCKPIT_TOOLS_APP_DIR: &str = "com.antigravity.cockpit-tools";
const COCKPIT_TOOLS_CODEX_ACCOUNT_ID_PREFIX: &str = "cockpit-tools:";
pub(super) const COCKPIT_TOOLS_CODEX_ACCOUNT_SOURCE: &str = "cockpit_tools_codex_import";

#[derive(Clone, Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeCockpitToolsCodexImportResponse {
    pub(super) scanned: u64,
    pub(super) imported: u64,
    pub(super) updated: u64,
    pub(super) skipped: u64,
    pub(super) failed: u64,
    pub(super) source_path: Option<String>,
    pub(super) message: Option<String>,
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

fn decode_jwt_base64_segment(segment: &str) -> Option<Vec<u8>> {
    let trimmed = segment.trim();
    if trimmed.is_empty() {
        return None;
    }
    URL_SAFE_NO_PAD.decode(trimmed).ok().or_else(|| {
        let mut padded = trimmed.to_string();
        let pad_len = (4 - (padded.len() % 4)) % 4;
        padded.extend(std::iter::repeat('=').take(pad_len));
        URL_SAFE.decode(padded.as_bytes()).ok()
    })
}

fn decode_jwt_payload_without_verification(token: &str) -> Option<Value> {
    let payload_segment = token.split('.').nth(1)?;
    let decoded = decode_jwt_base64_segment(payload_segment)?;
    serde_json::from_slice(decoded.as_slice()).ok()
}

fn parse_chatgpt_workspace_from_claim(
    value: &Value,
) -> Option<super::oauth_pool::OAuthAccountChatgptWorkspace> {
    let object = value.as_object()?;
    let workspace_id = normalize_optional_text(
        object
            .get("workspace_id")
            .or_else(|| object.get("workspaceId"))
            .or_else(|| object.get("organization_id"))
            .or_else(|| object.get("organizationId"))
            .or_else(|| object.get("id"))
            .and_then(Value::as_str),
    )?;
    let title = normalize_optional_text(
        object
            .get("title")
            .or_else(|| object.get("name"))
            .and_then(Value::as_str),
    );
    let role = normalize_optional_text(object.get("role").and_then(Value::as_str));
    let is_default = object
        .get("is_default")
        .or_else(|| object.get("isDefault"))
        .or_else(|| object.get("default"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    Some(super::oauth_pool::OAuthAccountChatgptWorkspace {
        workspace_id,
        title,
        role,
        is_default,
    })
}

fn parse_chatgpt_workspace_state_from_id_token(
    id_token: Option<&str>,
) -> (
    Option<Vec<super::oauth_pool::OAuthAccountChatgptWorkspace>>,
    Option<String>,
) {
    let Some(token) = id_token.and_then(|entry| normalize_optional_text(Some(entry))) else {
        return (None, None);
    };
    let Some(payload) = decode_jwt_payload_without_verification(token.as_str()) else {
        return (None, None);
    };
    let Some(auth_claims) = payload
        .get("https://api.openai.com/auth")
        .and_then(Value::as_object)
    else {
        return (None, None);
    };

    let mut workspaces = auth_claims
        .get("organizations")
        .or_else(|| auth_claims.get("workspaces"))
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(parse_chatgpt_workspace_from_claim)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let default_workspace_id = normalize_optional_text(
        auth_claims
            .get("default_workspace_id")
            .or_else(|| auth_claims.get("defaultWorkspaceId"))
            .or_else(|| auth_claims.get("default_organization_id"))
            .or_else(|| auth_claims.get("defaultOrganizationId"))
            .and_then(Value::as_str),
    )
    .or_else(|| {
        workspaces
            .iter()
            .find(|workspace| workspace.is_default)
            .map(|workspace| workspace.workspace_id.clone())
    });
    if let Some(default_id) = default_workspace_id.as_deref() {
        for workspace in &mut workspaces {
            if workspace.workspace_id == default_id {
                workspace.is_default = true;
            }
        }
    }

    (
        (!workspaces.is_empty()).then_some(workspaces),
        default_workspace_id,
    )
}

fn resolve_cockpit_tools_storage_path_from_home(home: &Path) -> PathBuf {
    home.join("Library")
        .join("Application Support")
        .join(COCKPIT_TOOLS_APP_DIR)
}

fn read_non_empty_env_path(name: &str) -> Option<PathBuf> {
    let value = std::env::var_os(name)?;
    let trimmed = value.to_string_lossy().trim().to_string();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

fn resolve_cockpit_tools_storage_root() -> Option<PathBuf> {
    if let Some(path) = read_non_empty_env_path(COCKPIT_TOOLS_STORAGE_PATH_ENV) {
        return Some(path);
    }
    if let Some(home) = read_non_empty_env_path("HOME") {
        return Some(resolve_cockpit_tools_storage_path_from_home(home.as_path()));
    }
    if let Some(home) = read_non_empty_env_path("USERPROFILE") {
        return Some(resolve_cockpit_tools_storage_path_from_home(home.as_path()));
    }
    for env_name in ["XDG_DATA_HOME", "LOCALAPPDATA", "APPDATA"] {
        if let Some(path) = read_non_empty_env_path(env_name) {
            return Some(path.join(COCKPIT_TOOLS_APP_DIR));
        }
    }
    None
}

fn resolve_runtime_account_id_from_cockpit_source_id(source_id: &str) -> String {
    let trimmed = source_id.trim();
    if trimmed.starts_with(COCKPIT_TOOLS_CODEX_ACCOUNT_ID_PREFIX) {
        return trimmed.to_string();
    }
    format!("{COCKPIT_TOOLS_CODEX_ACCOUNT_ID_PREFIX}{trimmed}")
}

fn build_cockpit_tools_import_summary_message(
    summary: &RuntimeCockpitToolsCodexImportResponse,
) -> Option<String> {
    Some(format!(
        "Imported {} accounts and updated {} from cockpit-tools.",
        summary.imported, summary.updated
    ))
}

pub(super) fn import_cockpit_tools_codex_accounts(
    oauth_pool: &OAuthPoolStore,
) -> Result<RuntimeCockpitToolsCodexImportResponse, String> {
    let Some(cockpit_root) = resolve_cockpit_tools_storage_root() else {
        return Ok(RuntimeCockpitToolsCodexImportResponse {
            message: Some("Unable to resolve cockpit-tools storage path.".to_string()),
            ..RuntimeCockpitToolsCodexImportResponse::default()
        });
    };
    import_cockpit_tools_codex_accounts_from_path(oauth_pool, cockpit_root.as_path())
}

pub(super) fn import_cockpit_tools_codex_accounts_from_path(
    oauth_pool: &OAuthPoolStore,
    cockpit_root: &Path,
) -> Result<RuntimeCockpitToolsCodexImportResponse, String> {
    let mut summary = RuntimeCockpitToolsCodexImportResponse {
        source_path: Some(cockpit_root.to_string_lossy().to_string()),
        ..RuntimeCockpitToolsCodexImportResponse::default()
    };
    if !cockpit_root.exists() {
        summary.message = Some("cockpit-tools storage directory does not exist.".to_string());
        return Ok(summary);
    }

    let oauth_secret_key_configured = oauth_pool
        .diagnostics()
        .map(|entry| entry.oauth_secret_key_configured)
        .unwrap_or(false);
    if !oauth_secret_key_configured {
        return Err(
            "CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is required to import cockpit-tools Codex accounts."
                .to_string(),
        );
    }

    let index_path = cockpit_root.join("codex_accounts.json");
    if !index_path.is_file() {
        summary.message = Some("cockpit-tools codex account index was not found.".to_string());
        return Ok(summary);
    }

    let index_raw = fs::read_to_string(index_path.as_path()).map_err(|error| {
        format!(
            "read cockpit-tools codex account index {}: {error}",
            index_path.to_string_lossy()
        )
    })?;
    let index: CockpitToolsCodexAccountIndex =
        serde_json::from_str(index_raw.as_str()).map_err(|error| {
            format!(
                "parse cockpit-tools codex account index {}: {error}",
                index_path.to_string_lossy()
            )
        })?;
    summary.scanned = index.accounts.len() as u64;
    if index.accounts.is_empty() {
        summary.message = Some("No cockpit-tools codex accounts found in index.".to_string());
        return Ok(summary);
    }

    let mut existing_runtime_account_ids = oauth_pool
        .list_accounts(Some("codex"))
        .map_err(|error| format!("list existing codex oauth accounts: {error}"))?
        .into_iter()
        .map(|entry| entry.account_id)
        .collect::<HashSet<_>>();
    let details_dir = cockpit_root.join("codex_accounts");
    for index_entry in index.accounts {
        let Some(source_id) = normalize_optional_text(Some(index_entry.id.as_str())) else {
            summary.skipped += 1;
            continue;
        };
        let account_detail_path = details_dir.join(format!("{source_id}.json"));
        let detail_raw = match fs::read_to_string(account_detail_path.as_path()) {
            Ok(content) => content,
            Err(_) => {
                summary.failed += 1;
                continue;
            }
        };
        let detail =
            match serde_json::from_str::<CockpitToolsCodexAccountRecord>(detail_raw.as_str()) {
                Ok(parsed) => parsed,
                Err(_) => {
                    summary.failed += 1;
                    continue;
                }
            };

        let Some(access_token) = normalize_optional_text(detail.tokens.access_token.as_deref())
        else {
            summary.skipped += 1;
            continue;
        };
        let runtime_account_id =
            resolve_runtime_account_id_from_cockpit_source_id(detail.id.as_str());
        let was_existing = existing_runtime_account_ids.contains(runtime_account_id.as_str());
        let external_account_id = normalize_optional_text(detail.account_id.as_deref());
        let email = normalize_optional_text(detail.email.as_deref());
        let display_name = normalize_optional_text(detail.account_name.as_deref())
            .or_else(|| email.clone())
            .or_else(|| external_account_id.clone())
            .or_else(|| Some(runtime_account_id.clone()));
        let (chatgpt_workspaces, default_workspace_from_token) =
            parse_chatgpt_workspace_state_from_id_token(detail.tokens.id_token.as_deref());
        let default_chatgpt_workspace_id = default_workspace_from_token
            .or_else(|| normalize_optional_text(detail.organization_id.as_deref()));
        let mut metadata = serde_json::Map::new();
        metadata.insert(
            "source".to_string(),
            Value::String(COCKPIT_TOOLS_CODEX_ACCOUNT_SOURCE.to_string()),
        );
        metadata.insert("authMode".to_string(), Value::String("chatgpt".to_string()));
        metadata.insert(
            "credentialSource".to_string(),
            Value::String("access_token".to_string()),
        );
        metadata.insert("apiKey".to_string(), Value::String(access_token));
        if let Some(refresh_token) = normalize_optional_text(detail.tokens.refresh_token.as_deref())
        {
            metadata.insert("refreshToken".to_string(), Value::String(refresh_token));
        }
        if let Some(plan_type) = normalize_optional_text(detail.plan_type.as_deref()) {
            metadata.insert("planType".to_string(), Value::String(plan_type));
        }
        if let Some(user_id) = normalize_optional_text(detail.user_id.as_deref()) {
            metadata.insert("userId".to_string(), Value::String(user_id));
        }
        if let Some(account_name) = normalize_optional_text(detail.account_name.as_deref()) {
            metadata.insert("accountName".to_string(), Value::String(account_name));
        }
        if let Some(account_structure) =
            normalize_optional_text(detail.account_structure.as_deref())
        {
            metadata.insert(
                "accountStructure".to_string(),
                Value::String(account_structure),
            );
        }
        if let Some(email) = email.as_deref() {
            metadata.insert("email".to_string(), Value::String(email.to_string()));
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
        let upserted = oauth_pool.upsert_account(OAuthAccountUpsertInput {
            account_id: runtime_account_id.clone(),
            provider: "codex".to_string(),
            external_account_id,
            email,
            display_name,
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(Value::Object(metadata)),
        });
        match upserted {
            Ok(_) => {
                if was_existing {
                    summary.updated += 1;
                } else {
                    summary.imported += 1;
                    existing_runtime_account_ids.insert(runtime_account_id);
                }
            }
            Err(_) => {
                summary.failed += 1;
            }
        }
    }

    summary.message = build_cockpit_tools_import_summary_message(&summary);
    Ok(summary)
}

#[cfg(test)]
pub(super) fn sync_local_codex_cli_account(_oauth_pool: &OAuthPoolStore) -> Result<(), String> {
    Ok(())
}

#[cfg(not(test))]
pub(super) fn sync_local_codex_cli_account(oauth_pool: &OAuthPoolStore) -> Result<(), String> {
    match super::local_codex_cli_sessions::load_local_codex_cli_auth_profile() {
        Some(profile) => sync_local_codex_cli_account_from_profile(oauth_pool, profile),
        None => sync_local_codex_cli_account_without_profile(oauth_pool),
    }
}

pub(super) fn sync_local_codex_cli_account_without_profile(
    oauth_pool: &OAuthPoolStore,
) -> Result<(), String> {
    let existing_account = oauth_pool
        .list_accounts(Some("codex"))?
        .into_iter()
        .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID);
    let Some(existing_account) = existing_account else {
        return Ok(());
    };

    let existing_has_usable_credential = oauth_pool
        .resolve_api_key_from_metadata(&existing_account.metadata)
        .ok()
        .flatten()
        .is_some();
    if existing_has_usable_credential {
        return Ok(());
    }

    let existing_reason = existing_account.disabled_reason.as_deref();
    let preserve_disabled_reason = existing_account.status.eq_ignore_ascii_case("disabled")
        && !is_local_codex_cli_disabled_reason(existing_reason);
    let mut metadata = serde_json::Map::new();
    metadata.insert(
        "source".to_string(),
        Value::String(LOCAL_CODEX_CLI_ACCOUNT_SOURCE.to_string()),
    );
    metadata.insert("localCliManaged".to_string(), Value::Bool(true));
    metadata.insert("credentialAvailable".to_string(), Value::Bool(false));
    metadata.insert("credentialSource".to_string(), Value::Null);

    oauth_pool
        .upsert_account(OAuthAccountUpsertInput {
            account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
            provider: "codex".to_string(),
            external_account_id: existing_account.external_account_id,
            email: existing_account.email,
            display_name: existing_account
                .display_name
                .or_else(|| Some("Local Codex CLI".to_string())),
            status: Some("disabled".to_string()),
            disabled_reason: if preserve_disabled_reason {
                existing_account.disabled_reason
            } else {
                Some(LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING.to_string())
            },
            metadata: Some(Value::Object(metadata)),
        })
        .map(|_| ())
        .map_err(|error| format!("sync local codex cli auth account: {}", error.message()))
}

pub(super) fn sync_local_codex_cli_account_from_profile(
    oauth_pool: &OAuthPoolStore,
    profile: LocalCodexCliAuthProfile,
) -> Result<(), String> {
    let existing_account = oauth_pool
        .list_accounts(Some("codex"))?
        .into_iter()
        .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID);
    let oauth_secret_key_configured = oauth_pool
        .diagnostics()
        .map(|entry| entry.oauth_secret_key_configured)
        .unwrap_or(false);
    let existing_has_usable_credential = existing_account
        .as_ref()
        .and_then(|entry| {
            oauth_pool
                .resolve_api_key_from_metadata(&entry.metadata)
                .ok()
                .flatten()
        })
        .is_some();

    let mut metadata = serde_json::Map::new();
    metadata.insert(
        "source".to_string(),
        Value::String(LOCAL_CODEX_CLI_ACCOUNT_SOURCE.to_string()),
    );
    metadata.insert("localCliManaged".to_string(), Value::Bool(true));
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
    if let Some(email) = profile.email.as_deref() {
        metadata.insert("email".to_string(), Value::String(email.to_string()));
    }
    let chatgpt_workspaces = profile.chatgpt_workspaces.or_else(|| {
        existing_account
            .as_ref()
            .and_then(|entry| entry.chatgpt_workspaces.clone())
    });
    let default_chatgpt_workspace_id = profile.default_chatgpt_workspace_id.or_else(|| {
        existing_account
            .as_ref()
            .and_then(|entry| entry.default_chatgpt_workspace_id.clone())
    });
    if let Some(workspaces) = chatgpt_workspaces.as_ref() {
        metadata.insert(
            "chatgptWorkspaces".to_string(),
            serde_json::to_value(workspaces).unwrap_or_else(|_| Value::Array(Vec::new())),
        );
    }
    if let Some(default_workspace_id) = default_chatgpt_workspace_id.as_deref() {
        metadata.insert(
            "defaultChatgptWorkspaceId".to_string(),
            Value::String(default_workspace_id.to_string()),
        );
    }
    let profile_credential_available = profile
        .api_credential
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let credential_available = profile_credential_available || existing_has_usable_credential;
    metadata.insert(
        "credentialAvailable".to_string(),
        Value::Bool(credential_available),
    );
    if let Some(source) = profile.api_credential_source.as_deref() {
        metadata.insert(
            "credentialSource".to_string(),
            Value::String(source.to_string()),
        );
    }
    if oauth_secret_key_configured {
        if let Some(api_credential) = profile.api_credential.as_deref() {
            metadata.insert(
                "apiKey".to_string(),
                Value::String(api_credential.to_string()),
            );
        }
    }

    let existing_status = existing_account
        .as_ref()
        .map(|entry| entry.status.as_str())
        .unwrap_or("enabled");
    let existing_disabled_reason = existing_account
        .as_ref()
        .and_then(|entry| entry.disabled_reason.as_deref());
    let existing_is_local_auto_disabled = existing_status == "disabled"
        && is_local_codex_cli_disabled_reason(existing_disabled_reason);
    let status = if credential_available {
        if existing_is_local_auto_disabled {
            "enabled".to_string()
        } else {
            existing_status.to_string()
        }
    } else if existing_status == "disabled" && !existing_is_local_auto_disabled {
        "disabled".to_string()
    } else {
        "disabled".to_string()
    };
    let disabled_reason = if status == "enabled" {
        None
    } else if credential_available {
        existing_account
            .as_ref()
            .and_then(|entry| entry.disabled_reason.clone())
    } else if existing_status == "disabled" && !existing_is_local_auto_disabled {
        existing_account
            .as_ref()
            .and_then(|entry| entry.disabled_reason.clone())
    } else {
        Some(LOCAL_CODEX_CLI_DISABLED_REASON_CREDENTIAL_MISSING.to_string())
    };
    let external_account_id = profile.external_account_id.or_else(|| {
        existing_account
            .as_ref()
            .and_then(|entry| entry.external_account_id.clone())
    });
    let email = profile.email.or_else(|| {
        existing_account
            .as_ref()
            .and_then(|entry| entry.email.clone())
    });
    let display_name = email
        .clone()
        .or_else(|| {
            existing_account
                .as_ref()
                .and_then(|entry| entry.display_name.clone())
        })
        .or_else(|| Some("Local Codex CLI".to_string()));

    oauth_pool
        .upsert_account(OAuthAccountUpsertInput {
            account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
            provider: "codex".to_string(),
            external_account_id,
            email,
            display_name,
            status: Some(status),
            disabled_reason,
            metadata: Some(Value::Object(metadata)),
        })
        .map(|_| ())
        .map_err(|error| format!("sync local codex cli auth account: {}", error.message()))
}

fn is_local_codex_cli_disabled_reason(reason: Option<&str>) -> bool {
    matches!(
        reason,
        Some(LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING)
            | Some(LOCAL_CODEX_CLI_DISABLED_REASON_CREDENTIAL_MISSING)
    )
}

pub(super) fn is_local_codex_cli_managed_account(
    account: &super::oauth_pool::OAuthAccountSummary,
) -> bool {
    if account.account_id != LOCAL_CODEX_CLI_ACCOUNT_ID {
        return false;
    }

    if !account.provider.eq_ignore_ascii_case("codex") {
        return false;
    }

    let Some(object) = account.metadata.as_object() else {
        return false;
    };
    let local_cli_managed = object
        .get("localCliManaged")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let source_matches = object
        .get("source")
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|source| source.eq_ignore_ascii_case(LOCAL_CODEX_CLI_ACCOUNT_SOURCE));

    local_cli_managed && source_matches
}

#[cfg(test)]
mod tests {
    use super::{
        import_cockpit_tools_codex_accounts_from_path, is_local_codex_cli_managed_account,
        sync_local_codex_cli_account_from_profile, LocalCodexCliAuthProfile,
        COCKPIT_TOOLS_CODEX_ACCOUNT_SOURCE,
    };
    use crate::{
        oauth_pool::{OAuthAccountChatgptWorkspace, OAuthAccountSummary},
        OAuthPoolStore, LOCAL_CODEX_CLI_ACCOUNT_ID, LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
        SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
    };
    use serde_json::json;
    use std::{env, fs, path::PathBuf};
    use uuid::Uuid;

    const TEST_SECRET_KEY_B64: &str = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

    struct TempDir {
        path: PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let path = env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
            fs::create_dir_all(path.as_path()).expect("create temp dir");
            Self { path }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(self.path.as_path());
        }
    }

    #[test]
    fn local_codex_cli_account_marker_detection_accepts_managed_account() {
        let account = OAuthAccountSummary {
            account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Local Codex CLI".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                "localCliManaged": true
            }),
            created_at: 0,
            updated_at: 0,
        };

        assert!(is_local_codex_cli_managed_account(&account));
    }

    #[test]
    fn local_codex_cli_account_marker_detection_rejects_service_oauth_account() {
        let account = OAuthAccountSummary {
            account_id: "codex-service-1".to_string(),
            provider: "codex".to_string(),
            external_account_id: Some("acct-1".to_string()),
            email: Some("service@example.com".to_string()),
            display_name: Some("Service OAuth".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "localCliManaged": false
            }),
            created_at: 0,
            updated_at: 0,
        };

        assert!(!is_local_codex_cli_managed_account(&account));
    }

    #[test]
    fn sync_local_codex_cli_account_from_profile_persists_chatgpt_workspace_metadata() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");

        sync_local_codex_cli_account_from_profile(
            &store,
            LocalCodexCliAuthProfile {
                external_account_id: Some("chatgpt-account-123".to_string()),
                email: Some("nitian12345@gmail.com".to_string()),
                auth_mode: Some("chatgpt".to_string()),
                plan_type: Some("team".to_string()),
                chatgpt_workspaces: Some(vec![OAuthAccountChatgptWorkspace {
                    workspace_id: "org-marcos".to_string(),
                    title: Some("MarcosSauerkraokpq".to_string()),
                    role: Some("owner".to_string()),
                    is_default: true,
                }]),
                default_chatgpt_workspace_id: Some("org-marcos".to_string()),
                last_refresh: Some("2026-03-16T12:00:00Z".to_string()),
                id_token: None,
                openai_api_key: None,
                access_token: Some("access-token".to_string()),
                refresh_token: None,
                api_credential: Some("access-token".to_string()),
                api_credential_source: Some("access_token".to_string()),
            },
        )
        .expect("sync local codex cli account from profile");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex cli account");

        assert_eq!(
            account.default_chatgpt_workspace_id.as_deref(),
            Some("org-marcos")
        );
        assert_eq!(
            account
                .chatgpt_workspaces
                .as_ref()
                .and_then(|workspaces| workspaces.first())
                .and_then(|workspace| workspace.title.as_deref()),
            Some("MarcosSauerkraokpq")
        );
        assert_eq!(
            account.metadata["defaultChatgptWorkspaceId"],
            json!("org-marcos")
        );
    }

    #[test]
    fn import_cockpit_tools_codex_accounts_from_path_imports_records_with_dedicated_source() {
        let temp = TempDir::new("runtime-cockpit-import");
        let cockpit_root = temp.path.join("com.antigravity.cockpit-tools");
        let accounts_dir = cockpit_root.join("codex_accounts");
        fs::create_dir_all(accounts_dir.as_path()).expect("create cockpit accounts dir");
        fs::write(
            cockpit_root.join("codex_accounts.json"),
            json!({
                "version":"1.0",
                "accounts":[{"id":"codex_abc123"}],
                "current_account_id":"codex_abc123"
            })
            .to_string(),
        )
        .expect("write cockpit account index");
        fs::write(
            accounts_dir.join("codex_abc123.json"),
            json!({
                "id":"codex_abc123",
                "email":"imported@example.com",
                "user_id":"user-1",
                "plan_type":"team",
                "account_id":"acct-123",
                "account_name":"Imported Account",
                "account_structure":"workspace",
                "organization_id":"org-1",
                "tokens":{
                    "id_token":"eyJhbGciOiJub25lIn0.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsib3JnYW5pemF0aW9ucyI6W3siaWQiOiJvcmctMSIsInRpdGxlIjoiT3JnIDEiLCJyb2xlIjoib3duZXIiLCJpc19kZWZhdWx0Ijp0cnVlfV19fQ.sig",
                    "access_token":"access-token-123",
                    "refresh_token":"refresh-token-123"
                }
            })
            .to_string(),
        )
        .expect("write cockpit account detail");

        let store = OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64))
            .expect("open oauth pool store with secret key");
        let summary = import_cockpit_tools_codex_accounts_from_path(&store, cockpit_root.as_path())
            .expect("import cockpit-tools codex accounts");

        assert_eq!(summary.scanned, 1);
        assert_eq!(summary.imported, 1);
        assert_eq!(summary.updated, 0);
        assert_eq!(summary.failed, 0);
        assert_eq!(summary.skipped, 0);

        let imported = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == "cockpit-tools:codex_abc123")
            .expect("imported cockpit account");
        assert_eq!(
            imported
                .metadata
                .get("source")
                .and_then(serde_json::Value::as_str),
            Some(COCKPIT_TOOLS_CODEX_ACCOUNT_SOURCE)
        );
        assert_eq!(imported.email.as_deref(), Some("imported@example.com"));
        assert_eq!(
            imported.default_chatgpt_workspace_id.as_deref(),
            Some("org-1")
        );
    }

    #[test]
    fn import_cockpit_tools_codex_accounts_from_path_counts_corrupt_records_as_failed() {
        let temp = TempDir::new("runtime-cockpit-import-corrupt");
        let cockpit_root = temp.path.join("com.antigravity.cockpit-tools");
        let accounts_dir = cockpit_root.join("codex_accounts");
        fs::create_dir_all(accounts_dir.as_path()).expect("create cockpit accounts dir");
        fs::write(
            cockpit_root.join("codex_accounts.json"),
            json!({
                "version":"1.0",
                "accounts":[{"id":"codex_broken"}]
            })
            .to_string(),
        )
        .expect("write cockpit account index");
        fs::write(accounts_dir.join("codex_broken.json"), "{not-json")
            .expect("write broken cockpit account detail");

        let store = OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64))
            .expect("open oauth pool store with secret key");
        let summary = import_cockpit_tools_codex_accounts_from_path(&store, cockpit_root.as_path())
            .expect("import should not fail entirely for partial corruption");

        assert_eq!(summary.scanned, 1);
        assert_eq!(summary.imported, 0);
        assert_eq!(summary.updated, 0);
        assert_eq!(summary.failed, 1);
        assert_eq!(summary.skipped, 0);
    }
}
