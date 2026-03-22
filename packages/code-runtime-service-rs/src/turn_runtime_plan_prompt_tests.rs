use super::{
    build_provider_runtime_final_prompt, build_provider_runtime_plan_prompt,
    request_requires_direct_runtime_execution, request_requires_sub_agent_orchestration,
    search_helpers::{
        preferred_workspace_search_backend, runtime_rg_available, WorkspaceSearchBackend,
    },
    ProviderRuntimePlanResponse,
};
use ku0_runtime_shell_core::{resolve_shell_from_env, ShellFamily};
use std::fs;

fn assert_runtime_search_prompt_rule(prompt: &str) {
    let shell_family = resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL").family;
    let backend = preferred_workspace_search_backend(shell_family, runtime_rg_available());
    match backend {
        WorkspaceSearchBackend::Rg => {
            assert!(prompt.contains("prefer rg/rg --files over find | grep or grep -R"));
        }
        WorkspaceSearchBackend::NativeFallback => match shell_family {
            ShellFamily::PowerShell => assert!(prompt.contains(
                "`rg` is unavailable in this environment. Use PowerShell-native search commands such as Get-ChildItem + Select-String instead of rg."
            )),
            ShellFamily::Cmd => assert!(prompt.contains(
                "`rg` is unavailable in this environment. Use cmd-compatible or PowerShell fallback search commands instead of rg."
            )),
            ShellFamily::Posix => assert!(prompt.contains(
                "`rg` is unavailable in this environment. Use shell-compatible recursive grep/find commands instead of rg."
            )),
        },
    }
}

#[test]
fn sub_agent_orchestration_detection_handles_english_and_chinese_requests() {
    assert!(request_requires_sub_agent_orchestration(
        "Please use sub agents to parallelize this analysis."
    ));
    assert!(request_requires_sub_agent_orchestration(
        "请启用 sub agents 来处理这个任务。"
    ));
    assert!(!request_requires_sub_agent_orchestration(
        "Read and summarize README.md."
    ));
}

#[test]
fn runtime_plan_prompt_omits_bash_when_sub_agents_are_required() {
    let prompt = build_provider_runtime_plan_prompt("请启用 sub agents 分析最新问题", "/tmp/ws");
    assert!(
        prompt.contains("Shell environment:")
            && prompt.contains("Allowed kinds: read, write, edit, diagnostics.")
    );
    assert!(!prompt.contains("\"kind\":\"bash\""));
    assert!(prompt.contains("Do not emit bash or js_repl steps."));
}

#[test]
fn direct_runtime_execution_detection_matches_imperative_requests() {
    assert!(request_requires_direct_runtime_execution(
        "创建现代化 vite+react+oxc Starter 项目"
    ));
    assert!(request_requires_direct_runtime_execution(
        "Fix the failing parser tests and update the snapshots."
    ));
    assert!(!request_requires_direct_runtime_execution(
        "How do I create a modern vite react oxc starter project?"
    ));
    assert!(!request_requires_direct_runtime_execution(
        "解释一下如何创建现代化 vite+react+oxc Starter 项目"
    ));
}

#[test]
fn runtime_plan_prompt_requires_steps_for_direct_execution_requests() {
    let prompt =
        build_provider_runtime_plan_prompt("创建现代化 vite+react+oxc Starter 项目", "/tmp/ws");
    assert!(prompt.contains("Return at least one concrete runtime step"));
    assert!(prompt.contains("Do not answer with advice, alternative commands"));
}

#[test]
fn runtime_plan_prompt_includes_js_repl_for_browser_debug_flows() {
    let prompt = build_provider_runtime_plan_prompt(
        "Use Playwright to inspect the browser UI and report what changed.",
        "/tmp/ws",
    );
    assert!(prompt.contains("Allowed kinds: read, write, edit, bash, js_repl, diagnostics."));
    assert!(prompt.contains("Use js_repl when you need to compose multiple runtime tools"));
    assert!(
        prompt.contains("approval for that js_repl step as covering nested codex.tool(...) calls")
    );
    assert!(prompt.contains("\"kind\":\"js_repl\""));
    assert!(prompt.contains("codex.tool('get-runtime-browser-debug-status', {})"));
    assert!(prompt.contains("codex.tool('inspect-runtime-browser', ...)"));
    assert!(prompt.contains("Do not inspect source files or run repo searches as a fallback"));
    assert!(prompt.contains("continue with the requested workspace search/read steps"));
}

#[test]
fn runtime_plan_prompt_includes_search_hygiene_for_bash_capable_requests() {
    let prompt = build_provider_runtime_plan_prompt(
        "Search this workspace for runtime validation failures and summarize them.",
        "/tmp/ws",
    );

    assert!(prompt.contains("Shell environment:"));
    assert!(!prompt.contains("CODE_RUNTIME_CORE_SHELL"));
    assert_runtime_search_prompt_rule(prompt.as_str());
    assert!(prompt.contains(
        "Do not scan node_modules, dist, .git, coverage, target, .turbo, or build outputs"
    ));
    assert!(prompt.contains("keep output concise"));
    assert!(prompt.contains("Do not invent file paths or guess that common root docs exist"));
    assert!(prompt
        .contains("Do not infer alternate framework-convention filenames that were not surfaced"));
    assert!(prompt.contains(
        "If an exploratory search returns no matches, summarize that instead of reading generic files like README.md"
    ));
    assert!(prompt.contains(
        "If the workspace root looks like a wrapper directory, inspect top-level entries"
    ));
}

#[test]
fn runtime_final_prompt_ignores_unexecuted_plan_details() {
    let prompt = build_provider_runtime_final_prompt(
        "Search this workspace for runtime validation failures and summarize them.",
        &ProviderRuntimePlanResponse {
            plan: vec![
                "search for runtime validation failures".to_string(),
                "inspect provider.js".to_string(),
            ],
            steps: Vec::new(),
            final_message: None,
        },
        r#"[
  {
    "index": 0,
    "kind": "bash",
    "ok": true,
    "message": "Search completed with no matches.",
    "errorCode": null,
    "output": null
  }
]"#,
    );

    assert!(prompt.contains("Use only the execution results"));
    assert!(prompt.contains("Do not describe planned-but-unexecuted steps as if they happened."));
    assert!(prompt.contains("If a search result says there were no matches, report that plainly"));
    assert!(prompt.contains("Planned step count: 2"));
    assert!(!prompt.contains("provider.js"));
    assert!(!prompt.contains("Plan JSON"));
}

#[test]
fn runtime_plan_prompt_includes_nested_project_workspace_hint() {
    let workspace = std::env::temp_dir().join(format!(
        "runtime-plan-workspace-hint-{}",
        std::process::id()
    ));
    let nested_project = workspace.join("modern-vite-react19-oxc");
    let _ = fs::remove_dir_all(workspace.as_path());
    fs::create_dir_all(nested_project.join("src")).expect("create nested src");
    fs::write(
        nested_project.join("package.json"),
        "{\"name\":\"fixture\"}",
    )
    .expect("write nested package");

    let prompt = build_provider_runtime_plan_prompt(
        "Search this workspace for runtime validation failures and summarize them.",
        workspace.to_str().expect("workspace path"),
    );

    assert!(prompt.contains("Workspace structure hint:"));
    assert!(prompt.contains("modern-vite-react19-oxc/ (package.json, src)"));
    assert!(prompt.contains("Likely nested project roots:"));

    let _ = fs::remove_dir_all(workspace.as_path());
}
