#[derive(Debug, Clone)]
pub struct CachedLiveSkillNetworkResult {
    pub result: LiveSkillNetworkResult,
    pub fetched_at: Instant,
}

pub type LiveSkillNetworkCache = Arc<RwLock<HashMap<String, CachedLiveSkillNetworkResult>>>;
pub(crate) type LiveSkillCoreJsReplSessionStore =
    Arc<RwLock<HashMap<String, Arc<AsyncMutex<CoreJsReplSession>>>>>;

pub(crate) struct CoreJsReplSession {
    session_id: String,
    workspace_path: PathBuf,
    tmp_dir: PathBuf,
    process: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    stderr_buffer: Arc<std::sync::Mutex<Vec<u8>>>,
    stderr_task: tokio::task::JoinHandle<()>,
    created_at_ms: u64,
    last_used_at_ms: u64,
    next_request_id: u64,
}

#[derive(Clone, Default)]
pub struct LiveSkillExecutionCounters {
    sandbox_exec_total: Arc<AtomicU64>,
    sandbox_exec_fail_total: Arc<AtomicU64>,
}

impl LiveSkillExecutionCounters {
    pub fn record_sandbox_exec_attempt(&self) {
        self.sandbox_exec_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_sandbox_exec_failure(&self) {
        self.sandbox_exec_fail_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn sandbox_exec_total(&self) -> u64 {
        self.sandbox_exec_total.load(Ordering::Relaxed)
    }

    pub fn sandbox_exec_fail_total(&self) -> u64 {
        self.sandbox_exec_fail_total.load(Ordering::Relaxed)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSkillSummaryEntry {
    id: String,
    name: String,
    description: String,
    kind: String,
    source: String,
    version: String,
    enabled: bool,
    supports_network: bool,
    tags: Vec<String>,
    aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSkillExecutionResultItem {
    title: String,
    url: String,
    snippet: String,
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    domain: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    dedupe_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fetched_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSkillNetworkResult {
    query: String,
    provider: String,
    fetched_at: u64,
    items: Vec<LiveSkillExecutionResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
enum RuntimeArtifact {
    #[serde(rename = "image")]
    Image {
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        #[serde(rename = "mimeType")]
        mime_type: String,
        #[serde(rename = "dataBase64")]
        data_base64: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    #[serde(rename = "resource")]
    Resource {
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        uri: String,
        #[serde(rename = "mimeType", skip_serializing_if = "Option::is_none")]
        mime_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        description: Option<String>,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveSkillExecutionResult {
    run_id: String,
    skill_id: String,
    status: String,
    message: String,
    output: String,
    network: Option<LiveSkillNetworkResult>,
    artifacts: Vec<RuntimeArtifact>,
    metadata: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveSkillExecuteParams {
    #[serde(alias = "skill_id")]
    skill_id: String,
    #[serde(default)]
    input: String,
    #[serde(default)]
    options: Option<LiveSkillExecuteOptions>,
    #[serde(default)]
    context: Option<LiveSkillExecuteContext>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveSkillExecuteContext {
    #[serde(default, alias = "access_mode")]
    access_mode: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default, alias = "model_id")]
    model_id: Option<String>,
    #[serde(default, alias = "request_id")]
    request_id: Option<String>,
    #[serde(default, alias = "trace_id")]
    trace_id: Option<String>,
    #[serde(default, alias = "span_id")]
    span_id: Option<String>,
    #[serde(default, alias = "parent_span_id")]
    parent_span_id: Option<String>,
    #[serde(default, alias = "planner_step_key")]
    planner_step_key: Option<String>,
    #[serde(default, alias = "batch_id")]
    batch_id: Option<String>,
    #[serde(default)]
    attempt: Option<u32>,
    #[serde(flatten)]
    _extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveSkillExecuteOptions {
    #[serde(default)]
    query: Option<String>,
    #[serde(default)]
    pattern: Option<String>,
    #[serde(default, alias = "match_mode")]
    match_mode: Option<String>,
    #[serde(default, alias = "case_sensitive")]
    case_sensitive: Option<bool>,
    #[serde(default, alias = "whole_word")]
    whole_word: Option<bool>,
    #[serde(default, alias = "include_globs")]
    include_globs: Option<Vec<String>>,
    #[serde(default, alias = "exclude_globs")]
    exclude_globs: Option<Vec<String>>,
    #[serde(default, alias = "context_before")]
    context_before: Option<u64>,
    #[serde(default, alias = "context_after")]
    context_after: Option<u64>,
    #[serde(default, alias = "max_results")]
    max_results: Option<u64>,
    #[serde(default, alias = "max_chars_per_result")]
    max_chars_per_result: Option<u64>,
    #[serde(default, alias = "timeout_ms")]
    timeout_ms: Option<u64>,
    #[serde(default, alias = "allow_network")]
    allow_network: Option<bool>,
    #[serde(default, alias = "sub_queries")]
    sub_queries: Option<Vec<String>>,
    #[serde(default, alias = "max_sub_queries")]
    max_sub_queries: Option<u64>,
    #[serde(default, alias = "max_parallel")]
    max_parallel: Option<u64>,
    #[serde(default, alias = "prefer_domains")]
    prefer_domains: Option<Vec<String>>,
    #[serde(default, alias = "recency_days")]
    recency_days: Option<u64>,
    #[serde(default, alias = "fetch_page_content")]
    fetch_page_content: Option<bool>,
    #[serde(default, alias = "workspace_context_paths")]
    workspace_context_paths: Option<Vec<String>>,
    #[serde(default, alias = "workspace_id")]
    workspace_id: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    paths: Option<Vec<String>>,
    #[serde(default, alias = "max_depth")]
    max_depth: Option<u64>,
    #[serde(default, alias = "include_hidden")]
    include_hidden: Option<bool>,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    find: Option<String>,
    #[serde(default)]
    replace: Option<String>,
    #[serde(default)]
    command: Option<String>,
    #[serde(default)]
    severities: Option<Vec<String>>,
    #[serde(default, alias = "max_items")]
    max_items: Option<u64>,
    #[serde(default, alias = "include_provider_details")]
    include_provider_details: Option<bool>,
}
