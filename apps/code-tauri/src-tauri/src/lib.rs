mod accounts;
mod backend;
mod commands;
mod instruction_skills_watcher;
mod models;
mod remote;
mod runtime_service;

macro_rules! code_tauri_command_entries {
    ($consumer:ident) => {
        $consumer!(
            (commands::health::code_health, "code_health"),
            (
                commands::rpc::code_rpc_capabilities,
                "code_rpc_capabilities"
            ),
            (
                commands::workspaces::code_workspaces_list,
                "code_workspaces_list"
            ),
            (
                commands::workspaces::code_workspace_create,
                "code_workspace_create"
            ),
            (
                commands::workspaces::code_workspace_rename,
                "code_workspace_rename"
            ),
            (
                commands::workspaces::code_workspace_remove,
                "code_workspace_remove"
            ),
            (
                commands::files::code_workspace_files_list,
                "code_workspace_files_list"
            ),
            (
                commands::files::code_workspace_file_read,
                "code_workspace_file_read"
            ),
            (
                commands::files::code_text_file_read_v1,
                "code_text_file_read_v1"
            ),
            (
                commands::files::code_text_file_write_v1,
                "code_text_file_write_v1"
            ),
            (commands::threads::code_threads_list, "code_threads_list"),
            (commands::threads::code_thread_create, "code_thread_create"),
            (commands::threads::code_thread_resume, "code_thread_resume"),
            (
                commands::threads::code_thread_archive,
                "code_thread_archive"
            ),
            (
                commands::threads::code_thread_live_subscribe,
                "code_thread_live_subscribe"
            ),
            (
                commands::threads::code_thread_live_unsubscribe,
                "code_thread_live_unsubscribe"
            ),
            (
                commands::git::code_git_changes_list,
                "code_git_changes_list"
            ),
            (commands::git::code_git_diff_read, "code_git_diff_read"),
            (
                commands::git::code_git_branches_list,
                "code_git_branches_list"
            ),
            (
                commands::git::code_git_branch_create,
                "code_git_branch_create"
            ),
            (
                commands::git::code_git_branch_checkout,
                "code_git_branch_checkout"
            ),
            (
                commands::git::code_git_stage_change,
                "code_git_stage_change"
            ),
            (commands::git::code_git_stage_all, "code_git_stage_all"),
            (
                commands::git::code_git_unstage_change,
                "code_git_unstage_change"
            ),
            (
                commands::git::code_git_revert_change,
                "code_git_revert_change"
            ),
            (commands::git::code_git_commit, "code_git_commit"),
            (commands::turn::code_turn_send, "code_turn_send"),
            (commands::turn::code_turn_interrupt, "code_turn_interrupt"),
            (
                commands::agents::code_runtime_run_start,
                "code_runtime_run_start"
            ),
            (
                commands::agents::code_runtime_run_cancel,
                "code_runtime_run_cancel"
            ),
            (
                commands::agents::code_runtime_run_resume,
                "code_runtime_run_resume"
            ),
            (
                commands::agents::code_runtime_run_intervene,
                "code_runtime_run_intervene"
            ),
            (
                commands::agents::code_runtime_run_subscribe,
                "code_runtime_run_subscribe"
            ),
            (
                commands::agents::code_runtime_runs_list,
                "code_runtime_runs_list"
            ),
            (
                commands::agents::code_kernel_job_start_v3,
                "code_kernel_job_start_v3"
            ),
            (
                commands::agents::code_kernel_job_get_v3,
                "code_kernel_job_get_v3"
            ),
            (
                commands::agents::code_kernel_job_cancel_v3,
                "code_kernel_job_cancel_v3"
            ),
            (
                commands::agents::code_kernel_job_resume_v3,
                "code_kernel_job_resume_v3"
            ),
            (
                commands::agents::code_kernel_job_intervene_v3,
                "code_kernel_job_intervene_v3"
            ),
            (
                commands::agents::code_kernel_job_subscribe_v3,
                "code_kernel_job_subscribe_v3"
            ),
            (
                commands::agents::code_kernel_job_callback_register_v3,
                "code_kernel_job_callback_register_v3"
            ),
            (
                commands::agents::code_kernel_job_callback_remove_v3,
                "code_kernel_job_callback_remove_v3"
            ),
            (
                commands::agents::code_sub_agent_spawn,
                "code_sub_agent_spawn"
            ),
            (commands::agents::code_sub_agent_send, "code_sub_agent_send"),
            (commands::agents::code_sub_agent_wait, "code_sub_agent_wait"),
            (
                commands::agents::code_sub_agent_status,
                "code_sub_agent_status"
            ),
            (
                commands::agents::code_sub_agent_interrupt,
                "code_sub_agent_interrupt"
            ),
            (
                commands::agents::code_sub_agent_close,
                "code_sub_agent_close"
            ),
            (
                commands::agents::code_runtime_run_checkpoint_approval,
                "code_runtime_run_checkpoint_approval"
            ),
            (
                commands::agents::code_kernel_capabilities_list_v2,
                "code_kernel_capabilities_list_v2"
            ),
            (
                commands::agents::code_kernel_sessions_list_v2,
                "code_kernel_sessions_list_v2"
            ),
            (
                commands::agents::code_kernel_jobs_list_v2,
                "code_kernel_jobs_list_v2"
            ),
            (
                commands::agents::code_kernel_context_snapshot_v2,
                "code_kernel_context_snapshot_v2"
            ),
            (
                commands::agents::code_kernel_extensions_list_v2,
                "code_kernel_extensions_list_v2"
            ),
            (
                commands::agents::code_kernel_policies_evaluate_v2,
                "code_kernel_policies_evaluate_v2"
            ),
            (
                commands::agents::code_kernel_projection_bootstrap_v3,
                "code_kernel_projection_bootstrap_v3"
            ),
            (
                commands::agents::code_distributed_task_graph,
                "code_distributed_task_graph"
            ),
            (
                commands::agents::code_oauth_codex_login_start,
                "code_oauth_codex_login_start"
            ),
            (
                commands::agents::code_oauth_codex_login_cancel,
                "code_oauth_codex_login_cancel"
            ),
            (
                commands::models::code_providers_catalog,
                "code_providers_catalog"
            ),
            (commands::models::code_models_pool, "code_models_pool"),
            (
                commands::prompts::code_prompt_library_list,
                "code_prompt_library_list"
            ),
            (
                commands::prompts::code_prompt_library_create,
                "code_prompt_library_create"
            ),
            (
                commands::prompts::code_prompt_library_update,
                "code_prompt_library_update"
            ),
            (
                commands::prompts::code_prompt_library_delete,
                "code_prompt_library_delete"
            ),
            (
                commands::prompts::code_prompt_library_move,
                "code_prompt_library_move"
            ),
            (commands::remote::code_remote_status, "code_remote_status"),
            (
                commands::terminal::code_terminal_status,
                "code_terminal_status"
            ),
            (commands::terminal::code_terminal_open, "code_terminal_open"),
            (
                commands::terminal::code_terminal_write,
                "code_terminal_write"
            ),
            (
                commands::terminal::code_terminal_input_raw,
                "code_terminal_input_raw"
            ),
            (commands::terminal::code_terminal_read, "code_terminal_read"),
            (
                commands::terminal::code_terminal_interrupt,
                "code_terminal_interrupt"
            ),
            (
                commands::terminal::code_terminal_resize,
                "code_terminal_resize"
            ),
            (
                commands::terminal::code_terminal_stream_start,
                "code_terminal_stream_start"
            ),
            (
                commands::terminal::code_terminal_stream_stop,
                "code_terminal_stream_stop"
            ),
            (
                commands::terminal::code_terminal_close,
                "code_terminal_close"
            ),
            (
                commands::cli_sessions::code_cli_sessions_list,
                "code_cli_sessions_list"
            ),
            (
                commands::settings::code_settings_summary,
                "code_settings_summary"
            ),
            (
                commands::settings::code_app_settings_get,
                "code_app_settings_get"
            ),
            (
                commands::settings::code_app_settings_update,
                "code_app_settings_update"
            ),
            (
                commands::agents::code_mission_control_snapshot_v1,
                "code_mission_control_snapshot_v1"
            ),
            (
                commands::codex::code_codex_exec_run_v1,
                "code_codex_exec_run_v1"
            ),
            (
                commands::codex::code_codex_cloud_tasks_list_v1,
                "code_codex_cloud_tasks_list_v1"
            ),
            (
                commands::codex::code_codex_config_path_get_v1,
                "code_codex_config_path_get_v1"
            ),
            (
                commands::codex::code_codex_doctor_v1,
                "code_codex_doctor_v1"
            ),
            (
                commands::codex::code_codex_update_v1,
                "code_codex_update_v1"
            ),
            (
                commands::codex::code_collaboration_modes_list_v1,
                "code_collaboration_modes_list_v1"
            ),
            (commands::codex::code_apps_list_v1, "code_apps_list_v1"),
            (
                commands::codex::code_mcp_server_status_list_v1,
                "code_mcp_server_status_list_v1"
            ),
            (
                commands::diagnostics::code_runtime_diagnostics_export_v1,
                "code_runtime_diagnostics_export_v1"
            )
        )
    };
}

#[allow(unused_macros)]
macro_rules! command_handler_from_entries {
    ($(($path:path, $name:literal)),+ $(,)?) => {
        tauri::generate_handler![
            $($path),+,
            commands::workspaces::open_workspace_in,
            commands::workspaces::get_open_app_icon
        ]
    };
}

macro_rules! command_handler_from_entries {
    ($(($path:path, $name:literal)),+ $(,)?) => {
        tauri::generate_handler![
            $($path),+,
            commands::state_fabric::native_state_fabric_snapshot,
            commands::state_fabric::native_state_fabric_delta,
            commands::state_fabric::native_state_fabric_diagnostics,
            commands::settings::is_mobile_runtime,
            commands::settings::orbit_connect_test,
            commands::settings::orbit_sign_in_start,
            commands::settings::orbit_sign_in_poll,
            commands::settings::orbit_sign_out,
            commands::settings::orbit_runner_start,
            commands::settings::orbit_runner_stop,
            commands::settings::orbit_runner_status,
            commands::settings::tailscale_status,
            commands::settings::tailscale_daemon_command_preview,
            commands::settings::tailscale_daemon_start,
            commands::settings::tailscale_daemon_stop,
            commands::settings::tailscale_daemon_status,
            commands::settings::netbird_status,
            commands::settings::netbird_daemon_command_preview,
            commands::settings::backend_pool_bootstrap_preview,
            commands::settings::backend_pool_onboarding_preflight,
            commands::settings::backend_pool_diagnostics
        ]
    };
}

macro_rules! command_names_from_entries {
    ($(($path:path, $name:literal)),+ $(,)?) => {
        &[$($name),+]
    };
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) const CODE_TAURI_REGISTERED_RPC_COMMANDS: &[&str] =
    code_tauri_command_entries!(command_names_from_entries);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            runtime_service::attach_runtime_event_relay(app.handle().clone()).map_err(|error| {
                let io_error = std::io::Error::other(error);
                Box::<dyn std::error::Error>::from(io_error)
            })?;
            Ok(())
        })
        .invoke_handler(code_tauri_command_entries!(command_handler_from_entries))
        .run(tauri::generate_context!())
        .expect("error while running code tauri application");
}

#[cfg(test)]
mod tests {
    use super::commands::rpc::{
        code_rpc_capabilities, compute_rpc_method_set_hash, current_rpc_features,
        current_rpc_methods, CODE_RUNTIME_RPC_CAPABILITY_PROFILE,
        CODE_RUNTIME_RPC_CONTRACT_VERSION, CODE_RUNTIME_RPC_ERROR_CODES,
        CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT, CODE_RUNTIME_RPC_FROZEN_FEATURE,
    };
    use super::CODE_TAURI_REGISTERED_RPC_COMMANDS;
    use serde_json::Value;
    use std::{collections::HashSet, fs, path::Path, sync::Mutex};

    fn rpc_capability_env_lock() -> &'static Mutex<()> {
        super::commands::policy::rpc_policy_env_lock()
    }

    fn reset_rpc_capability_env() {
        std::env::remove_var("CODE_TAURI_ENABLE_TERMINAL_COMMANDS");
        std::env::remove_var("CODE_TAURI_ENABLE_CODEX_COMMANDS");
        std::env::remove_var("CODE_TAURI_ENABLE_RUNTIME_DIAGNOSTICS_EXPORT");
    }

    #[test]
    fn registry_commands_are_unique() {
        let unique: HashSet<&str> = CODE_TAURI_REGISTERED_RPC_COMMANDS.iter().copied().collect();
        assert_eq!(unique.len(), CODE_TAURI_REGISTERED_RPC_COMMANDS.len());
    }

    #[test]
    fn registry_contains_canonical_methods_only() {
        let _guard = rpc_capability_env_lock()
            .lock()
            .expect("rpc capability env lock poisoned");
        reset_rpc_capability_env();
        let capabilities = code_rpc_capabilities();
        let capability_methods: HashSet<&str> =
            capabilities.methods.iter().map(String::as_str).collect();
        assert!(!capability_methods.is_empty());
        for command in &capability_methods {
            assert!(
                command.starts_with("code_"),
                "registered command should be canonical-only: `{command}`"
            );
            assert!(CODE_TAURI_REGISTERED_RPC_COMMANDS.contains(command));
        }
    }

    #[test]
    fn registry_includes_canonical_text_file_commands_and_excludes_retired_settings_aliases() {
        assert!(CODE_TAURI_REGISTERED_RPC_COMMANDS.contains(&"code_text_file_read_v1"));
        assert!(CODE_TAURI_REGISTERED_RPC_COMMANDS.contains(&"code_text_file_write_v1"));
        assert!(!CODE_TAURI_REGISTERED_RPC_COMMANDS.contains(&"get_app_settings"));
        assert!(!CODE_TAURI_REGISTERED_RPC_COMMANDS.contains(&"update_app_settings"));
    }

    #[test]
    fn legacy_workspace_launcher_commands_stay_outside_canonical_registry() {
        assert!(!CODE_TAURI_REGISTERED_RPC_COMMANDS.contains(&"open_workspace_in"));
        assert!(!CODE_TAURI_REGISTERED_RPC_COMMANDS.contains(&"get_open_app_icon"));
    }

    #[test]
    fn rpc_capabilities_payload_includes_frozen_contract_fields() {
        let _guard = rpc_capability_env_lock()
            .lock()
            .expect("rpc capability env lock poisoned");
        reset_rpc_capability_env();
        let capabilities = code_rpc_capabilities();

        assert_eq!(
            capabilities.contract_version,
            CODE_RUNTIME_RPC_CONTRACT_VERSION
        );
        assert_eq!(capabilities.profile, CODE_RUNTIME_RPC_CAPABILITY_PROFILE);
        assert_eq!(
            capabilities.freeze_effective_at,
            CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT
        );
        let expected_frozen_feature = format!(
            "contract_frozen_{}",
            CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT.replace('-', "_")
        );
        assert_eq!(CODE_RUNTIME_RPC_FROZEN_FEATURE, expected_frozen_feature);
        assert!(!capabilities.methods.is_empty());
        assert!(!capabilities.method_set_hash.is_empty());
        let expected_features = current_rpc_features();
        let expected_error_codes: std::collections::BTreeMap<String, String> =
            CODE_RUNTIME_RPC_ERROR_CODES
                .iter()
                .map(|(code, value)| ((*code).to_string(), (*value).to_string()))
                .collect();
        assert_eq!(capabilities.features, expected_features);
        assert!(capabilities.features.contains(&expected_frozen_feature));
        assert_eq!(capabilities.error_codes, expected_error_codes);
    }

    #[test]
    fn rpc_capabilities_methods_are_registry_exact_sorted_and_unique() {
        let _guard = rpc_capability_env_lock()
            .lock()
            .expect("rpc capability env lock poisoned");
        reset_rpc_capability_env();
        let capabilities = code_rpc_capabilities();
        let expected_methods = current_rpc_methods(CODE_TAURI_REGISTERED_RPC_COMMANDS);

        assert_eq!(capabilities.methods, expected_methods);

        let unique: HashSet<&str> = capabilities.methods.iter().map(String::as_str).collect();
        assert_eq!(unique.len(), capabilities.methods.len());
    }

    #[test]
    fn rpc_capabilities_hide_high_risk_methods_by_default() {
        let _guard = rpc_capability_env_lock()
            .lock()
            .expect("rpc capability env lock poisoned");
        reset_rpc_capability_env();

        let capabilities = code_rpc_capabilities();

        for method in [
            "code_terminal_open",
            "code_terminal_write",
            "code_terminal_input_raw",
            "code_terminal_stream_start",
            "code_codex_exec_run_v1",
            "code_codex_cloud_tasks_list_v1",
            "code_codex_doctor_v1",
            "code_codex_update_v1",
            "code_runtime_diagnostics_export_v1",
        ] {
            assert!(
                !capabilities.methods.iter().any(|entry| entry == method),
                "default desktop capability surface should hide high-risk method `{method}`"
            );
        }
    }

    #[test]
    fn rpc_capabilities_method_set_hash_matches_methods() {
        let _guard = rpc_capability_env_lock()
            .lock()
            .expect("rpc capability env lock poisoned");
        reset_rpc_capability_env();
        let capabilities = code_rpc_capabilities();
        let recomputed_hash = compute_rpc_method_set_hash(capabilities.methods.as_slice());
        assert_eq!(capabilities.method_set_hash, recomputed_hash);

        let mut reordered_with_duplicate = capabilities.methods.clone();
        reordered_with_duplicate.reverse();
        if let Some(first) = capabilities.methods.first() {
            reordered_with_duplicate.push(first.clone());
        }
        let recomputed_from_reordered =
            compute_rpc_method_set_hash(reordered_with_duplicate.as_slice());
        assert_eq!(capabilities.method_set_hash, recomputed_from_reordered);
        assert!(capabilities
            .method_set_hash
            .chars()
            .all(|ch| ch.is_ascii_hexdigit()));
        assert_eq!(capabilities.method_set_hash.len(), 16);
    }

    #[test]
    fn rpc_capabilities_serializes_contract_shape_with_camel_case_keys() {
        let _guard = rpc_capability_env_lock()
            .lock()
            .expect("rpc capability env lock poisoned");
        reset_rpc_capability_env();
        let capabilities = code_rpc_capabilities();
        let payload = serde_json::to_value(&capabilities).expect("serialize capabilities payload");
        let object = payload
            .as_object()
            .expect("capabilities payload should serialize to object");

        for key in [
            "profile",
            "contractVersion",
            "freezeEffectiveAt",
            "methodSetHash",
            "methods",
            "features",
            "errorCodes",
            "transports",
        ] {
            assert!(
                object.contains_key(key),
                "serialized capabilities payload missing `{key}`"
            );
        }

        for snake_case_key in [
            "contract_version",
            "freeze_effective_at",
            "method_set_hash",
            "error_codes",
        ] {
            assert!(
                !object.contains_key(snake_case_key),
                "serialized capabilities payload should not expose snake_case key `{snake_case_key}`"
            );
        }

        assert_eq!(
            object.get("errorCodes"),
            Some(&Value::Object(
                CODE_RUNTIME_RPC_ERROR_CODES
                    .iter()
                    .map(|(code, value)| {
                        ((*code).to_string(), Value::String((*value).to_string()))
                    })
                    .collect()
            ))
        );
        assert_eq!(
            object.get("transports"),
            Some(
                &serde_json::to_value(&capabilities.transports)
                    .expect("serialize capabilities transports")
            )
        );
    }

    #[test]
    fn rpc_capabilities_payload_matches_frozen_spec_and_gap_allowlist() {
        let _guard = rpc_capability_env_lock()
            .lock()
            .expect("rpc capability env lock poisoned");
        reset_rpc_capability_env();
        let capabilities = code_rpc_capabilities();
        let spec_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../../../docs/runtime/spec/code-runtime-rpc-spec.tauri.{CODE_RUNTIME_RPC_CONTRACT_VERSION}.json"
        ));
        let frozen_raw = fs::read_to_string(&spec_path).unwrap_or_else(|error| {
            panic!(
                "failed to read frozen code-tauri runtime rpc spec at {}: {error}",
                spec_path.display()
            )
        });
        let frozen_payload: Value =
            serde_json::from_str(frozen_raw.as_str()).expect("parse frozen runtime rpc spec");
        let frozen_rpc = frozen_payload
            .get("rpc")
            .and_then(Value::as_object)
            .expect("frozen runtime rpc spec should include `rpc` object");

        assert_eq!(
            frozen_rpc.get("contractVersion"),
            Some(&Value::String(capabilities.contract_version.clone()))
        );
        assert_eq!(
            frozen_rpc.get("freezeEffectiveAt"),
            Some(&Value::String(capabilities.freeze_effective_at.clone()))
        );
        assert_eq!(
            frozen_rpc.get("profile"),
            Some(&Value::String(capabilities.profile.clone()))
        );

        let frozen_canonical_methods = frozen_rpc
            .get("canonicalMethods")
            .and_then(Value::as_array)
            .expect("frozen runtime rpc spec should include `canonicalMethods` array");
        let frozen_canonical_method_set: HashSet<String> = frozen_canonical_methods
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect();
        let frozen_methods = frozen_rpc
            .get("methods")
            .and_then(Value::as_array)
            .expect("frozen runtime rpc spec should include `methods` array");
        let frozen_method_set: HashSet<String> = frozen_methods
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect();
        let capability_method_set: HashSet<String> = capabilities.methods.iter().cloned().collect();

        let unexpected_capability_methods: Vec<String> = capability_method_set
            .iter()
            .filter(|method| !frozen_canonical_method_set.contains(*method))
            .cloned()
            .collect();
        assert!(
            unexpected_capability_methods.is_empty(),
            "code-tauri capabilities include methods missing from frozen canonical runtime rpc set: {}",
            unexpected_capability_methods.join(", ")
        );

        let gap_allowlist_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../../../docs/runtime/spec/code-runtime-rpc-tauri-gap-allowlist.{CODE_RUNTIME_RPC_CONTRACT_VERSION}.json"
        ));
        let gap_allowlist_raw = fs::read_to_string(&gap_allowlist_path).unwrap_or_else(|error| {
            panic!(
                "failed to read code-tauri runtime rpc gap allowlist at {}: {error}",
                gap_allowlist_path.display()
            )
        });
        let gap_allowlist_payload: Value =
            serde_json::from_str(gap_allowlist_raw.as_str()).expect("parse tauri gap allowlist");
        assert_eq!(
            gap_allowlist_payload
                .get("contractVersion")
                .and_then(Value::as_str),
            Some(CODE_RUNTIME_RPC_CONTRACT_VERSION),
            "gap allowlist contractVersion should match runtime contract version"
        );
        assert_eq!(
            gap_allowlist_payload
                .get("freezeEffectiveAt")
                .and_then(Value::as_str),
            Some(CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT),
            "gap allowlist freezeEffectiveAt should match runtime freeze effective date"
        );

        let allowlist_missing_methods: HashSet<String> = gap_allowlist_payload
            .get("missingMethods")
            .and_then(Value::as_array)
            .expect("gap allowlist should include missingMethods array")
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect();

        let expected_missing_methods: HashSet<String> = frozen_method_set
            .iter()
            .filter(|method| !capability_method_set.contains(*method))
            .cloned()
            .collect();

        let missing_beyond_allowlist: Vec<String> = expected_missing_methods
            .iter()
            .filter(|method| !allowlist_missing_methods.contains(*method))
            .cloned()
            .collect();
        assert!(
            missing_beyond_allowlist.is_empty(),
            "code-tauri missing method set grew beyond allowlist: {}",
            missing_beyond_allowlist.join(", ")
        );

        let allowlist_unknown_methods: Vec<String> = allowlist_missing_methods
            .iter()
            .filter(|method| !frozen_method_set.contains(*method))
            .cloned()
            .collect();
        assert!(
            allowlist_unknown_methods.is_empty(),
            "code-tauri gap allowlist includes unknown canonical host methods: {}",
            allowlist_unknown_methods.join(", ")
        );

        assert_eq!(
            allowlist_missing_methods.len(),
            expected_missing_methods.len(),
            "gap allowlist should exactly match current host->tauri method gap"
        );

        assert_eq!(
            frozen_rpc.get("features"),
            Some(&Value::Array(
                capabilities
                    .features
                    .iter()
                    .cloned()
                    .map(Value::String)
                    .collect()
            ))
        );
        assert_eq!(
            frozen_rpc.get("errorCodes"),
            Some(&Value::Object(
                capabilities
                    .error_codes
                    .iter()
                    .map(|(code, value)| (code.clone(), Value::String(value.clone())))
                    .collect()
            ))
        );
        assert_eq!(
            frozen_rpc.get("transports"),
            Some(
                &serde_json::to_value(&capabilities.transports)
                    .expect("serialize capabilities transports")
            )
        );
    }
}
