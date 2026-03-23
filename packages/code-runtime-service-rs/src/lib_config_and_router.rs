#[path = "config/provider_resolution.rs"]
mod config_provider_resolution;
#[path = "config/service_config_views.rs"]
mod config_service_config_views;
#[path = "rpc/capabilities.rs"]
mod rpc_capabilities;
#[path = "embedded_runtime.rs"]
mod embedded_runtime;
#[path = "embedded_runtime_context_sync.rs"]
mod embedded_runtime_context_sync;
#[path = "transport/app_state.rs"]
mod transport_app_state;
#[path = "transport/router_builder.rs"]
mod transport_router_builder;

pub use embedded_runtime::*;
pub use embedded_runtime_context_sync::EmbeddedRuntimeContextScope;
pub use config_provider_resolution::parse_provider_extension_seeds;
pub use config_service_config_views::ServiceConfigViews;
pub(crate) use config_provider_resolution::*;
pub(crate) use rpc_capabilities::*;
pub(crate) use transport_app_state::*;
pub use transport_app_state::RuntimeAppState;
pub use transport_router_builder::{
    build_router, build_router_from_runtime_app_state, build_runtime_app_state_from_env,
    create_initial_state,
};
pub(crate) use transport_router_builder::*;

fn supports_deferred_oauth_credentials(provider: RuntimeProvider) -> bool {
    !provider.oauth_provider().trim().is_empty()
}

fn should_warn_missing_provider_credentials(
    config: &ServiceConfig,
    provider: RuntimeProvider,
) -> bool {
    !has_routable_api_key(config, provider) && !supports_deferred_oauth_credentials(provider)
}

pub fn validate_service_config(config: &ServiceConfig) -> ConfigValidation {
    let checks = evaluate_readiness_checks(config);
    let mut validation = ConfigValidation::default();
    if should_use_local_codex_exec_for_turn() {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC is enabled. For stable agentic coding workflows, prefer provider/runtime-plan flow and keep local codex exec as an explicit fallback."
                .to_string(),
        );
    }
    if !checks.default_model_valid {
        validation
            .errors
            .push("CODE_RUNTIME_SERVICE_DEFAULT_MODEL must not be empty.".to_string());
    }
    if !checks.openai_endpoint_valid {
        validation.errors.push(format!(
            "CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT is invalid: {}",
            config.openai_endpoint
        ));
    }
    if !checks.anthropic_endpoint_valid {
        validation.errors.push(format!(
            "CODE_RUNTIME_SERVICE_ANTHROPIC_ENDPOINT is invalid: {}",
            config.anthropic_endpoint
        ));
    }
    if !checks.gemini_endpoint_valid {
        validation.errors.push(format!(
            "CODE_RUNTIME_SERVICE_GEMINI_ENDPOINT is invalid: {}",
            config.gemini_endpoint
        ));
    }
    if let Some(base_url) = normalized_openai_compat_base_url(config) {
        if let Err(error) = reqwest::Url::parse(base_url.as_str()) {
            validation.errors.push(format!(
                "CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL is invalid: {error}"
            ));
        }
    }
    if config.live_skills_network_enabled {
        if config.live_skills_network_base_url.trim().is_empty() {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_BASE_URL must not be empty when live-skill network access is enabled.".to_string(),
            );
        } else if let Err(error) = reqwest::Url::parse(config.live_skills_network_base_url.trim()) {
            validation.errors.push(format!(
                "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_BASE_URL is invalid: {error}"
            ));
        }
    }
    if config.live_skills_network_timeout_ms == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_TIMEOUT_MS is 0; runtime will clamp to a minimum timeout.".to_string(),
        );
    }
    let sandbox_network_access = config
        .sandbox_network_access
        .trim()
        .to_ascii_lowercase()
        .replace('_', "-");
    if config.sandbox_enabled
        && !matches!(sandbox_network_access.as_str(), "none" | "allowlist" | "full")
    {
        validation.errors.push(
            "CODE_RUNTIME_SERVICE_SANDBOX_NETWORK_ACCESS must be one of: none, allowlist, full."
                .to_string(),
        );
    }
    if config.sandbox_enabled
        && sandbox_network_access == "allowlist"
        && config.sandbox_allowed_hosts.is_empty()
    {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_SANDBOX_NETWORK_ACCESS=allowlist but CODE_RUNTIME_SERVICE_SANDBOX_ALLOWED_HOSTS is empty; network will effectively be denied."
                .to_string(),
        );
    }
    if config.ws_write_buffer_size_bytes == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_WS_WRITE_BUFFER_SIZE_BYTES is 0; runtime will clamp to a minimum write buffer."
                .to_string(),
        );
    } else if config.ws_write_buffer_size_bytes > MAX_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES_HARD {
        validation.warnings.push(format!(
            "CODE_RUNTIME_SERVICE_WS_WRITE_BUFFER_SIZE_BYTES is above {} bytes; runtime will clamp to the hard safety cap.",
            MAX_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES_HARD
        ));
    }
    if config.ws_max_write_buffer_size_bytes == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES is 0; runtime will clamp to a minimum max write buffer."
                .to_string(),
        );
    } else if config.ws_max_write_buffer_size_bytes <= config.ws_write_buffer_size_bytes {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES should be greater than CODE_RUNTIME_SERVICE_WS_WRITE_BUFFER_SIZE_BYTES; runtime will auto-adjust to preserve backpressure headroom."
                .to_string(),
        );
    } else if config.ws_max_write_buffer_size_bytes
        > MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD
    {
        validation.warnings.push(format!(
            "CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES is above {} bytes; runtime will clamp to the hard safety cap.",
            MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD
        ));
    }
    if config.ws_max_frame_size_bytes == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES is 0; runtime will clamp to a minimum frame size."
                .to_string(),
        );
    } else if config.ws_max_frame_size_bytes > MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD {
        validation.warnings.push(format!(
            "CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES is above {} bytes; runtime will clamp to the hard safety cap.",
            MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD
        ));
    }
    if config.ws_max_message_size_bytes == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES is 0; runtime will clamp to a minimum message size."
                .to_string(),
        );
    } else if config.ws_max_message_size_bytes < config.ws_max_frame_size_bytes {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES should be >= CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES; runtime will auto-adjust to preserve protocol consistency."
                .to_string(),
        );
    } else if config.ws_max_message_size_bytes > MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD {
        validation.warnings.push(format!(
            "CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES is above {} bytes; runtime will clamp to the hard safety cap.",
            MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD
        ));
    }
    if config.ws_max_connections == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS is 0; runtime will clamp to a minimum connection budget."
                .to_string(),
        );
    } else if config.ws_max_connections > MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD {
        validation.warnings.push(format!(
            "CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS is above {}; runtime will clamp to the hard safety cap.",
            MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD
        ));
    }
    if config.openai_timeout_ms == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS is 0; provider HTTP requests may fail immediately and retry delays will clamp to a minimal fallback."
                .to_string(),
        );
    }
    if config.openai_retry_base_ms == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_OPENAI_RETRY_BASE_MS is 0; retry backoff will use a minimal jitter-only delay."
                .to_string(),
        );
    }
    if config.openai_max_retries > 8 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES is above 8; exponential backoff growth is capped after attempt 8, so additional retries mainly extend tail latency."
                .to_string(),
        );
    }
    if config.openai_compat_model_cache_ttl_ms == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS is 0; compat model catalog cache is effectively disabled and refresh load may increase."
                .to_string(),
        );
    } else if config.openai_compat_model_cache_ttl_ms
        < MIN_RECOMMENDED_OPENAI_COMPAT_MODEL_CACHE_TTL_MS
    {
        validation.warnings.push(format!(
            "CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS is below {}ms; compat model catalog refresh frequency may increase upstream load and routing jitter.",
            MIN_RECOMMENDED_OPENAI_COMPAT_MODEL_CACHE_TTL_MS
        ));
    }
    if config.live_skills_network_cache_ttl_ms == 0 {
        validation.warnings.push(
            "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_CACHE_TTL_MS is 0; live-skill network cache is disabled.".to_string(),
        );
    }
    if should_warn_missing_provider_credentials(config, RuntimeProvider::OpenAI) {
        validation.warnings.push(
            "OPENAI_API_KEY is not configured; code_turn_send will return an error.".to_string(),
        );
    }
    if should_warn_missing_provider_credentials(config, RuntimeProvider::Anthropic) {
        validation.warnings.push(
            "ANTHROPIC_API_KEY is not configured; claude model turns will return an error."
                .to_string(),
        );
    }
    if should_warn_missing_provider_credentials(config, RuntimeProvider::Google) {
        validation.warnings.push(
            "GEMINI_API_KEY is not configured; gemini model turns will return an error."
                .to_string(),
        );
    }
    if has_openai_compat_mode(config)
        && !has_non_empty(resolve_openai_compat_api_key(
            config,
            RuntimeProvider::OpenAI,
            None,
        ))
        && !RuntimeProvider::all().any(supports_deferred_oauth_credentials)
    {
        validation.warnings.push(
            "OpenAI-compat mode is enabled but no compatible API key is configured (set CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY or OPENAI_API_KEY).".to_string(),
        );
    }
    if !checks.default_provider_ready
        && !supports_deferred_oauth_credentials(infer_provider(None, Some(config.default_model_id.trim())))
    {
        validation.warnings.push(
            "Default model provider is not fully configured (missing API key or endpoint)."
                .to_string(),
        );
    }
    if !has_non_empty(Some(config.anthropic_version.as_str())) {
        validation
            .errors
            .push("CODE_RUNTIME_SERVICE_ANTHROPIC_VERSION must not be empty.".to_string());
    }
    if config.oauth_pool_db_path.trim().is_empty() {
        validation
            .errors
            .push("CODE_RUNTIME_SERVICE_OAUTH_POOL_DB must not be empty.".to_string());
    } else if config.oauth_pool_db_path.trim() != ":memory:" {
        let oauth_db_path = Path::new(config.oauth_pool_db_path.trim());
        let parent_missing = oauth_db_path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .is_some_and(|parent| !parent.exists());
        if parent_missing {
            validation.warnings.push(format!(
                "CODE_RUNTIME_SERVICE_OAUTH_POOL_DB parent directory does not exist (`{}`); oauth pool startup will fall back to in-memory or fail-closed until the path is fixed.",
                config.oauth_pool_db_path
            ));
        }
    }
    if let Some(secret_key) = config.oauth_secret_key.as_deref() {
        if let Err(error) = validate_oauth_secret_key(secret_key) {
            validation.warnings.push(format!(
                "CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is invalid ({error}); oauth pool startup will fall back without secret key or fail-closed until fixed."
            ));
        }
    }
    if let Some(public_base_url) = config.oauth_public_base_url.as_deref() {
        let trimmed = public_base_url.trim();
        if trimmed.is_empty() {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL must not be empty when provided."
                    .to_string(),
            );
        } else {
            match reqwest::Url::parse(trimmed) {
                Ok(url) => {
                    let scheme = url.scheme();
                    if scheme != "http" && scheme != "https" {
                        validation.errors.push(
                            "CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL must use http or https."
                                .to_string(),
                        );
                    }
                }
                Err(error) => validation.errors.push(format!(
                    "CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL is invalid: {error}"
                )),
            }
        }
    }
    if config.agent_max_concurrent_tasks == 0 {
        validation.errors.push(
            "CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS must be greater than 0.".to_string(),
        );
    }
    if config.agent_max_concurrent_tasks > MAX_AGENT_MAX_CONCURRENT_TASKS {
        validation.errors.push(format!(
            "CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS must be <= {MAX_AGENT_MAX_CONCURRENT_TASKS}."
        ));
    }
    if config.agent_task_history_limit == 0 {
        validation.errors.push(
            "CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT must be greater than 0.".to_string(),
        );
    }
    if config.agent_task_history_limit > MAX_AGENT_TASK_HISTORY_LIMIT {
        validation.errors.push(format!(
            "CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT must be <= {MAX_AGENT_TASK_HISTORY_LIMIT}."
        ));
    }
    if config.agent_task_history_limit < config.agent_max_concurrent_tasks {
        validation.errors.push(
            "CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT must be >= CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS."
                .to_string(),
        );
    }
    if config.distributed_enabled {
        let redis_url = config
            .distributed_redis_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        match redis_url {
            Some(url) => {
                if let Err(error) = redis::Client::open(url) {
                    validation.errors.push(format!(
                        "CODE_RUNTIME_SERVICE_DISTRIBUTED_REDIS_URL is invalid: {error}"
                    ));
                }
            }
            None => validation.errors.push(
                "CODE_RUNTIME_SERVICE_DISTRIBUTED_REDIS_URL must be set when CODE_RUNTIME_SERVICE_DISTRIBUTED_ENABLED=true."
                    .to_string(),
            ),
        }
        if config.distributed_lane_count == 0 {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_DISTRIBUTED_LANE_COUNT must be greater than 0.".to_string(),
            );
        }
        if config.distributed_lane_count > MAX_DISTRIBUTED_LANE_COUNT {
            validation.errors.push(format!(
                "CODE_RUNTIME_SERVICE_DISTRIBUTED_LANE_COUNT must be <= {MAX_DISTRIBUTED_LANE_COUNT}."
            ));
        }
        if config.distributed_worker_concurrency == 0 {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_DISTRIBUTED_WORKER_CONCURRENCY must be greater than 0."
                    .to_string(),
            );
        }
        if config.distributed_worker_concurrency > MAX_DISTRIBUTED_WORKER_CONCURRENCY {
            validation.errors.push(format!(
                "CODE_RUNTIME_SERVICE_DISTRIBUTED_WORKER_CONCURRENCY must be <= {MAX_DISTRIBUTED_WORKER_CONCURRENCY}."
            ));
        }
        if config.distributed_claim_idle_ms == 0 {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_DISTRIBUTED_CLAIM_IDLE_MS must be greater than 0."
                    .to_string(),
            );
        } else if config.distributed_claim_idle_ms < 1_000 {
            validation.warnings.push(
                "CODE_RUNTIME_SERVICE_DISTRIBUTED_CLAIM_IDLE_MS is very low (<1000ms); this may cause frequent reclaim churn."
                    .to_string(),
            );
        }
    }
    if config.discovery_enabled {
        if !config.distributed_enabled {
            validation.warnings.push(
                "CODE_RUNTIME_SERVICE_DISCOVERY_ENABLED=true but distributed runtime is disabled; discovery loop will not start."
                    .to_string(),
            );
        }
        if config.discovery_service_type.trim().is_empty() {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_DISCOVERY_SERVICE_TYPE must not be empty when discovery is enabled."
                    .to_string(),
            );
        }
        if config.discovery_browse_interval_ms == 0 {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_DISCOVERY_BROWSE_INTERVAL_MS must be greater than 0."
                    .to_string(),
            );
        }
        if config.discovery_stale_ttl_ms == 0 {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_DISCOVERY_STALE_TTL_MS must be greater than 0.".to_string(),
            );
        } else if config.discovery_stale_ttl_ms < config.discovery_browse_interval_ms {
            validation.warnings.push(
                "CODE_RUNTIME_SERVICE_DISCOVERY_STALE_TTL_MS is lower than browse interval; peers may churn as stale quickly."
                    .to_string(),
            );
        }
        if config.runtime_backend_id.trim().is_empty() {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_RUNTIME_BACKEND_ID must not be empty when discovery is enabled."
                    .to_string(),
            );
        }
        if config.runtime_backend_capabilities.is_empty() {
            validation.errors.push(
                "CODE_RUNTIME_SERVICE_RUNTIME_BACKEND_CAPABILITIES must include at least one capability."
                    .to_string(),
            );
        }
    }
    let mut seen_extension_provider_ids = std::collections::HashSet::new();
    let mut seen_extension_aliases = std::collections::HashSet::new();
    for extension in &config.provider_extension_seeds {
        if !seen_extension_provider_ids.insert(extension.provider_id.clone()) {
            validation.errors.push(format!(
                "Duplicate provider extension id `{}`.",
                extension.provider_id
            ));
        }
        if RuntimeProvider::from_alias(Some(extension.provider_id.as_str())).is_some() {
            validation.errors.push(format!(
                "Provider extension id `{}` collides with built-in provider aliases.",
                extension.provider_id
            ));
        }
        if normalize_openai_compat_base_url(extension.compat_base_url.as_str()).is_none() {
            validation.errors.push(format!(
                "Provider extension `{}` has invalid compatBaseUrl `{}`.",
                extension.provider_id, extension.compat_base_url
            ));
        }
        for alias in &extension.aliases {
            if !seen_extension_aliases.insert(alias.clone()) {
                validation
                    .errors
                    .push(format!("Duplicate provider extension alias `{alias}`."));
            }
        }
        if extension.api_key.is_none() {
            let source_hint = if extension.api_key_env.trim().is_empty() {
                "set `apiKey` in provider extension config".to_string()
            } else {
                format!("set env `{}`", extension.api_key_env)
            };
            validation.warnings.push(format!(
                "Provider extension `{}` is configured without API key; requests will fail ({source_hint}).",
                extension.provider_id
            ));
        }
    }

    validation
}

fn evaluate_readiness_checks(config: &ServiceConfig) -> ReadinessChecks {
    let default_model_trimmed = config.default_model_id.trim();
    let default_provider = infer_provider(None, Some(default_model_trimmed));
    let default_provider_ready = if default_model_trimmed.is_empty() {
        false
    } else {
        (default_provider.is_endpoint_valid(config) && default_provider.has_api_key(config))
            || is_openai_compat_ready_for_provider(config, default_provider)
    };

    ReadinessChecks {
        openai_api_key_present: RuntimeProvider::OpenAI.has_api_key(config),
        anthropic_api_key_present: RuntimeProvider::Anthropic.has_api_key(config),
        gemini_api_key_present: RuntimeProvider::Google.has_api_key(config),
        openai_endpoint_valid: RuntimeProvider::OpenAI.is_endpoint_valid(config),
        anthropic_endpoint_valid: RuntimeProvider::Anthropic.is_endpoint_valid(config),
        gemini_endpoint_valid: RuntimeProvider::Google.is_endpoint_valid(config),
        default_model_valid: !default_model_trimmed.is_empty(),
        default_provider_ready,
    }
}


fn compat_model_cache_ttl(config: &ServiceConfig) -> Duration {
    Duration::from_millis(config.openai_compat_model_cache_ttl_ms.max(1))
}

fn compat_model_error_cooldown() -> Duration {
    Duration::from_millis(OPENAI_COMPAT_MODEL_CATALOG_ERROR_COOLDOWN_MS.max(1))
}

fn openai_http_timeout(config: &ServiceConfig) -> Duration {
    Duration::from_millis(config.openai_timeout_ms.max(1))
}

#[derive(Clone, Copy, Debug)]
struct WsTransportLimits {
    write_buffer_size_bytes: usize,
    max_write_buffer_size_bytes: usize,
    max_frame_size_bytes: usize,
    max_message_size_bytes: usize,
}

fn resolve_ws_transport_limits(config: &ServiceConfig) -> WsTransportLimits {
    let write_buffer_size_bytes = config
        .ws_write_buffer_size_bytes
        .clamp(1, MAX_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES_HARD);
    let max_write_buffer_size_bytes = config.ws_max_write_buffer_size_bytes.clamp(
        write_buffer_size_bytes.saturating_add(1),
        MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD,
    );
    let max_frame_size_bytes = config
        .ws_max_frame_size_bytes
        .clamp(1, MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD);
    let max_message_size_bytes = config.ws_max_message_size_bytes.clamp(
        max_frame_size_bytes,
        MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD,
    );
    WsTransportLimits {
        write_buffer_size_bytes,
        max_write_buffer_size_bytes,
        max_frame_size_bytes,
        max_message_size_bytes,
    }
}

fn resolve_ws_max_connections(config: &ServiceConfig) -> usize {
    config
        .ws_max_connections
        .clamp(1, MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD)
}


#[cfg(test)]
mod tests {
    use super::derive_openai_compat_base_url_from_responses_endpoint;

    #[test]
    fn derive_compat_base_url_supports_openai_responses_endpoint() {
        let derived = derive_openai_compat_base_url_from_responses_endpoint(
            "https://api.openai.com/v1/responses",
        );
        assert_eq!(derived.as_deref(), Some("https://api.openai.com/v1"));
    }

    #[test]
    fn derive_compat_base_url_supports_chat_completions_endpoint() {
        let derived = derive_openai_compat_base_url_from_responses_endpoint(
            "https://api.openai.com/v1/chat/completions",
        );
        assert_eq!(derived.as_deref(), Some("https://api.openai.com/v1"));
    }
}
