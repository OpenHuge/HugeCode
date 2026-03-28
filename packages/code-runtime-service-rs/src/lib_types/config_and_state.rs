#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProviderExtensionInput {
    provider_id: String,
    display_name: String,
    pool: String,
    default_model_id: String,
    compat_base_url: String,
    #[serde(default)]
    aliases: Vec<String>,
    #[serde(default)]
    api_key_env: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
}

#[derive(Clone, Debug)]
pub struct RuntimeProviderExtension {
    pub provider_id: String,
    pub display_name: String,
    pub pool: String,
    pub default_model_id: String,
    pub compat_base_url: String,
    pub aliases: Vec<String>,
    pub api_key_env: String,
    pub api_key: Option<String>,
}

#[derive(Clone, Debug)]
pub struct RuntimeResolvedProviderExtension {
    pub provider_id: String,
    pub display_name: String,
    pub pool: String,
    pub default_model_id: String,
    pub compat_base_url: String,
    pub aliases: Vec<String>,
    pub api_key_env: String,
    pub api_key: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RuntimeProvider {
    OpenAI,
    Anthropic,
    ClaudeCodeLocal,
    Google,
}

#[derive(Clone, Copy, Debug)]
struct RuntimeProviderSpec {
    provider: RuntimeProvider,
    routed_provider: &'static str,
    routed_pool: &'static str,
    oauth_provider: &'static str,
    default_model_id: &'static str,
    display_name: &'static str,
    aliases: &'static [&'static str],
}

const RUNTIME_PROVIDER_SPECS: &[RuntimeProviderSpec] = &[
    RuntimeProviderSpec {
        provider: RuntimeProvider::OpenAI,
        routed_provider: "openai",
        routed_pool: "codex",
        oauth_provider: "codex",
        default_model_id: DEFAULT_OPENAI_MODEL_ID,
        display_name: "OpenAI",
        aliases: &["openai", "codex", "openai-codex"],
    },
    RuntimeProviderSpec {
        provider: RuntimeProvider::Anthropic,
        routed_provider: "anthropic",
        routed_pool: "claude",
        oauth_provider: "claude_code",
        default_model_id: DEFAULT_ANTHROPIC_MODEL_ID,
        display_name: "Anthropic",
        aliases: &["anthropic", "claude", "claude_code", "claude-code"],
    },
    RuntimeProviderSpec {
        provider: RuntimeProvider::ClaudeCodeLocal,
        routed_provider: "claude_code_local",
        routed_pool: "claude_code_local",
        oauth_provider: "",
        default_model_id: DEFAULT_ANTHROPIC_MODEL_ID,
        display_name: "Claude Code Local",
        aliases: &["claude_code_local"],
    },
    RuntimeProviderSpec {
        provider: RuntimeProvider::Google,
        routed_provider: "google",
        routed_pool: "gemini",
        oauth_provider: "gemini",
        default_model_id: DEFAULT_GEMINI_MODEL_ID,
        display_name: "Google",
        aliases: &[
            "google",
            "gemini",
            "antigravity",
            "anti-gravity",
            "gemini-antigravity",
        ],
    },
];

impl RuntimeProvider {
    fn all() -> impl Iterator<Item = RuntimeProvider> {
        RUNTIME_PROVIDER_SPECS.iter().map(|entry| entry.provider)
    }

    fn specs() -> &'static [RuntimeProviderSpec] {
        RUNTIME_PROVIDER_SPECS
    }

    fn spec(self) -> &'static RuntimeProviderSpec {
        match self {
            Self::OpenAI => &RUNTIME_PROVIDER_SPECS[0],
            Self::Anthropic => &RUNTIME_PROVIDER_SPECS[1],
            Self::ClaudeCodeLocal => &RUNTIME_PROVIDER_SPECS[2],
            Self::Google => &RUNTIME_PROVIDER_SPECS[3],
        }
    }

    pub(crate) fn from_alias(value: Option<&str>) -> Option<Self> {
        let normalized = value?.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            return None;
        }
        RUNTIME_PROVIDER_SPECS
            .iter()
            .find(|entry| entry.aliases.iter().any(|alias| *alias == normalized))
            .map(|entry| entry.provider)
    }

    fn display_name(self) -> &'static str {
        self.spec().display_name
    }

    fn aliases(self) -> &'static [&'static str] {
        self.spec().aliases
    }

    fn routed_provider(self) -> &'static str {
        self.spec().routed_provider
    }

    fn routed_pool(self) -> &'static str {
        self.spec().routed_pool
    }

    fn oauth_provider(self) -> &'static str {
        self.spec().oauth_provider
    }

    fn default_model_id(self) -> &'static str {
        self.spec().default_model_id
    }

    fn is_endpoint_valid(self, config: &ServiceConfig) -> bool {
        let endpoint = match self {
            Self::OpenAI => config.openai_endpoint.as_str(),
            Self::Anthropic => config.anthropic_endpoint.as_str(),
            Self::ClaudeCodeLocal => return true,
            Self::Google => config.gemini_endpoint.as_str(),
        };
        reqwest::Url::parse(endpoint.trim()).is_ok()
    }

    fn has_api_key(self, config: &ServiceConfig) -> bool {
        match self {
            Self::OpenAI => has_non_empty(config.openai_api_key.as_deref()),
            Self::Anthropic => has_non_empty(config.anthropic_api_key.as_deref()),
            Self::ClaudeCodeLocal => false,
            Self::Google => has_non_empty(config.gemini_api_key.as_deref()),
        }
    }
}

#[derive(Clone)]
pub struct ServiceConfig {
    pub default_model_id: String,
    pub openai_api_key: Option<String>,
    pub openai_endpoint: String,
    pub openai_compat_base_url: Option<String>,
    pub openai_compat_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub anthropic_endpoint: String,
    pub anthropic_version: String,
    pub gemini_api_key: Option<String>,
    pub gemini_endpoint: String,
    pub openai_timeout_ms: u64,
    pub openai_max_retries: u32,
    pub openai_retry_base_ms: u64,
    pub openai_compat_model_cache_ttl_ms: u64,
    pub live_skills_network_enabled: bool,
    pub live_skills_network_base_url: String,
    pub live_skills_network_timeout_ms: u64,
    pub live_skills_network_cache_ttl_ms: u64,
    pub sandbox_enabled: bool,
    pub sandbox_network_access: String,
    pub sandbox_allowed_hosts: Vec<String>,
    pub oauth_pool_db_path: String,
    pub oauth_secret_key: Option<String>,
    pub oauth_public_base_url: Option<String>,
    pub oauth_loopback_callback_port: u16,
    pub runtime_auth_token: Option<String>,
    pub agent_max_concurrent_tasks: usize,
    pub agent_task_history_limit: usize,
    pub distributed_enabled: bool,
    pub distributed_redis_url: Option<String>,
    pub distributed_lane_count: usize,
    pub distributed_worker_concurrency: usize,
    pub distributed_claim_idle_ms: u64,
    pub discovery_enabled: bool,
    pub discovery_service_type: String,
    pub discovery_browse_interval_ms: u64,
    pub discovery_stale_ttl_ms: u64,
    pub runtime_backend_id: String,
    pub runtime_backend_capabilities: Vec<String>,
    pub runtime_port: u16,
    pub ws_write_buffer_size_bytes: usize,
    pub ws_max_write_buffer_size_bytes: usize,
    pub ws_max_frame_size_bytes: usize,
    pub ws_max_message_size_bytes: usize,
    pub ws_max_connections: usize,
    pub provider_extension_seeds: Vec<RuntimeProviderExtension>,
}

#[derive(Clone)]
struct AppContext {
    state: SharedRuntimeState,
    config: ServiceConfig,
    client: reqwest::Client,
    oauth_pool: Arc<OAuthPoolStore>,
    oauth_pool_bootstrap_error: Option<String>,
    native_state_store: Arc<native_state_store::NativeStateStore>,
    runtime_diagnostics: Arc<RuntimeDiagnosticsState>,
    runtime_tool_metrics: Arc<AsyncMutex<runtime_tool_metrics::RuntimeToolExecutionMetricsStore>>,
    runtime_tool_guardrails: Arc<AsyncMutex<runtime_tool_guardrails::RuntimeToolGuardrailStore>>,
    extensions_store: Arc<RwLock<extensions_runtime::RuntimeExtensionStore>>,
    session_portability_store: Arc<RwLock<session_portability::SessionPortabilityStore>>,
    security_preflight_permission_store:
        Arc<RwLock<security_preflight::SecurityPreflightPermissionStore>>,
    compat_model_catalog_cache:
        Arc<RwLock<HashMap<CompatModelCatalogCacheKey, CachedCompatModelCatalog>>>,
    compat_model_catalog_refresh_locks:
        Arc<RwLock<HashMap<CompatModelCatalogCacheKey, Arc<AsyncMutex<()>>>>>,
    compat_model_catalog_failure_cache:
        Arc<RwLock<HashMap<CompatModelCatalogCacheKey, CachedCompatModelCatalogFailure>>>,
    terminal_sessions: Arc<RwLock<HashMap<String, ku0_runtime_shell_core::TerminalSessionRecord>>>,
    terminal_processes: Arc<std::sync::Mutex<ku0_runtime_shell_core::TerminalProcessRegistry>>,
    live_skill_network_cache: live_skills::LiveSkillNetworkCache,
    live_skill_js_repl_sessions: live_skills::LiveSkillCoreJsReplSessionStore,
    live_skill_execution_counters: live_skills::LiveSkillExecutionCounters,
    local_codex_sync_last_attempt_ms: Arc<AtomicU64>,
    service_codex_usage_refresh_last_attempt_ms: Arc<AtomicU64>,
    service_codex_usage_refresh_attempt_by_account_ms: Arc<RwLock<HashMap<String, u64>>>,
    turn_events: broadcast::Sender<TurnEventFrame>,
    turn_event_next_id: Arc<AtomicU64>,
    turn_event_replay_buffer: Arc<Mutex<TurnEventReplayBuffer>>,
    task_supervisor: RuntimeTaskSupervisor,
    latest_runtime_state_fabric_event: Arc<Mutex<Option<TurnEventFrame>>>,
    runtime_state_fabric_fanout_pending: Arc<Mutex<Option<TurnEventFrame>>>,
    runtime_state_fabric_fanout_notify: Arc<Notify>,
    runtime_state_fabric_fanout_active: Arc<AtomicBool>,
    thread_live_update_fanout_pending: Arc<Mutex<HashMap<String, TurnEventFrame>>>,
    thread_live_update_fanout_notify: Arc<Notify>,
    thread_live_update_fanout_active: Arc<AtomicBool>,
    runtime_fanout_shutdown: Arc<tokio_util::sync::CancellationToken>,
    revision_json_cache: Arc<Mutex<RuntimeRevisionJsonCache>>,
    runtime_task_counters_cache: Arc<Mutex<RuntimeTaskCounterCache>>,
    thread_live_subscriptions: Arc<RwLock<HashMap<String, ThreadLiveSubscription>>>,
    thread_live_heartbeat_tasks:
        Arc<AsyncMutex<HashMap<String, RuntimeTaskHandle<RuntimeTaskRunResult<()>>>>>,
    turn_interrupt_waiters: Arc<RwLock<HashMap<String, Arc<Notify>>>>,
    runtime_update_revision: Arc<AtomicU64>,
    runtime_update_last_event_at_ms: Arc<AtomicU64>,
    agent_tasks: Arc<RwLock<AgentTaskStore>>,
    agent_task_durability: Arc<agent_task_durability::AgentTaskDurabilityStore>,
    sub_agent_sessions: Arc<RwLock<sub_agents::SubAgentSessionStore>>,
    acp_integrations: Arc<RwLock<acp_client_adapter::AcpIntegrationStore>>,
    acp_runtime: Arc<AsyncMutex<acp_runtime::AcpRuntimeStore>>,
    runtime_backends: Arc<RwLock<HashMap<String, RuntimeBackendSummary>>>,
    runtime_backends_sync_last_hydrated_ms: Arc<AtomicU64>,
    runtime_backends_sync_lock: Arc<AsyncMutex<()>>,
    agent_workspace_locks: Arc<RwLock<HashMap<String, Arc<AsyncMutex<()>>>>>,
    agent_task_execution_slots: Arc<Semaphore>,
    ws_connection_slots: Arc<Semaphore>,
    distributed_config: distributed::config::DistributedRuntimeConfig,
    distributed_redis_client: Option<Arc<redis::Client>>,
    distributed_dispatch_errors: Arc<RwLock<HashMap<String, String>>>,
    distributed_readiness_snapshot_cache: Arc<RwLock<Option<CachedDistributedReadinessSnapshot>>>,
    lifecycle_sweeper_mode: String,
    lifecycle_sweeper_lease_leader: Arc<RwLock<Option<String>>>,
    lifecycle_sweeper_observability: Arc<RwLock<LifecycleSweeperObservabilityState>>,
    discovery_advertisement: Arc<RuntimeDiscoveryAdvertisement>,
    discovery_managed_backends: Arc<RwLock<HashMap<String, u64>>>,
    discovery_upsert_total: Arc<AtomicU64>,
    discovery_stale_remove_total: Arc<AtomicU64>,
    codex_oauth_pending_logins:
        Arc<AsyncMutex<HashMap<String, codex_oauth_handlers::PendingCodexOauthLogin>>>,
    codex_oauth_loopback_listener:
        Arc<AsyncMutex<Option<codex_oauth_handlers::CodexOauthLoopbackListenerHandle>>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
enum RuntimeRevisionCacheKey {
    MissionControlSnapshot,
    MissionControlSummary { workspace_id: Option<String> },
    KernelProjectionMissionControlSlice,
    KernelProjectionJobsSlice,
    KernelProjectionSessionsSlice,
    KernelProjectionCapabilitiesSlice,
    KernelProjectionExtensionsSlice,
    KernelProjectionContinuitySlice,
    KernelProjectionDiagnosticsSlice,
    RuntimeCheckpointReviewEvidence { workspace_id: Option<String> },
    RuntimeSubAgentSessionEvidence { workspace_id: Option<String> },
}

#[derive(Clone, Debug, Default)]
struct RuntimeRevisionJsonCache {
    revision: u64,
    entries: HashMap<RuntimeRevisionCacheKey, serde_json::Value>,
}

#[derive(Clone, Copy, Debug, Default)]
struct RuntimeTaskCounterCache {
    revision: u64,
    counters: Option<distributed_runtime::RuntimeTaskCounters>,
}

pub(crate) fn read_runtime_revision_cached_json_value(
    ctx: &AppContext,
    key: &RuntimeRevisionCacheKey,
    revision: u64,
) -> Option<serde_json::Value> {
    let mut recovered_from_poison = false;
    let mut cache = match ctx.revision_json_cache.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };
    if recovered_from_poison {
        tracing::warn!("recovered poisoned runtime revision cache lock");
    }
    if cache.revision != revision {
        cache.revision = revision;
        cache.entries.clear();
        return None;
    }
    cache.entries.get(key).cloned()
}

pub(crate) fn store_runtime_revision_cached_json_value(
    ctx: &AppContext,
    key: RuntimeRevisionCacheKey,
    revision: u64,
    value: &serde_json::Value,
) {
    let mut recovered_from_poison = false;
    let mut cache = match ctx.revision_json_cache.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };
    if recovered_from_poison {
        tracing::warn!("recovered poisoned runtime revision cache lock");
    }
    if cache.revision != revision {
        cache.revision = revision;
        cache.entries.clear();
    }
    cache.entries.insert(key, value.clone());
}

pub(crate) fn read_runtime_task_counters_cache(
    ctx: &AppContext,
    revision: u64,
) -> Option<distributed_runtime::RuntimeTaskCounters> {
    let mut recovered_from_poison = false;
    let mut cache = match ctx.runtime_task_counters_cache.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };
    if recovered_from_poison {
        tracing::warn!("recovered poisoned runtime task counter cache lock");
    }
    if cache.revision != revision {
        cache.revision = revision;
        cache.counters = None;
        return None;
    }
    cache.counters
}

pub(crate) fn store_runtime_task_counters_cache(
    ctx: &AppContext,
    revision: u64,
    counters: distributed_runtime::RuntimeTaskCounters,
) {
    let mut recovered_from_poison = false;
    let mut cache = match ctx.runtime_task_counters_cache.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            recovered_from_poison = true;
            poisoned.into_inner()
        }
    };
    if recovered_from_poison {
        tracing::warn!("recovered poisoned runtime task counter cache lock");
    }
    if cache.revision != revision {
        cache.revision = revision;
    }
    cache.counters = Some(counters);
}

pub(crate) const RUNTIME_WORKSPACES_STATE_KEY: &str = "workspaces";
pub(crate) const ACP_INTEGRATIONS_STATE_KEY: &str = "acp_integrations_v1";
pub(crate) const RUNTIME_BACKENDS_STATE_KEY: &str = "runtime_backends_v1";

#[derive(Clone, Debug)]
struct LifecycleSweeperObservabilityState {
    lease_state: String,
    last_sweep_at: Option<u64>,
    last_lease_renew_at: Option<u64>,
    last_lease_error_code: Option<String>,
    lease_unhealthy_since_at: Option<u64>,
}

impl Default for LifecycleSweeperObservabilityState {
    fn default() -> Self {
        Self {
            lease_state: "follower".to_string(),
            last_sweep_at: None,
            last_lease_renew_at: None,
            last_lease_error_code: None,
            lease_unhealthy_since_at: None,
        }
    }
}

#[derive(Default)]
struct RuntimeDiscoveryAdvertisement {
    advertisement_id: std::sync::Mutex<Option<String>>,
}

impl RuntimeDiscoveryAdvertisement {
    fn set(&self, advertisement_id: String) {
        let mut guard = match self.advertisement_id.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        *guard = Some(advertisement_id);
    }
}

impl Drop for RuntimeDiscoveryAdvertisement {
    fn drop(&mut self) {
        let advertisement_id = {
            let mut guard = match self.advertisement_id.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            guard.take()
        };
        if let Some(advertisement_id) = advertisement_id {
            let _ = discovery_rs::advertise_stop(advertisement_id.as_str());
        }
    }
}

#[derive(Debug, Clone)]
struct CachedCompatModelCatalog {
    catalog: CompatModelCatalog,
    fetched_at: Instant,
}

#[derive(Debug, Clone)]
struct CachedCompatModelCatalogFailure {
    error: String,
    failed_at: Instant,
}

#[derive(Clone, Debug)]
struct CachedDistributedReadinessSnapshot {
    snapshot: distributed::diagnostics::DistributedReadinessSnapshot,
    fetched_at: Instant,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct CompatModelCatalogCacheKey {
    base_url: String,
    api_key_fingerprint: u64,
}

#[derive(Clone, Debug)]
struct OAuthRoutingCredentials {
    account_id: String,
    api_key: String,
    fallback_api_key: Option<String>,
    local_codex_id_token: Option<String>,
    local_codex_refresh_token: Option<String>,
    persist_local_codex_auth_updates: bool,
    credential_source: Option<String>,
    auth_mode: Option<String>,
    external_account_id: Option<String>,
    compat_base_url: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    id: String,
    path: String,
    display_name: String,
    connected: bool,
    default_model_id: Option<String>,
}

pub(crate) fn normalize_workspace_identity_path(path: &str) -> String {
    let normalized = path.trim().replace('\\', "/");
    let trimmed = normalized.trim_end_matches('/');
    let collapsed = if trimmed.is_empty() {
        normalized
    } else {
        trimmed.to_string()
    };
    if cfg!(windows) {
        collapsed.to_lowercase()
    } else {
        collapsed
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadSummary {
    id: String,
    workspace_id: String,
    title: String,
    unread: bool,
    running: bool,
    created_at: u64,
    updated_at: u64,
    provider: String,
    model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(default)]
    archived: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_activity_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    agent_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    agent_nickname: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLogEntry {
    sha: String,
    summary: String,
    author: String,
    timestamp: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLogResponse {
    total: usize,
    entries: Vec<GitLogEntry>,
    ahead: usize,
    behind: usize,
    ahead_entries: Vec<GitLogEntry>,
    behind_entries: Vec<GitLogEntry>,
    upstream: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliSessionSummary {
    session_id: String,
    updated_at: u64,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    started_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    input_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cached_input_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_tokens: Option<u64>,
}

#[derive(Clone, Debug, Default)]
struct LocalCodexCliAuthProfile {
    external_account_id: Option<String>,
    email: Option<String>,
    auth_mode: Option<String>,
    plan_type: Option<String>,
    chatgpt_workspaces: Option<Vec<oauth_pool::OAuthAccountChatgptWorkspace>>,
    default_chatgpt_workspace_id: Option<String>,
    last_refresh: Option<String>,
    id_token: Option<String>,
    openai_api_key: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    api_credential: Option<String>,
    api_credential_source: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct LocalCodexCliAuthFileSignature {
    len: u64,
    modified: Option<SystemTime>,
}

#[derive(Clone, Debug, Default)]
struct LocalCodexCliAuthProfileCache {
    path: Option<PathBuf>,
    signature: Option<LocalCodexCliAuthFileSignature>,
    profile: Option<LocalCodexCliAuthProfile>,
}

static LOCAL_CODEX_CLI_AUTH_PROFILE_CACHE: LazyLock<Mutex<LocalCodexCliAuthProfileCache>> =
    LazyLock::new(|| Mutex::new(LocalCodexCliAuthProfileCache::default()));

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeCapabilityMatrix {
    supports_tools: String,
    supports_reasoning_effort: String,
    supports_vision: String,
    supports_json_schema: String,
    max_context_tokens: Option<u64>,
    supported_reasoning_efforts: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProviderCatalogEntry {
    provider_id: String,
    display_name: String,
    pool: Option<String>,
    oauth_provider_id: Option<String>,
    aliases: Vec<String>,
    default_model_id: Option<String>,
    available: bool,
    supports_native: bool,
    supports_openai_compat: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    readiness_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    readiness_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    execution_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    registry_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    capability_matrix: Option<RuntimeCapabilityMatrix>,
}

#[derive(Clone, Debug)]
enum TurnProviderRoute {
    Core(RuntimeProvider),
    Extension(RuntimeResolvedProviderExtension),
}

impl TurnProviderRoute {
    fn routed_provider(&self) -> &str {
        match self {
            Self::Core(provider) => provider.routed_provider(),
            Self::Extension(extension) => extension.provider_id.as_str(),
        }
    }

    fn routed_pool(&self) -> &str {
        match self {
            Self::Core(provider) => provider.routed_pool(),
            Self::Extension(extension) => extension.pool.as_str(),
        }
    }

    fn is_core_openai(&self) -> bool {
        matches!(self, Self::Core(RuntimeProvider::OpenAI))
    }

    fn is_core_claude_code_local(&self) -> bool {
        matches!(self, Self::Core(RuntimeProvider::ClaudeCodeLocal))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimePromptLibraryEntry {
    id: String,
    title: String,
    description: String,
    content: String,
    scope: String,
}

#[derive(Clone, Debug)]
struct RuntimePromptLibraryRecord {
    id: String,
    title: String,
    description: String,
    content: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum RuntimePromptScope {
    Global,
    Workspace,
}

impl RuntimePromptScope {
    fn as_str(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::Workspace => "workspace",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "global" => Some(Self::Global),
            "workspace" => Some(Self::Workspace),
            _ => None,
        }
    }
}

pub struct RuntimeState {
    workspaces: Vec<WorkspaceSummary>,
    workspace_threads: HashMap<String, Vec<ThreadSummary>>,
    prompt_library_global: Vec<RuntimePromptLibraryRecord>,
    prompt_library_workspace: HashMap<String, Vec<RuntimePromptLibraryRecord>>,
    runtime_policy_mode: String,
    runtime_policy_updated_at: u64,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            workspaces: Vec::new(),
            workspace_threads: HashMap::new(),
            prompt_library_global: Vec::new(),
            prompt_library_workspace: HashMap::new(),
            runtime_policy_mode: "strict".to_string(),
            runtime_policy_updated_at: now_ms(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBackendConnectivitySummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    overlay: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    endpoint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    reachability: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    checked_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBackendLeaseSummary {
    status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    lease_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    holder_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    acquired_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    expires_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ttl_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    observed_at: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBackendReadinessSummary {
    state: String,
    summary: String,
    #[serde(default)]
    reasons: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    checked_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    handshake_state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    capability_state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    auth_state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    protocol_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    server_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    server_version: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBackendPolicyProfile {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    trust_tier: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    data_sensitivity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    approval_policy: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    allowed_tool_classes: Option<Vec<String>>,
}

fn default_runtime_backend_allowed_tool_classes() -> Vec<String> {
    vec!["read".to_string(), "write".to_string()]
}

fn default_runtime_backend_policy_profile() -> RuntimeBackendPolicyProfile {
    RuntimeBackendPolicyProfile {
        trust_tier: Some("standard".to_string()),
        data_sensitivity: Some("internal".to_string()),
        approval_policy: Some("checkpoint-required".to_string()),
        allowed_tool_classes: Some(default_runtime_backend_allowed_tool_classes()),
    }
}

fn normalize_runtime_backend_policy_profile(
    policy: Option<RuntimeBackendPolicyProfile>,
) -> RuntimeBackendPolicyProfile {
    let mut normalized = policy.unwrap_or_else(default_runtime_backend_policy_profile);
    normalized.trust_tier = Some(match normalized.trust_tier.as_deref() {
        Some("trusted" | "standard" | "isolated") => {
            normalized.trust_tier.unwrap_or_else(|| "standard".to_string())
        }
        _ => "standard".to_string(),
    });
    normalized.data_sensitivity = Some(match normalized.data_sensitivity.as_deref() {
        Some("public" | "internal" | "restricted") => normalized
            .data_sensitivity
            .unwrap_or_else(|| "internal".to_string()),
        _ => "internal".to_string(),
    });
    normalized.approval_policy = Some(match normalized.approval_policy.as_deref() {
        Some("runtime-default" | "checkpoint-required" | "never-auto-approve") => normalized
            .approval_policy
            .unwrap_or_else(|| "checkpoint-required".to_string()),
        _ => "checkpoint-required".to_string(),
    });

    let mut allowed_tool_classes = normalized
        .allowed_tool_classes
        .unwrap_or_else(default_runtime_backend_allowed_tool_classes)
        .into_iter()
        .map(|entry| entry.trim().to_ascii_lowercase().replace('_', "-"))
        .filter(|entry| {
            matches!(
                entry.as_str(),
                "read" | "write" | "exec" | "network" | "browser" | "mcp"
            )
        })
        .collect::<Vec<_>>();
    allowed_tool_classes.sort_unstable();
    allowed_tool_classes.dedup();
    if allowed_tool_classes.is_empty() {
        allowed_tool_classes = default_runtime_backend_allowed_tool_classes();
    }
    normalized.allowed_tool_classes = Some(allowed_tool_classes);
    normalized
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBackendSummary {
    backend_id: String,
    display_name: String,
    capabilities: Vec<String>,
    max_concurrency: u64,
    cost_tier: String,
    latency_class: String,
    rollout_state: String,
    status: String,
    healthy: bool,
    health_score: f64,
    failures: u64,
    queue_depth: u64,
    running_tasks: u64,
    created_at: u64,
    updated_at: u64,
    last_heartbeat_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    heartbeat_interval_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    backend_class: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    specializations: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    connectivity: Option<RuntimeBackendConnectivitySummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    lease: Option<RuntimeBackendLeaseSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    readiness: Option<RuntimeBackendReadinessSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    policy: Option<RuntimeBackendPolicyProfile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    backend_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    integration_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    transport: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    origin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    contract: Option<Value>,
}

fn build_runtime_backend_contract(summary: &RuntimeBackendSummary) -> Value {
    let kind = if summary.origin.as_deref() == Some("acp-projection")
        || summary.backend_kind.as_deref() == Some("acp")
        || summary.backend_id.starts_with("acp:")
    {
        "acp"
    } else {
        "native"
    };
    serde_json::json!({
        "kind": kind,
        "origin": summary
            .origin
            .clone()
            .unwrap_or_else(|| if kind == "acp" {
                "acp-projection".to_string()
            } else {
                "runtime-native".to_string()
            }),
        "transport": summary.transport,
        "capabilityCount": summary.capabilities.len(),
        "health": summary.status,
        "rolloutState": summary.rollout_state,
        "backendClass": summary.backend_class,
        "reachability": summary
            .connectivity
            .as_ref()
            .and_then(|connectivity| connectivity.reachability.clone()),
        "leaseStatus": summary.lease.as_ref().map(|lease| lease.status.clone()),
        "readinessState": summary.readiness.as_ref().map(|readiness| readiness.state.clone()),
    })
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DistributedTaskGraphNodeSummary {
    task_id: String,
    parent_task_id: Option<String>,
    role: String,
    backend_id: Option<String>,
    status: String,
    attempt: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DistributedTaskGraphEdgeSummary {
    from_task_id: String,
    to_task_id: String,
    #[serde(rename = "type")]
    edge_type: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DistributedTaskGraphSummary {
    task_id: String,
    root_task_id: String,
    nodes: Vec<DistributedTaskGraphNodeSummary>,
    edges: Vec<DistributedTaskGraphEdgeSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<Value>,
}
