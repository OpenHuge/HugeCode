use super::*;
use crate::oauth_pool::{
    OAUTH_ACCOUNT_CHATGPT_WORKSPACES_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_DEFAULT_CHATGPT_WORKSPACE_ID_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTE_CONFIG_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTING_CREDENTIAL_READY_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTING_LAST_ERROR_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTING_OVERLOADED_UNTIL_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTING_RATE_LIMITED_UNTIL_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTING_STATE_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_REASON_METADATA_CANDIDATES,
    OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_UNTIL_METADATA_CANDIDATES,
};

enum TypedMetadataPatch {
    Keep,
    Clear,
    Set(serde_json::Map<String, Value>),
}

pub(super) fn parse_oauth_account_upsert_input(
    params: &serde_json::Map<String, Value>,
    runtime_diagnostics: &RuntimeDiagnosticsState,
) -> Result<OAuthAccountUpsertInput, RpcError> {
    let account_id = read_required_string(params, "accountId")?.to_string();
    let provider = parse_required_oauth_provider(params, "provider")?;
    let status = parse_optional_account_status(params, "status")?;
    let route_config_patch =
        parse_oauth_account_route_config_metadata_patch(params, "routeConfig", "route_config")?;
    let routing_state_patch =
        parse_oauth_account_routing_state_metadata_patch(params, "routingState", "routing_state")?;
    let chatgpt_workspaces_patch = parse_oauth_account_chatgpt_workspaces_metadata_patch(
        params,
        "chatgptWorkspaces",
        "chatgpt_workspaces",
    )?;
    let metadata = match params.get("metadata") {
        None => None,
        Some(value) if value.is_object() => {
            let metadata = value.as_object().ok_or_else(|| {
                RpcError::invalid_params("Field `metadata` must be a JSON object when provided.")
            })?;
            if metadata.contains_key(OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY) {
                runtime_diagnostics.record_oauth_reserved_metadata_rejection();
                return Err(RpcError::invalid_params(format!(
                    "Field `metadata.{}` is reserved and cannot be set by clients.",
                    OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY
                )));
            }
            let mut sanitized_metadata = metadata.clone();
            if account_id == LOCAL_CODEX_CLI_ACCOUNT_ID {
                for key in LOCAL_CODEX_CLI_RESERVED_METADATA_KEYS {
                    sanitized_metadata.remove(*key);
                }
            }
            Some(Value::Object(sanitized_metadata))
        }
        Some(_) => {
            return Err(RpcError::invalid_params(
                "Field `metadata` must be a JSON object when provided.",
            ));
        }
    };
    let metadata = merge_oauth_account_typed_metadata_patches(
        metadata,
        route_config_patch,
        routing_state_patch,
        chatgpt_workspaces_patch,
    );

    Ok(OAuthAccountUpsertInput {
        account_id,
        provider,
        external_account_id: read_optional_string(params, "externalAccountId"),
        email: read_optional_string(params, "email"),
        display_name: read_optional_string(params, "displayName"),
        status,
        disabled_reason: read_optional_string(params, "disabledReason"),
        metadata,
    })
}

fn parse_oauth_account_route_config_metadata_patch(
    params: &serde_json::Map<String, Value>,
    field: &str,
    compat_field: &str,
) -> Result<TypedMetadataPatch, RpcError> {
    let Some(value) = params.get(field).or_else(|| params.get(compat_field)) else {
        return Ok(TypedMetadataPatch::Keep);
    };
    if value.is_null() {
        return Ok(TypedMetadataPatch::Clear);
    }
    let object = value.as_object().ok_or_else(|| {
        RpcError::invalid_params(format!(
            "Field `{field}` must be a JSON object when provided."
        ))
    })?;

    let compat_base_url_raw = object
        .get("compatBaseUrl")
        .or_else(|| object.get("compat_base_url"))
        .map(|entry| parse_optional_string_like(entry, "routeConfig.compatBaseUrl"))
        .transpose()?
        .flatten();
    let compat_base_url = match compat_base_url_raw {
        Some(raw) => Some(
            normalize_openai_compat_base_url(raw.as_str()).ok_or_else(|| {
                RpcError::invalid_params(
                    "Field `routeConfig.compatBaseUrl` must be a valid http or https URL.",
                )
            })?,
        ),
        None => None,
    };
    let proxy_id = object
        .get("proxyId")
        .or_else(|| object.get("proxy_id"))
        .map(|entry| parse_optional_string_like(entry, "routeConfig.proxyId"))
        .transpose()?
        .flatten();
    let priority = object
        .get("priority")
        .map(|entry| parse_optional_i32_like(entry, "routeConfig.priority"))
        .transpose()?
        .flatten();
    let concurrency_limit = object
        .get("concurrencyLimit")
        .or_else(|| object.get("concurrency_limit"))
        .map(|entry| parse_optional_i32_like(entry, "routeConfig.concurrencyLimit"))
        .transpose()?
        .flatten();
    let schedulable = object
        .get("schedulable")
        .map(|entry| parse_optional_bool_like(entry, "routeConfig.schedulable"))
        .transpose()?
        .flatten();

    let mut route_metadata = serde_json::Map::new();
    if let Some(compat_base_url) = compat_base_url {
        route_metadata.insert("compatBaseUrl".to_string(), Value::String(compat_base_url));
    }
    if let Some(proxy_id) = proxy_id {
        route_metadata.insert("proxyId".to_string(), Value::String(proxy_id));
    }
    if let Some(priority) = priority {
        route_metadata.insert("priority".to_string(), json!(priority));
    }
    if let Some(concurrency_limit) = concurrency_limit {
        route_metadata.insert("concurrencyLimit".to_string(), json!(concurrency_limit));
    }
    if let Some(schedulable) = schedulable {
        route_metadata.insert("schedulable".to_string(), Value::Bool(schedulable));
    }

    if route_metadata.is_empty() {
        Ok(TypedMetadataPatch::Clear)
    } else {
        Ok(TypedMetadataPatch::Set(route_metadata))
    }
}

fn parse_oauth_account_routing_state_metadata_patch(
    params: &serde_json::Map<String, Value>,
    field: &str,
    compat_field: &str,
) -> Result<TypedMetadataPatch, RpcError> {
    let Some(value) = params.get(field).or_else(|| params.get(compat_field)) else {
        return Ok(TypedMetadataPatch::Keep);
    };
    if value.is_null() {
        return Ok(TypedMetadataPatch::Clear);
    }
    let object = value.as_object().ok_or_else(|| {
        RpcError::invalid_params(format!(
            "Field `{field}` must be a JSON object when provided."
        ))
    })?;

    let credential_ready = object
        .get("credentialReady")
        .or_else(|| object.get("credential_ready"))
        .map(|entry| parse_optional_bool_like(entry, "routingState.credentialReady"))
        .transpose()?
        .flatten();
    let last_routing_error = object
        .get("lastRoutingError")
        .or_else(|| object.get("last_routing_error"))
        .map(|entry| parse_optional_string_like(entry, "routingState.lastRoutingError"))
        .transpose()?
        .flatten();
    let rate_limited_until = object
        .get("rateLimitedUntil")
        .or_else(|| object.get("rate_limited_until"))
        .map(|entry| parse_optional_u64_like(entry, "routingState.rateLimitedUntil"))
        .transpose()?
        .flatten();
    let overloaded_until = object
        .get("overloadedUntil")
        .or_else(|| object.get("overloaded_until"))
        .map(|entry| parse_optional_u64_like(entry, "routingState.overloadedUntil"))
        .transpose()?
        .flatten();
    let temp_unschedulable_until = object
        .get("tempUnschedulableUntil")
        .or_else(|| object.get("temp_unschedulable_until"))
        .map(|entry| parse_optional_u64_like(entry, "routingState.tempUnschedulableUntil"))
        .transpose()?
        .flatten();
    let temp_unschedulable_reason = object
        .get("tempUnschedulableReason")
        .or_else(|| object.get("temp_unschedulable_reason"))
        .map(|entry| parse_optional_string_like(entry, "routingState.tempUnschedulableReason"))
        .transpose()?
        .flatten();

    let mut routing_metadata = serde_json::Map::new();
    if let Some(credential_ready) = credential_ready {
        routing_metadata.insert("credentialReady".to_string(), Value::Bool(credential_ready));
    }
    if let Some(last_routing_error) = last_routing_error {
        routing_metadata.insert(
            "lastRoutingError".to_string(),
            Value::String(last_routing_error),
        );
    }
    if let Some(rate_limited_until) = rate_limited_until {
        routing_metadata.insert("rateLimitedUntil".to_string(), json!(rate_limited_until));
    }
    if let Some(overloaded_until) = overloaded_until {
        routing_metadata.insert("overloadedUntil".to_string(), json!(overloaded_until));
    }
    if let Some(temp_unschedulable_until) = temp_unschedulable_until {
        routing_metadata.insert(
            "tempUnschedulableUntil".to_string(),
            json!(temp_unschedulable_until),
        );
    }
    if let Some(temp_unschedulable_reason) = temp_unschedulable_reason {
        routing_metadata.insert(
            "tempUnschedulableReason".to_string(),
            Value::String(temp_unschedulable_reason),
        );
    }

    if routing_metadata.is_empty() {
        Ok(TypedMetadataPatch::Clear)
    } else {
        Ok(TypedMetadataPatch::Set(routing_metadata))
    }
}

fn parse_oauth_account_chatgpt_workspaces_metadata_patch(
    params: &serde_json::Map<String, Value>,
    field: &str,
    compat_field: &str,
) -> Result<TypedMetadataPatch, RpcError> {
    let Some(value) = params.get(field).or_else(|| params.get(compat_field)) else {
        return Ok(TypedMetadataPatch::Keep);
    };
    if value.is_null() {
        return Ok(TypedMetadataPatch::Clear);
    }
    let object = value.as_array().ok_or_else(|| {
        RpcError::invalid_params(format!(
            "Field `{field}` must be a JSON array when provided."
        ))
    })?;

    let default_chatgpt_workspace_id = params
        .get("defaultChatgptWorkspaceId")
        .or_else(|| params.get("default_chatgpt_workspace_id"))
        .map(|entry| parse_optional_string_like(entry, "defaultChatgptWorkspaceId"))
        .transpose()?
        .flatten();

    let mut workspaces = Vec::with_capacity(object.len());
    for (index, entry) in object.iter().enumerate() {
        let workspace = entry.as_object().ok_or_else(|| {
            RpcError::invalid_params(format!(
                "Field `{field}[{index}]` must be a JSON object when provided."
            ))
        })?;
        let workspace_id = workspace
            .get("workspaceId")
            .or_else(|| workspace.get("workspace_id"))
            .or_else(|| workspace.get("organizationId"))
            .or_else(|| workspace.get("organization_id"))
            .or_else(|| workspace.get("id"))
            .map(|value| {
                parse_optional_string_like(value, &format!("{field}[{index}].workspaceId"))
            })
            .transpose()?
            .flatten()
            .ok_or_else(|| {
                RpcError::invalid_params(format!(
                    "Field `{field}[{index}].workspaceId` is required."
                ))
            })?;
        let title = workspace
            .get("title")
            .or_else(|| workspace.get("name"))
            .map(|value| parse_optional_string_like(value, &format!("{field}[{index}].title")))
            .transpose()?
            .flatten();
        let role = workspace
            .get("role")
            .map(|value| parse_optional_string_like(value, &format!("{field}[{index}].role")))
            .transpose()?
            .flatten();
        let is_default = workspace
            .get("isDefault")
            .or_else(|| workspace.get("is_default"))
            .or_else(|| workspace.get("default"))
            .map(|value| parse_optional_bool_like(value, &format!("{field}[{index}].isDefault")))
            .transpose()?
            .flatten()
            .unwrap_or_else(|| {
                default_chatgpt_workspace_id
                    .as_deref()
                    .is_some_and(|default_id| default_id == workspace_id)
            });
        workspaces.push(json!({
            "workspaceId": workspace_id,
            "title": title,
            "role": role,
            "isDefault": is_default
        }));
    }

    if workspaces.is_empty() {
        return Ok(TypedMetadataPatch::Clear);
    }

    let mut workspace_metadata = serde_json::Map::new();
    workspace_metadata.insert("chatgptWorkspaces".to_string(), Value::Array(workspaces));
    if let Some(default_chatgpt_workspace_id) = default_chatgpt_workspace_id {
        workspace_metadata.insert(
            "defaultChatgptWorkspaceId".to_string(),
            Value::String(default_chatgpt_workspace_id),
        );
    }
    Ok(TypedMetadataPatch::Set(workspace_metadata))
}

fn parse_optional_string_like(value: &Value, field: &str) -> Result<Option<String>, RpcError> {
    if value.is_null() {
        return Ok(None);
    }
    let raw = value.as_str().ok_or_else(|| {
        RpcError::invalid_params(format!("Field `{field}` must be a string when provided."))
    })?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed.to_string()))
    }
}

fn parse_optional_i32_like(value: &Value, field: &str) -> Result<Option<i32>, RpcError> {
    if value.is_null() {
        return Ok(None);
    }
    let Some(raw) = value.as_i64() else {
        return Err(RpcError::invalid_params(format!(
            "Field `{field}` must be an integer when provided."
        )));
    };
    let value = i32::try_from(raw).map_err(|_| {
        RpcError::invalid_params(format!(
            "Field `{field}` is out of range for a 32-bit integer."
        ))
    })?;
    Ok(Some(value))
}

fn parse_optional_u64_like(value: &Value, field: &str) -> Result<Option<u64>, RpcError> {
    if value.is_null() {
        return Ok(None);
    }
    value.as_u64().map(Some).ok_or_else(|| {
        RpcError::invalid_params(format!(
            "Field `{field}` must be a non-negative integer when provided."
        ))
    })
}

fn parse_optional_bool_like(value: &Value, field: &str) -> Result<Option<bool>, RpcError> {
    if value.is_null() {
        return Ok(None);
    }
    value.as_bool().map(Some).ok_or_else(|| {
        RpcError::invalid_params(format!("Field `{field}` must be a boolean when provided."))
    })
}

fn merge_oauth_account_typed_metadata_patches(
    metadata: Option<Value>,
    route_config_patch: TypedMetadataPatch,
    routing_state_patch: TypedMetadataPatch,
    chatgpt_workspaces_patch: TypedMetadataPatch,
) -> Option<Value> {
    let mut object = metadata
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();

    match route_config_patch {
        TypedMetadataPatch::Keep => {}
        TypedMetadataPatch::Clear => {
            for key in OAUTH_ACCOUNT_ROUTE_CONFIG_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES {
                object.remove(*key);
            }
        }
        TypedMetadataPatch::Set(route_metadata) => {
            for key in OAUTH_ACCOUNT_ROUTE_CONFIG_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES {
                object.remove(*key);
            }
            if let Some(compat_base_url) = route_metadata.get("compatBaseUrl").cloned() {
                object.insert("compatBaseUrl".to_string(), compat_base_url);
            }
            object.insert("routeConfig".to_string(), Value::Object(route_metadata));
        }
    }

    match routing_state_patch {
        TypedMetadataPatch::Keep => {}
        TypedMetadataPatch::Clear => {
            for key in OAUTH_ACCOUNT_ROUTING_STATE_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_CREDENTIAL_READY_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_LAST_ERROR_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_RATE_LIMITED_UNTIL_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_OVERLOADED_UNTIL_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_UNTIL_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_REASON_METADATA_CANDIDATES {
                object.remove(*key);
            }
        }
        TypedMetadataPatch::Set(routing_metadata) => {
            for key in OAUTH_ACCOUNT_ROUTING_STATE_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_LAST_ERROR_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_RATE_LIMITED_UNTIL_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_OVERLOADED_UNTIL_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_UNTIL_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_REASON_METADATA_CANDIDATES {
                object.remove(*key);
            }
            if let Some(credential_ready) = routing_metadata.get("credentialReady").cloned() {
                object.insert("credentialReady".to_string(), credential_ready);
            } else {
                for key in OAUTH_ACCOUNT_ROUTING_CREDENTIAL_READY_METADATA_CANDIDATES {
                    object.remove(*key);
                }
            }
            object.insert("routingState".to_string(), Value::Object(routing_metadata));
        }
    }

    match chatgpt_workspaces_patch {
        TypedMetadataPatch::Keep => {}
        TypedMetadataPatch::Clear => {
            for key in OAUTH_ACCOUNT_CHATGPT_WORKSPACES_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_DEFAULT_CHATGPT_WORKSPACE_ID_METADATA_CANDIDATES {
                object.remove(*key);
            }
        }
        TypedMetadataPatch::Set(chatgpt_workspace_metadata) => {
            for key in OAUTH_ACCOUNT_CHATGPT_WORKSPACES_METADATA_CANDIDATES {
                object.remove(*key);
            }
            for key in OAUTH_ACCOUNT_DEFAULT_CHATGPT_WORKSPACE_ID_METADATA_CANDIDATES {
                object.remove(*key);
            }
            if let Some(workspaces) = chatgpt_workspace_metadata.get("chatgptWorkspaces").cloned() {
                object.insert("chatgptWorkspaces".to_string(), workspaces);
            }
            if let Some(default_workspace_id) = chatgpt_workspace_metadata
                .get("defaultChatgptWorkspaceId")
                .cloned()
            {
                object.insert(
                    "defaultChatgptWorkspaceId".to_string(),
                    default_workspace_id,
                );
            }
        }
    }

    Some(Value::Object(object))
}

pub(super) fn map_oauth_account_upsert_error(error: OAuthPoolMutationError) -> RpcError {
    match error.code() {
        OAuthPoolMutationErrorCode::InvalidInput => RpcError::invalid_params(error.message()),
        OAuthPoolMutationErrorCode::Internal => RpcError::internal(error.message()),
    }
}

pub(super) fn map_oauth_pool_mutation_error(error: OAuthPoolMutationError) -> RpcError {
    match error.code() {
        OAuthPoolMutationErrorCode::InvalidInput => RpcError::invalid_params(error.message()),
        OAuthPoolMutationErrorCode::Internal => RpcError::internal(error.message()),
    }
}

pub(super) fn parse_oauth_pool_upsert_input(
    params: &serde_json::Map<String, Value>,
) -> Result<OAuthPoolUpsertInput, RpcError> {
    let pool_id = read_required_string(params, "poolId")?.to_string();
    let provider = parse_required_oauth_provider(params, "provider")?;
    let name = read_required_string(params, "name")?.to_string();
    let strategy = parse_optional_pool_strategy(params, "strategy")?;
    let sticky_mode = parse_optional_sticky_mode(params, "stickyMode")?;
    let metadata = match params.get("metadata") {
        None => json!({}),
        Some(value) if value.is_object() => value.clone(),
        Some(_) => {
            return Err(RpcError::invalid_params(
                "Field `metadata` must be a JSON object when provided.",
            ));
        }
    };

    Ok(OAuthPoolUpsertInput {
        pool_id,
        provider,
        name,
        strategy,
        sticky_mode,
        preferred_account_id: read_optional_string(params, "preferredAccountId"),
        enabled: read_optional_bool(params, "enabled"),
        metadata,
    })
}

pub(super) fn parse_oauth_pool_apply_input(
    params: &serde_json::Map<String, Value>,
) -> Result<OAuthPoolApplyInput, RpcError> {
    let pool = params
        .get("pool")
        .and_then(Value::as_object)
        .ok_or_else(|| RpcError::invalid_params("Missing required object field: pool"))?;
    let members = parse_oauth_pool_member_inputs(params)?;
    let expected_updated_at = read_optional_u64(params, "expectedUpdatedAt")
        .or_else(|| read_optional_u64(params, "expected_updated_at"));

    Ok(OAuthPoolApplyInput {
        pool: parse_oauth_pool_upsert_input(pool)?,
        members,
        expected_updated_at,
    })
}

pub(super) fn parse_oauth_pool_member_inputs(
    params: &serde_json::Map<String, Value>,
) -> Result<Vec<OAuthPoolMemberInput>, RpcError> {
    let members = params
        .get("members")
        .and_then(Value::as_array)
        .ok_or_else(|| RpcError::invalid_params("Missing required array field: members"))?;

    let mut inputs = Vec::with_capacity(members.len());
    let mut seen_account_ids = std::collections::HashSet::new();
    for (index, member) in members.iter().enumerate() {
        let object = member.as_object().ok_or_else(|| {
            RpcError::invalid_params(format!("members[{index}] must be a JSON object"))
        })?;
        let account_id = read_required_string(object, "accountId")?.to_string();
        if !seen_account_ids.insert(account_id.clone()) {
            return Err(RpcError::invalid_params(format!(
                "members[{index}].accountId duplicates `{account_id}`."
            )));
        }
        let weight = read_optional_i32(object, "weight");
        let priority = read_optional_i32(object, "priority");
        let position = read_optional_i32(object, "position");
        let enabled = read_optional_bool(object, "enabled");
        inputs.push(OAuthPoolMemberInput {
            account_id,
            weight,
            priority,
            position,
            enabled,
        });
    }
    Ok(inputs)
}

pub(super) fn parse_oauth_rate_limit_report_input(
    params: &serde_json::Map<String, Value>,
) -> Result<OAuthRateLimitReportInput, RpcError> {
    let account_id = read_required_string(params, "accountId")?.to_string();
    let success = read_optional_bool(params, "success").unwrap_or(false);
    let retry_after_sec = read_optional_u64(params, "retryAfterSec");
    let reset_at = read_optional_u64(params, "resetAt");

    Ok(OAuthRateLimitReportInput {
        account_id,
        model_id: read_optional_string(params, "modelId"),
        success,
        retry_after_sec,
        reset_at,
        error_code: read_optional_string(params, "errorCode"),
        error_message: read_optional_string(params, "errorMessage"),
    })
}

pub(super) fn parse_oauth_primary_account_set_input(
    params: &serde_json::Map<String, Value>,
) -> Result<OAuthPrimaryAccountSetInput, RpcError> {
    let provider = parse_required_oauth_provider(params, "provider")?;
    let account_id = read_optional_string(params, "accountId")
        .or_else(|| read_optional_string(params, "account_id"));
    Ok(OAuthPrimaryAccountSetInput {
        provider,
        account_id,
    })
}

fn parse_required_oauth_provider(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<String, RpcError> {
    let provider = read_required_string(params, field)?;
    if let Some(canonical) = canonicalize_provider_alias(provider) {
        return Ok(canonical.to_string());
    }
    Err(RpcError::invalid_params(format!(
        "Unsupported provider `{provider}`. Expected canonical providers: codex, gemini, claude_code (aliases: openai, google/antigravity, anthropic/claude)."
    )))
}

pub(super) fn parse_optional_oauth_provider(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<Option<String>, RpcError> {
    let provider = read_optional_string(params, field);
    let Some(provider_value) = provider.as_deref() else {
        return Ok(None);
    };
    if let Some(canonical) = canonicalize_provider_alias(provider_value) {
        return Ok(Some(canonical.to_string()));
    }
    Err(RpcError::invalid_params(format!(
        "Unsupported provider `{provider_value}`. Expected canonical providers: codex, gemini, claude_code (aliases: openai, google/antigravity, anthropic/claude)."
    )))
}

fn parse_optional_account_status(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<Option<String>, RpcError> {
    let value = read_optional_string(params, field);
    let Some(status) = value.as_deref() else {
        return Ok(None);
    };
    let normalized = status.trim().to_ascii_lowercase();
    if matches!(
        normalized.as_str(),
        "enabled" | "disabled" | "forbidden" | "validation_blocked"
    ) {
        return Ok(Some(normalized));
    }
    Err(RpcError::invalid_params(format!(
        "Unsupported account status `{status}`. Expected one of: enabled, disabled, forbidden, validation_blocked."
    )))
}

fn parse_optional_pool_strategy(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<Option<String>, RpcError> {
    let value = read_optional_string(params, field);
    let Some(strategy) = value.as_deref() else {
        return Ok(None);
    };
    let normalized = strategy.trim().to_ascii_lowercase();
    if matches!(normalized.as_str(), "round_robin" | "p2c") {
        return Ok(Some(normalized));
    }
    Err(RpcError::invalid_params(format!(
        "Unsupported pool strategy `{strategy}`. Expected one of: round_robin, p2c."
    )))
}

fn parse_optional_sticky_mode(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<Option<String>, RpcError> {
    let value = read_optional_string(params, field);
    let Some(sticky_mode) = value.as_deref() else {
        return Ok(None);
    };
    let normalized = sticky_mode.trim().to_ascii_lowercase();
    if matches!(
        normalized.as_str(),
        "cache_first" | "balance" | "performance_first"
    ) {
        return Ok(Some(normalized));
    }
    Err(RpcError::invalid_params(format!(
        "Unsupported sticky mode `{sticky_mode}`. Expected one of: cache_first, balance, performance_first."
    )))
}
