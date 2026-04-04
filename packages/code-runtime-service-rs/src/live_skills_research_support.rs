use super::*;

pub(super) fn build_live_skill_eval_tags(
    skill_id: &str,
    scope_profile: &str,
    extra_tags: &[String],
) -> Vec<String> {
    let mut tags = vec![
        "mode:runtime".to_string(),
        format!("skill:{skill_id}"),
        format!("scope:{scope_profile}"),
    ];
    for tag in extra_tags {
        if !tags.contains(tag) {
            tags.push(tag.clone());
        }
    }
    tags.sort();
    tags
}

pub(super) fn build_live_skill_checkpoint_state(
    state: &str,
    lifecycle_state: &str,
    checkpoint_id: Option<&str>,
    trace_id: Option<&str>,
    recovered: bool,
    updated_at: Option<u64>,
) -> Value {
    json!({
        "state": state,
        "lifecycleState": lifecycle_state,
        "checkpointId": checkpoint_id,
        "traceId": trace_id,
        "recovered": recovered,
        "updatedAt": updated_at,
    })
}

pub(super) fn build_research_compaction_summary() -> Value {
    json!({
        "triggered": false,
        "executed": false,
        "source": Value::Null,
        "compressedSteps": Value::Null,
        "bytesReduced": Value::Null,
        "keepRecentSteps": Value::Null,
        "summaryMaxChars": Value::Null,
        "executionError": Value::Null,
        "preservedRangeIds": Value::Null,
        "recentSuffixRangeIds": Value::Null,
        "offloadRefs": Value::Null,
    })
}

pub(super) fn summarize_compaction_summary(metadata: &Value) -> Value {
    let Some(compaction) = metadata.get("contextCompression").and_then(Value::as_object) else {
        return build_research_compaction_summary();
    };
    json!({
        "triggered": compaction.get("triggered").and_then(Value::as_bool).unwrap_or(false),
        "executed": compaction.get("executed").and_then(Value::as_bool).unwrap_or(false),
        "source": compaction.get("triggerSource"),
        "compressedSteps": compaction.get("compressedSteps"),
        "bytesReduced": compaction.get("bytesReduced"),
        "keepRecentSteps": compaction.get("keepRecentSteps"),
        "summaryMaxChars": compaction.get("summaryMaxChars"),
        "executionError": compaction.get("executionError"),
        "preservedRangeIds": Value::Null,
        "recentSuffixRangeIds": Value::Null,
        "offloadRefs": Value::Null,
    })
}

fn push_unique_projection_values(values: &mut Vec<String>, value: Option<&Value>) {
    if let Some(entries) = value.and_then(Value::as_array) {
        for entry in entries {
            if let Some(entry) = entry.as_str().map(str::trim).filter(|entry| !entry.is_empty()) {
                let normalized = entry.to_string();
                if !values.iter().any(|current| current == &normalized) {
                    values.push(normalized);
                }
            }
        }
    }
}

fn resolve_compaction_sort_key(session: &Value) -> u64 {
    session
        .get("contextBoundary")
        .and_then(|value| value.get("updatedAt"))
        .and_then(Value::as_u64)
        .or_else(|| {
            session
                .get("checkpointState")
                .and_then(|value| value.get("updatedAt"))
                .and_then(Value::as_u64)
        })
        .or_else(|| session.get("updatedAt").and_then(Value::as_u64))
        .unwrap_or(0)
}

pub(super) fn insert_live_skill_context_observability(
    metadata_object: &mut serde_json::Map<String, Value>,
    scope_prefix: &str,
    scope_id: &str,
    updated_at: Option<u64>,
    compaction_summary: &Value,
    summary_ref: Option<String>,
) {
    let (context_boundary, context_projection) =
        crate::runtime_context_compaction::derive_live_skill_context_observability(
            scope_prefix,
            scope_id,
            updated_at,
            compaction_summary,
            summary_ref,
        );
    let (Some(context_boundary), Some(context_projection)) = (context_boundary, context_projection)
    else {
        return;
    };
    metadata_object.insert("contextBoundary".to_string(), context_boundary);
    metadata_object.insert("contextProjection".to_string(), context_projection);
}

pub(super) fn aggregate_approval_events(sessions: &[Value]) -> Vec<Value> {
    let mut events = sessions
        .iter()
        .filter_map(|session| session.get("approvalEvents").and_then(Value::as_array))
        .flatten()
        .cloned()
        .collect::<Vec<_>>();
    events.sort_by(|left, right| {
        left.get("at")
            .and_then(Value::as_u64)
            .cmp(&right.get("at").and_then(Value::as_u64))
    });
    events
}

pub(super) fn aggregate_compaction_summaries(sessions: &[Value]) -> Value {
    let session_summaries = sessions
        .iter()
        .filter_map(|session| {
            session
                .get("compactionSummary")
                .filter(|summary| summary.is_object())
                .map(|summary| (session, summary))
        })
        .collect::<Vec<_>>();
    if session_summaries.is_empty() {
        return build_research_compaction_summary();
    }
    let triggered = session_summaries
        .iter()
        .any(|(_, summary)| summary.get("triggered").and_then(Value::as_bool).unwrap_or(false));
    let executed = session_summaries
        .iter()
        .any(|(_, summary)| summary.get("executed").and_then(Value::as_bool).unwrap_or(false));
    let compressed_steps = session_summaries
        .iter()
        .filter_map(|(_, summary)| summary.get("compressedSteps").and_then(Value::as_u64))
        .sum::<u64>();
    let bytes_reduced = session_summaries
        .iter()
        .filter_map(|(_, summary)| summary.get("bytesReduced").and_then(Value::as_u64))
        .sum::<u64>();
    let keep_recent_steps = session_summaries
        .iter()
        .filter_map(|(_, summary)| summary.get("keepRecentSteps").and_then(Value::as_u64))
        .max();
    let summary_max_chars = session_summaries
        .iter()
        .filter_map(|(_, summary)| summary.get("summaryMaxChars").and_then(Value::as_u64))
        .max();
    let mut source: Option<Value> = None;
    let mut execution_error: Option<String> = None;
    let mut latest_source_at = 0_u64;
    let mut latest_error_at = 0_u64;
    let mut preserved_range_ids = Vec::new();
    let mut recent_suffix_range_ids = Vec::new();
    let mut offload_refs = Vec::new();

    for (session, summary) in &session_summaries {
        let sort_key = resolve_compaction_sort_key(session);
        if let Some(source_value) = summary.get("source").filter(|value| !value.is_null()) {
            if sort_key >= latest_source_at {
                source = Some(source_value.clone());
                latest_source_at = sort_key;
            }
        }
        if let Some(error_value) = summary
            .get("executionError")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
        {
            if sort_key >= latest_error_at {
                execution_error = Some(error_value.to_string());
                latest_error_at = sort_key;
            }
        }

        push_unique_projection_values(
            &mut preserved_range_ids,
            session
                .get("contextProjection")
                .and_then(|value| value.get("preservedRangeIds")),
        );
        push_unique_projection_values(
            &mut preserved_range_ids,
            session
                .get("contextBoundary")
                .and_then(|value| value.get("preservedRangeIds")),
        );
        push_unique_projection_values(
            &mut recent_suffix_range_ids,
            session
                .get("contextProjection")
                .and_then(|value| value.get("recentSuffixRangeIds")),
        );
        push_unique_projection_values(
            &mut offload_refs,
            session
                .get("contextProjection")
                .and_then(|value| value.get("offloadRefs")),
        );
        push_unique_projection_values(
            &mut offload_refs,
            session
                .get("contextBoundary")
                .and_then(|value| value.get("offloadRefs")),
        );
    }

    json!({
        "triggered": triggered,
        "executed": executed,
        "source": source.unwrap_or(Value::Null),
        "compressedSteps": compressed_steps,
        "bytesReduced": bytes_reduced,
        "keepRecentSteps": keep_recent_steps,
        "summaryMaxChars": summary_max_chars,
        "executionError": execution_error,
        "preservedRangeIds": if preserved_range_ids.is_empty() { Value::Null } else { json!(preserved_range_ids) },
        "recentSuffixRangeIds": if recent_suffix_range_ids.is_empty() { Value::Null } else { json!(recent_suffix_range_ids) },
        "offloadRefs": if offload_refs.is_empty() { Value::Null } else { json!(offload_refs) },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregate_compaction_summaries_preserves_latest_context_projection_metadata() {
        let sessions = vec![
            json!({
                "checkpointState": { "updatedAt": 10 },
                "compactionSummary": {
                    "triggered": true,
                    "executed": true,
                    "source": "payload_bytes",
                    "compressedSteps": 1,
                    "bytesReduced": 64,
                    "keepRecentSteps": 1,
                    "summaryMaxChars": 120,
                    "executionError": Value::Null,
                },
                "contextBoundary": {
                    "updatedAt": 10,
                    "preservedRangeIds": ["session:a"],
                    "offloadRefs": ["turn://tool-a/output"],
                },
                "contextProjection": {
                    "recentSuffixRangeIds": ["session:a:recent"],
                    "preservedRangeIds": ["session:a", "session:a:recent"],
                    "offloadRefs": ["turn://tool-a/output"],
                },
            }),
            json!({
                "checkpointState": { "updatedAt": 20 },
                "compactionSummary": {
                    "triggered": true,
                    "executed": false,
                    "source": "tool_output",
                    "compressedSteps": 2,
                    "bytesReduced": 128,
                    "keepRecentSteps": 3,
                    "summaryMaxChars": 240,
                    "executionError": "compaction failed",
                },
                "contextBoundary": {
                    "updatedAt": 20,
                    "preservedRangeIds": ["session:b"],
                },
                "contextProjection": {
                    "recentSuffixRangeIds": ["session:b:recent"],
                    "preservedRangeIds": ["session:b", "session:b:recent"],
                },
            }),
        ];

        let aggregated = aggregate_compaction_summaries(&sessions);
        assert_eq!(aggregated["triggered"], json!(true));
        assert_eq!(aggregated["executed"], json!(true));
        assert_eq!(aggregated["source"], json!("tool_output"));
        assert_eq!(aggregated["compressedSteps"], json!(3));
        assert_eq!(aggregated["bytesReduced"], json!(192));
        assert_eq!(aggregated["keepRecentSteps"], json!(3));
        assert_eq!(aggregated["summaryMaxChars"], json!(240));
        assert_eq!(aggregated["executionError"], json!("compaction failed"));
        assert_eq!(
            aggregated["recentSuffixRangeIds"],
            json!(["session:a:recent", "session:b:recent"])
        );
        assert_eq!(
            aggregated["offloadRefs"],
            json!(["turn://tool-a/output"])
        );
    }
}

#[derive(Debug, Clone)]
pub(super) struct ResearchExecutionPolicy {
    pub(super) fetch_page_content: bool,
    pub(super) strategy: &'static str,
    pub(super) network_provider: String,
    pub(super) caller_provider: String,
    pub(super) caller_model_id: Option<String>,
    pub(super) policy_source: &'static str,
    pub(super) requested_max_parallel: usize,
    pub(super) effective_max_parallel: usize,
    pub(super) reason_codes: Vec<String>,
}

pub(super) fn resolve_research_execution_policy(
    options: &LiveSkillExecuteOptions,
    context: Option<&LiveSkillExecuteContext>,
    network_base_url: &str,
) -> ResearchExecutionPolicy {
    let fetch_policy =
        resolve_live_skill_fetch_page_content_policy(context, options.fetch_page_content, true);
    let fetch_page_content = fetch_policy.fetch_page_content;
    let requested_max_parallel = normalize_optional_usize(
        options.max_parallel,
        DEFAULT_RESEARCH_MAX_PARALLEL,
        1,
        MAX_RESEARCH_MAX_PARALLEL,
    );
    let strategy = if fetch_page_content {
        "search+content"
    } else {
        "search-only"
    };
    let mut reason_codes = build_live_skill_fetch_reason_codes(strategy, &fetch_policy);
    let effective_max_parallel = if fetch_page_content {
        let capped_parallelism = requested_max_parallel.min(2);
        if capped_parallelism < requested_max_parallel {
            reason_codes.push("content-fetch-capped-parallelism".to_string());
        }
        capped_parallelism
    } else {
        requested_max_parallel
    };

    ResearchExecutionPolicy {
        fetch_page_content,
        strategy,
        network_provider: infer_live_skill_network_provider(network_base_url),
        caller_provider: fetch_policy.caller_provider,
        caller_model_id: fetch_policy.caller_model_id,
        policy_source: fetch_policy.policy_source,
        requested_max_parallel,
        effective_max_parallel,
        reason_codes,
    }
}

pub(super) fn build_research_provider_diagnostics(
    providers: Vec<String>,
    strategies: Vec<String>,
    allow_network: bool,
    policy: &ResearchExecutionPolicy,
    recency_days: Option<u64>,
    prefer_domains: &[String],
    workspace_context_paths: &[String],
    child_failure_count: Option<usize>,
) -> Value {
    let mut diagnostics = json!({
        "providers": providers,
        "strategies": strategies,
        "allowNetwork": allow_network,
        "maxParallel": policy.effective_max_parallel,
        "requestedMaxParallel": policy.requested_max_parallel,
        "effectiveMaxParallel": policy.effective_max_parallel,
        "reasonCodes": policy.reason_codes.clone(),
        "recencyDays": recency_days,
        "fetchPageContent": policy.fetch_page_content,
        "callerProvider": policy.caller_provider,
        "callerModelId": policy.caller_model_id,
        "policySource": policy.policy_source,
        "preferredDomains": prefer_domains,
        "workspaceContextPaths": workspace_context_paths,
    });
    if let Some(child_failure_count) = child_failure_count {
        diagnostics["childFailureCount"] = Value::Number((child_failure_count as u64).into());
    }
    diagnostics
}
