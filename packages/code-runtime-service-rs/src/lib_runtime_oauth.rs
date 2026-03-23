async fn health_handler() -> impl IntoResponse {
    Json(json!({
        "app": "code-runtime-service-rs",
        "status": "ok"
    }))
}

async fn ready_handler(State(ctx): State<AppContext>) -> impl IntoResponse {
    let checks = evaluate_readiness_checks(&ctx.config);
    let (oauth_pool, oauth_pool_diagnostics_error) = match ctx.oauth_pool.diagnostics() {
        Ok(diagnostics) => (Some(diagnostics), None),
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to collect oauth pool diagnostics for readiness"
            );
            (None, Some(error))
        }
    };
    let oauth_pool_error = merge_optional_errors(
        ctx.oauth_pool_bootstrap_error.as_deref(),
        oauth_pool_diagnostics_error.as_deref(),
    );
    let ready = checks.default_model_valid && checks.default_provider_ready;
    let message = if ready {
        None
    } else {
        let mut reasons = Vec::new();
        if !checks.default_model_valid {
            reasons.push("CODE_RUNTIME_SERVICE_DEFAULT_MODEL is empty");
        }
        if !checks.default_provider_ready {
            reasons.push("Default model provider is not fully configured");
        }
        Some(reasons.join("; "))
    };
    let status = if ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    let observability =
        build_runtime_observability_snapshot(
            &ctx,
            crate::distributed_runtime::RuntimeObservabilityScope::Full,
            crate::distributed_runtime::RuntimeTaskCounterMode::Compute,
        )
        .await;
    let runtime_diagnostics = observability.runtime_diagnostics;
    let distributed = observability.distributed;

    (
        status,
        Json(ReadinessResponse {
            app: "code-runtime-service-rs",
            status: if ready { "ready" } else { "not-ready" },
            checks,
            runtime_diagnostics,
            distributed,
            oauth_pool,
            oauth_pool_error,
            message,
        }),
    )
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

fn parse_jwt_payload_without_verification(token: &str) -> Option<Value> {
    let payload_segment = token.split('.').nth(1)?;
    let decoded = decode_jwt_base64_segment(payload_segment)?;
    serde_json::from_slice(decoded.as_slice()).ok()
}

fn parse_optional_non_empty_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

fn parse_json_number_as_f64(value: Option<&Value>) -> Option<f64> {
    match value {
        Some(Value::Number(number)) => number.as_f64(),
        Some(Value::String(raw)) => raw.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn parse_chatgpt_usage_window_snapshot(
    window: Option<&Value>,
    observed_at_ms: u64,
) -> Option<Value> {
    let window = window?.as_object()?;
    let used_percent = parse_json_number_as_f64(
        window
            .get("used_percent")
            .or_else(|| window.get("usedPercent")),
    );
    let duration_seconds = parse_json_number_as_f64(
        window
            .get("limit_window_seconds")
            .or_else(|| window.get("limitWindowSeconds")),
    );
    let reset_after_seconds = parse_json_number_as_f64(
        window
            .get("reset_after_seconds")
            .or_else(|| window.get("resetAfterSeconds")),
    );
    let reset_at_raw =
        parse_json_number_as_f64(window.get("reset_at").or_else(|| window.get("resetAt")));

    let mut normalized = serde_json::Map::new();
    if let Some(value) = used_percent.filter(|value| value.is_finite() && *value >= 0.0) {
        normalized.insert("usedPercent".to_string(), json!(value));
    }
    if let Some(seconds) = duration_seconds.filter(|value| value.is_finite() && *value > 0.0) {
        normalized.insert("windowDurationMins".to_string(), json!(seconds / 60.0));
    }

    let resets_at = reset_after_seconds
        .filter(|value| value.is_finite() && *value >= 0.0)
        .map(|seconds| observed_at_ms.saturating_add((seconds * 1000.0).round() as u64))
        .or_else(|| {
            reset_at_raw
                .filter(|value| value.is_finite() && *value > 0.0)
                .map(|value| {
                    // WHAM payloads can return epoch seconds or epoch milliseconds.
                    if value >= 1_000_000_000_000.0 {
                        value.round() as u64
                    } else {
                        (value * 1000.0).round() as u64
                    }
                })
        });
    if let Some(resets_at) = resets_at {
        normalized.insert("resetsAt".to_string(), json!(resets_at));
    }

    if normalized.is_empty() {
        return None;
    }
    Some(Value::Object(normalized))
}

fn parse_chatgpt_usage_credits_snapshot(credits: Option<&Value>) -> Option<Value> {
    let credits = credits?.as_object()?;
    let mut normalized = serde_json::Map::new();
    if let Some(has_credits) = credits
        .get("has_credits")
        .or_else(|| credits.get("hasCredits"))
        .and_then(Value::as_bool)
    {
        normalized.insert("hasCredits".to_string(), Value::Bool(has_credits));
    }
    if let Some(unlimited) = credits.get("unlimited").and_then(Value::as_bool) {
        normalized.insert("unlimited".to_string(), Value::Bool(unlimited));
    }
    if let Some(balance) = credits
        .get("balance")
        .and_then(|value| match value {
            Value::String(entry) => Some(entry.trim().to_string()),
            Value::Number(entry) => Some(entry.to_string()),
            _ => None,
        })
        .filter(|value| !value.is_empty())
    {
        normalized.insert("balance".to_string(), Value::String(balance));
    }

    if normalized.is_empty() {
        return None;
    }
    Some(Value::Object(normalized))
}

fn build_rate_limits_snapshot_from_chatgpt_usage_payload(
    payload: &Value,
    observed_at_ms: u64,
) -> Option<Value> {
    let object = payload.as_object()?;
    let rate_limit = object.get("rate_limit").and_then(Value::as_object);
    let primary = parse_chatgpt_usage_window_snapshot(
        rate_limit.and_then(|entry| entry.get("primary_window")),
        observed_at_ms,
    );
    let secondary = parse_chatgpt_usage_window_snapshot(
        rate_limit.and_then(|entry| entry.get("secondary_window")),
        observed_at_ms,
    );
    let credits = parse_chatgpt_usage_credits_snapshot(object.get("credits"));
    let plan_type = parse_optional_non_empty_string(
        object
            .get("plan_type")
            .or_else(|| object.get("planType"))
            .or_else(|| object.get("plan")),
    );

    if primary.is_none() && secondary.is_none() && credits.is_none() && plan_type.is_none() {
        return None;
    }

    let mut normalized = serde_json::Map::new();
    if let Some(primary) = primary {
        normalized.insert("primary".to_string(), primary);
    }
    if let Some(secondary) = secondary {
        normalized.insert("secondary".to_string(), secondary);
    }
    if let Some(credits) = credits {
        normalized.insert("credits".to_string(), credits);
    }
    if let Some(plan_type) = plan_type {
        normalized.insert("planType".to_string(), Value::String(plan_type));
    }
    Some(Value::Object(normalized))
}

fn parse_json_u64(value: Option<&Value>) -> Option<u64> {
    match value {
        Some(Value::Number(number)) => number.as_u64(),
        Some(Value::String(raw)) => raw.trim().parse::<u64>().ok(),
        _ => None,
    }
}

fn extract_usage_checked_at_ms(metadata: &Value) -> Option<u64> {
    let object = metadata.as_object()?;
    parse_json_u64(
        object
            .get("usageCheckedAt")
            .or_else(|| object.get("usage_checked_at")),
    )
}

const CHATGPT_ACCOUNT_ID_METADATA_KEYS: &[&str] = &[
    "chatgptAccountId",
    "chatgpt_account_id",
    "workspaceId",
    "workspace_id",
    "externalAccountId",
    "external_account_id",
];

const CHATGPT_PLAN_TYPE_METADATA_KEYS: &[&str] = &[
    "chatgptPlanType",
    "chatgpt_plan_type",
    "planType",
    "plan_type",
    "plan",
    "tier",
];

const CHATGPT_ACCOUNT_PROFILE_NAME_METADATA_KEYS: &[&str] = &[
    "workspaceTitle",
    "workspace_title",
    "accountName",
    "account_name",
    "organizationName",
    "organization_name",
    "workspaceName",
    "workspace_name",
];

#[derive(Clone, Debug)]
pub(crate) struct ChatgptAuthTokensRefreshRpcResponse {
    pub access_token: String,
    pub chatgpt_account_id: String,
    pub chatgpt_plan_type: Option<String>,
    pub source_account_id: String,
}

fn read_account_metadata_string(metadata: &Value, keys: &[&str]) -> Option<String> {
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

fn normalize_optional_text(input: Option<&str>) -> Option<String> {
    input
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn parse_chatgpt_account_profile_record_field(
    record: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    keys.iter().find_map(|key| {
        record
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn collect_chatgpt_account_profile_records(payload: &Value) -> Vec<Value> {
    let mut records = Vec::new();

    if let Some(accounts_value) = payload.get("accounts") {
        if let Some(array) = accounts_value.as_array() {
            for item in array {
                if item.is_object() {
                    records.push(item.clone());
                }
            }
        } else if let Some(object) = accounts_value.as_object() {
            for value in object.values() {
                if value.is_object() {
                    records.push(value.clone());
                }
            }
        }
    }

    if records.is_empty() {
        if let Some(array) = payload.as_array() {
            for item in array {
                if item.is_object() {
                    records.push(item.clone());
                }
            }
        }
    }

    records
}

fn parse_chatgpt_account_profile_from_payload(
    payload: &Value,
    account: &oauth_pool::OAuthAccountSummary,
) -> Option<(String, Option<String>)> {
    let records = collect_chatgpt_account_profile_records(payload);
    if records.is_empty() {
        return None;
    }

    let ordering_first_id = payload
        .get("account_ordering")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            payload
                .get("default_account_id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        });
    let expected_account_id = normalize_optional_text(
        account
            .external_account_id
            .as_deref()
            .or_else(|| account.default_chatgpt_workspace_id.as_deref()),
    )
    .or_else(|| read_account_metadata_string(&account.metadata, CHATGPT_ACCOUNT_ID_METADATA_KEYS));

    let mut selected_record: Option<Value> = None;

    if let Some(expected_id) = expected_account_id.as_deref() {
        selected_record = records
            .iter()
            .find(|item| {
                let Some(record) = item.as_object() else {
                    return false;
                };
                let candidate_id = parse_chatgpt_account_profile_record_field(
                    record,
                    &["id", "account_id", "chatgpt_account_id", "workspace_id"],
                );
                candidate_id.as_deref() == Some(expected_id)
            })
            .cloned();
    }

    if selected_record.is_none() {
        if let Some(ordering_id) = ordering_first_id.as_deref() {
            selected_record = records
                .iter()
                .find(|item| {
                    let Some(record) = item.as_object() else {
                        return false;
                    };
                    let candidate_id = parse_chatgpt_account_profile_record_field(
                        record,
                        &["id", "account_id", "chatgpt_account_id", "workspace_id"],
                    );
                    candidate_id.as_deref() == Some(ordering_id)
                })
                .cloned();
        }
    }

    let selected = selected_record.unwrap_or_else(|| records[0].clone());
    let record = selected.as_object()?;
    let account_name = parse_chatgpt_account_profile_record_field(
        record,
        &[
            "name",
            "display_name",
            "account_name",
            "organization_name",
            "workspace_name",
            "title",
        ],
    )?;
    let account_structure = parse_chatgpt_account_profile_record_field(
        record,
        &[
            "structure",
            "account_structure",
            "kind",
            "type",
            "account_type",
        ],
    );
    Some((account_name, account_structure))
}

fn codex_account_profile_name(account: &oauth_pool::OAuthAccountSummary) -> Option<String> {
    read_account_metadata_string(&account.metadata, CHATGPT_ACCOUNT_PROFILE_NAME_METADATA_KEYS)
}

fn codex_account_is_chatgpt_backed(account: &oauth_pool::OAuthAccountSummary) -> bool {
    let auth_mode = extract_oauth_auth_mode_from_metadata(&account.metadata)
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if auth_mode == "chatgpt" {
        return true;
    }
    extract_oauth_credential_source_from_metadata(&account.metadata)
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .contains("access_token")
}

async fn refresh_codex_account_profile_for_account(
    ctx: &AppContext,
    account: &oauth_pool::OAuthAccountSummary,
) -> Result<bool, String> {
    if account.provider != "codex"
        || account.status != "enabled"
        || codex_account_profile_name(account).is_some()
        || !codex_account_is_chatgpt_backed(account)
    {
        return Ok(false);
    }

    let Some(credentials) = resolve_oauth_routing_credentials_from_account(ctx, account) else {
        return Ok(false);
    };

    let payload = provider_requests::query_chatgpt_codex_accounts_check(
        &ctx.client,
        &ctx.config,
        credentials.api_key.as_str(),
        credentials.external_account_id.as_deref(),
    )
    .await?;
    let Some((account_name, account_structure)) =
        parse_chatgpt_account_profile_from_payload(&payload, account)
    else {
        return Ok(false);
    };

    let mut metadata_patch = serde_json::Map::new();
    metadata_patch.insert(
        "workspaceTitle".to_string(),
        Value::String(account_name.clone()),
    );
    metadata_patch.insert(
        "workspace_title".to_string(),
        Value::String(account_name.clone()),
    );
    metadata_patch.insert("accountName".to_string(), Value::String(account_name.clone()));
    metadata_patch.insert("account_name".to_string(), Value::String(account_name.clone()));
    metadata_patch.insert(
        "organizationName".to_string(),
        Value::String(account_name.clone()),
    );
    metadata_patch.insert(
        "organization_name".to_string(),
        Value::String(account_name.clone()),
    );
    if let Some(account_structure) = account_structure {
        metadata_patch.insert(
            "accountStructure".to_string(),
            Value::String(account_structure.clone()),
        );
        metadata_patch.insert(
            "account_structure".to_string(),
            Value::String(account_structure.clone()),
        );
        metadata_patch.insert(
            "workspaceStructure".to_string(),
            Value::String(account_structure.clone()),
        );
        metadata_patch.insert(
            "workspace_structure".to_string(),
            Value::String(account_structure.clone()),
        );
        metadata_patch.insert(
            "organizationStructure".to_string(),
            Value::String(account_structure.clone()),
        );
        metadata_patch.insert(
            "organization_structure".to_string(),
            Value::String(account_structure),
        );
    }

    ctx.oauth_pool
        .upsert_account(OAuthAccountUpsertInput {
            account_id: account.account_id.clone(),
            provider: account.provider.clone(),
            external_account_id: account.external_account_id.clone(),
            email: account.email.clone(),
            display_name: account.display_name.clone(),
            status: Some(account.status.clone()),
            disabled_reason: account.disabled_reason.clone(),
            metadata: Some(Value::Object(metadata_patch)),
        })
        .map_err(|error| format!("persist codex account profile metadata: {}", error.message()))?;

    Ok(true)
}

fn resolve_chatgpt_account_id_for_refresh(
    account: &oauth_pool::OAuthAccountSummary,
    fallback_previous_account_id: Option<&str>,
    id_token_payload: Option<&Value>,
) -> Option<String> {
    read_account_metadata_string(&account.metadata, CHATGPT_ACCOUNT_ID_METADATA_KEYS)
        .or_else(|| {
            account
                .external_account_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            id_token_payload.and_then(|payload| {
                parse_optional_non_empty_string(
                    payload
                        .get("chatgpt_account_id")
                        .or_else(|| payload.get("chatgptAccountId"))
                        .or_else(|| payload.get("workspace_id"))
                        .or_else(|| payload.get("workspaceId")),
                )
            })
        })
        .or_else(|| normalize_optional_text(fallback_previous_account_id))
        .or_else(|| Some(account.account_id.trim().to_string()))
        .filter(|value| !value.trim().is_empty())
}

fn resolve_chatgpt_plan_type_for_refresh(
    account: &oauth_pool::OAuthAccountSummary,
    id_token_payload: Option<&Value>,
) -> Option<String> {
    read_account_metadata_string(&account.metadata, CHATGPT_PLAN_TYPE_METADATA_KEYS).or_else(|| {
        id_token_payload.and_then(|payload| {
            parse_optional_non_empty_string(
                payload
                    .get("chatgpt_plan_type")
                    .or_else(|| payload.get("chatgptPlanType"))
                    .or_else(|| payload.get("plan_type"))
                    .or_else(|| payload.get("planType"))
                    .or_else(|| payload.get("plan")),
            )
        })
    })
}

fn parse_chatgpt_workspace_membership_from_payload(
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

fn resolve_chatgpt_workspaces_for_refresh(
    id_token_payload: Option<&Value>,
) -> Option<(Vec<oauth_pool::OAuthAccountChatgptWorkspace>, Option<String>)> {
    let payload = id_token_payload?.as_object()?;
    let auth_claims = payload
        .get("https://api.openai.com/auth")
        .and_then(Value::as_object)?;
    let organizations = auth_claims
        .get("organizations")
        .or_else(|| auth_claims.get("workspaces"))
        .and_then(Value::as_array)?;
    let mut workspaces = organizations
        .iter()
        .filter_map(parse_chatgpt_workspace_membership_from_payload)
        .collect::<Vec<_>>();
    if workspaces.is_empty() {
        return None;
    }
    let default_workspace_id = workspaces
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
    if let Some(default_workspace_id) = default_workspace_id.as_deref() {
        for workspace in &mut workspaces {
            if workspace.workspace_id == default_workspace_id {
                workspace.is_default = true;
            }
        }
    }
    Some((workspaces, default_workspace_id))
}

fn account_supports_chatgpt_workspace_for_refresh(
    account: &oauth_pool::OAuthAccountSummary,
    workspace_id: Option<&str>,
) -> bool {
    let Some(workspace_id) = workspace_id.map(str::trim).filter(|entry| !entry.is_empty()) else {
        return true;
    };
    if account
        .default_chatgpt_workspace_id
        .as_deref()
        .is_some_and(|default_workspace_id| default_workspace_id == workspace_id)
    {
        return true;
    }
    account
        .chatgpt_workspaces
        .as_ref()
        .is_some_and(|workspaces| {
            workspaces
                .iter()
                .any(|workspace| workspace.workspace_id == workspace_id)
        })
}

fn account_matches_previous_account_id(
    account: &oauth_pool::OAuthAccountSummary,
    previous_account_id: &str,
) -> bool {
    let previous_account_id = previous_account_id.trim();
    if previous_account_id.is_empty() {
        return false;
    }
    if account.account_id == previous_account_id {
        return true;
    }
    if account
        .external_account_id
        .as_deref()
        .map(str::trim)
        .is_some_and(|external| external == previous_account_id)
    {
        return true;
    }
    resolve_chatgpt_account_id_for_refresh(account, None, None)
        .as_deref()
        .is_some_and(|candidate| candidate == previous_account_id)
}

fn prefer_active_codex_accounts(
    accounts: &[oauth_pool::OAuthAccountSummary],
) -> Vec<oauth_pool::OAuthAccountSummary> {
    let enabled = accounts
        .iter()
        .filter(|account| account.status == "enabled")
        .cloned()
        .collect::<Vec<_>>();
    if enabled.is_empty() {
        accounts.to_vec()
    } else {
        enabled
    }
}

fn pick_chatgpt_refresh_account(
    ctx: &AppContext,
    accounts: &[oauth_pool::OAuthAccountSummary],
    session_id: Option<&str>,
    previous_account_id: Option<&str>,
    workspace_id: Option<&str>,
) -> Option<oauth_pool::OAuthAccountSummary> {
    let active_accounts = prefer_active_codex_accounts(accounts);
    let workspace_filtered_accounts = active_accounts
        .iter()
        .filter(|account| account_supports_chatgpt_workspace_for_refresh(account, workspace_id))
        .cloned()
        .collect::<Vec<_>>();
    let candidate_accounts = if workspace_id
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        if !workspace_filtered_accounts.is_empty() {
            workspace_filtered_accounts
        } else {
            Vec::new()
        }
    } else {
        active_accounts.clone()
    };

    if candidate_accounts.is_empty() {
        return if workspace_id
            .map(str::trim)
            .is_some_and(|value| !value.is_empty())
        {
            None
        } else {
            active_accounts
                .into_iter()
                .next()
                .or_else(|| accounts.first().cloned())
        };
    }

    match ctx.oauth_pool.select_pool_account(OAuthPoolSelectionInput {
        pool_id: "pool-codex".to_string(),
        session_id: normalize_optional_text(session_id),
        workspace_id: normalize_optional_text(workspace_id),
        model_id: None,
    }) {
        Ok(Some(selection)) => {
            if let Some(matched) = candidate_accounts
                .iter()
                .find(|account| account.account_id == selection.account.account_id)
            {
                return Some(matched.clone());
            }
        }
        Ok(None) => {}
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to select codex oauth pool account for chatgpt auth token refresh"
            );
        }
    }

    if let Some(previous_account_id) = normalize_optional_text(previous_account_id) {
        if let Some(matched) = candidate_accounts.iter().find(|account| {
            account_matches_previous_account_id(account, previous_account_id.as_str())
        }) {
            return Some(matched.clone());
        }
    }

    candidate_accounts
        .into_iter()
        .next()
        .or_else(|| accounts.first().cloned())
}

pub(crate) async fn resolve_chatgpt_auth_tokens_refresh_response(
    ctx: &AppContext,
    session_id: Option<&str>,
    previous_account_id: Option<&str>,
    workspace_id: Option<&str>,
) -> Result<Option<ChatgptAuthTokensRefreshRpcResponse>, String> {
    if let Err(error) = sync_local_codex_cli_account(ctx.oauth_pool.as_ref()) {
        warn!(
            error = error.as_str(),
            "failed to sync local codex cli auth account before chatgpt auth token refresh"
        );
    }

    let accounts = ctx
        .oauth_pool
        .list_accounts(Some("codex"))
        .map_err(|error| format!("list codex oauth accounts for token refresh: {error}"))?;
    if accounts.is_empty() {
        return Ok(None);
    }

    let Some(account) =
        pick_chatgpt_refresh_account(ctx, &accounts, session_id, previous_account_id, workspace_id)
    else {
        return Ok(None);
    };

    let direct_access_token = ctx
        .oauth_pool
        .resolve_api_key_from_metadata(&account.metadata)
        .map_err(|error| format!("resolve codex oauth access token: {error}"))?;
    let local_cli_profile = resolve_local_codex_cli_profile_for_account(&account);
    let refresh_token = resolve_oauth_refresh_token_from_metadata(ctx.oauth_pool.as_ref(), &account.metadata)
        .or_else(|| {
            resolve_local_codex_cli_refresh_token_from_profile(
                &account,
                local_cli_profile.as_ref(),
            )
        });

    let mut access_token: Option<String> = None;
    let mut refreshed_refresh_token: Option<String> = None;
    let mut refreshed_id_token_payload: Option<Value> = None;
    if let Some(refresh_token) = refresh_token.as_deref() {
        let refreshed = refresh_codex_chatgpt_tokens(&ctx.client, refresh_token).await?;
        if let Some(id_token_payload) = refreshed
            .id_token
            .as_deref()
            .and_then(parse_jwt_payload_without_verification)
        {
            refreshed_id_token_payload = Some(id_token_payload);
        }
        access_token = refreshed
            .access_token
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(ToOwned::to_owned);
        refreshed_refresh_token = refreshed
            .refresh_token
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(ToOwned::to_owned);
    }

    if access_token.is_none() {
        access_token = direct_access_token;
    }

    let Some(access_token) = access_token else {
        return Ok(None);
    };
    let id_token_payload = refreshed_id_token_payload.as_ref();
    let chatgpt_account_id =
        resolve_chatgpt_account_id_for_refresh(&account, previous_account_id, id_token_payload);
    let Some(chatgpt_account_id) = chatgpt_account_id else {
        return Ok(None);
    };
    let chatgpt_plan_type = resolve_chatgpt_plan_type_for_refresh(&account, id_token_payload);
    let chatgpt_workspaces = resolve_chatgpt_workspaces_for_refresh(id_token_payload);

    let mut metadata_patch = serde_json::Map::new();
    metadata_patch.insert("apiKey".to_string(), Value::String(access_token.clone()));
    metadata_patch.insert(
        "credentialSource".to_string(),
        Value::String("access_token".to_string()),
    );
    metadata_patch.insert("authMode".to_string(), Value::String("chatgpt".to_string()));
    metadata_patch.insert(
        "chatgptAccountId".to_string(),
        Value::String(chatgpt_account_id.clone()),
    );
    if let Some(plan_type) = chatgpt_plan_type.as_deref() {
        metadata_patch.insert(
            "chatgptPlanType".to_string(),
            Value::String(plan_type.to_string()),
        );
        metadata_patch.insert("planType".to_string(), Value::String(plan_type.to_string()));
    }
    if let Some((workspaces, default_workspace_id)) = chatgpt_workspaces {
        metadata_patch.insert(
            "chatgptWorkspaces".to_string(),
            serde_json::to_value(workspaces).unwrap_or_else(|_| Value::Array(Vec::new())),
        );
        if let Some(default_workspace_id) = default_workspace_id {
            metadata_patch.insert(
                "defaultChatgptWorkspaceId".to_string(),
                Value::String(default_workspace_id),
            );
        }
    }
    if let Some(refresh_token) = refreshed_refresh_token.as_deref() {
        metadata_patch.insert(
            "refreshToken".to_string(),
            Value::String(refresh_token.to_string()),
        );
        metadata_patch.insert("refreshTokenAvailable".to_string(), Value::Bool(true));
    }

    if !metadata_patch.is_empty() {
        if let Err(error) = ctx.oauth_pool.upsert_account(OAuthAccountUpsertInput {
            account_id: account.account_id.clone(),
            provider: account.provider.clone(),
            external_account_id: account.external_account_id.clone(),
            email: account.email.clone(),
            display_name: account.display_name.clone(),
            status: Some(account.status.clone()),
            disabled_reason: account.disabled_reason.clone(),
            metadata: Some(Value::Object(metadata_patch)),
        }) {
            warn!(
                error = error.message(),
                account_id = account.account_id.as_str(),
                "failed to persist refreshed codex oauth chatgpt auth token metadata"
            );
        }
    }

    Ok(Some(ChatgptAuthTokensRefreshRpcResponse {
        access_token,
        chatgpt_account_id,
        chatgpt_plan_type,
        source_account_id: account.account_id,
    }))
}

fn is_service_codex_oauth_account(account: &oauth_pool::OAuthAccountSummary) -> bool {
    if account.provider != "codex" {
        return false;
    }
    account
        .metadata
        .as_object()
        .and_then(|entry| entry.get("source"))
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|source| source == SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ServiceCodexUsageRefreshMode {
    Auto,
    Force,
    Off,
}

fn should_refresh_service_codex_oauth_usage(
    account: &oauth_pool::OAuthAccountSummary,
    now: u64,
) -> bool {
    if !is_service_codex_oauth_account(account) {
        return false;
    }
    match extract_usage_checked_at_ms(&account.metadata) {
        Some(last_checked) => {
            now.saturating_sub(last_checked) >= SERVICE_CODEX_USAGE_STALE_AFTER_MS
        }
        None => true,
    }
}

fn usage_checked_at_sort_key(account: &oauth_pool::OAuthAccountSummary) -> u64 {
    extract_usage_checked_at_ms(&account.metadata).unwrap_or(0)
}

pub(crate) fn select_service_codex_usage_refresh_accounts(
    accounts: &[oauth_pool::OAuthAccountSummary],
    now: u64,
    mode: ServiceCodexUsageRefreshMode,
    attempt_by_account_ms: &mut HashMap<String, u64>,
) -> Vec<oauth_pool::OAuthAccountSummary> {
    let service_codex_account_ids = accounts
        .iter()
        .filter(|entry| is_service_codex_oauth_account(entry))
        .map(|entry| entry.account_id.clone())
        .collect::<HashSet<_>>();
    attempt_by_account_ms.retain(|account_id, _| service_codex_account_ids.contains(account_id));

    if mode == ServiceCodexUsageRefreshMode::Off {
        return Vec::new();
    }

    let mut eligible = accounts
        .iter()
        .filter(|entry| entry.status == "enabled")
        .filter(|entry| is_service_codex_oauth_account(entry))
        .filter(|entry| match mode {
            ServiceCodexUsageRefreshMode::Auto => {
                if !should_refresh_service_codex_oauth_usage(entry, now) {
                    return false;
                }
                let last_attempt = attempt_by_account_ms.get(entry.account_id.as_str()).copied();
                match last_attempt {
                    Some(last_attempt_ms) => {
                        now.saturating_sub(last_attempt_ms)
                            >= SERVICE_CODEX_USAGE_REFRESH_RETRY_BACKOFF_MS
                    }
                    None => true,
                }
            }
            ServiceCodexUsageRefreshMode::Force => true,
            ServiceCodexUsageRefreshMode::Off => false,
        })
        .cloned()
        .collect::<Vec<_>>();

    eligible.sort_by_key(usage_checked_at_sort_key);
    let limit = match mode {
        ServiceCodexUsageRefreshMode::Auto => 1,
        ServiceCodexUsageRefreshMode::Force => SERVICE_CODEX_USAGE_FORCE_REFRESH_MAX_ACCOUNTS,
        ServiceCodexUsageRefreshMode::Off => 0,
    };
    eligible.truncate(limit);
    for account in &eligible {
        attempt_by_account_ms.insert(account.account_id.clone(), now);
    }
    eligible
}

fn is_chatgpt_oauth_auth_error(error: &str) -> bool {
    let normalized = error.to_ascii_lowercase();
    normalized.contains(" 401")
        || normalized.contains("status 401")
        || normalized.contains("unauthorized")
        || normalized.contains("invalid token")
        || normalized.contains("invalid_token")
        || normalized.contains("invalid_grant")
}

fn resolve_oauth_refresh_token_from_metadata(
    oauth_pool: &OAuthPoolStore,
    metadata: &Value,
) -> Option<String> {
    match oauth_pool.resolve_refresh_token_from_metadata(metadata) {
        Ok(refresh_token) => refresh_token,
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to resolve oauth refresh token from account metadata"
            );
            None
        }
    }
}

async fn refresh_service_codex_oauth_usage_for_account(
    ctx: &AppContext,
    account: &oauth_pool::OAuthAccountSummary,
) -> Result<bool, String> {
    let credential_source = extract_oauth_credential_source_from_metadata(&account.metadata);
    let primary_access_token = if credential_source
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .is_some_and(|source| source.contains("access_token"))
    {
        ctx.oauth_pool
            .resolve_api_key_from_metadata(&account.metadata)
            .map_err(|error| format!("resolve codex oauth access token: {error}"))?
    } else {
        None
    };
    let refresh_token =
        resolve_oauth_refresh_token_from_metadata(ctx.oauth_pool.as_ref(), &account.metadata);

    let mut access_token = primary_access_token;
    let mut refreshed_refresh_token: Option<String> = None;
    let mut refreshed_api_credential: Option<String> = None;

    if access_token.is_none() {
        let Some(refresh_token) = refresh_token.as_deref() else {
            return Ok(false);
        };
        let refreshed = refresh_codex_chatgpt_tokens(&ctx.client, refresh_token).await?;
        let refreshed_access_token = refreshed
            .access_token
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .ok_or_else(|| {
                "Codex OAuth refresh token response did not include access_token.".to_string()
            })?
            .to_string();
        refreshed_refresh_token = refreshed
            .refresh_token
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(ToOwned::to_owned);
        refreshed_api_credential = Some(refreshed_access_token.clone());
        access_token = Some(refreshed_access_token);
    }

    let primary_access_token = access_token
        .as_deref()
        .ok_or_else(|| "Codex OAuth access token is unavailable.".to_string())?;
    let usage_payload = match provider_requests::query_chatgpt_codex_usage(
        &ctx.client,
        &ctx.config,
        primary_access_token,
        account.external_account_id.as_deref(),
    )
    .await
    {
        Ok(payload) => payload,
        Err(primary_error) => {
            let Some(refresh_token) = refresh_token.as_deref() else {
                return Err(primary_error);
            };
            if !is_chatgpt_oauth_auth_error(primary_error.as_str()) {
                return Err(primary_error);
            }
            let refreshed = refresh_codex_chatgpt_tokens(&ctx.client, refresh_token).await?;
            let refreshed_access_token = refreshed
                .access_token
                .as_deref()
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .ok_or_else(|| {
                    "Codex OAuth refresh token response did not include access_token.".to_string()
                })?
                .to_string();
            refreshed_refresh_token = refreshed
                .refresh_token
                .as_deref()
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned);
            refreshed_api_credential = Some(refreshed_access_token.clone());
            provider_requests::query_chatgpt_codex_usage(
                &ctx.client,
                &ctx.config,
                refreshed_access_token.as_str(),
                account.external_account_id.as_deref(),
            )
            .await
            .map_err(|retry_error| {
                format!("{primary_error} (refreshed ChatGPT usage request failed: {retry_error})")
            })?
        }
    };

    let observed_at_ms = now_ms();
    let mut metadata_patch = serde_json::Map::new();
    if let Some(rate_limits) =
        build_rate_limits_snapshot_from_chatgpt_usage_payload(&usage_payload, observed_at_ms)
    {
        metadata_patch.insert("rateLimits".to_string(), rate_limits.clone());
        metadata_patch.insert("rate_limits".to_string(), rate_limits);
    }
    metadata_patch.insert("usageCheckedAt".to_string(), json!(observed_at_ms));
    if let Some(plan_type) = parse_optional_non_empty_string(
        usage_payload
            .get("plan_type")
            .or_else(|| usage_payload.get("planType"))
            .or_else(|| usage_payload.get("plan")),
    ) {
        metadata_patch.insert("planType".to_string(), Value::String(plan_type));
    }
    if let Some(api_credential) = refreshed_api_credential.as_deref() {
        metadata_patch.insert(
            "apiKey".to_string(),
            Value::String(api_credential.to_string()),
        );
    }
    if let Some(refresh_token) = refreshed_refresh_token {
        metadata_patch.insert("refreshToken".to_string(), Value::String(refresh_token));
        metadata_patch.insert("refreshTokenAvailable".to_string(), Value::Bool(true));
    }
    if refreshed_api_credential.is_some() {
        metadata_patch.insert(
            "credentialSource".to_string(),
            Value::String("access_token".to_string()),
        );
        metadata_patch.insert("authMode".to_string(), Value::String("chatgpt".to_string()));
    }

    if metadata_patch.is_empty() {
        return Ok(false);
    }

    ctx.oauth_pool
        .upsert_account(OAuthAccountUpsertInput {
            account_id: account.account_id.clone(),
            provider: account.provider.clone(),
            external_account_id: account.external_account_id.clone(),
            email: account.email.clone(),
            display_name: account.display_name.clone(),
            status: Some(account.status.clone()),
            disabled_reason: account.disabled_reason.clone(),
            metadata: Some(Value::Object(metadata_patch)),
        })
        .map_err(|error| {
            format!(
                "upsert codex oauth account usage metadata: {}",
                error.message()
            )
        })?;

    Ok(true)
}

#[derive(Debug, Deserialize)]
struct CodexApiKeyExchangeResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct CodexRefreshTokenResponse {
    #[serde(default)]
    id_token: Option<String>,
    #[serde(default)]
    access_token: Option<String>,
    #[serde(default)]
    refresh_token: Option<String>,
}

async fn exchange_codex_openai_api_key(
    client: &reqwest::Client,
    id_token: &str,
) -> Result<String, String> {
    let response = client
        .post(format!("{}/oauth/token", resolve_codex_oauth_issuer()))
        .form(&[
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:token-exchange",
            ),
            ("client_id", CODEX_OAUTH_CLIENT_ID),
            ("requested_token", "openai-api-key"),
            ("subject_token", id_token),
            (
                "subject_token_type",
                "urn:ietf:params:oauth:token-type:id_token",
            ),
        ])
        .send()
        .await
        .map_err(|error| format!("Codex OAuth API key exchange failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| String::from("<response body unavailable>"));
        return Err(format!(
            "Codex OAuth API key exchange returned {status}: {}",
            body.trim()
        ));
    }
    let payload = response
        .json::<CodexApiKeyExchangeResponse>()
        .await
        .map_err(|error| format!("Parse Codex OAuth API key exchange response: {error}"))?;
    Ok(payload.access_token)
}

async fn refresh_codex_chatgpt_tokens(
    client: &reqwest::Client,
    refresh_token: &str,
) -> Result<CodexRefreshTokenResponse, String> {
    let refresh_token = refresh_token.trim();
    if refresh_token.is_empty() {
        return Err("Codex OAuth refresh token is empty".to_string());
    }
    let response = client
        .post(format!("{}/oauth/token", resolve_codex_oauth_issuer()))
        .header("Content-Type", "application/json")
        .json(&json!({
            "client_id": CODEX_OAUTH_CLIENT_ID,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": "openid profile email",
        }))
        .send()
        .await
        .map_err(|error| format!("Codex OAuth refresh token request failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| String::from("<response body unavailable>"));
        return Err(format!(
            "Codex OAuth refresh token request returned {status}: {}",
            body.trim()
        ));
    }
    response
        .json::<CodexRefreshTokenResponse>()
        .await
        .map_err(|error| format!("Parse Codex OAuth refresh token response: {error}"))
}

#[derive(Clone, Debug)]
struct OAuthLoginUpdatePayload<'a> {
    login_id: &'a str,
    success: bool,
    error: Option<&'a str>,
}

fn publish_workspace_oauth_runtime_updated_event(
    ctx: &AppContext,
    workspace_id: &str,
    reason: &str,
    oauth_login: Option<OAuthLoginUpdatePayload<'_>>,
) {
    let event_at_ms = now_ms();
    let mut payload = json!({
        "workspaceId": workspace_id,
    });
    if let (Some(login), Some(object)) = (oauth_login, payload.as_object_mut()) {
        object.insert(
            "oauthLoginId".to_string(),
            Value::String(login.login_id.to_string()),
        );
        object.insert("oauthLoginSuccess".to_string(), Value::Bool(login.success));
        if let Some(error) = login.error {
            let trimmed = error.trim();
            if !trimmed.is_empty() {
                object.insert(
                    "oauthLoginError".to_string(),
                    Value::String(trimmed.to_string()),
                );
            }
        }
    }
    publish_runtime_updated_event_at(
        ctx,
        &["oauth", "models", "bootstrap"],
        reason,
        Some(payload),
        event_at_ms,
    );
}

fn initialize_oauth_pool(config: &ServiceConfig) -> (OAuthPoolStore, Option<String>) {
    initialize_oauth_pool_with_opener(config, OAuthPoolStore::open)
}

fn initialize_oauth_pool_with_opener<F>(
    config: &ServiceConfig,
    mut open_store: F,
) -> (OAuthPoolStore, Option<String>)
where
    F: FnMut(&str, Option<&str>) -> Result<OAuthPoolStore, String>,
{
    let oauth_secret_key = config.oauth_secret_key.as_deref();
    let mut bootstrap_errors = Vec::new();
    match open_store(config.oauth_pool_db_path.as_str(), oauth_secret_key) {
        Ok(store) => return (store, None),
        Err(primary_error) => {
            warn!(
                error = primary_error.as_str(),
                path = config.oauth_pool_db_path.as_str(),
                "oauth pool bootstrap failed; attempting in-memory fallback"
            );
            bootstrap_errors.push(format!(
                "Failed to initialize oauth pool store `{}`: {primary_error}.",
                config.oauth_pool_db_path
            ));
        }
    }

    match open_store(":memory:", oauth_secret_key) {
        Ok(store) => {
            bootstrap_errors.push("Falling back to in-memory oauth pool.".to_string());
            (store, Some(bootstrap_errors.join(" ")))
        }
        Err(fallback_with_secret_error) => {
            warn!(
                error = fallback_with_secret_error.as_str(),
                "oauth pool in-memory fallback with configured secret failed"
            );
            bootstrap_errors.push(format!(
                "In-memory oauth pool fallback with configured secret failed: {fallback_with_secret_error}."
            ));

            if oauth_secret_key.is_some() {
                match open_store(":memory:", None) {
                    Ok(store) => {
                        bootstrap_errors.push(
                            "Falling back to in-memory oauth pool without secret key; encrypted oauth account API keys are unavailable until CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is fixed."
                                .to_string(),
                        );
                        (store, Some(bootstrap_errors.join(" ")))
                    }
                    Err(fallback_without_secret_error) => {
                        bootstrap_errors.push(format!(
                            "In-memory oauth pool fallback without secret failed: {fallback_without_secret_error}."
                        ));
                        let combined_error = bootstrap_errors.join(" ");
                        warn!(
                            path = config.oauth_pool_db_path.as_str(),
                            error = combined_error.as_str(),
                            "oauth pool bootstrap exhausted all backends; starting fail-closed"
                        );
                        (
                            OAuthPoolStore::unavailable(combined_error.clone()),
                            Some(combined_error),
                        )
                    }
                }
            } else {
                let combined_error = bootstrap_errors.join(" ");
                warn!(
                    path = config.oauth_pool_db_path.as_str(),
                    error = combined_error.as_str(),
                    "oauth pool bootstrap exhausted all backends; starting fail-closed"
                );
                (
                    OAuthPoolStore::unavailable(combined_error.clone()),
                    Some(combined_error),
                )
            }
        }
    }
}

fn merge_optional_errors(first: Option<&str>, second: Option<&str>) -> Option<String> {
    match (first, second) {
        (None, None) => None,
        (Some(first), None) => Some(first.to_string()),
        (None, Some(second)) => Some(second.to_string()),
        (Some(first), Some(second)) => Some(format!("{first} | {second}")),
    }
}

#[cfg(test)]
mod oauth_runtime_updated_tests {
    use super::*;
    use crate::{
        build_app_context, create_initial_state, latest_runtime_state_fabric_event_frame,
        native_state_store, ServiceConfig, DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
        DEFAULT_AGENT_TASK_HISTORY_LIMIT, DEFAULT_ANTHROPIC_ENDPOINT,
        DEFAULT_ANTHROPIC_VERSION, DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
        DEFAULT_DISCOVERY_SERVICE_TYPE, DEFAULT_DISCOVERY_STALE_TTL_MS,
        DEFAULT_GEMINI_ENDPOINT, DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL,
        DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS, DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
        DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT, DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
        DEFAULT_OPENAI_MAX_RETRIES, DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS,
        DEFAULT_RUNTIME_WS_MAX_CONNECTIONS, DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES, DEFAULT_SANDBOX_NETWORK_ACCESS,
    };
    use std::sync::Arc;

    fn test_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.4".to_string(),
            openai_api_key: Some("test-openai-key".to_string()),
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
            anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
            gemini_api_key: None,
            gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
            openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
            openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
            openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
            openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
            live_skills_network_enabled: false,
            live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
            live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
            live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: ":memory:".to_string(),
            oauth_secret_key: None,
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: 1,
            distributed_worker_concurrency: 1,
            distributed_claim_idle_ms: 500,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "runtime-oauth-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extension_seeds: Vec::new(),
        }
    }

    fn test_context() -> AppContext {
        build_app_context(
            create_initial_state("gpt-5.4"),
            test_config(),
            Arc::new(native_state_store::NativeStateStore::from_env_or_default()),
        )
    }

    #[test]
    fn workspace_oauth_runtime_updated_event_uses_runtime_state_fabric_path() {
        let ctx = test_context();

        publish_workspace_oauth_runtime_updated_event(
            &ctx,
            "workspace-oauth",
            "oauth_login_failed",
            Some(OAuthLoginUpdatePayload {
                login_id: "login-100",
                success: false,
                error: Some("OAuth token exchange failed."),
            }),
        );

        assert!(
            ctx.runtime_update_last_event_at_ms.load(Ordering::Relaxed) > 0,
            "expected oauth runtime update to refresh last event timestamp"
        );
        let frame = latest_runtime_state_fabric_event_frame(&ctx).expect("latest state fabric event");
        let payload = serde_json::from_str::<Value>(frame.payload_json.as_ref())
            .expect("event payload")
            .get("payload")
            .cloned()
            .expect("payload object");
        assert_eq!(payload["workspaceId"], Value::String("workspace-oauth".to_string()));
        assert_eq!(payload["oauthLoginId"], Value::String("login-100".to_string()));
        assert_eq!(payload["oauthLoginSuccess"], Value::Bool(false));
    }
}
