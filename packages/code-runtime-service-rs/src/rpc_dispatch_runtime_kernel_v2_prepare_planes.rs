use super::*;

fn infer_tool_posture(access_mode: &str) -> &'static str {
    match access_mode {
        "read-only" => "read_only",
        "full-access" => "workspace_extended",
        _ => "workspace_safe",
    }
}

fn infer_approval_sensitivity(access_mode: &str) -> &'static str {
    match access_mode {
        "full-access" => "low_friction",
        "read-only" => "heightened",
        _ => "standard",
    }
}

fn format_execution_profile_label(profile_id: &str) -> String {
    profile_id
        .split('-')
        .filter(|segment| !segment.is_empty())
        .map(|segment| {
            let mut chars = segment.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn dedupe_string_values(values: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut deduped = Vec::new();
    for value in values {
        if !deduped.iter().any(|existing| existing == &value) {
            deduped.push(value);
        }
    }
    deduped
}

pub(super) fn build_context_plane(
    task_source: Option<&AgentTaskSourceSummary>,
    repository_defaults: &RepositoryExecutionResolvedDefaults,
    context_working_set: &Value,
) -> Value {
    let repo_instruction_count = repository_defaults.repo_instructions.len();
    let mut memory_refs = Vec::new();
    let mut artifact_refs = Vec::new();

    if repo_instruction_count > 0 {
        memory_refs.push(json!({
            "id": "repo-guidance",
            "label": "Repo guidance memory",
            "kind": "repo_instruction_surface",
            "summary": format!(
                "Keep {repo_instruction_count} repo instruction entries available outside the live window."
            ),
            "storage": "workspace_manifest",
            "persistenceScope": "workspace",
            "sourceRef": ".hugecode/repository-execution-contract.json",
        }));
    }

    if let Some(source) = task_source {
        let label = source
            .label
            .clone()
            .or(source.title.clone())
            .or(source.reference.clone())
            .unwrap_or_else(|| "Task source".to_string());
        memory_refs.push(json!({
            "id": "task-source-digest",
            "label": label,
            "kind": "task_source_digest",
            "summary": "Persist the normalized task source digest across launch, review, and follow-up.",
            "storage": if source.canonical_url.is_some() { "external_reference" } else { "runtime_memory" },
            "persistenceScope": "run",
            "sourceRef": source.canonical_url.clone().or(source.reference.clone()),
        }));
        artifact_refs.push(json!({
            "id": "task-source-snapshot",
            "label": format!("{label} snapshot"),
            "kind": "task_source_snapshot",
            "summary": "Reference the source snapshot without replaying the full launch transcript.",
            "mimeType": "application/json",
            "locator": source.canonical_url,
            "sourceRef": source.reference.clone().unwrap_or_else(|| source.kind.clone()),
        }));
    }

    if let Some(review_profile_id) = repository_defaults.review_profile_id.as_ref() {
        memory_refs.push(json!({
            "id": "review-guidance",
            "label": format!("Review profile {review_profile_id}"),
            "kind": "review_guidance",
            "summary": "Preserve review guidance separately from the live prompt window.",
            "storage": "workspace_manifest",
            "persistenceScope": "workspace",
            "sourceRef": review_profile_id,
        }));
    }

    if let Some(validation_preset_id) = repository_defaults.validation_preset_id.as_ref() {
        artifact_refs.push(json!({
            "id": format!("validation-plan:{validation_preset_id}"),
            "label": format!("Validation preset {validation_preset_id}"),
            "kind": "validation_plan",
            "summary": "Carry validation defaults as a reusable artifact for launch and continuation.",
            "mimeType": "application/json",
            "sourceRef": validation_preset_id,
        }));
    }

    let selection_strategy = context_working_set
        .get("selectionPolicy")
        .and_then(|entry| entry.get("strategy"))
        .cloned()
        .unwrap_or_else(|| Value::String("balanced".to_string()));
    let tool_exposure_profile = context_working_set
        .get("selectionPolicy")
        .and_then(|entry| entry.get("toolExposureProfile"))
        .cloned()
        .unwrap_or_else(|| Value::String("slim".to_string()));
    let token_budget_target = context_working_set
        .get("selectionPolicy")
        .and_then(|entry| entry.get("tokenBudgetTarget"))
        .cloned()
        .unwrap_or_else(|| json!(1500));
    let prefer_cold_fetch = context_working_set
        .get("selectionPolicy")
        .and_then(|entry| entry.get("preferColdFetch"))
        .cloned()
        .unwrap_or_else(|| Value::Bool(true));

    json!({
        "summary": if task_source.is_some() {
            "Runtime can preserve source-linked context through stable memory and artifact references."
        } else {
            "Manual launch context stays compact by separating workspace memory from replayable artifacts."
        },
        "memoryRefs": memory_refs,
        "artifactRefs": artifact_refs,
        "compactionSummary": {
            "triggered": false,
            "executed": false,
            "source": "runtime_prepare_v2",
        },
        "workingSetPolicy": {
            "selectionStrategy": selection_strategy,
            "toolExposureProfile": tool_exposure_profile,
            "tokenBudgetTarget": token_budget_target,
            "refreshMode": "on_prepare",
            "retentionMode": if memory_refs.is_empty() { "window_only" } else { "window_and_memory" },
            "preferColdFetch": prefer_cold_fetch,
            "compactBeforeDelegation": true,
        },
    })
}

pub(super) fn build_tooling_plane(
    execution_profile_id: Option<&str>,
    review_profile_id: Option<&str>,
    validation_preset_id: Option<&str>,
    access_mode: &str,
    preferred_backend_ids: &[String],
    provider: Option<&str>,
    allow_network_analysis: bool,
    repository_defaults: &RepositoryExecutionResolvedDefaults,
) -> Value {
    let execution_profile_label = execution_profile_id
        .map(format_execution_profile_label)
        .unwrap_or_else(|| "Governed Runtime".to_string());
    let mut capabilities = vec![json!({
        "id": "workspace.read",
        "label": "Workspace read",
        "summary": "Read repository files and runtime evidence inside the selected workspace.",
        "kind": "workspace_read",
        "readiness": "ready",
        "safetyLevel": "read",
        "source": execution_profile_id,
    })];

    if access_mode != "read-only" {
        capabilities.push(json!({
            "id": "workspace.write",
            "label": "Workspace write",
            "summary": if access_mode == "on-request" {
                "Mutation is available behind operator approval."
            } else {
                "Mutation is available directly in the selected sandbox."
            },
            "kind": "workspace_write",
            "readiness": if access_mode == "on-request" { "attention" } else { "ready" },
            "safetyLevel": "write",
            "source": execution_profile_id,
        }));
    }

    capabilities.push(json!({
        "id": "runtime.tooling",
        "label": "Runtime tooling",
        "summary": "Runtime-owned tools remain available through a stable capability surface instead of prompt-specific tool hints.",
        "kind": "runtime_tool",
        "readiness": "ready",
        "safetyLevel": if access_mode == "full-access" { "write" } else { "read" },
        "source": execution_profile_id,
    }));

    capabilities.push(json!({
        "id": "network.fetch",
        "label": "Network fetch",
        "summary": if allow_network_analysis {
            "Network access follows the execution profile and runtime risk policy."
        } else {
            "Network access remains runtime-restricted unless the execution policy promotes it."
        },
        "kind": "network_fetch",
        "readiness": if allow_network_analysis { "ready" } else { "attention" },
        "safetyLevel": "read",
        "source": execution_profile_id,
    }));

    if let Some(validation_preset_id) = validation_preset_id {
        capabilities.push(json!({
            "id": format!("validation:{validation_preset_id}"),
            "label": "Validation plan",
            "summary": format!("Validation preset {validation_preset_id} is attached to the governed run."),
            "kind": "validation",
            "readiness": "ready",
            "safetyLevel": "read",
            "source": validation_preset_id,
        }));
    }

    if let Some(review_profile_id) = review_profile_id {
        capabilities.push(json!({
            "id": format!("review:{review_profile_id}"),
            "label": "Review skill lane",
            "summary": format!("Review profile {review_profile_id} remains available as a bounded review capability."),
            "kind": "review_skill",
            "readiness": "ready",
            "safetyLevel": "read",
            "source": review_profile_id,
        }));
    }

    let skill_ids = dedupe_string_values(
        repository_defaults
            .repo_skill_ids
            .iter()
            .chain(repository_defaults.source_skill_ids.iter())
            .chain(
                repository_defaults
                    .review_profile
                    .as_ref()
                    .into_iter()
                    .flat_map(|profile| profile.allowed_skill_ids.iter()),
            )
            .cloned(),
    );
    let mcp_sources = skill_ids
        .into_iter()
        .map(|skill_id| {
            json!({
                "id": skill_id,
                "label": skill_id,
                "kind": "workspace_skill",
                "authority": "workspace",
                "availability": "ready",
                "summary": "Workspace skill is available through the runtime composition layer.",
            })
        })
        .collect::<Vec<_>>();

    json!({
        "summary": "Runtime publishes a stable capability catalog and sandbox contract so model upgrades do not require product-level tool-selection workarounds.",
        "capabilityCatalog": {
            "summary": format!(
                "Execution profile {} exposes {} governed launch capabilities.",
                execution_profile_id.unwrap_or("runtime-default"),
                capabilities.len()
            ),
            "catalogId": execution_profile_id.map(|id| format!("launch:{id}")),
            "generatedAt": now_ms(),
            "capabilities": capabilities,
        },
        "sandboxRef": {
            "id": format!("sandbox:{}", execution_profile_id.unwrap_or("runtime-default")),
            "label": format!("{execution_profile_label} sandbox"),
            "summary": provider
                .map(|provider| format!("Runtime will route this launch through provider {provider}."))
                .unwrap_or_else(|| "Runtime will resolve provider placement using the selected execution profile and backend preferences.".to_string()),
            "accessMode": access_mode,
            "executionProfileId": execution_profile_id,
            "preferredBackendIds": preferred_backend_ids,
            "routedProvider": provider,
            "networkPolicy": if allow_network_analysis { "default" } else { "restricted" },
            "filesystemPolicy": if access_mode == "read-only" { "read_only" } else { "workspace_scoped" },
            "toolPosture": infer_tool_posture(access_mode),
            "approvalSensitivity": infer_approval_sensitivity(access_mode),
        },
        "mcpSources": mcp_sources,
        "toolCallRefs": [],
        "toolResultRefs": [],
    })
}

pub(super) fn build_eval_plane(
    task_source: Option<&AgentTaskSourceSummary>,
    execution_profile_id: Option<&str>,
    review_profile_id: Option<&str>,
    validation_preset_id: Option<&str>,
) -> Value {
    let execution_profile_label = execution_profile_id
        .map(format_execution_profile_label)
        .unwrap_or_else(|| "Governed Runtime".to_string());
    let task_family = task_source
        .map(|source| source.kind.as_str())
        .unwrap_or("manual");
    let mut eval_cases = vec![json!({
        "id": format!("launch:{}", execution_profile_id.unwrap_or("runtime-default")),
        "label": format!("{execution_profile_label} launch baseline"),
        "taskFamily": task_family,
        "summary": "Keep governed launch preparation stable across model upgrades and route changes.",
        "successEnvelope": "Prepare should keep task/run/review semantics stable while preserving validation and routing visibility.",
        "modelBaseline": format!("{execution_profile_label} execution profile"),
        "regressionBudget": "No regression in launch plan shape, validation attachment, or backend inspectability.",
        "source": "runtime_prepare",
        "trackedWorkarounds": [],
    })];

    if let Some(validation_preset_id) = validation_preset_id {
        eval_cases.push(json!({
            "id": format!("validation:{validation_preset_id}"),
            "label": format!("Validation preset {validation_preset_id}"),
            "taskFamily": "validation",
            "summary": "Validation defaults stay attached as durable governed evidence.",
            "successEnvelope": "Validation commands, preset identity, and review handoff remain reusable across model releases.",
            "modelBaseline": validation_preset_id,
            "regressionBudget": "No regression in validation-plan publication or attachment semantics.",
            "source": "repository_contract",
            "trackedWorkarounds": [],
        }));
    }

    if let Some(review_profile_id) = review_profile_id {
        eval_cases.push(json!({
            "id": format!("review:{review_profile_id}"),
            "label": format!("Review profile {review_profile_id}"),
            "taskFamily": "review",
            "summary": "Review evidence should remain compact and artifact-backed rather than transcript-bound.",
            "successEnvelope": "Review Pack inputs, review focus, and continuation handoff stay stable when models improve.",
            "modelBaseline": review_profile_id,
            "regressionBudget": "No regression in review artifact publication or review-actionability hints.",
            "source": "repository_contract",
            "trackedWorkarounds": [],
        }));
    }

    json!({
        "summary": "Runtime publishes upgrade-stable eval cases so model improvements delete workarounds instead of redefining product contracts.",
        "evalCases": eval_cases,
        "modelReleasePlaybook": [
            "Re-run governed eval cases before adopting a new default model or route.",
            "Delete model-specific prompt or orchestration workarounds that the new baseline makes unnecessary.",
            "Only widen product behavior after the eval plane shows stable launch, validation, and review evidence.",
        ],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_context_plane_publishes_memory_and_artifact_refs() {
        let working_set = build_context_working_set(
            &WorkspaceLaunchContext {
                workspace_root_path: Some("/repo".to_string()),
                repo_instruction_sources: vec!["AGENTS.md".to_string()],
                ..WorkspaceLaunchContext::default()
            },
            None,
            "on-request",
            "single",
            &[],
            &[],
        );
        let context_plane = build_context_plane(
            Some(&AgentTaskSourceSummary {
                kind: "github_issue".to_string(),
                label: Some("GitHub issue #42".to_string()),
                short_label: Some("Issue #42".to_string()),
                title: Some("Stabilize runtime context plane".to_string()),
                reference: Some("#42".to_string()),
                url: None,
                issue_number: Some(42),
                pull_request_number: None,
                repo: None,
                workspace_id: Some("ws-1".to_string()),
                workspace_root: None,
                external_id: None,
                canonical_url: Some("https://github.com/acme/hugecode/issues/42".to_string()),
                thread_id: None,
                request_id: None,
                source_task_id: None,
                source_run_id: None,
                github_source: None,
            }),
            &RepositoryExecutionResolvedDefaults {
                review_profile_id: Some("issue-review".to_string()),
                validation_preset_id: Some("review-first".to_string()),
                repo_instructions: vec!["Prefer runtime-owned context truth.".to_string()],
                ..RepositoryExecutionResolvedDefaults::default()
            },
            &working_set,
        );

        assert_eq!(context_plane["memoryRefs"].as_array().map(Vec::len), Some(3));
        assert_eq!(
            context_plane["artifactRefs"].as_array().map(Vec::len),
            Some(2)
        );
        assert_eq!(
            context_plane["workingSetPolicy"]["retentionMode"],
            json!("window_and_memory")
        );
    }

    #[test]
    fn build_context_working_set_adds_selection_policy_and_fingerprints() {
        let context = WorkspaceLaunchContext {
            workspace_root_path: Some("/workspaces/HugeCode".to_string()),
            has_agents_md: true,
            repo_instruction_sources: vec!["AGENTS.md".to_string()],
            validate_command: Some("pnpm validate".to_string()),
            ..WorkspaceLaunchContext::default()
        };
        let working_set = build_context_working_set(
            &context,
            None,
            "on-request",
            "distributed",
            &["backend-a".to_string(), "backend-b".to_string()],
            &[AgentTaskStepInput {
                kind: AgentStepKind::Read,
                path: None,
                paths: None,
                input: Some("Context digest: runtime recovered prior work.".to_string()),
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                timeout_ms: None,
                max_items: None,
                requires_approval: Some(false),
                approval_reason: None,
            }],
        );

        assert_eq!(working_set["selectionPolicy"]["strategy"], json!("deep"));
        assert_eq!(working_set["selectionPolicy"]["toolExposureProfile"], json!("slim"));
        assert_eq!(working_set["selectionPolicy"]["preferColdFetch"], json!(false));
        assert!(working_set["contextFingerprint"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(working_set["stablePrefixFingerprint"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
    }

    #[test]
    fn build_tooling_plane_publishes_capabilities_and_workspace_skills() {
        let tooling_plane = build_tooling_plane(
            Some("balanced-delegate"),
            Some("issue-review"),
            Some("review-first"),
            "on-request",
            &["backend-a".to_string(), "backend-b".to_string()],
            Some("anthropic"),
            false,
            &RepositoryExecutionResolvedDefaults {
                repo_skill_ids: vec!["repo-baseline".to_string()],
                source_skill_ids: vec!["issue-triage".to_string()],
                review_profile: Some(
                    crate::repository_execution_contract::RepositoryExecutionResolvedReviewProfile {
                        id: "issue-review".to_string(),
                        label: "Issue Review".to_string(),
                        allowed_skill_ids: vec![
                            "review-agent".to_string(),
                            "repo-baseline".to_string(),
                        ],
                    },
                ),
                ..RepositoryExecutionResolvedDefaults::default()
            },
        );

        assert_eq!(
            tooling_plane["capabilityCatalog"]["capabilities"]
                .as_array()
                .map(Vec::len),
            Some(6)
        );
        assert_eq!(tooling_plane["sandboxRef"]["toolPosture"], json!("workspace_safe"));
        assert_eq!(
            tooling_plane["sandboxRef"]["approvalSensitivity"],
            json!("standard")
        );
        assert_eq!(tooling_plane["mcpSources"].as_array().map(Vec::len), Some(3));
    }

    #[test]
    fn build_eval_plane_publishes_upgrade_stable_cases() {
        let eval_plane = build_eval_plane(
            Some(&AgentTaskSourceSummary {
                kind: "github_issue".to_string(),
                label: Some("GitHub issue #42".to_string()),
                short_label: Some("Issue #42".to_string()),
                title: Some("Protect long-term interfaces".to_string()),
                reference: Some("#42".to_string()),
                url: None,
                issue_number: Some(42),
                pull_request_number: None,
                repo: None,
                workspace_id: Some("ws-1".to_string()),
                workspace_root: None,
                external_id: None,
                canonical_url: Some("https://github.com/acme/hugecode/issues/42".to_string()),
                thread_id: None,
                request_id: None,
                source_task_id: None,
                source_run_id: None,
                github_source: None,
            }),
            Some("balanced-delegate"),
            Some("issue-review"),
            Some("review-first"),
        );

        assert_eq!(eval_plane["evalCases"].as_array().map(Vec::len), Some(3));
        assert_eq!(
            eval_plane["evalCases"][0]["modelBaseline"],
            json!("Balanced Delegate execution profile")
        );
        assert_eq!(
            eval_plane["modelReleasePlaybook"].as_array().map(Vec::len),
            Some(3)
        );
    }
}
