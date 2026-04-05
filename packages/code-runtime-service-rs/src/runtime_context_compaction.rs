use super::*;

const DEFAULT_APPROX_BYTES_PER_TOKEN: u64 = 4;

#[derive(Default)]
struct TaskContextDerivation {
    trigger: Option<String>,
    phase: String,
    updated_at: u64,
    compressed_steps: u64,
    bytes_reduced: u64,
    keep_recent_steps: Option<u64>,
    summary_max_chars: Option<u64>,
    execution_error: Option<String>,
    original_bytes: u64,
    projected_bytes: u64,
    payload_bytes: Option<u64>,
    summary_ref: Option<String>,
    preserved_range_ids: Vec<String>,
    recent_suffix_range_ids: Vec<String>,
    offload_refs: Vec<String>,
    has_signal: bool,
}

impl TaskContextDerivation {
    fn new(summary: &AgentTaskSummary) -> Self {
        Self {
            phase: "mid_turn".to_string(),
            updated_at: summary.updated_at,
            summary_ref: Some(format!(
                "runtime://agent-task/{}/context-summary",
                summary.task_id
            )),
            ..Self::default()
        }
    }
}

fn approx_tokens(bytes: u64) -> Option<u64> {
    (bytes > 0).then(|| bytes.div_ceil(DEFAULT_APPROX_BYTES_PER_TOKEN))
}

fn trim_optional_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn collect_string_array(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn push_unique_value(values: &mut Vec<String>, value: String) {
    if !values.iter().any(|current| current == &value) {
        values.push(value);
    }
}

fn to_hex_digest(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        write!(&mut hex, "{byte:02x}").expect("write hex digest");
    }
    hex
}

fn normalize_boundary_trigger(value: Option<&str>) -> &'static str {
    match value.unwrap_or("").trim() {
        "payload_bytes" => "payload_bytes",
        "consecutive_failures" => "consecutive_failures",
        "session_length" => "session_length",
        "tool_output" => "tool_output",
        "manual" => "manual",
        "sub_agent_spawn" => "sub_agent_spawn",
        "resume" => "resume",
        _ => "unknown",
    }
}

fn normalize_boundary_phase(trigger: &str, fallback: &'static str) -> &'static str {
    match trigger {
        "manual" => "manual",
        "sub_agent_spawn" => "spawn",
        "resume" => "resume",
        "payload_bytes" | "consecutive_failures" | "session_length" | "tool_output" => "mid_turn",
        _ => fallback,
    }
}

fn derive_projection_fingerprint(
    boundary_id: &str,
    summary_ref: Option<&str>,
    preserved_range_ids: &[String],
    recent_suffix_range_ids: &[String],
    offload_refs: &[String],
    updated_at: u64,
) -> String {
    to_hex_digest(
        json!({
            "boundaryId": boundary_id,
            "summaryRef": summary_ref,
            "preservedRangeIds": preserved_range_ids,
            "recentSuffixRangeIds": recent_suffix_range_ids,
            "offloadRefs": offload_refs,
            "updatedAt": updated_at,
        })
        .to_string()
        .as_str(),
    )
}

fn derive_boundary_status(
    has_execution_error: bool,
    has_offload_refs: bool,
    compressed_steps: u64,
    has_signal: bool,
) -> &'static str {
    if has_execution_error {
        return "failed";
    }
    if has_offload_refs {
        return "offloaded";
    }
    if compressed_steps > 0 {
        return "compacted";
    }
    if has_signal {
        return "active";
    }
    "pending"
}

fn build_boundary_id(scope_prefix: &str, scope_id: &str, updated_at: u64) -> String {
    format!("runtime-context-boundary:{scope_prefix}:{scope_id}:{updated_at}")
}

fn maybe_finalize_task_recent_suffix_ranges(
    derivation: &mut TaskContextDerivation,
    total_steps: usize,
) {
    if derivation.recent_suffix_range_ids.is_empty() {
        if let Some(keep_recent_steps) = derivation
            .keep_recent_steps
            .and_then(|value| usize::try_from(value).ok())
        {
            if total_steps > 0 && keep_recent_steps > 0 {
                let start = total_steps.saturating_sub(keep_recent_steps);
                for index in start..total_steps {
                    push_unique_value(
                        &mut derivation.recent_suffix_range_ids,
                        format!("step:{index}"),
                    );
                }
            }
        }
    }
    if derivation.recent_suffix_range_ids.is_empty() && total_steps > 0 {
        push_unique_value(
            &mut derivation.recent_suffix_range_ids,
            format!("step:{}", total_steps.saturating_sub(1)),
        );
    }
    for value in derivation.recent_suffix_range_ids.clone() {
        push_unique_value(&mut derivation.preserved_range_ids, value);
    }
}

pub(crate) fn derive_agent_task_context_observability(
    summary: &AgentTaskSummary,
) -> (Option<Value>, Option<Value>, Option<Value>) {
    let mut derivation = TaskContextDerivation::new(summary);
    let mut latest_trigger_at = 0_u64;

    for step in &summary.steps {
        let context_compression = step
            .metadata
            .get("contextCompression")
            .and_then(Value::as_object);
        if let Some(context_compression) = context_compression {
            let triggered = context_compression
                .get("triggered")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let compressed = context_compression
                .get("compressed")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if triggered || compressed {
                derivation.has_signal = true;
                derivation.updated_at = derivation.updated_at.max(step.updated_at);
                push_unique_value(
                    &mut derivation.preserved_range_ids,
                    format!("step:{}", step.index),
                );
            }
            if triggered && step.updated_at >= latest_trigger_at {
                latest_trigger_at = step.updated_at;
                derivation.trigger = Some(
                    normalize_boundary_trigger(
                        context_compression
                            .get("triggerSource")
                            .and_then(Value::as_str),
                    )
                    .to_string(),
                );
                derivation.phase = normalize_boundary_phase(
                    derivation.trigger.as_deref().unwrap_or("unknown"),
                    "mid_turn",
                )
                .to_string();
                derivation.keep_recent_steps = context_compression
                    .get("keepRecentSteps")
                    .and_then(Value::as_u64);
                derivation.summary_max_chars = context_compression
                    .get("summaryMaxChars")
                    .and_then(Value::as_u64);
                derivation.execution_error = trim_optional_string(
                    context_compression
                        .get("executionError")
                        .and_then(Value::as_str),
                );
                derivation.payload_bytes = context_compression
                    .get("payloadBytes")
                    .and_then(Value::as_u64);
            }
            derivation.compressed_steps = derivation.compressed_steps.saturating_add(
                context_compression
                    .get("compressedSteps")
                    .and_then(Value::as_u64)
                    .unwrap_or(0),
            );
            derivation.bytes_reduced = derivation.bytes_reduced.saturating_add(
                context_compression
                    .get("bytesReduced")
                    .and_then(Value::as_u64)
                    .unwrap_or(0),
            );
            if compressed {
                derivation.original_bytes = derivation.original_bytes.saturating_add(
                    context_compression
                        .get("originalBytes")
                        .and_then(Value::as_u64)
                        .unwrap_or_default(),
                );
                derivation.projected_bytes = derivation.projected_bytes.saturating_add(
                    context_compression
                        .get("compressedBytes")
                        .and_then(Value::as_u64)
                        .unwrap_or_default(),
                );
            }
        }

        let compaction_applied = step
            .metadata
            .get("compactionApplied")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if compaction_applied {
            derivation.has_signal = true;
            derivation.updated_at = derivation.updated_at.max(step.updated_at);
            if step.updated_at >= latest_trigger_at {
                latest_trigger_at = step.updated_at;
                derivation.trigger = Some("tool_output".to_string());
                derivation.phase = "mid_turn".to_string();
            }
            derivation.compressed_steps = derivation.compressed_steps.saturating_add(1);
            let output_byte_count = step
                .metadata
                .get("outputByteCount")
                .and_then(Value::as_u64)
                .unwrap_or_else(|| {
                    step.output
                        .as_ref()
                        .map(|value| value.len() as u64)
                        .unwrap_or(0)
                });
            let preview_byte_count = step
                .metadata
                .get("outputPreviewByteCount")
                .and_then(Value::as_u64)
                .unwrap_or(output_byte_count);
            derivation.original_bytes = derivation.original_bytes.saturating_add(output_byte_count);
            derivation.projected_bytes = derivation
                .projected_bytes
                .saturating_add(preview_byte_count);
            derivation.bytes_reduced = derivation
                .bytes_reduced
                .saturating_add(output_byte_count.saturating_sub(preview_byte_count));
            if let Some(reference) = trim_optional_string(
                step.metadata
                    .get("outputCompactionReference")
                    .and_then(Value::as_str),
            ) {
                push_unique_value(&mut derivation.offload_refs, reference);
            }
            push_unique_value(
                &mut derivation.preserved_range_ids,
                format!("step:{}", step.index),
            );
        }
    }

    if !derivation.has_signal {
        return (None, None, None);
    }

    maybe_finalize_task_recent_suffix_ranges(&mut derivation, summary.steps.len());

    if derivation.original_bytes == 0 {
        if let Some(payload_bytes) = derivation.payload_bytes {
            derivation.original_bytes = payload_bytes;
            derivation.projected_bytes = payload_bytes.saturating_sub(derivation.bytes_reduced);
        }
    }

    let trigger = derivation
        .trigger
        .as_deref()
        .map(|value| normalize_boundary_trigger(Some(value)))
        .unwrap_or("unknown");
    let boundary_id = build_boundary_id("task", summary.task_id.as_str(), derivation.updated_at);
    let projection_fingerprint = derive_projection_fingerprint(
        boundary_id.as_str(),
        derivation.summary_ref.as_deref(),
        derivation.preserved_range_ids.as_slice(),
        derivation.recent_suffix_range_ids.as_slice(),
        derivation.offload_refs.as_slice(),
        derivation.updated_at,
    );
    let status = derive_boundary_status(
        derivation.execution_error.is_some(),
        !derivation.offload_refs.is_empty(),
        derivation.compressed_steps,
        derivation.has_signal,
    );

    let boundary = json!({
        "boundaryId": boundary_id,
        "trigger": trigger,
        "phase": normalize_boundary_phase(trigger, "mid_turn"),
        "status": status,
        "preTokens": approx_tokens(derivation.original_bytes),
        "postTokens": approx_tokens(derivation.projected_bytes),
        "preservedRangeIds": derivation.preserved_range_ids,
        "summaryRef": derivation.summary_ref,
        "offloadRefs": if derivation.offload_refs.is_empty() {
            Value::Null
        } else {
            json!(derivation.offload_refs)
        },
        "projectionFingerprint": projection_fingerprint,
        "updatedAt": derivation.updated_at,
    });

    let working_set_summary = format!(
        "Preserved {} recent range(s) with {} offload reference(s).",
        derivation.recent_suffix_range_ids.len(),
        derivation.offload_refs.len()
    );
    let projection = json!({
        "boundaryId": boundary_id,
        "summaryRef": derivation.summary_ref,
        "projectionFingerprint": projection_fingerprint,
        "preservedRangeIds": derivation.preserved_range_ids,
        "recentSuffixRangeIds": derivation.recent_suffix_range_ids,
        "offloadRefs": if derivation.offload_refs.is_empty() {
            Value::Null
        } else {
            json!(derivation.offload_refs)
        },
        "workingSetSummary": working_set_summary,
        "updatedAt": derivation.updated_at,
    });

    let compaction_summary = json!({
        "triggered": true,
        "executed": derivation.execution_error.is_none(),
        "source": trigger,
        "compressedSteps": derivation.compressed_steps,
        "bytesReduced": derivation.bytes_reduced,
        "keepRecentSteps": derivation.keep_recent_steps,
        "summaryMaxChars": derivation.summary_max_chars,
        "executionError": derivation.execution_error,
    });

    (Some(boundary), Some(projection), Some(compaction_summary))
}

pub(crate) fn enrich_agent_task_summary_for_response(
    summary: &AgentTaskSummary,
) -> AgentTaskSummary {
    let (context_boundary, context_projection, compaction_summary) =
        derive_agent_task_context_observability(summary);
    let mut enriched = summary.clone();
    enriched.context_boundary = context_boundary;
    enriched.context_projection = context_projection;
    enriched.compaction_summary = compaction_summary;
    enriched
}

pub(crate) fn derive_live_skill_context_observability(
    scope_prefix: &str,
    scope_id: &str,
    updated_at: Option<u64>,
    legacy_compaction_summary: &Value,
    summary_ref: Option<String>,
) -> (Option<Value>, Option<Value>) {
    let Some(legacy) = legacy_compaction_summary.as_object() else {
        return (None, None);
    };
    let triggered = legacy
        .get("triggered")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let executed = legacy
        .get("executed")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let compressed_steps = legacy
        .get("compressedSteps")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let bytes_reduced = legacy
        .get("bytesReduced")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let execution_error =
        trim_optional_string(legacy.get("executionError").and_then(Value::as_str));
    let offload_refs = collect_string_array(legacy.get("offloadRefs"));
    let mut recent_suffix_range_ids = collect_string_array(legacy.get("recentSuffixRangeIds"));
    let mut preserved_range_ids = collect_string_array(legacy.get("preservedRangeIds"));

    if !triggered
        && !executed
        && compressed_steps == 0
        && bytes_reduced == 0
        && execution_error.is_none()
        && offload_refs.is_empty()
        && recent_suffix_range_ids.is_empty()
        && preserved_range_ids.is_empty()
    {
        return (None, None);
    }

    let trigger = normalize_boundary_trigger(legacy.get("source").and_then(Value::as_str));
    let updated_at = updated_at.unwrap_or_else(now_ms);
    let boundary_id = build_boundary_id(scope_prefix, scope_id, updated_at);
    if recent_suffix_range_ids.is_empty()
        && legacy
            .get("keepRecentSteps")
            .and_then(Value::as_u64)
            .unwrap_or(0)
            > 0
    {
        push_unique_value(&mut recent_suffix_range_ids, "recent-suffix".to_string());
    }
    if preserved_range_ids.is_empty() {
        preserved_range_ids = recent_suffix_range_ids.clone();
    }
    let projection_fingerprint = derive_projection_fingerprint(
        boundary_id.as_str(),
        summary_ref.as_deref(),
        preserved_range_ids.as_slice(),
        recent_suffix_range_ids.as_slice(),
        offload_refs.as_slice(),
        updated_at,
    );
    let status = derive_boundary_status(
        execution_error.is_some(),
        !offload_refs.is_empty(),
        compressed_steps,
        triggered || executed || !offload_refs.is_empty(),
    );
    let boundary = json!({
        "boundaryId": boundary_id,
        "trigger": trigger,
        "phase": normalize_boundary_phase(trigger, "mid_turn"),
        "status": status,
        "preTokens": Value::Null,
        "postTokens": Value::Null,
        "preservedRangeIds": if preserved_range_ids.is_empty() {
            Value::Null
        } else {
            json!(preserved_range_ids)
        },
        "summaryRef": summary_ref,
        "offloadRefs": if offload_refs.is_empty() {
            Value::Null
        } else {
            json!(offload_refs)
        },
        "projectionFingerprint": projection_fingerprint,
        "updatedAt": updated_at,
    });
    let working_set_summary = format!(
        "Runtime reused the legacy compaction summary as a context projection with {} recent suffix range(s) and {} offload reference(s).",
        recent_suffix_range_ids.len(),
        offload_refs.len()
    );
    let projection = json!({
        "boundaryId": boundary_id,
        "summaryRef": summary_ref,
        "projectionFingerprint": projection_fingerprint,
        "preservedRangeIds": if preserved_range_ids.is_empty() {
            Value::Null
        } else {
            json!(preserved_range_ids)
        },
        "recentSuffixRangeIds": if recent_suffix_range_ids.is_empty() {
            Value::Null
        } else {
            json!(recent_suffix_range_ids)
        },
        "offloadRefs": if offload_refs.is_empty() {
            Value::Null
        } else {
            json!(offload_refs)
        },
        "workingSetSummary": working_set_summary,
        "updatedAt": updated_at,
    });
    (Some(boundary), Some(projection))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_boundary_status_prioritizes_offloaded_context() {
        assert_eq!(derive_boundary_status(false, true, 2, true), "offloaded");
        assert_eq!(derive_boundary_status(false, false, 2, true), "compacted");
    }

    #[test]
    fn derive_live_skill_context_observability_preserves_suffix_and_offload_refs() {
        let summary = json!({
            "triggered": true,
            "executed": true,
            "source": "tool_output",
            "compressedSteps": 2,
            "bytesReduced": 512,
            "keepRecentSteps": 2,
            "recentSuffixRangeIds": ["recent-suffix:1"],
            "preservedRangeIds": ["session:1", "recent-suffix:1"],
            "offloadRefs": ["turn://tool-1/output"],
        });

        let (boundary, projection) = derive_live_skill_context_observability(
            "research-run",
            "run-1",
            Some(7),
            &summary,
            Some("runtime://research-run/run-1/context-summary".to_string()),
        );

        let boundary = boundary.expect("expected boundary");
        let projection = projection.expect("expected projection");
        assert_eq!(boundary["status"], json!("offloaded"));
        assert_eq!(boundary["offloadRefs"], json!(["turn://tool-1/output"]));
        assert_eq!(
            projection["recentSuffixRangeIds"],
            json!(["recent-suffix:1"])
        );
        assert_eq!(
            projection["preservedRangeIds"],
            json!(["session:1", "recent-suffix:1"])
        );
    }
}
