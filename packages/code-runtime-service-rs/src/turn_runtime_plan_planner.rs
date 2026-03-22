use super::*;
use crate::{
    truncate_text_for_error,
    turn_runtime_plan_validation::{lint_runtime_plan, RuntimePlannerLintStep},
    AgentStepKind,
};
use ku0_runtime_shell_core::{resolve_shell_from_env, ShellFamily};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use super::search_helpers::{
    build_sanitized_workspace_search_command_for_backend, preferred_workspace_search_backend,
    runtime_rg_available, WorkspaceSearchBackend,
};

pub(super) const PROVIDER_RUNTIME_PLAN_MAX_STEPS: usize = 16;
const PROVIDER_RUNTIME_PROMPT_MAX_CHARS: usize = 8_000;

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ProviderRuntimePlanResponse {
    #[serde(default)]
    pub(super) plan: Vec<String>,
    #[serde(default)]
    pub(super) steps: Vec<ProviderRuntimeStep>,
    #[serde(default)]
    pub(super) final_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ProviderRuntimeStep {
    pub(super) kind: AgentStepKind,
    #[serde(default)]
    pub(super) input: Option<String>,
    #[serde(default)]
    pub(super) path: Option<String>,
    #[serde(default)]
    pub(super) paths: Option<Vec<String>>,
    #[serde(default)]
    pub(super) content: Option<String>,
    #[serde(default)]
    pub(super) find: Option<String>,
    #[serde(default)]
    pub(super) replace: Option<String>,
    #[serde(default)]
    pub(super) command: Option<String>,
    #[serde(default)]
    pub(super) severities: Option<Vec<String>>,
    #[serde(default, alias = "max_items")]
    pub(super) max_items: Option<u64>,
    #[serde(default, alias = "timeout_ms")]
    pub(super) timeout_ms: Option<u64>,
    #[serde(default, alias = "taskKey")]
    pub(super) task_key: Option<String>,
    #[serde(default, alias = "dependsOn")]
    pub(super) depends_on: Vec<String>,
    #[serde(default, alias = "requiresApproval", alias = "requires_approval")]
    pub(super) requires_approval: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ProviderRuntimeStepResult {
    pub(super) index: usize,
    pub(super) kind: String,
    pub(super) ok: bool,
    pub(super) message: String,
    pub(super) output: Option<String>,
    pub(super) metadata: Value,
    pub(super) error_code: Option<String>,
}

pub(super) fn assistant_message_indicates_local_access_refusal(message: &str) -> bool {
    let lowered = message.to_ascii_lowercase();
    if lowered.contains("can't access your local")
        || lowered.contains("cannot access your local")
        || lowered.contains("can't directly access your")
        || lowered.contains("cannot directly access your")
        || lowered.contains("cannot directly write files")
        || lowered.contains("can't directly write files")
    {
        return true;
    }
    let normalized = message.replace(char::is_whitespace, "");
    normalized.contains("无法直接访问")
        || normalized.contains("不能直接访问")
        || normalized.contains("无法访问你当前机器")
        || normalized.contains("无法直接写入")
}

pub(super) fn extract_first_code_block_with_languages(
    message: &str,
    allowed_languages: &[&str],
) -> Option<String> {
    let allowed = allowed_languages
        .iter()
        .map(|language| language.trim().to_ascii_lowercase())
        .collect::<Vec<_>>();
    let mut cursor = message;
    while let Some(start) = cursor.find("```") {
        let rest = &cursor[(start + 3)..];
        let Some(header_end) = rest.find('\n') else {
            return None;
        };
        let language = rest[..header_end].trim().to_ascii_lowercase();
        let body_start = header_end + 1;
        let Some(body_end_rel) = rest[body_start..].find("```") else {
            return None;
        };
        let body_end = body_start + body_end_rel;
        let body = rest[body_start..body_end].trim();
        if !body.is_empty() && allowed.iter().any(|entry| entry == language.as_str()) {
            return Some(body.to_string());
        }
        cursor = &rest[(body_end + 3)..];
    }
    None
}

pub(super) fn parse_provider_runtime_plan_response(
    message: &str,
) -> Option<ProviderRuntimePlanResponse> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut candidates = vec![trimmed.to_string()];
    if let Some(json_block) = extract_first_code_block_with_languages(message, &["json", ""]) {
        candidates.push(json_block);
    }
    if let (Some(start), Some(end)) = (message.find('{'), message.rfind('}')) {
        if start < end {
            candidates.push(message[start..=end].to_string());
        }
    }
    for candidate in candidates {
        let Ok(payload) = serde_json::from_str::<Value>(candidate.as_str()) else {
            continue;
        };
        let Ok(parsed) = serde_json::from_value::<ProviderRuntimePlanResponse>(payload) else {
            continue;
        };
        let has_final = parsed
            .final_message
            .as_deref()
            .is_some_and(|entry| !entry.trim().is_empty());
        if !parsed.plan.is_empty() || !parsed.steps.is_empty() || has_final {
            return Some(parsed);
        }
    }
    None
}

fn build_provider_runtime_plan_prompt_internal(
    user_content: &str,
    workspace_path: &str,
    plan_only: bool,
) -> String {
    let shell_spec = resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL");
    let search_backend =
        preferred_workspace_search_backend(shell_spec.family, runtime_rg_available());
    let prompt_content = truncate_text_for_error(user_content, PROVIDER_RUNTIME_PROMPT_MAX_CHARS);
    let allow_bash_steps = !request_requires_sub_agent_orchestration(user_content);
    let require_direct_execution = request_requires_direct_runtime_execution(user_content);
    let allowed_kinds = if allow_bash_steps {
        "read, write, edit, bash, js_repl, diagnostics"
    } else {
        "read, write, edit, diagnostics"
    };
    let step_schema_entries = if allow_bash_steps {
        "    {{\"kind\":\"read\",\"taskKey\":\"inspect-readme\",\"dependsOn\":[],\"path\":\"relative/path\"}},\n\
    {{\"kind\":\"diagnostics\",\"taskKey\":\"verify-build\",\"dependsOn\":[\"apply-edit\"],\"paths\":[\"relative/path\"],\"severities\":[\"error\",\"warning\"],\"maxItems\":50}},\n\
    {{\"kind\":\"write\",\"taskKey\":\"write-file\",\"dependsOn\":[\"inspect-readme\"],\"path\":\"relative/path\",\"content\":\"...\",\"requiresApproval\":true}},\n\
    {{\"kind\":\"edit\",\"taskKey\":\"apply-edit\",\"dependsOn\":[\"inspect-readme\"],\"path\":\"relative/path\",\"find\":\"...\",\"replace\":\"...\",\"requiresApproval\":true}},\n\
    {{\"kind\":\"bash\",\"taskKey\":\"run-check\",\"dependsOn\":[\"apply-edit\"],\"command\":\"...\",\"timeoutMs\":15000,\"requiresApproval\":true}},\n\
    {{\"kind\":\"js_repl\",\"taskKey\":\"inspect-runtime\",\"dependsOn\":[],\"input\":\"console.log(await import('node:fs/promises'));\",\"timeoutMs\":15000,\"requiresApproval\":true}}\n\
"
    } else {
        "    {{\"kind\":\"read\",\"taskKey\":\"inspect-readme\",\"dependsOn\":[],\"path\":\"relative/path\"}},\n\
    {{\"kind\":\"diagnostics\",\"taskKey\":\"verify-build\",\"dependsOn\":[\"apply-edit\"],\"paths\":[\"relative/path\"],\"severities\":[\"error\"],\"maxItems\":25}},\n\
    {{\"kind\":\"write\",\"taskKey\":\"write-file\",\"dependsOn\":[\"inspect-readme\"],\"path\":\"relative/path\",\"content\":\"...\",\"requiresApproval\":true}},\n\
    {{\"kind\":\"edit\",\"taskKey\":\"apply-edit\",\"dependsOn\":[\"inspect-readme\"],\"path\":\"relative/path\",\"find\":\"...\",\"replace\":\"...\",\"requiresApproval\":true}}\n\
"
    };
    let sub_agent_rule = if allow_bash_steps {
        ""
    } else {
        "- User explicitly requested sub-agent orchestration. Do not emit bash or js_repl steps.\n\
- If delegated sub-agent orchestration is required, return {\"plan\":[],\"steps\":[],\"finalMessage\":\"...\"}.\n\
"
    };
    let no_tool_rule = if plan_only {
        "- This turn is plan-only collaboration mode. Do not execute or imply work is already done.\n\
- Return a reviewable plan with concrete steps whenever feasible.\n\
- Use finalMessage only when planning is blocked by a concrete missing prerequisite or safety limitation.\n\
"
    } else if require_direct_execution {
        "- Return {\"plan\":[],\"steps\":[],\"finalMessage\":\"...\"} only when execution is blocked by a concrete missing prerequisite or safety limitation.\n\
"
    } else {
        "- If no tool is needed, return {\"plan\":[],\"steps\":[],\"finalMessage\":\"...\"}.\n\
"
    };
    let direct_execution_rule = if require_direct_execution {
        "- This request has direct execution intent. Return at least one concrete runtime step when feasible.\n\
- Do not answer with advice, alternative commands, or optional suggestions instead of executing.\n\
- Use finalMessage only for blockers you cannot resolve automatically inside the workspace.\n\
"
    } else {
        ""
    };
    let browser_debug_rule = if allow_bash_steps
        && request_requires_runtime_browser_debug(user_content)
    {
        "- For browser-debug or current-page inspection requests, first use a js_repl step that calls codex.tool('get-runtime-browser-debug-status', {}).\n\
- If browser debug is ready, keep browser inspection inside js_repl by calling codex.tool('inspect-runtime-browser', ...) or codex.tool('run-runtime-browser-automation', ...).\n\
- If browser debug is unavailable or degraded, stop and explain that blocker instead of reading repo files.\n\
- Do not inspect source files or run repo searches as a fallback for live-page questions unless the user also explicitly asked for source inspection.\n\
- If the user explicitly asked for a source/code fallback after a blocked browser-debug step, keep the browser probe first and then continue with the requested workspace search/read steps.\n\
"
    } else {
        ""
    };
    let search_tool_rule = match search_backend {
        WorkspaceSearchBackend::Rg => {
            "- For repo/codebase search, prefer rg/rg --files over find | grep or grep -R.\n\
"
        }
        WorkspaceSearchBackend::NativeFallback => match shell_spec.family {
            ShellFamily::PowerShell => {
                "- `rg` is unavailable in this environment. Use PowerShell-native search commands such as Get-ChildItem + Select-String instead of rg.\n\
"
            }
            ShellFamily::Cmd => {
                "- `rg` is unavailable in this environment. Use cmd-compatible or PowerShell fallback search commands instead of rg.\n\
"
            }
            ShellFamily::Posix => {
                "- `rg` is unavailable in this environment. Use shell-compatible recursive grep/find commands instead of rg.\n\
"
            }
        },
    };
    let search_hygiene_rule = if allow_bash_steps {
        format!(
            "{search_tool_rule}\
- Do not scan node_modules, dist, .git, coverage, target, .turbo, or build outputs unless the user explicitly asks.\n\
- Narrow bash searches to likely source roots first (for example apps/, packages/, docs/, src/) and keep output concise.\n\
- When the shell environment is PowerShell or cmd, do not emit POSIX-only helpers like head, sed, or xargs; use shell-compatible alternatives.\n\
- Do not invent file paths or guess that common root docs exist.\n\
- Only emit read steps for files the user named explicitly or files surfaced by earlier search/inspection steps.\n\
- Do not infer alternate framework-convention filenames that were not surfaced by earlier steps (for example guessing main.tsx or App.tsx when only main.ts was listed).\n\
- If an exploratory search returns no matches, summarize that instead of reading generic files like README.md.\n\
- If the workspace root looks like a wrapper directory, inspect top-level entries and descend into a likely nested project root before concluding there are no relevant matches.\n\
- If a shell search could return many matches, add path filters or output limits so the final response still has room to summarize.\n\
" ,
            search_tool_rule = search_tool_rule
        )
    } else {
        String::new()
    };
    let workspace_hint = build_workspace_structure_hint(workspace_path);
    format!(
        "You are Codex using runtime tools in workspace `{workspace_path}`.\n\
You CAN read/write/edit files, run shell commands, and execute JavaScript snippets via js_repl runtime tools.\n\
You CAN also inspect structured workspace diagnostics via the diagnostics runtime tool.\n\
Use js_repl when you need to compose multiple runtime tools for browser/code debugging instead of stacking many shell steps.\n\
If a plan uses js_repl, treat approval for that js_repl step as covering nested codex.tool(...) calls executed inside the same REPL session.\n\
Never claim you cannot access the local machine.\n\
{shell_summary}\n\
Return STRICT JSON only (no markdown).\n\
Schema:\n\
{{\n\
  \"plan\": [\"short plan item\"],\n\
  \"steps\": [\n\
{step_schema_entries}\
  ],\n\
  \"finalMessage\": \"optional direct answer when no tools are required\"\n\
}}\n\
Rules:\n\
- Allowed kinds: {allowed_kinds}.\n\
- Give every step a stable taskKey and use dependsOn to express execution order.\n\
- Independent read/diagnostics steps should usually be separate roots with dependsOn: [].\n\
- write/edit/bash/js_repl steps should usually depend on the evidence-gathering steps they need.\n\
- Never schedule multiple write/edit/bash/js_repl steps as independent parallel roots.\n\
- Prefer diagnostics when the request involves compile errors, type errors, lint failures, or post-edit verification.\n\
- After edits that affect build/type/lint behavior, add a diagnostics step when feasible before finalMessage.\n\
- Use workspace-relative paths only.\n\
- Keep steps <= {max_steps}.\n\
{no_tool_rule}\
{direct_execution_rule}\
{browser_debug_rule}\
{search_hygiene_rule}\
{sub_agent_rule}\
{workspace_hint}\
\n\
User request:\n\
{prompt_content}",
        workspace_path = workspace_path,
        shell_summary = shell_spec.prompt_summary(),
        step_schema_entries = step_schema_entries,
        allowed_kinds = allowed_kinds,
        no_tool_rule = no_tool_rule,
        direct_execution_rule = direct_execution_rule,
        browser_debug_rule = browser_debug_rule,
        search_hygiene_rule = search_hygiene_rule,
        sub_agent_rule = sub_agent_rule,
        workspace_hint = workspace_hint,
        max_steps = PROVIDER_RUNTIME_PLAN_MAX_STEPS,
        prompt_content = prompt_content
    )
}

fn build_workspace_structure_hint(workspace_path: &str) -> String {
    let workspace = Path::new(workspace_path);
    let Ok(entries) = fs::read_dir(workspace) else {
        return String::new();
    };

    let mut top_level_files = Vec::new();
    let mut top_level_dirs = Vec::new();

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_file() {
            if top_level_files.len() < 8 {
                top_level_files.push(file_name);
            }
        } else if file_type.is_dir() {
            if top_level_dirs.len() < 8 {
                top_level_dirs.push(file_name);
            }
        }
    }

    top_level_files.sort();
    top_level_dirs.sort();

    let root_has_project_markers = top_level_files.iter().any(|name| {
        matches!(
            name.as_str(),
            "package.json" | "Cargo.toml" | "pyproject.toml" | "go.mod" | "requirements.txt"
        )
    }) || top_level_dirs
        .iter()
        .any(|name| matches!(name.as_str(), "src" | "app" | ".git"));

    let mut nested_project_roots = Vec::new();
    for dir_name in &top_level_dirs {
        let dir_path = workspace.join(dir_name);
        let mut markers = Vec::new();
        for marker in [
            "package.json",
            "Cargo.toml",
            "pyproject.toml",
            "go.mod",
            "src",
            "app",
            ".git",
        ] {
            if dir_path.join(marker).exists() {
                markers.push(marker);
            }
        }
        if !markers.is_empty() {
            nested_project_roots.push(format!("{dir_name}/ ({})", markers.join(", ")));
        }
    }

    if root_has_project_markers && nested_project_roots.is_empty() {
        return String::new();
    }

    let top_level_dirs_summary = if top_level_dirs.is_empty() {
        "none".to_string()
    } else {
        top_level_dirs.join(", ")
    };
    let top_level_files_summary = if top_level_files.is_empty() {
        "none".to_string()
    } else {
        top_level_files.join(", ")
    };
    let nested_project_summary = if nested_project_roots.is_empty() {
        "none".to_string()
    } else {
        nested_project_roots.join("; ")
    };

    format!(
        "Workspace structure hint:\n\
- Top-level dirs: {top_level_dirs_summary}\n\
- Top-level files: {top_level_files_summary}\n\
- Likely nested project roots: {nested_project_summary}\n\
- If searches from `.` come back empty, inspect the likely nested project root before summarizing.\n\
"
    )
}

pub(super) fn build_provider_runtime_plan_prompt(
    user_content: &str,
    workspace_path: &str,
) -> String {
    build_provider_runtime_plan_prompt_internal(user_content, workspace_path, false)
}

fn build_sanitized_workspace_search_command(pattern: &str) -> String {
    let shell_family = resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL").family;
    let backend = preferred_workspace_search_backend(shell_family, runtime_rg_available());
    build_sanitized_workspace_search_command_for_backend(pattern, shell_family, backend)
}

pub(super) fn build_provider_runtime_plan_review_prompt(
    user_content: &str,
    workspace_path: &str,
) -> String {
    build_provider_runtime_plan_prompt_internal(user_content, workspace_path, true)
}

pub(super) fn request_requires_sub_agent_orchestration(message: &str) -> bool {
    let lowered = message.to_ascii_lowercase();
    if lowered.contains("sub agent")
        || lowered.contains("sub-agent")
        || lowered.contains("sub_agent")
        || lowered.contains("subagents")
        || lowered.contains("subagent")
        || lowered.contains("spawn agent")
        || lowered.contains("spawn-agent")
        || lowered.contains("spawn_agent")
        || lowered.contains("multi agent")
        || lowered.contains("multi-agent")
        || lowered.contains("multi_agent")
    {
        return true;
    }
    let normalized = message.replace(char::is_whitespace, "");
    let normalized_lowered = normalized.to_ascii_lowercase();
    normalized.contains("子代理")
        || normalized.contains("多代理")
        || normalized_lowered.contains("启用subagent")
        || normalized_lowered.contains("启用subagents")
}

fn request_requires_runtime_browser_debug(message: &str) -> bool {
    let lowered = message.to_ascii_lowercase();
    if lowered.contains("browser debugging tools")
        || lowered.contains("browser ui")
        || lowered.contains("current page")
        || lowered.contains("live page")
        || lowered.contains("inspect the page")
        || lowered.contains("inspect the current page")
        || lowered.contains("inspect the browser")
        || (lowered.contains("playwright") && lowered.contains("inspect"))
        || lowered.contains("devtools")
        || lowered.contains("topbar/header")
        || lowered.contains("header height")
    {
        return true;
    }
    let normalized = message.replace(char::is_whitespace, "");
    normalized.contains("浏览器调试")
        || normalized.contains("当前页面")
        || normalized.contains("实时页面")
        || normalized.contains("页面高度")
}

fn request_requires_browser_debug_source_fallback(message: &str) -> bool {
    let lowered = message.to_ascii_lowercase();
    let asks_for_source_follow_up = lowered.contains("search this workspace")
        || lowered.contains("source tracing")
        || lowered.contains("source trace")
        || lowered.contains("source fallback")
        || lowered.contains("component")
        || lowered.contains("file")
        || lowered.contains("where")
        || lowered.contains("rendered");
    let ties_follow_up_to_browser_blocker = lowered.contains("if browser debug is unavailable")
        || lowered.contains("if browser debugging is unavailable")
        || lowered.contains("if browser debug is blocked")
        || lowered.contains("if browser inspection is blocked")
        || lowered.contains("then search");
    let normalized = message.replace(char::is_whitespace, "");
    (asks_for_source_follow_up && ties_follow_up_to_browser_blocker)
        || (normalized.contains("如果浏览器调试不可用")
            && (normalized.contains("搜索这个workspace")
                || normalized.contains("搜索此workspace")
                || normalized.contains("组件")
                || normalized.contains("文件")
                || normalized.contains("渲染")))
}

fn request_explicit_source_read_after_browser_fallback(message: &str) -> bool {
    let lowered = message.to_ascii_lowercase();
    if lowered.contains("read the actual source")
        || lowered.contains("read the actual file")
        || lowered.contains("read the file")
        || lowered.contains("read the surfaced")
        || lowered.contains("inspect the actual source")
        || lowered.contains("inspect the source")
        || lowered.contains("inspect the actual file")
        || lowered.contains("explain the exact condition")
        || lowered.contains("inspect its actual entrypoint")
    {
        return true;
    }
    let normalized = message.replace(char::is_whitespace, "");
    normalized.contains("读取实际源码")
        || normalized.contains("读取实际文件")
        || normalized.contains("读取该文件")
        || normalized.contains("检查实际源码")
        || normalized.contains("检查该源码")
        || normalized.contains("精确条件")
}

fn build_browser_debug_source_fallback_search_step(
    user_content: &str,
) -> Option<ProviderRuntimeStep> {
    let lowered = user_content.to_ascii_lowercase();
    let search_tail = lowered
        .split("search this workspace for")
        .nth(1)
        .or_else(|| lowered.split("then search").nth(1))
        .unwrap_or(lowered.as_str());
    let keywords = search_tail
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .map(str::trim)
        .filter(|token| token.len() >= 4)
        .filter(|token| {
            !matches!(
                *token,
                "search"
                    | "this"
                    | "workspace"
                    | "where"
                    | "rendered"
                    | "actual"
                    | "component"
                    | "browser"
                    | "debug"
                    | "unavailable"
                    | "current"
                    | "page"
                    | "executed"
                    | "evidence"
                    | "only"
                    | "inspect"
                    | "tools"
                    | "name"
                    | "file"
                    | "then"
            )
        })
        .take(5)
        .collect::<Vec<_>>();
    if keywords.is_empty() {
        return None;
    }
    let pattern = keywords.join("|");
    Some(ProviderRuntimeStep {
        kind: AgentStepKind::Bash,
        input: None,
        path: None,
        paths: None,
        content: None,
        find: None,
        replace: None,
        command: Some(build_sanitized_workspace_search_command(pattern.as_str())),
        severities: None,
        max_items: None,
        timeout_ms: Some(15_000),
        task_key: None,
        depends_on: vec![],
        requires_approval: None,
    })
}

fn command_looks_like_broad_workspace_search(command: &str) -> bool {
    let lowered = command.to_ascii_lowercase();
    if command_invokes_rg_files(command) {
        return false;
    }
    let uses_recursive_grep = lowered.contains("grep -r")
        || lowered.contains("grep -rn")
        || lowered.contains("grep -rni")
        || lowered.contains("grep -rnie")
        || lowered.contains("xargs grep -r")
        || lowered.contains("xargs grep -rn")
        || lowered.contains("xargs grep -rni")
        || lowered.contains("xargs grep -rnie");
    let rg_path_operands = rg_path_operands(command);
    let uses_workspace_root_rg = !rg_path_operands.is_empty()
        && rg_path_operands
            .iter()
            .any(|path| matches!(path.as_str(), "." | "./"));
    let common_workspace_root_count = rg_path_operands
        .iter()
        .filter(|path| {
            matches!(
                path.as_str(),
                "src" | "./src" | "app" | "./app" | "apps" | "./apps" | "packages" | "./packages"
            )
        })
        .count();
    let uses_common_workspace_roots = common_workspace_root_count >= 2;
    if !uses_recursive_grep && !uses_workspace_root_rg && !uses_common_workspace_roots {
        return false;
    }
    let has_preferred_generated_dir_excludes = lowered.contains("!**/node_modules/**")
        && lowered.contains("!**/dist/**")
        && lowered.contains("!**/.git/**");
    let has_output_limit = lowered.contains("| head -n 200")
        || lowered.contains("|head -n 200")
        || lowered.contains("| select-object -first 200")
        || lowered.contains("|select-object -first 200");
    if uses_workspace_root_rg || uses_common_workspace_roots {
        return !has_preferred_generated_dir_excludes || !has_output_limit;
    }
    let has_explicit_generated_dir_excludes = lowered.contains("--exclude-dir=node_modules")
        || lowered.contains("--exclude-dir node_modules")
        || lowered.contains("node_modules")
            && (lowered.contains("--exclude-dir")
                || lowered.contains("--glob")
                || lowered.contains("!**/node_modules/**"));
    !has_explicit_generated_dir_excludes
}

fn parse_shell_tokens(command: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;

    for ch in command.chars() {
        if let Some(active_quote) = quote {
            if ch == active_quote {
                quote = None;
            } else {
                current.push(ch);
            }
            continue;
        }

        match ch {
            '\'' | '"' => {
                quote = Some(ch);
            }
            ch if ch.is_whitespace() => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(ch),
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn command_invokes_rg_files(command: &str) -> bool {
    let tokens = parse_shell_tokens(command);
    let Some(first_token) = tokens.first() else {
        return false;
    };
    let lowered_first = first_token.to_ascii_lowercase();
    (lowered_first == "rg" || lowered_first == "rg.exe")
        && tokens.iter().any(|token| token == "--files")
}

fn rg_path_operands(command: &str) -> Vec<String> {
    let tokens = parse_shell_tokens(command);
    let Some(first_token) = tokens.first() else {
        return Vec::new();
    };
    let lowered_first = first_token.to_ascii_lowercase();
    if lowered_first != "rg" && lowered_first != "rg.exe" {
        return Vec::new();
    }
    if tokens.iter().any(|token| token == "--files") {
        return Vec::new();
    }

    let mut positional = Vec::new();
    let mut index = 1usize;
    while index < tokens.len() {
        let token = tokens[index].as_str();
        if token == "--" {
            positional.extend(tokens.iter().skip(index + 1).cloned());
            break;
        }
        if matches!(
            token,
            "--glob" | "-g" | "-e" | "-f" | "-t" | "-T" | "--type" | "--type-not"
        ) {
            index += 2;
            continue;
        }
        if token.starts_with("--glob=")
            || token.starts_with("--type=")
            || token.starts_with("--type-not=")
            || token.starts_with("-g=")
            || token.starts_with("-e=")
        {
            index += 1;
            continue;
        }
        if token.starts_with('-') {
            index += 1;
            continue;
        }
        positional.push(tokens[index].clone());
        index += 1;
    }

    positional.into_iter().skip(1).collect()
}

fn extract_workspace_search_pattern(command: &str) -> Option<String> {
    let mut quoted_arguments = Vec::new();
    let mut cursor = command;

    while let Some(quote_index) = cursor.find(['\'', '"']) {
        let quote = cursor[quote_index..].chars().next()?;
        let remainder = &cursor[(quote_index + quote.len_utf8())..];
        let pattern_end = remainder.find(quote)?;
        let pattern = remainder[..pattern_end].trim();
        if !pattern.is_empty() {
            quoted_arguments.push(pattern.to_string());
        }
        cursor = &remainder[(pattern_end + quote.len_utf8())..];
    }

    quoted_arguments.pop()
}

fn read_step_path_basename(step: &ProviderRuntimeStep) -> Option<String> {
    let path = step.path.as_deref()?.trim();
    if path.is_empty() {
        return None;
    }
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn is_speculative_framework_entry_guess_basename(basename: &str) -> bool {
    matches!(basename, "main.tsx" | "main.jsx" | "app.tsx" | "app.jsx")
}

fn text_mentions_basename(text: &str, basename: &str) -> bool {
    text.to_ascii_lowercase().contains(basename)
}

fn step_surfaces_read_basename(step: &ProviderRuntimeStep, basename: &str) -> bool {
    step.path
        .as_deref()
        .is_some_and(|path| text_mentions_basename(path, basename))
        || step
            .command
            .as_deref()
            .is_some_and(|command| text_mentions_basename(command, basename))
}

fn is_unsourced_framework_entry_guess(
    user_content: &str,
    steps: &[ProviderRuntimeStep],
    step_index: usize,
) -> bool {
    let Some(step) = steps.get(step_index) else {
        return false;
    };
    if step.kind != AgentStepKind::Read {
        return false;
    }
    let Some(basename) = read_step_path_basename(step) else {
        return false;
    };
    if !is_speculative_framework_entry_guess_basename(basename.as_str()) {
        return false;
    }
    if text_mentions_basename(user_content, basename.as_str()) {
        return false;
    }
    !steps
        .iter()
        .take(step_index)
        .any(|prior_step| step_surfaces_read_basename(prior_step, basename.as_str()))
}

fn sanitize_broad_workspace_search_command(command: &str) -> Option<String> {
    if !command_looks_like_broad_workspace_search(command) {
        return None;
    }
    let pattern = extract_workspace_search_pattern(command)?;
    Some(build_sanitized_workspace_search_command(pattern.as_str()))
}

fn build_browser_debug_execution_step(user_content: &str) -> ProviderRuntimeStep {
    let prompt_literal = serde_json::to_string(user_content).unwrap_or_else(|_| {
        "\"Inspect the current page with browser debugging tools.\"".to_string()
    });
    ProviderRuntimeStep {
        kind: AgentStepKind::JsRepl,
        input: Some(
            format!(
                "const request = {prompt_literal};\
                 const summarize = (value) => {{\
                   if (typeof value?.output === 'string' && value.output.trim()) {{\
                     console.log(value.output);\
                   }} else {{\
                     console.log(JSON.stringify(value, null, 2));\
                   }}\
                 }};\
                 const status = await (async () => {{\
                   try {{\
                     return await codex.tool('get-runtime-browser-debug-status', {{}});\
                   }} catch (error) {{\
                     return {{ error: String(error?.message ?? error) }};\
                   }}\
                 }})();\
                 summarize(status);\
                 const inspection = await (async () => {{\
                   try {{\
                     return await codex.tool('inspect-runtime-browser', {{ prompt: request, timeoutMs: 20000 }});\
                   }} catch (error) {{\
                     return {{ error: String(error?.message ?? error) }};\
                   }}\
                 }})();\
                 summarize(inspection);"
            ),
        ),
        path: None,
        paths: None,
        content: None,
        find: None,
        replace: None,
        command: None,
        severities: None,
        max_items: None,
        timeout_ms: Some(30_000),
        task_key: None,
        depends_on: vec![],
        requires_approval: None,
    }
}

pub(super) fn enforce_provider_runtime_plan_step_constraints(
    user_content: &str,
    mut plan: ProviderRuntimePlanResponse,
) -> ProviderRuntimePlanResponse {
    if request_requires_sub_agent_orchestration(user_content) {
        plan.steps
            .retain(|step| !matches!(step.kind, AgentStepKind::Bash | AgentStepKind::JsRepl));
        if plan.steps.is_empty()
            && plan
                .final_message
                .as_deref()
                .map(|entry| entry.trim().is_empty())
                .unwrap_or(true)
        {
            plan.final_message = Some(
                "Sub-agent orchestration was requested, so runtime bash/js_repl steps were skipped. Use runtime agent task orchestration for delegated execution.".to_string(),
            );
        }
        return plan;
    }

    if request_requires_runtime_browser_debug(user_content) {
        let browser_step = build_browser_debug_execution_step(user_content);
        if request_requires_browser_debug_source_fallback(user_content) {
            let allow_read_fallbacks =
                request_explicit_source_read_after_browser_fallback(user_content);
            let mut retained_steps = std::mem::take(&mut plan.steps)
                .into_iter()
                .filter(|step| {
                    step.kind != AgentStepKind::JsRepl
                        && (allow_read_fallbacks || step.kind != AgentStepKind::Read)
                })
                .collect::<Vec<_>>();
            if !retained_steps
                .iter()
                .any(|step| step.kind == AgentStepKind::Bash)
            {
                if let Some(search_step) =
                    build_browser_debug_source_fallback_search_step(user_content)
                {
                    retained_steps.push(search_step);
                }
            }
            plan.steps = vec![browser_step];
            plan.steps.extend(retained_steps);
            if plan.plan.is_empty() {
                plan.plan.push(
                    "Check runtime browser-debug availability, then continue with the requested workspace/source tracing if needed."
                        .to_string(),
                );
            }
            plan.final_message = None;
        } else {
            plan.steps = vec![browser_step];
            if plan.plan.is_empty() {
                plan.plan.push(
                    "Check runtime browser-debug availability, then inspect the live page."
                        .to_string(),
                );
            }
            plan.final_message = None;
            return plan;
        }
    }

    for step in &mut plan.steps {
        if step.kind != AgentStepKind::Bash {
            continue;
        }
        let Some(command) = step.command.as_deref() else {
            continue;
        };
        if let Some(sanitized) = sanitize_broad_workspace_search_command(command) {
            step.command = Some(sanitized);
            if step.timeout_ms.is_none() {
                step.timeout_ms = Some(15_000);
            }
        }
    }

    let original_steps = plan.steps.clone();
    plan.steps = original_steps
        .iter()
        .enumerate()
        .filter_map(|(index, step)| {
            if is_unsourced_framework_entry_guess(user_content, original_steps.as_slice(), index) {
                return None;
            }
            Some(step.clone())
        })
        .collect();

    plan
}

pub(super) fn parse_provider_runtime_plan_tool_arguments(
    arguments: &str,
) -> Option<ProviderRuntimePlanResponse> {
    let trimmed = arguments.trim();
    if trimmed.is_empty() {
        return None;
    }
    let payload = serde_json::from_str::<Value>(trimmed).ok()?;
    let parsed = serde_json::from_value::<ProviderRuntimePlanResponse>(payload).ok()?;
    let has_final = parsed
        .final_message
        .as_deref()
        .is_some_and(|entry| !entry.trim().is_empty());
    if !parsed.plan.is_empty() || !parsed.steps.is_empty() || has_final {
        Some(parsed)
    } else {
        None
    }
}

fn build_runtime_planner_lint_steps(steps: &[ProviderRuntimeStep]) -> Vec<RuntimePlannerLintStep> {
    steps
        .iter()
        .enumerate()
        .map(|(index, step)| RuntimePlannerLintStep {
            index,
            kind: step.kind,
            task_key: step.task_key.clone(),
            depends_on: step.depends_on.clone(),
            requires_approval: step.requires_approval.unwrap_or(false),
            path: step.path.clone(),
            command: step.command.clone(),
        })
        .collect()
}

pub(super) fn build_runtime_planner_diagnostics(
    user_content: &str,
    access_mode: &str,
    plan: &ProviderRuntimePlanResponse,
) -> RuntimePlannerDiagnosticsReport {
    let lint_steps = build_runtime_planner_lint_steps(plan.steps.as_slice());
    lint_runtime_plan(
        user_content,
        access_mode,
        plan.plan.as_slice(),
        lint_steps.as_slice(),
    )
}

pub(super) fn build_provider_runtime_step_payload(
    workspace_id: &str,
    step: &ProviderRuntimeStep,
    access_mode: &str,
) -> Value {
    let mut options = serde_json::Map::new();
    options.insert(
        "workspaceId".to_string(),
        Value::String(workspace_id.to_string()),
    );
    if let Some(path) = step.path.as_deref() {
        options.insert("path".to_string(), Value::String(path.to_string()));
    }
    if let Some(paths) = step.paths.as_ref() {
        options.insert(
            "paths".to_string(),
            Value::Array(paths.iter().cloned().map(Value::String).collect()),
        );
    }
    if let Some(content) = step.content.as_deref() {
        options.insert("content".to_string(), Value::String(content.to_string()));
    }
    if let Some(find) = step.find.as_deref() {
        options.insert("find".to_string(), Value::String(find.to_string()));
    }
    if let Some(replace) = step.replace.as_deref() {
        options.insert("replace".to_string(), Value::String(replace.to_string()));
    }
    if let Some(command) = step.command.as_deref() {
        options.insert("command".to_string(), Value::String(command.to_string()));
    }
    if let Some(severities) = step.severities.as_ref() {
        options.insert(
            "severities".to_string(),
            Value::Array(severities.iter().cloned().map(Value::String).collect()),
        );
    }
    if let Some(max_items) = step.max_items {
        options.insert("maxItems".to_string(), Value::Number(max_items.into()));
    }
    if let Some(timeout_ms) = step.timeout_ms {
        options.insert("timeoutMs".to_string(), Value::Number(timeout_ms.into()));
    }

    json!({
        "skillId": step.kind.skill_id(),
        "input": step.input.clone().unwrap_or_default(),
        "options": options,
        "context": {
            "accessMode": access_mode,
            "plannerStepKey": step.task_key,
        }
    })
}

pub(super) fn merge_json_object_fields(target: &mut Value, patch: Value) {
    let Some(target_object) = target.as_object_mut() else {
        return;
    };
    let Some(patch_object) = patch.as_object() else {
        return;
    };
    for (key, value) in patch_object {
        target_object.insert(key.clone(), value.clone());
    }
}

pub(super) fn build_provider_runtime_final_prompt(
    user_content: &str,
    plan: &ProviderRuntimePlanResponse,
    results_json: &str,
) -> String {
    let prompt_content = truncate_text_for_error(user_content, PROVIDER_RUNTIME_PROMPT_MAX_CHARS);
    let planned_step_count = if !plan.steps.is_empty() {
        plan.steps.len()
    } else {
        plan.plan.len()
    };
    format!(
        "You are Codex. Runtime tools have already executed.\n\
Use only the execution results to produce the final user-facing response.\n\
Do not claim you cannot access the local machine.\n\
Do not describe planned-but-unexecuted steps as if they happened.\n\
If execution stopped early, say later planned steps were skipped instead of inventing observations.\n\
If a search result says there were no matches, report that plainly and do not imply hidden file inspection.\n\
\n\
Original request:\n\
{prompt_content}\n\
\n\
Planned step count: {planned_step_count}\n\
\n\
Runtime execution results JSON:\n\
{results_json}\n\
\n\
Response requirements:\n\
- Summarize what changed or what command outputs were observed.\n\
- If any step failed, explain the failure clearly and give next action.\n\
- Keep concise and actionable."
    )
}

pub(super) fn build_provider_runtime_execution_fallback(
    results: &[ProviderRuntimeStepResult],
) -> String {
    if results.is_empty() {
        return "Runtime recovery attempted but produced no executable steps.".to_string();
    }
    let lines = results
        .iter()
        .map(|result| {
            if result.ok {
                format!("{}. {}: {}", result.index + 1, result.kind, result.message)
            } else {
                format!(
                    "{}. {} failed: {}",
                    result.index + 1,
                    result.kind,
                    result.message
                )
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("Runtime execution summary:\n{lines}")
}
