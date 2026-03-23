pub(crate) const CODE_RPC_PREFIX: &str = "code_";
pub(crate) const NATIVE_RPC_PREFIX: &str = "native_";

pub(crate) const NATIVE_RUNTIME_EVENT_METHODS: &[&str] = &["native_state_fabric_updated"];

pub(crate) const NATIVE_ONLY_RPC_METHODS: &[&str] = &[
    "native_management_snapshot",
    "native_review_comments_list",
    "native_review_comment_upsert",
    "native_review_comment_remove",
    "native_review_comment_set_resolved",
    "native_providers_snapshot",
    "native_providers_connection_probe",
    "native_tools_list",
    "native_tool_policy_upsert",
    "native_tool_set_enabled",
    "native_tool_secret_upsert",
    "native_tool_secret_remove",
    "native_themes_list",
    "native_theme_upsert",
    "native_theme_remove",
    "native_theme_set_active",
    "native_schedules_list",
    "native_schedule_create",
    "native_schedule_update",
    "native_schedule_delete",
    "native_schedule_run_now",
    "native_schedule_cancel_run",
    "native_watchers_list",
    "native_watcher_create",
    "native_watcher_update",
    "native_watcher_delete",
    "native_watcher_set_enabled",
    "native_insights_summary",
    "native_insights_timeseries",
    "native_insights_events",
    "native_server_status",
    "native_server_config_get",
    "native_server_config_set",
    "native_settings_get",
    "native_settings_set",
    "native_voice_config_get",
    "native_voice_config_set",
    "native_voice_hotkey_set",
    "native_state_fabric_snapshot",
    "native_state_fabric_delta",
    "native_state_fabric_diagnostics",
];

pub(crate) fn method_uses_native_namespace(method: &str) -> bool {
    method.trim().starts_with(NATIVE_RPC_PREFIX)
}

pub(crate) fn native_rpc_alias_to_code_candidate(method: &str) -> Option<String> {
    let method = method.trim();
    if let Some(suffix) = method.strip_prefix(NATIVE_RPC_PREFIX) {
        return Some(format!("{CODE_RPC_PREFIX}{suffix}"));
    }
    None
}

pub(crate) fn resolve_native_only_rpc_method(method: &str) -> Option<&'static str> {
    let method = method.trim();
    NATIVE_ONLY_RPC_METHODS
        .iter()
        .find(|entry| **entry == method)
        .copied()
}

pub(crate) fn to_native_rpc_method(method: &str) -> Option<String> {
    let method = method.trim();
    if method.is_empty() {
        return None;
    }
    if method.starts_with(NATIVE_RPC_PREFIX) {
        return Some(method.to_string());
    }
    if let Some(suffix) = method.strip_prefix(CODE_RPC_PREFIX) {
        return Some(format!("{NATIVE_RPC_PREFIX}{suffix}"));
    }
    Some(format!("{NATIVE_RPC_PREFIX}{method}"))
}

pub(crate) fn map_rpc_methods_to_native_namespace(methods: &[String]) -> Vec<String> {
    let mut mapped = Vec::with_capacity(methods.len());
    for method in methods {
        if let Some(native_method) = method
            .strip_prefix(CODE_RPC_PREFIX)
            .and_then(|_| to_native_rpc_method(method))
        {
            mapped.push(native_method);
        }
    }
    mapped.sort_unstable();
    mapped.dedup();
    mapped
}

pub(crate) fn runtime_updated_reason_for_request(
    requested_method: &str,
    canonical_method: &str,
) -> String {
    if method_uses_native_namespace(requested_method) {
        return to_native_rpc_method(canonical_method)
            .unwrap_or_else(|| requested_method.trim().to_string());
    }
    canonical_method.to_string()
}

pub(crate) fn native_event_method_for_kind(kind: &str) -> Option<&'static str> {
    match kind {
        "native_state_fabric_updated"
        | "thread.live_update"
        | "thread.live_heartbeat"
        | "thread.live_detached"
        | "runtime.updated" => Some("native_state_fabric_updated"),
        _ => None,
    }
}
