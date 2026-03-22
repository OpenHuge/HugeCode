use super::*;
#[path = "autodrive.rs"]
pub(super) mod autodrive;
#[path = "context_compression.rs"]
mod context_compression;
#[path = "metadata.rs"]
pub(super) mod metadata;
pub(super) use context_compression::maybe_mark_context_compression;
use metadata::{apply_tool_inspector_metadata, apply_tool_inspector_to_tool_result_payload};

const DEFAULT_TOOL_INSPECTOR_REPETITION_MAX_CONSECUTIVE: u32 = 4;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum ToolInspectorDecision {
    Allow,
    RequireApproval {
        reason: String,
        rule_id: Option<String>,
    },
    Deny {
        error_code: String,
        message: String,
        rule_id: Option<String>,
    },
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(super) struct ToolInspectorMetadata {
    pub(super) decision: String,
    pub(super) reason: Option<String>,
    pub(super) rule_id: Option<String>,
}

fn runtime_autonomy_v2_enforced() -> bool {
    matches!(
        std::env::var("CODE_RUNTIME_AUTONOMY_V2")
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("1" | "true" | "yes" | "on")
    )
}

fn runtime_tool_inspector_enabled() -> bool {
    !matches!(
        std::env::var("RUNTIME_TOOL_INSPECTOR_ENABLED")
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

fn runtime_tool_inspector_security_enabled() -> bool {
    !matches!(
        std::env::var("RUNTIME_TOOL_INSPECTOR_SECURITY_ENABLED")
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

fn runtime_tool_inspector_repetition_max_consecutive() -> u32 {
    std::env::var("CODE_RUNTIME_TOOL_INSPECTOR_REPETITION_MAX_CONSECUTIVE")
        .ok()
        .and_then(|value| value.trim().parse::<u32>().ok())
        .map(|value| value.max(1))
        .unwrap_or(DEFAULT_TOOL_INSPECTOR_REPETITION_MAX_CONSECUTIVE)
}

fn tool_inspector_decision_action(decision: &ToolInspectorDecision) -> &'static str {
    match decision {
        ToolInspectorDecision::Allow => "allow",
        ToolInspectorDecision::RequireApproval { .. } => "require_approval",
        ToolInspectorDecision::Deny { .. } => "deny",
    }
}

fn tool_inspector_metadata_from_decision(
    decision: &ToolInspectorDecision,
) -> ToolInspectorMetadata {
    match decision {
        ToolInspectorDecision::Allow => ToolInspectorMetadata {
            decision: "allow".to_string(),
            reason: None,
            rule_id: None,
        },
        ToolInspectorDecision::RequireApproval { reason, rule_id } => ToolInspectorMetadata {
            decision: "require_approval".to_string(),
            reason: Some(reason.clone()),
            rule_id: rule_id.clone(),
        },
        ToolInspectorDecision::Deny {
            message, rule_id, ..
        } => ToolInspectorMetadata {
            decision: "deny".to_string(),
            reason: Some(message.clone()),
            rule_id: rule_id.clone(),
        },
    }
}

pub(super) fn resolve_agent_session_concurrency_limit() -> Option<usize> {
    std::env::var("CODE_RUNTIME_SERVICE_AGENT_SESSION_MAX_CONCURRENCY")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .map(|value| value.clamp(1, MAX_AGENT_MAX_CONCURRENT_TASKS))
}

pub(super) async fn enforce_agent_session_concurrency_limit(
    ctx: &AppContext,
    task_id: &str,
    workspace_id: &str,
    request_id: Option<&str>,
) -> bool {
    let Some(max_sessions) = resolve_agent_session_concurrency_limit() else {
        return true;
    };
    let active_sessions = {
        let store = ctx.agent_tasks.read().await;
        store
            .tasks
            .values()
            .filter(|task| {
                task.summary.workspace_id == workspace_id
                    && !is_agent_task_terminal_status(task.summary.status.as_str())
            })
            .count()
    };
    if active_sessions <= max_sessions {
        return true;
    }
    ctx.runtime_diagnostics
        .record_agent_session_concurrency_limit_hit(workspace_id);

    let now = now_ms();
    let error_message = format!(
        "Workspace active session limit reached ({active_sessions}/{max_sessions}). \
Set CODE_RUNTIME_SERVICE_AGENT_SESSION_MAX_CONCURRENCY to raise the cap."
    );
    {
        let mut store = ctx.agent_tasks.write().await;
        if let Some(task) = store.tasks.get_mut(task_id) {
            task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
            task.summary.error_code = Some("AGENT_SESSION_CONCURRENCY_LIMIT".to_string());
            task.summary.error_message = Some(error_message.clone());
            task.summary.completed_at = Some(now);
            task.summary.updated_at = now;
            task.summary.current_step = None;
        }
    }
    let _ =
        checkpoint_agent_task_runtime_state(ctx, task_id, AgentTaskStatus::Failed.as_str()).await;
    publish_turn_event(
        ctx,
        TURN_EVENT_FAILED,
        json!({
            "turnId": task_id,
            "error": {
                "code": "AGENT_SESSION_CONCURRENCY_LIMIT",
                "message": error_message,
            },
            "limit": max_sessions,
            "activeSessions": active_sessions,
        }),
        request_id,
    );
    let (event_at_ms, diagnostics) = prepare_runtime_updated_diagnostics_payload_for_emit(
        ctx,
        None,
        None,
        Some("runtime"),
        Some("agent_session_concurrency_limit"),
    )
    .await;
    let runtime_updated_scope =
        runtime_update_scope_for_method("code_runtime_run_start").unwrap_or(&["agents", "threads"]);
    publish_runtime_updated_event_at(
        ctx,
        runtime_updated_scope,
        "agent_session_concurrency_limit",
        Some(diagnostics),
        event_at_ms,
    );
    false
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct SecurityPatternRule {
    id: String,
    pattern: String,
}

const SECURITY_INSPECTOR_DENY_PATTERNS_ENV: &str = "RUNTIME_TOOL_INSPECTOR_SECURITY_DENY_PATTERNS";
const SECURITY_INSPECTOR_REQUIRE_APPROVAL_PATTERNS_ENV: &str =
    "RUNTIME_TOOL_INSPECTOR_SECURITY_REQUIRE_APPROVAL_PATTERNS";

const DEFAULT_SECURITY_DENY_RULES: &[(&str, &str)] = &[
    ("shell.rm_root", "rm -rf /"),
    ("shell.rm_root_alt", "rm -fr /"),
    ("shell.mkfs", "mkfs."),
    ("shell.dd_zero", "dd if=/dev/zero"),
    ("shell.fork_bomb", ":(){:|:&};:"),
    ("shell.shutdown", "shutdown -h"),
    ("shell.poweroff", "poweroff"),
    ("shell.halt", "halt -f"),
];

const DEFAULT_SECURITY_REQUIRE_APPROVAL_RULES: &[(&str, &str)] = &[
    ("shell.rm_recursive", "rm -rf"),
    ("shell.chmod_recursive", "chmod -r"),
    ("shell.chown_recursive", "chown -r"),
    ("shell.sudo", "sudo "),
    ("shell.curl", "curl "),
    ("shell.wget", "wget "),
    ("shell.pipe_sh", "| sh"),
    ("shell.pipe_bash", "| bash"),
    ("shell.write_etc", ">/etc/"),
    ("shell.append_etc", ">>/etc/"),
];

fn parse_security_pattern_rules_env(
    env_value: &str,
    auto_rule_id_prefix: &str,
) -> Vec<SecurityPatternRule> {
    env_value
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .enumerate()
        .filter_map(|(index, entry)| {
            let (rule_id, pattern) = if let Some((id, pattern)) = entry.split_once('=') {
                (id.trim().to_string(), pattern.trim().to_string())
            } else {
                (
                    format!("{auto_rule_id_prefix}.{}", index + 1),
                    entry.to_string(),
                )
            };
            if rule_id.is_empty() || pattern.is_empty() {
                return None;
            }
            Some(SecurityPatternRule {
                id: rule_id,
                pattern: pattern.to_ascii_lowercase(),
            })
        })
        .collect()
}

fn default_security_pattern_rules(defaults: &[(&str, &str)]) -> Vec<SecurityPatternRule> {
    defaults
        .iter()
        .map(|(id, pattern)| SecurityPatternRule {
            id: (*id).to_string(),
            pattern: pattern.to_ascii_lowercase(),
        })
        .collect()
}

fn resolve_security_pattern_rules(
    env_key: &str,
    defaults: &[(&str, &str)],
    auto_rule_id_prefix: &str,
) -> Vec<SecurityPatternRule> {
    let default_rules = default_security_pattern_rules(defaults);
    let Some(raw_value) = std::env::var(env_key).ok() else {
        return default_rules;
    };
    let parsed = parse_security_pattern_rules_env(raw_value.as_str(), auto_rule_id_prefix);
    if parsed.is_empty() {
        return default_rules;
    }
    parsed
}

fn find_matching_security_rule<'a>(
    normalized_command: &str,
    rules: &'a [SecurityPatternRule],
) -> Option<&'a SecurityPatternRule> {
    rules
        .iter()
        .find(|rule| normalized_command.contains(rule.pattern.as_str()))
}

fn inspect_shell_command(command: &str) -> ToolInspectorDecision {
    let normalized = command.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return ToolInspectorDecision::Allow;
    }

    let deny_rules = resolve_security_pattern_rules(
        SECURITY_INSPECTOR_DENY_PATTERNS_ENV,
        DEFAULT_SECURITY_DENY_RULES,
        "security.deny",
    );
    if let Some(rule) = find_matching_security_rule(normalized.as_str(), deny_rules.as_slice()) {
        return ToolInspectorDecision::Deny {
            error_code: "RUNTIME_TOOL_INSPECTOR_DENY".to_string(),
            message: format!(
                "Security inspector denied a destructive shell command pattern ({})",
                rule.id
            ),
            rule_id: Some(rule.id.clone()),
        };
    }

    let approval_rules = resolve_security_pattern_rules(
        SECURITY_INSPECTOR_REQUIRE_APPROVAL_PATTERNS_ENV,
        DEFAULT_SECURITY_REQUIRE_APPROVAL_RULES,
        "security.require_approval",
    );
    if let Some(rule) = find_matching_security_rule(normalized.as_str(), approval_rules.as_slice())
    {
        return ToolInspectorDecision::RequireApproval {
            reason: format!(
                "Security inspector flagged a risky shell command pattern ({}); explicit approval is required.",
                rule.id
            ),
            rule_id: Some(rule.id.clone()),
        };
    }

    ToolInspectorDecision::Allow
}

async fn security_inspector(
    ctx: &AppContext,
    step: &AgentTaskStepInput,
    workspace_id: &str,
) -> ToolInspectorDecision {
    if !runtime_tool_inspector_security_enabled() {
        return ToolInspectorDecision::Allow;
    }
    if step.kind != AgentStepKind::Bash {
        return ToolInspectorDecision::Allow;
    }
    let command = step.command.as_deref().unwrap_or("");
    let baseline_decision = inspect_shell_command(command);
    if matches!(baseline_decision, ToolInspectorDecision::Deny { .. }) {
        return baseline_decision;
    }

    let preflight = security_preflight::evaluate_security_preflight(
        ctx,
        Some(workspace_id),
        Some("bash"),
        Some(command),
        true,
        true,
        None,
    )
    .await;
    match preflight.action.as_str() {
        "allow" => {
            if matches!(
                baseline_decision,
                ToolInspectorDecision::RequireApproval { .. }
            ) && security_preflight::is_permission_memory_decision(&preflight)
            {
                ToolInspectorDecision::Allow
            } else {
                baseline_decision
            }
        }
        "review" => {
            let review_reason = if preflight.reason.trim().is_empty() {
                "Security preflight requires manual review.".to_string()
            } else {
                preflight.reason
            };
            match baseline_decision {
                ToolInspectorDecision::RequireApproval { reason, rule_id } => {
                    ToolInspectorDecision::RequireApproval {
                        reason: format!("{reason} | {review_reason}"),
                        rule_id: Some(
                            rule_id
                                .map(|existing| format!("{existing},security.preflight.review"))
                                .unwrap_or_else(|| "security.preflight.review".to_string()),
                        ),
                    }
                }
                _ => ToolInspectorDecision::RequireApproval {
                    reason: review_reason,
                    rule_id: Some("security.preflight.review".to_string()),
                },
            }
        }
        "block" => ToolInspectorDecision::Deny {
            error_code: "RUNTIME_SECURITY_PREFLIGHT_BLOCKED".to_string(),
            message: if preflight.reason.trim().is_empty() {
                "Security preflight blocked command execution.".to_string()
            } else {
                preflight.reason
            },
            rule_id: Some("security.preflight.block".to_string()),
        },
        _ => baseline_decision,
    }
}

fn normalize_inspector_text(value: Option<&str>) -> Option<String> {
    let value = value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.split_whitespace().collect::<Vec<_>>().join(" "))?;
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn build_step_repetition_signature(step: &AgentTaskStepInput) -> Option<String> {
    if matches!(step.kind, AgentStepKind::Read) {
        return None;
    }
    let payload = json!({
        "kind": step.kind.as_str(),
        "path": normalize_inspector_text(step.path.as_deref()),
        "command": normalize_inspector_text(step.command.as_deref()),
        "input": normalize_inspector_text(step.input.as_deref()),
        "content": normalize_inspector_text(step.content.as_deref()),
        "find": normalize_inspector_text(step.find.as_deref()),
        "replace": normalize_inspector_text(step.replace.as_deref()),
    });
    serde_json::to_string(&payload).ok()
}

async fn repetition_inspector(
    ctx: &AppContext,
    task_id: &str,
    step: &AgentTaskStepInput,
) -> ToolInspectorDecision {
    let max_consecutive = runtime_tool_inspector_repetition_max_consecutive();
    let Some(signature) = build_step_repetition_signature(step) else {
        let mut store = ctx.agent_tasks.write().await;
        if let Some(task) = store.tasks.get_mut(task_id) {
            task.last_tool_signature = None;
            task.consecutive_tool_signature_count = 0;
        }
        return ToolInspectorDecision::Allow;
    };

    let consecutive_count = {
        let mut store = ctx.agent_tasks.write().await;
        let Some(task) = store.tasks.get_mut(task_id) else {
            return ToolInspectorDecision::Allow;
        };
        if task.last_tool_signature.as_deref() == Some(signature.as_str()) {
            task.consecutive_tool_signature_count =
                task.consecutive_tool_signature_count.saturating_add(1);
        } else {
            task.last_tool_signature = Some(signature);
            task.consecutive_tool_signature_count = 1;
        }
        task.consecutive_tool_signature_count
    };

    if consecutive_count > max_consecutive {
        return ToolInspectorDecision::Deny {
            error_code: "RUNTIME_TOOL_REPETITION_LIMIT".to_string(),
            message: format!(
                "Tool inspector blocked repeated identical operations (consecutive={consecutive_count}, limit={max_consecutive})."
            ),
            rule_id: Some("repetition.max_consecutive".to_string()),
        };
    }

    ToolInspectorDecision::Allow
}

pub(super) async fn inspect_tool_with_inspectors(
    ctx: &AppContext,
    task_id: &str,
    step: &AgentTaskStepInput,
    workspace_id: &str,
) -> ToolInspectorDecision {
    if !runtime_tool_inspector_enabled() {
        ctx.runtime_diagnostics
            .record_tool_inspector_decision("allow");
        return ToolInspectorDecision::Allow;
    }

    let mut require_approval_reasons: Vec<String> = Vec::new();
    let mut require_approval_rule_ids: Vec<String> = Vec::new();
    let mut decision = ToolInspectorDecision::Allow;

    match repetition_inspector(ctx, task_id, step).await {
        ToolInspectorDecision::Allow => {}
        ToolInspectorDecision::RequireApproval { reason, rule_id } => {
            require_approval_reasons.push(reason);
            if let Some(rule_id) = rule_id {
                require_approval_rule_ids.push(rule_id);
            }
        }
        ToolInspectorDecision::Deny {
            error_code,
            message,
            rule_id,
        } => {
            decision = ToolInspectorDecision::Deny {
                error_code,
                message,
                rule_id,
            };
        }
    }

    if matches!(decision, ToolInspectorDecision::Allow) {
        match security_inspector(ctx, step, workspace_id).await {
            ToolInspectorDecision::Allow => {}
            ToolInspectorDecision::RequireApproval { reason, rule_id } => {
                require_approval_reasons.push(reason);
                if let Some(rule_id) = rule_id {
                    require_approval_rule_ids.push(rule_id);
                }
            }
            ToolInspectorDecision::Deny {
                error_code,
                message,
                rule_id,
            } => {
                decision = ToolInspectorDecision::Deny {
                    error_code,
                    message,
                    rule_id,
                };
            }
        }
    }

    if matches!(decision, ToolInspectorDecision::Allow) && !require_approval_reasons.is_empty() {
        decision = ToolInspectorDecision::RequireApproval {
            reason: require_approval_reasons.join(" | "),
            rule_id: if require_approval_rule_ids.is_empty() {
                None
            } else {
                Some(require_approval_rule_ids.join(","))
            },
        };
    }

    ctx.runtime_diagnostics
        .record_tool_inspector_decision(tool_inspector_decision_action(&decision));
    decision
}

pub(super) fn tool_inspector_metadata(decision: &ToolInspectorDecision) -> ToolInspectorMetadata {
    tool_inspector_metadata_from_decision(decision)
}

async fn fail_agent_task_for_blocked_tool(
    ctx: &AppContext,
    task_id: &str,
    step_index: usize,
    step_kind: AgentStepKind,
    workspace_id: &str,
    request_id: Option<&str>,
    trace_id: &str,
    tool_call_id: &str,
    tool_scope: runtime_tool_metrics::RuntimeToolExecutionScope,
    tool_attempt: Option<u32>,
    task_recovered: bool,
    block_error_code: &str,
    block_message: &str,
    inspector_metadata: Option<&ToolInspectorMetadata>,
) {
    let finished_at = now_ms();
    {
        let mut store = ctx.agent_tasks.write().await;
        if let Some(task) = store.tasks.get_mut(task_id) {
            task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
            task.summary.error_code = Some(block_error_code.to_string());
            task.summary.error_message = Some(block_message.to_string());
            task.summary.completed_at = Some(finished_at);
            task.summary.updated_at = finished_at;
            task.summary.current_step = None;
            if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                step_summary.error_code = Some(block_error_code.to_string());
                step_summary.error_message = Some(block_message.to_string());
                step_summary.message = block_message.to_string();
                step_summary.updated_at = finished_at;
                step_summary.completed_at = Some(finished_at);
                let mut step_metadata = step_summary.metadata.clone();
                if let Some(inspector_metadata) = inspector_metadata {
                    apply_tool_inspector_metadata(&mut step_metadata, inspector_metadata);
                }
                step_summary.metadata = step_metadata;
            }
        }
    }
    let _ =
        checkpoint_agent_task_runtime_state(ctx, task_id, AgentTaskStatus::Failed.as_str()).await;
    let tool_result_checkpoint_id = checkpoint_tool_call_lifecycle(
        ctx,
        task_id,
        workspace_id,
        tool_call_id,
        step_kind.as_str(),
        "result",
        Some(false),
        Some("blocked"),
        Some(0),
        Some(task_id),
        tool_attempt,
        task_recovered,
        json!({
            "error": {
                "code": block_error_code,
                "message": block_message,
            },
        }),
    );
    record_runtime_tool_outcome(
        ctx,
        step_kind.as_str(),
        tool_scope,
        runtime_tool_metrics::RuntimeToolExecutionStatus::Blocked,
        finished_at,
        Some(0),
        Some(block_error_code),
        request_id,
        Some(trace_id),
        Some(tool_call_id),
        workspace_id,
        tool_attempt,
    )
    .await;
    let mut tool_result_payload = build_tool_result_event_payload(
        task_id,
        tool_call_id,
        step_kind.as_str(),
        false,
        None,
        Some(block_error_code),
        Some(block_message.to_string()),
        Some(task_id),
        tool_attempt,
        tool_result_checkpoint_id.as_deref(),
        trace_id,
        Some("blocked"),
        Some(0),
        task_recovered,
    );
    if let Some(inspector_metadata) = inspector_metadata {
        apply_tool_inspector_to_tool_result_payload(&mut tool_result_payload, inspector_metadata);
    }
    publish_turn_event(ctx, TURN_EVENT_TOOL_RESULT, tool_result_payload, request_id);
    publish_turn_event(
        ctx,
        TURN_EVENT_FAILED,
        json!({
            "turnId": task_id,
            "error": {
                "code": block_error_code,
                "message": block_message,
            },
        }),
        request_id,
    );
}

pub(super) async fn fail_agent_task_with_tool_inspector_denial(
    ctx: &AppContext,
    task_id: &str,
    step_index: usize,
    step_kind: AgentStepKind,
    workspace_id: &str,
    request_id: Option<&str>,
    trace_id: &str,
    tool_call_id: &str,
    tool_scope: runtime_tool_metrics::RuntimeToolExecutionScope,
    tool_attempt: Option<u32>,
    task_recovered: bool,
    error_code: &str,
    message: &str,
    rule_id: Option<&str>,
) {
    if error_code == "RUNTIME_TOOL_REPETITION_LIMIT" {
        let _ = crate::runtime_tool_safety_counters::record_runtime_tool_safety_counter(
            ctx,
            runtime_tool_metrics::RuntimeToolSafetyCounter::RepetitionBlocked,
            "increment repetition-blocked runtime tool metric failed",
        )
        .await;
    }

    let inspector_metadata = ToolInspectorMetadata {
        decision: "deny".to_string(),
        reason: Some(message.to_string()),
        rule_id: rule_id.map(ToOwned::to_owned),
    };
    fail_agent_task_for_blocked_tool(
        ctx,
        task_id,
        step_index,
        step_kind,
        workspace_id,
        request_id,
        trace_id,
        tool_call_id,
        tool_scope,
        tool_attempt,
        task_recovered,
        error_code,
        message,
        Some(&inspector_metadata),
    )
    .await;
}

pub(super) fn resolve_runtime_tool_scope_for_step(
    kind: AgentStepKind,
) -> runtime_tool_metrics::RuntimeToolExecutionScope {
    match kind {
        AgentStepKind::Write | AgentStepKind::Edit => {
            runtime_tool_metrics::RuntimeToolExecutionScope::Write
        }
        AgentStepKind::Read
        | AgentStepKind::Bash
        | AgentStepKind::JsRepl
        | AgentStepKind::Diagnostics => runtime_tool_metrics::RuntimeToolExecutionScope::Runtime,
    }
}

async fn record_runtime_tool_phase_event(
    ctx: &AppContext,
    tool_name: &str,
    scope: runtime_tool_metrics::RuntimeToolExecutionScope,
    phase: runtime_tool_metrics::RuntimeToolExecutionEventPhase,
    at: u64,
    request_id: Option<&str>,
    trace_id: Option<&str>,
    span_id: Option<&str>,
    workspace_id: &str,
    attempt: Option<u32>,
) {
    let event = runtime_tool_metrics::RuntimeToolExecutionEvent {
        tool_name: tool_name.to_string(),
        scope,
        phase,
        at,
        status: None,
        error_code: None,
        duration_ms: None,
        trace_id: trace_id.map(ToOwned::to_owned),
        span_id: span_id.map(ToOwned::to_owned),
        parent_span_id: None,
        attempt,
        request_id: request_id.map(ToOwned::to_owned),
        planner_step_key: None,
        workspace_id: Some(workspace_id.to_string()),
    };
    let mut metrics = ctx.runtime_tool_metrics.lock().await;
    if let Err(error) = metrics.record_events([event].as_slice()) {
        drop(metrics);
        let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
        let _ = guardrails.mark_channel_failure(
            "runtime tool metrics record failed",
            "runtime.validation.metrics_unhealthy",
        );
        warn!(
            error = error.as_str(),
            "record runtime tool phase event failed"
        );
    }
}

pub(super) async fn record_runtime_tool_outcome(
    ctx: &AppContext,
    tool_name: &str,
    scope: runtime_tool_metrics::RuntimeToolExecutionScope,
    status: runtime_tool_metrics::RuntimeToolExecutionStatus,
    at: u64,
    duration_ms: Option<u64>,
    error_code: Option<&str>,
    request_id: Option<&str>,
    trace_id: Option<&str>,
    span_id: Option<&str>,
    workspace_id: &str,
    attempt: Option<u32>,
) {
    let event = runtime_tool_metrics::RuntimeToolExecutionEvent {
        tool_name: tool_name.to_string(),
        scope,
        phase: runtime_tool_metrics::RuntimeToolExecutionEventPhase::Completed,
        at,
        status: Some(status),
        error_code: error_code.map(ToOwned::to_owned),
        duration_ms,
        trace_id: trace_id.map(ToOwned::to_owned),
        span_id: span_id.map(ToOwned::to_owned),
        parent_span_id: None,
        attempt,
        request_id: request_id.map(ToOwned::to_owned),
        planner_step_key: None,
        workspace_id: Some(workspace_id.to_string()),
    };
    {
        let mut metrics = ctx.runtime_tool_metrics.lock().await;
        if let Err(error) = metrics.record_events([event].as_slice()) {
            drop(metrics);
            let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
            let _ = guardrails.mark_channel_failure(
                "runtime tool metrics record failed",
                "runtime.validation.metrics_unhealthy",
            );
            warn!(
                error = error.as_str(),
                "record runtime tool completion event failed"
            );
        }
    }

    let outcome_event = runtime_tool_guardrails::RuntimeToolGuardrailOutcomeEvent {
        tool_name: tool_name.to_string(),
        scope,
        status,
        at,
        workspace_id: Some(workspace_id.to_string()),
        duration_ms,
        error_code: error_code.map(ToOwned::to_owned),
        request_id: request_id.map(ToOwned::to_owned),
        trace_id: trace_id.map(ToOwned::to_owned),
        span_id: span_id.map(ToOwned::to_owned),
        parent_span_id: None,
        planner_step_key: None,
        attempt,
    };
    let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
    if let Err(error) = guardrails.record_outcome(&outcome_event) {
        let _ = guardrails.mark_channel_failure(
            "runtime tool guardrail outcome persistence failed",
            "runtime.validation.metrics_unhealthy",
        );
        warn!(
            error = error.as_str(),
            "record runtime tool guardrail outcome failed"
        );
    }
}

pub(super) async fn preflight_and_mark_tool_started(
    ctx: &AppContext,
    task_id: &str,
    step_index: usize,
    step_kind: AgentStepKind,
    workspace_id: &str,
    request_id: Option<&str>,
    trace_id: &str,
    tool_call_id: &str,
    tool_input_payload: &Value,
    tool_scope: runtime_tool_metrics::RuntimeToolExecutionScope,
    tool_attempt: Option<u32>,
    task_recovered: bool,
) -> bool {
    let tool_payload_bytes = serde_json::to_vec(tool_input_payload)
        .ok()
        .map(|bytes| bytes.len())
        .and_then(|len| u64::try_from(len).ok())
        .unwrap_or(0);
    let preflight_at = now_ms();
    record_runtime_tool_phase_event(
        ctx,
        step_kind.as_str(),
        tool_scope,
        runtime_tool_metrics::RuntimeToolExecutionEventPhase::Attempted,
        preflight_at,
        request_id,
        Some(trace_id),
        Some(tool_call_id),
        workspace_id,
        tool_attempt,
    )
    .await;

    if runtime_autonomy_v2_enforced() {
        let preflight_request = runtime_tool_guardrails::RuntimeToolGuardrailEvaluateRequest {
            tool_name: step_kind.as_str().to_string(),
            scope: tool_scope,
            workspace_id: Some(workspace_id.to_string()),
            payload_bytes: tool_payload_bytes,
            at: Some(preflight_at),
            request_id: request_id.map(ToOwned::to_owned),
            trace_id: Some(trace_id.to_string()),
            span_id: Some(tool_call_id.to_string()),
            parent_span_id: None,
            planner_step_key: Some(format!("{task_id}:{step_index}")),
            attempt: tool_attempt,
            capability_profile:
                runtime_tool_guardrails::RuntimeToolGuardrailCapabilityProfile::default(),
        };
        let preflight_result = {
            let mut guardrails = ctx.runtime_tool_guardrails.lock().await;
            guardrails.evaluate(&preflight_request)
        };
        let preflight_result = match preflight_result {
            Ok(result) => result,
            Err(error) => {
                let finished_at = now_ms();
                {
                    let mut store = ctx.agent_tasks.write().await;
                    if let Some(task) = store.tasks.get_mut(task_id) {
                        task.summary.status = AgentTaskStatus::Failed.as_str().to_string();
                        task.summary.error_code = Some("RUNTIME_GUARDRAIL_ERROR".to_string());
                        task.summary.error_message = Some(error.clone());
                        task.summary.completed_at = Some(finished_at);
                        task.summary.updated_at = finished_at;
                        if let Some(step_summary) = task.summary.steps.get_mut(step_index) {
                            step_summary.status = AgentTaskStatus::Failed.as_str().to_string();
                            step_summary.error_code = Some("RUNTIME_GUARDRAIL_ERROR".to_string());
                            step_summary.error_message = Some(error.clone());
                            step_summary.updated_at = finished_at;
                            step_summary.completed_at = Some(finished_at);
                        }
                    }
                }
                let _ = checkpoint_agent_task_runtime_state(
                    ctx,
                    task_id,
                    AgentTaskStatus::Failed.as_str(),
                )
                .await;
                record_runtime_tool_outcome(
                    ctx,
                    step_kind.as_str(),
                    tool_scope,
                    runtime_tool_metrics::RuntimeToolExecutionStatus::RuntimeFailed,
                    finished_at,
                    None,
                    Some("runtime.validation.metrics_unhealthy"),
                    request_id,
                    Some(trace_id),
                    Some(tool_call_id),
                    workspace_id,
                    tool_attempt,
                )
                .await;
                publish_turn_event(
                    ctx,
                    TURN_EVENT_FAILED,
                    json!({
                        "turnId": task_id,
                        "error": {
                            "code": "RUNTIME_GUARDRAIL_ERROR",
                            "message": error,
                        },
                    }),
                    request_id,
                );
                return false;
            }
        };
        if !preflight_result.allowed {
            let block_error_code = preflight_result
                .error_code
                .clone()
                .unwrap_or_else(|| "RUNTIME_GUARDRAIL_BLOCKED".to_string());
            let block_message = preflight_result
                .message
                .clone()
                .unwrap_or_else(|| "Runtime guardrail blocked tool execution.".to_string());
            fail_agent_task_for_blocked_tool(
                ctx,
                task_id,
                step_index,
                step_kind,
                workspace_id,
                request_id,
                trace_id,
                tool_call_id,
                tool_scope,
                tool_attempt,
                task_recovered,
                block_error_code.as_str(),
                block_message.as_str(),
                None,
            )
            .await;
            return false;
        }
    }

    record_runtime_tool_phase_event(
        ctx,
        step_kind.as_str(),
        tool_scope,
        runtime_tool_metrics::RuntimeToolExecutionEventPhase::Started,
        now_ms(),
        request_id,
        Some(trace_id),
        Some(tool_call_id),
        workspace_id,
        tool_attempt,
    )
    .await;
    true
}

pub(super) async fn finalize_agent_task_completion(
    ctx: &AppContext,
    task_id: &str,
    request_id: Option<&str>,
) {
    let completion = {
        let mut store = ctx.agent_tasks.write().await;
        let Some(task) = store.tasks.get_mut(task_id) else {
            return;
        };
        if task.interrupt_requested
            || matches!(
                task.summary.status.as_str(),
                status if status == AgentTaskStatus::Interrupted.as_str()
                    || status == AgentTaskStatus::Paused.as_str()
            )
        {
            let paused = task.summary.status == AgentTaskStatus::Paused.as_str();
            let interrupt_message = task
                .summary
                .error_message
                .clone()
                .filter(|entry| !entry.trim().is_empty())
                .unwrap_or_else(|| {
                    if paused {
                        "Task paused by operator.".to_string()
                    } else {
                        "Task interrupted by operator.".to_string()
                    }
                });
            task.summary.status = if paused {
                AgentTaskStatus::Paused.as_str().to_string()
            } else {
                AgentTaskStatus::Interrupted.as_str().to_string()
            };
            task.summary.error_code = Some(if paused {
                "TASK_PAUSED".to_string()
            } else {
                "TASK_INTERRUPTED".to_string()
            });
            task.summary.error_message = Some(interrupt_message.clone());
            task.summary.current_step = None;
            if task.summary.completed_at.is_none() {
                task.summary.completed_at = Some(now_ms());
            }
            task.summary.updated_at = now_ms();
            autodrive::mark_auto_drive_failure(
                &mut task.summary.auto_drive,
                if paused { "paused" } else { "cancelled" },
                Some(interrupt_message.clone()),
                task.summary.updated_at,
            );
            Err(interrupt_message)
        } else {
            task.summary.status = AgentTaskStatus::Completed.as_str().to_string();
            task.summary.current_step = None;
            let completed_at = now_ms();
            task.summary.completed_at = Some(completed_at);
            task.summary.updated_at = completed_at;
            autodrive::mark_auto_drive_completed(
                &mut task.summary.auto_drive,
                Some("Runtime reached the destination.".to_string()),
                completed_at,
            );
            let completed = task
                .summary
                .steps
                .iter()
                .filter(|step| step.status == AgentTaskStatus::Completed.as_str())
                .count();
            Ok(format!(
                "Agent task completed. {} step(s) succeeded.",
                completed
            ))
        }
    };
    let _ = checkpoint_agent_task_runtime_state(
        ctx,
        task_id,
        if completion.is_ok() {
            AgentTaskStatus::Completed.as_str()
        } else {
            let store = ctx.agent_tasks.read().await;
            if store
                .tasks
                .get(task_id)
                .is_some_and(|task| task.summary.status == AgentTaskStatus::Paused.as_str())
            {
                AgentTaskStatus::Paused.as_str()
            } else {
                AgentTaskStatus::Interrupted.as_str()
            }
        },
    )
    .await;
    match completion {
        Ok(output) => {
            publish_turn_event(
                ctx,
                TURN_EVENT_COMPLETED,
                json!({
                    "turnId": task_id,
                    "output": output,
                }),
                request_id,
            );
        }
        Err(message) => {
            publish_turn_event(
                ctx,
                TURN_EVENT_FAILED,
                json!({
                    "turnId": task_id,
                    "error": {
                        "code": "TASK_INTERRUPTED",
                        "message": message,
                    },
                }),
                request_id,
            );
        }
    }
}

#[cfg(test)]
#[path = "../../../agent_tasks_execution_runtime_autonomy_tests.rs"]
mod tests;
