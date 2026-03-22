use crate::backend::{
    current_runtime_state_path_display, current_terminal_shell_command_line,
    current_terminal_shell_source, runtime_backend,
};
use crate::commands::health::code_health;
use crate::commands::policy::require_runtime_diagnostics_export_enabled;
use crate::commands::rpc::code_rpc_capabilities;
use crate::commands::terminal;
use crate::instruction_skills_watcher;
use crate::runtime_service;
use ku0_runtime_diagnostics_export_core::{
    build_runtime_diagnostics_export, parse_runtime_diagnostics_redaction_level,
    RuntimeDiagnosticsExportBuildInput, RuntimeDiagnosticsRedactionStats,
    RuntimeDiagnosticsSection, RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone, Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RuntimeDiagnosticsExportRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: Option<String>,
    #[serde(alias = "redaction_level")]
    redaction_level: Option<String>,
    #[serde(alias = "include_task_summaries")]
    include_task_summaries: Option<bool>,
    #[serde(alias = "include_event_tail")]
    include_event_tail: Option<bool>,
    #[serde(alias = "include_zip_base64")]
    include_zip_base64: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiagnosticsExportResponse {
    schema_version: &'static str,
    exported_at: u64,
    source: &'static str,
    redaction_level: String,
    filename: String,
    mime_type: &'static str,
    size_bytes: u64,
    zip_base64: Option<String>,
    sections: Vec<String>,
    warnings: Vec<String>,
    redaction_stats: RuntimeDiagnosticsRedactionStats,
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
        .try_into()
        .unwrap_or(u64::MAX)
}

fn push_unique_warning(warnings: &mut Vec<String>, warning: impl Into<String>) {
    let warning = warning.into();
    if warning.trim().is_empty() || warnings.iter().any(|entry| entry == &warning) {
        return;
    }
    warnings.push(warning);
}

fn runtime_agent_task_summaries_payload(workspace_id: Option<&str>) -> Result<Vec<Value>, String> {
    let payload = tauri::async_runtime::block_on(runtime_service::invoke_runtime_rpc(
        "code_runtime_runs_list",
        json!({
            "workspaceId": workspace_id,
        }),
    ))?;
    let Value::Array(tasks) = payload else {
        return Err("runtime agent task summaries payload must be an array".to_string());
    };
    Ok(tasks)
}

fn event_tail_availability_payload() -> Value {
    json!({
        "available": true,
        "liveStreamAvailable": true,
        "replayAvailable": true,
        "relay": "tauri-embedded-runtime",
        "reason": "embedded-runtime-live-and-replay"
    })
}

fn build_runtime_diagnostics_payload(
    workspace_id: Option<&str>,
    include_task_summaries: bool,
    include_event_tail: bool,
    warnings: &mut Vec<String>,
) -> Value {
    let computed = std::panic::catch_unwind(|| {
        let backend = runtime_backend();
        let workspaces = backend.workspaces();
        let selected_workspace = workspace_id.and_then(|expected| {
            workspaces
                .iter()
                .find(|workspace| workspace.id == expected)
                .map(|workspace| workspace.id.clone())
        });

        let mut local_warnings = Vec::new();
        if workspace_id.is_some() && selected_workspace.is_none() {
            push_unique_warning(
                &mut local_warnings,
                "Requested workspace does not exist in desktop runtime state; using global diagnostics aggregate.",
            );
        }

        let mut thread_total = 0usize;
        let mut thread_running = 0usize;
        let mut thread_archived = 0usize;
        let mut thread_unread = 0usize;
        let mut sampled_threads: Vec<Value> = Vec::new();

        let iter_workspace_ids = selected_workspace
            .clone()
            .map(|workspace| vec![workspace])
            .unwrap_or_else(|| {
                workspaces
                    .iter()
                    .map(|workspace| workspace.id.clone())
                    .collect::<Vec<_>>()
            });
        for workspace_id in iter_workspace_ids {
            let threads = backend.threads(workspace_id.as_str());
            for thread in threads {
                thread_total += 1;
                if thread.running {
                    thread_running += 1;
                }
                if thread.archived {
                    thread_archived += 1;
                }
                if thread.unread {
                    thread_unread += 1;
                }
                if include_task_summaries && sampled_threads.len() < 128 {
                    sampled_threads.push(json!({
                        "threadId": thread.id,
                        "workspaceId": thread.workspace_id,
                        "status": thread.status,
                        "running": thread.running,
                        "archived": thread.archived,
                        "updatedAt": thread.updated_at,
                    }));
                }
            }
        }

        let agent_task_summaries = if include_task_summaries {
            match runtime_agent_task_summaries_payload(selected_workspace.as_deref()) {
                Ok(tasks) => tasks,
                Err(error) => {
                    push_unique_warning(
                        &mut local_warnings,
                        format!(
                            "Desktop runtime failed to collect agent task summaries; exporting thread-level summaries only: {error}"
                        ),
                    );
                    Vec::new()
                }
            }
        } else {
            Vec::new()
        };
        let agent_task_running = agent_task_summaries
            .iter()
            .filter(|task| task.get("status").and_then(Value::as_str) == Some("running"))
            .count();
        let agent_task_review_ready = agent_task_summaries
            .iter()
            .filter(|task| task.get("status").and_then(Value::as_str) == Some("completed"))
            .count();
        if include_event_tail {
            push_unique_warning(
                &mut local_warnings,
                "Desktop runtime exports live event availability metadata and embedded replay support; diagnostics export still summarizes availability instead of embedding event payload tails.",
            );
        }

        (
            json!({
                "workspaceId": selected_workspace.or_else(|| workspace_id.map(str::to_string)),
                "workspaceCount": workspaces.len(),
                "threadCount": thread_total,
                "threadRunningCount": thread_running,
                "threadArchivedCount": thread_archived,
                "threadUnreadCount": thread_unread,
                "remoteStatus": backend.remote_status(),
                "terminalStatus": backend.terminal_status(),
                "terminalStream": terminal::terminal_stream_diagnostics_payload(),
                "stateFabric": backend.state_fabric_diagnostics_payload(),
                "terminalShell": backend.terminal_shell_command_line(),
                "terminalShellSource": backend.terminal_shell_source(),
                "runtimeStatePath": backend.runtime_state_path_display(),
                "fabricHydration": crate::runtime_service::runtime_context_sync_diagnostics_payload(),
                "threadSummaries": sampled_threads,
                "agentTaskCount": agent_task_summaries.len(),
                "agentTaskRunningCount": agent_task_running,
                "agentTaskReviewReadyCount": agent_task_review_ready,
                "agentTaskSummaries": agent_task_summaries,
                "eventTail": event_tail_availability_payload(),
                "instructionSkillsWatcher": instruction_skills_watcher::instruction_skills_watcher_diagnostics_payload()
            }),
            local_warnings,
        )
    });

    match computed {
        Ok((payload, computed_warnings)) => {
            for warning in computed_warnings {
                push_unique_warning(warnings, warning);
            }
            payload
        }
        Err(_) => {
            push_unique_warning(
                warnings,
                "Desktop runtime backend panicked while collecting diagnostics; returning minimal diagnostics payload.",
            );
            json!({
                "workspaceId": workspace_id,
                "available": false,
                "reason": "desktop-runtime-backend-panic",
                "terminalShell": current_terminal_shell_command_line(),
                "terminalShellSource": current_terminal_shell_source(),
                "runtimeStatePath": current_runtime_state_path_display(),
                "fabricHydration": {
                    "backendRevision": 0,
                    "embeddedAppliedRevision": 0,
                    "lastSyncMode": "full",
                    "deltaApplyTotal": 0,
                    "fullResyncTotal": 0,
                    "resyncRequiredTotal": 0,
                    "scope": "desktop-runtime-backend-panic"
                },
                "stateFabric": {
                    "revision": 0,
                    "oldestAvailableRevision": null,
                    "retainedChangeCount": 0,
                    "projectionKeys": ["global", "workspace", "thread", "terminal", "skills"]
                },
                "terminalStream": terminal::terminal_stream_diagnostics_payload(),
                "instructionSkillsWatcher": {
                    "mode": "watch",
                    "watchedRootCount": 0,
                    "workspaceCount": 0,
                    "debounceMs": 350,
                    "fallbackReason": "desktop-runtime-backend-panic"
                }
            })
        }
    }
}

fn build_diagnostics_export(
    request: RuntimeDiagnosticsExportRequest,
) -> Result<RuntimeDiagnosticsExportResponse, String> {
    let redaction_level =
        parse_runtime_diagnostics_redaction_level(request.redaction_level.as_deref())?;
    let workspace_id = request
        .workspace_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let include_task_summaries = request.include_task_summaries.unwrap_or(false);
    let include_event_tail = request.include_event_tail.unwrap_or(true);
    let include_zip_base64 = request.include_zip_base64.unwrap_or(false);

    let exported_at = now_epoch_ms();
    let mut warnings = Vec::new();
    let settings_payload = match std::panic::catch_unwind(|| runtime_backend().settings_summary()) {
        Ok(settings) => serde_json::to_value(settings)
            .map_err(|error| format!("serialize settings payload: {error}"))?,
        Err(_) => {
            push_unique_warning(
                &mut warnings,
                "Desktop runtime backend panicked while reading settings summary; exporting placeholder section.",
            );
            json!({
                "available": false,
                "reason": "desktop-runtime-settings-unavailable"
            })
        }
    };
    let sections = vec![
        RuntimeDiagnosticsSection {
            path: "runtime/capabilities.json".to_string(),
            payload: serde_json::to_value(code_rpc_capabilities())
                .map_err(|error| format!("serialize capabilities payload: {error}"))?,
        },
        RuntimeDiagnosticsSection {
            path: "runtime/health.json".to_string(),
            payload: serde_json::to_value(code_health())
                .map_err(|error| format!("serialize health payload: {error}"))?,
        },
        RuntimeDiagnosticsSection {
            path: "runtime/settings-summary.json".to_string(),
            payload: settings_payload,
        },
        RuntimeDiagnosticsSection {
            path: "runtime/runtime-diagnostics.json".to_string(),
            payload: build_runtime_diagnostics_payload(
                workspace_id.as_deref(),
                include_task_summaries,
                include_event_tail,
                &mut warnings,
            ),
        },
        RuntimeDiagnosticsSection {
            path: "runtime/tool-metrics.json".to_string(),
            payload: json!({
                "available": false,
                "reason": "desktop-runtime-tool-metrics-not-implemented"
            }),
        },
        RuntimeDiagnosticsSection {
            path: "runtime/tool-guardrails.json".to_string(),
            payload: json!({
                "available": false,
                "reason": "desktop-runtime-tool-guardrails-not-implemented"
            }),
        },
        RuntimeDiagnosticsSection {
            path: "runtime/distributed-readiness.json".to_string(),
            payload: json!({
                "available": false,
                "reason": "desktop-runtime-distributed-readiness-not-implemented"
            }),
        },
    ];
    push_unique_warning(
        &mut warnings,
        "Desktop runtime does not currently implement tool metrics snapshots; placeholder section exported.",
    );
    push_unique_warning(
        &mut warnings,
        "Desktop runtime does not currently implement tool guardrail snapshots; placeholder section exported.",
    );
    push_unique_warning(
        &mut warnings,
        "Desktop runtime does not currently implement distributed readiness snapshots; placeholder section exported.",
    );
    let build_output = build_runtime_diagnostics_export(RuntimeDiagnosticsExportBuildInput {
        exported_at,
        source: "tauri",
        redaction_level,
        sections,
        warnings,
        include_zip_base64,
    })?;

    Ok(RuntimeDiagnosticsExportResponse {
        schema_version: RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION,
        exported_at,
        source: "tauri",
        redaction_level: redaction_level.as_str().to_string(),
        filename: build_output.filename,
        mime_type: "application/zip",
        size_bytes: build_output.size_bytes,
        zip_base64: build_output.zip_base64,
        sections: build_output.sections,
        warnings: build_output.warnings,
        redaction_stats: build_output.redaction_stats,
    })
}

#[tauri::command]
pub fn code_runtime_diagnostics_export_v1(
    payload: Option<RuntimeDiagnosticsExportRequest>,
) -> Result<RuntimeDiagnosticsExportResponse, String> {
    require_runtime_diagnostics_export_enabled("code_runtime_diagnostics_export_v1")?;
    build_diagnostics_export(payload.unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::io::{Cursor, Read};
    use std::sync::Mutex;
    use zip::ZipArchive;

    fn diagnostics_env_lock() -> &'static Mutex<()> {
        crate::commands::policy::rpc_policy_env_lock()
    }

    #[test]
    fn diagnostics_export_rejects_when_command_is_disabled() {
        let _guard = diagnostics_env_lock()
            .lock()
            .expect("diagnostics env lock poisoned");
        std::env::remove_var("CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT");

        let error = code_runtime_diagnostics_export_v1(None).expect_err("diagnostics should fail");
        assert_eq!(
            error,
            "Unsupported RPC method: code_runtime_diagnostics_export_v1"
        );
    }

    #[test]
    fn diagnostics_export_defaults_to_metadata_only_when_enabled() {
        let _guard = diagnostics_env_lock()
            .lock()
            .expect("diagnostics env lock poisoned");
        std::env::set_var("CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT", "1");

        let response = code_runtime_diagnostics_export_v1(None).expect("diagnostics export");
        assert_eq!(response.size_bytes, 0);
        assert_eq!(response.zip_base64, None);
        assert!(response
            .warnings
            .iter()
            .any(|entry| entry.contains("includeZipBase64=false")));
    }

    #[test]
    fn diagnostics_export_returns_schema_and_decodable_zip_when_requested() {
        let _guard = diagnostics_env_lock()
            .lock()
            .expect("diagnostics env lock poisoned");
        std::env::set_var("CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT", "1");

        let response = code_runtime_diagnostics_export_v1(Some(RuntimeDiagnosticsExportRequest {
            include_zip_base64: Some(true),
            ..RuntimeDiagnosticsExportRequest::default()
        }))
        .expect("diagnostics export");
        assert_eq!(
            response.schema_version,
            RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION
        );
        assert_eq!(response.source, "tauri");
        assert_eq!(response.mime_type, "application/zip");
        assert!(response.size_bytes > 0);
        assert!(!response.sections.is_empty());
        assert!(response.sections.iter().any(|path| path == "manifest.json"));
        assert!(response
            .sections
            .iter()
            .any(|path| path == "runtime/capabilities.json"));

        let zip_base64 = response
            .zip_base64
            .as_ref()
            .expect("zip base64 should be included");
        let decoded = STANDARD
            .decode(zip_base64.as_bytes())
            .expect("decode base64 zip");
        let cursor = Cursor::new(decoded);
        let mut archive = ZipArchive::new(cursor).expect("open zip archive");
        {
            let mut manifest = archive.by_name("manifest.json").expect("manifest exists");
            let mut manifest_text = String::new();
            manifest
                .read_to_string(&mut manifest_text)
                .expect("read manifest");
            assert!(manifest_text.contains(RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION));
        }

        let mut runtime_diagnostics = archive
            .by_name("runtime/runtime-diagnostics.json")
            .expect("runtime diagnostics exists");
        let mut runtime_diagnostics_text = String::new();
        runtime_diagnostics
            .read_to_string(&mut runtime_diagnostics_text)
            .expect("read runtime diagnostics");
        let runtime_payload: Value =
            serde_json::from_str(runtime_diagnostics_text.as_str()).expect("parse diagnostics");
        assert!(runtime_payload.get("terminalShell").is_some());
        assert!(runtime_payload.get("terminalShellSource").is_some());
        assert!(runtime_payload.get("runtimeStatePath").is_some());
        assert!(
            runtime_payload.get("fabricHydration").is_some(),
            "runtime diagnostics should expose state-fabric hydration as the embedded runtime continuity signal"
        );
        assert!(
            runtime_payload.get("runtimeContextSync").is_none(),
            "runtime diagnostics should expose only the native state fabric control-plane payload"
        );
        let terminal_stream = runtime_payload
            .get("terminalStream")
            .expect("terminal stream payload");
        assert_eq!(
            terminal_stream
                .get("mode")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            "push"
        );
        assert_eq!(
            terminal_stream
                .get("pollFallbackStreamCount")
                .and_then(Value::as_u64),
            Some(0)
        );
        let instruction_skills_watcher = runtime_payload
            .get("instructionSkillsWatcher")
            .expect("instruction skills watcher payload");
        assert_eq!(
            instruction_skills_watcher
                .get("mode")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            "watch"
        );
        assert!(instruction_skills_watcher
            .get("watchedRootCount")
            .and_then(Value::as_u64)
            .is_some());
    }

    #[test]
    fn diagnostics_export_can_omit_zip_base64() {
        let _guard = diagnostics_env_lock()
            .lock()
            .expect("diagnostics env lock poisoned");
        std::env::set_var("CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT", "1");

        let response = code_runtime_diagnostics_export_v1(Some(RuntimeDiagnosticsExportRequest {
            include_zip_base64: Some(false),
            ..RuntimeDiagnosticsExportRequest::default()
        }))
        .expect("diagnostics export");
        assert_eq!(response.size_bytes, 0);
        assert_eq!(response.zip_base64, None);
        assert!(response
            .warnings
            .iter()
            .any(|entry| entry.contains("includeZipBase64=false")));
    }
}
