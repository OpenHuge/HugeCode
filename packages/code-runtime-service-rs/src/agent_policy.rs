use super::turn_runtime_plan::request_requires_sub_agent_orchestration;
use super::*;

const SUPPORTED_ACCESS_MODES: &[&str] = &["read-only", "on-request", "full-access"];
const SUPPORTED_REASON_EFFORTS: &[&str] = &["low", "medium", "high", "xhigh"];
const SUPPORTED_AGENT_PROFILES: &[&str] =
    &["code", "debug", "architect", "review", "research", "custom"];

pub(super) fn canonicalize_access_mode(value: Option<&str>) -> Option<&'static str> {
    let normalized = value
        .unwrap_or("on-request")
        .trim()
        .to_ascii_lowercase()
        .replace('_', "-");
    match normalized.as_str() {
        "" => Some("on-request"),
        "read-only" => Some("read-only"),
        "on-request" | "current" | "workspace-write" => Some("on-request"),
        "full-access"
        | "danger-full-access"
        | "dangerously-bypass-approvals-and-sandbox"
        | "bypass-approvals-and-sandbox" => Some("full-access"),
        _ => None,
    }
}

pub(super) fn normalize_access_mode(value: Option<&str>) -> Result<String, RpcError> {
    if let Some(canonical) = canonicalize_access_mode(value) {
        Ok(canonical.to_string())
    } else {
        let provided = value.unwrap_or("on-request").trim().to_ascii_lowercase();
        Err(RpcError::invalid_params(format!(
            "Unsupported access mode `{provided}`. Expected one of: {}.",
            SUPPORTED_ACCESS_MODES.join(", ")
        )))
    }
}

pub(super) fn is_read_only_access_mode(access_mode: &str) -> bool {
    matches!(
        canonicalize_access_mode(Some(access_mode)),
        Some("read-only")
    )
}

pub(super) fn is_full_access_mode(access_mode: &str) -> bool {
    matches!(
        canonicalize_access_mode(Some(access_mode)),
        Some("full-access")
    )
}

pub(super) fn normalize_reason_effort(value: Option<&str>) -> Result<Option<String>, RpcError> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Ok(None);
    }
    if SUPPORTED_REASON_EFFORTS.contains(&normalized.as_str()) {
        Ok(Some(normalized))
    } else {
        Err(RpcError::invalid_params(format!(
            "Unsupported reason effort `{raw}`. Expected one of: {}.",
            SUPPORTED_REASON_EFFORTS.join(", ")
        )))
    }
}

pub(super) fn normalize_agent_profile(value: Option<&str>) -> Result<String, RpcError> {
    let normalized = value.unwrap_or("code").trim().to_ascii_lowercase();
    if SUPPORTED_AGENT_PROFILES.contains(&normalized.as_str()) {
        Ok(normalized)
    } else {
        Err(RpcError::invalid_params(format!(
            "Unsupported agent profile `{normalized}`. Expected one of: {}.",
            SUPPORTED_AGENT_PROFILES.join(", ")
        )))
    }
}

pub(super) fn parse_agent_task_start_request(
    params: &Value,
) -> Result<AgentTaskStartRequest, RpcError> {
    let parsed: AgentTaskStartRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid agent task start payload: {error}"))
        })?;
    if parsed.workspace_id.trim().is_empty() {
        return Err(RpcError::invalid_params("workspaceId is required."));
    }
    if parsed.steps.is_empty() {
        return Err(RpcError::invalid_params(
            "agent task requires at least one step.",
        ));
    }
    if parsed.steps.len() > MAX_AGENT_TASK_STEPS {
        return Err(RpcError::invalid_params(format!(
            "agent task exceeds max steps limit of {}.",
            MAX_AGENT_TASK_STEPS
        )));
    }
    Ok(parsed)
}

fn is_step_allowed_for_access_mode(step_kind: AgentStepKind, access_mode: &str) -> bool {
    if is_read_only_access_mode(access_mode) {
        return step_kind.mutation_kind() == AgentStepMutationKind::Read;
    }
    true
}

fn is_step_allowed_for_profile(step_kind: AgentStepKind, profile: &str) -> bool {
    match profile {
        "architect" | "review" | "research" => {
            matches!(step_kind, AgentStepKind::Read | AgentStepKind::Diagnostics)
        }
        "debug" => matches!(
            step_kind,
            AgentStepKind::Read
                | AgentStepKind::Edit
                | AgentStepKind::Bash
                | AgentStepKind::JsRepl
                | AgentStepKind::Diagnostics
        ),
        _ => true,
    }
}

pub(super) fn validate_agent_task_steps(
    steps: &[AgentTaskStepInput],
    access_mode: &str,
    agent_profile: &str,
) -> Result<(), RpcError> {
    for (index, step) in steps.iter().enumerate() {
        if !is_step_allowed_for_access_mode(step.kind, access_mode) {
            return Err(RpcError::invalid_params(format!(
                "Step {} (`{}`) is not allowed in access mode `{}`.",
                index + 1,
                step.kind.as_str(),
                access_mode
            )));
        }
        if !is_step_allowed_for_profile(step.kind, agent_profile) {
            return Err(RpcError::invalid_params(format!(
                "Step {} (`{}`) is not allowed in agent profile `{}`.",
                index + 1,
                step.kind.as_str(),
                agent_profile
            )));
        }
        let requires_sub_agent_orchestration = step
            .input
            .as_deref()
            .map(request_requires_sub_agent_orchestration)
            .unwrap_or(false);
        if requires_sub_agent_orchestration
            && matches!(step.kind, AgentStepKind::Bash | AgentStepKind::JsRepl)
        {
            return Err(RpcError::invalid_params(format!(
                "Step {} (`{}`) is not allowed when the instruction requests sub-agent orchestration. Use non-shell delegation steps instead.",
                index + 1,
                step.kind.as_str()
            )));
        }
    }
    Ok(())
}

pub(super) fn resolve_agent_step_requires_approval(
    step: &AgentTaskStepInput,
    access_mode: &str,
    _agent_profile: &str,
) -> bool {
    step.requires_approval.unwrap_or_else(|| {
        if is_full_access_mode(access_mode) {
            false
        } else {
            step.kind.default_requires_approval()
        }
    })
}

fn build_agent_step_capability_metadata(step_kind: AgentStepKind) -> Value {
    let capability = step_kind.capability();
    json!({
        "defaultRequiresApproval": capability.default_requires_approval,
        "mutationKind": step_kind.mutation_kind().as_str(),
        "parallelSafe": step_kind.parallel_safe(),
        "requiresReadEvidence": step_kind.requires_read_evidence(),
        "skillId": step_kind.skill_id(),
    })
}

pub(super) fn create_agent_step_summary(
    index: usize,
    step: &AgentTaskStepInput,
) -> AgentTaskStepSummary {
    AgentTaskStepSummary {
        index,
        kind: step.kind.as_str().to_string(),
        role: step.kind.role().to_string(),
        status: "pending".to_string(),
        message: "Queued.".to_string(),
        run_id: None,
        output: None,
        metadata: json!({
            "toolCapabilities": build_agent_step_capability_metadata(step.kind),
        }),
        started_at: None,
        updated_at: now_ms(),
        completed_at: None,
        error_code: None,
        error_message: None,
        approval_id: None,
    }
}

pub(super) fn trim_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|entry| {
        let trimmed = entry.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn remove_agent_task(store: &mut AgentTaskStore, task_id: &str) {
    store.tasks.remove(task_id);
    store.order.retain(|entry| entry != task_id);
    store.approval_index.retain(|_, value| value != task_id);
}

pub(super) fn is_agent_task_terminal_status(status: &str) -> bool {
    matches!(status, "completed" | "failed" | "cancelled" | "interrupted")
}

fn evict_oldest_terminal_agent_task(store: &mut AgentTaskStore) -> bool {
    let Some(task_id) = store
        .order
        .iter()
        .find(|entry| {
            store
                .tasks
                .get(entry.as_str())
                .map(|runtime| is_agent_task_terminal_status(runtime.summary.status.as_str()))
                .unwrap_or(true)
        })
        .cloned()
    else {
        return false;
    };

    remove_agent_task(store, task_id.as_str());
    true
}

pub(super) fn ensure_agent_task_capacity(store: &mut AgentTaskStore, max_tasks: usize) -> bool {
    while store.order.len() >= max_tasks {
        if !evict_oldest_terminal_agent_task(store) {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::{
        create_agent_step_summary, is_full_access_mode, is_read_only_access_mode,
        normalize_access_mode, normalize_agent_profile, parse_agent_task_start_request,
        resolve_agent_step_requires_approval, validate_agent_task_steps, AgentStepKind,
        AgentTaskStepInput,
    };
    use serde_json::json;

    #[test]
    fn normalize_access_mode_accepts_aliases() {
        assert_eq!(
            normalize_access_mode(Some("danger-full-access")).expect("danger alias"),
            "full-access"
        );
        assert_eq!(
            normalize_access_mode(Some("workspace_write")).expect("workspace alias"),
            "on-request"
        );
        assert_eq!(
            normalize_access_mode(Some("READ_ONLY")).expect("read-only alias"),
            "read-only"
        );
    }

    #[test]
    fn normalize_access_mode_rejects_unknown_values() {
        let error = normalize_access_mode(Some("unknown-mode")).expect_err("invalid mode");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(
            error.message.contains("Unsupported access mode"),
            "unexpected message: {}",
            error.message
        );
    }

    #[test]
    fn access_mode_helpers_use_canonicalized_aliases() {
        assert!(is_full_access_mode("danger_full_access"));
        assert!(!is_full_access_mode("workspace-write"));
        assert!(is_read_only_access_mode("read_only"));
        assert!(!is_read_only_access_mode("full-access"));
    }

    #[test]
    fn validate_agent_task_steps_blocks_bash_when_sub_agent_orchestration_is_requested() {
        let steps = vec![AgentTaskStepInput {
            kind: AgentStepKind::Bash,
            input: Some("Please use sub agents for this analysis.".to_string()),
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some("echo should-not-run".to_string()),
            severities: None,
            max_items: None,
            timeout_ms: Some(1000),
            requires_approval: None,
            approval_reason: None,
        }];
        let error = validate_agent_task_steps(&steps, "full-access", "code")
            .expect_err("bash step should be rejected for sub-agent requests");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(
            error.message.contains("sub-agent orchestration"),
            "unexpected message: {}",
            error.message
        );
    }

    #[test]
    fn parse_agent_task_start_request_requires_canonical_hot_path_fields() {
        let parsed = parse_agent_task_start_request(&json!({
            "workspaceId": "ws-1",
            "requestId": "req-1",
            "accessMode": "on-request",
            "executionMode": "single",
            "preferredBackendIds": ["backend-a"],
            "missionBrief": {
                "objective": "Inspect the runtime boundary",
                "preferredBackendIds": ["backend-a"],
                "evaluationPlan": {
                    "representativeCommands": ["pnpm check:runtime-contract"]
                }
            },
            "steps": [
                {
                    "kind": "read",
                    "input": "Inspect the hot path"
                }
            ]
        }))
        .expect("canonical request should parse");

        assert_eq!(parsed.workspace_id, "ws-1");
        assert_eq!(parsed.request_id.as_deref(), Some("req-1"));
        let expected_backends = vec!["backend-a".to_string()];
        assert_eq!(
            parsed.preferred_backend_ids.as_deref(),
            Some(expected_backends.as_slice())
        );
        let expected_commands = vec!["pnpm check:runtime-contract".to_string()];
        assert_eq!(
            parsed
                .mission_brief
                .as_ref()
                .and_then(|brief| brief.evaluation_plan.as_ref())
                .and_then(|plan| plan.representative_commands.as_ref())
                .map(Vec::as_slice),
            Some(expected_commands.as_slice())
        );
    }

    #[test]
    fn parse_agent_task_start_request_rejects_snake_case_hot_path_fields() {
        let error = parse_agent_task_start_request(&json!({
            "workspace_id": "ws-1",
            "access_mode": "on-request",
            "execution_mode": "single",
            "preferred_backend_ids": ["backend-a"],
            "mission_brief": {
                "objective": "Inspect the runtime boundary"
            },
            "steps": [
                {
                    "kind": "read",
                    "input": "Inspect the hot path",
                    "timeout_ms": 500
                }
            ]
        }))
        .expect_err("snake_case request should fail");

        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(
            error.message.contains("Invalid agent task start payload"),
            "unexpected message: {}",
            error.message
        );
    }

    #[test]
    fn normalize_agent_profile_accepts_review() {
        assert_eq!(
            normalize_agent_profile(Some("review")).expect("review profile"),
            "review"
        );
    }

    #[test]
    fn create_agent_step_summary_includes_read_tool_capabilities() {
        let step = AgentTaskStepInput {
            kind: AgentStepKind::Read,
            input: Some("Inspect the file.".to_string()),
            path: Some("src/main.rs".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            requires_approval: None,
            approval_reason: None,
        };

        let summary = create_agent_step_summary(0, &step);

        assert_eq!(
            summary.metadata,
            json!({
                "toolCapabilities": {
                    "defaultRequiresApproval": false,
                    "mutationKind": "read",
                    "parallelSafe": true,
                    "requiresReadEvidence": false,
                    "skillId": "core-read",
                }
            })
        );
    }

    #[test]
    fn create_agent_step_summary_includes_mutation_tool_capabilities() {
        let step = AgentTaskStepInput {
            kind: AgentStepKind::Write,
            input: Some("Create the file.".to_string()),
            path: Some("src/main.rs".to_string()),
            paths: None,
            content: Some("fn main() {}".to_string()),
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            requires_approval: None,
            approval_reason: None,
        };

        let summary = create_agent_step_summary(0, &step);

        assert_eq!(
            summary.metadata,
            json!({
                "toolCapabilities": {
                    "defaultRequiresApproval": true,
                    "mutationKind": "write",
                    "parallelSafe": false,
                    "requiresReadEvidence": true,
                    "skillId": "core-write",
                }
            })
        );
    }

    #[test]
    fn resolve_agent_step_requires_approval_respects_capability_defaults_and_full_access() {
        let read_step = AgentTaskStepInput {
            kind: AgentStepKind::Read,
            input: Some("Inspect the file.".to_string()),
            path: Some("src/main.rs".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            requires_approval: None,
            approval_reason: None,
        };
        let bash_step = AgentTaskStepInput {
            kind: AgentStepKind::Bash,
            input: Some("Run diagnostics.".to_string()),
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some("cargo test".to_string()),
            severities: None,
            max_items: None,
            timeout_ms: Some(1000),
            requires_approval: None,
            approval_reason: None,
        };

        assert!(!resolve_agent_step_requires_approval(
            &read_step,
            "on-request",
            "code"
        ));
        assert!(resolve_agent_step_requires_approval(
            &bash_step,
            "on-request",
            "code"
        ));
        assert!(!resolve_agent_step_requires_approval(
            &bash_step,
            "full-access",
            "code"
        ));
    }

    #[test]
    fn validate_agent_task_steps_restricts_review_profile_to_read() {
        let steps = vec![AgentTaskStepInput {
            kind: AgentStepKind::Edit,
            input: Some("Edit this file.".to_string()),
            path: Some("src/main.rs".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            requires_approval: None,
            approval_reason: None,
        }];
        let error = validate_agent_task_steps(&steps, "full-access", "review")
            .expect_err("review profile should reject edits");
        assert!(error.message.contains("agent profile `review`"));
    }
}
