use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::{
    is_full_access_mode, publish_turn_event, AppContext, TURN_EVENT_TOOL_CALLING,
    TURN_EVENT_TOOL_RESULT,
};
use crate::AgentStepKind;

const PLANNER_MISSING_OBJECTIVE_BINDING: &str = "planner.missing_objective_binding";
const PLANNER_MISSING_SUCCESS_CRITERIA: &str = "planner.missing_success_criteria";
const PLANNER_WRITE_STEP_MISSING_APPROVAL: &str = "planner.write_step_missing_approval";
const PLANNER_INVALID_DEPENDENCY: &str = "planner.invalid_dependency";
const PLANNER_BROAD_WORKSPACE_SCAN: &str = "planner.broad_workspace_scan";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum RuntimePlannerDiagnosticSeverity {
    Warning,
    Fatal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimePlannerDiagnostic {
    pub code: String,
    pub severity: RuntimePlannerDiagnosticSeverity,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_index: Option<usize>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimePlannerDiagnosticsReport {
    pub diagnostics: Vec<RuntimePlannerDiagnostic>,
    pub has_fatal: bool,
}

impl RuntimePlannerDiagnosticsReport {
    pub(super) fn is_empty(&self) -> bool {
        self.diagnostics.is_empty()
    }

    pub(super) fn warning_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == RuntimePlannerDiagnosticSeverity::Warning)
            .count()
    }

    pub(super) fn fatal_count(&self) -> usize {
        self.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == RuntimePlannerDiagnosticSeverity::Fatal)
            .count()
    }
}

pub(super) fn planner_diagnostics_payload(report: &RuntimePlannerDiagnosticsReport) -> Value {
    json!({
        "hasFatal": report.has_fatal,
        "warningCount": report.warning_count(),
        "fatalCount": report.fatal_count(),
        "diagnostics": report.diagnostics,
    })
}

pub(super) fn with_planner_diagnostics_metadata(
    metadata: Value,
    planner_diagnostics: Option<&Value>,
) -> Value {
    let Some(planner_diagnostics) = planner_diagnostics else {
        return metadata;
    };
    let mut object = metadata.as_object().cloned().unwrap_or_default();
    object.insert(
        "plannerDiagnostics".to_string(),
        planner_diagnostics.clone(),
    );
    Value::Object(object)
}

pub(super) fn build_runtime_planner_lint_fallback(
    report: &RuntimePlannerDiagnosticsReport,
) -> String {
    let fatal_lines = report
        .diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.severity == RuntimePlannerDiagnosticSeverity::Fatal)
        .map(|diagnostic| format!("- {}: {}", diagnostic.code, diagnostic.message.trim()))
        .collect::<Vec<_>>();
    if fatal_lines.is_empty() {
        return "Planner diagnostics reported issues; runtime execution was skipped for safety."
            .to_string();
    }
    format!(
        "Planner safety check blocked direct runtime execution.\n{}\nPlease refine the objective or explicitly approve high-risk steps.",
        fatal_lines.join("\n")
    )
}

pub(super) fn publish_runtime_planner_diagnostics(
    ctx: &AppContext,
    turn_id: &str,
    request_id: Option<&str>,
    report: &RuntimePlannerDiagnosticsReport,
) {
    if report.is_empty() {
        return;
    }
    let item_id = format!("{turn_id}:runtime-plan-lint");
    let diagnostics = planner_diagnostics_payload(report);
    let diagnostics_summary = if report.has_fatal {
        format!(
            "{} fatal, {} warning diagnostics.",
            report.fatal_count(),
            report.warning_count()
        )
    } else {
        format!("{} planner warning diagnostics.", report.warning_count())
    };
    let metadata = json!({
        "plannerDiagnostics": diagnostics.clone(),
    });

    publish_turn_event(
        ctx,
        TURN_EVENT_TOOL_CALLING,
        json!({
            "turnId": turn_id,
            "itemId": item_id,
            "item": {
                "id": item_id,
                "type": "mcpToolCall",
                "server": "runtime",
                "tool": "runtime-plan-validation",
                "arguments": {
                    "plannerDiagnostics": diagnostics.clone(),
                },
                "status": "inProgress",
            },
        }),
        request_id,
    );

    publish_turn_event(
        ctx,
        TURN_EVENT_TOOL_RESULT,
        json!({
            "turnId": turn_id,
            "itemId": item_id,
            "item": {
                "id": item_id,
                "type": "mcpToolCall",
                "server": "runtime",
                "tool": "runtime-plan-validation",
                "arguments": {
                    "plannerDiagnostics": diagnostics,
                },
                "status": if report.has_fatal { "failed" } else { "completed" },
                "result": if report.has_fatal { String::new() } else { diagnostics_summary.clone() },
                "error": if report.has_fatal { diagnostics_summary.clone() } else { String::new() },
                "metadata": metadata,
            },
        }),
        request_id,
    );
}

#[derive(Debug, Clone)]
pub(super) struct RuntimePlannerLintStep {
    pub index: usize,
    pub kind: AgentStepKind,
    pub task_key: Option<String>,
    pub depends_on: Vec<String>,
    pub requires_approval: bool,
    pub path: Option<String>,
    pub command: Option<String>,
}

fn is_write_like_step(kind: AgentStepKind) -> bool {
    matches!(
        kind,
        AgentStepKind::Write | AgentStepKind::Edit | AgentStepKind::Bash | AgentStepKind::JsRepl
    )
}

fn request_looks_read_only(user_content: &str) -> bool {
    let lowered = user_content.to_ascii_lowercase();
    if lowered.contains("read only")
        || lowered.contains("read-only")
        || lowered.contains("review")
        || lowered.contains("analy")
        || lowered.contains("summar")
        || lowered.contains("explain")
        || lowered.contains("inspect")
        || lowered.contains("diagnose")
        || lowered.contains("investigate")
    {
        return true;
    }

    let normalized = user_content.replace(char::is_whitespace, "");
    normalized.contains("只读")
        || normalized.contains("分析")
        || normalized.contains("总结")
        || normalized.contains("解释")
        || normalized.contains("检查")
}

fn is_stop_token(token: &str) -> bool {
    matches!(
        token,
        "the"
            | "this"
            | "that"
            | "with"
            | "from"
            | "into"
            | "about"
            | "please"
            | "need"
            | "want"
            | "should"
            | "could"
            | "would"
            | "where"
            | "when"
            | "while"
            | "after"
            | "before"
            | "only"
            | "local"
            | "files"
            | "workspace"
            | "runtime"
            | "agent"
            | "agents"
    )
}

fn collect_objective_tokens(user_content: &str) -> Vec<String> {
    user_content
        .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
        .filter_map(|token| {
            let normalized = token.trim().to_ascii_lowercase();
            if normalized.len() < 4 || is_stop_token(normalized.as_str()) {
                return None;
            }
            Some(normalized)
        })
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>()
}

fn plan_mentions_objective(
    user_content: &str,
    plan_items: &[String],
    steps: &[RuntimePlannerLintStep],
) -> bool {
    let objective_tokens = collect_objective_tokens(user_content);
    if objective_tokens.is_empty() {
        return true;
    }

    let mut planner_text = String::new();
    for item in plan_items {
        planner_text.push(' ');
        planner_text.push_str(item);
    }
    for step in steps {
        if let Some(path) = step.path.as_deref() {
            planner_text.push(' ');
            planner_text.push_str(path);
        }
        if let Some(command) = step.command.as_deref() {
            planner_text.push(' ');
            planner_text.push_str(command);
        }
    }
    let lowered = planner_text.to_ascii_lowercase();

    objective_tokens
        .iter()
        .any(|token| lowered.contains(token.as_str()))
}

fn plan_has_success_criteria(plan_items: &[String]) -> bool {
    if plan_items.is_empty() {
        return true;
    }

    const SUCCESS_HINTS: [&str; 11] = [
        "verify",
        "validation",
        "validate",
        "test",
        "assert",
        "confirm",
        "done",
        "完成",
        "验证",
        "检查",
        "回归",
    ];

    plan_items.iter().any(|item| {
        let lowered = item.to_ascii_lowercase();
        SUCCESS_HINTS
            .iter()
            .any(|hint| lowered.contains(hint) || item.contains(hint))
    })
}

fn detect_dependency_cycle(graph: &HashMap<String, Vec<String>>) -> Option<Vec<String>> {
    fn visit(
        node: &str,
        graph: &HashMap<String, Vec<String>>,
        visiting: &mut HashSet<String>,
        visited: &mut HashSet<String>,
        stack: &mut Vec<String>,
    ) -> Option<Vec<String>> {
        if visiting.contains(node) {
            if let Some(start_index) = stack.iter().position(|entry| entry == node) {
                let mut cycle = stack[start_index..].to_vec();
                cycle.push(node.to_string());
                return Some(cycle);
            }
            return Some(vec![node.to_string(), node.to_string()]);
        }
        if visited.contains(node) {
            return None;
        }

        visiting.insert(node.to_string());
        stack.push(node.to_string());
        if let Some(dependencies) = graph.get(node) {
            for dependency in dependencies {
                if let Some(cycle) = visit(dependency.as_str(), graph, visiting, visited, stack) {
                    return Some(cycle);
                }
            }
        }
        stack.pop();
        visiting.remove(node);
        visited.insert(node.to_string());
        None
    }

    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    let mut stack = Vec::new();

    for task_key in graph.keys() {
        if let Some(cycle) = visit(
            task_key.as_str(),
            graph,
            &mut visiting,
            &mut visited,
            &mut stack,
        ) {
            return Some(cycle);
        }
    }

    None
}

fn build_report(diagnostics: Vec<RuntimePlannerDiagnostic>) -> RuntimePlannerDiagnosticsReport {
    RuntimePlannerDiagnosticsReport {
        has_fatal: diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == RuntimePlannerDiagnosticSeverity::Fatal),
        diagnostics,
    }
}

fn push_warning(diagnostics: &mut Vec<RuntimePlannerDiagnostic>, code: &str, message: String) {
    diagnostics.push(RuntimePlannerDiagnostic {
        code: code.to_string(),
        severity: RuntimePlannerDiagnosticSeverity::Warning,
        message,
        step_index: None,
    });
}

fn push_fatal(
    diagnostics: &mut Vec<RuntimePlannerDiagnostic>,
    code: &str,
    message: String,
    step_index: Option<usize>,
) {
    diagnostics.push(RuntimePlannerDiagnostic {
        code: code.to_string(),
        severity: RuntimePlannerDiagnosticSeverity::Fatal,
        message,
        step_index,
    });
}

fn command_uses_broad_recursive_scan(command: &str) -> bool {
    let lowered = command.to_ascii_lowercase();
    let uses_broad_scan = lowered.contains("find . -type f")
        || lowered.contains("grep -r")
        || lowered.contains("grep -rn")
        || lowered.contains("grep -rni")
        || lowered.contains("grep -rnie")
        || lowered.contains("xargs grep -r")
        || lowered.contains("xargs grep -rn")
        || lowered.contains("xargs grep -rni")
        || lowered.contains("xargs grep -rnie");
    let uses_workspace_root_rg = (lowered.starts_with("rg ") || lowered.contains(" rg "))
        && (lowered.ends_with(" .")
            || lowered.contains(" . ")
            || lowered.contains(" .|")
            || lowered.contains(" ./"));
    if uses_workspace_root_rg {
        let has_preferred_generated_dir_excludes = lowered.contains("!**/node_modules/**")
            && lowered.contains("!**/dist/**")
            && lowered.contains("!**/.git/**");
        let has_output_limit = lowered.contains("| head -n 200")
            || lowered.contains("|head -n 200")
            || lowered.contains("| select-object -first 200")
            || lowered.contains("|select-object -first 200");
        return !has_preferred_generated_dir_excludes || !has_output_limit;
    }
    if !uses_broad_scan {
        return false;
    }

    let excludes_generated_dirs =
        lowered.contains("node_modules") && lowered.contains("dist") && lowered.contains(".git");
    !excludes_generated_dirs
}

pub(super) fn lint_runtime_plan(
    user_content: &str,
    access_mode: &str,
    plan_items: &[String],
    steps: &[RuntimePlannerLintStep],
) -> RuntimePlannerDiagnosticsReport {
    let mut diagnostics = Vec::new();

    if !plan_mentions_objective(user_content, plan_items, steps) {
        push_warning(
            &mut diagnostics,
            PLANNER_MISSING_OBJECTIVE_BINDING,
            "Planner output does not clearly bind to user objective tokens.".to_string(),
        );
    }

    if !plan_has_success_criteria(plan_items) {
        push_warning(
            &mut diagnostics,
            PLANNER_MISSING_SUCCESS_CRITERIA,
            "Planner output is missing explicit success criteria or verification steps."
                .to_string(),
        );
    }

    if let Some(step) = steps.iter().find(|step| {
        step.kind == AgentStepKind::Bash
            && step
                .command
                .as_deref()
                .is_some_and(command_uses_broad_recursive_scan)
    }) {
        push_warning(
            &mut diagnostics,
            PLANNER_BROAD_WORKSPACE_SCAN,
            format!(
                "Step {} performs a broad recursive workspace scan without clearly excluding generated directories. Prefer targeted rg searches and skip node_modules, dist, and .git unless the user explicitly asked for them.",
                step.index + 1
            ),
        );
    }

    if request_looks_read_only(user_content) && !is_full_access_mode(access_mode) {
        for step in steps {
            if is_write_like_step(step.kind) && !step.requires_approval {
                push_fatal(
                    &mut diagnostics,
                    PLANNER_WRITE_STEP_MISSING_APPROVAL,
                    format!(
                        "Step {} is high-risk ({}) for a read-only objective without approval.",
                        step.index + 1,
                        step.kind.as_str()
                    ),
                    Some(step.index),
                );
                break;
            }
        }
    }

    let mut task_step_index = HashMap::<String, usize>::new();
    for step in steps {
        let Some(task_key) = step
            .task_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };

        if let Some(existing_index) = task_step_index.insert(task_key.to_string(), step.index) {
            push_fatal(
                &mut diagnostics,
                PLANNER_INVALID_DEPENDENCY,
                format!(
                    "Duplicate taskKey '{}' declared at steps {} and {}.",
                    task_key,
                    existing_index + 1,
                    step.index + 1
                ),
                Some(step.index),
            );
        }
    }

    let has_declared_dependencies = steps.iter().any(|step| !step.depends_on.is_empty());
    if has_declared_dependencies && task_step_index.is_empty() {
        push_fatal(
            &mut diagnostics,
            PLANNER_INVALID_DEPENDENCY,
            "Planner declared dependsOn entries but no taskKey values were provided.".to_string(),
            None,
        );
        return build_report(diagnostics);
    }

    let mut dependency_graph = HashMap::<String, Vec<String>>::new();
    for step in steps {
        let task_key = step
            .task_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);

        if task_key.is_none() && !step.depends_on.is_empty() {
            push_fatal(
                &mut diagnostics,
                PLANNER_INVALID_DEPENDENCY,
                format!(
                    "Step {} declares dependsOn but is missing taskKey.",
                    step.index + 1
                ),
                Some(step.index),
            );
            continue;
        }

        let Some(task_key) = task_key else {
            continue;
        };

        let mut dependencies = Vec::new();
        let mut seen_dependencies = HashSet::new();
        for dependency in &step.depends_on {
            let dependency_key = dependency.trim();
            if dependency_key.is_empty() || !seen_dependencies.insert(dependency_key.to_string()) {
                continue;
            }
            if !task_step_index.contains_key(dependency_key) {
                push_fatal(
                    &mut diagnostics,
                    PLANNER_INVALID_DEPENDENCY,
                    format!(
                        "Step {} references missing dependency taskKey '{}'.",
                        step.index + 1,
                        dependency_key
                    ),
                    Some(step.index),
                );
                continue;
            }
            dependencies.push(dependency_key.to_string());
        }

        dependency_graph.insert(task_key, dependencies);
    }

    if let Some(cycle) = detect_dependency_cycle(&dependency_graph) {
        push_fatal(
            &mut diagnostics,
            PLANNER_INVALID_DEPENDENCY,
            format!("Planner dependency cycle detected: {}.", cycle.join(" -> ")),
            None,
        );
    }

    build_report(diagnostics)
}

#[cfg(test)]
mod tests {
    use super::{
        lint_runtime_plan, RuntimePlannerDiagnosticSeverity, RuntimePlannerDiagnosticsReport,
        RuntimePlannerLintStep,
    };
    use crate::AgentStepKind;

    fn build_step(
        index: usize,
        kind: AgentStepKind,
        task_key: Option<&str>,
        depends_on: &[&str],
        requires_approval: bool,
        path: Option<&str>,
        command: Option<&str>,
    ) -> RuntimePlannerLintStep {
        RuntimePlannerLintStep {
            index,
            kind,
            task_key: task_key.map(ToOwned::to_owned),
            depends_on: depends_on.iter().map(|value| value.to_string()).collect(),
            requires_approval,
            path: path.map(ToOwned::to_owned),
            command: command.map(ToOwned::to_owned),
        }
    }

    fn has_code(report: &RuntimePlannerDiagnosticsReport, code: &str) -> bool {
        report
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == code)
    }

    #[test]
    fn lint_reports_missing_success_criteria_warning() {
        let report = lint_runtime_plan(
            "Update parser behavior",
            "on-request",
            &["Update parser behavior".to_string()],
            &[build_step(
                0,
                AgentStepKind::Read,
                Some("read-parser"),
                &[],
                false,
                Some("src/parser.ts"),
                None,
            )],
        );

        assert!(has_code(&report, "planner.missing_success_criteria"));
        assert_eq!(report.warning_count(), 1);
        assert_eq!(report.fatal_count(), 0);
        assert!(!report.has_fatal);
    }

    #[test]
    fn lint_reports_write_step_missing_approval_for_read_only_request() {
        let report = lint_runtime_plan(
            "Review and summarize current config only",
            "on-request",
            &["Summarize config".to_string()],
            &[build_step(
                0,
                AgentStepKind::Write,
                Some("write-config"),
                &[],
                false,
                Some("config/app.json"),
                None,
            )],
        );

        assert!(has_code(&report, "planner.write_step_missing_approval"));
        assert!(report.has_fatal);
        assert_eq!(report.fatal_count(), 1);
    }

    #[test]
    fn lint_skips_write_step_approval_fatal_for_full_access_mode() {
        let report = lint_runtime_plan(
            "Review and summarize current config only",
            "full-access",
            &["Summarize config".to_string()],
            &[build_step(
                0,
                AgentStepKind::Bash,
                Some("inspect-config"),
                &[],
                false,
                None,
                Some("cat config/app.json"),
            )],
        );

        assert!(!has_code(&report, "planner.write_step_missing_approval"));
        assert!(!report.has_fatal);
    }

    #[test]
    fn lint_skips_write_step_approval_fatal_for_full_access_alias() {
        let report = lint_runtime_plan(
            "Review and summarize current config only",
            "danger-full-access",
            &["Summarize config".to_string()],
            &[build_step(
                0,
                AgentStepKind::Write,
                Some("write-config"),
                &[],
                false,
                Some("config/app.json"),
                None,
            )],
        );

        assert!(!has_code(&report, "planner.write_step_missing_approval"));
        assert!(!report.has_fatal);
    }

    #[test]
    fn lint_reports_invalid_dependency_for_missing_task_key() {
        let report = lint_runtime_plan(
            "Refactor parser",
            "on-request",
            &["Refactor parser and verify tests".to_string()],
            &[
                build_step(
                    0,
                    AgentStepKind::Read,
                    Some("read"),
                    &[],
                    false,
                    Some("src/parser.ts"),
                    None,
                ),
                build_step(
                    1,
                    AgentStepKind::Edit,
                    Some("edit"),
                    &["missing"],
                    true,
                    Some("src/parser.ts"),
                    None,
                ),
            ],
        );

        assert!(has_code(&report, "planner.invalid_dependency"));
        assert!(report.has_fatal);
    }

    #[test]
    fn lint_reports_invalid_dependency_cycle() {
        let report = lint_runtime_plan(
            "Refactor parser",
            "on-request",
            &["Refactor parser and verify tests".to_string()],
            &[
                build_step(
                    0,
                    AgentStepKind::Read,
                    Some("a"),
                    &["c"],
                    true,
                    Some("src/parser.ts"),
                    None,
                ),
                build_step(
                    1,
                    AgentStepKind::Edit,
                    Some("b"),
                    &["a"],
                    true,
                    Some("src/parser.ts"),
                    None,
                ),
                build_step(
                    2,
                    AgentStepKind::Read,
                    Some("c"),
                    &["b"],
                    true,
                    Some("src/parser.ts"),
                    None,
                ),
            ],
        );

        assert!(has_code(&report, "planner.invalid_dependency"));
        assert!(report.has_fatal);
    }

    #[test]
    fn lint_reports_broad_workspace_scan_warning_for_recursive_grep_without_excludes() {
        let report = lint_runtime_plan(
            "Search this workspace for runtime validation and provider rejection paths",
            "full-access",
            &["Search for runtime validation paths and summarize findings".to_string()],
            &[build_step(
                0,
                AgentStepKind::Bash,
                Some("search-runtime"),
                &[],
                false,
                None,
                Some("find . -type f | xargs grep -RniE 'runtime validation|provider rejected'"),
            )],
        );

        assert!(has_code(&report, "planner.broad_workspace_scan"));
        assert_eq!(report.warning_count(), 1);
        assert_eq!(report.fatal_count(), 0);
        assert!(!report.has_fatal);
    }

    #[test]
    fn lint_reports_broad_workspace_scan_warning_for_workspace_root_rg_without_limit() {
        let report = lint_runtime_plan(
            "Search this workspace for runtime validation and provider rejection paths",
            "full-access",
            &["Search for runtime validation paths and summarize findings".to_string()],
            &[build_step(
                0,
                AgentStepKind::Bash,
                Some("search-runtime"),
                &[],
                false,
                None,
                Some(
                    "rg -n -i --glob '!node_modules' --glob '!dist' --glob '!.git' '(runtime validation|provider rejected)' .",
                ),
            )],
        );

        assert!(has_code(&report, "planner.broad_workspace_scan"));
        assert_eq!(report.warning_count(), 1);
        assert_eq!(report.fatal_count(), 0);
        assert!(!report.has_fatal);
    }

    #[test]
    fn lint_accepts_plan_with_objective_binding_success_criteria_and_valid_dependencies() {
        let report = lint_runtime_plan(
            "Refactor parser module",
            "on-request",
            &["Refactor parser module and verify unit tests pass".to_string()],
            &[
                build_step(
                    0,
                    AgentStepKind::Read,
                    Some("read-parser"),
                    &[],
                    true,
                    Some("src/parser.ts"),
                    None,
                ),
                build_step(
                    1,
                    AgentStepKind::Edit,
                    Some("edit-parser"),
                    &["read-parser"],
                    true,
                    Some("src/parser.ts"),
                    None,
                ),
            ],
        );

        assert!(!report.has_fatal);
        assert!(report.diagnostics.iter().all(|diagnostic| {
            diagnostic.severity == RuntimePlannerDiagnosticSeverity::Warning
        }));
        assert!(report.diagnostics.is_empty());
    }
}
