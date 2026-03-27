#[cfg(test)]
use std::sync::{Mutex, OnceLock};

pub(crate) const CODE_TAURI_ENABLE_TERMINAL_COMMANDS_ENV: &str =
    "CODE_TAURI_ENABLE_TERMINAL_COMMANDS";
pub(crate) const CODE_TAURI_ENABLE_CODEX_COMMANDS_ENV: &str = "CODE_TAURI_ENABLE_CODEX_COMMANDS";
pub(crate) const CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT_ENV: &str =
    "CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT";

pub(crate) fn env_flag_enabled(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_some_and(|value| matches!(value.as_str(), "1" | "true" | "yes" | "on"))
}

pub(crate) fn terminal_commands_enabled() -> bool {
    env_flag_enabled(CODE_TAURI_ENABLE_TERMINAL_COMMANDS_ENV)
}

pub(crate) fn codex_commands_enabled() -> bool {
    env_flag_enabled(CODE_TAURI_ENABLE_CODEX_COMMANDS_ENV)
}

pub(crate) fn runtime_diagnostics_export_enabled() -> bool {
    env_flag_enabled(CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT_ENV)
}

pub(crate) fn method_not_found(method: &str) -> String {
    format!("Unsupported RPC method: {method}")
}

pub(crate) fn require_terminal_commands_enabled(method: &str) -> Result<(), String> {
    if terminal_commands_enabled() {
        Ok(())
    } else {
        Err(method_not_found(method))
    }
}

pub(crate) fn require_codex_commands_enabled(method: &str) -> Result<(), String> {
    if codex_commands_enabled() {
        Ok(())
    } else {
        Err(method_not_found(method))
    }
}

pub(crate) fn require_runtime_diagnostics_export_enabled(method: &str) -> Result<(), String> {
    if runtime_diagnostics_export_enabled() {
        Ok(())
    } else {
        Err(method_not_found(method))
    }
}

pub(crate) fn rpc_method_enabled(method: &str) -> bool {
    match method {
        "code_terminal_open"
        | "code_terminal_write"
        | "code_terminal_input_raw"
        | "code_terminal_read"
        | "code_terminal_interrupt"
        | "code_terminal_resize"
        | "code_terminal_stream_start"
        | "code_terminal_stream_stop"
        | "code_terminal_close" => terminal_commands_enabled(),
        "code_codex_exec_run_v1"
        | "code_codex_cloud_tasks_list_v1"
        | "code_codex_config_path_get_v1"
        | "code_codex_doctor_v1"
        | "code_codex_update_v1"
        | "code_collaboration_modes_list_v1"
        | "code_mcp_server_status_list_v1" => codex_commands_enabled(),
        "code_runtime_diagnostics_export_v1" => runtime_diagnostics_export_enabled(),
        _ => true,
    }
}

#[cfg(test)]
pub(crate) fn rpc_policy_env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}
