use super::*;

const DEFAULT_CONTEXT_COMPRESSION_TRIGGER_BYTES: u64 = 24 * 1024;
const MIN_CONTEXT_COMPRESSION_TRIGGER_BYTES: u64 = 1024;
const DEFAULT_CONTEXT_COMPRESSION_FAILURE_STREAK_THRESHOLD: u64 = 2;
pub(crate) const DEFAULT_CONTEXT_COMPRESSION_LONG_SESSION_STEP_THRESHOLD: usize = 8;
const MIN_CONTEXT_COMPRESSION_LONG_SESSION_STEP_THRESHOLD: usize = 1;
const DEFAULT_CONTEXT_COMPRESSION_KEEP_RECENT_STEPS: usize = 3;
const DEFAULT_CONTEXT_COMPRESSION_SUMMARY_MAX_CHARS: usize = 240;
const MIN_CONTEXT_COMPRESSION_SUMMARY_MAX_CHARS: usize = 64;
const MAX_CONTEXT_COMPRESSION_SUMMARY_MAX_CHARS: usize = 2_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ContextCompressionTriggerSource {
    PayloadBytes,
    ConsecutiveFailures,
    SessionLength,
}

impl ContextCompressionTriggerSource {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::PayloadBytes => "payload_bytes",
            Self::ConsecutiveFailures => "consecutive_failures",
            Self::SessionLength => "session_length",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ContextCompressionTrigger {
    pub(crate) source: ContextCompressionTriggerSource,
    pub(crate) payload_bytes: u64,
    pub(crate) threshold_bytes: u64,
    pub(crate) consecutive_failures: u64,
    pub(crate) consecutive_failure_threshold: u64,
    pub(crate) session_step_count: usize,
    pub(crate) long_session_threshold: usize,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct ContextCompressionExecutionResult {
    compressed_steps: u64,
    original_bytes: u64,
    compressed_bytes: u64,
}

fn context_compression_trigger_threshold_bytes() -> u64 {
    std::env::var("CODE_RUNTIME_AUTONOMY_CONTEXT_COMPRESSION_TRIGGER_BYTES")
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| value.max(MIN_CONTEXT_COMPRESSION_TRIGGER_BYTES))
        .unwrap_or(DEFAULT_CONTEXT_COMPRESSION_TRIGGER_BYTES)
}

fn context_compression_failure_streak_threshold() -> u64 {
    std::env::var("CODE_RUNTIME_AUTONOMY_CONTEXT_COMPRESSION_FAILURE_STREAK")
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| value.max(1))
        .unwrap_or(DEFAULT_CONTEXT_COMPRESSION_FAILURE_STREAK_THRESHOLD)
}

fn context_compression_long_session_step_threshold() -> usize {
    std::env::var("CODE_RUNTIME_AUTONOMY_CONTEXT_COMPRESSION_SESSION_STEP_THRESHOLD")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .map(|value| value.max(MIN_CONTEXT_COMPRESSION_LONG_SESSION_STEP_THRESHOLD))
        .unwrap_or(DEFAULT_CONTEXT_COMPRESSION_LONG_SESSION_STEP_THRESHOLD)
}

fn context_compression_keep_recent_steps() -> usize {
    std::env::var("CODE_RUNTIME_AUTONOMY_CONTEXT_COMPRESSION_KEEP_RECENT_STEPS")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .map(|value| value.max(1))
        .unwrap_or(DEFAULT_CONTEXT_COMPRESSION_KEEP_RECENT_STEPS)
}

fn context_compression_summary_max_chars() -> usize {
    std::env::var("CODE_RUNTIME_AUTONOMY_CONTEXT_COMPRESSION_SUMMARY_MAX_CHARS")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .map(|value| {
            value.clamp(
                MIN_CONTEXT_COMPRESSION_SUMMARY_MAX_CHARS,
                MAX_CONTEXT_COMPRESSION_SUMMARY_MAX_CHARS,
            )
        })
        .unwrap_or(DEFAULT_CONTEXT_COMPRESSION_SUMMARY_MAX_CHARS)
}

fn summarize_context_compression_text(value: &str, max_chars: usize) -> String {
    let normalized = value
        .split_whitespace()
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    if normalized.is_empty() {
        return String::new();
    }

    let mut truncated = String::new();
    for character in normalized.chars().take(max_chars) {
        truncated.push(character);
    }
    if normalized.chars().count() > max_chars {
        truncated.push_str("...");
    }
    truncated
}

async fn execute_context_compression(
    ctx: &AppContext,
    task_id: &str,
    current_step_index: usize,
) -> Result<ContextCompressionExecutionResult, String> {
    let keep_recent_steps = context_compression_keep_recent_steps();
    let summary_max_chars = context_compression_summary_max_chars();
    let compression_upper_bound = current_step_index.saturating_sub(keep_recent_steps);
    if compression_upper_bound == 0 {
        return Ok(ContextCompressionExecutionResult::default());
    }

    let mut store = ctx.agent_tasks.write().await;
    let task = store
        .tasks
        .get_mut(task_id)
        .ok_or_else(|| format!("task `{task_id}` not found during context compression"))?;
    let mut result = ContextCompressionExecutionResult::default();
    let compressed_at = now_ms();

    for (index, step_summary) in task.summary.steps.iter_mut().enumerate() {
        if index >= compression_upper_bound {
            break;
        }

        let already_compressed = step_summary
            .metadata
            .get("contextCompression")
            .and_then(|value| value.get("compressed"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if already_compressed {
            continue;
        }

        let Some(output) = step_summary.output.clone() else {
            continue;
        };
        if output.trim().is_empty() {
            continue;
        }
        let summary = summarize_context_compression_text(output.as_str(), summary_max_chars);
        if summary.is_empty() {
            continue;
        }

        let original_bytes = u64::try_from(output.len()).unwrap_or(u64::MAX);
        let compressed_output = format!("[compressed-output] {summary}");
        let compressed_bytes = u64::try_from(compressed_output.len()).unwrap_or(u64::MAX);
        step_summary.output = Some(compressed_output);
        step_summary.updated_at = compressed_at;

        let mut metadata = if step_summary.metadata.is_object() {
            step_summary.metadata.clone()
        } else {
            json!({})
        };
        if let Some(metadata_object) = metadata.as_object_mut() {
            metadata_object.insert(
                "contextCompression".to_string(),
                json!({
                    "compressed": true,
                    "compressedAt": compressed_at,
                    "originalBytes": original_bytes,
                    "compressedBytes": compressed_bytes,
                    "summaryChars": summary.chars().count(),
                    "summaryMaxChars": summary_max_chars,
                }),
            );
        }
        step_summary.metadata = metadata;

        result.compressed_steps = result.compressed_steps.saturating_add(1);
        result.original_bytes = result.original_bytes.saturating_add(original_bytes);
        result.compressed_bytes = result.compressed_bytes.saturating_add(compressed_bytes);
    }

    Ok(result)
}

fn count_recent_consecutive_failures(
    prior_step_statuses: &[String],
    current_step_completed: bool,
) -> u64 {
    let current_failed = if current_step_completed { 0_u64 } else { 1_u64 };
    if current_failed == 0 {
        return 0;
    }
    let mut failures = 1_u64;
    for status in prior_step_statuses.iter().rev() {
        if status == AgentTaskStatus::Failed.as_str() {
            failures += 1;
            continue;
        }
        break;
    }
    failures
}

pub(crate) fn detect_context_compression_trigger(
    output: Option<&str>,
    metadata: &Value,
    prior_step_statuses: &[String],
    current_step_completed: bool,
    session_step_count: usize,
) -> Option<ContextCompressionTrigger> {
    let threshold_bytes = context_compression_trigger_threshold_bytes();
    let payload_bytes = serde_json::to_vec(&json!({
        "output": output,
        "metadata": metadata,
    }))
    .ok()
    .map(|bytes| bytes.len())
    .and_then(|len| u64::try_from(len).ok())
    .unwrap_or(0);
    let failure_streak_threshold = context_compression_failure_streak_threshold();
    let consecutive_failures =
        count_recent_consecutive_failures(prior_step_statuses, current_step_completed);
    let long_session_threshold = context_compression_long_session_step_threshold();
    if payload_bytes >= threshold_bytes {
        return Some(ContextCompressionTrigger {
            source: ContextCompressionTriggerSource::PayloadBytes,
            payload_bytes,
            threshold_bytes,
            consecutive_failures,
            consecutive_failure_threshold: failure_streak_threshold,
            session_step_count,
            long_session_threshold,
        });
    }
    if consecutive_failures >= failure_streak_threshold {
        return Some(ContextCompressionTrigger {
            source: ContextCompressionTriggerSource::ConsecutiveFailures,
            payload_bytes,
            threshold_bytes,
            consecutive_failures,
            consecutive_failure_threshold: failure_streak_threshold,
            session_step_count,
            long_session_threshold,
        });
    }
    if session_step_count >= long_session_threshold {
        return Some(ContextCompressionTrigger {
            source: ContextCompressionTriggerSource::SessionLength,
            payload_bytes,
            threshold_bytes,
            consecutive_failures,
            consecutive_failure_threshold: failure_streak_threshold,
            session_step_count,
            long_session_threshold,
        });
    }
    None
}

pub(crate) async fn maybe_mark_context_compression(
    ctx: &AppContext,
    task_id: &str,
    step_index: usize,
    total_steps: usize,
    request_id: Option<&str>,
    output: Option<&str>,
    metadata: &mut Value,
    prior_step_statuses: &[String],
    current_step_completed: bool,
    session_step_count: usize,
) {
    let Some(trigger) = detect_context_compression_trigger(
        output,
        metadata,
        prior_step_statuses,
        current_step_completed,
        session_step_count,
    ) else {
        return;
    };
    ctx.runtime_diagnostics
        .record_context_compression_trigger(trigger.payload_bytes, trigger.source.as_str());
    let keep_recent_steps = context_compression_keep_recent_steps();
    let summary_max_chars = context_compression_summary_max_chars();
    let compression_execution = execute_context_compression(ctx, task_id, step_index).await;
    let (compression_result, execution_error) = match compression_execution {
        Ok(result) => (result, None),
        Err(error) => {
            warn!(
                task_id,
                step_index,
                error = error.as_str(),
                "context compression execution failed; continuing with original task context"
            );
            (ContextCompressionExecutionResult::default(), Some(error))
        }
    };
    let bytes_reduced = compression_result
        .original_bytes
        .saturating_sub(compression_result.compressed_bytes);
    let execution_error = execution_error.map(|error| truncate_text_for_error(error.as_str(), 240));
    if let Some(metadata_object) = metadata.as_object_mut() {
        metadata_object.insert(
            "contextCompression".to_string(),
            json!({
                "triggered": true,
                "triggerSource": trigger.source.as_str(),
                "payloadBytes": trigger.payload_bytes,
                "thresholdBytes": trigger.threshold_bytes,
                "consecutiveFailures": trigger.consecutive_failures,
                "failureThreshold": trigger.consecutive_failure_threshold,
                "sessionStepCount": trigger.session_step_count,
                "sessionLengthThreshold": trigger.long_session_threshold,
                "executed": execution_error.is_none(),
                "compressedSteps": compression_result.compressed_steps,
                "bytesReduced": bytes_reduced,
                "keepRecentSteps": keep_recent_steps,
                "summaryMaxChars": summary_max_chars,
                "executionError": execution_error,
            }),
        );
    } else {
        *metadata = json!({
            "contextCompression": {
                "triggered": true,
                "triggerSource": trigger.source.as_str(),
                "payloadBytes": trigger.payload_bytes,
                "thresholdBytes": trigger.threshold_bytes,
                "consecutiveFailures": trigger.consecutive_failures,
                "failureThreshold": trigger.consecutive_failure_threshold,
                "sessionStepCount": trigger.session_step_count,
                "sessionLengthThreshold": trigger.long_session_threshold,
                "executed": execution_error.is_none(),
                "compressedSteps": compression_result.compressed_steps,
                "bytesReduced": bytes_reduced,
                "keepRecentSteps": keep_recent_steps,
                "summaryMaxChars": summary_max_chars,
                "executionError": execution_error,
            },
        });
    }
    let compression_delta = if let Some(error) = metadata
        .get("contextCompression")
        .and_then(|value| value.get("executionError"))
        .and_then(Value::as_str)
    {
        format!(
            "Step {}/{} triggered context compression via {} but execution failed ({}) and continued without compaction.",
            step_index + 1,
            total_steps,
            trigger.source.as_str(),
            error,
        )
    } else {
        format!(
            "Step {}/{} triggered context compression via {} (compressed={} step(s), bytesReduced={}B, payload={}B, failures={}, sessionStep={}).",
            step_index + 1,
            total_steps,
            trigger.source.as_str(),
            compression_result.compressed_steps,
            bytes_reduced,
            trigger.payload_bytes,
            trigger.consecutive_failures,
            trigger.session_step_count,
        )
    };
    publish_turn_event(
        ctx,
        TURN_EVENT_DELTA,
        json!({
            "turnId": task_id,
            "stepIndex": step_index,
            "transient": true,
            "delta": compression_delta,
        }),
        request_id,
    );
}
