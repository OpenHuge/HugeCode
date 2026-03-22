use super::{
    assistant_message_indicates_local_access_refusal, build_provider_runtime_final_results_json,
    build_provider_runtime_plan_delta, build_provider_runtime_plan_review_body,
    compact_provider_runtime_step_output, enforce_provider_runtime_plan_step_constraints,
    execution_graph::{
        build_provider_runtime_execution_waves, schedule_provider_runtime_plan_steps,
    },
    extract_first_code_block_with_languages, is_recoverable_provider_runtime_step_failure,
    normalize_provider_runtime_final_response, parse_provider_runtime_plan_response,
    parse_provider_runtime_plan_tool_arguments, provider_runtime_results_have_blocking_failure,
    search_helpers::{
        build_sanitized_workspace_search_command_for_backend, preferred_workspace_search_backend,
        runtime_rg_available, WorkspaceSearchBackend,
    },
    should_stop_after_provider_runtime_step, should_use_provider_runtime_plan_flow,
    ProviderRuntimePlanResponse, ProviderRuntimeStep, ProviderRuntimeStepResult,
};
use crate::{AgentStepKind, RuntimeProvider, TurnProviderRoute};
use ku0_runtime_shell_core::{resolve_shell_from_env, ShellFamily};
use serde_json::{json, Value};

fn assert_has_search_output_limit(command: &str) {
    assert!(
        command.contains("| head -n 200") || command.contains("| Select-Object -First 200"),
        "expected search output limit in command: {command}"
    );
}

fn runtime_search_backend_for_tests() -> (ShellFamily, WorkspaceSearchBackend) {
    let shell_family = resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL").family;
    let backend = preferred_workspace_search_backend(shell_family, runtime_rg_available());
    (shell_family, backend)
}

fn assert_sanitized_workspace_search_command_matches_runtime(command: &str) {
    let (shell_family, backend) = runtime_search_backend_for_tests();
    match backend {
        WorkspaceSearchBackend::Rg => {
            assert!(command.starts_with("rg -n -S --hidden"));
            assert!(command.contains("!**/node_modules/**"));
            assert!(command.contains("!**/.git/**"));
        }
        WorkspaceSearchBackend::NativeFallback => match shell_family {
            ShellFamily::PowerShell => {
                assert!(command.starts_with("Get-ChildItem -Path src, apps, packages, ."));
                assert!(command.contains("Select-String -Pattern"));
                assert!(command.contains("node_modules|dist|\\.git|coverage|target|\\.turbo|build"));
            }
            ShellFamily::Cmd => {
                assert!(command.starts_with("powershell -NoLogo -NoProfile -Command"));
                assert!(command.contains("Select-String -Pattern"));
                assert!(command.contains("node_modules|dist|\\.git|coverage|target|\\.turbo|build"));
            }
            ShellFamily::Posix => {
                assert!(command.starts_with("grep -RInE --binary-files=without-match"));
                assert!(command.contains("--exclude-dir=node_modules"));
                assert!(command.contains("--exclude-dir=.git"));
            }
        },
    }
    assert_has_search_output_limit(command);
}

#[test]
fn refusal_detection_matches_common_messages() {
    assert!(assistant_message_indicates_local_access_refusal(
        "I cannot directly access your local computer."
    ));
    assert!(assistant_message_indicates_local_access_refusal(
        "我无法直接访问你当前机器的文件系统。"
    ));
    assert!(!assistant_message_indicates_local_access_refusal(
        "I created the file and verified it."
    ));
}

#[test]
fn parse_provider_runtime_plan_response_accepts_json_fence() {
    let message = "```json\n{\"plan\":[\"read\"],\"steps\":[{\"kind\":\"read\",\"path\":\"README.md\"}]}\n```";
    let parsed =
        parse_provider_runtime_plan_response(message).expect("provider runtime plan parse");
    assert_eq!(parsed.plan, vec!["read".to_string()]);
    assert_eq!(parsed.steps.len(), 1);
    assert_eq!(parsed.steps[0].kind, AgentStepKind::Read);
    assert_eq!(parsed.steps[0].path.as_deref(), Some("README.md"));
}

#[test]
fn parse_provider_runtime_plan_tool_arguments_accepts_json_payload() {
    let parsed = parse_provider_runtime_plan_tool_arguments(
        "{\"plan\":[\"read\"],\"steps\":[{\"kind\":\"read\",\"path\":\"README.md\"}],\"finalMessage\":\"\"}",
    )
    .expect("runtime plan tool arguments");
    assert_eq!(parsed.steps.len(), 1);
    assert_eq!(parsed.steps[0].kind, AgentStepKind::Read);
    assert_eq!(parsed.steps[0].path.as_deref(), Some("README.md"));
}

#[test]
fn parse_provider_runtime_plan_tool_arguments_accepts_dependency_metadata() {
    let parsed = parse_provider_runtime_plan_tool_arguments(
        "{\"plan\":[\"inspect\",\"edit\"],\"steps\":[{\"kind\":\"read\",\"taskKey\":\"inspect-readme\",\"dependsOn\":[],\"path\":\"README.md\"},{\"kind\":\"edit\",\"taskKey\":\"patch-readme\",\"dependsOn\":[\"inspect-readme\"],\"path\":\"README.md\",\"find\":\"old\",\"replace\":\"new\",\"requiresApproval\":true}],\"finalMessage\":\"\"}",
    )
    .expect("runtime plan tool arguments with dependency metadata");
    assert_eq!(parsed.steps.len(), 2);
    assert_eq!(parsed.steps[0].task_key.as_deref(), Some("inspect-readme"));
    assert!(parsed.steps[0].depends_on.is_empty());
    assert_eq!(parsed.steps[1].task_key.as_deref(), Some("patch-readme"));
    assert_eq!(
        parsed.steps[1].depends_on,
        vec!["inspect-readme".to_string()]
    );
    assert_eq!(parsed.steps[1].requires_approval, Some(true));
}

#[test]
fn extract_first_code_block_with_languages_filters_language() {
    let message = "```bash\necho hi\n```\n```json\n{\"ok\":true}\n```";
    let extracted =
        extract_first_code_block_with_languages(message, &["json"]).expect("json code block");
    assert_eq!(extracted, "{\"ok\":true}");
}

#[test]
fn runtime_plan_flow_accepts_danger_full_access_alias() {
    assert!(should_use_provider_runtime_plan_flow(
        "danger-full-access",
        false,
        &TurnProviderRoute::Core(RuntimeProvider::OpenAI)
    ));
    assert!(should_use_provider_runtime_plan_flow(
        "DANGER_FULL_ACCESS",
        false,
        &TurnProviderRoute::Core(RuntimeProvider::OpenAI)
    ));
}

#[test]
fn runtime_plan_flow_remains_scoped_to_openai_full_access_without_local_exec() {
    assert!(!should_use_provider_runtime_plan_flow(
        "on-request",
        false,
        &TurnProviderRoute::Core(RuntimeProvider::OpenAI)
    ));
    assert!(!should_use_provider_runtime_plan_flow(
        "full-access",
        true,
        &TurnProviderRoute::Core(RuntimeProvider::OpenAI)
    ));
    assert!(!should_use_provider_runtime_plan_flow(
        "full-access",
        false,
        &TurnProviderRoute::Core(RuntimeProvider::Anthropic)
    ));
}

#[test]
fn schedule_provider_runtime_plan_steps_parallelizes_read_roots_and_barriers_mutations() {
    let scheduled = schedule_provider_runtime_plan_steps(&[
        ProviderRuntimeStep {
            kind: AgentStepKind::Read,
            input: None,
            path: Some("README.md".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: Some("inspect-readme".to_string()),
            depends_on: vec![],
            requires_approval: None,
        },
        ProviderRuntimeStep {
            kind: AgentStepKind::Diagnostics,
            input: None,
            path: None,
            paths: Some(vec!["apps/code/src".to_string()]),
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: Some(vec!["error".to_string()]),
            max_items: Some(25),
            timeout_ms: None,
            task_key: Some("inspect-diag".to_string()),
            depends_on: vec![],
            requires_approval: None,
        },
        ProviderRuntimeStep {
            kind: AgentStepKind::Edit,
            input: None,
            path: Some("README.md".to_string()),
            paths: None,
            content: None,
            find: Some("old".to_string()),
            replace: Some("new".to_string()),
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: Some("apply-edit".to_string()),
            depends_on: vec![],
            requires_approval: Some(true),
        },
        ProviderRuntimeStep {
            kind: AgentStepKind::Diagnostics,
            input: None,
            path: None,
            paths: Some(vec!["README.md".to_string()]),
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: Some(vec!["warning".to_string()]),
            max_items: Some(10),
            timeout_ms: None,
            task_key: Some("post-check".to_string()),
            depends_on: vec![],
            requires_approval: None,
        },
    ]);

    assert_eq!(scheduled[0].depends_on, Vec::<String>::new());
    assert_eq!(scheduled[1].depends_on, Vec::<String>::new());
    assert_eq!(
        scheduled[2].depends_on,
        vec!["inspect-readme".to_string(), "inspect-diag".to_string()]
    );
    assert_eq!(scheduled[3].depends_on, vec!["apply-edit".to_string()]);
}

#[test]
fn build_provider_runtime_execution_waves_groups_parallel_safe_steps_by_dependency_wave() {
    let waves = build_provider_runtime_execution_waves(&[
        ProviderRuntimeStep {
            kind: AgentStepKind::Read,
            input: None,
            path: Some("README.md".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: Some("inspect-readme".to_string()),
            depends_on: vec![],
            requires_approval: None,
        },
        ProviderRuntimeStep {
            kind: AgentStepKind::Read,
            input: None,
            path: Some("package.json".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: Some("inspect-package".to_string()),
            depends_on: vec![],
            requires_approval: None,
        },
        ProviderRuntimeStep {
            kind: AgentStepKind::Edit,
            input: None,
            path: Some("README.md".to_string()),
            paths: None,
            content: None,
            find: Some("old".to_string()),
            replace: Some("new".to_string()),
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: Some("apply-edit".to_string()),
            depends_on: vec!["inspect-readme".to_string()],
            requires_approval: Some(true),
        },
        ProviderRuntimeStep {
            kind: AgentStepKind::Diagnostics,
            input: None,
            path: None,
            paths: Some(vec!["README.md".to_string()]),
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: Some(vec!["warning".to_string()]),
            max_items: Some(10),
            timeout_ms: None,
            task_key: Some("post-check".to_string()),
            depends_on: vec![],
            requires_approval: None,
        },
    ]);

    assert_eq!(waves.len(), 3);
    assert_eq!(
        waves[0]
            .iter()
            .map(|step| step.task_key.as_str())
            .collect::<Vec<_>>(),
        vec!["inspect-readme", "inspect-package"]
    );
    assert_eq!(
        waves[1]
            .iter()
            .map(|step| step.task_key.as_str())
            .collect::<Vec<_>>(),
        vec!["apply-edit"]
    );
    assert_eq!(
        waves[2]
            .iter()
            .map(|step| step.task_key.as_str())
            .collect::<Vec<_>>(),
        vec!["post-check"]
    );
}

#[test]
fn runtime_plan_constraints_filter_bash_steps_for_sub_agent_requests() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["do stuff".to_string()],
        steps: vec![
            ProviderRuntimeStep {
                kind: AgentStepKind::Bash,
                input: None,
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: Some("echo blocked".to_string()),
                severities: None,
                max_items: None,
                timeout_ms: Some(1_000),
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("README.md".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
        ],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints("please use sub agents", plan);
    assert_eq!(filtered.steps.len(), 1);
    assert_eq!(filtered.steps[0].kind, AgentStepKind::Read);
    assert!(filtered.final_message.is_none());
}

#[test]
fn runtime_plan_constraints_add_final_message_when_all_steps_are_filtered() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["bash only".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some("echo blocked".to_string()),
            severities: None,
            max_items: None,
            timeout_ms: Some(1_000),
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints("请启用 sub agents", plan);
    assert!(filtered.steps.is_empty());
    assert!(filtered
        .final_message
        .as_deref()
        .is_some_and(|entry| entry.contains("Sub-agent orchestration was requested")));
}

#[test]
fn runtime_plan_constraints_replace_browser_repo_fallback_with_status_probe() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["inspect current page".to_string()],
        steps: vec![
            ProviderRuntimeStep {
                kind: AgentStepKind::Bash,
                input: None,
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: Some("rg -n \"header\" src .".to_string()),
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("src/App.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
        ],
        final_message: Some("Guessed from source.".to_string()),
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Use browser debugging tools to inspect the current page and report the header height.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 1);
    assert_eq!(filtered.steps[0].kind, AgentStepKind::JsRepl);
    assert!(filtered.steps[0]
        .input
        .as_deref()
        .is_some_and(|input| input.contains("get-runtime-browser-debug-status")));
    assert_eq!(filtered.steps[0].timeout_ms, Some(30_000));
    assert!(filtered.final_message.is_none());
}

#[test]
fn runtime_plan_constraints_replace_browser_js_repl_with_guarded_execution_step() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["inspect current page".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::JsRepl,
            input: Some(
                "const status = await codex.tool('get-runtime-browser-debug-status', {});\
                 console.log(status.output ?? JSON.stringify(status, null, 2));"
                    .to_string(),
            ),
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: Some(15_000),
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Use browser debugging tools to inspect the current page and report the header height.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 1);
    assert_eq!(filtered.steps[0].kind, AgentStepKind::JsRepl);
    assert!(filtered.steps[0]
        .input
        .as_deref()
        .is_some_and(|input| input.contains("inspect-runtime-browser")));
    assert_eq!(filtered.steps[0].timeout_ms, Some(30_000));
}

#[test]
fn runtime_plan_constraints_keep_repo_fallback_for_mixed_browser_requests() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["inspect current page then trace source".to_string()],
        steps: vec![
            ProviderRuntimeStep {
                kind: AgentStepKind::JsRepl,
                input: Some(
                    "await codex.tool('inspect-runtime-browser', { prompt: 'inspect' });"
                        .to_string(),
                ),
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: Some(15_000),
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Bash,
                input: None,
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: Some(
                    "rg -n \"timeline UI|tool timeline|recent thread\" src apps packages ."
                        .to_string(),
                ),
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("apps/code/src/features/messages/components/Messages.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
        ],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Use browser debugging tools to inspect the current page. If browser debug is unavailable, then search this workspace for where the recent thread/tool timeline UI is rendered and name the actual component or file.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 2);
    assert_eq!(filtered.steps[0].kind, AgentStepKind::JsRepl);
    assert_eq!(filtered.steps[0].timeout_ms, Some(30_000));
    assert_eq!(filtered.steps[1].kind, AgentStepKind::Bash);
}

#[test]
fn runtime_plan_constraints_synthesize_repo_search_for_mixed_browser_requests_without_fallback_steps(
) {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["inspect current page then trace source".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::JsRepl,
            input: Some(
                "await codex.tool('inspect-runtime-browser', { prompt: 'inspect' });".to_string(),
            ),
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: Some(15_000),
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Use browser debugging tools to inspect the current page. If browser debug is unavailable, then search this workspace for where the recent thread/tool timeline UI is rendered and name the actual component or file.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 2);
    assert_eq!(filtered.steps[0].kind, AgentStepKind::JsRepl);
    assert_eq!(filtered.steps[1].kind, AgentStepKind::Bash);
    assert!(filtered.steps[1]
        .command
        .as_deref()
        .is_some_and(|command| command.contains("recent|thread|tool|timeline")));
}

#[test]
fn runtime_plan_constraints_drop_unsourced_read_fallbacks_for_mixed_browser_requests_without_explicit_read_request(
) {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["inspect current page then trace source".to_string()],
        steps: vec![
            ProviderRuntimeStep {
                kind: AgentStepKind::JsRepl,
                input: Some(
                    "await codex.tool('inspect-runtime-browser', { prompt: 'inspect' });"
                        .to_string(),
                ),
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: Some(15_000),
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Bash,
                input: None,
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: Some(
                    "cd modern-vite-react19-oxc && rg -n --hidden -g '!node_modules' -g '!dist' -g '!build' -g '!coverage' -g '!target' -g '!*.map' \"thread|timeline|tool timeline|recent thread|recent messages\" src apps packages | head -n 200".to_string(),
                ),
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("src/components/ThreadTimeline.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("src/components/ToolTimeline.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
        ],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Use browser debugging tools to inspect the current page. If browser debug is unavailable, then search this workspace for where the recent thread/tool timeline UI is rendered and name the actual component or file. Use executed evidence only.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 2);
    assert_eq!(filtered.steps[0].kind, AgentStepKind::JsRepl);
    assert_eq!(filtered.steps[1].kind, AgentStepKind::Bash);
}

#[test]
fn runtime_plan_constraints_keep_read_fallbacks_when_mixed_browser_request_explicitly_asks_to_read_source(
) {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["inspect current page then trace source".to_string()],
        steps: vec![
            ProviderRuntimeStep {
                kind: AgentStepKind::JsRepl,
                input: Some(
                    "await codex.tool('inspect-runtime-browser', { prompt: 'inspect' });"
                        .to_string(),
                ),
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: Some(15_000),
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Bash,
                input: None,
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: Some("rg -n \"thread|timeline\" src . | head -n 50".to_string()),
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("src/components/ThreadTimeline.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
        ],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Use browser debugging tools to inspect the current page. If browser debug is unavailable, then search this workspace, read the actual source file that renders the recent thread/tool timeline UI, and cite executed evidence only.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 3);
    assert_eq!(filtered.steps[0].kind, AgentStepKind::JsRepl);
    assert_eq!(filtered.steps[1].kind, AgentStepKind::Bash);
    assert_eq!(filtered.steps[2].kind, AgentStepKind::Read);
}

#[test]
fn runtime_plan_constraints_rewrite_broad_recursive_search_to_rg() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["Search the workspace".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some(
                "find . -type f \\( -name '*.ts' -o -name '*.tsx' \\) | xargs grep -RniE 'runtime validation|provider rejected'"
                    .to_string(),
            ),
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Search this workspace for runtime validation and provider rejection paths",
        plan,
    );
    let command = filtered.steps[0]
        .command
        .as_deref()
        .expect("sanitized command");

    assert_sanitized_workspace_search_command_matches_runtime(command);
    assert_eq!(filtered.steps[0].timeout_ms, Some(15_000));
}

#[test]
fn workspace_search_backend_falls_back_when_rg_is_unavailable() {
    assert_eq!(
        preferred_workspace_search_backend(ShellFamily::PowerShell, false),
        WorkspaceSearchBackend::NativeFallback
    );
}

#[test]
fn sanitized_workspace_search_uses_powershell_native_fallback_without_rg() {
    let command = build_sanitized_workspace_search_command_for_backend(
        "runtime validation|provider rejected",
        ShellFamily::PowerShell,
        WorkspaceSearchBackend::NativeFallback,
    );

    assert!(command.starts_with("Get-ChildItem -Path src, apps, packages, ."));
    assert!(command.contains("Select-String -Pattern"));
    assert!(command.contains("Select-Object -First 200"));
    assert!(command.contains("node_modules|dist|\\.git|coverage|target|\\.turbo|build"));
}

#[test]
fn runtime_plan_constraints_rewrite_plain_recursive_grep_without_excludes_to_rg() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["Search the workspace".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some(
                "grep -RInE \"runtime validation|provider rejection|schema\" .".to_string(),
            ),
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Search this workspace for runtime validation and provider rejection paths",
        plan,
    );
    let command = filtered.steps[0]
        .command
        .as_deref()
        .expect("sanitized command");

    assert_sanitized_workspace_search_command_matches_runtime(command);
    assert_eq!(filtered.steps[0].timeout_ms, Some(15_000));
}

#[test]
fn runtime_plan_constraints_rewrite_broad_rg_workspace_search_to_sanitized_rg() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["Search the workspace".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some(
                "rg -n -i --glob '!node_modules' --glob '!dist' --glob '!.git' --glob '!coverage' --glob '!target' --glob '!.turbo' --glob '!build' '(runtime validation|validate|validator|zod|schema|reject|rejection|provider.*reject|throw new|invalid|assert)' .".to_string(),
            ),
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Search this workspace for runtime validation and provider rejection paths",
        plan,
    );
    let command = filtered.steps[0]
        .command
        .as_deref()
        .expect("sanitized command");

    assert_sanitized_workspace_search_command_matches_runtime(command);
    assert_eq!(filtered.steps[0].timeout_ms, Some(15_000));
}

#[test]
fn runtime_plan_constraints_rewrite_rg_search_even_when_pattern_mentions_rg_files() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["Search the workspace".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some(
                "rg -n --hidden --glob '!node_modules' --glob '!dist' --glob '!build' --glob '!.git' --glob '!coverage' --glob '!target' --glob '!.turbo' \"runtime plan|plan search|search.*command|command.*search|shell.*search|build.*search.*command|searchFiles|workspace search|rg --files\" src packages apps .".to_string(),
            ),
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Search this workspace for runtime plan search command handling",
        plan,
    );
    let command = filtered.steps[0]
        .command
        .as_deref()
        .expect("sanitized command");

    assert_sanitized_workspace_search_command_matches_runtime(command);
    assert_eq!(filtered.steps[0].timeout_ms, Some(15_000));
}

#[test]
fn runtime_plan_constraints_rewrite_rg_search_over_common_workspace_roots() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["Search the workspace".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some(
                "rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!coverage/**' --glob '!target/**' --glob '!.turbo/**' \"plan search|search command|PowerShell|powershell|shell environment|shell\" src packages apps".to_string(),
            ),
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Search this workspace for runtime plan search command handling",
        plan,
    );
    let command = filtered.steps[0]
        .command
        .as_deref()
        .expect("sanitized command");

    assert_sanitized_workspace_search_command_matches_runtime(command);
    assert_eq!(filtered.steps[0].timeout_ms, Some(15_000));
}

#[test]
fn runtime_plan_constraints_do_not_rewrite_rg_files_listing_commands() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["List files before narrowing search".to_string()],
        steps: vec![ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some("rg --files . | sed 's#^./##' | head -n 200".to_string()),
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        }],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "List top-level files in this workspace before narrowing the search",
        plan,
    );

    assert_eq!(
        filtered.steps[0].command.as_deref(),
        Some("rg --files . | sed 's#^./##' | head -n 200")
    );
    assert_eq!(filtered.steps[0].timeout_ms, None);
}

#[test]
fn runtime_plan_constraints_drop_unsourced_framework_entry_guesses() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["Inspect the actual entrypoint files".to_string()],
        steps: vec![
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("modern-vite-react19-oxc/package.json".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("modern-vite-react19-oxc/index.html".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("modern-vite-react19-oxc/src/main.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("modern-vite-react19-oxc/src/App.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
        ],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Find the actual app/project root in this workspace and inspect the real entrypoint files.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 2);
    assert_eq!(
        filtered.steps[0].path.as_deref(),
        Some("modern-vite-react19-oxc/package.json")
    );
    assert_eq!(
        filtered.steps[1].path.as_deref(),
        Some("modern-vite-react19-oxc/index.html")
    );
}

#[test]
fn runtime_plan_constraints_keep_framework_entry_reads_when_explicitly_surfaced() {
    let plan = ProviderRuntimePlanResponse {
        plan: vec!["Search for React entry files and inspect them".to_string()],
        steps: vec![
            ProviderRuntimeStep {
                kind: AgentStepKind::Bash,
                input: None,
                path: None,
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: Some("rg -n \"main\\\\.tsx|App\\\\.tsx\" src".to_string()),
                severities: None,
                max_items: None,
                timeout_ms: Some(15_000),
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("src/main.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
            ProviderRuntimeStep {
                kind: AgentStepKind::Read,
                input: None,
                path: Some("src/App.tsx".to_string()),
                paths: None,
                content: None,
                find: None,
                replace: None,
                command: None,
                severities: None,
                max_items: None,
                timeout_ms: None,
                task_key: None,
                depends_on: vec![],
                requires_approval: None,
            },
        ],
        final_message: None,
    };

    let filtered = enforce_provider_runtime_plan_step_constraints(
        "Search this workspace for where React entry files like main.tsx and App.tsx are rendered.",
        plan,
    );

    assert_eq!(filtered.steps.len(), 3);
    assert_eq!(filtered.steps[1].path.as_deref(), Some("src/main.tsx"));
    assert_eq!(filtered.steps[2].path.as_deref(), Some("src/App.tsx"));
}

#[test]
fn compact_provider_runtime_step_output_keeps_small_payload_inline() {
    let (output, metadata) =
        compact_provider_runtime_step_output("turn-1:runtime-plan:1", "small output");
    assert_eq!(output.as_deref(), Some("small output"));
    assert_eq!(metadata["compactionApplied"], Value::Bool(false));
    assert_eq!(metadata["outputByteCount"], Value::Number(12.into()));
    assert_eq!(metadata["outputPreviewByteCount"], Value::Number(12.into()));
}

#[test]
fn compact_provider_runtime_step_output_compacts_large_payload_with_reference() {
    let large_output = "x".repeat(256 * 1024 + 128);
    let (output, metadata) =
        compact_provider_runtime_step_output("turn-1:runtime-plan:1", large_output.as_str());
    let output = output.expect("compacted output");
    assert!(output.contains("Output compacted for context budget"));
    assert!(output.contains("Reference: turn://turn-1:runtime-plan:1/output"));
    assert_eq!(metadata["compactionApplied"], Value::Bool(true));
    assert_eq!(
        metadata["outputByteCount"],
        Value::Number((256 * 1024 + 128).into())
    );
    assert_eq!(
        metadata["outputPreviewByteCount"],
        Value::Number((256 * 1024).into())
    );
    assert_eq!(
        metadata["outputCompactionReference"],
        Value::String("turn://turn-1:runtime-plan:1/output".to_string())
    );
}

#[test]
fn build_provider_runtime_final_results_json_includes_execution_graph_metadata() {
    let body = build_provider_runtime_final_results_json(&[ProviderRuntimeStepResult {
        index: 0,
        kind: AgentStepKind::Read.as_str().to_string(),
        ok: true,
        message: "Read complete.".to_string(),
        output: Some("body".to_string()),
        metadata: json!({
            "plannerStepKey": "inspect-readme",
            "plannerDependsOn": [],
            "plannerWaveIndex": 0,
            "parallelSafe": true,
        }),
        error_code: None,
    }]);
    let parsed = serde_json::from_str::<Value>(body.as_str()).expect("results json");
    assert_eq!(parsed[0]["executionGraph"]["taskKey"], "inspect-readme");
    assert_eq!(parsed[0]["executionGraph"]["plannerWaveIndex"], Value::Null);
    assert_eq!(
        parsed[0]["executionGraph"]["waveIndex"],
        Value::Number(0.into())
    );
    assert_eq!(
        parsed[0]["executionGraph"]["parallelSafe"],
        Value::Bool(true)
    );
}

#[test]
fn build_provider_runtime_plan_review_body_formats_plan_items_for_follow_up() {
    let body = build_provider_runtime_plan_review_body(&ProviderRuntimePlanResponse {
        plan: vec![
            "Inspect the current composer plan-mode branch.".to_string(),
            "Patch runtime collaboration-mode handling.".to_string(),
        ],
        steps: vec![],
        final_message: Some("Execution will wait for confirmation.".to_string()),
    })
    .expect("review body");

    assert!(body.starts_with("Execution plan\n1. Inspect the current composer plan-mode branch."));
    assert!(body.contains("2. Patch runtime collaboration-mode handling."));
    assert!(body.contains("Note: Execution will wait for confirmation."));
}

#[test]
fn build_provider_runtime_final_results_json_trims_large_outputs_for_summary_prompt() {
    let oversized_output = "abc123".repeat(4_000);
    let payload = build_provider_runtime_final_results_json(&[ProviderRuntimeStepResult {
        index: 0,
        kind: "bash".to_string(),
        ok: true,
        message: "Runtime step completed.".to_string(),
        output: Some(oversized_output.clone()),
        metadata: json!({}),
        error_code: None,
    }]);
    let parsed = serde_json::from_str::<Value>(payload.as_str()).expect("parse final results json");
    let output = parsed[0]["output"]
        .as_str()
        .expect("expected trimmed output preview");

    assert!(output.contains("Output trimmed for final response context budget"));
    assert!(output.len() < oversized_output.len());
}

#[test]
fn blank_final_response_falls_back_to_execution_summary() {
    let step_results = vec![ProviderRuntimeStepResult {
        index: 0,
        kind: "bash".to_string(),
        ok: true,
        message: "Runtime step completed.".to_string(),
        output: Some("apps/code/src/main.tsx".to_string()),
        metadata: json!({}),
        error_code: None,
    }];

    let response = normalize_provider_runtime_final_response(
        "turn-1",
        "   \n\t".to_string(),
        step_results.as_slice(),
    );

    assert!(response.contains("Runtime execution summary:"));
    assert!(response.contains("1. bash: Runtime step completed."));
}

#[test]
fn runtime_plan_delta_adds_trailing_blank_line_for_follow_up_rendering() {
    let delta = build_provider_runtime_plan_delta(&ProviderRuntimePlanResponse {
        plan: vec![
            "Search the workspace for runtime validation code paths".to_string(),
            "Summarize the likely failure points".to_string(),
        ],
        steps: vec![],
        final_message: None,
    })
    .expect("runtime plan delta");

    assert!(delta.starts_with("Runtime plan:\n1. Search the workspace"));
    assert!(delta.ends_with("\n\n"));
}

#[test]
fn recoverable_missing_read_failure_does_not_block_finalization() {
    let read_miss = ProviderRuntimeStepResult {
        index: 1,
        kind: "read".to_string(),
        ok: false,
        message: "File `README.md` does not exist.".to_string(),
        output: None,
        metadata: json!({
            "errorCode": "runtime.read.file_not_found",
        }),
        error_code: Some("runtime.read.file_not_found".to_string()),
    };

    assert!(is_recoverable_provider_runtime_step_failure(&read_miss));
    assert!(!provider_runtime_results_have_blocking_failure(&[
        read_miss
    ]));
}

#[test]
fn non_recoverable_runtime_failure_still_blocks_finalization() {
    let read_miss = ProviderRuntimeStepResult {
        index: 0,
        kind: "read".to_string(),
        ok: false,
        message: "File `README.md` does not exist.".to_string(),
        output: None,
        metadata: json!({
            "errorCode": "runtime.read.file_not_found",
        }),
        error_code: Some("runtime.read.file_not_found".to_string()),
    };
    let bash_failure = ProviderRuntimeStepResult {
        index: 1,
        kind: "bash".to_string(),
        ok: false,
        message: "bash failed: exit 2".to_string(),
        output: None,
        metadata: json!({}),
        error_code: Some("STEP_EXECUTION_FAILED".to_string()),
    };

    assert!(provider_runtime_results_have_blocking_failure(&[
        read_miss,
        bash_failure
    ]));
}

#[test]
fn no_match_search_stops_follow_up_read_guesses() {
    let steps = vec![
        ProviderRuntimeStep {
            kind: AgentStepKind::Bash,
            input: None,
            path: None,
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: Some("rg -n -S --hidden -e 'runtime validation' . | head -n 200".to_string()),
            severities: None,
            max_items: None,
            timeout_ms: Some(15_000),
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        },
        ProviderRuntimeStep {
            kind: AgentStepKind::Read,
            input: None,
            path: Some("src/lib/chat.ts".to_string()),
            paths: None,
            content: None,
            find: None,
            replace: None,
            command: None,
            severities: None,
            max_items: None,
            timeout_ms: None,
            task_key: None,
            depends_on: vec![],
            requires_approval: None,
        },
    ];
    let bash_result = ProviderRuntimeStepResult {
        index: 0,
        kind: "bash".to_string(),
        ok: true,
        message: "Search completed with no matches.".to_string(),
        output: None,
        metadata: json!({
            "noMatches": true,
        }),
        error_code: None,
    };

    assert!(should_stop_after_provider_runtime_step(
        steps.as_slice(),
        0,
        &bash_result
    ));
}
