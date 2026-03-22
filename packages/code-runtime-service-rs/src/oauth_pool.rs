use aes_gcm_siv::{
    aead::{Aead, KeyInit},
    Aes256GcmSiv, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rand::RngExt;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    cmp::Ordering,
    collections::HashMap,
    error::Error,
    fmt,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

const DEFAULT_OAUTH_POOL_DB_RELATIVE_PATH: &str = ".hugecode/oauth-pool.db";
const LEGACY_DEFAULT_OAUTH_POOL_DB_FILENAME: &str = "code-runtime-service-oauth-pool.db";

fn resolve_home_dir() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())?;
    let trimmed = home.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

pub fn resolve_default_oauth_pool_db_path() -> Option<PathBuf> {
    // OAuth accounts must persist across runtime restarts, so the canonical store lives
    // under the same ~/.hugecode root as other runtime-backed state.
    resolve_home_dir().map(|home| home.join(DEFAULT_OAUTH_POOL_DB_RELATIVE_PATH))
}

pub fn resolve_legacy_default_oauth_pool_db_path() -> PathBuf {
    std::env::temp_dir().join(LEGACY_DEFAULT_OAUTH_POOL_DB_FILENAME)
}

pub fn default_oauth_pool_db_path() -> String {
    resolve_default_oauth_pool_db_path()
        .unwrap_or_else(resolve_legacy_default_oauth_pool_db_path)
        .to_string_lossy()
        .into_owned()
}

const PROVIDER_CODEX: &str = "codex";
const PROVIDER_GEMINI: &str = "gemini";
const PROVIDER_CLAUDE_CODE: &str = "claude_code";
const DEFAULT_POOL_CODEX: &str = "pool-codex";
const DEFAULT_POOL_GEMINI: &str = "pool-gemini";
const DEFAULT_POOL_CLAUDE: &str = "pool-claude";
const STATUS_ENABLED: &str = "enabled";
const STATUS_DISABLED: &str = "disabled";
const STATUS_FORBIDDEN: &str = "forbidden";
const STATUS_VALIDATION_BLOCKED: &str = "validation_blocked";
const DISABLED_REASON_INVALID_GRANT: &str = "oauth_invalid_grant";
const DISABLED_REASON_POLICY_BLOCKED: &str = "oauth_policy_blocked";
const DISABLED_REASON_PROVIDER_FORBIDDEN: &str = "oauth_provider_forbidden";
const STRATEGY_ROUND_ROBIN: &str = "round_robin";
const STRATEGY_P2C: &str = "p2c";
const STICKY_CACHE_FIRST: &str = "cache_first";
const STICKY_BALANCE: &str = "balance";
const STICKY_PERFORMANCE_FIRST: &str = "performance_first";
const SESSION_BINDING_TTL_MS: u64 = 86_400_000;
const OAUTH_RATE_LIMIT_RETRY_AFTER_MAX_SEC: u64 = 3_600;
const OAUTH_RATE_LIMIT_RESET_MAX_WINDOW_MS: u64 = 86_400_000;
const OAUTH_RATE_LIMIT_FALLBACK_BASE_SEC: u64 = 30;
const OAUTH_RATE_LIMIT_FALLBACK_MAX_SEC: u64 = 900;
const OAUTH_RATE_LIMIT_FALLBACK_FAILURE_CAP: i32 = 6;
const OAUTH_ACCOUNT_SOURCE_METADATA_KEY: &str = "source";
const LOCAL_CODEX_CLI_ACCOUNT_SOURCE: &str = "local_codex_cli_auth";
const LOCAL_CODEX_CLI_MANAGED_METADATA_KEY: &str = "localCliManaged";
const LOCAL_CODEX_CLI_CREDENTIAL_AVAILABLE_METADATA_KEY: &str = "credentialAvailable";
pub const OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES: &[&str] = &[
    "apiKey",
    "api_key",
    "token",
    "accessToken",
    "access_token",
    "openaiApiKey",
    "anthropicApiKey",
    "geminiApiKey",
];
pub const OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES: &[&str] = &[
    "refreshToken",
    "refresh_token",
    "oauthRefreshToken",
    "oauth_refresh_token",
];
pub const OAUTH_ACCOUNT_COMPAT_BASE_URL_METADATA_CANDIDATES: &[&str] = &[
    "compatBaseUrl",
    "compat_base_url",
    "baseUrl",
    "base_url",
    "proxyBaseUrl",
    "proxy_base_url",
];
pub const OAUTH_ACCOUNT_ROUTE_CONFIG_METADATA_CANDIDATES: &[&str] =
    &["routeConfig", "route_config"];
pub const OAUTH_ACCOUNT_ROUTING_STATE_METADATA_CANDIDATES: &[&str] =
    &["routingState", "routing_state"];
pub const OAUTH_ACCOUNT_ROUTING_CREDENTIAL_READY_METADATA_CANDIDATES: &[&str] =
    &["credentialReady", "credential_ready"];
pub const OAUTH_ACCOUNT_ROUTING_LAST_ERROR_METADATA_CANDIDATES: &[&str] =
    &["lastRoutingError", "last_routing_error"];
pub const OAUTH_ACCOUNT_ROUTING_RATE_LIMITED_UNTIL_METADATA_CANDIDATES: &[&str] =
    &["rateLimitedUntil", "rate_limited_until"];
pub const OAUTH_ACCOUNT_ROUTING_OVERLOADED_UNTIL_METADATA_CANDIDATES: &[&str] =
    &["overloadedUntil", "overloaded_until"];
pub const OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_UNTIL_METADATA_CANDIDATES: &[&str] =
    &["tempUnschedulableUntil", "temp_unschedulable_until"];
pub const OAUTH_ACCOUNT_ROUTING_TEMP_UNSCHEDULABLE_REASON_METADATA_CANDIDATES: &[&str] =
    &["tempUnschedulableReason", "temp_unschedulable_reason"];
pub const OAUTH_ACCOUNT_CHATGPT_WORKSPACES_METADATA_CANDIDATES: &[&str] = &[
    "chatgptWorkspaces",
    "chatgpt_workspaces",
    "chatgptOrganizations",
    "chatgpt_organizations",
    "organizations",
];
pub const OAUTH_ACCOUNT_DEFAULT_CHATGPT_WORKSPACE_ID_METADATA_CANDIDATES: &[&str] = &[
    "defaultChatgptWorkspaceId",
    "default_chatgpt_workspace_id",
    "defaultChatgptOrganizationId",
    "default_chatgpt_organization_id",
    "chatgptWorkspaceId",
    "chatgpt_workspace_id",
    "organizationId",
    "organization_id",
    "workspaceId",
    "workspace_id",
];
pub const OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY: &str = "apiKeyEncryptedV1";
pub const OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY: &str = "refreshTokenEncryptedV1";
const OAUTH_SECRET_KEY_LEN_BYTES: usize = 32;
const OAUTH_SECRET_NONCE_LEN_BYTES: usize = 12;

type OAuthResult<T> = Result<T, String>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OAuthPoolMutationErrorCode {
    InvalidInput,
    Internal,
}

include!("oauth_pool_types.rs");
include!("oauth_pool_store.rs");
include!("oauth_pool_db.rs");

#[cfg(test)]
mod oauth_pool_tests {
    include!("oauth_pool_tests_body.inc");
}
