use super::*;
use crate::acp_runtime::probe_acp_stdio_initialize;
#[path = "acp_client_adapter_readiness.rs"]
mod readiness;
use readiness::{build_probe_failure, build_stdio_probe_success, probe_acp_http_initialize};

const ACP_BACKEND_PREFIX: &str = "acp:";
const ACP_PROTOCOL_VERSION: &str = "2026-03-17";
const ACP_JSONRPC_VERSION: &str = "2.0";
const ACP_INITIALIZE_REQUEST_ID: u64 = 1;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "transport")]
pub(crate) enum AcpIntegrationTransportConfig {
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        cwd: Option<String>,
        #[serde(default)]
        env: HashMap<String, String>,
    },
    Http {
        endpoint: String,
        #[serde(default)]
        experimental: bool,
        #[serde(default)]
        headers: HashMap<String, String>,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AcpIntegrationSummary {
    pub(crate) integration_id: String,
    pub(crate) backend_id: String,
    pub(crate) display_name: String,
    pub(crate) state: String,
    pub(crate) transport: String,
    pub(crate) transport_config: AcpIntegrationTransportConfig,
    pub(crate) healthy: bool,
    pub(crate) last_error: Option<String>,
    pub(crate) last_probe_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) protocol_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) server_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) server_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) config_options: Option<Value>,
    pub(crate) capabilities: Vec<String>,
    pub(crate) max_concurrency: u64,
    pub(crate) cost_tier: String,
    pub(crate) latency_class: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) backend_class: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) specializations: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) connectivity: Option<RuntimeBackendConnectivitySummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) lease: Option<RuntimeBackendLeaseSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) readiness: Option<RuntimeBackendReadinessSummary>,
    pub(crate) created_at: u64,
    pub(crate) updated_at: u64,
}

#[derive(Default)]
pub(crate) struct AcpIntegrationStore {
    entries: HashMap<String, AcpIntegrationSummary>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpIntegrationUpsertRequest {
    #[serde(alias = "integration_id")]
    integration_id: String,
    #[serde(alias = "display_name")]
    display_name: String,
    #[serde(alias = "transport_config")]
    transport_config: AcpIntegrationTransportConfig,
    #[serde(default)]
    state: Option<String>,
    capabilities: Vec<String>,
    #[serde(alias = "max_concurrency")]
    max_concurrency: u64,
    #[serde(alias = "cost_tier")]
    cost_tier: String,
    #[serde(alias = "latency_class")]
    latency_class: String,
    #[serde(default, alias = "backend_id")]
    backend_id: Option<String>,
    #[serde(default, alias = "backend_class")]
    backend_class: Option<String>,
    #[serde(default)]
    specializations: Option<Vec<String>>,
    #[serde(default)]
    connectivity: Option<RuntimeBackendConnectivitySummary>,
    #[serde(default)]
    lease: Option<RuntimeBackendLeaseSummary>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpIntegrationIdRequest {
    #[serde(alias = "integration_id")]
    integration_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpIntegrationSetStateRequest {
    #[serde(alias = "integration_id")]
    integration_id: String,
    state: String,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpIntegrationProbeRequest {
    #[serde(alias = "integration_id")]
    integration_id: String,
    #[serde(default)]
    force: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpHttpInitializeServerInfo {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    version: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcpHttpInitializeResult {
    #[serde(default, alias = "protocol_version")]
    protocol_version: Option<String>,
    #[serde(default, alias = "server_info")]
    server_info: Option<AcpHttpInitializeServerInfo>,
    #[serde(default)]
    capabilities: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
struct AcpHttpJsonRpcError {
    message: String,
}

#[derive(Clone, Debug, Deserialize)]
struct AcpHttpJsonRpcResponse {
    id: Value,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<AcpHttpJsonRpcError>,
}

struct AcpProbeOutcome {
    readiness: RuntimeBackendReadinessSummary,
    healthy: bool,
    last_error: Option<String>,
    protocol_version: Option<String>,
    server_name: Option<String>,
    server_version: Option<String>,
    config_options: Option<Value>,
}

fn push_unique_reason(reasons: &mut Vec<String>, reason: &str) {
    let reason = reason.trim();
    if reason.is_empty() || reasons.iter().any(|entry| entry == reason) {
        return;
    }
    reasons.push(reason.to_string());
}

fn normalize_transport_config(
    config: AcpIntegrationTransportConfig,
) -> Result<AcpIntegrationTransportConfig, RpcError> {
    match config {
        AcpIntegrationTransportConfig::Stdio {
            command,
            args,
            cwd,
            env,
        } => {
            let command = command.trim().to_string();
            if command.is_empty() {
                return Err(RpcError::invalid_params(
                    "ACP stdio transport requires a command.",
                ));
            }
            let cwd = trim_optional_string(cwd);
            let args = args
                .into_iter()
                .map(|entry| entry.trim().to_string())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>();
            let env = env
                .into_iter()
                .filter_map(|(key, value)| {
                    let key = key.trim().to_string();
                    if key.is_empty() {
                        return None;
                    }
                    Some((key, value))
                })
                .collect::<HashMap<_, _>>();
            Ok(AcpIntegrationTransportConfig::Stdio {
                command,
                args,
                cwd,
                env,
            })
        }
        AcpIntegrationTransportConfig::Http {
            endpoint,
            experimental,
            headers,
        } => {
            let endpoint = endpoint.trim().to_string();
            if endpoint.is_empty() {
                return Err(RpcError::invalid_params(
                    "ACP http transport requires an endpoint.",
                ));
            }
            reqwest::Url::parse(endpoint.as_str()).map_err(|error| {
                RpcError::invalid_params(format!("ACP http endpoint is invalid: {error}"))
            })?;
            let headers = headers
                .into_iter()
                .filter_map(|(key, value)| {
                    let key = key.trim().to_string();
                    if key.is_empty() {
                        return None;
                    }
                    Some((key, value))
                })
                .collect::<HashMap<_, _>>();
            Ok(AcpIntegrationTransportConfig::Http {
                endpoint,
                experimental,
                headers,
            })
        }
    }
}

fn normalize_acp_state(value: Option<&str>) -> Result<String, RpcError> {
    let normalized = value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .unwrap_or("active")
        .to_ascii_lowercase();
    match normalized.as_str() {
        "active" | "draining" | "disabled" | "degraded" => Ok(normalized),
        _ => Err(RpcError::invalid_params(format!(
            "Unsupported ACP integration state `{normalized}`."
        ))),
    }
}

fn normalize_optional_backend_class(value: Option<String>) -> Result<Option<String>, RpcError> {
    value
        .map(|entry| match entry.trim().to_ascii_lowercase().as_str() {
            "primary" | "burst" | "specialized" => Ok(entry.trim().to_ascii_lowercase()),
            other => Err(RpcError::invalid_params(format!(
                "Unsupported backendClass `{other}` for ACP integration."
            ))),
        })
        .transpose()
}

fn normalize_optional_specializations(value: Option<Vec<String>>) -> Option<Vec<String>> {
    let mut entries = value
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    entries.sort_unstable();
    entries.dedup();
    (!entries.is_empty()).then_some(entries)
}

fn normalize_optional_connectivity(
    value: Option<RuntimeBackendConnectivitySummary>,
) -> Result<Option<RuntimeBackendConnectivitySummary>, RpcError> {
    let Some(mut connectivity) = value else {
        return Ok(None);
    };
    connectivity.mode = connectivity
        .mode
        .map(|entry| match entry.trim().to_ascii_lowercase().as_str() {
            "direct" | "overlay" | "gateway" => Ok(entry.trim().to_ascii_lowercase()),
            other => Err(RpcError::invalid_params(format!(
                "Unsupported ACP connectivity mode `{other}`."
            ))),
        })
        .transpose()?;
    connectivity.overlay = connectivity
        .overlay
        .map(|entry| match entry.trim().to_ascii_lowercase().as_str() {
            "tailscale" | "netbird" | "orbit" => Ok(entry.trim().to_ascii_lowercase()),
            other => Err(RpcError::invalid_params(format!(
                "Unsupported ACP overlay `{other}`."
            ))),
        })
        .transpose()?;
    connectivity.reachability = connectivity
        .reachability
        .map(|entry| match entry.trim().to_ascii_lowercase().as_str() {
            "reachable" | "degraded" | "unreachable" | "unknown" => {
                Ok(entry.trim().to_ascii_lowercase())
            }
            other => Err(RpcError::invalid_params(format!(
                "Unsupported ACP reachability `{other}`."
            ))),
        })
        .transpose()?;
    Ok(Some(connectivity))
}

fn normalize_optional_lease(
    value: Option<RuntimeBackendLeaseSummary>,
) -> Result<Option<RuntimeBackendLeaseSummary>, RpcError> {
    let Some(mut lease) = value else {
        return Ok(None);
    };
    lease.status = match lease.status.trim().to_ascii_lowercase().as_str() {
        "active" | "expiring" | "expired" | "released" | "none" => {
            lease.status.trim().to_ascii_lowercase()
        }
        other => {
            return Err(RpcError::invalid_params(format!(
                "Unsupported ACP lease status `{other}`."
            )))
        }
    };
    lease.scope = lease
        .scope
        .map(|entry| match entry.trim().to_ascii_lowercase().as_str() {
            "backend" | "slot" | "node" | "overlay-session" => {
                Ok(entry.trim().to_ascii_lowercase())
            }
            other => Err(RpcError::invalid_params(format!(
                "Unsupported ACP lease scope `{other}`."
            ))),
        })
        .transpose()?;
    Ok(Some(lease))
}

fn derive_backend_id(integration_id: &str, requested_backend_id: Option<&str>) -> String {
    requested_backend_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("{ACP_BACKEND_PREFIX}{integration_id}"))
}

fn transport_label(config: &AcpIntegrationTransportConfig) -> &'static str {
    match config {
        AcpIntegrationTransportConfig::Stdio { .. } => "stdio",
        AcpIntegrationTransportConfig::Http { .. } => "http",
    }
}

fn projection_rollout_state(state: &str) -> &'static str {
    match state {
        "draining" => "draining",
        "disabled" => "drained",
        _ => "current",
    }
}

fn projection_status(state: &str) -> &'static str {
    match state {
        "draining" => "draining",
        "disabled" => "disabled",
        "degraded" => "disabled",
        _ => "active",
    }
}

fn projection_health(summary: &AcpIntegrationSummary) -> bool {
    summary.state == "active" && summary.healthy
}

fn project_integration_backend(summary: &AcpIntegrationSummary) -> RuntimeBackendSummary {
    let mut backend = RuntimeBackendSummary {
        backend_id: summary.backend_id.clone(),
        display_name: summary.display_name.clone(),
        capabilities: summary.capabilities.clone(),
        max_concurrency: summary.max_concurrency,
        cost_tier: summary.cost_tier.clone(),
        latency_class: summary.latency_class.clone(),
        rollout_state: projection_rollout_state(summary.state.as_str()).to_string(),
        status: projection_status(summary.state.as_str()).to_string(),
        healthy: projection_health(summary),
        health_score: if projection_health(summary) { 1.0 } else { 0.0 },
        failures: u64::from(!summary.healthy),
        queue_depth: 0,
        running_tasks: 0,
        created_at: summary.created_at,
        updated_at: summary.updated_at,
        last_heartbeat_at: summary.last_probe_at.unwrap_or(summary.updated_at),
        heartbeat_interval_ms: None,
        backend_class: summary.backend_class.clone(),
        specializations: summary.specializations.clone(),
        policy: Some(default_runtime_backend_policy_profile()),
        connectivity: summary.connectivity.clone(),
        lease: summary.lease.clone(),
        readiness: summary.readiness.clone(),
        backend_kind: Some("acp".to_string()),
        integration_id: Some(summary.integration_id.clone()),
        transport: Some(summary.transport.clone()),
        origin: Some("acp-projection".to_string()),
        contract: None,
    };
    backend.contract = Some(build_runtime_backend_contract(&backend));
    backend
}

fn runtime_backend_is_acp_projection(summary: &RuntimeBackendSummary) -> bool {
    summary.origin.as_deref() == Some("acp-projection")
        || summary.backend_kind.as_deref() == Some("acp")
        || summary.backend_id.starts_with(ACP_BACKEND_PREFIX)
}

fn acp_command_exists(command: &str) -> bool {
    let command_path = Path::new(command);
    if command_path.is_absolute() || command.contains(std::path::MAIN_SEPARATOR) {
        return command_path.is_file();
    }
    std::env::var_os("PATH")
        .map(|path| {
            std::env::split_paths(&path).any(|entry| {
                let candidate = entry.join(command);
                candidate.is_file()
            })
        })
        .unwrap_or(false)
}

async fn probe_summary(ctx: &AppContext, summary: &mut AcpIntegrationSummary) {
    let probe_outcome = match &summary.transport_config {
        AcpIntegrationTransportConfig::Stdio {
            command,
            args,
            cwd,
            env,
        } => {
            if !acp_command_exists(command.as_str()) {
                build_probe_failure(
                    now_ms(),
                    "ACP stdio command is unavailable, so runtime readiness cannot be confirmed."
                        .to_string(),
                    format!("ACP stdio command `{command}` was not found."),
                    Some("failed"),
                    None,
                    Some("not_applicable"),
                )
            } else {
                match probe_acp_stdio_initialize(
                    command.as_str(),
                    args.as_slice(),
                    cwd.as_deref(),
                    env,
                )
                .await
                {
                    Ok(metadata) => build_stdio_probe_success(now_ms(), metadata),
                    Err(error) => build_probe_failure(
                        now_ms(),
                        "ACP stdio initialize handshake failed.".to_string(),
                        error,
                        Some("failed"),
                        None,
                        Some("not_applicable"),
                    ),
                }
            }
        }
        AcpIntegrationTransportConfig::Http {
            endpoint, headers, ..
        } => probe_acp_http_initialize(ctx, endpoint.as_str(), headers).await,
    };

    summary.last_probe_at = probe_outcome.readiness.checked_at;
    summary.updated_at = now_ms();
    summary.protocol_version = probe_outcome.protocol_version;
    summary.server_name = probe_outcome.server_name;
    summary.server_version = probe_outcome.server_version;
    summary.config_options = probe_outcome.config_options;
    summary.readiness = Some(probe_outcome.readiness.clone());
    summary.healthy = probe_outcome.healthy;
    summary.last_error = probe_outcome.last_error.clone();
    if probe_outcome.healthy {
        if summary.state == "degraded" {
            summary.state = "active".to_string();
        }
    } else if summary.state == "active" {
        summary.state = "degraded".to_string();
    }
}

async fn persist_acp_integrations(ctx: &AppContext) -> Result<(), RpcError> {
    let entries = {
        let store = ctx.acp_integrations.read().await;
        store.list()
    };
    let encoded = serde_json::to_value(entries)
        .map_err(|error| RpcError::internal(format!("encode ACP integrations failed: {error}")))?;
    ctx.native_state_store
        .upsert_setting_value(
            native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
            ACP_INTEGRATIONS_STATE_KEY,
            encoded,
        )
        .await
        .map_err(RpcError::internal)?;
    Ok(())
}

pub(crate) fn hydrate_acp_integrations_from_native_store(
    native_state_store: &native_state_store::NativeStateStore,
) -> AcpIntegrationStore {
    let persisted = match native_state_store.get_setting_value_blocking(
        native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
        ACP_INTEGRATIONS_STATE_KEY,
    ) {
        Ok(value) => value,
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to hydrate ACP integrations from native state store"
            );
            return AcpIntegrationStore::default();
        }
    };
    let Some(value) = persisted else {
        return AcpIntegrationStore::default();
    };
    let Ok(entries) = serde_json::from_value::<Vec<AcpIntegrationSummary>>(value) else {
        warn!("persisted ACP integrations payload is invalid");
        return AcpIntegrationStore::default();
    };
    let mut store = AcpIntegrationStore::default();
    for entry in entries {
        if entry.integration_id.trim().is_empty() {
            continue;
        }
        store.entries.insert(entry.integration_id.clone(), entry);
    }
    store
}

pub(crate) fn sync_projected_backends_into_map(
    store: &AcpIntegrationStore,
    runtime_backends: &mut HashMap<String, RuntimeBackendSummary>,
) {
    runtime_backends.retain(|_, summary| !runtime_backend_is_acp_projection(summary));
    for summary in store.entries.values() {
        runtime_backends.insert(
            summary.backend_id.clone(),
            project_integration_backend(summary),
        );
    }
}

pub(crate) async fn sync_projected_backends(ctx: &AppContext) {
    let projections = {
        let store = ctx.acp_integrations.read().await;
        store
            .entries
            .values()
            .map(project_integration_backend)
            .collect::<Vec<_>>()
    };
    let mut runtime_backends = ctx.runtime_backends.write().await;
    runtime_backends.retain(|_, summary| !runtime_backend_is_acp_projection(summary));
    for projection in projections {
        runtime_backends.insert(projection.backend_id.clone(), projection);
    }
}

impl AcpIntegrationStore {
    fn list(&self) -> Vec<AcpIntegrationSummary> {
        let mut entries = self.entries.values().cloned().collect::<Vec<_>>();
        entries.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.integration_id.cmp(&right.integration_id))
        });
        entries
    }

    pub(crate) fn find_by_backend_id(&self, backend_id: &str) -> Option<AcpIntegrationSummary> {
        let backend_id = backend_id.trim();
        if backend_id.is_empty() {
            return None;
        }
        self.entries
            .values()
            .find(|entry| entry.backend_id == backend_id)
            .cloned()
    }

    pub(crate) fn apply_probe_metadata(
        &mut self,
        integration_id: &str,
        metadata: crate::acp_runtime::AcpInitializeProbeMetadata,
    ) {
        let Some(entry) = self.entries.get_mut(integration_id.trim()) else {
            return;
        };
        let readiness = build_stdio_probe_success(now_ms(), metadata.clone()).readiness;
        entry.protocol_version = metadata.protocol_version;
        entry.server_name = metadata.server_name;
        entry.server_version = metadata.server_version;
        entry.readiness = Some(readiness);
        entry.config_options = metadata.config_options;
    }
}

pub(crate) async fn handle_acp_integrations_list(ctx: &AppContext) -> Result<Value, RpcError> {
    let store = ctx.acp_integrations.read().await;
    Ok(json!(store.list()))
}

pub(crate) async fn handle_acp_integration_upsert(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: AcpIntegrationUpsertRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid ACP integration payload: {error}"))
        })?;
    let integration_id = request.integration_id.trim().to_string();
    if integration_id.is_empty() {
        return Err(RpcError::invalid_params("ACP integration id is required."));
    }
    let display_name = request.display_name.trim().to_string();
    if display_name.is_empty() {
        return Err(RpcError::invalid_params(
            "ACP integration display name is required.",
        ));
    }
    if request.max_concurrency == 0 {
        return Err(RpcError::invalid_params(
            "ACP integration maxConcurrency must be greater than 0.",
        ));
    }
    let transport_config = normalize_transport_config(request.transport_config)?;
    let backend_class = normalize_optional_backend_class(request.backend_class)?;
    let specializations = normalize_optional_specializations(request.specializations);
    let connectivity = normalize_optional_connectivity(request.connectivity)?;
    let lease = normalize_optional_lease(request.lease)?;
    let now = now_ms();
    let mut summary = {
        let mut store = ctx.acp_integrations.write().await;
        let created_at = store
            .entries
            .get(integration_id.as_str())
            .map(|entry| entry.created_at)
            .unwrap_or(now);
        let existing = store.entries.get(integration_id.as_str()).cloned();
        let mut summary = existing.unwrap_or(AcpIntegrationSummary {
            integration_id: integration_id.clone(),
            backend_id: derive_backend_id(integration_id.as_str(), request.backend_id.as_deref()),
            display_name: display_name.clone(),
            state: normalize_acp_state(request.state.as_deref())?,
            transport: transport_label(&transport_config).to_string(),
            transport_config: transport_config.clone(),
            healthy: false,
            last_error: None,
            last_probe_at: None,
            protocol_version: None,
            server_name: None,
            server_version: None,
            config_options: None,
            capabilities: request.capabilities.clone(),
            max_concurrency: request.max_concurrency,
            cost_tier: request.cost_tier.clone(),
            latency_class: request.latency_class.clone(),
            backend_class: backend_class.clone(),
            specializations: specializations.clone(),
            connectivity: connectivity.clone(),
            lease: lease.clone(),
            readiness: None,
            created_at,
            updated_at: now,
        });
        summary.backend_id =
            derive_backend_id(integration_id.as_str(), request.backend_id.as_deref());
        summary.display_name = display_name;
        summary.state =
            normalize_acp_state(request.state.as_deref().or(Some(summary.state.as_str())))?;
        summary.transport = transport_label(&transport_config).to_string();
        summary.transport_config = transport_config;
        summary.capabilities = request.capabilities;
        summary.max_concurrency = request.max_concurrency;
        summary.cost_tier = request.cost_tier;
        summary.latency_class = request.latency_class;
        summary.backend_class = backend_class;
        summary.specializations = specializations;
        summary.connectivity = connectivity;
        summary.lease = lease;
        summary.updated_at = now;
        summary.created_at = created_at;
        store
            .entries
            .insert(integration_id.clone(), summary.clone());
        summary
    };
    if summary.state == "active" {
        probe_summary(ctx, &mut summary).await;
    }
    {
        let mut store = ctx.acp_integrations.write().await;
        store
            .entries
            .insert(summary.integration_id.clone(), summary.clone());
    }
    sync_projected_backends(ctx).await;
    let projection = project_integration_backend(&summary);
    persist_distributed_runtime_backend_summary(ctx, &projection)
        .await
        .map_err(RpcError::internal)?;
    persist_acp_integrations(ctx).await?;
    Ok(json!(summary))
}

pub(crate) async fn handle_acp_integration_remove(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: AcpIntegrationIdRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid ACP integration id payload: {error}"))
        })?;
    let removed = {
        let mut store = ctx.acp_integrations.write().await;
        store.entries.remove(request.integration_id.as_str())
    };
    let Some(removed) = removed else {
        return Ok(json!(false));
    };
    {
        let mut backends = ctx.runtime_backends.write().await;
        backends.remove(removed.backend_id.as_str());
    }
    let _ = remove_distributed_runtime_backend(ctx, removed.backend_id.as_str()).await;
    persist_acp_integrations(ctx).await?;
    Ok(json!(true))
}

pub(crate) async fn handle_acp_integration_set_state(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: AcpIntegrationSetStateRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid ACP integration state payload: {error}"))
        })?;
    let _reason = request.reason;
    let next_state = normalize_acp_state(Some(request.state.as_str()))?;
    let mut summary = {
        let mut store = ctx.acp_integrations.write().await;
        let Some(summary) = store.entries.get_mut(request.integration_id.as_str()) else {
            return Err(RpcError::invalid_params(format!(
                "ACP integration `{}` not found.",
                request.integration_id
            )));
        };
        summary.state = next_state;
        summary.updated_at = now_ms();
        if summary.state == "disabled" {
            summary.healthy = false;
        }
        summary.clone()
    };
    if summary.state == "active" {
        probe_summary(ctx, &mut summary).await;
        let mut store = ctx.acp_integrations.write().await;
        store
            .entries
            .insert(summary.integration_id.clone(), summary.clone());
    }
    sync_projected_backends(ctx).await;
    let projection = project_integration_backend(&summary);
    persist_distributed_runtime_backend_summary(ctx, &projection)
        .await
        .map_err(RpcError::internal)?;
    persist_acp_integrations(ctx).await?;
    Ok(json!(summary))
}

pub(crate) async fn handle_acp_integration_probe(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: AcpIntegrationProbeRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid ACP integration probe payload: {error}"))
        })?;
    let _force = request.force.unwrap_or(false);
    let mut summary = {
        let store = ctx.acp_integrations.read().await;
        let Some(summary) = store.entries.get(request.integration_id.as_str()) else {
            return Err(RpcError::invalid_params(format!(
                "ACP integration `{}` not found.",
                request.integration_id
            )));
        };
        summary.clone()
    };
    probe_summary(ctx, &mut summary).await;
    {
        let mut store = ctx.acp_integrations.write().await;
        store
            .entries
            .insert(summary.integration_id.clone(), summary.clone());
    }
    sync_projected_backends(ctx).await;
    let projection = project_integration_backend(&summary);
    persist_distributed_runtime_backend_summary(ctx, &projection)
        .await
        .map_err(RpcError::internal)?;
    persist_acp_integrations(ctx).await?;
    Ok(json!(summary))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stdio_probe_success_requires_capability_confirmation() {
        let outcome = build_stdio_probe_success(
            42,
            crate::acp_runtime::AcpInitializeProbeMetadata {
                protocol_version: Some("2026-03-17".to_string()),
                server_name: Some("fake-acp".to_string()),
                server_version: Some("0.1.0".to_string()),
                capabilities: None,
                config_options: None,
            },
        );

        assert_eq!(outcome.readiness.state, "blocked");
        assert_eq!(outcome.readiness.handshake_state.as_deref(), Some("ready"));
        assert_eq!(
            outcome.readiness.capability_state.as_deref(),
            Some("blocked")
        );
        assert!(outcome
            .readiness
            .reasons
            .iter()
            .any(|reason| reason.contains("capabilities")));
        assert!(!outcome.healthy);
    }

    #[test]
    fn probe_failure_preserves_auth_failure_taxonomy() {
        let outcome = build_probe_failure(
            7,
            "ACP HTTP endpoint rejected runtime authentication during initialize.".to_string(),
            "ACP http initialize returned auth status 401 Unauthorized.".to_string(),
            Some("rejected"),
            None,
            Some("failed"),
        );

        assert_eq!(outcome.readiness.state, "blocked");
        assert_eq!(
            outcome.readiness.handshake_state.as_deref(),
            Some("rejected")
        );
        assert_eq!(outcome.readiness.auth_state.as_deref(), Some("failed"));
        assert_eq!(
            outcome.last_error.as_deref(),
            Some("ACP http initialize returned auth status 401 Unauthorized.")
        );
    }
}
