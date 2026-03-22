use crate::backend::runtime_backend;
use crate::models::SettingsSummary;
use crate::runtime_service;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::env;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const DEFAULT_REMOTE_HOST: &str = "127.0.0.1:4732";
const DEFAULT_TCP_LISTEN_HOST: &str = "0.0.0.0";
const DEFAULT_TCP_PORT: u16 = 4732;
const DEFAULT_RUNTIME_SERVICE_BIN: &str = "code-runtime-service-rs";
const DEFAULT_TAILSCALE_BIN: &str = "tailscale";
const DEFAULT_NETBIRD_BIN: &str = "netbird";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TcpDaemonStatusPayload {
    state: &'static str,
    pid: Option<u32>,
    started_at_ms: Option<u64>,
    last_error: Option<String>,
    listen_addr: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TailscaleStatusPayload {
    installed: bool,
    running: bool,
    version: Option<String>,
    dns_name: Option<String>,
    host_name: Option<String>,
    tailnet_name: Option<String>,
    ipv4: Vec<String>,
    ipv6: Vec<String>,
    suggested_remote_host: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TailscaleDaemonCommandPreviewPayload {
    command: String,
    daemon_path: String,
    args: Vec<String>,
    token_configured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetbirdStatusPayload {
    installed: bool,
    running: bool,
    version: Option<String>,
    dns_name: Option<String>,
    host_name: Option<String>,
    management_url: Option<String>,
    ipv4: Vec<String>,
    suggested_remote_host: Option<String>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetbirdDaemonCommandPreviewPayload {
    command: String,
    cli_path: String,
    args: Vec<String>,
    token_configured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolBootstrapTemplatePayload {
    backend_class: &'static str,
    title: String,
    command: String,
    args: Vec<String>,
    backend_id_example: String,
    registration_example: Value,
    notes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolBootstrapPreviewPayload {
    generated_at_ms: u64,
    runtime_service_bin: String,
    remote_host: String,
    remote_token_configured: bool,
    workspace_path: Option<String>,
    templates: Vec<BackendPoolBootstrapTemplatePayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolDiagnosticsPayload {
    generated_at_ms: u64,
    runtime_service_bin: String,
    workspace_path: Option<String>,
    remote_host: String,
    remote_token_configured: bool,
    default_execution_backend_id: Option<String>,
    tcp_overlay: Option<String>,
    registry_source: String,
    reasons: Vec<BackendPoolDiagnosticReasonPayload>,
    backends: Vec<BackendPoolBackendDiagnosticEntryPayload>,
    operator_actions: Vec<String>,
    tailscale: TailscaleStatusPayload,
    netbird: NetbirdStatusPayload,
    tcp_daemon: TcpDaemonStatusPayload,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolDiagnosticReasonPayload {
    code: String,
    severity: &'static str,
    summary: String,
    detail: Option<String>,
    retryable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolBackendDiagnosticEntryPayload {
    backend_id: String,
    display_name: String,
    backend_class: Option<String>,
    backend_kind: Option<String>,
    status: String,
    rollout_state: Option<String>,
    origin: Option<String>,
    healthy: bool,
    availability: Option<String>,
    summary: String,
    reasons: Vec<BackendPoolDiagnosticReasonPayload>,
    connectivity_reachability: Option<String>,
    connectivity_endpoint: Option<String>,
    connectivity_reason: Option<String>,
    lease_status: Option<String>,
    last_heartbeat_at: Option<u64>,
    heartbeat_age_ms: Option<u64>,
    operator_actions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolJoinEnvVarPayload {
    name: String,
    required: bool,
    value_hint: Option<String>,
    description: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolOnboardingCheckPayload {
    code: String,
    status: &'static str,
    summary: String,
    detail: Option<String>,
    retryable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolNormalizedProfilePatchPayload {
    provider: String,
    host: Option<String>,
    token: Option<String>,
    orbit_ws_url: Option<String>,
    tcp_overlay: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolPreparedApplyContractPayload {
    backend_class: String,
    join_command: String,
    join_args: Vec<String>,
    env_contract: Vec<BackendPoolJoinEnvVarPayload>,
    registration_payload: Value,
    retry_action: String,
    regenerate_action: String,
    revoke_action: String,
    operator_actions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolOnboardingPreflightPayload {
    generated_at_ms: u64,
    ok: bool,
    safe_to_persist: bool,
    state: &'static str,
    checks: Vec<BackendPoolOnboardingCheckPayload>,
    warnings: Vec<BackendPoolDiagnosticReasonPayload>,
    errors: Vec<BackendPoolDiagnosticReasonPayload>,
    profile_patch: Option<BackendPoolNormalizedProfilePatchPayload>,
    apply_contract: Option<BackendPoolPreparedApplyContractPayload>,
    operator_actions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendPoolOnboardingPreflightInput {
    provider: Option<String>,
    remote_host: Option<String>,
    remote_token: Option<String>,
    orbit_ws_url: Option<String>,
    backend_class: Option<String>,
    overlay: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrbitConnectTestResultPayload {
    ok: bool,
    latency_ms: Option<u64>,
    message: String,
    details: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrbitSignOutResultPayload {
    success: bool,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrbitRunnerStatusPayload {
    state: &'static str,
    pid: Option<u32>,
    started_at_ms: Option<u64>,
    last_error: Option<String>,
    orbit_url: Option<String>,
}

#[derive(Debug)]
struct ManagedTcpDaemonProcess {
    child: Child,
    daemon_path: String,
    listen_addr: String,
    started_at_ms: u64,
}

static MANAGED_TCP_DAEMON: OnceLock<Mutex<Option<ManagedTcpDaemonProcess>>> = OnceLock::new();

fn managed_tcp_daemon() -> &'static Mutex<Option<ManagedTcpDaemonProcess>> {
    MANAGED_TCP_DAEMON.get_or_init(|| Mutex::new(None))
}

fn empty_payload() -> Value {
    Value::Object(Map::new())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn get_string_field(object: &Map<String, Value>, key: &str) -> Option<String> {
    object
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn get_bool_field(object: &Map<String, Value>, key: &str) -> Option<bool> {
    object.get(key).and_then(Value::as_bool)
}

fn get_array_strings(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn shell_quote(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }
    if value.chars().all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, '/' | '.' | '-' | '_' | ':' | '=')
    }) {
        return value.to_string();
    }
    format!("'{}'", value.replace('\'', r"'\''"))
}

fn format_shell_command(command_path: &str, args: &[String]) -> String {
    std::iter::once(shell_quote(command_path))
        .chain(args.iter().map(|argument| shell_quote(argument)))
        .collect::<Vec<_>>()
        .join(" ")
}

fn binary_file_name(base_name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{base_name}.exe")
    } else {
        base_name.to_string()
    }
}

fn resolve_binary_from_path_env(binary_name: &str) -> Option<PathBuf> {
    let binary_file = binary_file_name(binary_name);
    let path_value = env::var_os("PATH")?;
    env::split_paths(&path_value).find_map(|entry| {
        let candidate = entry.join(&binary_file);
        if candidate.is_file() {
            Some(candidate)
        } else {
            None
        }
    })
}

fn resolve_runtime_service_bin() -> Option<PathBuf> {
    let binary_file = binary_file_name(DEFAULT_RUNTIME_SERVICE_BIN);
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace_root = manifest_dir.join("../../..");
    let explicit = env::var_os("CODE_RUNTIME_SERVICE_BIN").map(PathBuf::from);
    let configured_target_root =
        env::var_os("CARGO_TARGET_DIR")
            .map(PathBuf::from)
            .map(|target_root| {
                if target_root.is_absolute() {
                    target_root
                } else {
                    workspace_root.join(target_root)
                }
            });
    let configured_debug = configured_target_root
        .as_ref()
        .map(|target_root| target_root.join("debug").join(&binary_file));
    let configured_release = configured_target_root
        .as_ref()
        .map(|target_root| target_root.join("release").join(&binary_file));
    let shared_target_root = workspace_root.join(".cache/cargo-target");
    let candidates = [
        explicit,
        configured_debug,
        configured_release,
        Some(shared_target_root.join("debug").join(&binary_file)),
        Some(shared_target_root.join("release").join(&binary_file)),
        Some(
            workspace_root
                .join("packages/code-runtime-service-rs/target/debug")
                .join(&binary_file),
        ),
        Some(
            workspace_root
                .join("packages/code-runtime-service-rs/target/release")
                .join(&binary_file),
        ),
        std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|parent| parent.join(&binary_file))),
        resolve_binary_from_path_env(DEFAULT_RUNTIME_SERVICE_BIN),
    ];
    candidates
        .into_iter()
        .flatten()
        .find(|candidate| candidate.is_file())
}

fn resolve_command_bin(binary_name: &str) -> Option<PathBuf> {
    resolve_binary_from_path_env(binary_name)
}

async fn current_app_settings_object() -> Result<Map<String, Value>, String> {
    let payload =
        runtime_service::invoke_runtime_rpc("code_app_settings_get", empty_payload()).await?;
    match payload {
        Value::Object(object) => Ok(object),
        _ => Err("Persisted app settings payload must be a JSON object.".to_string()),
    }
}

fn first_workspace_path() -> Option<String> {
    runtime_backend()
        .workspaces()
        .first()
        .map(|workspace| workspace.path.clone())
}

fn configured_default_remote_profile<'a>(
    settings: &'a Map<String, Value>,
) -> Option<&'a Map<String, Value>> {
    let profiles = settings.get("remoteBackendProfiles").and_then(Value::as_array)?;
    let default_profile_id = get_string_field(settings, "defaultRemoteBackendProfileId");
    if let Some(default_profile_id) = default_profile_id.as_deref() {
        if let Some(profile) = profiles.iter().filter_map(Value::as_object).find(|entry| {
            get_string_field(entry, "id")
                .as_deref()
                .is_some_and(|profile_id| profile_id == default_profile_id)
        }) {
            return Some(profile);
        }
    }
    profiles.iter().find_map(Value::as_object)
}

fn configured_remote_host(settings: &Map<String, Value>) -> String {
    configured_default_remote_profile(settings)
        .and_then(|profile| get_string_field(profile, "host"))
        .unwrap_or_else(|| DEFAULT_REMOTE_HOST.to_string())
}

fn configured_remote_token(settings: &Map<String, Value>) -> Option<String> {
    configured_default_remote_profile(settings).and_then(|profile| get_string_field(profile, "token"))
}

fn configured_remote_port(host: &str) -> u16 {
    host.rsplit_once(':')
        .and_then(|(_, raw_port)| raw_port.parse::<u16>().ok())
        .unwrap_or(DEFAULT_TCP_PORT)
}

fn suggested_remote_host(dns_name: Option<&str>, host: &str) -> Option<String> {
    let port = configured_remote_port(host);
    dns_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| format!("{value}:{port}"))
}

fn build_runtime_service_args(port: u16, token: Option<&str>) -> Vec<String> {
    let mut args = vec![
        "--host".to_string(),
        DEFAULT_TCP_LISTEN_HOST.to_string(),
        "--port".to_string(),
        port.to_string(),
    ];
    if let Some(token) = token {
        args.push("--runtime-auth-token".to_string());
        args.push(token.to_string());
    }
    args
}

fn build_runtime_service_preview_args(port: u16, token_configured: bool) -> Vec<String> {
    let mut args = vec![
        "--host".to_string(),
        DEFAULT_TCP_LISTEN_HOST.to_string(),
        "--port".to_string(),
        port.to_string(),
    ];
    if token_configured {
        args.push("--runtime-auth-token".to_string());
        args.push("$CODEX_BACKEND_TOKEN".to_string());
    }
    args
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn configured_default_execution_backend_id(settings: &Map<String, Value>) -> Option<String> {
    get_string_field(settings, "defaultRemoteExecutionBackendId")
}

fn configured_tcp_overlay(settings: &Map<String, Value>) -> Option<String> {
    configured_default_remote_profile(settings).and_then(|profile| get_string_field(profile, "tcpOverlay"))
}

fn configured_orbit_ws_url(settings: &Map<String, Value>) -> Option<String> {
    configured_default_remote_profile(settings).and_then(|profile| get_string_field(profile, "orbitWsUrl"))
}

fn distributed_backend_registry_enabled() -> bool {
    matches!(
        env::var("CODE_RUNTIME_SERVICE_DISTRIBUTED_ENABLED")
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("1" | "true" | "yes" | "on")
    )
}

fn normalize_backend_class_input(value: Option<&str>) -> Result<String, String> {
    match value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .unwrap_or("primary")
        .to_ascii_lowercase()
        .as_str()
    {
        "primary" => Ok("primary".to_string()),
        "burst" => Ok("burst".to_string()),
        "specialized" => Ok("specialized".to_string()),
        other => Err(format!(
            "Unsupported backend class `{other}`. Expected primary, burst, or specialized."
        )),
    }
}

fn normalize_overlay_input(value: Option<&str>) -> Option<String> {
    match value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.to_ascii_lowercase())
        .as_deref()
    {
        Some("tailscale") => Some("tailscale".to_string()),
        Some("netbird") => Some("netbird".to_string()),
        _ => None,
    }
}

fn normalize_provider_input(value: Option<&str>) -> &'static str {
    match value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.to_ascii_lowercase())
        .as_deref()
    {
        Some("orbit") => "orbit",
        _ => "tcp",
    }
}

fn normalize_remote_host_input(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

fn build_remote_base_url(host: &str) -> String {
    if host.starts_with("http://") || host.starts_with("https://") {
        host.to_string()
    } else {
        format!("http://{host}")
    }
}

fn build_backend_registration_contract(
    backend_class: &str,
    backend_id: &str,
    display_name: &str,
    endpoint: Option<&str>,
    overlay: Option<&str>,
) -> Value {
    let mut payload = build_backend_registration_example(backend_class, backend_id, display_name);
    if let Some(object) = payload.as_object_mut() {
        if let Some(connectivity) = object
            .get_mut("connectivity")
            .and_then(Value::as_object_mut)
        {
            if let Some(endpoint) = endpoint {
                connectivity.insert("endpoint".to_string(), Value::String(endpoint.to_string()));
            }
            if let Some(overlay) = overlay {
                connectivity.insert("overlay".to_string(), Value::String(overlay.to_string()));
            }
        }
    }
    payload
}

fn diagnostic_reason(
    code: impl Into<String>,
    severity: &'static str,
    summary: impl Into<String>,
    detail: Option<String>,
    retryable: bool,
) -> BackendPoolDiagnosticReasonPayload {
    BackendPoolDiagnosticReasonPayload {
        code: code.into(),
        severity,
        summary: summary.into(),
        detail,
        retryable,
    }
}

fn onboarding_check(
    code: impl Into<String>,
    status: &'static str,
    summary: impl Into<String>,
    detail: Option<String>,
    retryable: bool,
) -> BackendPoolOnboardingCheckPayload {
    BackendPoolOnboardingCheckPayload {
        code: code.into(),
        status,
        summary: summary.into(),
        detail,
        retryable,
    }
}

fn backend_reason_to_summary(code: &str, backend_name: &str) -> (&'static str, String, bool) {
    match code {
        "backend_disabled" => (
            "warning",
            format!("{backend_name} is disabled and will not accept new work."),
            false,
        ),
        "backend_draining" => (
            "warning",
            format!("{backend_name} is draining and should finish current work before removal."),
            false,
        ),
        "health_check_failed" => (
            "error",
            format!("{backend_name} failed health checks."),
            true,
        ),
        "connectivity_unreachable" => (
            "error",
            format!("{backend_name} is unreachable from the current control plane."),
            true,
        ),
        "connectivity_degraded" => (
            "warning",
            format!("{backend_name} is reachable but connectivity is degraded."),
            true,
        ),
        "lease_expired" => (
            "error",
            format!("{backend_name} lease expired and should not be considered live."),
            true,
        ),
        "lease_expiring" => (
            "warning",
            format!("{backend_name} lease is close to expiring."),
            true,
        ),
        "heartbeat_stale" => (
            "warning",
            format!("{backend_name} heartbeat is stale."),
            true,
        ),
        "capacity_saturated" => (
            "warning",
            format!("{backend_name} is saturated at current concurrency."),
            true,
        ),
        "queue_backlog" => (
            "warning",
            format!("{backend_name} has queued work waiting for execution slots."),
            true,
        ),
        "recent_failures_recorded" => (
            "warning",
            format!("{backend_name} recorded recent execution failures."),
            true,
        ),
        other => ("warning", format!("{backend_name} reported {other}."), true),
    }
}

fn backend_reason_to_action(code: &str) -> Option<&'static str> {
    match code {
        "connectivity_unreachable" | "connectivity_degraded" => {
            Some("Check overlay/helper reachability, remote host, and daemon status.")
        }
        "lease_expired" | "lease_expiring" => {
            Some("Renew or recreate the backend lease before relying on this node.")
        }
        "heartbeat_stale" => Some("Confirm the backend is still running and sending heartbeats."),
        "health_check_failed" | "recent_failures_recorded" => {
            Some("Inspect backend process logs and rerun onboarding preflight.")
        }
        "backend_disabled" => Some("Re-enable the backend only after operator review."),
        "backend_draining" => {
            Some("Wait for draining to finish or explicitly reactivate the backend.")
        }
        "capacity_saturated" | "queue_backlog" => {
            Some("Add burst capacity or wait for running work to complete.")
        }
        _ => None,
    }
}

fn build_backend_diagnostic_entry(
    entry: &Value,
) -> Option<BackendPoolBackendDiagnosticEntryPayload> {
    let object = entry.as_object()?;
    let backend_id = get_string_field(object, "backendId")?;
    let display_name =
        get_string_field(object, "displayName").unwrap_or_else(|| backend_id.clone());
    let diagnostics = object.get("diagnostics").and_then(Value::as_object);
    let availability = diagnostics.and_then(|value| get_string_field(value, "availability"));
    let summary = diagnostics
        .and_then(|value| get_string_field(value, "summary"))
        .unwrap_or_else(|| format!("{display_name} has no operator summary."));
    let connectivity = object.get("connectivity").and_then(Value::as_object);
    let lease = object.get("lease").and_then(Value::as_object);
    let mut reasons = Vec::new();
    let mut operator_actions = Vec::new();
    for code in get_array_strings(diagnostics.and_then(|value| value.get("reasons"))) {
        let (severity, reason_summary, retryable) =
            backend_reason_to_summary(code.as_str(), display_name.as_str());
        let detail = connectivity
            .and_then(|connectivity| get_string_field(connectivity, "reason"))
            .filter(|_| {
                matches!(
                    code.as_str(),
                    "connectivity_unreachable" | "connectivity_degraded"
                )
            });
        reasons.push(diagnostic_reason(
            code.clone(),
            severity,
            reason_summary,
            detail,
            retryable,
        ));
        if let Some(action) = backend_reason_to_action(code.as_str()) {
            if !operator_actions.iter().any(|existing| existing == action) {
                operator_actions.push(action.to_string());
            }
        }
    }
    Some(BackendPoolBackendDiagnosticEntryPayload {
        backend_id,
        display_name,
        backend_class: get_string_field(object, "backendClass"),
        backend_kind: get_string_field(object, "backendKind"),
        status: get_string_field(object, "status").unwrap_or_else(|| "unknown".to_string()),
        rollout_state: get_string_field(object, "rolloutState"),
        origin: get_string_field(object, "origin"),
        healthy: get_bool_field(object, "healthy").unwrap_or(false),
        availability,
        summary,
        reasons,
        connectivity_reachability: connectivity
            .and_then(|value| get_string_field(value, "reachability")),
        connectivity_endpoint: connectivity.and_then(|value| get_string_field(value, "endpoint")),
        connectivity_reason: connectivity.and_then(|value| get_string_field(value, "reason")),
        lease_status: lease.and_then(|value| get_string_field(value, "status")),
        last_heartbeat_at: diagnostics
            .and_then(|value| value.get("lastHeartbeatAt"))
            .and_then(Value::as_u64),
        heartbeat_age_ms: diagnostics
            .and_then(|value| value.get("heartbeatAgeMs"))
            .and_then(Value::as_u64),
        operator_actions,
    })
}

fn orbit_unavailable_message(settings: &Map<String, Value>) -> String {
    let configured_url = configured_orbit_ws_url(settings)
        .unwrap_or_else(|| "no Orbit websocket URL configured".to_string());
    format!(
        "Orbit desktop adapter is unavailable in this build. Current Orbit target: {configured_url}."
    )
}

fn build_backend_registration_example(
    backend_class: &str,
    backend_id: &str,
    display_name: &str,
) -> Value {
    let capabilities = if backend_class == "specialized" {
        vec!["gpu".to_string(), "vision".to_string(), "code".to_string()]
    } else {
        vec!["code".to_string(), "plan".to_string()]
    };
    json!({
        "backendId": backend_id,
        "displayName": display_name,
        "capabilities": capabilities,
        "maxConcurrency": if backend_class == "burst" { 2 } else { 4 },
        "costTier": if backend_class == "burst" { "burst" } else { "standard" },
        "latencyClass": if backend_class == "specialized" { "cross-region" } else { "regional" },
        "rolloutState": "current",
        "status": "active",
        "backendClass": backend_class,
        "specializations": if backend_class == "specialized" {
            vec!["gpu".to_string(), "vision".to_string()]
        } else {
            Vec::<String>::new()
        },
        "connectivity": {
            "mode": "overlay",
            "overlay": "tailscale",
            "reachability": "reachable"
        },
        "lease": {
            "status": "active",
            "scope": "node"
        }
    })
}

fn tcp_daemon_status_from_process(process: &ManagedTcpDaemonProcess) -> TcpDaemonStatusPayload {
    TcpDaemonStatusPayload {
        state: "running",
        pid: Some(process.child.id()),
        started_at_ms: Some(process.started_at_ms),
        last_error: None,
        listen_addr: Some(process.listen_addr.clone()),
    }
}

fn stopped_tcp_daemon_status(listen_addr: Option<String>) -> TcpDaemonStatusPayload {
    TcpDaemonStatusPayload {
        state: "stopped",
        pid: None,
        started_at_ms: None,
        last_error: None,
        listen_addr,
    }
}

fn errored_tcp_daemon_status(
    listen_addr: Option<String>,
    message: impl Into<String>,
) -> TcpDaemonStatusPayload {
    TcpDaemonStatusPayload {
        state: "error",
        pid: None,
        started_at_ms: None,
        last_error: Some(message.into()),
        listen_addr,
    }
}

fn read_managed_tcp_daemon_status(
    fallback_listen_addr: Option<String>,
) -> Result<TcpDaemonStatusPayload, String> {
    let mut daemon_guard = managed_tcp_daemon()
        .lock()
        .map_err(|_| "Managed TCP daemon state lock poisoned.".to_string())?;
    let Some(process) = daemon_guard.as_mut() else {
        return Ok(stopped_tcp_daemon_status(fallback_listen_addr));
    };

    match process.child.try_wait() {
        Ok(None) => Ok(tcp_daemon_status_from_process(process)),
        Ok(Some(status)) => {
            let listen_addr = Some(process.listen_addr.clone());
            let daemon_path = process.daemon_path.clone();
            *daemon_guard = None;
            Ok(errored_tcp_daemon_status(
                listen_addr,
                format!("Managed TCP daemon `{daemon_path}` exited with status {status}."),
            ))
        }
        Err(error) => {
            let listen_addr = Some(process.listen_addr.clone());
            *daemon_guard = None;
            Ok(errored_tcp_daemon_status(listen_addr, error.to_string()))
        }
    }
}

fn run_json_command(command_path: &Path, args: &[&str]) -> Result<Value, String> {
    let output = Command::new(command_path)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run `{}`: {error}", command_path.display()))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if details.is_empty() {
            format!(
                "`{}` exited with status {}.",
                command_path.display(),
                output.status
            )
        } else {
            details
        });
    }
    serde_json::from_slice::<Value>(&output.stdout).map_err(|error| {
        format!(
            "Failed to parse JSON from `{}`: {error}",
            command_path.display()
        )
    })
}

fn command_message(command_name: &str, state: &str) -> String {
    format!("{command_name} status: {state}.")
}

#[tauri::command]
pub fn code_settings_summary() -> SettingsSummary {
    runtime_backend().settings_summary()
}

#[cfg(test)]
mod tests {
    use super::{
        backend_pool_onboarding_preflight, build_backend_diagnostic_entry,
        build_backend_registration_example, build_runtime_service_preview_args,
        configured_orbit_ws_url, configured_remote_host, configured_remote_token,
        configured_tcp_overlay, suggested_remote_host, BackendPoolOnboardingPreflightInput,
    };
    use serde_json::json;

    #[test]
    fn build_runtime_service_preview_args_uses_placeholder_token_when_configured() {
        let args = build_runtime_service_preview_args(4732, true);
        assert_eq!(
            args,
            vec![
                "--host".to_string(),
                "0.0.0.0".to_string(),
                "--port".to_string(),
                "4732".to_string(),
                "--runtime-auth-token".to_string(),
                "$CODEX_BACKEND_TOKEN".to_string(),
            ]
        );

        let without_token = build_runtime_service_preview_args(4848, false);
        assert_eq!(
            without_token,
            vec![
                "--host".to_string(),
                "0.0.0.0".to_string(),
                "--port".to_string(),
                "4848".to_string(),
            ]
        );
    }

    #[test]
    fn build_backend_registration_example_marks_specialized_backends_with_tags() {
        let payload = build_backend_registration_example(
            "specialized",
            "backend-specialized-gpu",
            "Specialized GPU Backend",
        );

        assert_eq!(payload["backendId"], "backend-specialized-gpu");
        assert_eq!(payload["displayName"], "Specialized GPU Backend");
        assert_eq!(payload["backendClass"], "specialized");
        assert_eq!(payload["latencyClass"], "cross-region");
        assert_eq!(payload["specializations"], json!(["gpu", "vision"]));
        assert_eq!(payload["connectivity"]["mode"], "overlay");
        assert_eq!(payload["connectivity"]["overlay"], "tailscale");
        assert_eq!(payload["lease"]["status"], "active");
        assert_eq!(payload["lease"]["scope"], "node");
    }

    #[test]
    fn configured_tcp_overlay_prefers_default_remote_profile_then_first_profile() {
        let settings = json!({
            "defaultRemoteBackendProfileId": "profile-b",
            "remoteBackendProfiles": [
                {
                    "id": "profile-a",
                    "tcpOverlay": "tailscale"
                },
                {
                    "id": "profile-b",
                    "tcpOverlay": "netbird"
                }
            ]
        });

        let overlay =
            configured_tcp_overlay(settings.as_object().expect("settings should be an object"));
        assert_eq!(overlay.as_deref(), Some("netbird"));

        let fallback_settings = json!({
            "remoteBackendProfiles": [
                {
                    "id": "profile-a",
                    "tcpOverlay": "tailscale"
                }
            ]
        });
        let fallback_overlay = configured_tcp_overlay(
            fallback_settings
                .as_object()
                .expect("settings should be an object"),
        );
        assert_eq!(fallback_overlay.as_deref(), Some("tailscale"));
    }

    #[test]
    fn configured_remote_connection_reads_selected_default_profile() {
        let settings = json!({
            "defaultRemoteBackendProfileId": "profile-b",
            "remoteBackendProfiles": [
                {
                    "id": "profile-a",
                    "provider": "tcp",
                    "host": "tcp-a.example:4732",
                    "token": "token-a"
                },
                {
                    "id": "profile-b",
                    "provider": "orbit",
                    "host": "tcp-b.example:4732",
                    "token": "token-b",
                    "orbitWsUrl": "wss://orbit.example/ws"
                }
            ]
        });

        let settings = settings.as_object().expect("settings should be an object");
        assert_eq!(configured_remote_host(settings), "tcp-b.example:4732");
        assert_eq!(configured_remote_token(settings).as_deref(), Some("token-b"));
        assert_eq!(
            configured_orbit_ws_url(settings).as_deref(),
            Some("wss://orbit.example/ws")
        );
    }

    #[test]
    fn suggested_remote_host_preserves_runtime_port() {
        assert_eq!(
            suggested_remote_host(Some("backend.example.ts.net"), "127.0.0.1:4815").as_deref(),
            Some("backend.example.ts.net:4815")
        );
        assert_eq!(suggested_remote_host(None, "127.0.0.1:4732"), None);
    }

    #[tokio::test]
    async fn backend_pool_onboarding_preflight_blocks_orbit_until_adapter_exists() {
        let result = backend_pool_onboarding_preflight(BackendPoolOnboardingPreflightInput {
            provider: Some("orbit".to_string()),
            remote_host: None,
            remote_token: Some("token-1".to_string()),
            orbit_ws_url: Some("wss://orbit.example/ws".to_string()),
            backend_class: Some("specialized".to_string()),
            overlay: None,
        })
        .await
        .expect("orbit preflight payload");

        assert!(!result.ok);
        assert!(!result.safe_to_persist);
        assert_eq!(result.state, "blocked");
        assert_eq!(
            result.warnings.first().map(|warning| warning.code.as_str()),
            Some("orbit_adapter_unavailable")
        );
    }

    #[test]
    fn build_backend_diagnostic_entry_maps_runtime_reasons_to_operator_payload() {
        let entry = build_backend_diagnostic_entry(&json!({
            "backendId": "worker-a",
            "displayName": "Worker A",
            "backendClass": "primary",
            "backendKind": "native",
            "status": "active",
            "rolloutState": "current",
            "origin": "runtime-native",
            "healthy": false,
            "connectivity": {
                "reachability": "unreachable",
                "endpoint": "worker-a.tailnet:4732",
                "reason": "dial tcp timeout"
            },
            "lease": {
                "status": "expired"
            },
            "diagnostics": {
                "availability": "degraded",
                "summary": "Worker A is degraded: dial tcp timeout.",
                "reasons": ["connectivity_unreachable", "lease_expired", "heartbeat_stale"],
                "lastHeartbeatAt": 10,
                "heartbeatAgeMs": 20
            }
        }))
        .expect("backend diagnostics entry");

        assert_eq!(entry.backend_id, "worker-a");
        assert_eq!(entry.availability.as_deref(), Some("degraded"));
        assert_eq!(entry.reasons.len(), 3);
        assert!(entry
            .operator_actions
            .iter()
            .any(|action| action.contains("overlay/helper reachability")));
        assert_eq!(
            entry.connectivity_reason.as_deref(),
            Some("dial tcp timeout")
        );
        assert_eq!(entry.lease_status.as_deref(), Some("expired"));
    }
}
