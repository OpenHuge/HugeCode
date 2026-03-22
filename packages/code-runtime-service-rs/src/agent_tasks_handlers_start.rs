use super::*;
use crate::agent_policy::parse_agent_task_start_request;
use crate::agent_task_launch_synthesis::{
    read_workspace_launch_context, synthesize_agent_task_auto_drive_state,
    synthesize_agent_task_mission_brief, synthesize_agent_task_steps,
};

fn read_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn infer_mission_objective(request: &AgentTaskStartRequest) -> Option<String> {
    read_optional_text(request.title.as_deref())
        .or_else(|| {
            read_optional_text(
                request
                    .auto_drive
                    .as_ref()
                    .map(|entry| entry.destination.title.as_str()),
            )
        })
        .or_else(|| {
            request
                .steps
                .iter()
                .find_map(|step| read_optional_text(step.input.as_deref()))
        })
}

pub(super) async fn handle_agent_task_start(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request = parse_agent_task_start_request(params)?;
    let workspace_id = request.workspace_id.trim().to_string();
    let task_source =
        crate::runtime_helpers::normalize_agent_task_source_summary(request.task_source.clone());
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
    let execution_profile_id = explicit_launch_input
        .execution_profile_id
        .clone()
        .or_else(|| repository_defaults.execution_profile_id.clone());
    let execution_mode = normalize_execution_mode(
        request
            .execution_mode
            .as_deref()
            .or_else(|| profile_execution_mode(execution_profile_id.as_deref())),
    )?;
    let access_mode = normalize_access_mode(
        explicit_launch_input
            .access_mode
            .as_deref()
            .or(repository_defaults.access_mode.as_deref()),
    )?;
    let reason_effort = normalize_reason_effort(request.reason_effort.as_deref())?;
    let agent_profile = normalize_agent_profile(request.agent_profile.as_deref())?;
    validate_agent_task_steps(&request.steps, access_mode.as_str(), agent_profile.as_str())?;
    let provider_hint = trim_optional_string(request.provider.clone());
    let model_id_hint = trim_optional_string(request.model_id.clone());
    let request_id = trim_optional_string(request.request_id.clone());
    if let Some(existing_runtime) = {
        let store = ctx.agent_tasks.read().await;
        request_id.as_ref().and_then(|request_id| {
            store
                .tasks
                .values()
                .find(|runtime| {
                    runtime.summary.workspace_id == workspace_id
                        && runtime.summary.request_id.as_deref() == Some(request_id.as_str())
                        && !is_agent_task_terminal_status(runtime.summary.status.as_str())
                })
                .cloned()
        })
    } {
        let backend_snapshot = {
            let backend_store = ctx.runtime_backends.read().await;
            clone_runtime_backend_snapshot(
                &backend_store,
                existing_runtime.summary.backend_id.as_deref(),
            )
        };
        return build_agent_task_runtime_response_payload_for_ctx(
            ctx,
            &existing_runtime,
            backend_snapshot.as_ref(),
        )
        .await;
    }

    let title = trim_optional_string(request.title.clone());
    let thread_id = trim_optional_string(request.thread_id.clone());
    let review_profile_id = explicit_launch_input
        .review_profile_id
        .clone()
        .or_else(|| repository_defaults.review_profile_id.clone());
    let validation_preset_id = explicit_launch_input
        .validation_preset_id
        .clone()
        .or_else(|| repository_defaults.validation_preset_id.clone());
    let required_capabilities = request
        .required_capabilities
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    let preferred_backend_ids = if execution_mode == "distributed" {
        if !explicit_preferred_backend_ids.is_empty() {
            explicit_preferred_backend_ids
        } else if !repository_defaults.preferred_backend_ids.is_empty() {
            repository_defaults.preferred_backend_ids.clone()
        } else {
            repository_defaults
                .default_backend_id
                .clone()
                .into_iter()
                .collect::<Vec<_>>()
        }
    } else {
        Vec::new()
    };
    let workspace_launch_context = read_workspace_launch_context(ctx, workspace_id.as_str()).await;
    let auto_drive = synthesize_agent_task_auto_drive_state(
        request.auto_drive.clone(),
        &workspace_launch_context,
    );
    let explicit_mission_brief =
        crate::runtime_helpers::normalize_agent_task_mission_brief(request.mission_brief.clone());
    let mission_brief = infer_mission_objective(&request)
        .map(|objective| {
            synthesize_agent_task_mission_brief(
                explicit_mission_brief.clone(),
                objective,
                access_mode.as_str(),
                preferred_backend_ids.as_slice(),
                auto_drive.as_ref(),
                &workspace_launch_context,
            )
        })
        .or(explicit_mission_brief);
    let steps = match mission_brief.as_ref() {
        Some(mission_brief) => synthesize_agent_task_steps(
            request.steps.clone(),
            auto_drive.as_ref(),
            mission_brief,
            &workspace_launch_context,
        ),
        None => request.steps.clone(),
    };
    let relaunch_context =
        crate::runtime_helpers::normalize_agent_task_relaunch_context(request.relaunch_context);
    let (_, response_payload) = launch_agent_task(
        ctx,
        LaunchAgentTaskSpec {
            workspace_id,
            thread_id,
            request_id,
            title,
            task_source,
            execution_profile_id,
            review_profile_id,
            validation_preset_id,
            provider_hint,
            model_id_hint,
            reason_effort,
            access_mode,
            agent_profile,
            execution_mode: execution_mode.to_string(),
            required_capabilities,
            preferred_backend_ids,
            max_subtasks: mission_brief.as_ref().and_then(|brief| brief.max_subtasks),
            mission_brief,
            relaunch_context,
            steps,
            auto_drive,
            root_task_id: None,
            parent_task_id: None,
        },
    )
    .await?;

    Ok(response_payload)
}
