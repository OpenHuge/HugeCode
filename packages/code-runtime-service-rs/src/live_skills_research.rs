#[path = "live_skills_research_support.rs"]
mod support;
use support::{
    aggregate_approval_events, aggregate_compaction_summaries, build_live_skill_checkpoint_state,
    build_live_skill_eval_tags, build_research_compaction_summary,
    build_research_provider_diagnostics, insert_live_skill_context_observability,
    resolve_research_execution_policy, summarize_compaction_summary,
};

const DEFAULT_RESEARCH_ALLOWED_SKILL_IDS: [&str; 4] =
    ["network-analysis", "core-read", "core-grep", "core-tree"];

async fn handle_research_orchestrator_live_skill_execute(
    ctx: &AppContext,
    canonical_skill_id: &str,
    input: &str,
    options: &LiveSkillExecuteOptions,
    context: Option<&LiveSkillExecuteContext>,
) -> Result<Value, RpcError> {
    let goal = options
        .query
        .clone()
        .unwrap_or_else(|| input.to_string())
        .trim()
        .to_string();
    if goal.is_empty() {
        return Err(RpcError::invalid_params(
            "Research goal must not be empty.",
        ));
    }
    validate_live_skill_query(goal.as_str())?;

    let max_sub_queries = normalize_optional_usize(
        options.max_sub_queries,
        DEFAULT_RESEARCH_MAX_SUB_QUERIES,
        1,
        MAX_RESEARCH_MAX_SUB_QUERIES,
    );
    let research_policy = resolve_research_execution_policy(
        options,
        context,
        ctx.config.live_skills_network_base_url.as_str(),
    );
    let sub_queries = resolve_research_sub_queries(options, goal.as_str(), max_sub_queries);
    let fetch_page_content = research_policy.fetch_page_content;
    let allow_network = options.allow_network.unwrap_or(true);
    let prefer_domains = normalize_domains(options.prefer_domains.as_deref().unwrap_or(&[]));
    let workspace_context_paths = options.workspace_context_paths.clone().unwrap_or_default();
    let run_id = new_id("research-run");
    let workspace_id = resolve_research_workspace_id(ctx, options).await?;

    if !allow_network || !ctx.config.live_skills_network_enabled {
        let checkpoint_state = build_live_skill_checkpoint_state(
            "failed",
            "blocked",
            None,
            Some(format!("research-run:{run_id}").as_str()),
            false,
            Some(now_ms()),
        );
        let approval_events = json!([]);
        let compaction_summary = build_research_compaction_summary();
        let eval_tags = build_live_skill_eval_tags(canonical_skill_id, "research", &[]);
        let result = LiveSkillExecutionResult {
            run_id: run_id.clone(),
            skill_id: canonical_skill_id.to_string(),
            status: "blocked".to_string(),
            message: "Research orchestration is disabled by runtime policy.".to_string(),
            output: String::new(),
            network: None,
            artifacts: vec![],
            metadata: json!({
                "profileUsed": "research",
                "approvalEvents": approval_events.clone(),
                "checkpointState": checkpoint_state.clone(),
                "compactionSummary": compaction_summary.clone(),
                "evalTags": eval_tags.clone(),
                "researchRun": {
                    "goal": goal,
                    "subQueries": sub_queries,
                    "sessions": [],
                    "citations": [],
                    "highlights": [],
                    "gaps": ["Network access is disabled by runtime policy."],
                    "freshnessSummary": {
                        "freshestPublishedAt": Value::Null,
                        "citationCount": 0,
                        "datedCitationCount": 0,
                    },
                    "profileUsed": "research",
                    "approvalEvents": approval_events,
                    "checkpointState": checkpoint_state,
                    "compactionSummary": compaction_summary,
                    "evalTags": eval_tags,
                    "providerDiagnostics": build_research_provider_diagnostics(
                        vec![research_policy.network_provider.clone()],
                        vec![research_policy.strategy.to_string()],
                        allow_network,
                        &research_policy,
                        options.recency_days,
                        prefer_domains.as_slice(),
                        workspace_context_paths.as_slice(),
                        Some(0),
                    )
                }
            }),
        };
        return Ok(json!(result));
    }

    let mut join_set = tokio::task::JoinSet::new();
    let mut pending = VecDeque::from(sub_queries.clone());
    let mut child_results: Vec<(String, Value, LiveSkillExecutionResult)> = Vec::new();

    while !pending.is_empty() || !join_set.is_empty() {
        while join_set.len() < research_policy.effective_max_parallel && !pending.is_empty() {
            let sub_query = pending.pop_front().unwrap_or_default();
            let child_ctx = ctx.clone();
            let child_workspace_id = workspace_id.clone();
            let child_run_id = run_id.clone();
            let mut child_options = options.clone();
            child_options.query = Some(sub_query.clone());
            child_options.fetch_page_content = Some(fetch_page_content);
            join_set.spawn(async move {
                execute_research_subquery(
                    &child_ctx,
                    child_workspace_id.as_str(),
                    child_run_id.as_str(),
                    sub_query.as_str(),
                    &child_options,
                )
                .await
            });
        }

        let Some(joined) = join_set.join_next().await else {
            break;
        };
        match joined {
            Ok((sub_query, session, result)) => child_results.push((sub_query, session, result)),
            Err(error) => child_results.push((
                "unknown".to_string(),
                build_research_session_projection(
                    workspace_id.as_str(),
                    run_id.as_str(),
                    "unknown",
                    options,
                    None,
                    "failed",
                    Some("RESEARCH_CHILD_JOIN_FAILED"),
                    Some(format!("Research worker join failed: {error}").as_str()),
                ),
                build_research_child_failure_result(
                    ctx,
                    options,
                    "failed",
                    format!("Research worker join failed: {error}").as_str(),
                ),
            )),
        }
    }

    child_results.sort_by(|left, right| left.0.cmp(&right.0));

    let mut sessions = Vec::with_capacity(child_results.len());
    let mut citation_index = HashMap::<String, Value>::new();
    let mut provider_set = HashSet::<String>::new();
    let mut strategy_set = HashSet::<String>::new();
    let mut highlights = Vec::<String>::new();
    let mut freshest_published_at: Option<String> = None;
    let mut dated_citation_count = 0usize;

    for (sub_query, session, result) in &child_results {
        let diagnostics = result
            .metadata
            .get("providerDiagnostics")
            .cloned()
            .unwrap_or_else(|| json!({}));
        if let Some(provider) = diagnostics.get("provider").and_then(Value::as_str) {
            provider_set.insert(provider.to_string());
        }
        if let Some(strategy) = diagnostics.get("strategy").and_then(Value::as_str) {
            strategy_set.insert(strategy.to_string());
        }

        let mut projected_session = session.clone();
        if let Some(object) = projected_session.as_object_mut() {
            object.insert("query".to_string(), Value::String(sub_query.clone()));
            object.insert("providerDiagnostics".to_string(), diagnostics);
        }
        sessions.push(projected_session);

        let Some(network) = result.network.as_ref() else {
            continue;
        };
        for item in &network.items {
            let dedupe_key = item
                .dedupe_key
                .clone()
                .unwrap_or_else(|| item.url.clone());
            if dedupe_key.trim().is_empty() {
                continue;
            }
            let citation = json!({
                "query": sub_query,
                "title": item.title,
                "url": item.url,
                "domain": item.domain,
                "snippet": item.snippet,
                "contentPreview": item.content,
                "dedupeKey": item.dedupe_key,
                "fetchedAt": item.fetched_at,
                "publishedAt": item.published_at,
            });
            citation_index.entry(dedupe_key).or_insert(citation);
            if highlights.len() < 3 && !item.title.trim().is_empty() {
                highlights.push(item.title.clone());
            }
            if let Some(published_at) = item.published_at.as_ref() {
                dated_citation_count += 1;
                if freshest_published_at
                    .as_ref()
                    .map(|current| published_at > current)
                    .unwrap_or(true)
                {
                    freshest_published_at = Some(published_at.clone());
                }
            }
        }
    }

    let mut citations = citation_index.into_values().collect::<Vec<_>>();
    citations.sort_by(|left, right| {
        let left_domain = left
            .get("domain")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_ascii_lowercase();
        let right_domain = right
            .get("domain")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_ascii_lowercase();
        let left_preferred = prefer_domains.contains(&left_domain);
        let right_preferred = prefer_domains.contains(&right_domain);
        right_preferred
            .cmp(&left_preferred)
            .then_with(|| {
                right
                    .get("publishedAt")
                    .and_then(Value::as_str)
                    .cmp(&left.get("publishedAt").and_then(Value::as_str))
            })
            .then_with(|| left_domain.cmp(&right_domain))
    });

    let combined_items = citations
        .iter()
        .map(json_citation_to_result_item)
        .collect::<Vec<_>>();
    let combined_item_count = combined_items.len();

    let child_failure_count = child_results
        .iter()
        .filter(|(_, _, result)| result.status != "completed")
        .count();
    let gaps = build_research_gaps(
        citations.is_empty(),
        dated_citation_count,
        child_failure_count,
        prefer_domains.is_empty(),
    );
    let output = format_research_output(goal.as_str(), &citations, &highlights, &gaps);
    let status = if citations.is_empty() && child_failure_count > 0 {
        "failed"
    } else {
        "completed"
    };
    let approval_events = aggregate_approval_events(&sessions);
    let compaction_summary = aggregate_compaction_summaries(&sessions);
    let eval_tags = build_live_skill_eval_tags(
        canonical_skill_id,
        "research",
        &[
            format!("subqueries:{}", child_results.len()),
            format!("citations:{}", citations.len()),
            format!("child_failures:{child_failure_count}"),
        ],
    );

    let mut result = LiveSkillExecutionResult {
        run_id: run_id.clone(),
        skill_id: canonical_skill_id.to_string(),
        status: status.to_string(),
        message: format!(
            "Research orchestration completed with {} citation(s) across {} sub-query run(s).",
            citations.len(),
            child_results.len()
        ),
        output,
        network: Some(LiveSkillNetworkResult {
            query: goal.clone(),
            provider: "research-orchestrator".to_string(),
            fetched_at: now_ms(),
            items: combined_items,
        }),
        artifacts: vec![],
        metadata: json!({
            "profileUsed": "research",
            "approvalEvents": approval_events.clone(),
            "checkpointState": build_live_skill_checkpoint_state(
                if status == "completed" { "completed" } else { "failed" },
                status,
                None,
                Some(format!("research-run:{run_id}").as_str()),
                false,
                Some(now_ms()),
            ),
            "compactionSummary": compaction_summary.clone(),
            "evalTags": eval_tags.clone(),
            "researchRun": {
                "goal": goal,
                "subQueries": sub_queries,
                "sessions": sessions,
                "citations": citations,
                "highlights": highlights,
                "gaps": gaps,
                "freshnessSummary": {
                    "freshestPublishedAt": freshest_published_at,
                    "citationCount": combined_item_count,
                    "datedCitationCount": dated_citation_count,
                },
                "profileUsed": "research",
                "approvalEvents": approval_events,
                "checkpointState": build_live_skill_checkpoint_state(
                    if status == "completed" { "completed" } else { "failed" },
                    status,
                    None,
                    Some(format!("research-run:{run_id}").as_str()),
                    false,
                    Some(now_ms()),
                ),
                "compactionSummary": compaction_summary,
                "evalTags": eval_tags,
                "providerDiagnostics": build_research_provider_diagnostics(
                    sorted_strings(provider_set),
                    sorted_strings(strategy_set),
                    allow_network,
                    &research_policy,
                    options.recency_days,
                    prefer_domains.as_slice(),
                    workspace_context_paths.as_slice(),
                    Some(child_failure_count),
                )
            }
        }),
    };

    if let Some(metadata_object) = result.metadata.as_object_mut() {
        let checkpoint_updated_at = metadata_object
            .get("checkpointState")
            .and_then(|value| value.get("updatedAt"))
            .and_then(Value::as_u64);
        let compaction_summary = metadata_object
            .get("compactionSummary")
            .cloned()
            .unwrap_or_else(build_research_compaction_summary);
        insert_live_skill_context_observability(
            metadata_object,
            "research-run",
            run_id.as_str(),
            checkpoint_updated_at,
            &compaction_summary,
            Some(format!("runtime://research-run/{run_id}/context-summary")),
        );
        if let Some(research_run) = metadata_object
            .get_mut("researchRun")
            .and_then(Value::as_object_mut)
        {
            insert_live_skill_context_observability(
                research_run,
                "research-run",
                run_id.as_str(),
                checkpoint_updated_at,
                &compaction_summary,
                Some(format!("runtime://research-run/{run_id}/context-summary")),
            );
        }
    }

    Ok(json!(result))
}

async fn execute_research_subquery(
    ctx: &AppContext,
    workspace_id: &str,
    run_id: &str,
    sub_query: &str,
    options: &LiveSkillExecuteOptions,
) -> (String, Value, LiveSkillExecutionResult) {
    let session_payload = json!({
        "workspaceId": workspace_id,
        "title": format!("research: {sub_query}"),
        "accessMode": "read-only",
        "scopeProfile": "research",
        "allowedSkillIds": DEFAULT_RESEARCH_ALLOWED_SKILL_IDS,
        "allowNetwork": options.allow_network.unwrap_or(true),
        "workspaceReadPaths": options.workspace_context_paths.clone().unwrap_or_default(),
        "parentRunId": run_id,
    });
    let spawned_session = match crate::sub_agents::handle_sub_agent_spawn(ctx, &session_payload).await {
        Ok(session) => session,
        Err(error) => {
            return (
                sub_query.to_string(),
                build_research_session_projection(
                    workspace_id,
                    run_id,
                    sub_query,
                    options,
                    None,
                    "failed",
                    Some("RESEARCH_CHILD_SPAWN_FAILED"),
                    Some(error.message.as_str()),
                ),
                build_research_child_failure_result(
                    ctx,
                    options,
                    "failed",
                    error.message.as_str(),
                ),
            );
        }
    };
    let Some(session_id) = spawned_session
        .get("sessionId")
        .and_then(Value::as_str)
        .map(str::to_string)
    else {
        return (
            sub_query.to_string(),
            build_research_session_projection(
                workspace_id,
                run_id,
                sub_query,
                options,
                None,
                "failed",
                Some("RESEARCH_CHILD_SESSION_MISSING"),
                Some("Research child session did not include a sessionId."),
            ),
            build_research_child_failure_result(
                ctx,
                options,
                "failed",
                "Research child session did not include a sessionId.",
            ),
        );
    };

    let instruction = build_research_sub_agent_instruction(workspace_id, sub_query, options);
    if let Err(error) = crate::sub_agents::handle_sub_agent_send(
        ctx,
        &json!({
            "sessionId": session_id,
            "instruction": instruction,
        }),
    )
    .await
    {
        let session = read_research_sub_agent_status(ctx, session_id.as_str(), Some(spawned_session)).await;
        return (
            sub_query.to_string(),
            session,
            build_research_child_failure_result(ctx, options, "failed", error.message.as_str()),
        );
    }

    let wait_timeout_ms = resolve_research_sub_agent_wait_timeout_ms(ctx, options);
    let wait_result = match crate::sub_agents::handle_sub_agent_wait(
        ctx,
        &json!({
            "sessionId": session_id,
            "timeoutMs": wait_timeout_ms,
        }),
    )
    .await
    {
        Ok(result) => result,
        Err(error) => {
            let session = read_research_sub_agent_status(ctx, session_id.as_str(), None).await;
            return (
                sub_query.to_string(),
                session,
                build_research_child_failure_result(ctx, options, "failed", error.message.as_str()),
            );
        }
    };

    if wait_result
        .get("timedOut")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let _ = crate::sub_agents::handle_sub_agent_interrupt(
            ctx,
            &json!({
                "sessionId": session_id,
                "reason": format!(
                    "Research child session timed out after {} ms.",
                    wait_timeout_ms
                ),
            }),
        )
        .await;
        let session = read_research_sub_agent_status(ctx, session_id.as_str(), None).await;
        return (
            sub_query.to_string(),
            session,
            build_research_child_failure_result(
                ctx,
                options,
                "interrupted",
                format!("Research child session timed out after {} ms.", wait_timeout_ms).as_str(),
            ),
        );
    }

    let session = wait_result
        .get("session")
        .cloned()
        .unwrap_or_else(|| Value::Null);
    let task = wait_result.get("task").cloned();
    (
        sub_query.to_string(),
        session.clone(),
        build_research_child_result(ctx, options, sub_query, &session, task.as_ref()),
    )
}

async fn resolve_research_workspace_id(
    ctx: &AppContext,
    options: &LiveSkillExecuteOptions,
) -> Result<String, RpcError> {
    if let Some(workspace_id) = options
        .workspace_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(workspace_id.to_string());
    }
    let state = ctx.state.read().await;
    state
        .workspaces
        .first()
        .map(|workspace| workspace.id.clone())
        .ok_or_else(|| RpcError::invalid_params("Research orchestration requires a workspace context."))
}

fn build_research_sub_agent_instruction(
    workspace_id: &str,
    sub_query: &str,
    options: &LiveSkillExecuteOptions,
) -> String {
    let mut instruction_options = serde_json::Map::from_iter([(
        "workspaceId".to_string(),
        Value::String(workspace_id.to_string()),
    )]);
    instruction_options.insert(
        "allowNetwork".to_string(),
        Value::Bool(options.allow_network.unwrap_or(true)),
    );
    instruction_options.insert(
        "fetchPageContent".to_string(),
        Value::Bool(options.fetch_page_content.unwrap_or(true)),
    );
    if let Some(max_results) = options.max_results {
        instruction_options.insert("maxResults".to_string(), Value::Number(max_results.into()));
    }
    if let Some(max_chars_per_result) = options.max_chars_per_result {
        instruction_options.insert(
            "maxCharsPerResult".to_string(),
            Value::Number(max_chars_per_result.into()),
        );
    }
    if let Some(recency_days) = options.recency_days {
        instruction_options.insert("recencyDays".to_string(), Value::Number(recency_days.into()));
    }
    if let Some(prefer_domains) = options.prefer_domains.as_ref().filter(|domains| !domains.is_empty()) {
        instruction_options.insert("preferDomains".to_string(), json!(prefer_domains));
    }
    if let Some(workspace_context_paths) = options
        .workspace_context_paths
        .as_ref()
        .filter(|paths| !paths.is_empty())
    {
        instruction_options.insert(
            "workspaceContextPaths".to_string(),
            json!(workspace_context_paths),
        );
    }
    if let Some(timeout_ms) = options.timeout_ms {
        instruction_options.insert("timeoutMs".to_string(), Value::Number(timeout_ms.into()));
    }

    json!({
        "query": sub_query,
        "options": instruction_options,
    })
    .to_string()
}

fn resolve_research_sub_agent_wait_timeout_ms(
    ctx: &AppContext,
    options: &LiveSkillExecuteOptions,
) -> u64 {
    options
        .timeout_ms
        .unwrap_or_else(|| ctx.config.live_skills_network_timeout_ms.saturating_mul(4))
        .clamp(1_000, 300_000)
}

async fn read_research_sub_agent_status(
    ctx: &AppContext,
    session_id: &str,
    fallback: Option<Value>,
) -> Value {
    crate::sub_agents::handle_sub_agent_status(
        ctx,
        &json!({
            "sessionId": session_id,
        }),
    )
    .await
    .ok()
    .or(fallback)
    .unwrap_or(Value::Null)
}

fn build_research_session_projection(
    workspace_id: &str,
    run_id: &str,
    sub_query: &str,
    options: &LiveSkillExecuteOptions,
    session_id: Option<&str>,
    status: &str,
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> Value {
    json!({
        "sessionId": session_id,
        "workspaceId": workspace_id,
        "title": format!("research: {sub_query}"),
        "status": status,
        "accessMode": "read-only",
        "scopeProfile": "research",
        "profileDescriptor": {
            "profile": "research",
            "allowNetwork": options.allow_network.unwrap_or(true),
            "allowedSkillIds": DEFAULT_RESEARCH_ALLOWED_SKILL_IDS,
            "workspaceReadPaths": options.workspace_context_paths.clone().unwrap_or_default(),
            "writableRoots": [],
            "maxTaskMs": 900000,
            "maxDepth": 1,
            "approvalMode": "read_only_safe",
            "readOnly": true,
            "description": "Read-only research profile with bounded live-skill access.",
        },
        "allowedSkillIds": DEFAULT_RESEARCH_ALLOWED_SKILL_IDS,
        "allowNetwork": options.allow_network.unwrap_or(true),
        "workspaceReadPaths": options.workspace_context_paths.clone().unwrap_or_default(),
        "parentRunId": run_id,
        "activeTaskId": Value::Null,
        "lastTaskId": Value::Null,
        "checkpointId": Value::Null,
        "traceId": session_id.map(|value| format!("sub-agent:{value}")),
        "recovered": false,
        "checkpointState": build_live_skill_checkpoint_state(
            if status == "interrupted" { "timed_out" } else { "failed" },
            status,
            None,
            session_id.map(|value| format!("sub-agent:{value}")).as_deref(),
            false,
            Some(now_ms()),
        ),
        "approvalEvents": [],
        "compactionSummary": build_research_compaction_summary(),
        "evalTags": build_live_skill_eval_tags(BUILTIN_LIVE_NETWORK_SKILL_ID, "research", &[]),
        "errorCode": error_code,
        "errorMessage": error_message,
    })
}

fn build_research_child_failure_result(
    ctx: &AppContext,
    options: &LiveSkillExecuteOptions,
    status: &str,
    message: &str,
) -> LiveSkillExecutionResult {
    LiveSkillExecutionResult {
        run_id: new_id("live-skill-run"),
        skill_id: BUILTIN_LIVE_NETWORK_SKILL_ID.to_string(),
        status: status.to_string(),
        message: message.to_string(),
        output: String::new(),
        network: None,
        artifacts: vec![],
        metadata: json!({
            "profileUsed": "research",
            "approvalEvents": [],
            "checkpointState": build_live_skill_checkpoint_state(
                if status == "interrupted" { "timed_out" } else { "failed" },
                status,
                None,
                Some(format!("live-skill-run:{}", new_id("trace")).as_str()),
                false,
                Some(now_ms()),
            ),
            "compactionSummary": build_research_compaction_summary(),
            "evalTags": build_live_skill_eval_tags(BUILTIN_LIVE_NETWORK_SKILL_ID, "research", &[]),
            "providerDiagnostics": {
                "provider": infer_live_skill_network_provider(ctx.config.live_skills_network_base_url.as_str()),
                "strategy": if options.fetch_page_content.unwrap_or(true) { "search+content" } else { "search-only" },
                "contentFetchEnabled": options.fetch_page_content.unwrap_or(true),
                "contentFetchCount": 0,
                "reasonCodes": [if options.fetch_page_content.unwrap_or(true) {
                    "research-search-content"
                } else {
                    "research-search-only"
                }],
            }
        }),
    }
}

fn build_research_child_result(
    ctx: &AppContext,
    options: &LiveSkillExecuteOptions,
    sub_query: &str,
    session: &Value,
    task: Option<&Value>,
) -> LiveSkillExecutionResult {
    let task_status = task
        .and_then(|value| value.get("status"))
        .and_then(Value::as_str);
    let session_status = session.get("status").and_then(Value::as_str);
    let status = task_status
        .or(session_status)
        .unwrap_or("failed")
        .to_string();

    let mut metadata = task
        .and_then(|value| value.get("steps"))
        .and_then(Value::as_array)
        .and_then(|steps| steps.first())
        .and_then(|step| step.get("metadata"))
        .cloned()
        .unwrap_or_else(|| json!({}));
    let network = metadata
        .as_object_mut()
        .and_then(|metadata_object| metadata_object.remove("network"))
        .and_then(|value| serde_json::from_value::<LiveSkillNetworkResult>(value).ok());
    let run_id = task
        .and_then(|value| value.get("steps"))
        .and_then(Value::as_array)
        .and_then(|steps| steps.first())
        .and_then(|step| step.get("runId"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| new_id("live-skill-run"));
    let output = task
        .and_then(|value| value.get("steps"))
        .and_then(Value::as_array)
        .and_then(|steps| steps.first())
        .and_then(|step| step.get("output"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let message = task
        .and_then(|value| value.get("steps"))
        .and_then(Value::as_array)
        .and_then(|steps| steps.first())
        .and_then(|step| step.get("message"))
        .and_then(Value::as_str)
        .or_else(|| task.and_then(|value| value.get("errorMessage")).and_then(Value::as_str))
        .or_else(|| session.get("errorMessage").and_then(Value::as_str))
        .unwrap_or_else(|| {
            if status == "completed" {
                "Research child session completed."
            } else {
                "Research child session failed."
            }
        })
        .to_string();

    if task.is_none() && status != "completed" {
        return build_research_child_failure_result(ctx, options, status.as_str(), message.as_str());
    }

    let message = if message.trim().is_empty() {
        if status == "completed" {
            format!("Research child session completed for `{sub_query}`.")
        } else {
            format!("Research child session failed for `{sub_query}`.")
        }
    } else {
        message
    };
    let profile_used = session
        .get("scopeProfile")
        .and_then(Value::as_str)
        .unwrap_or("research")
        .to_string();
    let approval_events = session
        .get("approvalEvents")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let checkpoint_state = session
        .get("checkpointState")
        .cloned()
        .unwrap_or_else(|| {
            build_live_skill_checkpoint_state(
                if status == "completed" { "completed" } else { "failed" },
                status.as_str(),
                session.get("checkpointId").and_then(Value::as_str),
                session.get("traceId").and_then(Value::as_str),
                session
                    .get("recovered")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                session.get("updatedAt").and_then(Value::as_u64),
            )
        });
    let compaction_summary = summarize_compaction_summary(&metadata);
    let eval_tags = build_live_skill_eval_tags(
        BUILTIN_LIVE_NETWORK_SKILL_ID,
        profile_used.as_str(),
        &[format!("query:{sub_query}")],
    );
    if let Some(metadata_object) = metadata.as_object_mut() {
        metadata_object.insert("profileUsed".to_string(), Value::String(profile_used));
        metadata_object.insert("approvalEvents".to_string(), approval_events);
        metadata_object.insert("checkpointState".to_string(), checkpoint_state);
        metadata_object.insert("compactionSummary".to_string(), compaction_summary.clone());
        metadata_object.insert("evalTags".to_string(), json!(eval_tags));
        insert_live_skill_context_observability(
            metadata_object,
            "research-session",
            session
                .get("sessionId")
                .and_then(Value::as_str)
                .unwrap_or(sub_query),
            metadata_object
                .get("checkpointState")
                .and_then(|value| value.get("updatedAt"))
                .and_then(Value::as_u64),
            &compaction_summary,
            Some(format!(
                "runtime://research-session/{}/context-summary",
                session
                    .get("sessionId")
                    .and_then(Value::as_str)
                    .unwrap_or(sub_query)
            )),
        );
    }

    LiveSkillExecutionResult {
        run_id,
        skill_id: BUILTIN_LIVE_NETWORK_SKILL_ID.to_string(),
        status,
        message,
        output,
        network,
        artifacts: vec![],
        metadata,
    }
}

fn resolve_research_sub_queries(
    options: &LiveSkillExecuteOptions,
    goal: &str,
    max_sub_queries: usize,
) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut sub_queries = options
        .sub_queries
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .map(|entry| entry.trim())
        .filter(|entry| !entry.is_empty())
        .filter(|entry| seen.insert(entry.to_ascii_lowercase()))
        .take(max_sub_queries)
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if sub_queries.is_empty() {
        sub_queries.push(goal.to_string());
    }
    sub_queries
}

fn normalize_domains(domains: &[String]) -> Vec<String> {
    let mut deduped = HashSet::new();
    let mut normalized = domains
        .iter()
        .map(|entry| entry.trim().to_ascii_lowercase())
        .filter(|entry| !entry.is_empty())
        .filter(|entry| deduped.insert(entry.clone()))
        .collect::<Vec<_>>();
    normalized.sort();
    normalized
}

fn json_citation_to_result_item(value: &Value) -> LiveSkillExecutionResultItem {
    LiveSkillExecutionResultItem {
        title: value
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        url: value
            .get("url")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        snippet: value
            .get("snippet")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        content: value
            .get("contentPreview")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        domain: value
            .get("domain")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        dedupe_key: value
            .get("dedupeKey")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        fetched_at: value.get("fetchedAt").and_then(Value::as_u64),
        published_at: value
            .get("publishedAt")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
    }
}

fn build_research_gaps(
    no_citations: bool,
    dated_citation_count: usize,
    child_failure_count: usize,
    no_domain_preferences: bool,
) -> Vec<String> {
    let mut gaps = Vec::new();
    if no_citations {
        gaps.push("No citations were collected from the configured research queries.".to_string());
    }
    if dated_citation_count == 0 {
        gaps.push("No publication dates were inferred from the collected citations.".to_string());
    }
    if child_failure_count > 0 {
        gaps.push(format!(
            "{child_failure_count} research worker run(s) did not complete successfully."
        ));
    }
    if no_domain_preferences {
        gaps.push("No preferred domains were provided to bias source ranking.".to_string());
    }
    gaps
}

fn format_research_output(
    goal: &str,
    citations: &[Value],
    highlights: &[String],
    gaps: &[String],
) -> String {
    let mut lines = vec![format!("Research summary for \"{goal}\":")];
    if highlights.is_empty() {
        lines.push("No highlights available.".to_string());
    } else {
        for (index, highlight) in highlights.iter().enumerate() {
            lines.push(format!("{}. {}", index + 1, highlight));
        }
    }
    if !citations.is_empty() {
        lines.push("Sources:".to_string());
        for citation in citations.iter().take(5) {
            let title = citation
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("Untitled");
            let url = citation.get("url").and_then(Value::as_str).unwrap_or("n/a");
            lines.push(format!("- {title} ({url})"));
        }
    }
    if !gaps.is_empty() {
        lines.push("Gaps:".to_string());
        for gap in gaps {
            lines.push(format!("- {gap}"));
        }
    }
    lines.join("\n")
}

fn sorted_strings(values: HashSet<String>) -> Vec<String> {
    let mut entries = values.into_iter().collect::<Vec<_>>();
    entries.sort();
    entries
}
