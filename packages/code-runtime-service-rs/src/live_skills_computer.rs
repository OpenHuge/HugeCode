const CORE_COMPUTER_OBSERVE_ENV_KEY: &str = "KU0_ENABLE_COMPUTER_OBSERVE";
const CORE_COMPUTER_OBSERVE_BLOCKED_ERROR_CODE: &str = "runtime.validation.request.blocked";
const CORE_COMPUTER_OBSERVE_COMMAND_RESTRICTED_ERROR_CODE: &str =
    "runtime.validation.command.restricted";

fn is_computer_observe_enabled() -> bool {
    match std::env::var(CORE_COMPUTER_OBSERVE_ENV_KEY) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            normalized == "1" || normalized == "true" || normalized == "yes" || normalized == "on"
        }
        Err(_) => false,
    }
}

async fn execute_core_computer_observe_skill(
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };

    let command_passthrough = options
        .command
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if command_passthrough.is_some() {
        return LiveSkillExecutionResult {
            run_id: new_id("live-skill-run"),
            skill_id: skill_id.to_string(),
            status: "blocked".to_string(),
            message: "Command passthrough is not supported for core-computer-observe.".to_string(),
            output: String::new(),
            network: None,
            artifacts: vec![],
            metadata: json!({
                "workspaceId": scope.workspace_id,
                "workspacePath": scope.workspace_path.display().to_string(),
                "envFlag": CORE_COMPUTER_OBSERVE_ENV_KEY,
                "supportsObserve": true,
                "supportsControl": false,
                "reason": "command_restricted",
                "errorCode": CORE_COMPUTER_OBSERVE_COMMAND_RESTRICTED_ERROR_CODE,
            }),
        };
    }

    if !is_computer_observe_enabled() {
        return LiveSkillExecutionResult {
            run_id: new_id("live-skill-run"),
            skill_id: skill_id.to_string(),
            status: "blocked".to_string(),
            message: "Computer observe is disabled by runtime policy.".to_string(),
            output: String::new(),
            network: None,
            artifacts: vec![],
            metadata: json!({
                "workspaceId": scope.workspace_id,
                "workspacePath": scope.workspace_path.display().to_string(),
                "envFlag": CORE_COMPUTER_OBSERVE_ENV_KEY,
                "supportsObserve": false,
                "supportsControl": false,
                "reason": "capability_unavailable",
                "errorCode": CORE_COMPUTER_OBSERVE_BLOCKED_ERROR_CODE,
            }),
        };
    }

    let focus = options
        .query
        .as_deref()
        .unwrap_or(input)
        .trim()
        .to_string();
    let output = if focus.is_empty() {
        "Computer observation captured (read-only mode).".to_string()
    } else {
        format!("Computer observation captured for: {focus}")
    };

    core_completed_result(
        skill_id,
        "Computer observe completed.".to_string(),
        output,
        json!({
            "workspaceId": scope.workspace_id,
            "workspacePath": scope.workspace_path.display().to_string(),
            "focus": if focus.is_empty() { Value::Null } else { Value::String(focus) },
            "supportsObserve": true,
            "supportsControl": false,
            "observationMode": "stub",
            "capabilityNegotiation": {
                "mode": "observe_only",
                "controlAvailable": false,
            },
        }),
    )
}
