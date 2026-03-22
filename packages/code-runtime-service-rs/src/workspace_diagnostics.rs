use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeSet, HashSet};
use std::path::{Path, PathBuf};
use tokio::process::Command as TokioCommand;
use tokio::time::{timeout, Duration};

use crate::now_ms;

const WORKSPACE_DIAGNOSTICS_PROVIDER_TIMEOUT_MS: u64 = 30_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceDiagnosticsListRequest {
    #[serde(alias = "workspace_id")]
    pub(crate) workspace_id: String,
    #[serde(default)]
    pub(crate) paths: Option<Vec<String>>,
    #[serde(default)]
    pub(crate) severities: Option<Vec<WorkspaceDiagnosticSeverity>>,
    #[serde(default, alias = "max_items")]
    pub(crate) max_items: Option<u64>,
    #[serde(default, alias = "include_provider_details")]
    pub(crate) include_provider_details: Option<bool>,
}

#[derive(Clone, Debug)]
pub(crate) struct WorkspaceDiagnosticsQuery {
    pub(crate) paths: Vec<String>,
    pub(crate) severities: Vec<WorkspaceDiagnosticSeverity>,
    pub(crate) max_items: Option<usize>,
    pub(crate) include_provider_details: bool,
}

impl WorkspaceDiagnosticsQuery {
    pub(crate) fn from_request(request: &WorkspaceDiagnosticsListRequest) -> Self {
        Self {
            paths: normalize_requested_paths(request.paths.as_deref().unwrap_or_default()),
            severities: request.severities.clone().unwrap_or_default(),
            max_items: request
                .max_items
                .and_then(|value| usize::try_from(value).ok()),
            include_provider_details: request.include_provider_details.unwrap_or(false),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum WorkspaceDiagnosticSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

impl WorkspaceDiagnosticSeverity {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Error => "error",
            Self::Warning => "warning",
            Self::Info => "info",
            Self::Hint => "hint",
        }
    }

    pub(crate) fn from_level(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "error" => Some(Self::Error),
            "warning" | "warn" => Some(Self::Warning),
            "note" | "info" | "information" => Some(Self::Info),
            "help" | "hint" => Some(Self::Hint),
            _ => None,
        }
    }

    fn rank(self) -> usize {
        match self {
            Self::Error => 0,
            Self::Warning => 1,
            Self::Info => 2,
            Self::Hint => 3,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum WorkspaceDiagnosticsProviderId {
    Native,
    CargoCheck,
    Oxlint,
    Tsc,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum WorkspaceDiagnosticsProviderState {
    Used,
    Skipped,
    Failed,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceDiagnosticsProviderStatus {
    pub(crate) id: WorkspaceDiagnosticsProviderId,
    pub(crate) status: WorkspaceDiagnosticsProviderState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) message: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceDiagnostic {
    pub(crate) path: String,
    pub(crate) severity: WorkspaceDiagnosticSeverity,
    pub(crate) message: String,
    pub(crate) source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) code: Option<String>,
    pub(crate) start_line: u64,
    pub(crate) start_column: u64,
    pub(crate) end_line: u64,
    pub(crate) end_column: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceDiagnosticsSummary {
    pub(crate) error_count: u64,
    pub(crate) warning_count: u64,
    pub(crate) info_count: u64,
    pub(crate) hint_count: u64,
    pub(crate) total: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceDiagnosticsListResponse {
    pub(crate) available: bool,
    pub(crate) summary: WorkspaceDiagnosticsSummary,
    pub(crate) items: Vec<WorkspaceDiagnostic>,
    pub(crate) providers: Vec<WorkspaceDiagnosticsProviderStatus>,
    pub(crate) generated_at_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) reason: Option<String>,
}

struct ProviderCollectionResult {
    status: WorkspaceDiagnosticsProviderStatus,
    items: Vec<WorkspaceDiagnostic>,
}

struct CommandCapture {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

pub(crate) async fn collect_workspace_diagnostics(
    workspace_path: &Path,
    query: &WorkspaceDiagnosticsQuery,
) -> WorkspaceDiagnosticsListResponse {
    let normalized_query = WorkspaceDiagnosticsQuery {
        paths: normalize_requested_paths(query.paths.as_slice()),
        severities: query.severities.clone(),
        max_items: query.max_items,
        include_provider_details: query.include_provider_details,
    };

    let native_result = ProviderCollectionResult {
        status: WorkspaceDiagnosticsProviderStatus {
            id: WorkspaceDiagnosticsProviderId::Native,
            status: WorkspaceDiagnosticsProviderState::Unavailable,
            duration_ms: None,
            message: Some("Native workspace diagnostics provider is not configured.".to_string()),
        },
        items: Vec::new(),
    };

    let (cargo_result, oxlint_result, tsc_result) = tokio::join!(
        collect_cargo_diagnostics(workspace_path, &normalized_query),
        collect_oxlint_diagnostics(workspace_path, &normalized_query),
        collect_tsc_diagnostics(workspace_path, &normalized_query),
    );

    build_workspace_diagnostics_response(
        &normalized_query,
        vec![native_result, cargo_result, oxlint_result, tsc_result],
    )
}

fn normalize_requested_paths(paths: &[String]) -> Vec<String> {
    let mut unique = BTreeSet::new();
    for path in paths {
        let trimmed = path.trim().trim_start_matches("./");
        if !trimmed.is_empty() {
            unique.insert(trimmed.replace('\\', "/"));
        }
    }
    unique.into_iter().collect()
}

fn summarize_diagnostics(items: &[WorkspaceDiagnostic]) -> WorkspaceDiagnosticsSummary {
    let mut summary = WorkspaceDiagnosticsSummary {
        error_count: 0,
        warning_count: 0,
        info_count: 0,
        hint_count: 0,
        total: items.len() as u64,
    };
    for item in items {
        match item.severity {
            WorkspaceDiagnosticSeverity::Error => summary.error_count += 1,
            WorkspaceDiagnosticSeverity::Warning => summary.warning_count += 1,
            WorkspaceDiagnosticSeverity::Info => summary.info_count += 1,
            WorkspaceDiagnosticSeverity::Hint => summary.hint_count += 1,
        }
    }
    summary
}

fn build_workspace_diagnostics_response(
    query: &WorkspaceDiagnosticsQuery,
    mut provider_results: Vec<ProviderCollectionResult>,
) -> WorkspaceDiagnosticsListResponse {
    let mut dedupe = HashSet::new();
    let mut merged_items = Vec::new();

    for provider_result in &provider_results {
        for item in &provider_result.items {
            if dedupe.insert(item.clone()) {
                merged_items.push(item.clone());
            }
        }
    }

    if !query.severities.is_empty() {
        merged_items.retain(|item| query.severities.contains(&item.severity));
    }

    merged_items.sort_by(|left, right| {
        left.severity
            .rank()
            .cmp(&right.severity.rank())
            .then_with(|| left.path.cmp(&right.path))
            .then_with(|| left.start_line.cmp(&right.start_line))
            .then_with(|| left.start_column.cmp(&right.start_column))
            .then_with(|| left.source.cmp(&right.source))
            .then_with(|| left.message.cmp(&right.message))
    });

    if let Some(max_items) = query.max_items {
        merged_items.truncate(max_items);
    }

    let provider_used = provider_results
        .iter()
        .any(|entry| entry.status.status == WorkspaceDiagnosticsProviderState::Used);
    let available = provider_used || !merged_items.is_empty();
    let reason = if available {
        None
    } else {
        provider_results
            .iter()
            .find_map(|entry| entry.status.message.clone())
            .or_else(|| Some("No workspace diagnostics providers were available.".to_string()))
    };

    let mut providers = provider_results
        .drain(..)
        .map(|entry| entry.status)
        .collect::<Vec<_>>();
    if !query.include_provider_details {
        for provider in &mut providers {
            provider.duration_ms = None;
            provider.message = None;
        }
    }

    WorkspaceDiagnosticsListResponse {
        available,
        summary: summarize_diagnostics(merged_items.as_slice()),
        items: merged_items,
        providers,
        generated_at_ms: now_ms(),
        reason,
    }
}

async fn collect_cargo_diagnostics(
    workspace_path: &Path,
    query: &WorkspaceDiagnosticsQuery,
) -> ProviderCollectionResult {
    let manifests = resolve_cargo_manifest_roots(workspace_path, query.paths.as_slice());
    if manifests.is_empty() {
        return ProviderCollectionResult {
            status: WorkspaceDiagnosticsProviderStatus {
                id: WorkspaceDiagnosticsProviderId::CargoCheck,
                status: WorkspaceDiagnosticsProviderState::Skipped,
                duration_ms: None,
                message: Some(
                    "No Cargo.toml target matched the requested workspace diagnostics scope."
                        .to_string(),
                ),
            },
            items: Vec::new(),
        };
    }

    let started_at = now_ms();
    let mut items = Vec::new();
    for manifest_dir in manifests {
        let args = vec![
            "check".to_string(),
            "--message-format=json".to_string(),
            "-q".to_string(),
        ];
        match run_command("cargo", args.as_slice(), manifest_dir.as_path()).await {
            Ok(output) => {
                let parsed = parse_cargo_check_output(
                    output.stdout.as_str(),
                    manifest_dir.as_path(),
                    workspace_path,
                );
                if parsed.is_empty()
                    && output.exit_code.unwrap_or_default() != 0
                    && !output.stderr.trim().is_empty()
                {
                    return ProviderCollectionResult {
                        status: WorkspaceDiagnosticsProviderStatus {
                            id: WorkspaceDiagnosticsProviderId::CargoCheck,
                            status: WorkspaceDiagnosticsProviderState::Failed,
                            duration_ms: Some(now_ms().saturating_sub(started_at)),
                            message: Some(truncate_command_error(
                                "cargo check failed",
                                output.stderr.as_str(),
                            )),
                        },
                        items: Vec::new(),
                    };
                }
                items.extend(parsed);
            }
            Err(error) => {
                return ProviderCollectionResult {
                    status: WorkspaceDiagnosticsProviderStatus {
                        id: WorkspaceDiagnosticsProviderId::CargoCheck,
                        status: WorkspaceDiagnosticsProviderState::Unavailable,
                        duration_ms: Some(now_ms().saturating_sub(started_at)),
                        message: Some(error),
                    },
                    items: Vec::new(),
                };
            }
        }
    }

    ProviderCollectionResult {
        status: WorkspaceDiagnosticsProviderStatus {
            id: WorkspaceDiagnosticsProviderId::CargoCheck,
            status: WorkspaceDiagnosticsProviderState::Used,
            duration_ms: Some(now_ms().saturating_sub(started_at)),
            message: Some(format!(
                "Collected cargo diagnostics from {} manifest(s).",
                items.len().max(1)
            )),
        },
        items: filter_diagnostics_by_paths(items, query.paths.as_slice()),
    }
}

async fn collect_oxlint_diagnostics(
    workspace_path: &Path,
    query: &WorkspaceDiagnosticsQuery,
) -> ProviderCollectionResult {
    if !workspace_path.join("package.json").exists() {
        return ProviderCollectionResult {
            status: WorkspaceDiagnosticsProviderStatus {
                id: WorkspaceDiagnosticsProviderId::Oxlint,
                status: WorkspaceDiagnosticsProviderState::Skipped,
                duration_ms: None,
                message: Some("Workspace root does not include package.json.".to_string()),
            },
            items: Vec::new(),
        };
    }

    let started_at = now_ms();
    let mut args = vec!["exec".to_string(), "oxlint".to_string()];
    if query.paths.is_empty() {
        args.push(".".to_string());
    } else {
        args.extend(query.paths.iter().cloned());
    }
    args.extend(["--format".to_string(), "json".to_string()]);

    match run_command("pnpm", args.as_slice(), workspace_path).await {
        Ok(output) => {
            let items = parse_oxlint_output(output.stdout.as_str());
            if items.is_empty()
                && output.exit_code.unwrap_or_default() != 0
                && !output.stderr.trim().is_empty()
            {
                return ProviderCollectionResult {
                    status: WorkspaceDiagnosticsProviderStatus {
                        id: WorkspaceDiagnosticsProviderId::Oxlint,
                        status: WorkspaceDiagnosticsProviderState::Failed,
                        duration_ms: Some(now_ms().saturating_sub(started_at)),
                        message: Some(truncate_command_error(
                            "oxlint failed",
                            output.stderr.as_str(),
                        )),
                    },
                    items: Vec::new(),
                };
            }
            ProviderCollectionResult {
                status: WorkspaceDiagnosticsProviderStatus {
                    id: WorkspaceDiagnosticsProviderId::Oxlint,
                    status: WorkspaceDiagnosticsProviderState::Used,
                    duration_ms: Some(now_ms().saturating_sub(started_at)),
                    message: Some("Collected oxlint diagnostics.".to_string()),
                },
                items: filter_diagnostics_by_paths(items, query.paths.as_slice()),
            }
        }
        Err(error) => ProviderCollectionResult {
            status: WorkspaceDiagnosticsProviderStatus {
                id: WorkspaceDiagnosticsProviderId::Oxlint,
                status: WorkspaceDiagnosticsProviderState::Unavailable,
                duration_ms: Some(now_ms().saturating_sub(started_at)),
                message: Some(error),
            },
            items: Vec::new(),
        },
    }
}

async fn collect_tsc_diagnostics(
    workspace_path: &Path,
    query: &WorkspaceDiagnosticsQuery,
) -> ProviderCollectionResult {
    let configs = resolve_tsconfig_paths(workspace_path, query.paths.as_slice());
    if configs.is_empty() {
        return ProviderCollectionResult {
            status: WorkspaceDiagnosticsProviderStatus {
                id: WorkspaceDiagnosticsProviderId::Tsc,
                status: WorkspaceDiagnosticsProviderState::Skipped,
                duration_ms: None,
                message: Some(
                    "No tsconfig.json target matched the requested workspace diagnostics scope."
                        .to_string(),
                ),
            },
            items: Vec::new(),
        };
    }

    let started_at = now_ms();
    let mut items = Vec::new();
    for config_path in configs {
        let args = vec![
            "exec".to_string(),
            "tsc".to_string(),
            "-p".to_string(),
            normalize_relative_path(workspace_path, config_path.as_path()),
            "--noEmit".to_string(),
            "--pretty".to_string(),
            "false".to_string(),
        ];
        match run_command("pnpm", args.as_slice(), workspace_path).await {
            Ok(output) => {
                let parsed = parse_tsc_output(output.stdout.as_str(), workspace_path);
                if parsed.is_empty()
                    && output.exit_code.unwrap_or_default() != 0
                    && !output.stderr.trim().is_empty()
                {
                    return ProviderCollectionResult {
                        status: WorkspaceDiagnosticsProviderStatus {
                            id: WorkspaceDiagnosticsProviderId::Tsc,
                            status: WorkspaceDiagnosticsProviderState::Failed,
                            duration_ms: Some(now_ms().saturating_sub(started_at)),
                            message: Some(truncate_command_error(
                                "tsc failed",
                                output.stderr.as_str(),
                            )),
                        },
                        items: Vec::new(),
                    };
                }
                items.extend(parsed);
            }
            Err(error) => {
                return ProviderCollectionResult {
                    status: WorkspaceDiagnosticsProviderStatus {
                        id: WorkspaceDiagnosticsProviderId::Tsc,
                        status: WorkspaceDiagnosticsProviderState::Unavailable,
                        duration_ms: Some(now_ms().saturating_sub(started_at)),
                        message: Some(error),
                    },
                    items: Vec::new(),
                };
            }
        }
    }

    ProviderCollectionResult {
        status: WorkspaceDiagnosticsProviderStatus {
            id: WorkspaceDiagnosticsProviderId::Tsc,
            status: WorkspaceDiagnosticsProviderState::Used,
            duration_ms: Some(now_ms().saturating_sub(started_at)),
            message: Some("Collected TypeScript diagnostics.".to_string()),
        },
        items: filter_diagnostics_by_paths(items, query.paths.as_slice()),
    }
}

async fn run_command(
    executable: &str,
    args: &[String],
    cwd: &Path,
) -> Result<CommandCapture, String> {
    let mut command = TokioCommand::new(executable);
    command
        .args(args)
        .current_dir(cwd)
        .kill_on_drop(true)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    let future = command.output();
    let result = timeout(
        Duration::from_millis(WORKSPACE_DIAGNOSTICS_PROVIDER_TIMEOUT_MS),
        future,
    )
    .await
    .map_err(|_| {
        format!("{executable} timed out after {WORKSPACE_DIAGNOSTICS_PROVIDER_TIMEOUT_MS}ms.")
    })?
    .map_err(|error| format!("Failed to run {executable}: {error}"))?;

    Ok(CommandCapture {
        exit_code: result.status.code(),
        stdout: String::from_utf8_lossy(result.stdout.as_slice()).to_string(),
        stderr: String::from_utf8_lossy(result.stderr.as_slice()).to_string(),
    })
}

fn resolve_cargo_manifest_roots(workspace_path: &Path, paths: &[String]) -> Vec<PathBuf> {
    let mut unique = BTreeSet::new();
    if paths.is_empty() {
        let root_manifest = workspace_path.join("Cargo.toml");
        if root_manifest.exists() {
            unique.insert(workspace_path.to_path_buf());
        }
        return unique.into_iter().collect();
    }

    for requested_path in paths {
        let absolute = workspace_path.join(requested_path);
        let anchor = if absolute.is_dir() {
            absolute
        } else {
            absolute
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| workspace_path.to_path_buf())
        };
        if let Some(manifest_dir) = find_upwards(anchor.as_path(), workspace_path, "Cargo.toml") {
            unique.insert(manifest_dir);
        }
    }
    unique.into_iter().collect()
}

fn resolve_tsconfig_paths(workspace_path: &Path, paths: &[String]) -> Vec<PathBuf> {
    let mut unique = BTreeSet::new();
    if paths.is_empty() {
        let root_config = workspace_path.join("tsconfig.json");
        if root_config.exists() {
            unique.insert(root_config);
        }
        return unique.into_iter().collect();
    }

    for requested_path in paths {
        let absolute = workspace_path.join(requested_path);
        let anchor = if absolute.is_dir() {
            absolute
        } else {
            absolute
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| workspace_path.to_path_buf())
        };
        if let Some(config_path) =
            find_file_upwards(anchor.as_path(), workspace_path, "tsconfig.json")
        {
            unique.insert(config_path);
        }
    }
    unique.into_iter().collect()
}

fn find_upwards(start: &Path, root: &Path, file_name: &str) -> Option<PathBuf> {
    let mut current = Some(start);
    while let Some(path) = current {
        let candidate = path.join(file_name);
        if candidate.exists() {
            return Some(path.to_path_buf());
        }
        if path == root {
            break;
        }
        current = path.parent();
    }
    None
}

fn find_file_upwards(start: &Path, root: &Path, file_name: &str) -> Option<PathBuf> {
    find_upwards(start, root, file_name).map(|dir| dir.join(file_name))
}

fn filter_diagnostics_by_paths(
    items: Vec<WorkspaceDiagnostic>,
    paths: &[String],
) -> Vec<WorkspaceDiagnostic> {
    if paths.is_empty() {
        return items;
    }
    items
        .into_iter()
        .filter(|item| {
            paths.iter().any(|path| {
                item.path == *path
                    || item.path.starts_with(format!("{path}/").as_str())
                    || path.starts_with(format!("{}/", item.path).as_str())
            })
        })
        .collect()
}

fn normalize_relative_path(workspace_path: &Path, path: &Path) -> String {
    path.strip_prefix(workspace_path)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn truncate_command_error(prefix: &str, stderr: &str) -> String {
    let trimmed = stderr.trim();
    if trimmed.is_empty() {
        return prefix.to_string();
    }
    let line = trimmed
        .lines()
        .find(|entry| !entry.trim().is_empty())
        .unwrap_or(trimmed);
    let snippet = line.chars().take(240).collect::<String>();
    format!("{prefix}: {snippet}")
}

fn parse_cargo_check_output(
    stdout: &str,
    manifest_dir: &Path,
    workspace_path: &Path,
) -> Vec<WorkspaceDiagnostic> {
    let mut items = Vec::new();
    for line in stdout.lines() {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if value.get("reason").and_then(Value::as_str) != Some("compiler-message") {
            continue;
        }
        let Some(message) = value.get("message") else {
            continue;
        };
        let Some(level) = message.get("level").and_then(Value::as_str) else {
            continue;
        };
        let Some(severity) = WorkspaceDiagnosticSeverity::from_level(level) else {
            continue;
        };
        let Some(message_text) = message.get("message").and_then(Value::as_str) else {
            continue;
        };
        let code = message
            .get("code")
            .and_then(Value::as_object)
            .and_then(|entry| entry.get("code"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let spans = message
            .get("spans")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let span = spans
            .iter()
            .find(|entry| {
                entry
                    .get("is_primary")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
            })
            .or_else(|| spans.first());
        let Some(span) = span else {
            continue;
        };
        let file_name = span
            .get("file_name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if file_name.is_empty() {
            continue;
        }
        let absolute_path = if Path::new(file_name).is_absolute() {
            PathBuf::from(file_name)
        } else {
            manifest_dir.join(file_name)
        };
        items.push(WorkspaceDiagnostic {
            path: normalize_relative_path(workspace_path, absolute_path.as_path()),
            severity,
            message: message_text.to_string(),
            source: "cargo-check".to_string(),
            code,
            start_line: span.get("line_start").and_then(Value::as_u64).unwrap_or(1),
            start_column: span
                .get("column_start")
                .and_then(Value::as_u64)
                .unwrap_or(1),
            end_line: span.get("line_end").and_then(Value::as_u64).unwrap_or(1),
            end_column: span.get("column_end").and_then(Value::as_u64).unwrap_or(1),
        });
    }
    items
}

fn parse_oxlint_output(stdout: &str) -> Vec<WorkspaceDiagnostic> {
    let Ok(value) = serde_json::from_str::<Value>(stdout) else {
        return Vec::new();
    };
    let diagnostics = value
        .get("diagnostics")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut items = Vec::new();
    for entry in diagnostics {
        let Some(message) = entry.get("message").and_then(Value::as_str) else {
            continue;
        };
        let Some(severity) = entry
            .get("severity")
            .and_then(Value::as_str)
            .and_then(WorkspaceDiagnosticSeverity::from_level)
        else {
            continue;
        };
        let Some(path) = entry.get("filename").and_then(Value::as_str) else {
            continue;
        };
        let label = entry
            .get("labels")
            .and_then(Value::as_array)
            .and_then(|labels| labels.first())
            .and_then(Value::as_object);
        let span = label
            .and_then(|label| label.get("span"))
            .and_then(Value::as_object);
        let start_line = span
            .and_then(|span| span.get("line"))
            .and_then(Value::as_u64)
            .unwrap_or(1);
        let start_column = span
            .and_then(|span| span.get("column"))
            .and_then(Value::as_u64)
            .unwrap_or(1);
        let length = span
            .and_then(|span| span.get("length"))
            .and_then(Value::as_u64)
            .unwrap_or(1);
        items.push(WorkspaceDiagnostic {
            path: path.replace('\\', "/"),
            severity,
            message: message.to_string(),
            source: "oxlint".to_string(),
            code: entry
                .get("code")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned),
            start_line,
            start_column,
            end_line: start_line,
            end_column: start_column.saturating_add(length),
        });
    }
    items
}

fn parse_tsc_output(stdout: &str, workspace_path: &Path) -> Vec<WorkspaceDiagnostic> {
    let mut items = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Some(paren_index) = trimmed.rfind('(') else {
            continue;
        };
        let Some(location_end) = trimmed[paren_index..].find("): ") else {
            continue;
        };
        let path = trimmed[..paren_index].trim();
        let location = &trimmed[(paren_index + 1)..(paren_index + location_end)];
        let rest = &trimmed[(paren_index + location_end + 3)..];
        let mut location_parts = location.split(',');
        let start_line = location_parts
            .next()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(1);
        let start_column = location_parts
            .next()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(1);
        let (severity, code, message) = if let Some(rest) = rest.strip_prefix("error ") {
            let mut split = rest.splitn(2, ':');
            let code = split.next().map(str::trim).unwrap_or_default();
            let message = split.next().map(str::trim).unwrap_or_default();
            (
                WorkspaceDiagnosticSeverity::Error,
                if code.is_empty() {
                    None
                } else {
                    Some(code.to_string())
                },
                message.to_string(),
            )
        } else if let Some(rest) = rest.strip_prefix("warning ") {
            let mut split = rest.splitn(2, ':');
            let code = split.next().map(str::trim).unwrap_or_default();
            let message = split.next().map(str::trim).unwrap_or_default();
            (
                WorkspaceDiagnosticSeverity::Warning,
                if code.is_empty() {
                    None
                } else {
                    Some(code.to_string())
                },
                message.to_string(),
            )
        } else {
            continue;
        };
        let normalized_path = if Path::new(path).is_absolute() {
            normalize_relative_path(workspace_path, Path::new(path))
        } else {
            path.replace('\\', "/")
        };
        items.push(WorkspaceDiagnostic {
            path: normalized_path,
            severity,
            message,
            source: "tsc".to_string(),
            code,
            start_line,
            start_column,
            end_line: start_line,
            end_column: start_column,
        });
    }
    items
}

pub(crate) async fn list_workspace_diagnostics(
    workspace_id: &str,
    workspace_path: &Path,
    request: &WorkspaceDiagnosticsListRequest,
) -> WorkspaceDiagnosticsListResponse {
    let _ = workspace_id;
    let query = WorkspaceDiagnosticsQuery::from_request(request);
    collect_workspace_diagnostics(workspace_path, &query).await
}

#[allow(dead_code)]
pub(crate) fn summarize_workspace_diagnostics(
    response: &WorkspaceDiagnosticsListResponse,
) -> String {
    if !response.available {
        return response
            .reason
            .clone()
            .unwrap_or_else(|| "Workspace diagnostics are unavailable.".to_string());
    }
    if response.items.is_empty() {
        return "No workspace diagnostics found.".to_string();
    }

    let mut lines = vec![format!(
        "{} diagnostics: {} error, {} warning, {} info, {} hint.",
        response.summary.total,
        response.summary.error_count,
        response.summary.warning_count,
        response.summary.info_count,
        response.summary.hint_count
    )];
    for item in response.items.iter().take(25) {
        let severity = match item.severity {
            WorkspaceDiagnosticSeverity::Error => "error",
            WorkspaceDiagnosticSeverity::Warning => "warning",
            WorkspaceDiagnosticSeverity::Info => "info",
            WorkspaceDiagnosticSeverity::Hint => "hint",
        };
        let code = item
            .code
            .as_deref()
            .map(|value| format!(" {value}"))
            .unwrap_or_default();
        lines.push(format!(
            "[{}{}] {}:{}:{} {}",
            severity, code, item.path, item.start_line, item.start_column, item.message
        ));
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn diagnostic(
        path: &str,
        severity: WorkspaceDiagnosticSeverity,
        message: &str,
        source: &str,
    ) -> WorkspaceDiagnostic {
        WorkspaceDiagnostic {
            path: path.to_string(),
            severity,
            message: message.to_string(),
            source: source.to_string(),
            code: None,
            start_line: 1,
            start_column: 1,
            end_line: 1,
            end_column: 1,
        }
    }

    fn provider_result(
        id: WorkspaceDiagnosticsProviderId,
        status: WorkspaceDiagnosticsProviderState,
        message: &str,
        items: Vec<WorkspaceDiagnostic>,
    ) -> ProviderCollectionResult {
        ProviderCollectionResult {
            status: WorkspaceDiagnosticsProviderStatus {
                id,
                status,
                duration_ms: Some(25),
                message: Some(message.to_string()),
            },
            items,
        }
    }

    #[test]
    fn diagnostics_request_deserializes_with_alias_fields() {
        let request: WorkspaceDiagnosticsListRequest = serde_json::from_value(json!({
            "workspace_id": "ws-1",
            "paths": ["apps/code/src"],
            "severities": ["error", "warning"],
            "max_items": 5,
            "include_provider_details": true,
        }))
        .expect("workspace diagnostics request");

        assert_eq!(request.workspace_id, "ws-1");
        assert_eq!(request.paths, Some(vec!["apps/code/src".to_string()]));
        assert_eq!(
            request.severities,
            Some(vec![
                WorkspaceDiagnosticSeverity::Error,
                WorkspaceDiagnosticSeverity::Warning,
            ])
        );
        assert_eq!(request.max_items, Some(5));
        assert_eq!(request.include_provider_details, Some(true));
    }

    #[test]
    fn parse_oxlint_output_extracts_diagnostics() {
        let stdout = r#"{ "diagnostics": [{"message": "Unexpected token","severity": "error","causes": [],"filename": ".tmp/diagnostics-samples/bad.ts","labels": [{"span": {"offset": 10,"length": 1,"line": 1,"column": 11}}],"related": []}],
              "number_of_files": 1,
              "number_of_rules": 108 }"#;
        let items = parse_oxlint_output(stdout);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, ".tmp/diagnostics-samples/bad.ts");
        assert_eq!(items[0].severity, WorkspaceDiagnosticSeverity::Error);
        assert_eq!(items[0].start_line, 1);
        assert_eq!(items[0].start_column, 11);
        assert_eq!(items[0].end_column, 12);
    }

    #[test]
    fn parse_tsc_output_extracts_diagnostics() {
        let stdout =
            ".tmp/diagnostics-samples/tsc/bad.ts(1,7): error TS2322: Type 'number' is not assignable to type 'string'.";
        let items = parse_tsc_output(stdout, Path::new("."));
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, ".tmp/diagnostics-samples/tsc/bad.ts");
        assert_eq!(items[0].code.as_deref(), Some("TS2322"));
        assert_eq!(items[0].start_line, 1);
        assert_eq!(items[0].start_column, 7);
    }

    #[test]
    fn parse_cargo_check_output_extracts_diagnostics() {
        let stdout = r#"{"reason":"compiler-message","package_id":"path+file:///tmp/diag#diag@0.1.0","manifest_path":"/tmp/diag/Cargo.toml","target":{"kind":["bin"],"crate_types":["bin"],"name":"diag","src_path":"/tmp/diag/src/main.rs","edition":"2021","doc":true,"doctest":false,"test":true},"message":{"rendered":"error[E0308]: mismatched types\n --> src/main.rs:1:27\n","$message_type":"diagnostic","children":[],"level":"error","message":"mismatched types","spans":[{"byte_end":27,"byte_start":26,"column_end":28,"column_start":27,"expansion":null,"file_name":"src/main.rs","is_primary":true,"label":"expected `&str`, found integer","line_end":1,"line_start":1,"suggested_replacement":null,"suggestion_applicability":null,"text":[{"highlight_end":28,"highlight_start":27,"text":"fn main() { let x: &str = 1; }"}]}],"code":{"code":"E0308","explanation":"..."}}}"#;
        let items = parse_cargo_check_output(stdout, Path::new("/tmp/diag"), Path::new("/tmp"));
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "diag/src/main.rs");
        assert_eq!(items[0].code.as_deref(), Some("E0308"));
        assert_eq!(items[0].severity, WorkspaceDiagnosticSeverity::Error);
    }

    #[test]
    fn filter_diagnostics_by_paths_limits_results() {
        let items = vec![
            diagnostic(
                "apps/code/src/main.ts",
                WorkspaceDiagnosticSeverity::Error,
                "first",
                "oxlint",
            ),
            diagnostic(
                "packages/x/src/main.rs",
                WorkspaceDiagnosticSeverity::Error,
                "second",
                "cargo-check",
            ),
        ];
        let filtered = filter_diagnostics_by_paths(items, &["apps/code".to_string()]);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].path, "apps/code/src/main.ts");
    }

    #[test]
    fn build_workspace_diagnostics_response_keeps_partial_failures_and_filters_results() {
        let query = WorkspaceDiagnosticsQuery {
            paths: vec![],
            severities: vec![WorkspaceDiagnosticSeverity::Error],
            max_items: Some(1),
            include_provider_details: false,
        };
        let response = build_workspace_diagnostics_response(
            &query,
            vec![
                provider_result(
                    WorkspaceDiagnosticsProviderId::CargoCheck,
                    WorkspaceDiagnosticsProviderState::Used,
                    "cargo ok",
                    vec![
                        diagnostic(
                            "packages/runtime/src/lib.rs",
                            WorkspaceDiagnosticSeverity::Warning,
                            "unused import",
                            "cargo-check",
                        ),
                        diagnostic(
                            "packages/runtime/src/lib.rs",
                            WorkspaceDiagnosticSeverity::Error,
                            "type mismatch",
                            "cargo-check",
                        ),
                    ],
                ),
                provider_result(
                    WorkspaceDiagnosticsProviderId::Oxlint,
                    WorkspaceDiagnosticsProviderState::Failed,
                    "oxlint failed",
                    Vec::new(),
                ),
                provider_result(
                    WorkspaceDiagnosticsProviderId::Tsc,
                    WorkspaceDiagnosticsProviderState::Used,
                    "tsc ok",
                    vec![diagnostic(
                        "apps/code/src/app.ts",
                        WorkspaceDiagnosticSeverity::Error,
                        "cannot find name",
                        "tsc",
                    )],
                ),
            ],
        );

        assert!(response.available);
        assert_eq!(response.summary.total, 1);
        assert_eq!(response.summary.error_count, 1);
        assert_eq!(response.providers.len(), 3);
        assert_eq!(
            response.providers[1].status,
            WorkspaceDiagnosticsProviderState::Failed
        );
        assert_eq!(response.providers[0].duration_ms, None);
        assert_eq!(response.providers[1].message, None);
        assert_eq!(
            response.items[0].severity,
            WorkspaceDiagnosticSeverity::Error
        );
    }

    #[test]
    fn build_workspace_diagnostics_response_reports_unavailable_reason() {
        let query = WorkspaceDiagnosticsQuery {
            paths: vec![],
            severities: vec![],
            max_items: None,
            include_provider_details: true,
        };
        let response = build_workspace_diagnostics_response(
            &query,
            vec![
                provider_result(
                    WorkspaceDiagnosticsProviderId::Native,
                    WorkspaceDiagnosticsProviderState::Unavailable,
                    "native unavailable",
                    Vec::new(),
                ),
                provider_result(
                    WorkspaceDiagnosticsProviderId::CargoCheck,
                    WorkspaceDiagnosticsProviderState::Skipped,
                    "no Cargo.toml",
                    Vec::new(),
                ),
            ],
        );

        assert!(!response.available);
        assert_eq!(response.summary.total, 0);
        assert_eq!(response.reason.as_deref(), Some("native unavailable"));
        assert_eq!(
            response.providers[0].message.as_deref(),
            Some("native unavailable")
        );
    }

    #[test]
    fn summarize_workspace_diagnostics_formats_summary_and_items() {
        let response = WorkspaceDiagnosticsListResponse {
            available: true,
            summary: WorkspaceDiagnosticsSummary {
                error_count: 1,
                warning_count: 0,
                info_count: 0,
                hint_count: 0,
                total: 1,
            },
            items: vec![WorkspaceDiagnostic {
                code: Some("TS2322".to_string()),
                ..diagnostic(
                    "apps/code/src/main.ts",
                    WorkspaceDiagnosticSeverity::Error,
                    "Type 'number' is not assignable to type 'string'.",
                    "tsc",
                )
            }],
            providers: vec![],
            generated_at_ms: 0,
            reason: None,
        };

        let summary = summarize_workspace_diagnostics(&response);

        assert!(summary.contains("1 diagnostics: 1 error, 0 warning, 0 info, 0 hint."));
        assert!(summary.contains("[error TS2322] apps/code/src/main.ts:1:1"));
    }

    #[test]
    fn truncate_command_error_compacts_stderr() {
        let message = truncate_command_error(
            "tsc failed",
            "\n\nfirst line of stderr\nsecond line that should not be used",
        );
        assert_eq!(message, "tsc failed: first line of stderr");
    }
}
