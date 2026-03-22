#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MetadataPatchField {
    Keep,
    Clear,
    Set,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum SecretStorage {
    Missing,
    Encrypted(String),
    Plaintext(String),
}

fn merge_account_metadata(
    existing: Value,
    patch: Option<Value>,
    cipher: Option<&AccountSecretCipher>,
) -> Result<Value, OAuthPoolMutationError> {
    let patch_provided = patch.is_some();
    let mut merged = normalize_metadata(existing)
        .as_object()
        .cloned()
        .unwrap_or_default();

    let mut next_api_key = resolve_secret_storage(
        &merged,
        OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY,
        OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES,
        "api key",
    )
    .map_err(invalid_input_error)?;
    if matches!(next_api_key, SecretStorage::Encrypted(_)) && cipher.is_none() {
        return Err(OAuthPoolMutationError::internal(
            "Encrypted OAuth account API keys are present but CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is not configured."
                .to_string(),
        ));
    }
    let mut next_refresh_token = resolve_secret_storage(
        &merged,
        OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY,
        OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES,
        "refresh token",
    )
    .map_err(invalid_input_error)?;
    if matches!(next_refresh_token, SecretStorage::Encrypted(_)) && cipher.is_none() {
        return Err(OAuthPoolMutationError::internal(
            "Encrypted OAuth account refresh tokens are present but CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is not configured."
                .to_string(),
        ));
    }
    let mut next_compat_base_url = resolve_compat_base_url_from_metadata(&merged);

    for key in OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES {
        merged.remove(*key);
    }
    merged.remove(OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY);
    for key in OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES {
        merged.remove(*key);
    }
    merged.remove(OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY);
    for key in OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES {
        merged.remove(*key);
    }

    if let Some(patch_value) = patch {
        let patch_map = patch_value
            .as_object()
            .ok_or_else(|| invalid_input_error("metadata must be an object"))?;
        if patch_map.contains_key(OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY) {
            return Err(invalid_input_error(format!(
                "metadata `{}` is reserved and cannot be set directly.",
                OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY
            )));
        }
        if patch_map.contains_key(OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY) {
            return Err(invalid_input_error(format!(
                "metadata `{}` is reserved and cannot be set directly.",
                OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY
            )));
        }

        for (key, value) in patch_map {
            if OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES.contains(&key.as_str())
                || OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES.contains(&key.as_str())
                || OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES.contains(&key.as_str())
            {
                continue;
            }
            if value.is_null() {
                merged.remove(key);
            } else {
                merged.insert(key.clone(), value.clone());
            }
        }

        match resolve_patch_field(
            patch_map,
            OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES,
            false,
            "api key",
        )
        .map_err(invalid_input_error)?
        {
            (MetadataPatchField::Keep, _) => {}
            (MetadataPatchField::Clear, _) => next_api_key = SecretStorage::Missing,
            (MetadataPatchField::Set, Some(value)) => {
                let cipher = cipher.ok_or_else(|| {
                    OAuthPoolMutationError::internal(
                        "CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is required to store OAuth account API keys."
                            .to_string(),
                    )
                })?;
                let encrypted = cipher
                    .encrypt_api_key(value.as_str())
                    .map_err(OAuthPoolMutationError::internal)?;
                next_api_key = SecretStorage::Encrypted(encrypted);
            }
            (MetadataPatchField::Set, None) => {}
        }

        match resolve_patch_field(
            patch_map,
            OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES,
            false,
            "refresh token",
        )
        .map_err(invalid_input_error)?
        {
            (MetadataPatchField::Keep, _) => {}
            (MetadataPatchField::Clear, _) => next_refresh_token = SecretStorage::Missing,
            (MetadataPatchField::Set, Some(value)) => {
                let cipher = cipher.ok_or_else(|| {
                    OAuthPoolMutationError::internal(
                        "CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is required to store OAuth account refresh tokens."
                            .to_string(),
                    )
                })?;
                let encrypted = cipher
                    .encrypt_api_key(value.as_str())
                    .map_err(OAuthPoolMutationError::internal)?;
                next_refresh_token = SecretStorage::Encrypted(encrypted);
            }
            (MetadataPatchField::Set, None) => {}
        }

        match resolve_patch_field(
            patch_map,
            OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES,
            true,
            "compat base URL",
        )
        .map_err(invalid_input_error)?
        {
            (MetadataPatchField::Keep, _) => {}
            (MetadataPatchField::Clear, _) => next_compat_base_url = None,
            (MetadataPatchField::Set, Some(value)) => next_compat_base_url = Some(value),
            (MetadataPatchField::Set, None) => {}
        }
    }

    if !patch_provided {
        if let SecretStorage::Plaintext(plaintext) = next_api_key {
            let cipher = cipher.ok_or_else(|| {
                OAuthPoolMutationError::internal(
                    "Legacy plaintext OAuth account API keys detected. Configure CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY to migrate securely."
                        .to_string(),
                )
            })?;
            let encrypted = cipher
                .encrypt_api_key(plaintext.as_str())
                .map_err(OAuthPoolMutationError::internal)?;
            next_api_key = SecretStorage::Encrypted(encrypted);
        }
        if let SecretStorage::Plaintext(plaintext) = next_refresh_token {
            let cipher = cipher.ok_or_else(|| {
                OAuthPoolMutationError::internal(
                    "Legacy plaintext OAuth account refresh tokens detected. Configure CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY to migrate securely."
                        .to_string(),
                )
            })?;
            let encrypted = cipher
                .encrypt_api_key(plaintext.as_str())
                .map_err(OAuthPoolMutationError::internal)?;
            next_refresh_token = SecretStorage::Encrypted(encrypted);
        }
    }

    if let SecretStorage::Encrypted(encrypted_payload) = next_api_key {
        merged.insert(
            OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY.to_string(),
            Value::String(encrypted_payload),
        );
    }
    if let SecretStorage::Encrypted(encrypted_payload) = next_refresh_token {
        merged.insert(
            OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY.to_string(),
            Value::String(encrypted_payload),
        );
    }
    if let Some(base_url) = next_compat_base_url {
        merged.insert("compatBaseUrl".to_string(), Value::String(base_url));
    }

    Ok(Value::Object(merged))
}

fn resolve_secret_storage(
    metadata: &serde_json::Map<String, Value>,
    encrypted_key: &str,
    plaintext_candidates: &[&str],
    field_label: &str,
) -> OAuthResult<SecretStorage> {
    if let Some(value) = metadata.get(encrypted_key) {
        if value.is_null() {
            return Ok(SecretStorage::Missing);
        }
        let encrypted = value.as_str().ok_or_else(|| {
            format!(
                "metadata `{}` must be a string when used as encrypted {field_label}",
                encrypted_key
            )
        })?;
        let trimmed = encrypted.trim();
        if trimmed.is_empty() {
            return Ok(SecretStorage::Missing);
        }
        return Ok(SecretStorage::Encrypted(trimmed.to_string()));
    }

    let plaintext =
        resolve_metadata_string_value(metadata, plaintext_candidates, false, field_label)?;
    Ok(match plaintext {
        Some(value) => SecretStorage::Plaintext(value),
        None => SecretStorage::Missing,
    })
}

fn resolve_metadata_string_value(
    metadata: &serde_json::Map<String, Value>,
    candidates: &[&str],
    normalize_as_url: bool,
    field_label: &str,
) -> OAuthResult<Option<String>> {
    for key in candidates {
        let Some(value) = metadata.get(*key) else {
            continue;
        };
        if value.is_null() {
            return Ok(None);
        }
        let raw = value.as_str().ok_or_else(|| {
            format!("metadata `{key}` must be a string when used as {field_label}")
        })?;
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }
        if normalize_as_url {
            return normalize_compat_base_url(trimmed).map(Some);
        }
        return Ok(Some(trimmed.to_string()));
    }
    Ok(None)
}

fn resolve_patch_field(
    patch: &serde_json::Map<String, Value>,
    candidates: &[&str],
    normalize_as_url: bool,
    field_label: &str,
) -> OAuthResult<(MetadataPatchField, Option<String>)> {
    for key in candidates {
        let Some(value) = patch.get(*key) else {
            continue;
        };
        if value.is_null() {
            return Ok((MetadataPatchField::Clear, None));
        }
        let raw = value.as_str().ok_or_else(|| {
            format!("metadata `{key}` must be a string when used as {field_label}")
        })?;
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Ok((MetadataPatchField::Clear, None));
        }
        if normalize_as_url {
            return Ok((
                MetadataPatchField::Set,
                Some(normalize_compat_base_url(trimmed)?),
            ));
        }
        return Ok((MetadataPatchField::Set, Some(trimmed.to_string())));
    }
    Ok((MetadataPatchField::Keep, None))
}

fn resolve_compat_base_url_from_metadata(
    metadata: &serde_json::Map<String, Value>,
) -> Option<String> {
    for key in OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES {
        let Some(value) = metadata.get(*key) else {
            continue;
        };
        let Some(raw) = value.as_str() else {
            continue;
        };
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(normalized) = normalize_compat_base_url(trimmed) {
            return Some(normalized);
        }
    }
    None
}

fn metadata_object_from_candidates<'a>(
    metadata: &'a serde_json::Map<String, Value>,
    candidates: &[&str],
) -> Option<&'a serde_json::Map<String, Value>> {
    candidates
        .iter()
        .find_map(|key| metadata.get(*key).and_then(Value::as_object))
}

fn metadata_array_from_candidates<'a>(
    metadata: &'a serde_json::Map<String, Value>,
    candidates: &[&str],
) -> Option<&'a Vec<Value>> {
    candidates
        .iter()
        .find_map(|key| metadata.get(*key).and_then(Value::as_array))
}

fn metadata_string_from_candidates(
    metadata: &serde_json::Map<String, Value>,
    candidates: &[&str],
) -> Option<String> {
    candidates.iter().find_map(|key| {
        metadata
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn metadata_bool_from_candidates(
    metadata: &serde_json::Map<String, Value>,
    candidates: &[&str],
) -> Option<bool> {
    candidates
        .iter()
        .find_map(|key| metadata.get(*key).and_then(Value::as_bool))
}

fn metadata_u64_from_candidates(
    metadata: &serde_json::Map<String, Value>,
    candidates: &[&str],
) -> Option<u64> {
    candidates
        .iter()
        .find_map(|key| metadata.get(*key).and_then(Value::as_u64))
}

fn normalize_optional_metadata_text(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn route_config_object_from_metadata(
    metadata: &serde_json::Map<String, Value>,
) -> serde_json::Map<String, Value> {
    metadata_object_from_candidates(metadata, OAUTH_ACCOUNT_ROUTE_CONFIG_METADATA_CANDIDATES)
        .cloned()
        .unwrap_or_default()
}

fn routing_state_object_from_metadata(
    metadata: &serde_json::Map<String, Value>,
) -> serde_json::Map<String, Value> {
    metadata_object_from_candidates(metadata, OAUTH_ACCOUNT_ROUTING_STATE_METADATA_CANDIDATES)
        .cloned()
        .unwrap_or_default()
}

fn oauth_account_route_config_from_metadata_value(
    metadata: &Value,
) -> Option<OAuthAccountRouteConfig> {
    let object = metadata.as_object()?;
    let route_object = route_config_object_from_metadata(object);
    let compat_base_url = route_object
        .get("compatBaseUrl")
        .and_then(Value::as_str)
        .or_else(|| route_object.get("compat_base_url").and_then(Value::as_str))
        .and_then(|raw| normalize_compat_base_url(raw).ok())
        .or_else(|| resolve_compat_base_url_from_metadata(object));
    let proxy_id = normalize_optional_metadata_text(
        route_object
            .get("proxyId")
            .and_then(Value::as_str)
            .or_else(|| route_object.get("proxy_id").and_then(Value::as_str))
            .map(ToOwned::to_owned),
    );
    let priority = route_object
        .get("priority")
        .and_then(Value::as_i64)
        .and_then(|value| i32::try_from(value).ok());
    let concurrency_limit = route_object
        .get("concurrencyLimit")
        .and_then(Value::as_i64)
        .or_else(|| route_object.get("concurrency_limit").and_then(Value::as_i64))
        .and_then(|value| i32::try_from(value).ok());
    let schedulable = route_object
        .get("schedulable")
        .and_then(Value::as_bool);

    if compat_base_url.is_none()
        && proxy_id.is_none()
        && priority.is_none()
        && concurrency_limit.is_none()
        && schedulable.is_none()
    {
        return None;
    }

    Some(OAuthAccountRouteConfig {
        compat_base_url,
        proxy_id,
        priority,
        concurrency_limit,
        schedulable,
    })
}

fn oauth_account_routing_state_from_metadata_value(
    metadata: &Value,
) -> Option<OAuthAccountRoutingState> {
    let object = metadata.as_object()?;
    let routing_object = routing_state_object_from_metadata(object);
    let credential_ready = routing_object
        .get("credentialReady")
        .and_then(Value::as_bool)
        .or_else(|| routing_object.get("credential_ready").and_then(Value::as_bool))
        .or_else(|| {
            metadata_bool_from_candidates(
                object,
                OAUTH_ACCOUNT_ROUTING_CREDENTIAL_READY_METADATA_CANDIDATES,
            )
        });
    let last_routing_error = normalize_optional_metadata_text(
        routing_object
            .get("lastRoutingError")
            .and_then(Value::as_str)
            .or_else(|| routing_object.get("last_routing_error").and_then(Value::as_str))
            .map(ToOwned::to_owned)
            .or_else(|| {
                metadata_string_from_candidates(
                    object,
                    OAUTH_ACCOUNT_ROUTING_LAST_ERROR_METADATA_CANDIDATES,
                )
            }),
    );
    let rate_limited_until = routing_object
        .get("rateLimitedUntil")
        .and_then(Value::as_u64)
        .or_else(|| routing_object.get("rate_limited_until").and_then(Value::as_u64))
        .or_else(|| {
            metadata_u64_from_candidates(
                object,
                OAUTH_ACCOUNT_ROUTING_RATE_LIMITED_UNTIL_METADATA_CANDIDATES,
            )
        });
    let overloaded_until = routing_object
        .get("overloadedUntil")
        .and_then(Value::as_u64)
        .or_else(|| routing_object.get("overloaded_until").and_then(Value::as_u64))
        .or_else(|| {
            metadata_u64_from_candidates(
                object,
                OAUTH_ACCOUNT_ROUTING_OVERLOADED_UNTIL_METADATA_CANDIDATES,
            )
        });
    let temp_unschedulable_until = routing_object
        .get("tempUnschedulableUntil")
        .and_then(Value::as_u64)
        .or_else(|| {
            routing_object
                .get("temp_unschedulable_until")
                .and_then(Value::as_u64)
        })
        .or_else(|| {
            metadata_u64_from_candidates(
                object,
                OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_UNTIL_METADATA_CANDIDATES,
            )
        });
    let temp_unschedulable_reason = normalize_optional_metadata_text(
        routing_object
            .get("tempUnschedulableReason")
            .and_then(Value::as_str)
            .or_else(|| {
                routing_object
                    .get("temp_unschedulable_reason")
                    .and_then(Value::as_str)
            })
            .map(ToOwned::to_owned)
            .or_else(|| {
                metadata_string_from_candidates(
                    object,
                    OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_REASON_METADATA_CANDIDATES,
                )
            }),
    );

    if credential_ready.is_none()
        && last_routing_error.is_none()
        && rate_limited_until.is_none()
        && overloaded_until.is_none()
        && temp_unschedulable_until.is_none()
        && temp_unschedulable_reason.is_none()
    {
        return None;
    }

    Some(OAuthAccountRoutingState {
        credential_ready,
        last_routing_error,
        rate_limited_until,
        overloaded_until,
        temp_unschedulable_until,
        temp_unschedulable_reason,
    })
}

fn oauth_account_chatgpt_workspace_from_metadata_value(
    value: &Value,
) -> Option<OAuthAccountChatgptWorkspace> {
    let object = value.as_object()?;
    let workspace_id = normalize_optional_metadata_text(
        object
            .get("workspaceId")
            .and_then(Value::as_str)
            .or_else(|| object.get("workspace_id").and_then(Value::as_str))
            .or_else(|| object.get("organizationId").and_then(Value::as_str))
            .or_else(|| object.get("organization_id").and_then(Value::as_str))
            .or_else(|| object.get("id").and_then(Value::as_str))
            .map(ToOwned::to_owned),
    )?;
    let title = normalize_optional_metadata_text(
        object
            .get("title")
            .and_then(Value::as_str)
            .or_else(|| object.get("name").and_then(Value::as_str))
            .map(ToOwned::to_owned),
    );
    let role = normalize_optional_metadata_text(
        object
            .get("role")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
    );
    let is_default = object
        .get("isDefault")
        .and_then(Value::as_bool)
        .or_else(|| object.get("is_default").and_then(Value::as_bool))
        .or_else(|| object.get("default").and_then(Value::as_bool))
        .unwrap_or(false);

    Some(OAuthAccountChatgptWorkspace {
        workspace_id,
        title,
        role,
        is_default,
    })
}

fn oauth_account_chatgpt_workspaces_from_metadata_value(
    metadata: &Value,
) -> Option<(Vec<OAuthAccountChatgptWorkspace>, Option<String>)> {
    let object = metadata.as_object()?;
    let workspace_values =
        metadata_array_from_candidates(object, OAUTH_ACCOUNT_CHATGPT_WORKSPACES_METADATA_CANDIDATES)?;
    let mut workspaces = workspace_values
        .iter()
        .filter_map(oauth_account_chatgpt_workspace_from_metadata_value)
        .collect::<Vec<_>>();
    if workspaces.is_empty() {
        return None;
    }

    let default_workspace_id = metadata_string_from_candidates(
        object,
        OAUTH_ACCOUNT_DEFAULT_CHATGPT_WORKSPACE_ID_METADATA_CANDIDATES,
    )
    .or_else(|| {
        workspaces
            .iter()
            .find(|workspace| workspace.is_default)
            .map(|workspace| workspace.workspace_id.clone())
    });

    if let Some(default_workspace_id) = default_workspace_id.as_deref() {
        for workspace in &mut workspaces {
            if workspace.workspace_id == default_workspace_id {
                workspace.is_default = true;
            }
        }
    }

    Some((workspaces, default_workspace_id))
}

fn normalize_compat_base_url(raw: &str) -> OAuthResult<String> {
    let parsed = reqwest::Url::parse(raw)
        .map_err(|error| format!("metadata compat base URL is invalid: {error}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("metadata compat base URL must use http or https scheme".to_string());
    }
    Ok(raw.trim_end_matches('/').to_string())
}

fn normalize_metadata(value: Value) -> Value {
    if value.is_object() {
        value
    } else {
        json!({})
    }
}

fn parse_metadata(raw: String) -> Value {
    serde_json::from_str::<Value>(raw.as_str())
        .ok()
        .filter(Value::is_object)
        .unwrap_or_else(|| json!({}))
}

fn normalize_account_status(value: Option<&str>) -> OAuthResult<String> {
    let Some(raw) = value else {
        return Ok(STATUS_ENABLED.to_string());
    };
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Ok(STATUS_ENABLED.to_string());
    }
    if matches!(
        normalized.as_str(),
        STATUS_ENABLED | STATUS_DISABLED | STATUS_FORBIDDEN | STATUS_VALIDATION_BLOCKED
    ) {
        return Ok(normalized);
    }
    Err(format!(
        "Unsupported account status `{raw}`. Expected one of: enabled, disabled, forbidden, validation_blocked."
    ))
}

fn normalize_strategy(value: Option<&str>) -> OAuthResult<String> {
    let Some(raw) = value else {
        return Ok(STRATEGY_ROUND_ROBIN.to_string());
    };
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Ok(STRATEGY_ROUND_ROBIN.to_string());
    }
    if matches!(normalized.as_str(), STRATEGY_ROUND_ROBIN | STRATEGY_P2C) {
        return Ok(normalized);
    }
    Err(format!(
        "Unsupported pool strategy `{raw}`. Expected one of: round_robin, p2c."
    ))
}

fn normalize_sticky_mode(value: Option<&str>) -> OAuthResult<String> {
    let Some(raw) = value else {
        return Ok(STICKY_CACHE_FIRST.to_string());
    };
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Ok(STICKY_CACHE_FIRST.to_string());
    }
    if matches!(
        normalized.as_str(),
        STICKY_CACHE_FIRST | STICKY_BALANCE | STICKY_PERFORMANCE_FIRST
    ) {
        return Ok(normalized);
    }
    Err(format!(
        "Unsupported sticky mode `{raw}`. Expected one of: cache_first, balance, performance_first."
    ))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum OAuthAccountStatusTransition {
    DisabledInvalidGrant,
    ValidationBlockedPolicy,
    ForbiddenUpstreamRestriction,
}

fn contains_any_substring(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(*needle))
}

fn resolve_oauth_account_status_transition(
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> Option<OAuthAccountStatusTransition> {
    let code = error_code
        .map(|entry| entry.trim().to_ascii_lowercase())
        .unwrap_or_default();
    let message = error_message
        .map(|entry| entry.to_ascii_lowercase())
        .unwrap_or_default();

    if code == "invalid_grant" || message.contains("invalid_grant") {
        return Some(OAuthAccountStatusTransition::DisabledInvalidGrant);
    }

    if matches!(
        code.as_str(),
        "policy_violation"
            | "content_policy_violation"
            | "safety_violation"
            | "terms_violation"
            | "abuse_detected"
            | "validation_required"
            | "captcha_required"
            | "recaptcha_required"
            | "challenge_required"
            | "security_check_required"
            | "risk_control"
            | "risk_detected"
    ) || contains_any_substring(
        message.as_str(),
        &[
            "policy violation",
            "content policy",
            "safety violation",
            "terms violation",
            "abuse",
            "validation required",
            "verification required",
            "verify your identity",
            "captcha",
            "recaptcha",
            "challenge required",
            "risk control",
            "risk detected",
            "suspicious activity",
            "unusual activity",
            "security check",
            "security verification",
            "风控",
            "风险控制",
            "高风险",
            "需要验证",
            "验证码",
            "可疑活动",
            "异常活动",
            "安全校验",
            "安全验证",
        ],
    ) {
        return Some(OAuthAccountStatusTransition::ValidationBlockedPolicy);
    }

    if matches!(
        code.as_str(),
        "account_suspended"
            | "account_deactivated"
            | "organization_deactivated"
            | "forbidden"
            | "access_denied"
            | "permission_denied"
            | "insufficient_permissions"
            | "account_banned"
            | "account_frozen"
            | "service_banned"
            | "permanently_blocked"
    ) || contains_any_substring(
        message.as_str(),
        &[
            "account suspended",
            "account has been suspended",
            "account deactivated",
            "organization is deactivated",
            "access denied",
            "forbidden",
            "permission denied",
            "insufficient permissions",
            "http 403",
            "status code 403",
            "403 forbidden",
            "account frozen",
            "account banned",
            "service banned",
            "permanently blocked",
            "封禁",
            "冻结",
            "停用",
            "禁用",
            "已被封",
        ],
    ) {
        return Some(OAuthAccountStatusTransition::ForbiddenUpstreamRestriction);
    }

    None
}
