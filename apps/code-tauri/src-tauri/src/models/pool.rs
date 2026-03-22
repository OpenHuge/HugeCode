#![cfg_attr(not(test), allow(dead_code))]
use super::contracts::{ModelPoolEntry, RuntimeProviderCatalogEntry};
use crate::accounts::OAuthAccountRegistry;
use serde::Deserialize;
use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ModelProvider {
    OpenAi,
    Anthropic,
    Google,
}
impl ModelProvider {
    fn as_str(&self) -> &'static str {
        match self {
            Self::OpenAi => "openai",
            Self::Anthropic => "anthropic",
            Self::Google => "google",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ModelPool {
    Codex,
    Claude,
    Gemini,
}

impl ModelPool {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::Gemini => "gemini",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ModelSource {
    LocalCodex,
    OauthAccount,
}

impl ModelSource {
    fn as_str(&self) -> &'static str {
        match self {
            Self::LocalCodex => "local-codex",
            Self::OauthAccount => "oauth-account",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ModelCapability {
    Chat,
    Coding,
    Reasoning,
    Vision,
}

impl ModelCapability {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Chat => "chat",
            Self::Coding => "coding",
            Self::Reasoning => "reasoning",
            Self::Vision => "vision",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ReasonEffort {
    Low,
    Medium,
    High,
    XHigh,
}

impl ReasonEffort {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::XHigh => "xhigh",
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct ModelDescriptor {
    id: &'static str,
    display_name: &'static str,
    provider: ModelProvider,
    pool: ModelPool,
    source: ModelSource,
    supports_reasoning: bool,
    supports_vision: bool,
    reasoning_efforts: &'static [ReasonEffort],
    capabilities: &'static [ModelCapability],
}

const REASON_EFFORTS_STANDARD: &[ReasonEffort] =
    &[ReasonEffort::Low, ReasonEffort::Medium, ReasonEffort::High];
const REASON_EFFORTS_CODEX: &[ReasonEffort] = &[
    ReasonEffort::Low,
    ReasonEffort::Medium,
    ReasonEffort::High,
    ReasonEffort::XHigh,
];
const CAPABILITIES_FULL: &[ModelCapability] = &[
    ModelCapability::Chat,
    ModelCapability::Coding,
    ModelCapability::Reasoning,
    ModelCapability::Vision,
];
const CAPABILITIES_NO_VISION: &[ModelCapability] = &[
    ModelCapability::Chat,
    ModelCapability::Coding,
    ModelCapability::Reasoning,
];

const MODEL_CATALOG: [ModelDescriptor; 4] = [
    ModelDescriptor {
        id: "gpt-5.4",
        display_name: "GPT-5.4",
        provider: ModelProvider::OpenAi,
        pool: ModelPool::Codex,
        source: ModelSource::LocalCodex,
        supports_reasoning: true,
        supports_vision: true,
        reasoning_efforts: REASON_EFFORTS_CODEX,
        capabilities: CAPABILITIES_FULL,
    },
    ModelDescriptor {
        id: "claude-sonnet-4.5",
        display_name: "Claude Sonnet 4.5",
        provider: ModelProvider::Anthropic,
        pool: ModelPool::Claude,
        source: ModelSource::OauthAccount,
        supports_reasoning: true,
        supports_vision: true,
        reasoning_efforts: REASON_EFFORTS_STANDARD,
        capabilities: CAPABILITIES_FULL,
    },
    ModelDescriptor {
        id: "gemini-3.1-pro",
        display_name: "Gemini 3.1 Pro",
        provider: ModelProvider::Google,
        pool: ModelPool::Gemini,
        source: ModelSource::OauthAccount,
        supports_reasoning: true,
        supports_vision: true,
        reasoning_efforts: REASON_EFFORTS_STANDARD,
        capabilities: CAPABILITIES_FULL,
    },
    ModelDescriptor {
        id: "antigravity",
        display_name: "Antigravity",
        provider: ModelProvider::Google,
        pool: ModelPool::Gemini,
        source: ModelSource::OauthAccount,
        supports_reasoning: true,
        supports_vision: false,
        reasoning_efforts: REASON_EFFORTS_STANDARD,
        capabilities: CAPABILITIES_NO_VISION,
    },
];

#[derive(Clone, Copy, Debug)]
struct ProviderCatalogSpec {
    provider_id: &'static str,
    display_name: &'static str,
    pool: &'static str,
    oauth_provider_id: &'static str,
    aliases: &'static [&'static str],
    default_model_id: &'static str,
}

const PROVIDER_CATALOG_SPECS: &[ProviderCatalogSpec] = &[
    ProviderCatalogSpec {
        provider_id: "openai",
        display_name: "OpenAI",
        pool: "codex",
        oauth_provider_id: "codex",
        aliases: &["openai", "codex", "openai-codex"],
        default_model_id: "gpt-5.4",
    },
    ProviderCatalogSpec {
        provider_id: "anthropic",
        display_name: "Anthropic",
        pool: "claude",
        oauth_provider_id: "claude_code",
        aliases: &["anthropic", "claude", "claude_code", "claude-code"],
        default_model_id: "claude-sonnet-4.5",
    },
    ProviderCatalogSpec {
        provider_id: "google",
        display_name: "Google",
        pool: "gemini",
        oauth_provider_id: "gemini",
        aliases: &[
            "google",
            "gemini",
            "antigravity",
            "anti-gravity",
            "gemini-antigravity",
        ],
        default_model_id: "gemini-3.1-pro",
    },
];

const PROVIDER_EXTENSIONS_ENV: &str = "CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderCatalogExtensionInput {
    provider_id: String,
    display_name: String,
    pool: String,
    default_model_id: String,
    #[serde(default)]
    aliases: Vec<String>,
    #[serde(default)]
    api_key_env: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
}

#[derive(Clone, Debug)]
struct ProviderCatalogExtension {
    provider_id: String,
    display_name: String,
    pool: String,
    aliases: Vec<String>,
    default_model_id: String,
    api_key: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ResolverContext {
    oauth_accounts: OAuthAccountRegistry,
    local_codex_available: bool,
    provider_catalog_extensions: Vec<ProviderCatalogExtension>,
}

impl ResolverContext {
    pub fn new(oauth_accounts: OAuthAccountRegistry, local_codex_available: bool) -> Self {
        Self {
            oauth_accounts,
            local_codex_available,
            provider_catalog_extensions: Vec::new(),
        }
    }

    pub fn with_provider_extensions_json(mut self, raw: Option<&str>) -> Self {
        self.provider_catalog_extensions = parse_provider_catalog_extensions(raw);
        self
    }

    pub fn from_env() -> Self {
        let provider_extensions_json = std::env::var(PROVIDER_EXTENSIONS_ENV).ok();
        Self::new(
            OAuthAccountRegistry::from_env(),
            parse_enabled_flag("CODE_TAURI_LOCAL_CODEX_AVAILABLE", true),
        )
        .with_provider_extensions_json(provider_extensions_json.as_deref())
    }
}

fn parse_enabled_flag(name: &str, default: bool) -> bool {
    match std::env::var(name) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            !matches!(normalized.as_str(), "0" | "false" | "off" | "no")
        }
        Err(_) => default,
    }
}

fn sanitize_extension_identifier(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.is_empty() || normalized.len() > 64 {
        return None;
    }
    if normalized.chars().all(|character| {
        character.is_ascii_lowercase()
            || character.is_ascii_digit()
            || matches!(character, '-' | '_')
    }) {
        return Some(normalized);
    }
    None
}

fn normalize_extension_aliases(provider_id: &str, aliases: &[String]) -> Option<Vec<String>> {
    let mut normalized_aliases = vec![provider_id.to_string()];
    for alias in aliases {
        let normalized = sanitize_extension_identifier(alias)?;
        normalized_aliases.push(normalized);
    }
    normalized_aliases.sort_unstable();
    normalized_aliases.dedup();
    Some(normalized_aliases)
}

fn resolve_extension_api_key(
    explicit_api_key: Option<&str>,
    api_key_env: Option<&str>,
) -> Option<String> {
    if let Some(key) = explicit_api_key
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        return Some(key.to_string());
    }

    let env_name = api_key_env
        .map(str::trim)
        .filter(|entry| !entry.is_empty())?;
    std::env::var(env_name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn parse_provider_catalog_extensions(raw: Option<&str>) -> Vec<ProviderCatalogExtension> {
    let Some(raw) = raw.map(str::trim).filter(|entry| !entry.is_empty()) else {
        return Vec::new();
    };

    let Ok(inputs) = serde_json::from_str::<Vec<ProviderCatalogExtensionInput>>(raw) else {
        return Vec::new();
    };

    let mut seen_provider_ids = HashSet::new();
    let mut seen_aliases = PROVIDER_CATALOG_SPECS
        .iter()
        .flat_map(|spec| {
            spec.aliases
                .iter()
                .copied()
                .chain(std::iter::once(spec.provider_id))
        })
        .map(str::to_string)
        .collect::<HashSet<_>>();
    let mut extensions = Vec::new();

    for input in inputs {
        let Some(provider_id) = sanitize_extension_identifier(input.provider_id.as_str()) else {
            continue;
        };
        if seen_aliases.contains(provider_id.as_str()) {
            continue;
        }
        if !seen_provider_ids.insert(provider_id.clone()) {
            continue;
        }

        let display_name = input.display_name.trim();
        if display_name.is_empty() {
            continue;
        }

        let Some(pool) = sanitize_extension_identifier(input.pool.as_str()) else {
            continue;
        };
        let default_model_id = input.default_model_id.trim();
        if default_model_id.is_empty() {
            continue;
        }

        let Some(aliases) = normalize_extension_aliases(provider_id.as_str(), &input.aliases)
        else {
            continue;
        };
        if aliases
            .iter()
            .any(|alias| seen_aliases.contains(alias.as_str()))
        {
            continue;
        }
        for alias in &aliases {
            seen_aliases.insert(alias.clone());
        }

        let api_key =
            resolve_extension_api_key(input.api_key.as_deref(), input.api_key_env.as_deref());
        extensions.push(ProviderCatalogExtension {
            provider_id,
            display_name: display_name.to_string(),
            pool,
            aliases,
            default_model_id: default_model_id.to_string(),
            api_key,
        });
    }

    extensions
}

#[derive(Clone, Debug)]
struct RuntimeModelEntry {
    descriptor: ModelDescriptor,
    source: ModelSource,
    account_priority: i32,
    available: bool,
}

#[derive(Clone, Copy, Debug, Default)]
struct ProviderCircuitState {
    consecutive_failures: u32,
    cooldown_until_epoch_seconds: u64,
}

type ResolverClock = Arc<dyn Fn() -> u64 + Send + Sync>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RouteReason {
    ExplicitModel,
    WorkspaceDefault,
    LocalFirstCodex,
    OauthFallback,
    AnyAvailableFallback,
}

impl RouteReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ExplicitModel => "explicit-model",
            Self::WorkspaceDefault => "workspace-default",
            Self::LocalFirstCodex => "local-first-codex",
            Self::OauthFallback => "oauth-fallback",
            Self::AnyAvailableFallback => "any-available-fallback",
        }
    }
}

#[derive(Clone, Debug)]
pub struct ResolvedRoute {
    pub model_id: String,
    pub provider: String,
    pub pool: String,
    pub source: String,
    pub reason: RouteReason,
}

impl ResolvedRoute {
    fn from_entry(entry: &RuntimeModelEntry, reason: RouteReason) -> Self {
        Self {
            model_id: entry.descriptor.id.to_string(),
            provider: entry.descriptor.provider.as_str().to_string(),
            pool: entry.descriptor.pool.as_str().to_string(),
            source: entry.source.as_str().to_string(),
            reason,
        }
    }
}

pub struct ModelPoolResolver {
    entries: Vec<RuntimeModelEntry>,
    provider_catalog_extensions: Vec<ProviderCatalogExtension>,
    provider_failure_threshold: u32,
    provider_cooldown_seconds: u64,
    provider_circuits: Mutex<BTreeMap<String, ProviderCircuitState>>,
    now_epoch_seconds: ResolverClock,
}

impl std::fmt::Debug for ModelPoolResolver {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ModelPoolResolver")
            .field("entries", &self.entries)
            .field(
                "provider_failure_threshold",
                &self.provider_failure_threshold,
            )
            .field("provider_cooldown_seconds", &self.provider_cooldown_seconds)
            .finish_non_exhaustive()
    }
}

impl ModelPoolResolver {
    pub fn new(context: ResolverContext) -> Self {
        Self::new_with_clock(context, Arc::new(current_unix_epoch_seconds))
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn new_with_clock(
        context: ResolverContext,
        now_epoch_seconds: ResolverClock,
    ) -> Self {
        let provider_catalog_extensions = context.provider_catalog_extensions.clone();
        let entries = MODEL_CATALOG
            .into_iter()
            .map(|descriptor| build_runtime_entry(descriptor, &context))
            .collect();

        Self {
            entries,
            provider_catalog_extensions,
            provider_failure_threshold: context.oauth_accounts.provider_failure_threshold(),
            provider_cooldown_seconds: context.oauth_accounts.provider_cooldown_seconds(),
            provider_circuits: Mutex::new(BTreeMap::new()),
            now_epoch_seconds,
        }
    }

    pub fn model_pool(&self) -> Vec<ModelPoolEntry> {
        self.entries
            .iter()
            .map(|entry| ModelPoolEntry {
                id: entry.descriptor.id.to_string(),
                display_name: entry.descriptor.display_name.to_string(),
                provider: entry.descriptor.provider.as_str().to_string(),
                pool: entry.descriptor.pool.as_str().to_string(),
                source: entry.source.as_str().to_string(),
                available: entry.available,
                supports_reasoning: entry.descriptor.supports_reasoning,
                supports_vision: entry.descriptor.supports_vision,
                reasoning_efforts: entry
                    .descriptor
                    .reasoning_efforts
                    .iter()
                    .map(|effort| effort.as_str().to_string())
                    .collect(),
                capabilities: entry
                    .descriptor
                    .capabilities
                    .iter()
                    .map(|capability| capability.as_str().to_string())
                    .collect(),
            })
            .collect()
    }

    pub fn provider_catalog(&self) -> Vec<RuntimeProviderCatalogEntry> {
        let entries = self.model_pool();
        let mut providers = PROVIDER_CATALOG_SPECS
            .iter()
            .map(|spec| RuntimeProviderCatalogEntry {
                provider_id: spec.provider_id.to_string(),
                display_name: spec.display_name.to_string(),
                pool: Some(spec.pool.to_string()),
                oauth_provider_id: Some(spec.oauth_provider_id.to_string()),
                aliases: spec
                    .aliases
                    .iter()
                    .map(|alias| (*alias).to_string())
                    .collect(),
                default_model_id: Some(spec.default_model_id.to_string()),
                available: entries
                    .iter()
                    .any(|entry| entry.provider == spec.provider_id && entry.available),
                supports_native: true,
                supports_openai_compat: true,
                registry_version: Some(
                    crate::commands::rpc::CODE_RUNTIME_RPC_CONTRACT_VERSION.to_string(),
                ),
            })
            .collect::<Vec<_>>();
        providers.extend(self.provider_catalog_extensions.iter().map(|extension| {
            RuntimeProviderCatalogEntry {
                provider_id: extension.provider_id.clone(),
                display_name: extension.display_name.clone(),
                pool: Some(extension.pool.clone()),
                oauth_provider_id: None,
                aliases: extension.aliases.clone(),
                default_model_id: Some(extension.default_model_id.clone()),
                available: provider_extension_is_available(extension),
                supports_native: false,
                supports_openai_compat: true,
                registry_version: Some(
                    crate::commands::rpc::CODE_RUNTIME_RPC_CONTRACT_VERSION.to_string(),
                ),
            }
        }));

        providers.sort_by(|left, right| left.provider_id.cmp(&right.provider_id));
        providers
    }

    pub fn resolve_turn(
        &self,
        requested_model_id: Option<&str>,
        workspace_default_model_id: Option<&str>,
    ) -> Option<ResolvedRoute> {
        self.resolve_turn_candidates(requested_model_id, workspace_default_model_id)
            .into_iter()
            .next()
    }

    pub fn resolve_turn_candidates(
        &self,
        requested_model_id: Option<&str>,
        workspace_default_model_id: Option<&str>,
    ) -> Vec<ResolvedRoute> {
        let now = (self.now_epoch_seconds)();
        let circuit_snapshot = self
            .provider_circuits
            .lock()
            .expect("provider circuit lock poisoned while resolving routes")
            .clone();
        let mut candidates = Vec::new();
        let mut seen = BTreeSet::new();

        if let Some(requested_model_id) = requested_model_id {
            if let Some(entry) =
                self.find_eligible_by_id(requested_model_id, now, &circuit_snapshot)
            {
                push_route_candidate(
                    &mut candidates,
                    &mut seen,
                    entry,
                    RouteReason::ExplicitModel,
                );
            }
        }

        if requested_model_id.is_none() {
            if let Some(workspace_default_model_id) = workspace_default_model_id {
                if let Some(entry) =
                    self.find_eligible_by_id(workspace_default_model_id, now, &circuit_snapshot)
                {
                    push_route_candidate(
                        &mut candidates,
                        &mut seen,
                        entry,
                        RouteReason::WorkspaceDefault,
                    );
                }
            }
        }

        if let Some(entry) = self.find_first_eligible(
            |entry| {
                entry.descriptor.pool == ModelPool::Codex && entry.source == ModelSource::LocalCodex
            },
            now,
            &circuit_snapshot,
        ) {
            push_route_candidate(
                &mut candidates,
                &mut seen,
                entry,
                RouteReason::LocalFirstCodex,
            );
        }

        let mut oauth_fallback_entries = self
            .entries
            .iter()
            .filter(|entry| {
                is_entry_eligible(entry, now, &circuit_snapshot)
                    && entry.source == ModelSource::OauthAccount
            })
            .collect::<Vec<_>>();
        oauth_fallback_entries.sort_by(oauth_fallback_cmp);
        for entry in oauth_fallback_entries {
            push_route_candidate(
                &mut candidates,
                &mut seen,
                entry,
                RouteReason::OauthFallback,
            );
        }

        let mut any_available_entries = self
            .entries
            .iter()
            .filter(|entry| is_entry_eligible(entry, now, &circuit_snapshot))
            .collect::<Vec<_>>();
        any_available_entries.sort_by(any_available_fallback_cmp);
        for entry in any_available_entries {
            push_route_candidate(
                &mut candidates,
                &mut seen,
                entry,
                RouteReason::AnyAvailableFallback,
            );
        }

        candidates
    }

    pub fn report_provider_failure(&self, provider: &str) {
        let provider = provider.trim().to_ascii_lowercase();
        if provider.is_empty() {
            return;
        }
        let now = (self.now_epoch_seconds)();
        let mut circuits = self
            .provider_circuits
            .lock()
            .expect("provider circuit lock poisoned while reporting failure");
        let state = circuits.entry(provider).or_default();
        if state.cooldown_until_epoch_seconds > now {
            return;
        }

        state.consecutive_failures = state.consecutive_failures.saturating_add(1);
        if state.consecutive_failures >= self.provider_failure_threshold {
            state.cooldown_until_epoch_seconds = now.saturating_add(self.provider_cooldown_seconds);
            state.consecutive_failures = 0;
        }
    }

    pub fn report_provider_success(&self, provider: &str) {
        let provider = provider.trim().to_ascii_lowercase();
        if provider.is_empty() {
            return;
        }

        let mut circuits = self
            .provider_circuits
            .lock()
            .expect("provider circuit lock poisoned while reporting success");
        circuits.remove(&provider);
    }

    pub fn provider_circuit_snapshot(&self) -> BTreeMap<String, (u32, u64)> {
        self.provider_circuits
            .lock()
            .expect("provider circuit lock poisoned while snapshotting")
            .iter()
            .filter_map(|(provider, state)| {
                (state.consecutive_failures > 0 || state.cooldown_until_epoch_seconds > 0)
                    .then_some((
                        provider.clone(),
                        (
                            state.consecutive_failures,
                            state.cooldown_until_epoch_seconds,
                        ),
                    ))
            })
            .collect()
    }

    pub fn restore_provider_circuit_snapshot(&self, snapshot: &BTreeMap<String, (u32, u64)>) {
        let mut circuits = self
            .provider_circuits
            .lock()
            .expect("provider circuit lock poisoned while restoring snapshot");
        circuits.clear();
        for (provider, (consecutive_failures, cooldown_until_epoch_seconds)) in snapshot {
            let normalized = provider.trim().to_ascii_lowercase();
            if normalized.is_empty() {
                continue;
            }
            if *consecutive_failures == 0 && *cooldown_until_epoch_seconds == 0 {
                continue;
            }
            circuits.insert(
                normalized,
                ProviderCircuitState {
                    consecutive_failures: *consecutive_failures,
                    cooldown_until_epoch_seconds: *cooldown_until_epoch_seconds,
                },
            );
        }
    }

    pub fn route_metadata_matches_catalog(&self, route: &ResolvedRoute) -> bool {
        self.entries.iter().any(|entry| {
            entry.descriptor.id == route.model_id
                && entry.descriptor.provider.as_str() == route.provider
                && entry.descriptor.pool.as_str() == route.pool
                && entry.source.as_str() == route.source
        })
    }

    pub fn default_model_id(&self) -> Option<String> {
        self.resolve_turn(None, None).map(|route| route.model_id)
    }

    pub fn has_available_oauth_models(&self) -> bool {
        let now = (self.now_epoch_seconds)();
        let circuit_snapshot = self
            .provider_circuits
            .lock()
            .expect("provider circuit lock poisoned while checking oauth availability")
            .clone();

        self.entries.iter().any(|entry| {
            is_entry_eligible(entry, now, &circuit_snapshot)
                && entry.source == ModelSource::OauthAccount
        })
    }

    fn find_eligible_by_id(
        &self,
        model_id: &str,
        now: u64,
        circuit_snapshot: &BTreeMap<String, ProviderCircuitState>,
    ) -> Option<&RuntimeModelEntry> {
        self.entries.iter().find(|entry| {
            entry.descriptor.id == model_id && is_entry_eligible(entry, now, circuit_snapshot)
        })
    }

    fn find_first_eligible(
        &self,
        predicate: impl Fn(&RuntimeModelEntry) -> bool,
        now: u64,
        circuit_snapshot: &BTreeMap<String, ProviderCircuitState>,
    ) -> Option<&RuntimeModelEntry> {
        self.entries
            .iter()
            .find(|entry| is_entry_eligible(entry, now, circuit_snapshot) && predicate(entry))
    }
}

fn is_entry_eligible(
    entry: &RuntimeModelEntry,
    now: u64,
    circuit_snapshot: &BTreeMap<String, ProviderCircuitState>,
) -> bool {
    entry.available
        && !provider_in_cooldown(entry.descriptor.provider.as_str(), now, circuit_snapshot)
}

fn provider_in_cooldown(
    provider: &str,
    now: u64,
    circuit_snapshot: &BTreeMap<String, ProviderCircuitState>,
) -> bool {
    circuit_snapshot
        .get(provider)
        .is_some_and(|state| state.cooldown_until_epoch_seconds > now)
}

fn push_route_candidate(
    candidates: &mut Vec<ResolvedRoute>,
    seen: &mut BTreeSet<String>,
    entry: &RuntimeModelEntry,
    reason: RouteReason,
) {
    let key = format!(
        "{}|{}|{}|{}",
        entry.descriptor.id,
        entry.descriptor.provider.as_str(),
        entry.descriptor.pool.as_str(),
        entry.source.as_str()
    );

    if seen.insert(key) {
        candidates.push(ResolvedRoute::from_entry(entry, reason));
    }
}

fn any_available_fallback_cmp(left: &&RuntimeModelEntry, right: &&RuntimeModelEntry) -> Ordering {
    oauth_fallback_cmp(left, right)
}

fn oauth_fallback_cmp(left: &&RuntimeModelEntry, right: &&RuntimeModelEntry) -> Ordering {
    oauth_fallback_rank(right)
        .cmp(&oauth_fallback_rank(left))
        .then_with(|| {
            left.descriptor
                .provider
                .as_str()
                .cmp(right.descriptor.provider.as_str())
        })
        .then_with(|| {
            left.descriptor
                .pool
                .as_str()
                .cmp(right.descriptor.pool.as_str())
        })
        .then_with(|| left.descriptor.id.cmp(right.descriptor.id))
        .then_with(|| left.source.as_str().cmp(right.source.as_str()))
}

fn current_unix_epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn is_available(descriptor: ModelDescriptor, context: &ResolverContext) -> bool {
    match descriptor.source {
        ModelSource::LocalCodex => context.local_codex_available,
        ModelSource::OauthAccount => context
            .oauth_accounts
            .is_provider_routable(descriptor.provider.as_str()),
    }
}

fn build_runtime_entry(
    descriptor: ModelDescriptor,
    context: &ResolverContext,
) -> RuntimeModelEntry {
    let mut source = descriptor.source;
    let mut available = is_available(descriptor, context);
    let account_priority = context
        .oauth_accounts
        .provider_priority(descriptor.provider.as_str());

    if descriptor.pool == ModelPool::Codex
        && descriptor.provider == ModelProvider::OpenAi
        && descriptor.source == ModelSource::LocalCodex
        && !available
        && context.oauth_accounts.is_provider_routable("openai")
    {
        source = ModelSource::OauthAccount;
        available = true;
    }

    RuntimeModelEntry {
        descriptor,
        source,
        account_priority,
        available,
    }
}

fn pool_priority(pool: ModelPool) -> i32 {
    match pool {
        ModelPool::Codex => 1000,
        ModelPool::Claude => 900,
        ModelPool::Gemini => 700,
    }
}

fn oauth_fallback_rank(entry: &RuntimeModelEntry) -> i32 {
    let mut rank = pool_priority(entry.descriptor.pool) + entry.account_priority * 10;
    if entry.descriptor.supports_reasoning {
        rank += 5;
    }
    if entry.descriptor.supports_vision {
        rank += 3;
    }
    rank
}

fn provider_extension_is_available(extension: &ProviderCatalogExtension) -> bool {
    extension
        .api_key
        .as_ref()
        .is_some_and(|entry| !entry.trim().is_empty())
}

#[cfg(test)]
impl ModelPoolResolver {
    fn provider_circuit_state(&self, provider: &str) -> ProviderCircuitState {
        self.provider_circuits
            .lock()
            .expect("provider circuit lock poisoned in test")
            .get(&provider.to_ascii_lowercase())
            .copied()
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::{ModelPoolResolver, ResolverContext, RouteReason};
    use crate::accounts::OAuthAccountRegistry;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unix_timestamp_seconds() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0)
    }

    #[test]
    fn local_codex_is_preferred_for_automatic_routing() {
        let resolver =
            ModelPoolResolver::new(ResolverContext::new(OAuthAccountRegistry::seeded(), true));

        let route = resolver
            .resolve_turn(None, None)
            .expect("expected local codex route");

        assert_eq!(route.model_id, "gpt-5.4");
        assert_eq!(route.provider, "openai");
        assert_eq!(route.pool, "codex");
        assert_eq!(route.reason, RouteReason::LocalFirstCodex);
    }

    #[test]
    fn oauth_fallback_is_used_when_local_codex_is_unavailable() {
        let resolver = ModelPoolResolver::new(ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["anthropic", "google"]),
            false,
        ));

        let route = resolver
            .resolve_turn(None, None)
            .expect("expected oauth fallback route");

        assert_eq!(route.model_id, "claude-sonnet-4.5");
        assert_eq!(route.provider, "anthropic");
        assert_eq!(route.pool, "claude");
        assert_eq!(route.reason, RouteReason::OauthFallback);
    }

    #[test]
    fn codex_oauth_is_used_before_anthropic_when_local_codex_is_unavailable() {
        let resolver = ModelPoolResolver::new(ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["openai", "anthropic"]),
            false,
        ));

        let route = resolver
            .resolve_turn(None, None)
            .expect("expected codex oauth route");

        assert_eq!(route.model_id, "gpt-5.4");
        assert_eq!(route.provider, "openai");
        assert_eq!(route.pool, "codex");
        assert_eq!(route.source, "oauth-account");
    }

    #[test]
    fn explicit_codex_model_routes_via_oauth_when_local_codex_is_unavailable() {
        let resolver = ModelPoolResolver::new(ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["openai", "anthropic"]),
            false,
        ));

        let route = resolver
            .resolve_turn(Some("gpt-5.4"), None)
            .expect("expected codex oauth route for explicit model");

        assert_eq!(route.model_id, "gpt-5.4");
        assert_eq!(route.provider, "openai");
        assert_eq!(route.pool, "codex");
        assert_eq!(route.source, "oauth-account");
        assert_eq!(route.reason, RouteReason::ExplicitModel);
    }

    #[test]
    fn explicit_model_routes_to_matching_provider_and_pool() {
        let resolver =
            ModelPoolResolver::new(ResolverContext::new(OAuthAccountRegistry::seeded(), true));

        let route = resolver
            .resolve_turn(Some("gemini-3.1-pro"), None)
            .expect("expected explicit gemini route");

        assert_eq!(route.provider, "google");
        assert_eq!(route.pool, "gemini");
        assert_eq!(route.reason, RouteReason::ExplicitModel);
    }

    #[test]
    fn workspace_default_is_honored_when_model_is_available() {
        let resolver =
            ModelPoolResolver::new(ResolverContext::new(OAuthAccountRegistry::seeded(), true));

        let route = resolver
            .resolve_turn(None, Some("gemini-3.1-pro"))
            .expect("expected workspace default route");

        assert_eq!(route.model_id, "gemini-3.1-pro");
        assert_eq!(route.reason, RouteReason::WorkspaceDefault);
    }

    #[test]
    fn gemini_pro_is_preferred_over_antigravity_for_oauth_fallback() {
        let resolver = ModelPoolResolver::new(ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["google", "antigravity"]),
            false,
        ));

        let route = resolver
            .resolve_turn(None, None)
            .expect("expected oauth fallback route");

        assert_eq!(route.model_id, "gemini-3.1-pro");
        assert_eq!(route.provider, "google");
        assert_eq!(route.pool, "gemini");
        assert_eq!(route.reason, RouteReason::OauthFallback);
    }

    #[test]
    fn provider_catalog_groups_antigravity_as_google_alias() {
        let resolver =
            ModelPoolResolver::new(ResolverContext::new(OAuthAccountRegistry::seeded(), true));

        let catalog = resolver.provider_catalog();
        let google = catalog
            .iter()
            .find(|entry| entry.provider_id == "google")
            .expect("google provider should exist");

        assert_eq!(google.pool.as_deref(), Some("gemini"));
        assert_eq!(google.oauth_provider_id.as_deref(), Some("gemini"));
        assert!(google.aliases.contains(&"gemini".to_string()));
        assert!(google.aliases.contains(&"antigravity".to_string()));
        assert!(google.aliases.contains(&"anti-gravity".to_string()));
    }

    #[test]
    fn provider_catalog_includes_extension_from_env_json() {
        let resolver = ModelPoolResolver::new(
            ResolverContext::new(OAuthAccountRegistry::seeded(), true).with_provider_extensions_json(Some(
                r#"[{"providerId":"deepseek","displayName":"DeepSeek","pool":"deepseek","defaultModelId":"deepseek-chat","compatBaseUrl":"https://api.deepseek.com/v1","aliases":["ds"],"apiKey":"sk-deepseek"}]"#,
            )),
        );

        let catalog = resolver.provider_catalog();
        let deepseek = catalog
            .iter()
            .find(|entry| entry.provider_id == "deepseek")
            .expect("deepseek provider should exist");

        assert_eq!(deepseek.display_name, "DeepSeek");
        assert_eq!(deepseek.pool.as_deref(), Some("deepseek"));
        assert_eq!(deepseek.oauth_provider_id, None);
        assert_eq!(deepseek.default_model_id.as_deref(), Some("deepseek-chat"));
        assert!(deepseek.aliases.contains(&"deepseek".to_string()));
        assert!(deepseek.aliases.contains(&"ds".to_string()));
        assert!(deepseek.available);
        assert!(!deepseek.supports_native);
        assert!(deepseek.supports_openai_compat);
    }

    #[test]
    fn provider_catalog_marks_extension_unavailable_without_api_key() {
        let resolver = ModelPoolResolver::new(
            ResolverContext::new(OAuthAccountRegistry::seeded(), true).with_provider_extensions_json(Some(
                r#"[{"providerId":"mistral","displayName":"Mistral","pool":"mistral","defaultModelId":"mistral-large","compatBaseUrl":"https://api.mistral.ai/v1","aliases":["ms"],"apiKeyEnv":"MISTRAL_API_KEY_NOT_SET"}]"#,
            )),
        );

        let catalog = resolver.provider_catalog();
        let mistral = catalog
            .iter()
            .find(|entry| entry.provider_id == "mistral")
            .expect("mistral provider should exist");

        assert!(!mistral.available);
        assert_eq!(mistral.oauth_provider_id, None);
        assert!(!mistral.supports_native);
        assert!(mistral.supports_openai_compat);
    }

    #[test]
    fn provider_catalog_ignores_extension_alias_collisions_with_core_providers() {
        let resolver = ModelPoolResolver::new(
            ResolverContext::new(OAuthAccountRegistry::seeded(), true).with_provider_extensions_json(Some(
                r#"[{"providerId":"deepseek","displayName":"DeepSeek","pool":"deepseek","defaultModelId":"deepseek-chat","compatBaseUrl":"https://api.deepseek.com/v1","aliases":["openai"],"apiKey":"sk-deepseek"}]"#,
            )),
        );

        let catalog = resolver.provider_catalog();
        assert!(!catalog.iter().any(|entry| entry.provider_id == "deepseek"));
    }

    #[test]
    fn oauth_fallback_skips_provider_in_cooldown() {
        let now = unix_timestamp_seconds();
        let registry = OAuthAccountRegistry::from_active_providers(["openai", "anthropic"])
            .with_provider_cooldown("openai", now + 180);
        let resolver = ModelPoolResolver::new(ResolverContext::new(registry, false));

        let route = resolver
            .resolve_turn(None, None)
            .expect("expected oauth fallback route");

        assert_eq!(route.provider, "anthropic");
        assert_eq!(route.pool, "claude");
        assert_eq!(route.reason, RouteReason::OauthFallback);
    }

    #[test]
    fn provider_priority_policy_override_is_deterministic_for_oauth_fallback() {
        let registry = OAuthAccountRegistry::from_active_providers(["anthropic", "google"])
            .with_provider_priority("google", 120)
            .with_provider_priority("anthropic", 60);
        let resolver = ModelPoolResolver::new(ResolverContext::new(registry, false));

        let route = resolver
            .resolve_turn(None, None)
            .expect("expected oauth fallback route");

        assert_eq!(route.model_id, "gemini-3.1-pro");
        assert_eq!(route.provider, "google");
        assert_eq!(route.pool, "gemini");
        assert_eq!(route.reason, RouteReason::OauthFallback);
    }

    #[test]
    fn explicit_codex_model_falls_back_when_openai_is_in_cooldown_and_local_is_unavailable() {
        let now = unix_timestamp_seconds();
        let registry = OAuthAccountRegistry::from_active_providers(["openai", "anthropic"])
            .with_provider_cooldown("openai", now + 180);
        let resolver = ModelPoolResolver::new(ResolverContext::new(registry, false));

        let route = resolver
            .resolve_turn(Some("gpt-5.4"), None)
            .expect("expected fallback route");

        assert_eq!(route.provider, "anthropic");
        assert_eq!(route.pool, "claude");
        assert_eq!(route.reason, RouteReason::OauthFallback);
    }

    #[test]
    fn provider_cooldown_temporarily_skips_failing_provider_until_expired() {
        let now = Arc::new(AtomicU64::new(10));
        let now_for_clock = Arc::clone(&now);
        let registry = OAuthAccountRegistry::from_active_providers(["openai", "anthropic"])
            .with_provider_failure_policy(1, 30);
        let resolver = ModelPoolResolver::new_with_clock(
            ResolverContext::new(registry, false),
            Arc::new(move || now_for_clock.load(Ordering::Relaxed)),
        );

        let first = resolver
            .resolve_turn(None, None)
            .expect("expected first route for openai");
        assert_eq!(first.provider, "openai");
        assert_eq!(first.model_id, "gpt-5.4");

        resolver.report_provider_failure("openai");
        let circuit = resolver.provider_circuit_state("openai");
        assert_eq!(circuit.consecutive_failures, 0);
        assert_eq!(circuit.cooldown_until_epoch_seconds, 40);

        let while_cooling = resolver
            .resolve_turn(None, None)
            .expect("expected fallback route while openai cooldown is active");
        assert_eq!(while_cooling.provider, "anthropic");

        now.store(45, Ordering::Relaxed);
        let after_cooldown = resolver
            .resolve_turn(None, None)
            .expect("expected openai route after cooldown expires");
        assert_eq!(after_cooldown.provider, "openai");
        assert_eq!(after_cooldown.model_id, "gpt-5.4");
    }

    #[test]
    fn codex_selected_model_prefers_codex_path_before_other_pools() {
        let resolver = ModelPoolResolver::new(ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["openai", "anthropic", "google"]),
            false,
        ));

        let route = resolver
            .resolve_turn(Some("gpt-5.4"), None)
            .expect("expected selected codex route");

        assert_eq!(route.model_id, "gpt-5.4");
        assert_eq!(route.provider, "openai");
        assert_eq!(route.pool, "codex");
        assert_eq!(route.source, "oauth-account");
        assert_eq!(route.reason, RouteReason::ExplicitModel);
    }
}
