use super::*;

fn parse_chatgpt_workspace_from_auth_claims(
    value: &Value,
) -> Option<oauth_pool::OAuthAccountChatgptWorkspace> {
    let object = value.as_object()?;
    let workspace_id = parse_optional_non_empty_string(
        object
            .get("workspace_id")
            .or_else(|| object.get("workspaceId"))
            .or_else(|| object.get("organization_id"))
            .or_else(|| object.get("organizationId"))
            .or_else(|| object.get("id")),
    )?;
    let title = parse_optional_non_empty_string(object.get("title").or_else(|| object.get("name")));
    let role = parse_optional_non_empty_string(object.get("role"));
    let is_default = object
        .get("is_default")
        .or_else(|| object.get("isDefault"))
        .or_else(|| object.get("default"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    Some(oauth_pool::OAuthAccountChatgptWorkspace {
        workspace_id,
        title,
        role,
        is_default,
    })
}

fn parse_chatgpt_workspace_state_from_auth_claims(
    auth_claims: Option<&serde_json::Map<String, Value>>,
) -> (
    Option<Vec<oauth_pool::OAuthAccountChatgptWorkspace>>,
    Option<String>,
) {
    let Some(auth_claims) = auth_claims else {
        return (None, None);
    };
    let mut workspaces = auth_claims
        .get("organizations")
        .or_else(|| auth_claims.get("workspaces"))
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(parse_chatgpt_workspace_from_auth_claims)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let default_chatgpt_workspace_id = workspaces
        .iter()
        .find(|workspace| workspace.is_default)
        .map(|workspace| workspace.workspace_id.clone())
        .or_else(|| {
            parse_optional_non_empty_string(
                auth_claims
                    .get("default_workspace_id")
                    .or_else(|| auth_claims.get("defaultWorkspaceId"))
                    .or_else(|| auth_claims.get("default_organization_id"))
                    .or_else(|| auth_claims.get("defaultOrganizationId")),
            )
        });
    if let Some(default_workspace_id) = default_chatgpt_workspace_id.as_deref() {
        for workspace in &mut workspaces {
            if workspace.workspace_id == default_workspace_id {
                workspace.is_default = true;
            }
        }
    }
    (
        (!workspaces.is_empty()).then_some(workspaces),
        default_chatgpt_workspace_id,
    )
}

pub(super) fn load_local_codex_cli_auth_profile() -> Option<LocalCodexCliAuthProfile> {
    let path = resolve_local_codex_auth_path()?;
    load_local_codex_cli_auth_profile_from_path(path.as_path(), &LOCAL_CODEX_CLI_AUTH_PROFILE_CACHE)
}

pub(super) fn load_local_codex_cli_auth_profile_from_path(
    path: &Path,
    cache: &Mutex<LocalCodexCliAuthProfileCache>,
) -> Option<LocalCodexCliAuthProfile> {
    let signature = read_local_codex_cli_auth_file_signature(path);
    if let Ok(state) = cache.lock() {
        if state.path.as_deref() == Some(path) && state.signature == signature {
            return state.profile.clone();
        }
    }

    let profile = signature
        .as_ref()
        .and_then(|_| parse_local_codex_cli_auth_profile(path));

    if let Ok(mut state) = cache.lock() {
        state.path = Some(path.to_path_buf());
        state.signature = signature;
        state.profile = profile.clone();
    }

    profile
}

fn read_local_codex_cli_auth_file_signature(path: &Path) -> Option<LocalCodexCliAuthFileSignature> {
    let metadata = fs::metadata(path).ok()?;
    Some(LocalCodexCliAuthFileSignature {
        len: metadata.len(),
        modified: metadata.modified().ok(),
    })
}

fn parse_local_codex_cli_auth_profile(path: &Path) -> Option<LocalCodexCliAuthProfile> {
    let raw = fs::read_to_string(path).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let payload: Value = serde_json::from_str(trimmed).ok()?;
    parse_local_codex_cli_auth_profile_from_value(&payload)
}

pub(super) fn parse_local_codex_cli_auth_profile_from_value(
    payload: &Value,
) -> Option<LocalCodexCliAuthProfile> {
    let object = payload.as_object()?;
    let tokens = object.get("tokens").and_then(Value::as_object);
    let id_token = tokens.and_then(|entry| parse_optional_non_empty_string(entry.get("id_token")));
    let id_token_claims = id_token
        .as_deref()
        .and_then(parse_jwt_payload_without_verification);
    let auth_claims = id_token_claims
        .as_ref()
        .and_then(|claims| claims.get("https://api.openai.com/auth"))
        .and_then(Value::as_object);
    let openai_api_key = parse_optional_non_empty_string(object.get("OPENAI_API_KEY"));
    let access_token =
        tokens.and_then(|entry| parse_optional_non_empty_string(entry.get("access_token")));
    let refresh_token =
        tokens.and_then(|entry| parse_optional_non_empty_string(entry.get("refresh_token")));

    let (api_credential, api_credential_source) = if let Some(api_key) = openai_api_key.as_ref() {
        (
            Some(api_key.to_string()),
            Some("openai_api_key".to_string()),
        )
    } else if let Some(token) = access_token.as_ref() {
        (Some(token.to_string()), Some("access_token".to_string()))
    } else {
        (None, None)
    };
    let external_account_id = tokens
        .and_then(|entry| parse_optional_non_empty_string(entry.get("account_id")))
        .or_else(|| {
            auth_claims
                .and_then(|entry| parse_optional_non_empty_string(entry.get("chatgpt_account_id")))
        })
        .or_else(|| {
            id_token_claims
                .as_ref()
                .and_then(|entry| parse_optional_non_empty_string(entry.get("sub")))
        });
    let email = id_token_claims
        .as_ref()
        .and_then(|entry| parse_optional_non_empty_string(entry.get("email")));
    let plan_type = auth_claims
        .and_then(|entry| parse_optional_non_empty_string(entry.get("chatgpt_plan_type")));
    let (chatgpt_workspaces, default_chatgpt_workspace_id) =
        parse_chatgpt_workspace_state_from_auth_claims(auth_claims);

    if external_account_id.is_none() && email.is_none() && api_credential.is_none() {
        return None;
    }

    Some(LocalCodexCliAuthProfile {
        external_account_id,
        email,
        auth_mode: parse_optional_non_empty_string(object.get("auth_mode")),
        plan_type,
        chatgpt_workspaces,
        default_chatgpt_workspace_id,
        last_refresh: parse_optional_non_empty_string(object.get("last_refresh")),
        id_token,
        openai_api_key,
        access_token,
        refresh_token,
        api_credential,
        api_credential_source,
    })
}

pub(super) fn persist_local_codex_cli_auth_updates(
    id_token: Option<&str>,
    access_token: Option<&str>,
    refresh_token: Option<&str>,
    openai_api_key: Option<&str>,
    account_id: Option<&str>,
    auth_mode: Option<&str>,
) -> Result<(), String> {
    let Some(path) = resolve_local_codex_auth_path() else {
        return Err("local codex auth path unavailable".to_string());
    };
    let mut payload: Value = match fs::read_to_string(path.as_path()) {
        Ok(raw) => {
            if raw.trim().is_empty() {
                json!({})
            } else {
                serde_json::from_str(raw.as_str())
                    .map_err(|error| format!("parse local codex auth profile json: {error}"))?
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => json!({}),
        Err(error) => {
            return Err(format!(
                "read local codex auth profile {}: {error}",
                path.to_string_lossy()
            ));
        }
    };
    let Some(object) = payload.as_object_mut() else {
        return Err("local codex auth profile is not an object".to_string());
    };

    if let Some(value) = auth_mode.map(str::trim).filter(|value| !value.is_empty()) {
        object.insert("auth_mode".to_string(), Value::String(value.to_string()));
    }

    if let Some(value) = openai_api_key
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        object.insert(
            "OPENAI_API_KEY".to_string(),
            Value::String(value.to_string()),
        );
    }

    let tokens_value = object
        .entry("tokens".to_string())
        .or_insert_with(|| Value::Object(serde_json::Map::new()));
    let Some(tokens) = tokens_value.as_object_mut() else {
        return Err("local codex auth profile tokens field is invalid".to_string());
    };
    if let Some(value) = id_token.map(str::trim).filter(|value| !value.is_empty()) {
        tokens.insert("id_token".to_string(), Value::String(value.to_string()));
    }
    if let Some(value) = access_token
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        tokens.insert("access_token".to_string(), Value::String(value.to_string()));
    }
    if let Some(value) = refresh_token
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        tokens.insert(
            "refresh_token".to_string(),
            Value::String(value.to_string()),
        );
    }
    if let Some(value) = account_id.map(str::trim).filter(|value| !value.is_empty()) {
        tokens.insert("account_id".to_string(), Value::String(value.to_string()));
    }

    let refreshed_at = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| format!("format local codex auth refresh timestamp: {error}"))?;
    object.insert("last_refresh".to_string(), Value::String(refreshed_at));

    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("serialize local codex auth profile json: {error}"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create local codex auth directory {}: {error}",
                parent.to_string_lossy()
            )
        })?;
    }
    fs::write(path.as_path(), serialized.as_bytes()).map_err(|error| {
        format!(
            "write local codex auth profile {}: {error}",
            path.to_string_lossy()
        )
    })?;

    if let Ok(mut state) = LOCAL_CODEX_CLI_AUTH_PROFILE_CACHE.lock() {
        state.path = Some(path.clone());
        state.signature = read_local_codex_cli_auth_file_signature(path.as_path());
        state.profile = parse_local_codex_cli_auth_profile_from_value(&payload);
    }

    Ok(())
}

fn parse_jwt_payload_without_verification(token: &str) -> Option<Value> {
    let payload_segment = token.split('.').nth(1)?;
    let decoded = decode_jwt_base64_segment(payload_segment)?;
    serde_json::from_slice(decoded.as_slice()).ok()
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

#[cfg(test)]
mod tests {
    use super::{
        parse_local_codex_cli_auth_profile_from_value, persist_local_codex_cli_auth_updates,
    };
    use crate::local_codex_exec_path::local_codex_exec_env_lock;
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    use serde_json::{json, Value};
    use std::{env, fs, path::PathBuf};
    use uuid::Uuid;

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

    fn encode_jwt(payload: Value) -> String {
        let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"none","typ":"JWT"}"#);
        let payload =
            URL_SAFE_NO_PAD.encode(serde_json::to_vec(&payload).expect("serialize jwt payload"));
        format!("{header}.{payload}.sig")
    }

    #[test]
    fn parse_local_codex_cli_auth_profile_reads_chatgpt_workspace_memberships() {
        let payload = json!({
            "auth_mode": "chatgpt",
            "tokens": {
                "id_token": encode_jwt(json!({
                    "email": "nitian12345@gmail.com",
                    "https://api.openai.com/auth": {
                        "chatgpt_account_id": "account-123",
                        "chatgpt_plan_type": "team",
                        "organizations": [
                            {
                                "id": "org-marcos",
                                "title": "MarcosSauerkraokpq",
                                "role": "owner",
                                "is_default": true
                            }
                        ]
                    }
                })),
                "access_token": "access-token"
            }
        });

        let profile =
            parse_local_codex_cli_auth_profile_from_value(&payload).expect("profile should parse");

        assert_eq!(profile.external_account_id.as_deref(), Some("account-123"));
        assert_eq!(profile.plan_type.as_deref(), Some("team"));
        assert_eq!(
            profile.default_chatgpt_workspace_id.as_deref(),
            Some("org-marcos")
        );
        assert_eq!(
            profile
                .chatgpt_workspaces
                .as_ref()
                .and_then(|workspaces| workspaces.first())
                .and_then(|workspace| workspace.title.as_deref()),
            Some("MarcosSauerkraokpq")
        );
    }

    #[test]
    fn persist_local_codex_cli_auth_updates_creates_auth_json_for_detected_home() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex auth env lock poisoned");
        let previous_runtime_home = env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = env::var_os("CODEX_HOME");
        let temp_dir = TempDir::new("runtime-codex-auth");

        unsafe {
            env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.path.as_os_str());
            env::remove_var("CODEX_HOME");
        }

        persist_local_codex_cli_auth_updates(
            Some("id-token"),
            Some("access-token"),
            Some("refresh-token"),
            Some("sk-openai"),
            Some("acct-123"),
            Some("chatgpt"),
        )
        .expect("persist local codex auth");

        let auth_path = temp_dir.path.join("auth.json");
        let payload: Value = serde_json::from_str(
            fs::read_to_string(auth_path.as_path())
                .expect("read auth json")
                .as_str(),
        )
        .expect("parse auth json");
        assert_eq!(
            payload.get("auth_mode").and_then(Value::as_str),
            Some("chatgpt")
        );
        assert_eq!(
            payload.get("OPENAI_API_KEY").and_then(Value::as_str),
            Some("sk-openai")
        );
        assert_eq!(
            payload
                .get("tokens")
                .and_then(Value::as_object)
                .and_then(|tokens| tokens.get("account_id"))
                .and_then(Value::as_str),
            Some("acct-123")
        );

        unsafe {
            match previous_runtime_home {
                Some(value) => env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
                None => env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
            }
            match previous_codex_home {
                Some(value) => env::set_var("CODEX_HOME", value),
                None => env::remove_var("CODEX_HOME"),
            }
        }
    }
}
