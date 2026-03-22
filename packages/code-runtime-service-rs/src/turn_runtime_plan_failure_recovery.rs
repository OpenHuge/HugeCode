use super::{
    build_provider_runtime_final_results_json, build_provider_runtime_plan_delta,
    build_provider_runtime_plan_prompt, build_runtime_planner_diagnostics,
    enforce_provider_runtime_plan_step_constraints, execute_provider_runtime_plan_steps,
    parse_provider_runtime_plan_response, parse_provider_runtime_plan_tool_arguments,
    provider_runtime_results_have_blocking_failure, publish_runtime_planner_diagnostics,
    publish_turn_event, query_provider, AppContext, ProviderRuntimePlanResponse,
    ProviderRuntimeStepResult, RuntimePlannerDiagnosticsReport, TurnProviderRoute,
    TURN_EVENT_DELTA,
};
use crate::provider_query::query_provider_runtime_tool_call;

pub(super) const PROVIDER_RUNTIME_FAILURE_RECOVERY_MAX_ATTEMPTS: usize = 2;

pub(super) struct ProviderRuntimePlanExecutionOutcome {
    pub(super) final_plan: ProviderRuntimePlanResponse,
    pub(super) step_results: Vec<ProviderRuntimeStepResult>,
    pub(super) unresolved_blocking_failure: bool,
}

fn classify_provider_runtime_failure_bucket(error_code: Option<&str>) -> &'static str {
    let Some(error_code) = error_code.map(str::trim).filter(|value| !value.is_empty()) else {
        return "unknown";
    };
    if error_code.contains("timeout") || error_code.contains("rate_limit") {
        return "transient_or_timeout";
    }
    if matches!(
        error_code,
        "runtime.validation.circuit_open" | "runtime.validation.metrics_unhealthy"
    ) {
        return "runtime_failure";
    }
    if error_code.starts_with("runtime.validation.") {
        return "validation_or_guardrail";
    }
    if error_code.contains("command_unavailable")
        || error_code.contains("permission_denied")
        || error_code.contains("sandbox.unavailable")
    {
        return "environment_or_tooling";
    }
    if error_code.contains("file_not_found") {
        return "missing_input";
    }
    "runtime_failure"
}

fn build_provider_runtime_failure_summary(step_results: &[ProviderRuntimeStepResult]) -> String {
    let lines = step_results
        .iter()
        .filter(|result| !result.ok)
        .take(8)
        .map(|result| {
            let error_code = result
                .error_code
                .as_deref()
                .unwrap_or("STEP_EXECUTION_FAILED");
            let bucket = classify_provider_runtime_failure_bucket(result.error_code.as_deref());
            format!(
                "- step {} {}: {} [{}]",
                result.index + 1,
                result.kind,
                error_code,
                bucket
            )
        })
        .collect::<Vec<_>>();
    if lines.is_empty() {
        "None.".to_string()
    } else {
        lines.join("\n")
    }
}

fn build_provider_runtime_step_failure_recovery_prompt(
    user_content: &str,
    workspace_path: &str,
    plan: &ProviderRuntimePlanResponse,
    step_results: &[ProviderRuntimeStepResult],
    attempt: usize,
) -> String {
    let previous_plan_json = serde_json::to_string_pretty(plan)
        .unwrap_or_else(|_| "{\"plan\":[],\"steps\":[]}".to_string());
    let execution_results_json = build_provider_runtime_final_results_json(step_results);
    let failure_summary = build_provider_runtime_failure_summary(step_results);
    format!(
        "{}\n\nRuntime execution recovery attempt #{attempt}.\n\
Previous runtime plan JSON:\n{previous_plan_json}\n\n\
Execution results JSON:\n{execution_results_json}\n\n\
Failure summary:\n{failure_summary}\n\n\
Replan from the execution evidence.\n\
Rules for this recovery attempt:\n\
- Return only the next recovery steps to run now.\n\
- Do not repeat already successful steps unless rerunning them is required to recover safely.\n\
- If a failure looks transient (timeout, temporary unavailable, rate limit, transport issue), you may retry once with a narrower scope or adjusted timeout.\n\
- If a failure looks environmental or tool-specific (command unavailable, shell mismatch, permission denied, path mismatch), switch to a different compatible tool or command instead of repeating the same step.\n\
- Prefer read/diagnostics verification before destructive retries when feasible.\n\
- Use finalMessage only when no safe automatic recovery route remains.",
        build_provider_runtime_plan_prompt(user_content, workspace_path)
    )
}

fn should_attempt_provider_runtime_failure_recovery(
    step_results: &[ProviderRuntimeStepResult],
) -> bool {
    step_results
        .iter()
        .filter(|result| !result.ok)
        .any(|result| {
            matches!(
                classify_provider_runtime_failure_bucket(result.error_code.as_deref()),
                "transient_or_timeout"
                    | "validation_or_guardrail"
                    | "environment_or_tooling"
                    | "missing_input"
            )
        })
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn maybe_retry_failed_execution_tool_plan(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    workspace_path: &str,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    plan: &ProviderRuntimePlanResponse,
    step_results: &[ProviderRuntimeStepResult],
    attempt: usize,
) -> Option<ProviderRuntimePlanResponse> {
    if attempt > PROVIDER_RUNTIME_FAILURE_RECOVERY_MAX_ATTEMPTS
        || step_results.is_empty()
        || !should_attempt_provider_runtime_failure_recovery(step_results)
    {
        return None;
    }
    let retry_prompt = build_provider_runtime_step_failure_recovery_prompt(
        content,
        workspace_path,
        plan,
        step_results,
        attempt,
    );
    let retry_selection = query_provider_runtime_tool_call(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        retry_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await
    .ok()?;
    let retry_arguments = retry_selection.tool_arguments.as_deref()?;
    let retry_plan = parse_provider_runtime_plan_tool_arguments(retry_arguments)?;
    Some(enforce_provider_runtime_plan_step_constraints(
        content, retry_plan,
    ))
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn maybe_retry_failed_execution_legacy_plan(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    workspace_path: &str,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
    plan: &ProviderRuntimePlanResponse,
    step_results: &[ProviderRuntimeStepResult],
    attempt: usize,
) -> Option<ProviderRuntimePlanResponse> {
    if attempt > PROVIDER_RUNTIME_FAILURE_RECOVERY_MAX_ATTEMPTS
        || step_results.is_empty()
        || !should_attempt_provider_runtime_failure_recovery(step_results)
    {
        return None;
    }
    let retry_prompt = build_provider_runtime_step_failure_recovery_prompt(
        content,
        workspace_path,
        plan,
        step_results,
        attempt,
    );
    let retry_response = query_provider(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        retry_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await
    .ok()?;
    let retry_plan = parse_provider_runtime_plan_response(retry_response.as_str())?;
    Some(enforce_provider_runtime_plan_step_constraints(
        content, retry_plan,
    ))
}

fn publish_runtime_plan_delta_if_needed(
    ctx: &AppContext,
    turn_id: &str,
    request_id: Option<&str>,
    content: &str,
    access_mode: &str,
    suppress_plan_delta: bool,
    plan: &ProviderRuntimePlanResponse,
) {
    if !super::should_emit_provider_runtime_plan_delta(content, access_mode, suppress_plan_delta) {
        return;
    }
    let Some(delta) = build_provider_runtime_plan_delta(plan) else {
        return;
    };
    publish_turn_event(
        ctx,
        TURN_EVENT_DELTA,
        serde_json::json!({
            "turnId": turn_id,
            "delta": delta,
        }),
        request_id,
    );
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn execute_provider_runtime_plan_with_tool_recovery(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    suppress_plan_delta: bool,
    access_mode: &str,
    workspace_id: &str,
    thread_id: &str,
    workspace_path: &str,
    turn_id: &str,
    request_id: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    initial_plan: ProviderRuntimePlanResponse,
    initial_planner_diagnostics: RuntimePlannerDiagnosticsReport,
) -> ProviderRuntimePlanExecutionOutcome {
    let mut current_plan = initial_plan;
    let mut current_planner_diagnostics = initial_planner_diagnostics;
    let mut all_step_results = Vec::new();

    for recovery_attempt in 1..=PROVIDER_RUNTIME_FAILURE_RECOVERY_MAX_ATTEMPTS + 1 {
        publish_runtime_plan_delta_if_needed(
            ctx,
            turn_id,
            request_id,
            content,
            access_mode,
            suppress_plan_delta,
            &current_plan,
        );
        let mut step_results = execute_provider_runtime_plan_steps(
            ctx,
            workspace_id,
            thread_id,
            access_mode,
            turn_id,
            request_id,
            &current_plan.steps,
            Some(&current_planner_diagnostics),
            recovery_attempt as u64,
        )
        .await;
        let has_blocking_failure =
            provider_runtime_results_have_blocking_failure(step_results.as_slice());
        all_step_results.append(&mut step_results);
        if !has_blocking_failure {
            return ProviderRuntimePlanExecutionOutcome {
                final_plan: current_plan,
                step_results: all_step_results,
                unresolved_blocking_failure: false,
            };
        }
        let Some(recovery_plan) = maybe_retry_failed_execution_tool_plan(
            ctx,
            provider_route,
            workspace_path,
            content,
            model_id,
            reason_effort,
            service_tier,
            compat_base_url_override,
            api_key_override,
            fallback_api_key_override,
            oauth_credential_source_override,
            oauth_auth_mode_override,
            &current_plan,
            all_step_results.as_slice(),
            recovery_attempt,
        )
        .await
        else {
            break;
        };
        let recovery_diagnostics =
            build_runtime_planner_diagnostics(content, access_mode, &recovery_plan);
        publish_runtime_planner_diagnostics(ctx, turn_id, request_id, &recovery_diagnostics);
        if recovery_diagnostics.has_fatal || recovery_plan.steps.is_empty() {
            break;
        }
        current_plan = recovery_plan;
        current_planner_diagnostics = recovery_diagnostics;
    }

    ProviderRuntimePlanExecutionOutcome {
        final_plan: current_plan,
        step_results: all_step_results,
        unresolved_blocking_failure: true,
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn execute_provider_runtime_plan_with_legacy_recovery(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    suppress_plan_delta: bool,
    access_mode: &str,
    workspace_id: &str,
    thread_id: &str,
    workspace_path: &str,
    turn_id: &str,
    request_id: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
    initial_plan: ProviderRuntimePlanResponse,
    initial_planner_diagnostics: RuntimePlannerDiagnosticsReport,
) -> ProviderRuntimePlanExecutionOutcome {
    let mut current_plan = initial_plan;
    let mut current_planner_diagnostics = initial_planner_diagnostics;
    let mut all_step_results = Vec::new();

    for recovery_attempt in 1..=PROVIDER_RUNTIME_FAILURE_RECOVERY_MAX_ATTEMPTS + 1 {
        publish_runtime_plan_delta_if_needed(
            ctx,
            turn_id,
            request_id,
            content,
            access_mode,
            suppress_plan_delta,
            &current_plan,
        );
        let mut step_results = execute_provider_runtime_plan_steps(
            ctx,
            workspace_id,
            thread_id,
            access_mode,
            turn_id,
            request_id,
            &current_plan.steps,
            Some(&current_planner_diagnostics),
            recovery_attempt as u64,
        )
        .await;
        let has_blocking_failure =
            provider_runtime_results_have_blocking_failure(step_results.as_slice());
        all_step_results.append(&mut step_results);
        if !has_blocking_failure {
            return ProviderRuntimePlanExecutionOutcome {
                final_plan: current_plan,
                step_results: all_step_results,
                unresolved_blocking_failure: false,
            };
        }
        let Some(recovery_plan) = maybe_retry_failed_execution_legacy_plan(
            ctx,
            provider_route,
            workspace_path,
            content,
            model_id,
            reason_effort,
            service_tier,
            compat_base_url_override,
            api_key_override,
            fallback_api_key_override,
            local_codex_id_token_override,
            local_codex_refresh_token_override,
            persist_local_codex_auth_updates,
            oauth_credential_source_override,
            oauth_auth_mode_override,
            oauth_external_account_id_override,
            &current_plan,
            all_step_results.as_slice(),
            recovery_attempt,
        )
        .await
        else {
            break;
        };
        let recovery_diagnostics =
            build_runtime_planner_diagnostics(content, access_mode, &recovery_plan);
        publish_runtime_planner_diagnostics(ctx, turn_id, request_id, &recovery_diagnostics);
        if recovery_diagnostics.has_fatal || recovery_plan.steps.is_empty() {
            break;
        }
        current_plan = recovery_plan;
        current_planner_diagnostics = recovery_diagnostics;
    }

    ProviderRuntimePlanExecutionOutcome {
        final_plan: current_plan,
        step_results: all_step_results,
        unresolved_blocking_failure: true,
    }
}

#[cfg(test)]
mod tests {
    use super::should_attempt_provider_runtime_failure_recovery;
    use crate::turn_runtime_plan::ProviderRuntimeStepResult;
    use serde_json::json;

    fn build_result(ok: bool, kind: &str, error_code: Option<&str>) -> ProviderRuntimeStepResult {
        ProviderRuntimeStepResult {
            index: 0,
            kind: kind.to_string(),
            ok,
            message: "result".to_string(),
            output: None,
            metadata: json!({}),
            error_code: error_code.map(ToOwned::to_owned),
        }
    }

    #[test]
    fn failure_recovery_skips_generic_runtime_failures() {
        assert!(!should_attempt_provider_runtime_failure_recovery(&[
            build_result(false, "bash", Some("STEP_EXECUTION_FAILED"),)
        ]));
    }

    #[test]
    fn failure_recovery_allows_transient_and_missing_input_failures() {
        assert!(should_attempt_provider_runtime_failure_recovery(&[
            build_result(false, "bash", Some("STEP_TIMEOUT")),
            build_result(false, "read", Some("runtime.read.file_not_found")),
        ]));
    }

    #[test]
    fn failure_recovery_skips_runtime_guardrail_backoff_failures() {
        assert!(!should_attempt_provider_runtime_failure_recovery(&[
            build_result(false, "bash", Some("runtime.validation.circuit_open")),
            build_result(
                false,
                "diagnostics",
                Some("runtime.validation.metrics_unhealthy"),
            ),
        ]));
    }

    #[test]
    fn failure_recovery_allows_actionable_validation_failures() {
        assert!(should_attempt_provider_runtime_failure_recovery(&[
            build_result(false, "bash", Some("runtime.validation.command.restricted")),
            build_result(
                false,
                "write",
                Some("runtime.validation.path.outside_workspace")
            ),
        ]));
    }
}
