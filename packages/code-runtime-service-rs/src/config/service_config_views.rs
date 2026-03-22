//! Typed views over `ServiceConfig`.
//!
//! This file keeps the legacy flat `ServiceConfig` compatible while exposing
//! narrower, domain-oriented views for future multi-crate extraction.

use super::*;

impl ServiceConfig {
    pub fn views(&self) -> ServiceConfigViews<'_> {
        ServiceConfigViews::new(self)
    }

    pub fn distributed_runtime_config(&self) -> distributed::config::DistributedRuntimeConfig {
        let distributed = self.views().distributed();
        distributed::config::DistributedRuntimeConfig {
            enabled: distributed.distributed_enabled,
            redis_url: distributed.distributed_redis_url.map(str::to_string),
            lane_count: distributed.distributed_lane_count,
            worker_concurrency: distributed.distributed_worker_concurrency,
            claim_idle_ms: distributed.distributed_claim_idle_ms,
        }
    }
}

#[derive(Copy, Clone)]
pub struct ServiceConfigViews<'a> {
    config: &'a ServiceConfig,
}

impl<'a> ServiceConfigViews<'a> {
    pub fn new(config: &'a ServiceConfig) -> Self {
        Self { config }
    }

    pub fn config(self) -> &'a ServiceConfig {
        self.config
    }

    pub fn provider(self) -> ProviderConfigView<'a> {
        ProviderConfigView {
            default_model_id: self.config.default_model_id.as_str(),
            openai_api_key: self.config.openai_api_key.as_deref(),
            openai_endpoint: self.config.openai_endpoint.as_str(),
            anthropic_api_key: self.config.anthropic_api_key.as_deref(),
            anthropic_endpoint: self.config.anthropic_endpoint.as_str(),
            anthropic_version: self.config.anthropic_version.as_str(),
            gemini_api_key: self.config.gemini_api_key.as_deref(),
            gemini_endpoint: self.config.gemini_endpoint.as_str(),
            provider_extensions: self.config.provider_extensions.as_slice(),
        }
    }

    pub fn openai_transport(self) -> OpenAiTransportConfigView<'a> {
        OpenAiTransportConfigView {
            openai_endpoint: self.config.openai_endpoint.as_str(),
            openai_compat_base_url: self.config.openai_compat_base_url.as_deref(),
            openai_compat_api_key: self.config.openai_compat_api_key.as_deref(),
            openai_timeout_ms: self.config.openai_timeout_ms,
            openai_max_retries: self.config.openai_max_retries,
            openai_retry_base_ms: self.config.openai_retry_base_ms,
            openai_compat_model_cache_ttl_ms: self.config.openai_compat_model_cache_ttl_ms,
        }
    }

    pub fn transport(self) -> TransportConfigView<'a> {
        TransportConfigView {
            runtime_port: self.config.runtime_port,
            runtime_auth_token: self.config.runtime_auth_token.as_deref(),
            ws_write_buffer_size_bytes: self.config.ws_write_buffer_size_bytes,
            ws_max_write_buffer_size_bytes: self.config.ws_max_write_buffer_size_bytes,
            ws_max_frame_size_bytes: self.config.ws_max_frame_size_bytes,
            ws_max_message_size_bytes: self.config.ws_max_message_size_bytes,
            ws_max_connections: self.config.ws_max_connections,
        }
    }

    pub fn distributed(self) -> DistributedConfigView<'a> {
        DistributedConfigView {
            distributed_enabled: self.config.distributed_enabled,
            distributed_redis_url: self.config.distributed_redis_url.as_deref(),
            distributed_lane_count: self.config.distributed_lane_count,
            distributed_worker_concurrency: self.config.distributed_worker_concurrency,
            distributed_claim_idle_ms: self.config.distributed_claim_idle_ms,
        }
    }

    pub fn discovery(self) -> DiscoveryConfigView<'a> {
        DiscoveryConfigView {
            discovery_enabled: self.config.discovery_enabled,
            discovery_service_type: self.config.discovery_service_type.as_str(),
            discovery_browse_interval_ms: self.config.discovery_browse_interval_ms,
            discovery_stale_ttl_ms: self.config.discovery_stale_ttl_ms,
        }
    }

    pub fn oauth(self) -> OauthConfigView<'a> {
        OauthConfigView {
            oauth_pool_db_path: self.config.oauth_pool_db_path.as_str(),
            oauth_secret_key: self.config.oauth_secret_key.as_deref(),
            oauth_public_base_url: self.config.oauth_public_base_url.as_deref(),
            oauth_loopback_callback_port: self.config.oauth_loopback_callback_port,
            runtime_auth_token: self.config.runtime_auth_token.as_deref(),
        }
    }

    pub fn agent_execution(self) -> AgentExecutionConfigView<'a> {
        AgentExecutionConfigView {
            agent_max_concurrent_tasks: self.config.agent_max_concurrent_tasks,
            agent_task_history_limit: self.config.agent_task_history_limit,
            runtime_backend_id: self.config.runtime_backend_id.as_str(),
            runtime_backend_capabilities: self.config.runtime_backend_capabilities.as_slice(),
        }
    }

    pub fn into_owned(self) -> OwnedServiceConfigViews {
        OwnedServiceConfigViews {
            provider: self.provider().into_owned(),
            openai_transport: self.openai_transport().into_owned(),
            transport: self.transport().into_owned(),
            distributed: self.distributed().into_owned(),
            discovery: self.discovery().into_owned(),
            oauth: self.oauth().into_owned(),
            agent_execution: self.agent_execution().into_owned(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct ProviderConfigView<'a> {
    pub default_model_id: &'a str,
    pub openai_api_key: Option<&'a str>,
    pub openai_endpoint: &'a str,
    pub anthropic_api_key: Option<&'a str>,
    pub anthropic_endpoint: &'a str,
    pub anthropic_version: &'a str,
    pub gemini_api_key: Option<&'a str>,
    pub gemini_endpoint: &'a str,
    pub provider_extensions: &'a [RuntimeProviderExtension],
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OpenAiTransportConfigView<'a> {
    pub openai_endpoint: &'a str,
    pub openai_compat_base_url: Option<&'a str>,
    pub openai_compat_api_key: Option<&'a str>,
    pub openai_timeout_ms: u64,
    pub openai_max_retries: u32,
    pub openai_retry_base_ms: u64,
    pub openai_compat_model_cache_ttl_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TransportConfigView<'a> {
    pub runtime_port: u16,
    pub runtime_auth_token: Option<&'a str>,
    pub ws_write_buffer_size_bytes: usize,
    pub ws_max_write_buffer_size_bytes: usize,
    pub ws_max_frame_size_bytes: usize,
    pub ws_max_message_size_bytes: usize,
    pub ws_max_connections: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DistributedConfigView<'a> {
    pub distributed_enabled: bool,
    pub distributed_redis_url: Option<&'a str>,
    pub distributed_lane_count: usize,
    pub distributed_worker_concurrency: usize,
    pub distributed_claim_idle_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscoveryConfigView<'a> {
    pub discovery_enabled: bool,
    pub discovery_service_type: &'a str,
    pub discovery_browse_interval_ms: u64,
    pub discovery_stale_ttl_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OauthConfigView<'a> {
    pub oauth_pool_db_path: &'a str,
    pub oauth_secret_key: Option<&'a str>,
    pub oauth_public_base_url: Option<&'a str>,
    pub oauth_loopback_callback_port: u16,
    pub runtime_auth_token: Option<&'a str>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AgentExecutionConfigView<'a> {
    pub agent_max_concurrent_tasks: usize,
    pub agent_task_history_limit: usize,
    pub runtime_backend_id: &'a str,
    pub runtime_backend_capabilities: &'a [String],
}

#[derive(Clone, Debug)]
pub struct OwnedServiceConfigViews {
    pub provider: OwnedProviderConfig,
    pub openai_transport: OwnedOpenAiTransportConfig,
    pub transport: OwnedTransportConfig,
    pub distributed: OwnedDistributedConfig,
    pub discovery: OwnedDiscoveryConfig,
    pub oauth: OwnedOauthConfig,
    pub agent_execution: OwnedAgentExecutionConfig,
}

#[derive(Clone, Debug)]
pub struct OwnedProviderConfig {
    pub default_model_id: String,
    pub openai_api_key: Option<String>,
    pub openai_endpoint: String,
    pub anthropic_api_key: Option<String>,
    pub anthropic_endpoint: String,
    pub anthropic_version: String,
    pub gemini_api_key: Option<String>,
    pub gemini_endpoint: String,
    pub provider_extensions: Vec<RuntimeProviderExtension>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnedOpenAiTransportConfig {
    pub openai_endpoint: String,
    pub openai_compat_base_url: Option<String>,
    pub openai_compat_api_key: Option<String>,
    pub openai_timeout_ms: u64,
    pub openai_max_retries: u32,
    pub openai_retry_base_ms: u64,
    pub openai_compat_model_cache_ttl_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnedTransportConfig {
    pub runtime_port: u16,
    pub runtime_auth_token: Option<String>,
    pub ws_write_buffer_size_bytes: usize,
    pub ws_max_write_buffer_size_bytes: usize,
    pub ws_max_frame_size_bytes: usize,
    pub ws_max_message_size_bytes: usize,
    pub ws_max_connections: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnedDistributedConfig {
    pub distributed_enabled: bool,
    pub distributed_redis_url: Option<String>,
    pub distributed_lane_count: usize,
    pub distributed_worker_concurrency: usize,
    pub distributed_claim_idle_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnedDiscoveryConfig {
    pub discovery_enabled: bool,
    pub discovery_service_type: String,
    pub discovery_browse_interval_ms: u64,
    pub discovery_stale_ttl_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnedOauthConfig {
    pub oauth_pool_db_path: String,
    pub oauth_secret_key: Option<String>,
    pub oauth_public_base_url: Option<String>,
    pub oauth_loopback_callback_port: u16,
    pub runtime_auth_token: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnedAgentExecutionConfig {
    pub agent_max_concurrent_tasks: usize,
    pub agent_task_history_limit: usize,
    pub runtime_backend_id: String,
    pub runtime_backend_capabilities: Vec<String>,
}

impl<'a> ProviderConfigView<'a> {
    pub fn into_owned(self) -> OwnedProviderConfig {
        OwnedProviderConfig {
            default_model_id: self.default_model_id.to_string(),
            openai_api_key: self.openai_api_key.map(str::to_string),
            openai_endpoint: self.openai_endpoint.to_string(),
            anthropic_api_key: self.anthropic_api_key.map(str::to_string),
            anthropic_endpoint: self.anthropic_endpoint.to_string(),
            anthropic_version: self.anthropic_version.to_string(),
            gemini_api_key: self.gemini_api_key.map(str::to_string),
            gemini_endpoint: self.gemini_endpoint.to_string(),
            provider_extensions: self.provider_extensions.to_vec(),
        }
    }
}

impl<'a> OpenAiTransportConfigView<'a> {
    pub fn into_owned(self) -> OwnedOpenAiTransportConfig {
        OwnedOpenAiTransportConfig {
            openai_endpoint: self.openai_endpoint.to_string(),
            openai_compat_base_url: self.openai_compat_base_url.map(str::to_string),
            openai_compat_api_key: self.openai_compat_api_key.map(str::to_string),
            openai_timeout_ms: self.openai_timeout_ms,
            openai_max_retries: self.openai_max_retries,
            openai_retry_base_ms: self.openai_retry_base_ms,
            openai_compat_model_cache_ttl_ms: self.openai_compat_model_cache_ttl_ms,
        }
    }
}

impl<'a> TransportConfigView<'a> {
    pub fn into_owned(self) -> OwnedTransportConfig {
        OwnedTransportConfig {
            runtime_port: self.runtime_port,
            runtime_auth_token: self.runtime_auth_token.map(str::to_string),
            ws_write_buffer_size_bytes: self.ws_write_buffer_size_bytes,
            ws_max_write_buffer_size_bytes: self.ws_max_write_buffer_size_bytes,
            ws_max_frame_size_bytes: self.ws_max_frame_size_bytes,
            ws_max_message_size_bytes: self.ws_max_message_size_bytes,
            ws_max_connections: self.ws_max_connections,
        }
    }
}

impl<'a> DistributedConfigView<'a> {
    pub fn into_owned(self) -> OwnedDistributedConfig {
        OwnedDistributedConfig {
            distributed_enabled: self.distributed_enabled,
            distributed_redis_url: self.distributed_redis_url.map(str::to_string),
            distributed_lane_count: self.distributed_lane_count,
            distributed_worker_concurrency: self.distributed_worker_concurrency,
            distributed_claim_idle_ms: self.distributed_claim_idle_ms,
        }
    }
}

impl<'a> DiscoveryConfigView<'a> {
    pub fn into_owned(self) -> OwnedDiscoveryConfig {
        OwnedDiscoveryConfig {
            discovery_enabled: self.discovery_enabled,
            discovery_service_type: self.discovery_service_type.to_string(),
            discovery_browse_interval_ms: self.discovery_browse_interval_ms,
            discovery_stale_ttl_ms: self.discovery_stale_ttl_ms,
        }
    }
}

impl<'a> OauthConfigView<'a> {
    pub fn into_owned(self) -> OwnedOauthConfig {
        OwnedOauthConfig {
            oauth_pool_db_path: self.oauth_pool_db_path.to_string(),
            oauth_secret_key: self.oauth_secret_key.map(str::to_string),
            oauth_public_base_url: self.oauth_public_base_url.map(str::to_string),
            oauth_loopback_callback_port: self.oauth_loopback_callback_port,
            runtime_auth_token: self.runtime_auth_token.map(str::to_string),
        }
    }
}

impl<'a> AgentExecutionConfigView<'a> {
    pub fn into_owned(self) -> OwnedAgentExecutionConfig {
        OwnedAgentExecutionConfig {
            agent_max_concurrent_tasks: self.agent_max_concurrent_tasks,
            agent_task_history_limit: self.agent_task_history_limit,
            runtime_backend_id: self.runtime_backend_id.to_string(),
            runtime_backend_capabilities: self.runtime_backend_capabilities.to_vec(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.4".to_string(),
            openai_api_key: Some("openai-key".to_string()),
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: Some("https://compat.example.com/v1".to_string()),
            openai_compat_api_key: Some("compat-key".to_string()),
            anthropic_api_key: Some("anthropic-key".to_string()),
            anthropic_endpoint: "https://api.anthropic.com/v1/messages".to_string(),
            anthropic_version: "2023-06-01".to_string(),
            gemini_api_key: Some("gemini-key".to_string()),
            gemini_endpoint: "https://generativelanguage.googleapis.com/v1beta/models".to_string(),
            openai_timeout_ms: 45_000,
            openai_max_retries: 2,
            openai_retry_base_ms: 250,
            openai_compat_model_cache_ttl_ms: 30_000,
            live_skills_network_enabled: true,
            live_skills_network_base_url: "https://skills.example.com".to_string(),
            live_skills_network_timeout_ms: 10_000,
            live_skills_network_cache_ttl_ms: 60_000,
            sandbox_enabled: false,
            sandbox_network_access: "none".to_string(),
            sandbox_allowed_hosts: vec!["example.com".to_string()],
            oauth_pool_db_path: "/tmp/runtime/oauth.sqlite".to_string(),
            oauth_secret_key: Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=".to_string()),
            oauth_public_base_url: Some("https://runtime.example.com".to_string()),
            oauth_loopback_callback_port: 1455,
            runtime_auth_token: Some("token".to_string()),
            agent_max_concurrent_tasks: 4,
            agent_task_history_limit: 256,
            distributed_enabled: true,
            distributed_redis_url: Some("redis://127.0.0.1:6379".to_string()),
            distributed_lane_count: 16,
            distributed_worker_concurrency: 4,
            distributed_claim_idle_ms: 500,
            discovery_enabled: true,
            discovery_service_type: "_openwrap-code-runtime._tcp.local.".to_string(),
            discovery_browse_interval_ms: 5_000,
            discovery_stale_ttl_ms: 15_000,
            runtime_backend_id: "runtime-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: 256 * 1024,
            ws_max_write_buffer_size_bytes: 16 * 1024 * 1024,
            ws_max_frame_size_bytes: 8 * 1024 * 1024,
            ws_max_message_size_bytes: 8 * 1024 * 1024,
            ws_max_connections: 256,
            provider_extensions: vec![RuntimeProviderExtension {
                provider_id: "custom".to_string(),
                display_name: "Custom".to_string(),
                pool: "custom".to_string(),
                default_model_id: "custom-model".to_string(),
                compat_base_url: "https://custom.example.com/v1".to_string(),
                aliases: vec!["custom".to_string()],
                api_key_env: "CUSTOM_API_KEY".to_string(),
                api_key: Some("custom-key".to_string()),
            }],
        }
    }

    #[test]
    fn borrowed_views_expose_expected_fields() {
        let config = sample_config();
        let views = ServiceConfigViews::new(&config);

        assert_eq!(views.provider().default_model_id, "gpt-5.4");
        assert_eq!(views.openai_transport().openai_timeout_ms, 45_000);
        assert_eq!(views.transport().ws_max_connections, 256);
        assert!(views.distributed().distributed_enabled);
        assert!(views.discovery().discovery_enabled);
        assert_eq!(views.oauth().oauth_loopback_callback_port, 1455);
        assert_eq!(views.agent_execution().agent_max_concurrent_tasks, 4);
    }

    #[test]
    fn owned_views_clone_nested_values() {
        let config = sample_config();
        let owned = ServiceConfigViews::new(&config).into_owned();

        assert_eq!(owned.provider.default_model_id, "gpt-5.4");
        assert_eq!(
            owned.openai_transport.openai_compat_base_url.as_deref(),
            Some("https://compat.example.com/v1")
        );
        assert_eq!(owned.transport.runtime_auth_token.as_deref(), Some("token"));
        assert_eq!(
            owned.distributed.distributed_redis_url.as_deref(),
            Some("redis://127.0.0.1:6379")
        );
        assert_eq!(
            owned.discovery.discovery_service_type,
            "_openwrap-code-runtime._tcp.local."
        );
        assert_eq!(
            owned.oauth.oauth_secret_key.as_deref(),
            Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=")
        );
        assert_eq!(
            owned.agent_execution.runtime_backend_capabilities,
            vec!["code".to_string()]
        );
    }
}
