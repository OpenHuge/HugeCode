use super::*;
use crate::native_state_store::TABLE_NATIVE_TASK_SOURCES;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceIngestRequestRpc {
    provider: String,
    event: TaskSourceEventRpc,
    payload: TaskSourcePayloadRpc,
    #[serde(default)]
    launch: Option<TaskSourceLaunchRequestRpc>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceEventRpc {
    #[serde(default)]
    delivery_id: Option<String>,
    event_name: String,
    #[serde(default)]
    action: Option<String>,
    #[serde(default)]
    received_at: Option<u64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceRequesterRpc {
    #[serde(default)]
    login: Option<String>,
    #[serde(default)]
    id: Option<u64>,
    #[serde(default)]
    r#type: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceRepoContextRpc {
    #[serde(default)]
    owner: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    remote_url: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourcePayloadRpc {
    kind: String,
    trigger_mode: String,
    repo: TaskSourceRepoContextRpc,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    canonical_url: Option<String>,
    #[serde(default)]
    issue_number: Option<u64>,
    #[serde(default)]
    pull_request_number: Option<u64>,
    #[serde(default)]
    comment_id: Option<u64>,
    #[serde(default)]
    comment_url: Option<String>,
    #[serde(default)]
    comment_body: Option<String>,
    #[serde(default)]
    comment_author: Option<TaskSourceRequesterRpc>,
    #[serde(default)]
    command_kind: Option<String>,
    #[serde(default)]
    head_sha: Option<String>,
    #[serde(default)]
    external_id: Option<String>,
    #[serde(default)]
    requested_by: Option<TaskSourceRequesterRpc>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceLaunchRequestRpc {
    #[serde(default)]
    enabled: Option<bool>,
    #[serde(default)]
    thread_id: Option<String>,
    #[serde(default)]
    request_id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    mission_brief: Option<Value>,
    #[serde(default)]
    execution_profile_id: Option<String>,
    #[serde(default)]
    review_profile_id: Option<String>,
    #[serde(default)]
    validation_preset_id: Option<String>,
    #[serde(default)]
    access_mode: Option<String>,
    #[serde(default)]
    preferred_backend_ids: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceRecordRpc {
    source_record_id: String,
    provider: String,
    source_kind: String,
    dedupe_key: String,
    state: String,
    write_back_state: String,
    workspace_id: Option<String>,
    workspace_path: Option<String>,
    delivery_id: Option<String>,
    event_name: Option<String>,
    action: Option<String>,
    command_kind: Option<String>,
    repo: Option<Value>,
    issue_number: Option<u64>,
    pull_request_number: Option<u64>,
    head_sha: Option<String>,
    url: Option<String>,
    comment_id: Option<u64>,
    linked_task_id: Option<String>,
    linked_run_id: Option<String>,
    linked_review_pack_id: Option<String>,
    message: Option<String>,
    metadata: Option<Value>,
    created_at: u64,
    payload: Value,
}

#[derive(Clone, Debug)]
struct TaskSourceLaunchOutcome {
    disposition: &'static str,
    message: String,
    run_id: Option<String>,
    task_id: Option<String>,
    review_pack_id: Option<String>,
}

pub(crate) async fn handle_task_source_ingest_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let mut request = serde_json::from_value::<TaskSourceIngestRequestRpc>(params.clone())
        .map_err(|error| {
            RpcError::invalid_params(format!("invalid task source ingest request: {error}"))
        })?;
    normalize_ingest_request(&mut request)?;

    if request.provider != "github" {
        return Err(RpcError::invalid_params(
            "task source ingest currently supports provider `github` only.",
        ));
    }

    let dedupe_key = build_task_source_dedupe_key(&request)?;
    let source_record_id = format!("source-{}", stable_hash(dedupe_key.as_str()));

    if let Some(existing) = ctx
        .native_state_store
        .get_entity(TABLE_NATIVE_TASK_SOURCES, source_record_id.as_str())
        .await
        .map_err(RpcError::internal)?
    {
        let record = ensure_source_record_identity(existing, source_record_id.as_str());
        return Ok(json!({
            "record": record,
            "launch": {
                "disposition": "deduped",
                "message": "Task source was already ingested.",
                "runId": record.get("linkedRunId").cloned().unwrap_or(Value::Null),
                "taskId": record.get("linkedTaskId").cloned().unwrap_or(Value::Null),
                "reviewPackId": record.get("linkedReviewPackId").cloned().unwrap_or(Value::Null),
            },
            "deduped": true,
        }));
    }

    let workspace_match = resolve_workspace_match(ctx, &request.payload).await;
    let created_at = now_ms();
    let launch_enabled = request
        .launch
        .as_ref()
        .and_then(|entry| entry.enabled)
        .unwrap_or(true);

    let (state, launch_outcome, linked_task_id, linked_run_id, linked_review_pack_id, message) =
        if let Some((workspace_id, workspace_path)) = workspace_match.clone() {
            if launch_enabled {
                let outcome = dispatch_task_source_launch(
                    ctx,
                    source_record_id.as_str(),
                    workspace_id.as_str(),
                    request.launch.as_ref(),
                    &request.payload,
                )
                .await?;
                let next_state = match outcome.disposition {
                    "intervened" => "intervened",
                    "launched" => "launched",
                    "deduped" => "deduped",
                    "failed" => "failed",
                    _ => "queued",
                };
                (
                    next_state.to_string(),
                    outcome.clone(),
                    outcome.task_id.clone(),
                    outcome.run_id.clone(),
                    outcome.review_pack_id.clone(),
                    Some(format!(
                        "{} (workspace: {})",
                        outcome.message, workspace_path
                    )),
                )
            } else {
                (
                    "queued".to_string(),
                    TaskSourceLaunchOutcome {
                        disposition: "not_requested",
                        message: "Task source was ingested without auto-launch.".to_string(),
                        run_id: None,
                        task_id: None,
                        review_pack_id: None,
                    },
                    None,
                    None,
                    None,
                    Some("Task source was ingested without auto-launch.".to_string()),
                )
            }
        } else {
            (
                "ignored".to_string(),
                TaskSourceLaunchOutcome {
                    disposition: "blocked",
                    message:
                        "No connected workspace matched the GitHub repository for this source."
                            .to_string(),
                    run_id: None,
                    task_id: None,
                    review_pack_id: None,
                },
                None,
                None,
                None,
                Some(
                    "No connected workspace matched the GitHub repository for this source."
                        .to_string(),
                ),
            )
        };

    let repo_value = json!({
        "owner": request.payload.repo.owner.clone(),
        "name": request.payload.repo.name.clone(),
        "fullName": request.payload.repo.full_name.clone(),
        "remoteUrl": request.payload.repo.remote_url.clone(),
    });

    let record = TaskSourceRecordRpc {
        source_record_id: source_record_id.clone(),
        provider: request.provider.clone(),
        source_kind: request.payload.kind.clone(),
        dedupe_key,
        state,
        write_back_state: "not_requested".to_string(),
        workspace_id: workspace_match.as_ref().map(|entry| entry.0.clone()),
        workspace_path: workspace_match.as_ref().map(|entry| entry.1.clone()),
        delivery_id: request.event.delivery_id.clone(),
        event_name: Some(request.event.event_name.clone()),
        action: request.event.action.clone(),
        command_kind: request.payload.command_kind.clone(),
        repo: Some(repo_value),
        issue_number: request.payload.issue_number,
        pull_request_number: request.payload.pull_request_number,
        head_sha: request.payload.head_sha.clone(),
        url: request
            .payload
            .canonical_url
            .clone()
            .or_else(|| request.payload.url.clone())
            .or_else(|| request.payload.comment_url.clone()),
        comment_id: request.payload.comment_id,
        linked_task_id,
        linked_run_id,
        linked_review_pack_id,
        message,
        metadata: Some(json!({
            "triggerMode": request.payload.trigger_mode.clone(),
            "event": {
                "eventName": request.event.event_name.clone(),
                "action": request.event.action.clone(),
            },
        })),
        created_at,
        payload: serde_json::to_value(&request.payload).map_err(|error| {
            RpcError::internal(format!("serialize task source payload failed: {error}"))
        })?,
    };

    let stored_record = ctx
        .native_state_store
        .upsert_entity(
            TABLE_NATIVE_TASK_SOURCES,
            source_record_id.as_str(),
            Some(true),
            serde_json::to_value(&record).map_err(|error| {
                RpcError::internal(format!("serialize task source record failed: {error}"))
            })?,
        )
        .await
        .map_err(RpcError::internal)?;

    Ok(json!({
        "record": ensure_source_record_identity(stored_record, source_record_id.as_str()),
        "launch": {
            "disposition": launch_outcome.disposition,
            "message": launch_outcome.message,
            "runId": launch_outcome.run_id,
            "taskId": launch_outcome.task_id,
            "reviewPackId": launch_outcome.review_pack_id,
        },
        "deduped": false,
    }))
}

pub(crate) async fn handle_task_source_get_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let source_record_id = read_optional_string(params, "sourceRecordId")
        .or_else(|| read_optional_string(params, "source_record_id"))
        .ok_or_else(|| RpcError::invalid_params("sourceRecordId is required."))?;
    let record = ctx
        .native_state_store
        .get_entity(TABLE_NATIVE_TASK_SOURCES, source_record_id.as_str())
        .await
        .map_err(RpcError::internal)?;
    let Some(record) = record else {
        return Ok(Value::Null);
    };
    Ok(ensure_source_record_identity(
        record,
        source_record_id.as_str(),
    ))
}

pub(crate) async fn handle_task_source_list_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_optional_string(params, "workspaceId");
    let provider = read_optional_string(params, "provider");
    let source_kind = read_optional_string(params, "sourceKind");
    let state_filter = read_optional_string(params, "state");
    let limit = read_optional_u64(params, "limit").unwrap_or(50) as usize;

    let records = ctx
        .native_state_store
        .list_entities(TABLE_NATIVE_TASK_SOURCES)
        .await
        .map_err(RpcError::internal)?;

    let mut filtered = records
        .into_iter()
        .filter_map(|record| {
            let record = ensure_source_record_identity(record, "");
            let matches_workspace = workspace_id.as_deref().is_none_or(|expected| {
                record.get("workspaceId").and_then(Value::as_str) == Some(expected)
            });
            let matches_provider = provider.as_deref().is_none_or(|expected| {
                record.get("provider").and_then(Value::as_str) == Some(expected)
            });
            let matches_kind = source_kind.as_deref().is_none_or(|expected| {
                record.get("sourceKind").and_then(Value::as_str) == Some(expected)
            });
            let matches_state = state_filter.as_deref().is_none_or(|expected| {
                record.get("state").and_then(Value::as_str) == Some(expected)
            });
            (matches_workspace && matches_provider && matches_kind && matches_state)
                .then_some(record)
        })
        .collect::<Vec<_>>();

    filtered.sort_by(|left, right| {
        let left_created = left
            .get("createdAt")
            .and_then(Value::as_u64)
            .unwrap_or_default();
        let right_created = right
            .get("createdAt")
            .and_then(Value::as_u64)
            .unwrap_or_default();
        right_created.cmp(&left_created)
    });
    filtered.truncate(limit);

    Ok(Value::Array(filtered))
}

pub(crate) async fn handle_task_source_reconcile_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let source_record_id = read_optional_string(params, "sourceRecordId")
        .or_else(|| read_optional_string(params, "source_record_id"))
        .ok_or_else(|| RpcError::invalid_params("sourceRecordId is required."))?;

    let record = ctx
        .native_state_store
        .get_entity(TABLE_NATIVE_TASK_SOURCES, source_record_id.as_str())
        .await
        .map_err(RpcError::internal)?;
    let Some(record) = record else {
        return Ok(json!({
            "reconciled": false,
            "record": Value::Null,
            "message": "Task source record was not found.",
        }));
    };

    let mut record = ensure_source_record_identity(record, source_record_id.as_str());
    let linked_run_id = record
        .get("linkedRunId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let Some(run_id) = linked_run_id else {
        return Ok(json!({
            "reconciled": true,
            "record": record,
            "message": "Task source record has no linked run to reconcile.",
        }));
    };

    let run_record = super::runtime_kernel_v2_dispatch::handle_runtime_run_get_v2(
        ctx,
        &json!({ "runId": run_id }),
    )
    .await?;
    let run_status = run_record
        .get("run")
        .and_then(|entry| entry.get("status"))
        .and_then(Value::as_str)
        .unwrap_or("queued");
    let next_state = if run_record
        .get("reviewPack")
        .is_some_and(|entry| !entry.is_null())
        && !matches!(
            run_status,
            "completed" | "failed" | "cancelled" | "interrupted"
        ) {
        "waiting_review"
    } else if run_status == "completed" {
        "completed"
    } else if matches!(run_status, "failed" | "cancelled" | "interrupted") {
        "failed"
    } else {
        record
            .get("state")
            .and_then(Value::as_str)
            .unwrap_or("launched")
    }
    .to_string();

    if let Some(object) = record.as_object_mut() {
        object.insert("state".to_string(), Value::String(next_state));
        object.insert(
            "message".to_string(),
            Value::String(format!(
                "Reconciled from linked runtime run status `{run_status}`."
            )),
        );
        object.insert(
            "linkedReviewPackId".to_string(),
            run_record
                .get("reviewPack")
                .and_then(|entry| entry.get("reviewPackId"))
                .cloned()
                .unwrap_or(Value::Null),
        );
    }

    let stored = ctx
        .native_state_store
        .upsert_entity(
            TABLE_NATIVE_TASK_SOURCES,
            source_record_id.as_str(),
            Some(true),
            record,
        )
        .await
        .map_err(RpcError::internal)?;

    Ok(json!({
        "reconciled": true,
        "record": ensure_source_record_identity(stored, source_record_id.as_str()),
        "message": format!("Task source record reconciled against runtime run `{run_id}`."),
    }))
}

fn normalize_ingest_request(request: &mut TaskSourceIngestRequestRpc) -> Result<(), RpcError> {
    request.provider = request.provider.trim().to_ascii_lowercase();
    request.event.event_name = request.event.event_name.trim().to_ascii_lowercase();
    request.event.action = normalize_optional_text(request.event.action.take());
    request.event.delivery_id = normalize_optional_text(request.event.delivery_id.take());
    request.payload.kind = request.payload.kind.trim().to_ascii_lowercase();
    request.payload.trigger_mode = request.payload.trigger_mode.trim().to_ascii_lowercase();
    request.payload.title = normalize_optional_text(request.payload.title.take());
    request.payload.body = normalize_optional_text(request.payload.body.take());
    request.payload.url = normalize_optional_text(request.payload.url.take());
    request.payload.canonical_url = normalize_optional_text(request.payload.canonical_url.take());
    request.payload.comment_url = normalize_optional_text(request.payload.comment_url.take());
    request.payload.comment_body = normalize_optional_text(request.payload.comment_body.take());
    request.payload.command_kind = normalize_optional_text(request.payload.command_kind.take())
        .map(|value| value.to_ascii_lowercase());
    request.payload.head_sha = normalize_optional_text(request.payload.head_sha.take());
    request.payload.external_id = normalize_optional_text(request.payload.external_id.take());
    request.payload.repo.owner = normalize_optional_text(request.payload.repo.owner.take());
    request.payload.repo.name = normalize_optional_text(request.payload.repo.name.take());
    request.payload.repo.full_name = normalize_optional_text(request.payload.repo.full_name.take())
        .map(|value| value.to_ascii_lowercase());
    request.payload.repo.remote_url =
        normalize_optional_text(request.payload.repo.remote_url.take());

    if !matches!(
        request.payload.kind.as_str(),
        "github_issue" | "github_pr_followup"
    ) {
        return Err(RpcError::invalid_params(
            "task source payload kind must be github_issue or github_pr_followup.",
        ));
    }

    if request.payload.repo.full_name.is_none()
        && request.payload.repo.remote_url.is_none()
        && (request.payload.repo.owner.is_none() || request.payload.repo.name.is_none())
    {
        return Err(RpcError::invalid_params(
            "task source payload repo must include fullName, remoteUrl, or owner/name.",
        ));
    }

    Ok(())
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|entry| {
        let trimmed = entry.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn build_task_source_dedupe_key(request: &TaskSourceIngestRequestRpc) -> Result<String, RpcError> {
    let repo_identity = resolve_repo_identity(&request.payload.repo).ok_or_else(|| {
        RpcError::invalid_params(
            "task source payload repo must normalize to a GitHub owner/repo identity.",
        )
    })?;

    if request.payload.kind == "github_issue" && request.payload.pull_request_number.is_none() {
        if let Some(comment_id) = request.payload.comment_id {
            let command = request
                .payload
                .command_kind
                .clone()
                .unwrap_or_else(|| "run".to_string());
            return Ok(format!(
                "github:{repo_identity}:issue:{}:comment:{comment_id}:{command}",
                request.payload.issue_number.unwrap_or_default()
            ));
        }
        if let Some(delivery_id) = request.event.delivery_id.as_deref() {
            return Ok(format!(
                "github:{repo_identity}:issue:{}:delivery:{delivery_id}",
                request.payload.issue_number.unwrap_or_default()
            ));
        }
    }

    if let Some(comment_id) = request.payload.comment_id {
        let command = request
            .payload
            .command_kind
            .clone()
            .unwrap_or_else(|| "followup".to_string());
        let head_sha = request
            .payload
            .head_sha
            .clone()
            .unwrap_or_else(|| "no-head-sha".to_string());
        return Ok(format!(
            "github:{repo_identity}:pr:{}:comment:{comment_id}:{command}:{head_sha}",
            request.payload.pull_request_number.unwrap_or_default()
        ));
    }

    let delivery_id = request.event.delivery_id.clone().unwrap_or_else(|| {
        stable_hash(format!("{repo_identity}:{:?}", request.payload.issue_number).as_str())
    });

    Ok(format!(
        "github:{repo_identity}:{}:{}:delivery:{delivery_id}",
        request.payload.kind,
        request
            .payload
            .pull_request_number
            .or(request.payload.issue_number)
            .unwrap_or_default()
    ))
}

fn resolve_repo_identity(repo: &TaskSourceRepoContextRpc) -> Option<String> {
    repo.full_name
        .clone()
        .or_else(|| {
            Some(format!(
                "{}/{}",
                repo.owner.as_deref()?,
                repo.name.as_deref()?
            ))
        })
        .or_else(|| {
            repo.remote_url
                .as_deref()
                .and_then(normalize_github_repo_identity)
        })
        .and_then(|value| {
            normalize_github_repo_identity(value.as_str()).or(Some(value.to_ascii_lowercase()))
        })
}

fn normalize_github_repo_identity(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_end_matches('/').trim_end_matches(".git");
    if trimmed.is_empty() {
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix("git@github.com:") {
        return normalize_owner_repo(rest);
    }
    if let Some(rest) = trimmed.strip_prefix("ssh://git@github.com/") {
        return normalize_owner_repo(rest);
    }
    if let Some(rest) = trimmed.strip_prefix("https://github.com/") {
        return normalize_owner_repo(rest);
    }
    if let Some(rest) = trimmed.strip_prefix("http://github.com/") {
        return normalize_owner_repo(rest);
    }
    normalize_owner_repo(trimmed)
}

fn normalize_owner_repo(value: &str) -> Option<String> {
    let segments = value
        .split('/')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    if segments.len() != 2 {
        return None;
    }
    Some(format!(
        "{}/{}",
        segments[0].to_ascii_lowercase(),
        segments[1].to_ascii_lowercase()
    ))
}

fn stable_hash(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    let rendered = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    rendered[..16].to_string()
}

async fn resolve_workspace_match(
    ctx: &AppContext,
    payload: &TaskSourcePayloadRpc,
) -> Option<(String, String)> {
    let target_repo = resolve_repo_identity(&payload.repo)?;
    let workspaces = {
        let state = ctx.state.read().await;
        state.workspaces.clone()
    };

    for workspace in workspaces {
        let repo_identities = read_workspace_repo_identities(workspace.path.as_str()).await;
        if repo_identities.iter().any(|entry| entry == &target_repo) {
            return Some((workspace.id, workspace.path));
        }
    }
    None
}

async fn read_workspace_repo_identities(workspace_path: &str) -> Vec<String> {
    let output = run_git_stdout(workspace_path, &["remote", "-v"]).await;
    let Ok(output) = output else {
        return Vec::new();
    };

    let mut identities = Vec::new();
    for line in output.lines() {
        let columns = line.split_whitespace().collect::<Vec<_>>();
        if columns.len() < 2 {
            continue;
        }
        if let Some(identity) = normalize_github_repo_identity(columns[1]) {
            if !identities.contains(&identity) {
                identities.push(identity);
            }
        }
    }
    identities
}

async fn run_git_stdout(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = tokio::process::Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .await
        .map_err(|error| format!("spawn git command failed: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

async fn dispatch_task_source_launch(
    ctx: &AppContext,
    source_record_id: &str,
    workspace_id: &str,
    launch: Option<&TaskSourceLaunchRequestRpc>,
    payload: &TaskSourcePayloadRpc,
) -> Result<TaskSourceLaunchOutcome, RpcError> {
    if let Some(existing_run_id) = find_active_run_for_source(ctx, workspace_id, payload).await {
        if payload
            .command_kind
            .as_deref()
            .is_some_and(|value| matches!(value, "continue" | "retry"))
        {
            let action = if payload.command_kind.as_deref() == Some("retry") {
                "retry"
            } else {
                "continue_with_clarification"
            };
            let run_record = super::runtime_kernel_v2_dispatch::handle_runtime_run_intervene_v2(
                ctx,
                &json!({
                    "runId": existing_run_id,
                    "action": action,
                    "reason": build_intervention_reason(payload),
                    "instructionPatch": payload.comment_body,
                }),
            )
            .await?;
            return Ok(TaskSourceLaunchOutcome {
                disposition: "intervened",
                message: "Runtime attached the GitHub follow-up to an active run.".to_string(),
                run_id: run_record
                    .get("run")
                    .and_then(|entry| entry.get("taskId"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                task_id: run_record
                    .get("run")
                    .and_then(|entry| entry.get("taskId"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                review_pack_id: run_record
                    .get("reviewPack")
                    .and_then(|entry| entry.get("reviewPackId"))
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
            });
        }
    }

    let task_source = json!({
        "kind": payload.kind.clone(),
        "title": payload.title.clone(),
        "reference": build_task_source_reference(payload),
        "url": payload.canonical_url.clone().or_else(|| payload.url.clone()).or_else(|| payload.comment_url.clone()),
        "issueNumber": payload.issue_number,
        "pullRequestNumber": payload.pull_request_number,
        "repo": {
            "owner": payload.repo.owner.clone(),
            "name": payload.repo.name.clone(),
            "fullName": payload.repo.full_name.clone(),
            "remoteUrl": payload.repo.remote_url.clone(),
        },
        "externalId": payload.external_id.clone().or_else(|| Some(source_record_id.to_string())),
        "canonicalUrl": payload.canonical_url.clone(),
    });

    let request_id = launch
        .and_then(|entry| entry.request_id.clone())
        .unwrap_or_else(|| format!("task-source:{source_record_id}"));

    let run_record = super::runtime_kernel_v2_dispatch::handle_runtime_run_start_v2(
        ctx,
        &json!({
            "workspaceId": workspace_id,
            "threadId": launch.and_then(|entry| entry.thread_id.clone()),
            "requestId": request_id,
            "title": launch
                .and_then(|entry| entry.title.clone())
                .or_else(|| payload.title.clone())
                .unwrap_or_else(|| "GitHub source task".to_string()),
            "taskSource": task_source,
            "executionProfileId": launch.and_then(|entry| entry.execution_profile_id.clone()),
            "reviewProfileId": launch.and_then(|entry| entry.review_profile_id.clone()),
            "validationPresetId": launch.and_then(|entry| entry.validation_preset_id.clone()),
            "accessMode": launch.and_then(|entry| entry.access_mode.clone()),
            "preferredBackendIds": launch.and_then(|entry| entry.preferred_backend_ids.clone()),
            "missionBrief": launch.and_then(|entry| entry.mission_brief.clone()),
            "steps": build_launch_steps(payload),
        }),
    )
    .await?;

    let run_id = run_record
        .get("run")
        .and_then(|entry| entry.get("taskId"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let review_pack_id = run_record
        .get("reviewPack")
        .and_then(|entry| entry.get("reviewPackId"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    Ok(TaskSourceLaunchOutcome {
        disposition: "launched",
        message: "Runtime launched a GitHub source-driven run.".to_string(),
        run_id: run_id.clone(),
        task_id: run_id,
        review_pack_id,
    })
}

fn build_task_source_reference(payload: &TaskSourcePayloadRpc) -> Option<String> {
    if let Some(pr_number) = payload.pull_request_number {
        return Some(format!("PR #{pr_number}"));
    }
    payload
        .issue_number
        .map(|issue_number| format!("Issue #{issue_number}"))
}

fn build_intervention_reason(payload: &TaskSourcePayloadRpc) -> String {
    if let Some(comment_id) = payload.comment_id {
        return format!("GitHub follow-up comment #{comment_id} requested runtime continuation.");
    }
    "GitHub follow-up requested runtime continuation.".to_string()
}

fn build_launch_steps(payload: &TaskSourcePayloadRpc) -> Vec<Value> {
    let mut steps = Vec::new();
    if let Some(title) = payload.title.as_deref() {
        steps.push(json!({
            "kind": "read",
            "input": truncate_for_step(format!("GitHub source objective: {title}").as_str()),
        }));
    }
    if let Some(body) = payload.body.as_deref() {
        steps.push(json!({
            "kind": "read",
            "input": truncate_for_step(body),
        }));
    }
    if let Some(comment_body) = payload.comment_body.as_deref() {
        steps.push(json!({
            "kind": "read",
            "input": truncate_for_step(format!("GitHub follow-up: {comment_body}").as_str()),
        }));
    }
    if steps.is_empty() {
        steps.push(json!({
            "kind": "read",
            "input": "GitHub source requested runtime execution without additional body context.",
        }));
    }
    steps
}

fn truncate_for_step(value: &str) -> String {
    const MAX_STEP_CHARS: usize = 2_000;
    if value.chars().count() <= MAX_STEP_CHARS {
        return value.trim().to_string();
    }
    let mut collected = String::new();
    for ch in value.chars().take(MAX_STEP_CHARS.saturating_sub(1)) {
        collected.push(ch);
    }
    collected.push('…');
    collected
}

async fn find_active_run_for_source(
    ctx: &AppContext,
    workspace_id: &str,
    payload: &TaskSourcePayloadRpc,
) -> Option<String> {
    let target_repo = resolve_repo_identity(&payload.repo)?;
    let store = ctx.agent_tasks.read().await;
    store.tasks.values().find_map(|runtime| {
        if runtime.summary.workspace_id != workspace_id
            || is_agent_task_terminal_status(runtime.summary.status.as_str())
        {
            return None;
        }
        let source = runtime.summary.task_source.as_ref()?;
        let source_repo = source.repo.as_ref().and_then(|repo| {
            repo.full_name
                .as_deref()
                .and_then(normalize_github_repo_identity)
                .or_else(|| {
                    repo.remote_url
                        .as_deref()
                        .and_then(normalize_github_repo_identity)
                })
        })?;
        if source_repo != target_repo {
            return None;
        }
        let issue_matches = payload
            .issue_number
            .is_some_and(|expected| source.issue_number == Some(expected));
        let pr_matches = payload
            .pull_request_number
            .is_some_and(|expected| source.pull_request_number == Some(expected));
        (issue_matches || pr_matches).then(|| runtime.summary.task_id.clone())
    })
}

fn ensure_source_record_identity(mut record: Value, source_record_id: &str) -> Value {
    if let Some(object) = record.as_object_mut() {
        if !source_record_id.is_empty() {
            object.insert(
                "sourceRecordId".to_string(),
                Value::String(source_record_id.to_string()),
            );
        } else if !object.contains_key("sourceRecordId") {
            if let Some(id) = object.get("id").and_then(Value::as_str) {
                object.insert("sourceRecordId".to_string(), Value::String(id.to_string()));
            }
        }
    }
    record
}

#[cfg(test)]
mod tests {
    use super::{
        build_task_source_dedupe_key, normalize_github_repo_identity, stable_hash,
        TaskSourceEventRpc, TaskSourceIngestRequestRpc, TaskSourcePayloadRpc,
        TaskSourceRepoContextRpc,
    };

    #[test]
    fn normalize_github_repo_identity_supports_https_and_ssh() {
        assert_eq!(
            normalize_github_repo_identity("https://github.com/OpenHuge/HugeCode.git"),
            Some("openhuge/hugecode".to_string())
        );
        assert_eq!(
            normalize_github_repo_identity("git@github.com:OpenHuge/HugeCode.git"),
            Some("openhuge/hugecode".to_string())
        );
    }

    #[test]
    fn build_task_source_dedupe_key_prefers_comment_identity_for_pr_followups() {
        let request = TaskSourceIngestRequestRpc {
            provider: "github".to_string(),
            event: TaskSourceEventRpc {
                delivery_id: Some("delivery-1".to_string()),
                event_name: "issue_comment".to_string(),
                action: Some("created".to_string()),
                received_at: None,
            },
            payload: TaskSourcePayloadRpc {
                kind: "github_pr_followup".to_string(),
                trigger_mode: "pull_request_comment_command".to_string(),
                repo: TaskSourceRepoContextRpc {
                    full_name: Some("openhuge/hugecode".to_string()),
                    ..TaskSourceRepoContextRpc::default()
                },
                pull_request_number: Some(74),
                comment_id: Some(991),
                command_kind: Some("continue".to_string()),
                head_sha: Some("abc123".to_string()),
                ..TaskSourcePayloadRpc::default()
            },
            launch: None,
        };

        let key = build_task_source_dedupe_key(&request).expect("build dedupe key");
        assert!(key.contains("comment:991"));
        assert!(key.contains("continue"));
        assert_eq!(stable_hash(key.as_str()).len(), 16);
    }
}
