#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OAuthPoolMutationError {
    code: OAuthPoolMutationErrorCode,
    message: String,
}

impl OAuthPoolMutationError {
    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self {
            code: OAuthPoolMutationErrorCode::InvalidInput,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: OAuthPoolMutationErrorCode::Internal,
            message: message.into(),
        }
    }

    pub fn code(&self) -> OAuthPoolMutationErrorCode {
        self.code
    }

    pub fn message(&self) -> &str {
        self.message.as_str()
    }
}

impl Default for OAuthPoolMutationError {
    fn default() -> Self {
        Self::internal("")
    }
}

impl fmt::Display for OAuthPoolMutationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.message.as_str())
    }
}

impl Error for OAuthPoolMutationError {}

impl From<String> for OAuthPoolMutationError {
    fn from(value: String) -> Self {
        Self::internal(value)
    }
}

impl From<&str> for OAuthPoolMutationError {
    fn from(value: &str) -> Self {
        Self::internal(value.to_string())
    }
}

fn invalid_input_error(message: impl Into<String>) -> OAuthPoolMutationError {
    OAuthPoolMutationError::invalid_input(message)
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthAccountRouteConfig {
    pub compat_base_url: Option<String>,
    pub proxy_id: Option<String>,
    pub priority: Option<i32>,
    pub concurrency_limit: Option<i32>,
    pub schedulable: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthAccountChatgptWorkspace {
    pub workspace_id: String,
    pub title: Option<String>,
    pub role: Option<String>,
    pub is_default: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthAccountRoutingState {
    pub credential_ready: Option<bool>,
    pub last_routing_error: Option<String>,
    pub rate_limited_until: Option<u64>,
    pub overloaded_until: Option<u64>,
    pub temp_unschedulable_until: Option<u64>,
    pub temp_unschedulable_reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthAccountSummary {
    pub account_id: String,
    pub provider: String,
    pub external_account_id: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub status: String,
    pub disabled_reason: Option<String>,
    pub route_config: Option<OAuthAccountRouteConfig>,
    pub routing_state: Option<OAuthAccountRoutingState>,
    pub chatgpt_workspaces: Option<Vec<OAuthAccountChatgptWorkspace>>,
    pub default_chatgpt_workspace_id: Option<String>,
    pub metadata: Value,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthPrimaryAccountSummary {
    pub provider: String,
    pub account_id: Option<String>,
    pub account: Option<OAuthAccountSummary>,
    pub default_pool_id: String,
    pub route_account_id: Option<String>,
    pub in_sync: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthPoolSummary {
    pub pool_id: String,
    pub provider: String,
    pub name: String,
    pub strategy: String,
    pub sticky_mode: String,
    pub preferred_account_id: Option<String>,
    pub enabled: bool,
    pub metadata: Value,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthPoolMember {
    pub pool_id: String,
    pub account_id: String,
    pub weight: i32,
    pub priority: i32,
    pub position: i32,
    pub enabled: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthPoolSelectionResult {
    pub pool_id: String,
    pub account: OAuthAccountSummary,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthPoolApplyResult {
    pub pool: OAuthPoolSummary,
    pub members: Vec<OAuthPoolMember>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OAuthPoolSelectMissReason {
    PoolNotFound,
    PoolDisabled,
    PoolExhausted,
    RateLimited,
    AuthMissing,
    DecryptFailed,
}

impl OAuthPoolSelectMissReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PoolNotFound => "pool_not_found",
            Self::PoolDisabled => "pool_disabled",
            Self::PoolExhausted => "pool_exhausted",
            Self::RateLimited => "rate_limited",
            Self::AuthMissing => "auth_missing",
            Self::DecryptFailed => "decrypt_failed",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthPoolDiagnostics {
    pub accounts_total: u64,
    pub accounts_enabled: u64,
    pub accounts_with_api_key: u64,
    pub pools_total: u64,
    pub pools_enabled: u64,
    pub pool_members_total: u64,
    pub session_bindings_total: u64,
    pub round_robin_cursor_entries: u64,
    pub active_rate_limits_total: u64,
    pub oauth_secret_key_configured: bool,
}

#[derive(Clone, Debug)]
pub struct OAuthAccountUpsertInput {
    pub account_id: String,
    pub provider: String,
    pub external_account_id: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub status: Option<String>,
    pub disabled_reason: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Clone, Debug)]
pub struct OAuthPrimaryAccountSetInput {
    pub provider: String,
    pub account_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct OAuthPoolUpsertInput {
    pub pool_id: String,
    pub provider: String,
    pub name: String,
    pub strategy: Option<String>,
    pub sticky_mode: Option<String>,
    pub preferred_account_id: Option<String>,
    pub enabled: Option<bool>,
    pub metadata: Value,
}

#[derive(Clone, Debug)]
pub struct OAuthPoolMemberInput {
    pub account_id: String,
    pub weight: Option<i32>,
    pub priority: Option<i32>,
    pub position: Option<i32>,
    pub enabled: Option<bool>,
}

#[derive(Clone, Debug)]
pub struct OAuthPoolApplyInput {
    pub pool: OAuthPoolUpsertInput,
    pub members: Vec<OAuthPoolMemberInput>,
    pub expected_updated_at: Option<u64>,
}

#[derive(Clone, Debug)]
pub struct OAuthPoolSelectionInput {
    pub pool_id: String,
    pub session_id: Option<String>,
    pub workspace_id: Option<String>,
    pub model_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct OAuthPoolAccountBindInput {
    pub pool_id: String,
    pub session_id: String,
    pub workspace_id: Option<String>,
    pub account_id: String,
}

#[derive(Clone, Debug)]
pub struct OAuthRateLimitReportInput {
    pub account_id: String,
    pub model_id: Option<String>,
    pub success: bool,
    pub retry_after_sec: Option<u64>,
    pub reset_at: Option<u64>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Clone, Debug)]
struct SelectionCandidate {
    member: OAuthPoolMember,
    account: OAuthAccountSummary,
    failure_penalty: i32,
}
