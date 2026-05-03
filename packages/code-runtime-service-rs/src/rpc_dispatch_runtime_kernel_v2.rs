use super::mission_control_dispatch::{build_mission_run_projection_by_run_id, build_review_pack_projection_by_run_id};
use super::runtime_kernel_v2_plan::{build_prepare_plan, build_validation_lanes};
#[path = "rpc_dispatch_runtime_kernel_v2_execution_summary.rs"]
mod execution_summary;
#[path = "rpc_dispatch_runtime_kernel_v2_prepare_planes.rs"]
mod prepare_planes;
#[path = "rpc_dispatch_runtime_kernel_v2_run_id.rs"]
mod run_id;
#[path = "rpc_dispatch_runtime_kernel_v2_sub_agent_materialization.rs"]
mod sub_agent_materialization;
use super::*;
use crate::agent_policy::{
    normalize_access_mode, normalize_agent_profile, normalize_reason_effort,
    parse_agent_task_start_request, resolve_agent_step_requires_approval, trim_optional_string,
    validate_agent_task_steps,
};
use crate::agent_task_launch_synthesis::{
    WorkspaceLaunchContext, read_workspace_launch_context, synthesize_agent_task_auto_drive_state,
    synthesize_agent_task_mission_brief, synthesize_agent_task_steps,
};
use crate::repository_execution_contract::RepositoryExecutionResolvedDefaults;
use crate::runtime_helpers::normalize_agent_task_source_summary;
use execution_summary::{inject_runtime_execution_summaries, serialize_review_pack_with_runtime_summaries};
use prepare_planes::{build_context_plane, build_eval_plane, build_tooling_plane};
use run_id::parse_run_id;
use sub_agent_materialization::materialize_parallel_safe_sub_agent_lanes;
use std::{collections::hash_map::DefaultHasher, hash::{Hash, Hasher}};
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

fn build_missing_context(
    run_objective: Option<&str>,
    request: &AgentTaskStartRequest,
) -> Vec<String> {
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

fn summarize_repo_instruction_sources(sources: &[String], max_items: usize) -> String {
    if sources.is_empty() {
        return "No repo instruction surfaces".to_string();
    }
    let shown = sources.iter().take(max_items).cloned().collect::<Vec<_>>();
    let remaining = sources.len().saturating_sub(shown.len());
    if remaining == 0 {
        shown.join(", ")
    } else {
        format!("{} (+{} more)", shown.join(", "), remaining)
    }
}

fn resolve_repo_instruction_source_marker(workspace_context: &WorkspaceLaunchContext) -> String {
    if workspace_context.repo_instruction_sources.len() == 1 {
        workspace_context.repo_instruction_sources[0].clone()
    } else {
        "repo_guidance".to_string()
    }
}

fn build_context_working_set(
    workspace_context: &WorkspaceLaunchContext,
    task_source: Option<&AgentTaskSourceSummary>,
    access_mode: &str,
    execution_mode: &str,
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
        (!workspace_context.repo_instruction_sources.is_empty()).then(|| {
            json!({
                "id": "repo-instruction-surfaces",
                "label": "Repo instruction surfaces",
                "kind": "repo_rule",
                "detail": format!(
                    "Runtime detected {} as hot repo guidance surfaces.",
                    summarize_repo_instruction_sources(workspace_context.repo_instruction_sources.as_slice(), 4)
                ),
                "source": resolve_repo_instruction_source_marker(workspace_context),
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

    let selection_policy = build_context_selection_policy(
        access_mode,
        execution_mode,
        preferred_backend_ids,
        synthesized_steps,
    );
    let stable_prefix_fingerprint = compute_context_entries_fingerprint(
        "runtime-context-stable-prefix",
        hot_entries.iter().chain(warm_entries.iter()),
    );
    let context_fingerprint = compute_context_entries_fingerprint(
        "runtime-context-working-set",
        hot_entries
            .iter()
            .chain(warm_entries.iter())
            .chain(cold_entries.iter()),
    );

    json!({
        "summary": "Runtime prepared a tiered working set so hot execution context stays compact and reviewable.",
        "workspaceRoot": workspace_context.workspace_root_path,
        "selectionPolicy": selection_policy,
        "contextFingerprint": context_fingerprint,
        "stablePrefixFingerprint": stable_prefix_fingerprint,
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

fn classify_context_source_family(kind: Option<&str>) -> &'static str {
    match kind.unwrap_or_default() {
        "github_issue" | "github_pr_followup" => "github",
        "github_discussion" => "discussion",
        "note" => "note",
        "customer_feedback" => "feedback",
        "doc" => "doc",
        "call_summary" => "call",
        "external_ref" => "external",
        "schedule" => "schedule",
        "external_runtime" => "runtime",
        _ => "manual",
    }
}

fn infer_review_intent(
    task_source: Option<&AgentTaskSourceSummary>,
    review_profile_id: Option<&str>,
) -> &'static str {
    if review_profile_id.is_some() {
        return "review";
    }
    match task_source
        .map(|source| source.kind.as_str())
        .unwrap_or_default()
    {
        "github_pr_followup" => "review",
        "github_issue" | "github_discussion" | "customer_feedback" | "call_summary" => "triage",
        _ => "execute",
    }
}

fn build_context_truth(
    task_source: Option<&AgentTaskSourceSummary>,
    repository_defaults: &RepositoryExecutionResolvedDefaults,
) -> Value {
    let canonical_task_source = task_source.map(|source| {
        let label = trim_optional_string(source.label.clone())
            .or_else(|| trim_optional_string(source.title.clone()))
            .or_else(|| trim_optional_string(source.reference.clone()))
            .unwrap_or_else(|| "Task source".to_string());
        let summary_parts = [
            trim_optional_string(source.title.clone()),
            trim_optional_string(source.reference.clone()),
            source
                .repo
                .as_ref()
                .and_then(|repo| trim_optional_string(repo.full_name.clone())),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
        json!({
            "kind": source.kind,
            "family": classify_context_source_family(Some(source.kind.as_str())),
            "label": label,
            "summary": if summary_parts.is_empty() { label.clone() } else { summary_parts.join(" · ") },
            "source": source.kind,
            "reference": source.reference,
            "canonicalUrl": source.canonical_url.clone().or(source.url.clone()).or(source.external_id.clone()),
            "primary": true,
        })
    });
    let mut source_metadata = task_source
        .map(|source| {
            [
                source
                    .repo
                    .as_ref()
                    .and_then(|repo| trim_optional_string(repo.full_name.clone())),
                trim_optional_string(source.reference.clone()),
                trim_optional_string(source.canonical_url.clone()),
                repository_defaults.triage_owner.clone(),
                repository_defaults.triage_priority.clone(),
                repository_defaults.triage_risk_level.clone(),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    source_metadata.extend(repository_defaults.triage_tags.clone());
    let owner = repository_defaults
        .triage_owner
        .clone()
        .unwrap_or_else(|| "Human owner".to_string());
    json!({
        "summary": canonical_task_source
            .as_ref()
            .map(|source| {
                format!(
                    "Runtime normalized {} context into the canonical governed run path.",
                    source.get("family").and_then(Value::as_str).unwrap_or("manual")
                )
            })
            .unwrap_or_else(|| "Runtime will treat this launch as a manual context pack.".to_string()),
        "canonicalTaskSource": canonical_task_source,
        "sources": canonical_task_source
            .clone()
            .map(|source| vec![source])
            .unwrap_or_default(),
        "executionProfileId": repository_defaults.execution_profile_id.clone(),
        "reviewProfileId": repository_defaults.review_profile_id.clone(),
        "validationPresetId": repository_defaults.validation_preset_id.clone(),
        "reviewIntent": infer_review_intent(task_source, repository_defaults.review_profile_id.as_deref()),
        "ownerSummary": format!("{owner} stays accountable; the runtime agent executes the delegated work."),
        "sourceMetadata": source_metadata,
        "consumers": ["run", "review_pack", "takeover", "follow_up"],
    })
}

fn build_guidance_stack(
    workspace_context: &WorkspaceLaunchContext,
    task_source: Option<&AgentTaskSourceSummary>,
    repository_defaults: &RepositoryExecutionResolvedDefaults,
    missing_context: &[String],
    has_explicit_instruction: bool,
) -> Value {
    let mut layers = Vec::new();
    if !workspace_context.repo_instruction_sources.is_empty() {
        let repo_instructions = if repository_defaults.repo_instructions.is_empty() {
            vec![
                "Prefer runtime-owned truth over page-local heuristics.".to_string(),
                "Keep launch, review, and continuation semantics aligned.".to_string(),
            ]
        } else {
            repository_defaults.repo_instructions.clone()
        };
        layers.push(json!({
            "id": "repo-instructions",
            "scope": "repo",
            "summary": "Repository instruction surfaces remain the baseline contract for launch, review, and follow-up.",
            "source": resolve_repo_instruction_source_marker(workspace_context),
            "priority": 10,
            "instructions": repo_instructions,
            "skillIds": repository_defaults.repo_skill_ids.clone()
        }));
    }
    if let Some(source_mapping_kind) = repository_defaults.source_mapping_kind.as_ref() {
        let source_instructions = if repository_defaults.source_instructions.is_empty() {
            vec![
                "Normalize source-linked work into canonical task/run/review semantics."
                    .to_string(),
            ]
        } else {
            repository_defaults.source_instructions.clone()
        };
        layers.push(json!({
            "id": "source-guidance",
            "scope": "source",
            "summary": format!("Source kind {source_mapping_kind} enters the same governed run path as manual work."),
            "source": source_mapping_kind,
            "priority": 40,
            "instructions": source_instructions,
            "skillIds": repository_defaults.source_skill_ids.clone()
        }));
    } else if let Some(task_source) = task_source {
        layers.push(json!({
            "id": "source-guidance",
            "scope": "source",
            "summary": format!("Source kind {} enters the same governed run path as manual work.", task_source.kind),
            "source": task_source.kind,
            "priority": 40,
            "instructions": [
                "Normalize source-linked work into canonical task/run/review semantics."
            ],
            "skillIds": []
        }));
    }
    if repository_defaults.review_profile_id.is_some() {
        layers.push(json!({
            "id": "review-profile",
            "scope": "review_profile",
            "summary": "Repository execution defaults resolve review and validation policy before launch.",
            "source": ".hugecode/repository-execution-contract.json",
            "priority": 30,
            "instructions": [
                "Apply repo defaults before inventing source-local routing or validation policy."
            ],
            "skillIds": []
        }));
    }
    if let Some(review_profile) = repository_defaults.review_profile.as_ref() {
        layers.push(json!({
            "id": "review-profile-skills",
            "scope": "review_profile",
            "summary": format!("Review profile {} contributes reusable review skills.", review_profile.label),
            "source": review_profile.id,
            "priority": 60,
            "instructions": [],
            "skillIds": review_profile.allowed_skill_ids
        }));
    }
    if has_explicit_instruction {
        layers.push(json!({
            "id": "launch-guidance",
            "scope": "launch",
            "summary": "The explicit task instruction is the highest-precedence launch guidance.",
            "source": "launch_instruction",
            "priority": 100,
            "instructions": [
                "Favor the operator's explicit objective when guidance layers conflict."
            ],
            "skillIds": []
        }));
    } else if !missing_context.is_empty() {
        layers.push(json!({
            "id": "launch-guidance",
            "scope": "launch",
            "summary": "Launch-time clarification still has the highest precedence over queued autonomous work.",
            "source": "prepare_v2",
            "priority": 100,
            "instructions": [
                "Clarify missing context before widening unattended execution."
            ],
            "skillIds": []
        }));
    }
    let mut precedence_layers = layers.iter().collect::<Vec<_>>();
    precedence_layers.sort_by(|left, right| {
        right
            .get("priority")
            .and_then(Value::as_i64)
            .cmp(&left.get("priority").and_then(Value::as_i64))
    });
    let precedence = precedence_layers
        .into_iter()
        .filter_map(|layer| layer.get("scope").and_then(Value::as_str))
        .collect::<Vec<_>>();
    json!({
        "summary": if precedence.is_empty() {
            "No guidance layers were inferred.".to_string()
        } else {
            format!("Guidance resolves through {}.", precedence.join(" -> "))
        },
        "precedence": precedence,
        "layers": layers,
    })
}

fn build_triage_summary(
    task_source: Option<&AgentTaskSourceSummary>,
    repository_defaults: &RepositoryExecutionResolvedDefaults,
) -> Value {
    let dedupe_key = task_source.and_then(|source| {
        let parts = [
            Some(source.kind.clone()),
            trim_optional_string(source.canonical_url.clone()),
            trim_optional_string(source.url.clone()),
            trim_optional_string(source.reference.clone()),
            trim_optional_string(source.external_id.clone()),
            trim_optional_string(source.title.clone()),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
        if parts.is_empty() {
            None
        } else {
            Some(parts.join("::").to_ascii_lowercase())
        }
    });
    let summary_parts = [
        repository_defaults
            .triage_owner
            .clone()
            .map(|owner| format!("Owner {owner}"))
            .or_else(|| Some("Owner unassigned".to_string())),
        repository_defaults
            .triage_priority
            .clone()
            .map(|priority| format!("Priority {priority}")),
        repository_defaults
            .triage_risk_level
            .clone()
            .map(|risk| format!("Risk {risk}")),
        (!repository_defaults.triage_tags.is_empty())
            .then(|| format!("Tags {}", repository_defaults.triage_tags.join(", "))),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    json!({
        "owner": repository_defaults.triage_owner.clone(),
        "priority": repository_defaults.triage_priority.clone(),
        "riskLevel": repository_defaults.triage_risk_level.clone(),
        "tags": repository_defaults.triage_tags.clone(),
        "dedupeKey": dedupe_key,
        "summary": summary_parts.join(" · "),
    })
}

fn build_delegation_contract(
    triage_summary: &Value,
    accountability: &str,
    missing_context: &[String],
    approval_batches: &[Value],
) -> Value {
    let blocked = false;
    let state = if blocked {
        "blocked"
    } else if !missing_context.is_empty() {
        "needs_clarification"
    } else {
        "launch_ready"
    };
    let next_operator_action = if !missing_context.is_empty() {
        format!("Clarify missing context: {}.", missing_context.join(", "))
    } else if !approval_batches.is_empty() {
        "Launch the run and expect approval checkpoints on mutation steps.".to_string()
    } else {
        "Launch the run and review the resulting Review Pack before accepting outcomes.".to_string()
    };
    json!({
        "summary": if state == "launch_ready" {
            "Delegate the work, then review a compact evidence artifact instead of supervising the full transcript."
        } else {
            "Delegation remains governed: the human owner decides, the agent executes, and the next operator action is explicit."
        },
        "state": state,
        "humanOwner": triage_summary.get("owner").and_then(Value::as_str).unwrap_or("Operator"),
        "agentExecutor": "Runtime agent",
        "accountability": accountability,
        "nextOperatorAction": next_operator_action,
        "continueVia": Value::Null,
    })
}
fn build_context_selection_policy(
    access_mode: &str,
    execution_mode: &str,
    preferred_backend_ids: &[String],
    synthesized_steps: &[AgentTaskStepInput],
) -> Value {
    let strategy = if access_mode == "read-only" {
        "minimal"
    } else if execution_mode == "distributed"
        || preferred_backend_ids.len() > 1
        || synthesized_steps.len() >= 4
    {
        "deep"
    } else {
        "balanced"
    };
    let token_budget_target = match strategy {
        "minimal" => 900,
        "deep" => 2200,
        _ => 1500,
    };
    let tool_exposure_profile = match access_mode {
        "read-only" => "minimal",
        "full-access" => "full",
        _ => "slim",
    };

    json!({
        "strategy": strategy,
        "tokenBudgetTarget": token_budget_target,
        "toolExposureProfile": tool_exposure_profile,
        "preferColdFetch": strategy != "deep",
    })
}

fn compute_context_entries_fingerprint<'a>(
    namespace: &str,
    entries: impl IntoIterator<Item = &'a Value>,
) -> String {
    let mut hasher = DefaultHasher::new();
    namespace.hash(&mut hasher);
    for entry in entries {
        entry.to_string().hash(&mut hasher);
    }
    format!("{:016x}", hasher.finish())
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
    let parallel_safe_total = synthesized_steps
        .iter()
        .filter(|step| step.kind.parallel_safe())
        .count();
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
                "delegationGroupId": if step.kind.parallel_safe() && parallel_safe_total > 1 {
                    Value::String("prepare-fanout-1".to_string())
                } else {
                    Value::Null
                },
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

fn build_delegation_plan(
    execution_graph: &Value,
    approval_batches: &[Value],
    preferred_backend_ids: &[String],
    missing_context: &[String],
) -> Value {
    let nodes = execution_graph
        .get("nodes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let delegated_nodes = nodes
        .iter()
        .filter(|node| {
            node.get("parallelSafe")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    let child_roles = delegated_nodes
        .iter()
        .filter_map(|node| node.get("capability").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    let fan_out_ready = !child_roles.is_empty();
    let review_required = !approval_batches.is_empty() || !missing_context.is_empty();
    let merge_strategy = if !approval_batches.is_empty() {
        "operator_review"
    } else if missing_context.is_empty() {
        "runtime_summary"
    } else {
        "blocking_merge"
    };
    json!({
        "summary": if fan_out_ready {
            format!(
                "Runtime can delegate {} bounded child lane(s) with {} merge discipline.",
                child_roles.len(),
                merge_strategy.replace('_', " ")
            )
        } else {
            "Runtime kept delegation serial because the prepare graph did not expose a safe fan-out lane.".to_string()
        },
        "fanOutReady": fan_out_ready,
        "reviewRequired": review_required,
        "childCount": child_roles.len(),
        "batches": if fan_out_ready {
            json!([{
                "id": "prepare-fanout-1",
                "summary": "Parallel child delegation group derived from runtime execution graph.",
                "strategy": "parallel",
                "mergeStrategy": merge_strategy,
                "childRoles": child_roles,
                "preferredBackendIds": preferred_backend_ids,
            }])
        } else {
            json!([{
                "id": "prepare-fanout-1",
                "summary": "Serial delegation fallback keeps runtime governance intact until a safe fan-out lane appears.",
                "strategy": "serial",
                "mergeStrategy": merge_strategy,
                "childRoles": Vec::<String>::new(),
                "preferredBackendIds": preferred_backend_ids,
            }])
        },
    })
}

fn build_auxiliary_execution_policy(allow_network_analysis: bool) -> Value {
    json!({
        "enabled": true,
        "summary": "Runtime routes compaction, recall, and skill-draft work through an auxiliary policy instead of inflating the primary execution lane.",
        "routes": [
            {
                "task": "context_compaction",
                "mode": "auxiliary_preferred",
                "summary": "Context compaction prefers an auxiliary summarization lane with primary fallback.",
                "provider": Value::Null,
                "modelId": Value::Null,
            },
            {
                "task": "session_recall",
                "mode": "auxiliary_preferred",
                "summary": "Session recall uses the auxiliary lane to condense prior execution evidence before injection.",
                "provider": Value::Null,
                "modelId": Value::Null,
            },
            {
                "task": "skill_candidate_draft",
                "mode": "auxiliary_preferred",
                "summary": "Runtime drafts reusable skill candidates outside the primary execution budget.",
                "provider": Value::Null,
                "modelId": Value::Null,
            },
            {
                "task": "browser_assessment",
                "mode": if allow_network_analysis {
                    "primary_fallback"
                } else {
                    "primary_only"
                },
                "summary": if allow_network_analysis {
                    "Browser assessment may route through auxiliary analysis first, then fall back to the primary lane."
                } else {
                    "Browser assessment stays on the primary lane because network analysis is disabled."
                },
                "provider": Value::Null,
                "modelId": Value::Null,
            }
        ],
        "fallbackSummary": "If the auxiliary lane is unavailable, runtime falls back to the primary execution lane without widening child permissions.",
    })
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

fn resolve_autonomy_request_value(
    provided: Option<&Value>,
    auto_drive: Option<&AgentTaskAutoDriveState>,
) -> Value {
    let provided = provided.and_then(Value::as_object).cloned();
    if let Some(mut autonomy_request) = provided {
        autonomy_request
            .entry("autonomyProfile".to_string())
            .or_insert_with(|| Value::String("night_operator".to_string()));
        autonomy_request
            .entry("sourceScope".to_string())
            .or_insert_with(|| {
                Value::String(
                    auto_drive
                        .and_then(|entry| entry.context_policy.as_ref())
                        .and_then(|policy| policy.scope.clone())
                        .unwrap_or_else(|| "workspace_graph".to_string()),
                )
            });
        autonomy_request
            .entry("queueBudget".to_string())
            .or_insert_with(|| {
                json!({
                    "maxQueuedActions": 2,
                    "maxAutoContinuations": 2,
                })
            });
        autonomy_request
            .entry("wakePolicy".to_string())
            .or_insert_with(|| {
                json!({
                    "mode": "auto_queue",
                    "safeFollowUp": true,
                    "allowAutomaticContinuation": true,
                    "allowedActions": ["continue", "approve", "clarify", "reroute", "pair", "hold"],
                    "stopGates": [
                        "destructive_change_requires_review",
                        "dependency_change_requires_review",
                        "validation_failure_requires_review",
                    ],
                })
            });
        autonomy_request
            .entry("researchPolicy".to_string())
            .or_insert_with(|| {
                json!({
                    "mode": if auto_drive
                        .and_then(|entry| entry.risk_policy.as_ref())
                        .and_then(|policy| policy.allow_network_analysis)
                        .unwrap_or(false)
                    {
                        "staged"
                    } else {
                        "repository_only"
                    },
                    "allowNetworkAnalysis": auto_drive
                        .and_then(|entry| entry.risk_policy.as_ref())
                        .and_then(|policy| policy.allow_network_analysis)
                        .unwrap_or(false),
                    "requireCitations": true,
                    "allowPrivateContextStage": auto_drive
                        .and_then(|entry| entry.risk_policy.as_ref())
                        .and_then(|policy| policy.allow_network_analysis)
                        .unwrap_or(false),
                })
            });
        return Value::Object(autonomy_request);
    }

    let allow_network_analysis = auto_drive
        .and_then(|entry| entry.risk_policy.as_ref())
        .and_then(|policy| policy.allow_network_analysis)
        .unwrap_or(false);
    let max_runtime_minutes = auto_drive
        .and_then(|entry| entry.budget.as_ref())
        .and_then(|budget| budget.max_duration_ms)
        .map(|value| ((value + 59_999) / 60_000) as u64);
    json!({
        "autonomyProfile": "night_operator",
        "sourceScope": auto_drive
            .and_then(|entry| entry.context_policy.as_ref())
            .and_then(|policy| policy.scope.clone())
            .unwrap_or_else(|| {
                if allow_network_analysis {
                    "workspace_graph_and_public_web".to_string()
                } else {
                    "workspace_graph".to_string()
                }
            }),
        "queueBudget": {
            "maxQueuedActions": 2,
            "maxRuntimeMinutes": max_runtime_minutes,
            "maxAutoContinuations": 2,
        },
        "wakePolicy": {
            "mode": "auto_queue",
            "safeFollowUp": true,
            "allowAutomaticContinuation": true,
            "allowedActions": ["continue", "approve", "clarify", "reroute", "pair", "hold"],
            "stopGates": [
                "destructive_change_requires_review",
                "dependency_change_requires_review",
                "validation_failure_requires_review",
                "low_confidence_reroute_requires_review",
            ],
        },
        "researchPolicy": {
            "mode": if allow_network_analysis { "staged" } else { "repository_only" },
            "allowNetworkAnalysis": allow_network_analysis,
            "requireCitations": true,
            "allowPrivateContextStage": allow_network_analysis,
        },
    })
}

fn build_intent_snapshot(
    objective: Option<&str>,
    task_source: Option<&AgentTaskSourceSummary>,
    workspace_context: &WorkspaceLaunchContext,
    missing_context: &[String],
) -> Value {
    let mut signals = Vec::new();
    if let Some(objective) = objective {
        signals.push(json!({
            "kind": "operator_intent",
            "summary": format!("Operator objective centers on `{objective}`."),
            "source": "request.title_or_steps",
            "confidence": "high",
        }));
    }
    if let Some(source) = task_source {
        signals.push(json!({
            "kind": "task_source",
            "summary": source
                .label
                .clone()
                .or(source.title.clone())
                .or(source.reference.clone())
                .unwrap_or_else(|| "Runtime received an external task source.".to_string()),
            "source": source.kind.clone(),
            "confidence": "medium",
        }));
    }
    if !workspace_context.repo_instruction_sources.is_empty() {
        signals.push(json!({
            "kind": "repo_rule",
            "summary": format!(
                "Workspace publishes repository guidance surfaces ({}) and runtime should respect them as authority.",
                summarize_repo_instruction_sources(workspace_context.repo_instruction_sources.as_slice(), 3)
            ),
            "source": resolve_repo_instruction_source_marker(workspace_context),
            "confidence": "high",
        }));
    }
    if !missing_context.is_empty() {
        signals.push(json!({
            "kind": "validation_debt",
            "summary": format!(
                "Runtime still needs {} before it can fully clarify the next unattended step.",
                missing_context.join(", ")
            ),
            "source": "prepare_v2",
            "confidence": "medium",
        }));
    }
    json!({
        "summary": objective
            .map(|value| format!("Runtime synthesized a bounded intent model for `{value}`."))
            .unwrap_or_else(|| "Runtime synthesized a bounded intent model from the incoming request.".to_string()),
        "primaryGoal": objective,
        "dominantDirection": objective
            .map(|value| format!("Advance `{value}` while preserving repo and validation guardrails.")),
        "confidence": if missing_context.is_empty() { "high" } else { "medium" },
        "signals": signals,
    })
}

fn build_opportunity_queue(
    objective: Option<&str>,
    validation_plan: &Value,
    missing_context: &[String],
) -> Value {
    let objective_label = objective.unwrap_or("the mission objective");
    let has_validation = validation_plan
        .get("required")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let mut candidates = vec![json!({
        "id": "opportunity-primary",
        "title": format!("Advance {objective_label}"),
        "summary": "Start with the narrowest repo-grounded step that can move the mission forward tonight.",
        "whySelected": "It is the closest bounded opportunity to the operator objective.",
        "whyNow": if missing_context.is_empty() {
            "Context is sufficiently clarified for bounded execution."
        } else {
            "Runtime can still make progress while surfacing the remaining ambiguity."
        },
        "evidence": [
            "operator objective",
            "repo instructions",
            "runtime prepare graph",
        ],
        "risk": if missing_context.is_empty() { "low" } else { "medium" },
        "stopGates": [
            "destructive_change_requires_review",
            "dependency_change_requires_review",
            "approval_or_permission_change_required",
        ],
        "nextWakeAction": if missing_context.is_empty() { "continue" } else { "clarify" },
        "score": if missing_context.is_empty() { 92 } else { 78 },
        "confidence": if missing_context.is_empty() { "high" } else { "medium" },
    })];
    if has_validation {
        candidates.push(json!({
            "id": "opportunity-validation",
            "title": "Tighten validation confidence",
            "summary": "Keep the queue anchored to the narrowest real validation lane before wake-up.",
            "whySelected": "Night Operator should preserve runtime-owned evidence quality.",
            "whyNow": "Validation debt compounds quickly during unattended execution.",
            "evidence": [
                "workspace validation defaults",
                "runtime validation plan",
            ],
            "risk": "low",
            "stopGates": [
                "validation_failure_requires_review",
                "approval_or_permission_change_required",
            ],
            "nextWakeAction": "approve",
            "score": 71,
            "confidence": "medium",
        }));
    }
    json!({
        "selectedOpportunityId": "opportunity-primary",
        "selectionSummary": "Runtime selected the closest bounded opportunity and kept a validation follow-up queued behind it.",
        "candidates": candidates,
    })
}

fn build_source_citations(
    task_source: Option<&AgentTaskSourceSummary>,
    workspace_context: &WorkspaceLaunchContext,
) -> Vec<Value> {
    let mut citations = Vec::new();
    if !workspace_context.repo_instruction_sources.is_empty() {
        for source in workspace_context.repo_instruction_sources.iter().take(4) {
            citations.push(json!({
                "id": format!("repo-instruction-{}", source.replace(['/', '.'], "-")),
                "label": source,
                "url": Value::Null,
                "sourceKind": "repo_doc",
                "trustLevel": "primary",
                "claimSummary": "Repository instruction surfaces remain primary authority for unattended execution.",
            }));
        }
    }
    if let Some(source) = task_source {
        citations.push(json!({
            "id": "task-source",
            "label": source
                .label
                .clone()
                .or(source.title.clone())
                .unwrap_or_else(|| "Task source".to_string()),
            "url": source.url.clone(),
            "sourceKind": "task_source",
            "trustLevel": if source.url.is_some() { "primary" } else { "runtime" },
            "claimSummary": source
                .reference
                .clone()
                .or(source.title.clone())
                .unwrap_or_else(|| "Task source provided the initial mission prompt.".to_string()),
        }));
    }
    citations
}

fn build_research_trace(
    autonomy_request: &Value,
    task_source: Option<&AgentTaskSourceSummary>,
    workspace_context: &WorkspaceLaunchContext,
) -> Value {
    let research_policy = autonomy_request
        .get("researchPolicy")
        .or_else(|| autonomy_request.get("research_policy"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let mode = research_policy
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("repository_only");
    json!({
        "mode": mode,
        "stage": if mode == "staged" {
            "repository"
        } else if mode == "public_web" {
            "public_web"
        } else {
            "repository"
        },
        "summary": if mode == "staged" {
            "AutoResearch is staged: runtime starts from repo truth before expanding into public-web sources."
        } else if mode == "public_web" {
            "Research policy allows public-web lookups, but citations remain required."
        } else {
            "Research remains repository-only until runtime explicitly promotes the lane."
        },
        "citations": build_source_citations(task_source, workspace_context),
        "sensitiveContextMixed": false,
    })
}

fn build_execution_eligibility(missing_context: &[String], approval_batches: &[Value]) -> Value {
    let blocking_reasons = if missing_context.is_empty() {
        Vec::new()
    } else {
        missing_context
            .iter()
            .map(|entry| format!("Missing {entry}"))
            .collect::<Vec<_>>()
    };
    json!({
        "eligible": blocking_reasons.is_empty(),
        "summary": if blocking_reasons.is_empty() {
            "Runtime can begin bounded Night Operator execution without waking the operator first."
        } else {
            "Runtime should clarify missing context before chaining beyond the first bounded opportunity."
        },
        "wakeState": if blocking_reasons.is_empty() {
            "ready"
        } else if approval_batches.is_empty() {
            "attention"
        } else {
            "blocked"
        },
        "nextEligibleAction": if blocking_reasons.is_empty() { "continue" } else { "clarify" },
        "blockingReasons": blocking_reasons,
    })
}

fn build_wake_policy_summary(wake_policy: &Value) -> Value {
    let mode = wake_policy
        .get("mode")
        .and_then(Value::as_str)
        .unwrap_or("auto_queue");
    let safe_follow_up = wake_policy
        .get("safeFollowUp")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let allowed_actions = wake_policy
        .get("allowedActions")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| {
            vec![
                Value::String("continue".to_string()),
                Value::String("approve".to_string()),
                Value::String("clarify".to_string()),
                Value::String("reroute".to_string()),
                Value::String("pair".to_string()),
                Value::String("hold".to_string()),
            ]
        });
    json!({
        "summary": match mode {
            "hold" => "Runtime will stop at the next wake gate and wait for explicit review.",
            "review_queue" => "Runtime will queue review-ready wake actions without continuing blindly.",
            _ => "Runtime will use Auto Queue and stop only at explicit wake gates.",
        },
        "safeFollowUp": safe_follow_up,
        "allowedActions": allowed_actions,
        "queueBudget": wake_policy.get("queueBudget").cloned().unwrap_or(Value::Null),
    })
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
    let execution_mode =
        normalize_execution_mode_v2(request.execution_mode.as_deref().or_else(|| {
            profile_execution_mode(explicit_launch_input.execution_profile_id.as_deref())
        }))?;
    let _reason_effort = normalize_reason_effort(request.reason_effort.as_deref())?;
    let agent_profile = normalize_agent_profile(request.agent_profile.as_deref())?;
    validate_agent_task_steps(&request.steps, access_mode.as_str(), agent_profile.as_str())?;

    let workspace_context = read_workspace_launch_context(ctx, workspace_id.as_str()).await;
    let auto_drive =
        synthesize_agent_task_auto_drive_state(request.auto_drive.clone(), &workspace_context);
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
    let validation_lanes = build_validation_lanes(&workspace_context);
    let missing_context = build_missing_context(objective.as_deref(), &request);
    let required_capabilities = request.required_capabilities.clone().unwrap_or_default();
    let allow_network_analysis = auto_drive
        .as_ref()
        .and_then(|entry| entry.risk_policy.as_ref())
        .and_then(|policy| policy.allow_network_analysis)
        .unwrap_or(false);
    let plan = build_prepare_plan(
        objective.as_deref(),
        missing_context.as_slice(),
        &execution_graph,
        validation_lanes.as_slice(),
        required_capabilities.as_slice(),
        allow_network_analysis,
        execution_mode,
        explicit_preferred_backend_ids.as_slice(),
    );
    let autonomy_request =
        resolve_autonomy_request_value(request.autonomy_request.as_ref(), auto_drive.as_ref());
    let wake_policy = autonomy_request
        .get("wakePolicy")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let intent_snapshot = build_intent_snapshot(
        objective.as_deref(),
        task_source.as_ref(),
        &workspace_context,
        missing_context.as_slice(),
    );
    let opportunity_queue = build_opportunity_queue(
        objective.as_deref(),
        &validation_plan,
        missing_context.as_slice(),
    );
    let research_trace =
        build_research_trace(&autonomy_request, task_source.as_ref(), &workspace_context);
    let execution_eligibility =
        build_execution_eligibility(missing_context.as_slice(), approval_batches.as_slice());
    let preferred_backend_ids = if !explicit_preferred_backend_ids.is_empty() {
        explicit_preferred_backend_ids.clone()
    } else {
        repository_defaults.preferred_backend_ids.clone()
    };
    let delegation_plan = build_delegation_plan(
        &execution_graph,
        approval_batches.as_slice(),
        preferred_backend_ids.as_slice(),
        missing_context.as_slice(),
    );
    let auxiliary_execution_policy = build_auxiliary_execution_policy(allow_network_analysis);
    let resolved_execution_profile_id = explicit_launch_input
        .execution_profile_id
        .as_deref()
        .or(repository_defaults.execution_profile_id.as_deref());
    let resolved_review_profile_id = explicit_launch_input
        .review_profile_id
        .as_deref()
        .or(repository_defaults.review_profile_id.as_deref());
    let resolved_validation_preset_id = explicit_launch_input
        .validation_preset_id
        .as_deref()
        .or(repository_defaults.validation_preset_id.as_deref());

    let context_working_set = build_context_working_set(
        &workspace_context,
        task_source.as_ref(),
        access_mode.as_str(),
        execution_mode,
        explicit_preferred_backend_ids.as_slice(),
        synthesized_steps.as_slice(),
    );
    let context_truth = build_context_truth(task_source.as_ref(), &repository_defaults);
    let context_plane =
        build_context_plane(task_source.as_ref(), &repository_defaults, &context_working_set);
    let triage_summary = build_triage_summary(task_source.as_ref(), &repository_defaults);
    let accountability = context_truth
        .get("ownerSummary")
        .and_then(Value::as_str)
        .unwrap_or("Human owner stays accountable; the runtime agent executes the delegated work.");
    let tooling_plane = build_tooling_plane(
        resolved_execution_profile_id,
        resolved_review_profile_id,
        resolved_validation_preset_id,
        access_mode.as_str(),
        preferred_backend_ids.as_slice(),
        request.provider.as_deref(),
        allow_network_analysis,
        &repository_defaults,
    );
    let eval_plane = build_eval_plane(
        task_source.as_ref(),
        resolved_execution_profile_id,
        resolved_review_profile_id,
        resolved_validation_preset_id,
    );

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
            "executionProfileId": resolved_execution_profile_id,
            "reviewProfileId": resolved_review_profile_id,
            "validationPresetId": resolved_validation_preset_id,
            "preferredBackendIds": preferred_backend_ids.clone(),
            "requiredCapabilities": required_capabilities,
            "riskLevel": mission_brief
                .as_ref()
                .and_then(|brief| brief.risk_level.clone())
                .unwrap_or_else(|| if access_mode == "full-access" { "high".to_string() } else if execution_mode == "distributed" { "medium".to_string() } else { "low".to_string() }),
            "clarified": missing_context.is_empty(),
            "missingContext": missing_context,
        },
        "contextWorkingSet": context_working_set,
        "contextTruth": context_truth,
        "contextPlane": context_plane,
        "evalPlane": eval_plane,
        "guidanceStack": build_guidance_stack(
            &workspace_context,
            task_source.as_ref(),
            &repository_defaults,
            missing_context.as_slice(),
            objective.is_some(),
        ),
        "triageSummary": triage_summary,
        "delegationContract": build_delegation_contract(
            &triage_summary,
            accountability,
            missing_context.as_slice(),
            approval_batches.as_slice(),
        ),
        "delegationPlan": delegation_plan,
        "executionGraph": execution_graph,
        "toolingPlane": tooling_plane,
        "approvalBatches": approval_batches,
        "validationPlan": validation_plan,
        "reviewFocus": [
            "Prefer runtime-published evidence over transcript-only conclusions.",
            "Run the narrowest validation that proves the change under current workspace rules.",
            "Keep blast radius low and preserve backend routing inspectability."
        ],
        "plan": plan,
        "autonomyProfile": autonomy_request
            .get("autonomyProfile")
            .cloned()
            .unwrap_or_else(|| Value::String("night_operator".to_string())),
        "wakePolicy": wake_policy.clone(),
        "intentSnapshot": intent_snapshot,
        "opportunityQueue": opportunity_queue,
        "researchTrace": research_trace,
        "executionEligibility": execution_eligibility,
        "wakePolicySummary": build_wake_policy_summary(&wake_policy),
        "auxiliaryExecutionPolicy": auxiliary_execution_policy,
    }))
}

async fn build_run_record_v2(ctx: &AppContext, run_id: &str) -> Result<Value, RpcError> {
    let mut run = handle_agent_task_status(ctx, &json!({ "taskId": run_id })).await?;
    if let Some(run_object) = run.as_object_mut() {
        for redundant_field in [
            "approvalState", "compactionSummary", "contextBoundary", "contextProjection", "continuation",
            "executionGraph", "intervention", "missionLinkage", "nextAction", "nextOperatorAction",
            "operatorState", "placement", "profileReadiness", "reviewActionability", "reviewPackSummary",
            "routing", "runSummary",
            "sessionBoundary", "takeoverBundle",
        ] {
            run_object.remove(redundant_field);
        }
    }
    let mission_run = build_mission_run_projection_by_run_id(ctx, run_id)
        .await
        .ok_or_else(|| RpcError::invalid_params(format!("Run `{run_id}` was not found.")))?;
    let review_pack = build_review_pack_projection_by_run_id(ctx, run_id).await;
    let mut mission_run_value = serde_json::to_value(&mission_run).map_err(|error| RpcError::internal(format!("failed to serialize mission run: {error}")))?;
    let mut review_pack_value = review_pack.as_ref().map(serde_json::to_value).transpose().map_err(|error| RpcError::internal(format!("failed to serialize review pack: {error}")))?;
    inject_runtime_execution_summaries(&mut mission_run_value, &mission_run, &mut review_pack_value, review_pack.as_ref());
    let selected_opportunity_id = mission_run_value
        .get("selectedOpportunityId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            review_pack_value
                .as_ref()
                .and_then(|entry| entry.get("selectedOpportunityId"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        });
    let wake_reason = mission_run_value
        .get("wakeReason")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            review_pack_value
                .as_ref()
                .and_then(|entry| entry.get("wakeReason"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        });
    let wake_policy = json!({
        "mode": "auto_queue",
        "safeFollowUp": true,
        "allowAutomaticContinuation": true,
        "allowedActions": ["continue", "approve", "clarify", "reroute", "pair", "hold"],
        "stopGates": [
            "destructive_change_requires_review",
            "dependency_change_requires_review",
            "validation_failure_requires_review",
        ],
    });
    let source_citations = mission_run_value
        .get("sourceCitations")
        .and_then(Value::as_array)
        .cloned()
        .or_else(|| {
            review_pack_value
                .as_ref()
                .and_then(|entry| entry.get("sourceCitations"))
                .and_then(Value::as_array)
                .cloned()
        })
        .unwrap_or_default();
    let wake_state = mission_run_value.get("wakeState").and_then(Value::as_str).unwrap_or("attention");
    let next_eligible_action = mission_run_value.get("nextEligibleAction").and_then(Value::as_str).unwrap_or("hold");
    Ok(json!({
        "run": run,
        "missionRun": mission_run_value,
        "reviewPack": review_pack_value,
        "autonomyProfile": "night_operator",
        "wakePolicy": wake_policy,
        "intentSnapshot": {
            "summary": "Runtime preserved the current mission intent for bounded unattended continuation.",
            "primaryGoal": mission_run_value.get("title").cloned().unwrap_or(Value::Null),
            "dominantDirection": mission_run_value.get("summary").cloned().unwrap_or(Value::Null),
            "confidence": if wake_reason.is_some() { "medium" } else { "high" },
            "signals": [],
        },
        "opportunityQueue": {
            "selectedOpportunityId": selected_opportunity_id,
            "selectionSummary": "Runtime kept the active opportunity aligned with the current mission run.",
            "candidates": [],
        },
        "researchTrace": {
            "mode": "repository_only",
            "stage": "repository",
            "summary": "Mission-control snapshot currently preserves runtime and repo citations for wake-up context.",
            "citations": source_citations,
            "sensitiveContextMixed": false,
        },
        "executionEligibility": {
            "eligible": wake_state != "blocked",
            "summary": if wake_state == "blocked" {
                "Runtime reached a wake gate and should not continue unattended."
            } else {
                "Runtime can continue within the current bounded opportunity."
            },
            "wakeState": wake_state,
            "nextEligibleAction": next_eligible_action,
            "blockingReasons": wake_reason
                .as_ref()
                .map(|entry| vec![entry.clone()])
                .unwrap_or_default(),
        },
        "wakeReason": wake_reason,
        "selectedOpportunityId": selected_opportunity_id,
    }))
}

fn build_run_record_v2_from_start_payload(
    start_payload: &Value,
    prepare_payload: &Value,
) -> Result<Value, RpcError> {
    let mut run = start_payload.clone();
    let run_object = run
        .as_object_mut()
        .ok_or_else(|| RpcError::internal("runtime run start payload must be an object."))?;
    let mission_run = run_object
        .get("runSummary")
        .cloned()
        .ok_or_else(|| RpcError::internal("runtime run start payload missing runSummary"))?;
    let review_pack = run_object.get("reviewPackSummary").cloned().unwrap_or(Value::Null);
    run_object.remove("runSummary");
    run_object.remove("reviewPackSummary");

    Ok(json!({
        "run": run,
        "missionRun": mission_run,
        "reviewPack": review_pack,
        "autonomyProfile": prepare_payload.get("autonomyProfile").cloned().unwrap_or(Value::Null),
        "wakePolicy": prepare_payload.get("wakePolicy").cloned().unwrap_or(Value::Null),
        "intentSnapshot": prepare_payload.get("intentSnapshot").cloned().unwrap_or(Value::Null),
        "opportunityQueue": prepare_payload.get("opportunityQueue").cloned().unwrap_or(Value::Null),
        "researchTrace": prepare_payload.get("researchTrace").cloned().unwrap_or(Value::Null),
        "executionEligibility": prepare_payload.get("executionEligibility").cloned().unwrap_or(Value::Null),
        "wakeReason": mission_run.get("wakeReason").cloned().unwrap_or(Value::Null),
        "selectedOpportunityId": mission_run
            .get("selectedOpportunityId")
            .cloned()
            .unwrap_or(Value::Null),
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
    let request = parse_agent_task_start_request(params)?;
    let approved_plan_version = trim_optional_string(request.approved_plan_version.clone())
        .ok_or_else(|| {
            RpcError::invalid_params("approvedPlanVersion is required for runtime run start v2.")
        })?;
    let prepare = build_prepare_response(ctx, params).await?;
    let expected_plan_version = prepare
        .get("plan")
        .and_then(Value::as_object)
        .and_then(|plan| plan.get("planVersion"))
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::internal("runtime run prepare v2 did not publish planVersion"))?;
    if approved_plan_version != expected_plan_version {
        return Err(RpcError::invalid_params(format!(
            "approvedPlanVersion `{approved_plan_version}` does not match runtime plan `{expected_plan_version}`."
        )));
    }
    let start = handle_agent_task_start(ctx, params).await?;
    let run_id = start
        .get("taskId")
        .or_else(|| start.get("runId"))
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::internal("runtime run start v2 missing taskId"))?;
    if normalize_execution_mode_v2(request.execution_mode.as_deref())? == "distributed" {
        materialize_parallel_safe_sub_agent_lanes(ctx, run_id, &request, &prepare).await;
    }
    build_run_record_v2_from_start_payload(&start, &prepare)
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
    let mission_run = build_mission_run_projection_by_run_id(ctx, run_id.as_str()).await;
    let Some(review_pack) = build_review_pack_projection_by_run_id(ctx, run_id.as_str()).await else {
        return Ok(Value::Null);
    };
    serialize_review_pack_with_runtime_summaries(&review_pack, mission_run.as_ref())
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

    fn sample_step(
        kind: AgentStepKind,
        input: &str,
        requires_approval: Option<bool>,
    ) -> AgentTaskStepInput {
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
            approved_plan_version: None,
            mission_brief: None,
            relaunch_context: None,
            auto_drive: None,
            autonomy_request: None,
            steps: vec![sample_step(
                AgentStepKind::Read,
                "Inspect the runtime boundary",
                Some(false),
            )],
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

    #[test]
    fn build_context_working_set_surfaces_multi_source_repo_guidance() {
        let working_set = build_context_working_set(
            &WorkspaceLaunchContext {
                workspace_root_path: Some("/repo".to_string()),
                repo_instruction_sources: vec![
                    "AGENTS.md".to_string(),
                    ".github/copilot-instructions.md".to_string(),
                    ".github/instructions/runtime.instructions.md".to_string(),
                ],
                ..WorkspaceLaunchContext::default()
            },
            None,
            "on-request",
            "single",
            &[],
            &[],
        );

        let repo_entry = working_set["layers"][0]["entries"]
            .as_array()
            .and_then(|entries| {
                entries
                    .iter()
                    .find(|entry| entry["id"] == "repo-instruction-surfaces")
            })
            .expect("repo instruction entry");
        assert_eq!(repo_entry["source"], json!("repo_guidance"));
        assert!(
            repo_entry["detail"]
                .as_str()
                .is_some_and(|detail| detail.contains(".github/copilot-instructions.md"))
        );
    }

    #[test]
    fn build_guidance_stack_prioritizes_explicit_launch_and_review_profile_skills() {
        let guidance = build_guidance_stack(
            &WorkspaceLaunchContext {
                has_agents_md: true,
                repo_instruction_sources: vec![
                    "AGENTS.md".to_string(),
                    ".github/copilot-instructions.md".to_string(),
                ],
                ..WorkspaceLaunchContext::default()
            },
            Some(&AgentTaskSourceSummary {
                kind: "github_issue".to_string(),
                label: None,
                short_label: None,
                title: Some("Fix governed execution guidance".to_string()),
                reference: None,
                url: None,
                issue_number: Some(94),
                pull_request_number: None,
                repo: None,
                workspace_id: Some("ws-1".to_string()),
                workspace_root: None,
                external_id: None,
                canonical_url: None,
                thread_id: None,
                request_id: None,
                source_task_id: None, source_run_id: None, github_source: None,
            }),
            &RepositoryExecutionResolvedDefaults {
                source_mapping_kind: Some("github_issue".to_string()),
                review_profile_id: Some("issue-review".to_string()),
                repo_instructions: vec!["Prefer repo-owned context truth.".to_string()],
                repo_skill_ids: vec!["repo-baseline".to_string()],
                source_instructions: vec!["Treat GitHub issues as governed triage intake.".to_string()],
                source_skill_ids: vec!["issue-triage".to_string()],
                review_profile: Some(
                    crate::repository_execution_contract::RepositoryExecutionResolvedReviewProfile {
                        id: "issue-review".to_string(),
                        label: "Issue Review".to_string(),
                        allowed_skill_ids: vec!["review-agent".to_string(), "repo-policy-check".to_string()],
                    }
                ),
                ..RepositoryExecutionResolvedDefaults::default()
            },
            &[],
            true,
        );

        assert_eq!(
            guidance["precedence"],
            json!([
                "launch",
                "review_profile",
                "source",
                "review_profile",
                "repo"
            ])
        );
        assert_eq!(
            guidance["layers"]
                .as_array()
                .and_then(|layers| layers
                    .iter()
                    .find(|layer| layer["id"] == "review-profile-skills"))
                .and_then(|layer| layer.get("skillIds")),
            Some(&json!(["review-agent", "repo-policy-check"]))
        );
        assert_eq!(
            guidance["layers"]
                .as_array()
                .and_then(|layers| layers.iter().find(|layer| layer["id"] == "launch-guidance"))
                .and_then(|layer| layer.get("source")),
            Some(&json!("launch_instruction"))
        );
        assert_eq!(
            guidance["layers"]
                .as_array()
                .and_then(|layers| layers
                    .iter()
                    .find(|layer| layer["id"] == "repo-instructions"))
                .and_then(|layer| layer.get("source")),
            Some(&json!("repo_guidance"))
        );
    }

}
