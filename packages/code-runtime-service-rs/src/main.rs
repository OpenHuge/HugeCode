use std::{
    fs,
    net::SocketAddr,
    path::{Path, PathBuf},
};

use anyhow::{bail, Context};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use clap::Parser;
use code_runtime_service_rs::oauth_pool::{
    default_oauth_pool_db_path, resolve_default_oauth_pool_db_path,
    resolve_legacy_default_oauth_pool_db_path, validate_oauth_secret_key,
};
use code_runtime_service_rs::{
    build_router_from_runtime_app_state, build_runtime_app_state_from_env, create_initial_state,
    parse_provider_extension_seeds, validate_service_config, ServiceConfig,
    DEFAULT_AGENT_MAX_CONCURRENT_TASKS, DEFAULT_AGENT_TASK_HISTORY_LIMIT,
    DEFAULT_ANTHROPIC_ENDPOINT, DEFAULT_ANTHROPIC_VERSION, DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
    DEFAULT_DISCOVERY_SERVICE_TYPE, DEFAULT_DISCOVERY_STALE_TTL_MS,
    DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS, DEFAULT_DISTRIBUTED_LANE_COUNT,
    DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY, DEFAULT_GEMINI_ENDPOINT,
    DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL, DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
    DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS, DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
    DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS, DEFAULT_OPENAI_MAX_RETRIES,
    DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS, DEFAULT_RUNTIME_BACKEND_CAPABILITIES,
    DEFAULT_RUNTIME_WS_MAX_CONNECTIONS, DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
    DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
    DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES, DEFAULT_SANDBOX_NETWORK_ACCESS,
};
use rand::Rng;
use tokio::{signal, sync::watch};
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

const OAUTH_SECRET_KEY_FILE_ENV: &str = "CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY_FILE";
const DEFAULT_OAUTH_SECRET_KEY_FILE: &str = ".hugecode/oauth-secret.key";
const LEGACY_DEFAULT_OAUTH_SECRET_KEY_FILE: &str = ".code-runtime-service/oauth-secret.key";

#[derive(Debug, Parser)]
#[command(name = "code-runtime-service-rs")]
#[command(about = "Standalone runtime service for apps/code web and desktop clients")]
struct Cli {
    #[arg(long, env = "CODE_RUNTIME_SERVICE_HOST", default_value = "127.0.0.1")]
    host: String,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_PORT", default_value_t = 8788)]
    port: u16,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DEFAULT_MODEL",
        default_value = "gpt-5.5"
    )]
    default_model: String,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT",
        default_value = "https://api.openai.com/v1/responses"
    )]
    openai_endpoint: String,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL")]
    openai_compat_base_url: Option<String>,
    #[arg(long, env = "OPENAI_API_KEY")]
    openai_api_key: Option<String>,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY")]
    openai_compat_api_key: Option<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS",
        default_value_t = DEFAULT_OPENAI_TIMEOUT_MS
    )]
    openai_timeout_ms: u64,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES",
        default_value_t = DEFAULT_OPENAI_MAX_RETRIES
    )]
    openai_max_retries: u32,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_OPENAI_RETRY_BASE_MS",
        default_value_t = DEFAULT_OPENAI_RETRY_BASE_MS
    )]
    openai_retry_base_ms: u64,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS",
        default_value_t = DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS
    )]
    openai_compat_model_cache_ttl_ms: u64,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_ENABLED",
        default_value_t = true
    )]
    live_skills_network_enabled: bool,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_BASE_URL",
        default_value = DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL
    )]
    live_skills_network_base_url: String,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_TIMEOUT_MS",
        default_value_t = DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS
    )]
    live_skills_network_timeout_ms: u64,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_LIVE_SKILLS_NETWORK_CACHE_TTL_MS",
        default_value_t = DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS
    )]
    live_skills_network_cache_ttl_ms: u64,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_SANDBOX_ENABLED",
        default_value_t = false
    )]
    sandbox_enabled: bool,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_SANDBOX_NETWORK_ACCESS",
        default_value = DEFAULT_SANDBOX_NETWORK_ACCESS
    )]
    sandbox_network_access: String,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_SANDBOX_ALLOWED_HOSTS",
        value_delimiter = ','
    )]
    sandbox_allowed_hosts: Vec<String>,
    #[arg(long, env = "ANTHROPIC_API_KEY")]
    anthropic_api_key: Option<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_ANTHROPIC_ENDPOINT",
        default_value = DEFAULT_ANTHROPIC_ENDPOINT
    )]
    anthropic_endpoint: String,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_ANTHROPIC_VERSION",
        default_value = DEFAULT_ANTHROPIC_VERSION
    )]
    anthropic_version: String,
    #[arg(long, env = "GEMINI_API_KEY")]
    gemini_api_key: Option<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_GEMINI_ENDPOINT",
        default_value = DEFAULT_GEMINI_ENDPOINT
    )]
    gemini_endpoint: String,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_OAUTH_POOL_DB",
        default_value_t = default_oauth_pool_db_path()
    )]
    oauth_pool_db_path: String,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY")]
    oauth_secret_key: Option<String>,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL")]
    oauth_public_base_url: Option<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_OAUTH_LOOPBACK_CALLBACK_PORT",
        default_value_t = DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT
    )]
    oauth_loopback_callback_port: u16,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_AUTH_TOKEN")]
    runtime_auth_token: Option<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS",
        default_value_t = DEFAULT_AGENT_MAX_CONCURRENT_TASKS
    )]
    agent_max_concurrent_tasks: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT",
        default_value_t = DEFAULT_AGENT_TASK_HISTORY_LIMIT
    )]
    agent_task_history_limit: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISTRIBUTED_ENABLED",
        default_value_t = false
    )]
    distributed_enabled: bool,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_DISTRIBUTED_REDIS_URL")]
    distributed_redis_url: Option<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISTRIBUTED_LANE_COUNT",
        default_value_t = DEFAULT_DISTRIBUTED_LANE_COUNT
    )]
    distributed_lane_count: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISTRIBUTED_WORKER_CONCURRENCY",
        default_value_t = DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY
    )]
    distributed_worker_concurrency: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISTRIBUTED_CLAIM_IDLE_MS",
        default_value_t = DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS
    )]
    distributed_claim_idle_ms: u64,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISCOVERY_ENABLED",
        default_value_t = false
    )]
    discovery_enabled: bool,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISCOVERY_SERVICE_TYPE",
        default_value = DEFAULT_DISCOVERY_SERVICE_TYPE
    )]
    discovery_service_type: String,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISCOVERY_BROWSE_INTERVAL_MS",
        default_value_t = DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS
    )]
    discovery_browse_interval_ms: u64,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_DISCOVERY_STALE_TTL_MS",
        default_value_t = DEFAULT_DISCOVERY_STALE_TTL_MS
    )]
    discovery_stale_ttl_ms: u64,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_RUNTIME_BACKEND_ID")]
    runtime_backend_id: Option<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_RUNTIME_BACKEND_CAPABILITIES",
        value_delimiter = ',',
        default_value = DEFAULT_RUNTIME_BACKEND_CAPABILITIES
    )]
    runtime_backend_capabilities: Vec<String>,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_WS_WRITE_BUFFER_SIZE_BYTES",
        default_value_t = DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES
    )]
    ws_write_buffer_size_bytes: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES",
        default_value_t = DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES
    )]
    ws_max_write_buffer_size_bytes: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES",
        default_value_t = DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES
    )]
    ws_max_frame_size_bytes: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES",
        default_value_t = DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES
    )]
    ws_max_message_size_bytes: usize,
    #[arg(
        long,
        env = "CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS",
        default_value_t = DEFAULT_RUNTIME_WS_MAX_CONNECTIONS
    )]
    ws_max_connections: usize,
    #[arg(long, env = "CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON")]
    provider_extensions_json: Option<String>,
}

fn resolve_default_oauth_secret_key_file_path() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())?;
    let trimmed = home.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed).join(DEFAULT_OAUTH_SECRET_KEY_FILE))
}

fn resolve_legacy_default_oauth_secret_key_file_path() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())?;
    let trimmed = home.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed).join(LEGACY_DEFAULT_OAUTH_SECRET_KEY_FILE))
}

fn migrate_legacy_oauth_secret_key_file_if_needed(path: &Path) -> anyhow::Result<()> {
    if path.exists() {
        return Ok(());
    }
    let Some(default_path) = resolve_default_oauth_secret_key_file_path() else {
        return Ok(());
    };
    if path != default_path {
        return Ok(());
    }
    let Some(legacy_path) = resolve_legacy_default_oauth_secret_key_file_path() else {
        return Ok(());
    };
    if !legacy_path.exists() {
        return Ok(());
    }
    let parent = path
        .parent()
        .with_context(|| format!("Invalid OAuth secret key file path: {}", path.display()))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Create OAuth secret key directory `{}`", parent.display()))?;
    fs::copy(legacy_path.as_path(), path).with_context(|| {
        format!(
            "Copy legacy OAuth secret key file `{}` to `{}`",
            legacy_path.display(),
            path.display()
        )
    })?;
    Ok(())
}

fn copy_file_if_exists(source: &Path, target: &Path) -> anyhow::Result<()> {
    if !source.exists() {
        return Ok(());
    }
    fs::copy(source, target).with_context(|| {
        format!(
            "Copy legacy OAuth pool file `{}` to `{}`",
            source.display(),
            target.display()
        )
    })?;
    Ok(())
}

fn migrate_legacy_oauth_pool_db_if_needed_impl(
    path: &Path,
    default_path: Option<&Path>,
    legacy_path: Option<&Path>,
) -> anyhow::Result<()> {
    if path.exists() {
        return Ok(());
    }
    let Some(default_path) = default_path else {
        return Ok(());
    };
    if path != default_path {
        return Ok(());
    }
    let Some(legacy_path) = legacy_path else {
        return Ok(());
    };
    if !legacy_path.exists() {
        return Ok(());
    }
    // Preserve previously logged-in accounts when moving from the old temp-dir store
    // to the canonical ~/.hugecode runtime store.
    let parent = path
        .parent()
        .with_context(|| format!("Invalid OAuth pool db path: {}", path.display()))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Create OAuth pool directory `{}`", parent.display()))?;
    copy_file_if_exists(legacy_path, path)?;
    for suffix in ["-wal", "-shm"] {
        let legacy_sidecar = PathBuf::from(format!("{}{}", legacy_path.display(), suffix));
        let target_sidecar = PathBuf::from(format!("{}{}", path.display(), suffix));
        copy_file_if_exists(legacy_sidecar.as_path(), target_sidecar.as_path())?;
    }
    Ok(())
}

fn migrate_legacy_oauth_pool_db_if_needed(path: &Path) -> anyhow::Result<()> {
    let default_path = resolve_default_oauth_pool_db_path();
    let legacy_path = resolve_legacy_default_oauth_pool_db_path();
    migrate_legacy_oauth_pool_db_if_needed_impl(
        path,
        default_path.as_deref(),
        Some(legacy_path.as_path()),
    )
}

fn prepare_oauth_pool_db_path_for_startup(path: &Path) -> anyhow::Result<()> {
    if path == Path::new(":memory:") {
        return Ok(());
    }
    migrate_legacy_oauth_pool_db_if_needed(path)?;
    let parent = path
        .parent()
        .filter(|entry| !entry.as_os_str().is_empty())
        .with_context(|| format!("Invalid OAuth pool db path: {}", path.display()))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Create OAuth pool directory `{}`", parent.display()))?;
    Ok(())
}

fn persist_generated_oauth_secret_key(path: &PathBuf, encoded_key: &str) -> anyhow::Result<()> {
    let parent = path
        .parent()
        .with_context(|| format!("Invalid OAuth secret key file path: {}", path.display()))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Create OAuth secret key directory `{}`", parent.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(parent, fs::Permissions::from_mode(0o700))
            .with_context(|| format!("Set directory permissions on `{}`", parent.display()))?;
    }
    fs::write(path, format!("{encoded_key}\n"))
        .with_context(|| format!("Write OAuth secret key file `{}`", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .with_context(|| format!("Set file permissions on `{}`", path.display()))?;
    }
    Ok(())
}

fn resolve_oauth_secret_key_with_path(
    cli_secret_key: Option<String>,
    secret_file_path_override: Option<PathBuf>,
) -> anyhow::Result<String> {
    if let Some(configured) = cli_secret_key
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        return Ok(configured.to_string());
    }

    let secret_file_path = secret_file_path_override
        .or_else(|| {
            std::env::var(OAUTH_SECRET_KEY_FILE_ENV)
                .ok()
                .map(PathBuf::from)
        })
        .or_else(resolve_default_oauth_secret_key_file_path)
        .with_context(|| {
            format!(
                "Missing OAuth secret key configuration. Set CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY \
or provide a writable path via {OAUTH_SECRET_KEY_FILE_ENV}."
            )
        })?;
    migrate_legacy_oauth_secret_key_file_if_needed(secret_file_path.as_path())?;

    if secret_file_path.exists() {
        let existing = fs::read_to_string(&secret_file_path).with_context(|| {
            format!(
                "Read OAuth secret key file `{}`",
                secret_file_path.display()
            )
        })?;
        let trimmed = existing.trim();
        if trimmed.is_empty() {
            bail!(
                "OAuth secret key file `{}` is empty. Delete it to regenerate or set CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY.",
                secret_file_path.display()
            );
        }
        return Ok(trimmed.to_string());
    }

    let mut raw = [0_u8; 32];
    rand::rng().fill_bytes(&mut raw);
    let encoded = STANDARD.encode(raw);
    persist_generated_oauth_secret_key(&secret_file_path, encoded.as_str())?;
    info!(
        path = %secret_file_path.display(),
        "generated and persisted OAuth secret key"
    );
    Ok(encoded)
}

fn resolve_oauth_secret_key(cli_secret_key: Option<String>) -> anyhow::Result<String> {
    resolve_oauth_secret_key_with_path(cli_secret_key, None)
}

fn normalize_oauth_loopback_callback_port(config: &mut ServiceConfig, address: SocketAddr) {
    let _ = address;
    if config.oauth_public_base_url.is_some() {
        return;
    }
}

async fn wait_for_shutdown(mut shutdown_rx: watch::Receiver<bool>) {
    if *shutdown_rx.borrow() {
        return;
    }
    while shutdown_rx.changed().await.is_ok() {
        if *shutdown_rx.borrow() {
            return;
        }
    }
}

fn normalize_runtime_backend_capabilities(capabilities: Vec<String>) -> Vec<String> {
    let mut normalized = capabilities
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    normalized.sort_unstable();
    normalized.dedup();
    normalized
}

fn resolve_runtime_backend_id(override_id: Option<&str>, host: &str, port: u16) -> String {
    if let Some(value) = override_id.map(str::trim).filter(|entry| !entry.is_empty()) {
        return value.to_string();
    }
    let sanitized_host = host
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    format!("runtime-{sanitized_host}-{port}")
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "code_runtime_service_rs=info,tower_http=info".to_string()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();
    let address: SocketAddr = format!("{}:{}", cli.host, cli.port)
        .parse()
        .with_context(|| "Failed to parse CODE_RUNTIME_SERVICE_HOST/CODE_RUNTIME_SERVICE_PORT")?;
    let provider_extension_seeds =
        parse_provider_extension_seeds(cli.provider_extensions_json.as_deref())
            .map_err(anyhow::Error::msg)
            .with_context(|| "Failed to parse provider extension configuration")?;
    let resolved_oauth_secret_key = resolve_oauth_secret_key(cli.oauth_secret_key.clone())?;
    validate_oauth_secret_key(resolved_oauth_secret_key.as_str())
        .map_err(anyhow::Error::msg)
        .with_context(|| {
            "Invalid OAuth secret key. Provide a base64-encoded 32-byte key via \
CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY (or delete the persisted key file to regenerate)."
        })?;
    let runtime_backend_id = resolve_runtime_backend_id(
        cli.runtime_backend_id.as_deref(),
        cli.host.as_str(),
        cli.port,
    );
    let runtime_backend_capabilities =
        normalize_runtime_backend_capabilities(cli.runtime_backend_capabilities.clone());

    let mut config = ServiceConfig {
        default_model_id: cli.default_model.clone(),
        openai_api_key: cli.openai_api_key.clone(),
        openai_endpoint: cli.openai_endpoint.clone(),
        openai_compat_base_url: cli.openai_compat_base_url.clone(),
        openai_compat_api_key: cli.openai_compat_api_key.clone(),
        anthropic_api_key: cli.anthropic_api_key.clone(),
        anthropic_endpoint: cli.anthropic_endpoint.clone(),
        anthropic_version: cli.anthropic_version.clone(),
        gemini_api_key: cli.gemini_api_key.clone(),
        gemini_endpoint: cli.gemini_endpoint.clone(),
        openai_timeout_ms: cli.openai_timeout_ms,
        openai_max_retries: cli.openai_max_retries,
        openai_retry_base_ms: cli.openai_retry_base_ms,
        openai_compat_model_cache_ttl_ms: cli.openai_compat_model_cache_ttl_ms,
        live_skills_network_enabled: cli.live_skills_network_enabled,
        live_skills_network_base_url: cli.live_skills_network_base_url.clone(),
        live_skills_network_timeout_ms: cli.live_skills_network_timeout_ms,
        live_skills_network_cache_ttl_ms: cli.live_skills_network_cache_ttl_ms,
        sandbox_enabled: cli.sandbox_enabled,
        sandbox_network_access: cli.sandbox_network_access.clone(),
        sandbox_allowed_hosts: cli.sandbox_allowed_hosts.clone(),
        oauth_pool_db_path: cli.oauth_pool_db_path.clone(),
        oauth_secret_key: Some(resolved_oauth_secret_key),
        oauth_public_base_url: cli.oauth_public_base_url.clone(),
        oauth_loopback_callback_port: cli.oauth_loopback_callback_port,
        runtime_auth_token: cli
            .runtime_auth_token
            .as_deref()
            .map(str::trim)
            .filter(|token| !token.is_empty())
            .map(str::to_string),
        agent_max_concurrent_tasks: cli.agent_max_concurrent_tasks,
        agent_task_history_limit: cli.agent_task_history_limit,
        distributed_enabled: cli.distributed_enabled,
        distributed_redis_url: cli.distributed_redis_url.clone(),
        distributed_lane_count: cli.distributed_lane_count,
        distributed_worker_concurrency: cli.distributed_worker_concurrency,
        distributed_claim_idle_ms: cli.distributed_claim_idle_ms,
        discovery_enabled: cli.discovery_enabled,
        discovery_service_type: cli.discovery_service_type.clone(),
        discovery_browse_interval_ms: cli.discovery_browse_interval_ms,
        discovery_stale_ttl_ms: cli.discovery_stale_ttl_ms,
        runtime_backend_id,
        runtime_backend_capabilities,
        runtime_port: cli.port,
        ws_write_buffer_size_bytes: cli.ws_write_buffer_size_bytes,
        ws_max_write_buffer_size_bytes: cli.ws_max_write_buffer_size_bytes,
        ws_max_frame_size_bytes: cli.ws_max_frame_size_bytes,
        ws_max_message_size_bytes: cli.ws_max_message_size_bytes,
        ws_max_connections: cli.ws_max_connections,
        provider_extension_seeds,
    };
    prepare_oauth_pool_db_path_for_startup(Path::new(config.oauth_pool_db_path.as_str()))?;
    let validation = validate_service_config(&config);
    if !validation.errors.is_empty() {
        for error in &validation.errors {
            warn!(error = error.as_str(), "invalid startup configuration");
        }
        bail!("code-runtime-service-rs configuration validation failed");
    }
    for warning in &validation.warnings {
        warn!(warning = warning.as_str(), "startup configuration warning");
    }
    normalize_oauth_loopback_callback_port(&mut config, address);

    let state = create_initial_state(&cli.default_model);
    let app_state = build_runtime_app_state_from_env(state, config);
    let app = build_router_from_runtime_app_state(app_state.clone());

    let listener = tokio::net::TcpListener::bind(address)
        .await
        .with_context(|| format!("Failed to bind runtime service to {address}"))?;

    info!("code-runtime-service-rs listening on http://{address}");

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let shutdown_task = tokio::spawn(async move {
        shutdown_signal().await;
        let _ = shutdown_tx.send(true);
    });

    let primary_server = axum::serve(listener, app.clone())
        .with_graceful_shutdown(wait_for_shutdown(shutdown_rx.clone()));

    let primary_result = primary_server.await;
    shutdown_task.abort();
    app_state.shutdown_background_tasks().await;
    primary_result.with_context(|| "Runtime service crashed")?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn test_service_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.5".to_string(),
            openai_api_key: None,
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
            anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
            gemini_api_key: None,
            gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
            openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
            openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
            openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
            openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
            live_skills_network_enabled: true,
            live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
            live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
            live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: default_oauth_pool_db_path(),
            oauth_secret_key: Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=".to_string()),
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: DEFAULT_DISTRIBUTED_LANE_COUNT,
            distributed_worker_concurrency: DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY,
            distributed_claim_idle_ms: DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "runtime-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extension_seeds: Vec::new(),
        }
    }

    fn temp_secret_key_path(test_name: &str) -> PathBuf {
        std::env::temp_dir()
            .join(format!(
                "code-runtime-service-rs-{test_name}-{}",
                Uuid::new_v4()
            ))
            .join("oauth-secret.key")
    }

    #[test]
    fn resolve_oauth_secret_key_uses_trimmed_cli_value() {
        let resolved = resolve_oauth_secret_key_with_path(
            Some("  AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=  ".to_string()),
            Some(temp_secret_key_path("cli-override")),
        )
        .expect("resolve oauth secret key");
        assert_eq!(resolved, "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=");
    }

    #[test]
    fn resolve_oauth_secret_key_generates_and_reuses_persisted_key() {
        let secret_file_path = temp_secret_key_path("persisted-key");
        let first = resolve_oauth_secret_key_with_path(None, Some(secret_file_path.clone()))
            .expect("generate oauth secret key");
        validate_oauth_secret_key(first.as_str()).expect("generated key should be valid");
        let persisted = fs::read_to_string(&secret_file_path).expect("read persisted key file");
        assert_eq!(persisted.trim(), first);

        let second = resolve_oauth_secret_key_with_path(None, Some(secret_file_path.clone()))
            .expect("reuse oauth secret key");
        assert_eq!(second, first);

        let _ = fs::remove_file(&secret_file_path);
        if let Some(parent) = secret_file_path.parent() {
            let _ = fs::remove_dir(parent);
        }
    }

    #[test]
    fn default_oauth_pool_db_path_prefers_hugecode_home_directory() {
        let expected = resolve_default_oauth_pool_db_path()
            .unwrap_or_else(resolve_legacy_default_oauth_pool_db_path)
            .to_string_lossy()
            .into_owned();

        assert_eq!(default_oauth_pool_db_path(), expected);
    }

    #[test]
    fn migrate_legacy_oauth_pool_db_copies_legacy_temp_db_into_hugecode_home() {
        let temp_root = std::env::temp_dir().join(format!("oauth-pool-migrate-{}", Uuid::new_v4()));
        let default_path = temp_root.join(".hugecode/oauth-pool.db");
        let legacy_path = temp_root.join("code-runtime-service-oauth-pool.db");
        let legacy_wal = temp_root.join("code-runtime-service-oauth-pool.db-wal");
        let legacy_shm = temp_root.join("code-runtime-service-oauth-pool.db-shm");

        fs::create_dir_all(&temp_root).expect("create temp root");
        fs::write(&legacy_path, b"sqlite-main").expect("write legacy db");
        fs::write(&legacy_wal, b"sqlite-wal").expect("write legacy wal");
        fs::write(&legacy_shm, b"sqlite-shm").expect("write legacy shm");

        migrate_legacy_oauth_pool_db_if_needed_impl(
            default_path.as_path(),
            Some(default_path.as_path()),
            Some(legacy_path.as_path()),
        )
        .expect("migrate legacy oauth pool db");

        assert_eq!(
            fs::read(&default_path).expect("read migrated db"),
            b"sqlite-main"
        );
        assert_eq!(
            fs::read(format!("{}-wal", default_path.display())).expect("read migrated wal"),
            b"sqlite-wal"
        );
        assert_eq!(
            fs::read(format!("{}-shm", default_path.display())).expect("read migrated shm"),
            b"sqlite-shm"
        );

        let _ = fs::remove_file(&legacy_path);
        let _ = fs::remove_file(&legacy_wal);
        let _ = fs::remove_file(&legacy_shm);
        let _ = fs::remove_file(&default_path);
        let _ = fs::remove_file(format!("{}-wal", default_path.display()));
        let _ = fs::remove_file(format!("{}-shm", default_path.display()));
        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn prepare_oauth_pool_db_path_for_startup_creates_parent_directory() {
        let temp_root = std::env::temp_dir().join(format!("oauth-pool-parent-{}", Uuid::new_v4()));
        let db_path = temp_root.join(".hugecode/oauth-pool.db");

        prepare_oauth_pool_db_path_for_startup(db_path.as_path())
            .expect("prepare oauth pool db path");

        assert!(
            db_path.parent().expect("db path parent").exists(),
            "oauth pool parent directory should exist"
        );

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn resolve_oauth_secret_key_rejects_empty_secret_file() {
        let secret_file_path = temp_secret_key_path("empty-file");
        if let Some(parent) = secret_file_path.parent() {
            fs::create_dir_all(parent).expect("create parent dir");
        }
        fs::write(&secret_file_path, "\n").expect("write empty secret file");

        let error = resolve_oauth_secret_key_with_path(None, Some(secret_file_path.clone()))
            .expect_err("empty secret file should be rejected");
        let message = format!("{error:#}");
        assert!(message.contains("is empty"));

        let _ = fs::remove_file(&secret_file_path);
        if let Some(parent) = secret_file_path.parent() {
            let _ = fs::remove_dir(parent);
        }
    }

    #[test]
    fn normalize_oauth_loopback_callback_port_preserves_dedicated_loopback_port() {
        let mut config = test_service_config();
        config.oauth_public_base_url = None;
        config.oauth_loopback_callback_port = 1455;

        let runtime_address: SocketAddr = "127.0.0.1:8788".parse().expect("parse socket address");
        normalize_oauth_loopback_callback_port(&mut config, runtime_address);

        assert_eq!(config.oauth_loopback_callback_port, 1455);
    }

    #[test]
    fn normalize_oauth_loopback_callback_port_keeps_existing_when_already_matching() {
        let mut config = test_service_config();
        config.oauth_public_base_url = None;
        config.oauth_loopback_callback_port = 8788;

        let runtime_address: SocketAddr = "127.0.0.1:8788".parse().expect("parse socket address");
        normalize_oauth_loopback_callback_port(&mut config, runtime_address);

        assert_eq!(config.oauth_loopback_callback_port, 8788);
    }

    #[test]
    fn normalize_oauth_loopback_callback_port_preserves_public_base_url_setting() {
        let mut config = test_service_config();
        config.oauth_public_base_url = Some("https://runtime.example.com".to_string());
        config.oauth_loopback_callback_port = 1455;

        let runtime_address: SocketAddr = "127.0.0.1:8788".parse().expect("parse socket address");
        normalize_oauth_loopback_callback_port(&mut config, runtime_address);

        assert_eq!(config.oauth_loopback_callback_port, 1455);
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sigterm) = signal::unix::signal(signal::unix::SignalKind::terminate()) {
            let _ = sigterm.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("received Ctrl+C shutdown signal"),
        _ = terminate => info!("received SIGTERM shutdown signal"),
    }
}
