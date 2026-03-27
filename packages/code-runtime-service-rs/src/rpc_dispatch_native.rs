use super::*;
use crate::native_state_store::{
    TABLE_NATIVE_REVIEW_COMMENTS, TABLE_NATIVE_SCHEDULES, TABLE_NATIVE_SETTINGS_KV,
    TABLE_NATIVE_THEMES, TABLE_NATIVE_TOOLS, TABLE_NATIVE_VOICE_CONFIG, TABLE_NATIVE_WATCHERS,
};
use crate::rpc_dispatch_native_schedules::{
    create_native_schedule, list_native_schedules, schedule_run_state_update, update_native_schedule,
};

pub(crate) async fn handle_native_rpc(
    ctx: &AppContext,
    method: &str,
    params: &Value,
) -> Result<Value, RpcError> {
    match method {
        "native_management_snapshot" => handle_native_management_snapshot(ctx).await,
        "native_review_comments_list" => list_native_review_comments(ctx, params).await,
        "native_review_comment_upsert" => upsert_native_review_comment(ctx, params).await,
        "native_review_comment_remove" => remove_native_review_comment(ctx, params).await,
        "native_review_comment_set_resolved" => {
            set_native_review_comment_resolved(ctx, params).await
        }
        "native_providers_snapshot" => native_providers_snapshot(ctx).await,
        "native_providers_connection_probe" => native_providers_connection_probe(ctx, params).await,
        "native_tools_list" => list_native_tools(ctx, params).await,
        "native_tool_policy_upsert" => {
            upsert_native_entity(
                ctx,
                params,
                TABLE_NATIVE_TOOLS,
                &["toolId", "id", "name"],
                "tool",
            )
            .await
        }
        "native_tool_set_enabled" => {
            set_native_entity_enabled(ctx, params, TABLE_NATIVE_TOOLS, &["toolId", "id"]).await
        }
        "native_tool_secret_upsert" => upsert_tool_secret(ctx, params).await,
        "native_tool_secret_remove" => remove_tool_secret(ctx, params).await,

        "native_themes_list" => list_native_entities(ctx, TABLE_NATIVE_THEMES).await,
        "native_theme_upsert" => {
            upsert_native_entity(
                ctx,
                params,
                TABLE_NATIVE_THEMES,
                &["themeId", "id", "name"],
                "theme",
            )
            .await
        }
        "native_theme_remove" => {
            remove_native_entity(ctx, params, TABLE_NATIVE_THEMES, &["themeId", "id"]).await
        }
        "native_theme_set_active" => set_active_theme(ctx, params).await,

        "native_schedules_list" => list_native_schedules(ctx).await,
        "native_schedule_create" => create_native_schedule(ctx, params).await,
        "native_schedule_update" => update_native_schedule(ctx, params).await,
        "native_schedule_delete" => {
            remove_native_entity(ctx, params, TABLE_NATIVE_SCHEDULES, &["scheduleId", "id"]).await
        }
        "native_schedule_run_now" => schedule_run_state_update(ctx, params, "running").await,
        "native_schedule_cancel_run" => schedule_run_state_update(ctx, params, "cancelled").await,

        "native_watchers_list" => list_native_entities(ctx, TABLE_NATIVE_WATCHERS).await,
        "native_watcher_create" => {
            upsert_native_entity(
                ctx,
                params,
                TABLE_NATIVE_WATCHERS,
                &["watcherId", "id", "name"],
                "watcher",
            )
            .await
        }
        "native_watcher_update" => {
            update_native_entity(
                ctx,
                params,
                TABLE_NATIVE_WATCHERS,
                &["watcherId", "id"],
                "watcher",
            )
            .await
        }
        "native_watcher_delete" => {
            remove_native_entity(ctx, params, TABLE_NATIVE_WATCHERS, &["watcherId", "id"]).await
        }
        "native_watcher_set_enabled" => {
            set_native_entity_enabled(ctx, params, TABLE_NATIVE_WATCHERS, &["watcherId", "id"])
                .await
        }

        "native_insights_summary" => native_insights_summary(ctx).await,
        "native_insights_timeseries" => {
            native_insights_cache_lookup(ctx, params, "timeseries").await
        }
        "native_insights_events" => native_insights_cache_lookup(ctx, params, "events").await,

        "native_server_status" => native_server_status(ctx).await,
        "native_server_config_get" => native_server_config_get(ctx).await,
        "native_server_config_set" => native_server_config_set(ctx, params).await,

        "native_settings_get" => native_settings_get(ctx).await,
        "native_settings_set" => native_settings_set(ctx, params).await,

        "native_voice_config_get" => native_voice_config_get(ctx).await,
        "native_voice_config_set" => native_voice_config_set(ctx, params).await,
        "native_voice_hotkey_set" => native_voice_hotkey_set(ctx, params).await,

        _ => Err(RpcError::method_not_found(method)),
    }
}

async fn handle_native_management_snapshot(ctx: &AppContext) -> Result<Value, RpcError> {
    let extensions =
        crate::rpc_dispatch_extensions::list_extension_catalog(ctx, None, true).await?;
    let plugins = extensions
        .iter()
        .filter(|entry| entry.kind == "host")
        .cloned()
        .collect::<Vec<_>>();
    let tools = list_native_tools(ctx, &json!({})).await?;
    let skills = extensions
        .into_iter()
        .filter(|entry| entry.kind == "instruction")
        .collect::<Vec<_>>();
    let themes = list_native_entities(ctx, TABLE_NATIVE_THEMES).await?;
    let schedules = list_native_schedules(ctx).await?;
    let watchers = list_native_entities(ctx, TABLE_NATIVE_WATCHERS).await?;
    let insights_summary = native_insights_summary(ctx).await?;
    let server_status = native_server_status(ctx).await?;
    let settings = native_settings_get(ctx).await?;
    let voice = native_voice_config_get(ctx).await?;

    Ok(json!({
        "plugins": plugins,
        "tools": tools,
        "skills": skills,
        "themes": themes,
        "schedules": schedules,
        "watchers": watchers,
        "insights": insights_summary,
        "server": server_status,
        "settings": settings,
        "voice": voice,
    }))
}

async fn native_providers_snapshot(ctx: &AppContext) -> Result<Value, RpcError> {
    let providers = build_providers_catalog(ctx).await;
    let accounts = ctx
        .oauth_pool
        .list_accounts(None)
        .map_err(RpcError::internal)?
        .into_iter()
        .map(redact_oauth_account_summary)
        .collect::<Vec<_>>();
    let pools = ctx
        .oauth_pool
        .list_pools(None)
        .map_err(RpcError::internal)?;
    let pool_members_by_pool_id = list_pool_members_by_pool_id(ctx, pools.as_slice())?;

    Ok(json!({
        "providers": providers,
        "accounts": accounts,
        "pools": pools,
        "poolMembersByPoolId": pool_members_by_pool_id,
    }))
}

async fn native_providers_connection_probe(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let started_at = Instant::now();
    let params = as_object(params)?;
    let provider = parse_optional_oauth_provider_from_fields(params, &["provider", "providerId"])?;
    let pool_id = read_optional_string(params, "poolId");
    let account_id = read_optional_string(params, "accountId");
    let session_id = read_optional_string(params, "sessionId");
    let model_id = read_optional_string(params, "modelId");

    if provider.is_none() && pool_id.is_none() && account_id.is_none() {
        return Err(RpcError::invalid_params(
            "Expected at least one probe hint: provider/providerId, poolId, or accountId.",
        ));
    }

    let accounts = ctx
        .oauth_pool
        .list_accounts(provider.as_deref())
        .map_err(RpcError::internal)?;
    let pools = ctx
        .oauth_pool
        .list_pools(provider.as_deref())
        .map_err(RpcError::internal)?;
    let pool_members_by_pool_id = list_pool_members_by_pool_id(ctx, pools.as_slice())?;

    let account = account_id
        .as_deref()
        .and_then(|id| accounts.iter().find(|entry| entry.account_id == id))
        .cloned();

    let selected_pool_id = pool_id.clone().or_else(|| {
        if pools.len() == 1 {
            pools.first().map(|entry| entry.pool_id.clone())
        } else {
            None
        }
    });

    let mut selected = None::<oauth_pool::OAuthPoolSelectionResult>;
    let mut selection_miss_reason = None::<String>;
    if let Some(target_pool_id) = selected_pool_id.as_deref() {
        let (selection, miss_reason) = ctx
            .oauth_pool
            .probe_pool_account_with_reason(OAuthPoolSelectionInput {
                pool_id: target_pool_id.to_string(),
                session_id: session_id.clone(),
                workspace_id: None,
                model_id: model_id.clone(),
            })
            .map_err(RpcError::internal)?;
        selected = selection;
        selection_miss_reason = miss_reason.map(|entry| entry.as_str().to_string());
    }

    let mut redacted_selected = None::<oauth_pool::OAuthPoolSelectionResult>;
    if let Some(mut selection) = selected {
        selection.account = redact_oauth_account_summary(selection.account);
        redacted_selected = Some(selection);
    }

    let available = if selected_pool_id.is_some() {
        redacted_selected
            .as_ref()
            .is_some_and(|selection| selection.account.status == "enabled")
    } else if let Some(account) = account.as_ref() {
        account.status == "enabled"
    } else {
        accounts.iter().any(|entry| entry.status == "enabled")
    };

    let resolved_provider = provider.clone().or_else(|| {
        redacted_selected
            .as_ref()
            .map(|entry| entry.account.provider.clone())
    });
    let resolved_account = redacted_selected
        .as_ref()
        .map(|entry| entry.account.account_id.clone())
        .or_else(|| account.as_ref().map(|entry| entry.account_id.clone()));
    let latency_ms = elapsed_ms_saturated(started_at);

    let error = if let Some(target_account_id) = account_id.as_deref() {
        if account.is_none() {
            Some(format!("account_not_found:{target_account_id}"))
        } else {
            None
        }
    } else {
        None
    }
    .or(selection_miss_reason.clone());

    Ok(json!({
        "ok": available && error.is_none(),
        "available": available,
        "provider": resolved_provider,
        "poolId": selected_pool_id,
        "accountId": resolved_account,
        "sessionId": session_id,
        "modelId": model_id,
        "latencyMs": latency_ms,
        "selection": redacted_selected,
        "diagnostics": {
            "accounts": accounts.len(),
            "pools": pools.len(),
            "members": count_pool_members(pool_members_by_pool_id.as_object()),
        },
        "error": error,
        "poolMembersByPoolId": pool_members_by_pool_id,
    }))
}

fn parse_optional_oauth_provider_from_fields(
    params: &serde_json::Map<String, Value>,
    fields: &[&str],
) -> Result<Option<String>, RpcError> {
    for field in fields {
        if !params.contains_key(*field) {
            continue;
        }
        return parse_optional_oauth_provider(params, field);
    }
    Ok(None)
}

fn list_pool_members_by_pool_id(
    ctx: &AppContext,
    pools: &[oauth_pool::OAuthPoolSummary],
) -> Result<Value, RpcError> {
    let mut by_pool_id = serde_json::Map::new();
    for pool in pools {
        let members = ctx
            .oauth_pool
            .list_pool_members(pool.pool_id.as_str())
            .map_err(RpcError::internal)?;
        by_pool_id.insert(pool.pool_id.clone(), json!(members));
    }
    Ok(Value::Object(by_pool_id))
}

fn count_pool_members(pool_members_by_pool_id: Option<&serde_json::Map<String, Value>>) -> usize {
    let Some(pool_members_by_pool_id) = pool_members_by_pool_id else {
        return 0;
    };
    pool_members_by_pool_id
        .values()
        .map(|value| value.as_array().map_or(0, Vec::len))
        .sum()
}

fn elapsed_ms_saturated(started_at: Instant) -> u64 {
    let elapsed = started_at.elapsed().as_millis();
    if elapsed > u64::MAX as u128 {
        return u64::MAX;
    }
    elapsed as u64
}

async fn list_native_entities(ctx: &AppContext, table: &str) -> Result<Value, RpcError> {
    ctx.native_state_store
        .list_entities(table)
        .await
        .map(Value::Array)
        .map_err(RpcError::internal)
}

async fn list_native_review_comments(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let thread_id = read_optional_string(params, "threadId");
    let change_id = read_optional_string(params, "changeId");
    let file_path = read_optional_string(params, "filePath");

    let mut comments = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_REVIEW_COMMENTS)
        .await
        .map_err(RpcError::internal)?;

    comments.retain(|entry| {
        review_comment_matches_filters(
            entry,
            workspace_id,
            thread_id.as_deref(),
            change_id.as_deref(),
            file_path.as_deref(),
        )
    });

    comments.sort_by(|left, right| {
        let left_path = review_comment_path(left);
        let right_path = review_comment_path(right);
        if left_path != right_path {
            return left_path.cmp(right_path);
        }

        let left_line = review_comment_line(left);
        let right_line = review_comment_line(right);
        if left_line != right_line {
            return left_line.cmp(&right_line);
        }

        let left_updated_at = review_comment_updated_at(left);
        let right_updated_at = review_comment_updated_at(right);
        if left_updated_at != right_updated_at {
            return left_updated_at.cmp(&right_updated_at);
        }

        review_comment_id(left).cmp(review_comment_id(right))
    });

    Ok(Value::Array(comments))
}

async fn upsert_native_review_comment(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let comment_id = read_first_non_empty_string(params, &["commentId", "id"])
        .unwrap_or_else(|| new_id("native-review-comment"));
    let workspace_id = read_required_string(params, "workspaceId")?.to_string();
    let thread_id = read_required_string(params, "threadId")?.to_string();
    let change_id = read_required_string(params, "changeId")?.to_string();
    let file_path = read_required_string(params, "filePath")?.to_string();
    let line = read_optional_i32(params, "line")
        .filter(|value| *value > 0)
        .ok_or_else(|| RpcError::invalid_params("Missing required positive integer field: line"))?;
    let side = read_optional_string(params, "side").unwrap_or_else(|| "new".to_string());
    if side != "new" && side != "old" {
        return Err(RpcError::invalid_params(
            "side must be either `new` or `old`.",
        ));
    }
    let body = read_required_string(params, "body")?.to_string();
    let resolved = read_optional_bool(params, "resolved").unwrap_or(false);

    let payload = json!({
        "id": comment_id,
        "workspaceId": workspace_id,
        "threadId": thread_id,
        "changeId": change_id,
        "filePath": file_path,
        "line": line,
        "side": side,
        "body": body,
        "resolved": resolved,
    });

    ctx.native_state_store
        .upsert_entity(
            TABLE_NATIVE_REVIEW_COMMENTS,
            comment_id.as_str(),
            Some(true),
            payload,
        )
        .await
        .map_err(RpcError::internal)
}

async fn remove_native_review_comment(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let comment_id = read_first_non_empty_string(params, &["commentId", "id"])
        .ok_or_else(|| RpcError::invalid_params("Missing required string field: commentId"))?;

    ctx.native_state_store
        .remove_entity(TABLE_NATIVE_REVIEW_COMMENTS, comment_id.as_str())
        .await
        .map(Value::Bool)
        .map_err(RpcError::internal)
}

async fn set_native_review_comment_resolved(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let comment_id = read_first_non_empty_string(params, &["commentId", "id"])
        .ok_or_else(|| RpcError::invalid_params("Missing required string field: commentId"))?;
    let resolved = read_optional_bool(params, "resolved")
        .ok_or_else(|| RpcError::invalid_params("Missing required boolean field: resolved"))?;

    let existing = ctx
        .native_state_store
        .get_entity(TABLE_NATIVE_REVIEW_COMMENTS, comment_id.as_str())
        .await
        .map_err(RpcError::internal)?
        .ok_or_else(|| {
            RpcError::invalid_params(format!("review comment `{comment_id}` not found"))
        })?;

    let mut payload = existing
        .as_object()
        .cloned()
        .unwrap_or_else(serde_json::Map::new);
    payload.insert("resolved".to_string(), Value::Bool(resolved));
    if resolved {
        payload.insert(
            "resolvedAt".to_string(),
            Value::Number(serde_json::Number::from(now_ms())),
        );
    } else {
        payload.remove("resolvedAt");
    }

    ctx.native_state_store
        .upsert_entity(
            TABLE_NATIVE_REVIEW_COMMENTS,
            comment_id.as_str(),
            payload.get("enabled").and_then(Value::as_bool),
            Value::Object(payload),
        )
        .await
        .map_err(RpcError::internal)
}

fn review_comment_matches_filters(
    entry: &Value,
    workspace_id: &str,
    thread_id: Option<&str>,
    change_id: Option<&str>,
    file_path: Option<&str>,
) -> bool {
    let Some(object) = entry.as_object() else {
        return false;
    };
    let Some(entry_workspace_id) = object.get("workspaceId").and_then(Value::as_str) else {
        return false;
    };
    if entry_workspace_id != workspace_id {
        return false;
    }
    if let Some(thread_id) = thread_id {
        if object.get("threadId").and_then(Value::as_str) != Some(thread_id) {
            return false;
        }
    }
    if let Some(change_id) = change_id {
        if object.get("changeId").and_then(Value::as_str) != Some(change_id) {
            return false;
        }
    }
    if let Some(file_path) = file_path {
        if object.get("filePath").and_then(Value::as_str) != Some(file_path) {
            return false;
        }
    }
    true
}

fn review_comment_id(entry: &Value) -> &str {
    entry
        .as_object()
        .and_then(|object| object.get("id"))
        .and_then(Value::as_str)
        .unwrap_or_default()
}

fn review_comment_path(entry: &Value) -> &str {
    entry
        .as_object()
        .and_then(|object| object.get("filePath"))
        .and_then(Value::as_str)
        .unwrap_or_default()
}

fn review_comment_line(entry: &Value) -> i64 {
    entry
        .as_object()
        .and_then(|object| object.get("line"))
        .and_then(Value::as_i64)
        .unwrap_or_default()
}

fn review_comment_updated_at(entry: &Value) -> u64 {
    entry
        .as_object()
        .and_then(|object| object.get("updatedAt"))
        .and_then(Value::as_u64)
        .unwrap_or_default()
}

async fn list_native_tools(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let tool_id = read_optional_string(params, "toolId");
    let mut tools = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_TOOLS)
        .await
        .map_err(RpcError::internal)?;

    if let Some(tool_id) = tool_id {
        tools.retain(|entry| {
            entry
                .as_object()
                .and_then(|object| object.get("id"))
                .and_then(Value::as_str)
                .is_some_and(|id| id == tool_id)
        });
    }

    for index in 0..tools.len() {
        let tool_id = tools[index]
            .as_object()
            .and_then(|object| object.get("id"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if tool_id.is_empty() {
            continue;
        }
        let secrets = ctx
            .native_state_store
            .list_tool_secrets(tool_id.as_str())
            .await
            .map_err(RpcError::internal)?;
        if let Some(tool_object) = tools[index].as_object_mut() {
            tool_object.insert("secrets".to_string(), Value::Array(secrets));
        }
    }

    Ok(Value::Array(tools))
}

async fn upsert_native_entity(
    ctx: &AppContext,
    params: &Value,
    table: &str,
    id_keys: &[&str],
    payload_key: &str,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let id = read_first_non_empty_string(params, id_keys).ok_or_else(|| {
        RpcError::invalid_params(format!("Missing required id field for `{table}`"))
    })?;
    let payload = extract_payload(params, payload_key, id.as_str());
    let enabled = read_optional_bool(params, "enabled");
    ctx.native_state_store
        .upsert_entity(table, id.as_str(), enabled, payload)
        .await
        .map_err(RpcError::internal)
}

async fn update_native_entity(
    ctx: &AppContext,
    params: &Value,
    table: &str,
    id_keys: &[&str],
    payload_key: &str,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let id = read_first_non_empty_string(params, id_keys).ok_or_else(|| {
        RpcError::invalid_params(format!("Missing required id field for `{table}`"))
    })?;
    let existing = ctx
        .native_state_store
        .get_entity(table, id.as_str())
        .await
        .map_err(RpcError::internal)?
        .ok_or_else(|| RpcError::invalid_params(format!("{table} entry `{id}` not found")))?;

    let mut merged = existing
        .as_object()
        .cloned()
        .unwrap_or_else(serde_json::Map::new);
    let patch = extract_payload(params, payload_key, id.as_str());
    if let Value::Object(patch_object) = patch {
        for (key, value) in patch_object {
            merged.insert(key, value);
        }
    }
    let enabled = read_optional_bool(params, "enabled");

    ctx.native_state_store
        .upsert_entity(table, id.as_str(), enabled, Value::Object(merged))
        .await
        .map_err(RpcError::internal)
}

async fn remove_native_entity(
    ctx: &AppContext,
    params: &Value,
    table: &str,
    id_keys: &[&str],
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let id = read_first_non_empty_string(params, id_keys).ok_or_else(|| {
        RpcError::invalid_params(format!("Missing required id field for `{table}`"))
    })?;
    ctx.native_state_store
        .remove_entity(table, id.as_str())
        .await
        .map(Value::Bool)
        .map_err(RpcError::internal)
}

async fn set_native_entity_enabled(
    ctx: &AppContext,
    params: &Value,
    table: &str,
    id_keys: &[&str],
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let id = read_first_non_empty_string(params, id_keys).ok_or_else(|| {
        RpcError::invalid_params(format!("Missing required id field for `{table}`"))
    })?;
    let enabled = read_optional_bool(params, "enabled")
        .ok_or_else(|| RpcError::invalid_params("Missing required boolean field: enabled"))?;
    ctx.native_state_store
        .set_entity_enabled(table, id.as_str(), enabled)
        .await
        .map_err(RpcError::internal)
}

async fn upsert_tool_secret(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let tool_id = read_required_string(params, "toolId")?;
    let secret_key = read_required_string(params, "secretKey")?;
    let secret_ref = read_required_string(params, "secretRef")?;

    ctx.native_state_store
        .upsert_tool_secret(tool_id, secret_key, secret_ref)
        .await
        .map_err(RpcError::internal)
}

async fn remove_tool_secret(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let tool_id = read_required_string(params, "toolId")?;
    let secret_key = read_required_string(params, "secretKey")?;

    ctx.native_state_store
        .remove_tool_secret(tool_id, secret_key)
        .await
        .map(Value::Bool)
        .map_err(RpcError::internal)
}

async fn set_active_theme(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let theme_id = read_first_non_empty_string(params, &["themeId", "id"])
        .ok_or_else(|| RpcError::invalid_params("Missing required string field: themeId"))?;

    let exists = ctx
        .native_state_store
        .get_entity(TABLE_NATIVE_THEMES, theme_id.as_str())
        .await
        .map_err(RpcError::internal)?
        .is_some();

    if !exists {
        return Err(RpcError::invalid_params(format!(
            "theme `{theme_id}` not found"
        )));
    }

    let saved = ctx
        .native_state_store
        .upsert_setting_value(
            TABLE_NATIVE_SETTINGS_KV,
            "theme.active",
            Value::String(theme_id.clone()),
        )
        .await
        .map_err(RpcError::internal)?;
    Ok(json!({
        "activeThemeId": theme_id,
        "saved": saved,
    }))
}

async fn native_insights_summary(ctx: &AppContext) -> Result<Value, RpcError> {
    let extensions =
        crate::rpc_dispatch_extensions::list_extension_catalog(ctx, None, true).await?;
    let plugins = extensions
        .iter()
        .filter(|entry| entry.kind == "host")
        .collect::<Vec<_>>();
    let tools = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_TOOLS)
        .await
        .map_err(RpcError::internal)?;
    let skills = extensions
        .iter()
        .filter(|entry| entry.kind == "instruction")
        .collect::<Vec<_>>();
    let schedules = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_SCHEDULES)
        .await
        .map_err(RpcError::internal)?;
    let watchers = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_WATCHERS)
        .await
        .map_err(RpcError::internal)?;

    let tool_metrics = ctx.runtime_tool_metrics.lock().await.read_snapshot();
    let guardrails = ctx.runtime_tool_guardrails.lock().await.read_snapshot();
    let diagnostics = ctx.runtime_diagnostics.snapshot();

    Ok(json!({
        "totals": {
            "plugins": plugins.len(),
            "tools": tools.len(),
            "skills": skills.len(),
            "schedules": schedules.len(),
            "watchers": watchers.len(),
        },
        "runtimeToolMetrics": tool_metrics,
        "runtimeToolGuardrails": guardrails,
        "runtimeDiagnostics": diagnostics,
    }))
}

async fn native_insights_cache_lookup(
    ctx: &AppContext,
    params: &Value,
    default_scope: &str,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let scope = read_optional_string(params, "scope").unwrap_or_else(|| default_scope.to_string());

    if let Some(cached) = ctx
        .native_state_store
        .get_insights_cache(scope.as_str())
        .await
        .map_err(RpcError::internal)?
    {
        return Ok(cached);
    }

    let synthesized = if scope == "events" {
        json!({
            "scope": "events",
            "payload": [],
            "updatedAt": now_ms(),
        })
    } else {
        json!({
            "scope": scope,
            "payload": {
                "points": [],
                "window": "1h",
            },
            "updatedAt": now_ms(),
        })
    };

    let payload = synthesized.get("payload").cloned().unwrap_or(Value::Null);
    ctx.native_state_store
        .upsert_insights_cache(
            synthesized
                .get("scope")
                .and_then(Value::as_str)
                .unwrap_or(default_scope),
            payload,
        )
        .await
        .map_err(RpcError::internal)?;

    Ok(synthesized)
}

async fn native_server_status(ctx: &AppContext) -> Result<Value, RpcError> {
    let health = ctx.native_state_store.health_snapshot().await;
    Ok(json!({
        "status": "ok",
        "transport": {
            "rpc": CODE_RUNTIME_RPC_TRANSPORT_RPC_PATH,
            "events": CODE_RUNTIME_RPC_TRANSPORT_EVENTS_PATH,
            "ws": CODE_RUNTIME_RPC_TRANSPORT_WS_PATH,
        },
        "nativeStateStore": health,
        "revision": ctx.runtime_update_revision.load(Ordering::Relaxed),
        "distributed": {
            "enabled": ctx.distributed_config.enabled,
            "ready": ctx.distributed_redis_client.is_some(),
        },
    }))
}

async fn native_server_config_get(ctx: &AppContext) -> Result<Value, RpcError> {
    let settings = ctx
        .native_state_store
        .list_setting_values(TABLE_NATIVE_SETTINGS_KV)
        .await
        .map_err(RpcError::internal)?;
    let mut server = serde_json::Map::new();
    if let Value::Object(settings_map) = settings {
        for (key, value) in settings_map {
            if let Some(stripped) = key.strip_prefix("server.") {
                server.insert(stripped.to_string(), value);
            }
        }
    }
    if !server.contains_key("distributedEnabled") {
        server.insert(
            "distributedEnabled".to_string(),
            Value::Bool(ctx.distributed_config.enabled),
        );
    }
    Ok(Value::Object(server))
}

async fn native_server_config_set(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let config_value = params
        .get("config")
        .cloned()
        .unwrap_or_else(|| Value::Object(params.clone()));
    let Value::Object(config_object) = config_value else {
        return Err(RpcError::invalid_params(
            "server config must be a JSON object",
        ));
    };

    let mut updated = serde_json::Map::new();
    for (key, value) in config_object {
        let persisted = ctx
            .native_state_store
            .upsert_setting_value(
                TABLE_NATIVE_SETTINGS_KV,
                format!("server.{key}").as_str(),
                value.clone(),
            )
            .await
            .map_err(RpcError::internal)?;
        updated.insert(key, persisted.get("value").cloned().unwrap_or(Value::Null));
    }

    Ok(Value::Object(updated))
}

async fn native_settings_get(ctx: &AppContext) -> Result<Value, RpcError> {
    ctx.native_state_store
        .list_setting_values(TABLE_NATIVE_SETTINGS_KV)
        .await
        .map_err(RpcError::internal)
}

async fn native_settings_set(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let updates = params
        .get("values")
        .cloned()
        .unwrap_or_else(|| Value::Object(params.clone()));
    let Value::Object(update_map) = updates else {
        return Err(RpcError::invalid_params(
            "settings payload must be an object",
        ));
    };

    let mut result = serde_json::Map::new();
    for (key, value) in update_map {
        let persisted = ctx
            .native_state_store
            .upsert_setting_value(TABLE_NATIVE_SETTINGS_KV, key.as_str(), value)
            .await
            .map_err(RpcError::internal)?;
        result.insert(key, persisted.get("value").cloned().unwrap_or(Value::Null));
    }

    Ok(Value::Object(result))
}

async fn native_voice_config_get(ctx: &AppContext) -> Result<Value, RpcError> {
    let values = ctx
        .native_state_store
        .list_setting_values(TABLE_NATIVE_VOICE_CONFIG)
        .await
        .map_err(RpcError::internal)?;

    let mut merged = serde_json::Map::new();
    if let Value::Object(map) = values {
        for (key, value) in map {
            merged.insert(key, value);
        }
    }

    if !merged.contains_key("mode") {
        merged.insert("mode".to_string(), Value::String("continuous".to_string()));
    }

    Ok(Value::Object(merged))
}

async fn native_voice_config_set(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let config = params
        .get("config")
        .cloned()
        .unwrap_or_else(|| Value::Object(params.clone()));
    let Value::Object(config_map) = config else {
        return Err(RpcError::invalid_params(
            "voice config payload must be an object",
        ));
    };

    let mut result = serde_json::Map::new();
    for (key, value) in config_map {
        let persisted = ctx
            .native_state_store
            .upsert_setting_value(TABLE_NATIVE_VOICE_CONFIG, key.as_str(), value)
            .await
            .map_err(RpcError::internal)?;
        result.insert(key, persisted.get("value").cloned().unwrap_or(Value::Null));
    }

    Ok(Value::Object(result))
}

async fn native_voice_hotkey_set(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let hotkey = read_required_string(params, "hotkey")?;
    let persisted = ctx
        .native_state_store
        .upsert_setting_value(
            TABLE_NATIVE_VOICE_CONFIG,
            "hotkey",
            Value::String(hotkey.to_string()),
        )
        .await
        .map_err(RpcError::internal)?;

    Ok(json!({
        "hotkey": persisted.get("value").cloned().unwrap_or(Value::Null),
        "savedAt": persisted.get("updatedAt").cloned().unwrap_or(Value::Null),
    }))
}

fn read_first_non_empty_string(
    params: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        if let Some(value) = read_optional_string(params, key) {
            return Some(value);
        }
    }
    None
}

fn extract_payload(params: &serde_json::Map<String, Value>, payload_key: &str, id: &str) -> Value {
    if let Some(payload) = params.get(payload_key) {
        return ensure_payload_has_id(payload.clone(), id);
    }

    let mut object = serde_json::Map::new();
    for (key, value) in params {
        if ["id", "enabled", payload_key].contains(&key.as_str()) {
            continue;
        }
        if key.ends_with("Id") {
            continue;
        }
        object.insert(key.clone(), value.clone());
    }
    ensure_payload_has_id(Value::Object(object), id)
}

fn ensure_payload_has_id(payload: Value, id: &str) -> Value {
    match payload {
        Value::Object(mut object) => {
            object.insert("id".to_string(), Value::String(id.to_string()));
            Value::Object(object)
        }
        _ => json!({
            "id": id,
            "value": payload,
        }),
    }
}
