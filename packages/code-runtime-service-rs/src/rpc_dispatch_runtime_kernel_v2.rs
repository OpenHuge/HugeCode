use super::*;
use crate::agent_policy::{
    normalize_access_mode, normalize_agent_profile, normalize_reason_effort,
    parse_agent_task_start_request, resolve_agent_step_requires_approval, trim_optional_string,
    validate_agent_task_steps,
};
use crate::agent_task_launch_synthesis::{
    read_workspace_launch_context, synthesize_agent_task_auto_drive_state,
    synthesize_agent_task_mission_brief, synthesize_agent_task_steps, WorkspaceLaunchContext,
};
use super::mission_control_dispatch::{
    build_mission_run_projection_by_run_id, build_review_pack_projection_by_run_id,
};
use crate::runtime_helpers::normalize_agent_task_source_summary;

fn normalize_execution_mode_v2(value: Option<&str>) -> Result<&'static str, RpcError> {
    let normalized = value
        .unwrap_or("single")
        .trim()
        .to_ascii_lowercase()
        .replace('_', "-");
    match normalized.as_str() {
        "" | "single" => Ok("single"),
        "distributed" => Ok("distributed"),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported execution mode `{normalized}`. Expected one of: single, distributed."
        ))),
    }
}

fn infer_mission_objective_v2(request: &AgentTaskStartRequest) -> Option<String> {
    trim_optional_string(request.title.clone())
        .or_else(|| {
            trim_optional_string(
                request
                    .auto_drive
                    .as_ref()
                    .map(|entry| entry.destination.title.clone()),
            )
        })
        .or_else(|| {
            request
                .steps
                .iter()
                .find_map(|step| trim_optional_string(step.input.clone()))
        })
}

fn build_missing_context(run_objective: Option<&str>, request: &AgentTaskStartRequest) -> Vec<String> {
    let mut missing = Vec::new();
    if run_objective.is_none() {
        missing.push("objective".to_string());
    }
    if request.execution_profile_id.is_none() {
        missing.push("execution_profile".to_string());
    }
    if request.validation_preset_id.is_none() && request.auto_drive.is_some() {
        missing.push("validation_preset".to_string());
    }
    missing
}

fn build_context_working_set(
    workspace_context: &WorkspaceLaunchContext,
    task_source: Option<&AgentTaskSourceSummary>,
    preferred_backend_ids: &[String],
    synthesized_steps: &[AgentTaskStepInput],
) -> Value {
    let hot_entries = [
        workspace_context.workspace_root_path.as_ref().map(|root| {
            json!({
                "id": "workspace-root",
                "label": "Workspace root",
                "kind": "workspace",
                "detail": root,
                "source": root,
            })
        }),
        workspace_context.has_agents_md.then(|| {
            json!({
                "id": "agents-md",
                "label": "Repo instructions",
                "kind": "repo_rule",
                "detail": "AGENTS.md is present and should be treated as a hot rule surface.",
                "source": "AGENTS.md",
            })
        }),
        workspace_context.validate_command.as_ref().map(|command| {
            json!({
                "id": "validate-command",
                "label": "Primary validate command",
                "kind": "validation",
                "detail": command,
                "source": "package.json:scripts.validate",
            })
        }),
        (!preferred_backend_ids.is_empty()).then(|| {
            json!({
                "id": "preferred-backends",
                "label": "Preferred backends",
                "kind": "backend",
                "detail": preferred_backend_ids.join(", "),
                "source": "runtime preferredBackendIds",
            })
        }),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();

    let warm_entries = [
        (!workspace_context.evaluation_sample_paths.is_empty()).then(|| {
            json!({
                "id": "evaluation-samples",
                "label": "Evaluation sample paths",
                "kind": "validation",
                "detail": workspace_context.evaluation_sample_paths.join(", "),
                "source": ".codex/e2e-map.json or workspace layout",
            })
        }),
        workspace_context
            .has_repository_execution_contract
            .then(|| {
                json!({
                    "id": "repository-execution-contract",
                    "label": "Repository execution contract",
                    "kind": "repo_rule",
                    "detail": "Workspace ships .hugecode repository execution defaults.",
                    "source": ".hugecode/repository-execution-contract.json",
                })
            }),
        task_source.map(|source| {
            json!({
                "id": "task-source",
                "label": source.short_label.clone().or(source.label.clone()).unwrap_or_else(|| "Task source".to_string()),
                "kind": "task_source",
                "detail": source.reference.clone().or(source.title.clone()).or(source.url.clone()),
                "source": source.kind.clone(),
            })
        }),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();

    let cold_entries = synthesized_steps
        .iter()
        .enumerate()
        .take(6)
        .map(|(index, step)| {
            json!({
                "id": format!("step-{}", index + 1),
                "label": format!("Planned step {}", index + 1),
                "kind": "step",
                "detail": step
                    .input
                    .clone()
                    .or_else(|| step.path.clone())
                    .or_else(|| step.command.clone())
                    .or_else(|| step.kind.as_str().strip_prefix("").map(ToOwned::to_owned)),
                "source": step.kind.as_str(),
            })
        })
        .collect::<Vec<_>>();

    json!({
        "summary": "Runtime prepared a tiered working set so hot execution context stays compact and reviewable.",
        "workspaceRoot": workspace_context.workspace_root_path,
        "layers": [
            {
                "tier": "hot",
                "summary": if hot_entries.is_empty() {
                    "No hot context entries were inferred.".to_string()
                } else {
                    format!("{} hot context entr{}", hot_entries.len(), if hot_entries.len() == 1 { "y" } else { "ies" })
                },
                "entries": hot_entries,
            },
            {
                "tier": "warm",
                "summary": if warm_entries.is_empty() {
                    "No warm context entries were inferred.".to_string()
                } else {
                    format!("{} warm context entr{}", warm_entries.len(), if warm_entries.len() == 1 { "y" } else { "ies" })
                },
                "entries": warm_entries,
            },
            {
                "tier": "cold",
                "summary": if cold_entries.is_empty() {
                    "No cold context entries were inferred.".to_string()
                } else {
                    format!("{} cold context entr{}", cold_entries.len(), if cold_entries.len() == 1 { "y" } else { "ies" })
                },
                "entries": cold_entries,
            }
        ]
    })
}

fn step_kind_to_kernel_kind(step: &AgentTaskStepInput) -> &'static str {
    match step.kind {
        AgentStepKind::Read => "read",
        AgentStepKind::Diagnostics => "validate",
        AgentStepKind::Write | AgentStepKind::Edit => "edit",
        AgentStepKind::Bash | AgentStepKind::JsRepl => "plan",
    }
}

fn build_execution_graph(
    synthesized_steps: &[AgentTaskStepInput],
    access_mode: &str,
    agent_profile: &str,
) -> (Value, Vec<Value>) {
    let mut approval_batches = Vec::new();
    let mut approval_step_ids = Vec::new();
    let nodes = synthesized_steps
        .iter()
        .enumerate()
        .map(|(index, step)| {
            let requires_approval =
                resolve_agent_step_requires_approval(step, access_mode, agent_profile);
            let node_id = format!("step-{}", index + 1);
            if requires_approval {
                approval_step_ids.push(node_id.clone());
            }
            json!({
                "id": node_id,
                "label": step
                    .input
                    .clone()
                    .or_else(|| step.path.clone())
                    .or_else(|| step.command.clone())
                    .unwrap_or_else(|| format!("{} step {}", step.kind.as_str(), index + 1)),
                "kind": step_kind_to_kernel_kind(step),
                "status": "planned",
                "capability": step.kind.as_str(),
                "dependsOn": if index == 0 { Vec::<String>::new() } else { vec![format!("step-{index}")] },
                "parallelSafe": step.kind.parallel_safe(),
                "requiresApproval": requires_approval,
            })
        })
        .collect::<Vec<_>>();

    if !approval_step_ids.is_empty() {
        approval_batches.push(json!({
            "id": "approval-batch-1",
            "summary": format!("Batch {} approval-gated mutation step{}", approval_step_ids.len(), if approval_step_ids.len() == 1 { "" } else { "s" }),
            "riskLevel": if access_mode == "full-access" { "high" } else { "medium" },
            "actionCount": approval_step_ids.len(),
            "stepIds": approval_step_ids,
        }));
    }

    (
        json!({
            "graphId": format!("prepare-graph-{}", now_ms()),
            "summary": format!("Runtime prepared {} execution node{}", nodes.len(), if nodes.len() == 1 { "" } else { "s" }),
            "nodes": nodes,
        }),
        approval_batches,
    )
}

fn build_validation_plan(workspace_context: &WorkspaceLaunchContext) -> Value {
    let mut commands = Vec::new();
    if let Some(command) = workspace_context.validate_fast_command.as_ref() {
        commands.push(command.clone());
    }
    if let Some(command) = workspace_context.component_test_command.as_ref() {
        commands.push(command.clone());
    }
    if commands.is_empty() {
        if let Some(command) = workspace_context.validate_command.as_ref() {
            commands.push(command.clone());
        }
    }
    json!({
        "required": !commands.is_empty(),
        "summary": if commands.is_empty() {
            "Runtime could not infer a validation command from workspace defaults.".to_string()
        } else {
            format!("Runtime inferred {} validation command{}", commands.len(), if commands.len() == 1 { "" } else { "s" })
        },
        "commands": commands,
    })
}

fn parse_run_id(params: &Value) -> Result<String, RpcError> {
    let params = as_object(params)?;
    read_optional_string(params, "runId")
        .or_else(|| read_optional_string(params, "run_id"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| RpcError::invalid_params("runId is required."))
}

async fn build_prepare_response(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let request = parse_agent_task_start_request(params)?;
    let workspace_id = request.workspace_id.trim().to_string();
    let task_source = normalize_agent_task_source_summary(request.task_source.clone());
    let explicit_preferred_backend_ids = request
        .preferred_backend_ids
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    let explicit_launch_input = RepositoryExecutionExplicitLaunchInput {
        execution_profile_id: trim_optional_string(request.execution_profile_id.clone()),
        review_profile_id: trim_optional_string(request.review_profile_id.clone()),
        validation_preset_id: trim_optional_string(request.validation_preset_id.clone()),
        access_mode: trim_optional_string(request.access_mode.clone()),
        preferred_backend_ids: explicit_preferred_backend_ids.clone(),
        default_backend_id: trim_optional_string(request.default_backend_id.clone()),
    };
    let repository_defaults = resolve_workspace_repository_execution_defaults(
        ctx,
        workspace_id.as_str(),
        task_source.as_ref(),
        &explicit_launch_input,
    )
    .await
    .unwrap_or_default();
    let access_mode = normalize_access_mode(
        explicit_launch_input
            .access_mode
            .as_deref()
            .or(repository_defaults.access_mode.as_deref()),
    )?;
    let execution_mode = normalize_execution_mode_v2(
        request
            .execution_mode
            .as_deref()
            .or_else(|| profile_execution_mode(explicit_launch_input.execution_profile_id.as_deref())),
    )?;
    let _reason_effort = normalize_reason_effort(request.reason_effort.as_deref())?;
    let agent_profile = normalize_agent_profile(request.agent_profile.as_deref())?;
    validate_agent_task_steps(&request.steps, access_mode.as_str(), agent_profile.as_str())?;

    let workspace_context = read_workspace_launch_context(ctx, workspace_id.as_str()).await;
    let auto_drive = synthesize_agent_task_auto_drive_state(
        request.auto_drive.clone(),
        &workspace_context,
    );
    let objective = infer_mission_objective_v2(&request);
    let explicit_mission_brief =
        crate::runtime_helpers::normalize_agent_task_mission_brief(request.mission_brief.clone());
    let mission_brief = objective
        .clone()
        .map(|objective| {
            synthesize_agent_task_mission_brief(
                explicit_mission_brief.clone(),
                objective,
                access_mode.as_str(),
                explicit_preferred_backend_ids.as_slice(),
                auto_drive.as_ref(),
                &workspace_context,
            )
        })
        .or(explicit_mission_brief);
    let synthesized_steps = match mission_brief.as_ref() {
        Some(mission_brief) => synthesize_agent_task_steps(
            request.steps.clone(),
            auto_drive.as_ref(),
            mission_brief,
            &workspace_context,
        ),
        None => request.steps.clone(),
    };
    let (execution_graph, approval_batches) = build_execution_graph(
        synthesized_steps.as_slice(),
        access_mode.as_str(),
        agent_profile.as_str(),
    );
    let validation_plan = build_validation_plan(&workspace_context);
    let missing_context = build_missing_context(objective.as_deref(), &request);

    Ok(json!({
        "preparedAt": now_ms(),
        "runIntent": {
            "title": trim_optional_string(request.title.clone()),
            "objective": objective,
            "summary": mission_brief
                .as_ref()
                .map(|entry| format!("Objective: {}", entry.objective))
                .unwrap_or_else(|| "Runtime synthesized a launch intent brief from the incoming task request.".to_string()),
            "taskSource": task_source,
            "accessMode": access_mode,
            "executionMode": execution_mode,
            "executionProfileId": explicit_launch_input.execution_profile_id.or(repository_defaults.execution_profile_id),
            "reviewProfileId": explicit_launch_input.review_profile_id.or(repository_defaults.review_profile_id),
            "validationPresetId": explicit_launch_input.validation_preset_id.or(repository_defaults.validation_preset_id),
            "preferredBackendIds": if !explicit_preferred_backend_ids.is_empty() {
                explicit_preferred_backend_ids.clone()
            } else {
                repository_defaults.preferred_backend_ids
            },
            "requiredCapabilities": request.required_capabilities.clone().unwrap_or_default(),
            "riskLevel": mission_brief
                .as_ref()
                .and_then(|brief| brief.risk_level.clone())
                .unwrap_or_else(|| if access_mode == "full-access" { "high".to_string() } else if execution_mode == "distributed" { "medium".to_string() } else { "low".to_string() }),
            "clarified": missing_context.is_empty(),
            "missingContext": missing_context,
        },
        "contextWorkingSet": build_context_working_set(
            &workspace_context,
            task_source.as_ref(),
            explicit_preferred_backend_ids.as_slice(),
            synthesized_steps.as_slice(),
        ),
        "executionGraph": execution_graph,
        "approvalBatches": approval_batches,
        "validationPlan": validation_plan,
        "reviewFocus": [
            "Prefer runtime-published evidence over transcript-only conclusions.",
            "Run the narrowest validation that proves the change under current workspace rules.",
            "Keep blast radius low and preserve backend routing inspectability."
        ],
    }))
}

async fn build_run_record_v2(ctx: &AppContext, run_id: &str) -> Result<Value, RpcError> {
    let run = handle_agent_task_status(ctx, &json!({ "taskId": run_id })).await?;
    let mission_run = build_mission_run_projection_by_run_id(ctx, run_id)
        .await
        .ok_or_else(|| RpcError::invalid_params(format!("Run `{run_id}` was not found.")))?;
    let review_pack = build_review_pack_projection_by_run_id(ctx, run_id).await;
    Ok(json!({
        "run": run,
        "missionRun": mission_run,
        "reviewPack": review_pack,
    }))
}

pub(crate) async fn handle_runtime_run_prepare_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    build_prepare_response(ctx, params).await
}

pub(crate) async fn handle_runtime_run_start_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let start = handle_agent_task_start(ctx, params).await?;
    let run_id = start
        .get("taskId")
        .or_else(|| start.get("runId"))
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::internal("runtime run start v2 missing taskId"))?;
    build_run_record_v2(ctx, run_id).await
}

pub(crate) async fn handle_runtime_run_get_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let run_id = parse_run_id(params)?;
    build_run_record_v2(ctx, run_id.as_str()).await
}

pub(crate) async fn handle_runtime_run_subscribe_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let run_id = parse_run_id(params)?;
    build_run_record_v2(ctx, run_id.as_str()).await
}

pub(crate) async fn handle_runtime_review_get_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let run_id = parse_run_id(params)?;
    Ok(json!(build_review_pack_projection_by_run_id(ctx, run_id.as_str()).await))
}

pub(crate) async fn handle_runtime_run_resume_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let response = handle_agent_task_resume(ctx, params).await?;
    let run_id = response
        .get("runId")
        .or_else(|| response.get("taskId"))
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::internal("runtime run resume v2 missing runId"))?;
    build_run_record_v2(ctx, run_id).await
}

pub(crate) async fn handle_runtime_run_intervene_v2(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let response = handle_agent_task_intervene(ctx, params).await?;
    let run_id = response
        .get("spawnedRunId")
        .or_else(|| response.get("runId"))
        .or_else(|| response.get("taskId"))
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::internal("runtime run intervene v2 missing runId"))?;
    build_run_record_v2(ctx, run_id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_step(kind: AgentStepKind, input: &str, requires_approval: Option<bool>) -> AgentTaskStepInput {
        AgentTaskStepInput {
            kind,
            path: None,
            paths: None,
            input: Some(input.to_string()),
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            timeout_ms: None,
            max_items: None,
            requires_approval,
            approval_reason: None,
        }
    }

    #[test]
    fn build_missing_context_marks_objective_gap() {
        let request = AgentTaskStartRequest {
            workspace_id: "ws".to_string(),
            thread_id: None,
            request_id: None,
            title: None,
            task_source: None,
            execution_profile_id: None,
            review_profile_id: None,
            validation_preset_id: None,
            provider: None,
            model_id: None,
            reason_effort: None,
            access_mode: None,
            agent_profile: None,
            execution_mode: None,
            required_capabilities: None,
            preferred_backend_ids: None,
            default_backend_id: None,
            mission_brief: None,
            relaunch_context: None,
            auto_drive: None,
            steps: vec![sample_step(AgentStepKind::Read, "Inspect the runtime boundary", Some(false))],
        };
        assert_eq!(
            build_missing_context(None, &request),
            vec!["objective".to_string(), "execution_profile".to_string()]
        );
    }

    #[test]
    fn build_execution_graph_batches_approval_gated_steps() {
        let (graph, approval_batches) = build_execution_graph(
            &[
                sample_step(AgentStepKind::Read, "Read AGENTS.md", Some(false)),
                sample_step(AgentStepKind::Edit, "Refactor runtime kernel", Some(true)),
            ],
            "on-request",
            "code",
        );
        assert_eq!(graph["nodes"].as_array().map(Vec::len), Some(2));
        assert_eq!(approval_batches.len(), 1);
        assert_eq!(approval_batches[0]["actionCount"], json!(1));
    }

    #[test]
    fn build_validation_plan_prefers_fast_and_component_commands() {
        let context = WorkspaceLaunchContext {
            validate_fast_command: Some("pnpm validate:fast".to_string()),
            component_test_command: Some("pnpm test:component".to_string()),
            ..WorkspaceLaunchContext::default()
        };
        let plan = build_validation_plan(&context);
        assert_eq!(
            plan["commands"],
            json!(["pnpm validate:fast", "pnpm test:component"])
        );
        assert_eq!(plan["required"], json!(true));
    }
}
