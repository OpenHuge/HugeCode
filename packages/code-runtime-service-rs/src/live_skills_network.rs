fn validate_core_shell_command(command: &str) -> Result<(), String> {
    let command_len = command.chars().count();
    if command_len > MAX_CORE_SHELL_COMMAND_CHARS {
        return Err(format!(
            "command must be <= {MAX_CORE_SHELL_COMMAND_CHARS} characters."
        ));
    }
    Ok(())
}

fn live_skill_network_cache_ttl(config: &ServiceConfig) -> Option<Duration> {
    if config.live_skills_network_cache_ttl_ms == 0 {
        None
    } else {
        Some(Duration::from_millis(
            config.live_skills_network_cache_ttl_ms.max(1),
        ))
    }
}

static LIVE_SKILL_NETWORK_INFLIGHT_FETCHES: LazyLock<Mutex<HashMap<String, Arc<Notify>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn lock_live_skill_network_inflight_fetches(
) -> std::sync::MutexGuard<'static, HashMap<String, Arc<Notify>>> {
    match LIVE_SKILL_NETWORK_INFLIGHT_FETCHES.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::warn!("recovered poisoned live-skill inflight fetch lock");
            poisoned.into_inner()
        }
    }
}

fn claim_live_skill_network_fetch(key: &str) -> (Arc<Notify>, bool) {
    let mut guard = lock_live_skill_network_inflight_fetches();
    if let Some(waiter) = guard.get(key) {
        return (waiter.clone(), false);
    }
    let waiter = Arc::new(Notify::new());
    guard.insert(key.to_string(), waiter.clone());
    (waiter, true)
}

fn release_live_skill_network_fetch(key: &str, waiter: &Arc<Notify>) {
    let mut guard = lock_live_skill_network_inflight_fetches();
    if guard
        .get(key)
        .is_some_and(|active_waiter| Arc::ptr_eq(active_waiter, waiter))
    {
        guard.remove(key);
        waiter.notify_waiters();
    }
}

async fn wait_for_live_skill_network_cache_refresh(
    cache: &LiveSkillNetworkCache,
    key: &str,
    ttl: Option<Duration>,
    waiter: Arc<Notify>,
    timeout_window: Duration,
) -> Option<LiveSkillNetworkResult> {
    if timeout(timeout_window, waiter.notified()).await.is_err() {
        return None;
    }
    get_cached_network_result(cache, key, ttl).await
}

async fn get_cached_network_result(
    cache: &LiveSkillNetworkCache,
    key: &str,
    ttl: Option<Duration>,
) -> Option<LiveSkillNetworkResult> {
    let ttl = ttl?;
    let guard = cache.read().await;
    let entry = guard.get(key)?;
    if entry.fetched_at.elapsed() > ttl {
        return None;
    }
    Some(entry.result.clone())
}

async fn set_cached_network_result(
    cache: &LiveSkillNetworkCache,
    key: &str,
    result: &LiveSkillNetworkResult,
    ttl: Option<Duration>,
) {
    let Some(ttl) = ttl else {
        return;
    };
    let mut guard = cache.write().await;
    guard.insert(
        key.to_string(),
        CachedLiveSkillNetworkResult {
            result: result.clone(),
            fetched_at: Instant::now(),
        },
    );
    prune_live_skill_network_cache(
        &mut guard,
        ttl,
        MAX_LIVE_SKILL_NETWORK_CACHE_ENTRIES,
        MAX_LIVE_SKILL_NETWORK_CACHE_BYTES,
    );
}

fn prune_live_skill_network_cache(
    cache: &mut HashMap<String, CachedLiveSkillNetworkResult>,
    ttl: Duration,
    max_entries: usize,
    max_bytes: usize,
) {
    cache.retain(|_, entry| entry.fetched_at.elapsed() <= ttl);
    if max_entries == 0 || max_bytes == 0 {
        cache.clear();
        return;
    }

    let mut total_bytes = estimate_live_skill_network_cache_bytes(cache);
    while cache.len() > max_entries || total_bytes > max_bytes {
        let Some(oldest_key) = cache
            .iter()
            .min_by_key(|(_, entry)| entry.fetched_at)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        let removed_bytes = cache
            .get(oldest_key.as_str())
            .map(|entry| estimate_cached_live_skill_network_entry_bytes(oldest_key.as_str(), entry))
            .unwrap_or(0);
        cache.remove(oldest_key.as_str());
        total_bytes = total_bytes.saturating_sub(removed_bytes);
    }
}

fn estimate_live_skill_network_cache_bytes(
    cache: &HashMap<String, CachedLiveSkillNetworkResult>,
) -> usize {
    cache
        .iter()
        .map(|(key, entry)| estimate_cached_live_skill_network_entry_bytes(key.as_str(), entry))
        .fold(0usize, |total, entry_bytes| {
            total.saturating_add(entry_bytes)
        })
}

fn estimate_cached_live_skill_network_entry_bytes(
    key: &str,
    entry: &CachedLiveSkillNetworkResult,
) -> usize {
    let mut total = key.len();
    total = total.saturating_add(entry.result.query.len());
    total = total.saturating_add(entry.result.provider.len());
    for item in &entry.result.items {
        total = total.saturating_add(item.title.len());
        total = total.saturating_add(item.url.len());
        total = total.saturating_add(item.snippet.len());
        if let Some(content) = &item.content {
            total = total.saturating_add(content.len());
        }
    }
    total
}

fn build_network_skill_eval_tags(fetch_page_content: bool, cache_hit: bool) -> Vec<String> {
    let mut tags = vec![
        "mode:runtime".to_string(),
        format!("skill:{BUILTIN_LIVE_NETWORK_SKILL_ID}"),
        "scope:research".to_string(),
        format!("content_fetch:{fetch_page_content}"),
        format!("cache_hit:{cache_hit}"),
    ];
    tags.sort();
    tags
}

fn build_network_compaction_summary() -> Value {
    json!({
        "triggered": false,
        "executed": false,
        "source": Value::Null,
        "compressedSteps": Value::Null,
        "bytesReduced": Value::Null,
        "keepRecentSteps": Value::Null,
        "summaryMaxChars": Value::Null,
        "executionError": Value::Null,
    })
}

fn build_network_skill_checkpoint_state(
    state: &str,
    lifecycle_state: &str,
    run_id: &str,
) -> Value {
    json!({
        "state": state,
        "lifecycleState": lifecycle_state,
        "checkpointId": Value::Null,
        "traceId": format!("live-skill:{run_id}"),
        "recovered": false,
        "updatedAt": now_ms(),
    })
}

#[derive(Debug, Clone)]
struct LiveSkillFetchPageContentPolicy {
    caller_provider: String,
    caller_model_id: Option<String>,
    policy_source: &'static str,
    fetch_page_content: bool,
}

fn trim_live_skill_context_value(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn canonicalize_live_skill_caller_provider(value: Option<&str>) -> Option<String> {
    let normalized = trim_live_skill_context_value(value)?.to_ascii_lowercase();
    if matches!(normalized.as_str(), "openai" | "codex" | "openai-codex") {
        return Some("openai".to_string());
    }
    if matches!(
        normalized.as_str(),
        "anthropic" | "claude" | "claude_code" | "claude-code"
    ) {
        return Some("anthropic".to_string());
    }
    if matches!(
        normalized.as_str(),
        "google" | "gemini" | "antigravity" | "anti-gravity" | "gemini-antigravity"
    ) {
        return Some("google".to_string());
    }
    if normalized == "local" {
        return Some("local".to_string());
    }
    if normalized == "unknown" {
        return Some("unknown".to_string());
    }
    Some("unknown".to_string())
}

fn infer_live_skill_caller_provider_from_model_id(model_id: Option<&str>) -> Option<String> {
    let normalized = trim_live_skill_context_value(model_id)?.to_ascii_lowercase();
    if normalized.starts_with("gpt-")
        || normalized.starts_with("o1")
        || normalized.starts_with("o3")
        || normalized.starts_with("o4")
        || normalized.contains("codex")
    {
        return Some("openai".to_string());
    }
    if normalized.contains("claude") {
        return Some("anthropic".to_string());
    }
    if normalized.contains("gemini") {
        return Some("google".to_string());
    }
    if normalized.contains("local") {
        return Some("local".to_string());
    }
    Some("unknown".to_string())
}

fn resolve_live_skill_fetch_page_content_policy(
    context: Option<&LiveSkillExecuteContext>,
    explicit_fetch_page_content: Option<bool>,
    runtime_default_fetch_page_content: bool,
) -> LiveSkillFetchPageContentPolicy {
    let caller_model_id =
        context.and_then(|context| trim_live_skill_context_value(context.model_id.as_deref()));
    let has_caller_context = context.is_some_and(|context| {
        context
            .provider
            .as_deref()
            .map(str::trim)
            .is_some_and(|value| !value.is_empty())
            || context
                .model_id
                .as_deref()
                .map(str::trim)
                .is_some_and(|value| !value.is_empty())
    });
    let caller_provider = context
        .and_then(|context| canonicalize_live_skill_caller_provider(context.provider.as_deref()))
        .or_else(|| infer_live_skill_caller_provider_from_model_id(caller_model_id.as_deref()))
        .unwrap_or_else(|| "unknown".to_string());

    if let Some(fetch_page_content) = explicit_fetch_page_content {
        return LiveSkillFetchPageContentPolicy {
            caller_provider,
            caller_model_id,
            policy_source: "explicit_request",
            fetch_page_content,
        };
    }

    if has_caller_context {
        return LiveSkillFetchPageContentPolicy {
            fetch_page_content: matches!(caller_provider.as_str(), "openai" | "google"),
            caller_provider,
            caller_model_id,
            policy_source: "caller_context",
        };
    }

    LiveSkillFetchPageContentPolicy {
        caller_provider,
        caller_model_id,
        policy_source: "runtime_default",
        fetch_page_content: runtime_default_fetch_page_content,
    }
}

fn build_live_skill_fetch_reason_codes(
    strategy: &str,
    fetch_policy: &LiveSkillFetchPageContentPolicy,
) -> Vec<String> {
    let mut reason_codes = vec![if strategy == "search+content" {
        "research-search-content".to_string()
    } else {
        "research-search-only".to_string()
    }];
    if fetch_policy.policy_source == "caller_context" {
        reason_codes.push("caller-provider-defaulted-fetch-page-content".to_string());
    }
    reason_codes
}

async fn execute_live_skill_network_analysis(
    client: &reqwest::Client,
    config: &ServiceConfig,
    cache: &LiveSkillNetworkCache,
    canonical_skill_id: &str,
    query: &str,
    options: &LiveSkillExecuteOptions,
    context: Option<&LiveSkillExecuteContext>,
) -> Result<LiveSkillExecutionResult, RpcError> {
    let normalized_query = query.trim().to_string();
    if normalized_query.is_empty() {
        return Err(RpcError::invalid_params(
            "Live skill query must not be empty.",
        ));
    }
    validate_live_skill_query(normalized_query.as_str())?;

    let allow_network = options.allow_network.unwrap_or(true);
    let max_results = normalize_optional_usize(
        options.max_results,
        DEFAULT_LIVE_SKILL_MAX_RESULTS,
        1,
        MAX_LIVE_SKILL_MAX_RESULTS,
    );
    let max_chars_per_result = normalize_optional_usize(
        options.max_chars_per_result,
        DEFAULT_LIVE_SKILL_MAX_CHARS_PER_RESULT,
        120,
        MAX_LIVE_SKILL_MAX_CHARS_PER_RESULT,
    );
    let timeout_ms = normalize_optional_u64(
        options.timeout_ms,
        config.live_skills_network_timeout_ms,
        500,
        120_000,
    );
    let fetch_policy =
        resolve_live_skill_fetch_page_content_policy(context, options.fetch_page_content, false);
    let fetch_page_content = fetch_policy.fetch_page_content;
    let page_content_fetch_limit = if fetch_page_content {
        max_results
            .min(DEFAULT_RESEARCH_FETCH_CONTENT_LIMIT)
            .min(MAX_RESEARCH_FETCH_CONTENT_LIMIT)
    } else {
        0
    };
    let cache_ttl = live_skill_network_cache_ttl(config);
    let strategy = if fetch_page_content {
        "search+content"
    } else {
        "search-only"
    };

    if !allow_network || !config.live_skills_network_enabled {
        let run_id = new_id("live-skill-run");
        return Ok(LiveSkillExecutionResult {
            run_id: run_id.clone(),
            skill_id: canonical_skill_id.to_string(),
            status: "blocked".to_string(),
            message: "Network analysis is disabled by runtime policy.".to_string(),
            output: String::new(),
            network: None,
            artifacts: vec![],
            metadata: json!({
                "profileUsed": "research",
                "approvalEvents": [],
                "checkpointState": build_network_skill_checkpoint_state("failed", "blocked", run_id.as_str()),
                "compactionSummary": build_network_compaction_summary(),
                "evalTags": build_network_skill_eval_tags(fetch_page_content, false),
                "networkEnabled": config.live_skills_network_enabled,
                "allowNetwork": allow_network,
                "cacheEnabled": cache_ttl.is_some(),
                "cacheHit": false,
                "providerDiagnostics": {
                    "strategy": strategy,
                    "provider": infer_live_skill_network_provider(config.live_skills_network_base_url.as_str()),
                    "callerProvider": fetch_policy.caller_provider,
                    "callerModelId": fetch_policy.caller_model_id,
                    "policySource": fetch_policy.policy_source,
                    "reasonCodes": build_live_skill_fetch_reason_codes(strategy, &fetch_policy),
                    "contentFetchEnabled": fetch_page_content,
                    "contentFetchCount": 0,
                },
            }),
        });
    }

    let cache_key = build_live_skill_network_cache_key(
        config.live_skills_network_base_url.as_str(),
        normalized_query.as_str(),
        max_results,
        max_chars_per_result,
        fetch_page_content,
        page_content_fetch_limit,
    );
    if let Some(cached) = get_cached_network_result(cache, cache_key.as_str(), cache_ttl).await {
        let output = format_live_skill_network_output(normalized_query.as_str(), &cached.items);
        let run_id = new_id("live-skill-run");
        return Ok(LiveSkillExecutionResult {
            run_id: run_id.clone(),
            skill_id: canonical_skill_id.to_string(),
            status: "completed".to_string(),
            message: format!(
                "Live skill completed with {} result(s).",
                cached.items.len()
            ),
            output,
            network: Some(cached.clone()),
            artifacts: vec![],
            metadata: json!({
                "profileUsed": "research",
                "approvalEvents": [],
                "checkpointState": build_network_skill_checkpoint_state("completed", "cache_hit", run_id.as_str()),
                "compactionSummary": build_network_compaction_summary(),
                "evalTags": build_network_skill_eval_tags(fetch_page_content, true),
                "networkEnabled": true,
                "maxResults": max_results,
                "maxCharsPerResult": max_chars_per_result,
                "timeoutMs": timeout_ms,
                "cacheEnabled": cache_ttl.is_some(),
                "cacheHit": true,
                "providerDiagnostics": build_live_skill_provider_diagnostics(
                    cached.provider.as_str(),
                    strategy,
                    &fetch_policy,
                    fetch_page_content,
                    &cached.items,
                ),
            }),
        });
    }

    let (inflight_waiter, owns_fetch) = claim_live_skill_network_fetch(cache_key.as_str());
    if !owns_fetch {
        let wait_window = Duration::from_millis(timeout_ms.max(1_000));
        if let Some(cached) = wait_for_live_skill_network_cache_refresh(
            cache,
            cache_key.as_str(),
            cache_ttl,
            inflight_waiter.clone(),
            wait_window,
        )
        .await
        {
            let output = format_live_skill_network_output(normalized_query.as_str(), &cached.items);
            let run_id = new_id("live-skill-run");
            return Ok(LiveSkillExecutionResult {
                run_id: run_id.clone(),
                skill_id: canonical_skill_id.to_string(),
                status: "completed".to_string(),
                message: format!(
                    "Live skill completed with {} result(s).",
                    cached.items.len()
                ),
                output,
                network: Some(cached.clone()),
                artifacts: vec![],
                metadata: json!({
                    "profileUsed": "research",
                    "approvalEvents": [],
                    "checkpointState": build_network_skill_checkpoint_state("completed", "cache_wait_hit", run_id.as_str()),
                    "compactionSummary": build_network_compaction_summary(),
                    "evalTags": build_network_skill_eval_tags(fetch_page_content, true),
                    "networkEnabled": true,
                    "maxResults": max_results,
                    "maxCharsPerResult": max_chars_per_result,
                    "timeoutMs": timeout_ms,
                    "cacheEnabled": cache_ttl.is_some(),
                    "cacheHit": true,
                    "cacheWaited": true,
                    "providerDiagnostics": build_live_skill_provider_diagnostics(
                        cached.provider.as_str(),
                        strategy,
                        &fetch_policy,
                        fetch_page_content,
                        &cached.items,
                    ),
                }),
            });
        }
    }

    let fetched = fetch_live_skill_network_results(
        client,
        config,
        normalized_query.as_str(),
        max_results,
        max_chars_per_result,
        timeout_ms,
        fetch_page_content,
        page_content_fetch_limit,
    )
    .await;
    if let Ok(network) = &fetched {
        set_cached_network_result(cache, cache_key.as_str(), network, cache_ttl).await;
    }
    if owns_fetch {
        release_live_skill_network_fetch(cache_key.as_str(), &inflight_waiter);
    }

    Ok(match fetched {
        Ok(network) => {
            let output =
                format_live_skill_network_output(normalized_query.as_str(), &network.items);
            let run_id = new_id("live-skill-run");
            LiveSkillExecutionResult {
                run_id: run_id.clone(),
                skill_id: canonical_skill_id.to_string(),
                status: "completed".to_string(),
                message: format!(
                    "Live skill completed with {} result(s).",
                    network.items.len()
                ),
                output,
                network: Some(network.clone()),
                artifacts: vec![],
                metadata: json!({
                    "profileUsed": "research",
                    "approvalEvents": [],
                    "checkpointState": build_network_skill_checkpoint_state("completed", "completed", run_id.as_str()),
                    "compactionSummary": build_network_compaction_summary(),
                    "evalTags": build_network_skill_eval_tags(fetch_page_content, false),
                    "networkEnabled": true,
                    "maxResults": max_results,
                    "maxCharsPerResult": max_chars_per_result,
                    "timeoutMs": timeout_ms,
                    "cacheEnabled": cache_ttl.is_some(),
                    "cacheHit": false,
                    "providerDiagnostics": build_live_skill_provider_diagnostics(
                        network.provider.as_str(),
                        strategy,
                        &fetch_policy,
                        fetch_page_content,
                        &network.items,
                    ),
                }),
            }
        }
        Err(error) => {
            let run_id = new_id("live-skill-run");
            LiveSkillExecutionResult {
                run_id: run_id.clone(),
                skill_id: canonical_skill_id.to_string(),
                status: "failed".to_string(),
                message: error,
                output: String::new(),
                network: None,
                artifacts: vec![],
                metadata: json!({
                    "profileUsed": "research",
                    "approvalEvents": [],
                    "checkpointState": build_network_skill_checkpoint_state("failed", "failed", run_id.as_str()),
                    "compactionSummary": build_network_compaction_summary(),
                    "evalTags": build_network_skill_eval_tags(fetch_page_content, false),
                    "networkEnabled": true,
                    "maxResults": max_results,
                    "maxCharsPerResult": max_chars_per_result,
                    "timeoutMs": timeout_ms,
                    "cacheEnabled": cache_ttl.is_some(),
                    "cacheHit": false,
                    "providerDiagnostics": {
                        "strategy": strategy,
                        "provider": infer_live_skill_network_provider(config.live_skills_network_base_url.as_str()),
                        "callerProvider": fetch_policy.caller_provider,
                        "callerModelId": fetch_policy.caller_model_id,
                        "policySource": fetch_policy.policy_source,
                        "reasonCodes": build_live_skill_fetch_reason_codes(strategy, &fetch_policy),
                        "contentFetchEnabled": fetch_page_content,
                        "contentFetchCount": 0,
                    },
                }),
            }
        },
    })
}

async fn fetch_live_skill_network_results(
    client: &reqwest::Client,
    config: &ServiceConfig,
    query: &str,
    max_results: usize,
    max_chars_per_result: usize,
    timeout_ms: u64,
    fetch_page_content: bool,
    page_content_fetch_limit: usize,
) -> Result<LiveSkillNetworkResult, String> {
    let endpoint =
        build_live_skill_network_endpoint(config.live_skills_network_base_url.as_str(), query)?;
    let response = client
        .get(endpoint.as_str())
        .timeout(Duration::from_millis(timeout_ms))
        .send()
        .await
        .map_err(|error| format!("Live-skill network request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Live-skill network request failed with HTTP {}.",
            response.status()
        ));
    }

    let body = read_live_skill_network_response_body(response, MAX_LIVE_SKILL_RESPONSE_BYTES)
        .await
        .map_err(|error| format!("Live-skill network response read failed: {error}"))?;
    let normalized_body = truncate_with_ellipsis(body.trim(), MAX_LIVE_SKILL_RESPONSE_CHARS);
    let items = parse_live_skill_network_items(
        normalized_body.as_str(),
        max_results,
        max_chars_per_result,
    );
    let items = if fetch_page_content && page_content_fetch_limit > 0 {
        enrich_live_skill_network_items_with_content(
            client,
            config,
            items,
            max_chars_per_result,
            timeout_ms,
            page_content_fetch_limit,
        )
        .await
    } else {
        items
    };

    Ok(LiveSkillNetworkResult {
        query: query.to_string(),
        provider: infer_live_skill_network_provider(config.live_skills_network_base_url.as_str()),
        fetched_at: now_ms(),
        items,
    })
}

async fn enrich_live_skill_network_items_with_content(
    client: &reqwest::Client,
    config: &ServiceConfig,
    mut items: Vec<LiveSkillExecutionResultItem>,
    max_chars_per_result: usize,
    timeout_ms: u64,
    fetch_limit: usize,
) -> Vec<LiveSkillExecutionResultItem> {
    for item in items.iter_mut().take(fetch_limit) {
        let Some(content) = fetch_live_skill_network_page_content(
            client,
            config,
            item.url.as_str(),
            max_chars_per_result,
            timeout_ms,
        )
        .await
        else {
            continue;
        };
        if !content.is_empty() {
            item.content = Some(content.clone());
            if item.published_at.is_none() {
                item.published_at = infer_published_at(content.as_str());
            }
        }
    }
    items
}

async fn fetch_live_skill_network_page_content(
    client: &reqwest::Client,
    config: &ServiceConfig,
    url: &str,
    max_chars: usize,
    timeout_ms: u64,
) -> Option<String> {
    if url.trim().is_empty() {
        return None;
    }
    let endpoint =
        build_live_skill_network_endpoint(config.live_skills_network_base_url.as_str(), url).ok()?;
    let response = client
        .get(endpoint.as_str())
        .timeout(Duration::from_millis(timeout_ms))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let body = read_live_skill_network_response_body(response, MAX_LIVE_SKILL_RESPONSE_BYTES)
        .await
        .ok()?;
    let normalized = truncate_with_ellipsis(body.trim(), max_chars);
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn build_live_skill_provider_diagnostics(
    provider: &str,
    strategy: &str,
    fetch_policy: &LiveSkillFetchPageContentPolicy,
    fetch_page_content: bool,
    items: &[LiveSkillExecutionResultItem],
) -> Value {
    let content_fetch_count = items.iter().filter(|item| item.content.is_some()).count();
    json!({
        "provider": provider,
        "strategy": strategy,
        "callerProvider": fetch_policy.caller_provider,
        "callerModelId": fetch_policy.caller_model_id,
        "policySource": fetch_policy.policy_source,
        "reasonCodes": build_live_skill_fetch_reason_codes(strategy, fetch_policy),
        "contentFetchEnabled": fetch_page_content,
        "contentFetchCount": content_fetch_count,
    })
}

async fn read_live_skill_network_response_body(
    mut response: reqwest::Response,
    max_bytes: usize,
) -> Result<String, reqwest::Error> {
    let mut buffer = Vec::with_capacity(max_bytes.min(8 * 1024));
    let mut truncated = false;

    while let Some(chunk) = response.chunk().await? {
        if append_bytes_with_limit(&mut buffer, chunk.as_ref(), max_bytes) {
            truncated = true;
            break;
        }
    }

    let mut body = String::from_utf8_lossy(buffer.as_slice()).into_owned();
    if truncated {
        body.push('…');
    }
    Ok(body)
}

fn append_bytes_with_limit(buffer: &mut Vec<u8>, chunk: &[u8], max_bytes: usize) -> bool {
    if chunk.is_empty() {
        return false;
    }
    let remaining = max_bytes.saturating_sub(buffer.len());
    if remaining == 0 {
        return true;
    }
    if chunk.len() <= remaining {
        buffer.extend_from_slice(chunk);
        return false;
    }
    buffer.extend_from_slice(&chunk[..remaining]);
    true
}

fn format_live_skill_network_output(query: &str, items: &[LiveSkillExecutionResultItem]) -> String {
    if items.is_empty() {
        return format!("Network analysis for \"{query}\" returned no results.");
    }

    let mut lines = Vec::with_capacity(items.len() + 1);
    lines.push(format!(
        "Network analysis for \"{query}\" returned {} result(s):",
        items.len()
    ));
    for (index, item) in items.iter().enumerate() {
        let title = if item.title.trim().is_empty() {
            "Untitled"
        } else {
            item.title.trim()
        };
        let url = if item.url.trim().is_empty() {
            "n/a"
        } else {
            item.url.trim()
        };
        let snippet = if item.snippet.trim().is_empty() {
            "No snippet."
        } else {
            item.snippet.trim()
        };
        lines.push(format!("{}. {} ({}) - {}", index + 1, title, url, snippet));
    }
    lines.join("\n")
}

fn parse_live_skill_network_items(
    raw: &str,
    max_results: usize,
    max_chars_per_result: usize,
) -> Vec<LiveSkillExecutionResultItem> {
    let mut seen_dedupe_keys = HashSet::new();
    let mut items = Vec::new();
    let fetched_at = now_ms();

    for line in raw.lines() {
        if items.len() >= max_results {
            break;
        }
        let Some((title, url, snippet)) = parse_markdown_link_line(line) else {
            continue;
        };
        let normalized_url = url.trim().to_string();
        if normalized_url.is_empty() {
            continue;
        }
        let dedupe_key =
            build_live_skill_dedupe_key(normalized_url.as_str()).unwrap_or(normalized_url.clone());
        if !seen_dedupe_keys.insert(dedupe_key.clone()) {
            continue;
        }
        let domain = extract_live_skill_domain(normalized_url.as_str());
        let published_at = infer_published_at(snippet.as_str());
        items.push(LiveSkillExecutionResultItem {
            title: truncate_with_ellipsis(title.trim(), 256),
            url: normalized_url,
            snippet: truncate_with_ellipsis(snippet.trim(), max_chars_per_result),
            content: None,
            domain,
            dedupe_key: Some(dedupe_key),
            fetched_at: Some(fetched_at),
            published_at,
        });
    }

    if !items.is_empty() {
        return items;
    }

    let fallback = truncate_with_ellipsis(raw.trim(), max_chars_per_result);
    vec![LiveSkillExecutionResultItem {
        title: "Search Summary".to_string(),
        url: String::new(),
        snippet: if fallback.is_empty() {
            "No network content returned.".to_string()
        } else {
            fallback.clone()
        },
        content: if fallback.is_empty() {
            None
        } else {
            Some(fallback)
        },
        domain: None,
        dedupe_key: None,
        fetched_at: Some(fetched_at),
        published_at: infer_published_at(raw),
    }]
}

fn extract_live_skill_domain(url: &str) -> Option<String> {
    reqwest::Url::parse(url.trim())
        .ok()
        .and_then(|parsed| parsed.host_str().map(str::to_string))
}

fn build_live_skill_dedupe_key(url: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(url.trim()).ok()?;
    let host = parsed.host_str()?.trim().to_ascii_lowercase();
    let path = parsed.path().trim_end_matches('/');
    if path.is_empty() || path == "/" {
        Some(host)
    } else {
        Some(format!("{host}{path}"))
    }
}

fn infer_published_at(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    if bytes.len() < 10 {
        return None;
    }
    for index in 0..=bytes.len().saturating_sub(10) {
        let Ok(candidate) = std::str::from_utf8(&bytes[index..index + 10]) else {
            continue;
        };
        if is_iso_date(candidate) {
            return Some(candidate.to_string());
        }
    }
    None
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[0..4].iter().all(|byte| byte.is_ascii_digit())
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(|byte| byte.is_ascii_digit())
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(|byte| byte.is_ascii_digit())
}

fn parse_markdown_link_line(line: &str) -> Option<(String, String, String)> {
    let normalized = line.trim();
    if normalized.is_empty() {
        return None;
    }

    let left_bracket = normalized.find('[')?;
    let right_bracket = normalized[left_bracket + 1..].find(']')? + left_bracket + 1;
    let left_paren = normalized[right_bracket..].find('(')? + right_bracket;
    let right_paren = normalized[left_paren + 1..].find(')')? + left_paren + 1;
    let title = normalized[left_bracket + 1..right_bracket].trim();
    let url = normalized[left_paren + 1..right_paren].trim();
    if title.is_empty() || url.is_empty() {
        return None;
    }

    let tail = normalized[right_paren + 1..]
        .trim_start_matches(|ch: char| ch == '-' || ch == ':' || ch.is_whitespace())
        .trim();
    let snippet = if tail.is_empty() { title } else { tail };
    Some((title.to_string(), url.to_string(), snippet.to_string()))
}

fn validate_live_skill_query(query: &str) -> Result<(), RpcError> {
    let query_len = query.chars().count();
    if query_len > MAX_LIVE_SKILL_QUERY_CHARS {
        return Err(RpcError::invalid_params(format!(
            "Live skill query must be <= {MAX_LIVE_SKILL_QUERY_CHARS} characters."
        )));
    }
    Ok(())
}

fn resolve_core_shell_command<'a>(
    input: &'a str,
    options: &'a LiveSkillExecuteOptions,
) -> Option<&'a str> {
    if let Some(command) = options.command.as_deref() {
        if !command.trim().is_empty() {
            return Some(command);
        }
    }
    let fallback = input.trim();
    if fallback.is_empty() {
        None
    } else {
        Some(fallback)
    }
}

fn build_live_skill_network_cache_key(
    base_url: &str,
    query: &str,
    max_results: usize,
    max_chars_per_result: usize,
    fetch_page_content: bool,
    page_content_fetch_limit: usize,
) -> String {
    let normalized_base = base_url.trim();
    let mut hasher = DefaultHasher::new();
    LIVE_SKILL_NETWORK_CACHE_KEY_VERSION.hash(&mut hasher);
    normalized_base.hash(&mut hasher);
    query.hash(&mut hasher);
    max_results.hash(&mut hasher);
    max_chars_per_result.hash(&mut hasher);
    fetch_page_content.hash(&mut hasher);
    page_content_fetch_limit.hash(&mut hasher);
    let query_fingerprint = hasher.finish();
    format!(
        "{LIVE_SKILL_NETWORK_CACHE_KEY_VERSION}|{normalized_base}|q:{query_fingerprint:016x}|len:{}|{max_results}|{max_chars_per_result}|content:{}|limit:{page_content_fetch_limit}",
        query.chars().count(),
        if fetch_page_content { 1 } else { 0 }
    )
}

fn infer_live_skill_network_provider(base_url: &str) -> String {
    reqwest::Url::parse(base_url.trim())
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| "network".to_string())
}

fn build_live_skill_network_endpoint(base_url: &str, query: &str) -> Result<String, String> {
    let normalized_base = base_url.trim().trim_end_matches('/');
    if normalized_base.is_empty() {
        return Err("Live-skill network base URL is empty.".to_string());
    }
    reqwest::Url::parse(normalized_base)
        .map_err(|error| format!("Invalid live-skill network base URL: {error}"))?;

    let encoded_query = percent_encode_path_segment(query);
    Ok(format!("{normalized_base}/{encoded_query}"))
}

fn percent_encode_path_segment(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(char::from(byte));
        } else {
            encoded.push('%');
            encoded.push(to_hex_char((byte >> 4) & 0x0F));
            encoded.push(to_hex_char(byte & 0x0F));
        }
    }
    encoded
}

fn to_hex_char(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        10..=15 => (b'A' + (value - 10)) as char,
        _ => '0',
    }
}

fn truncate_with_ellipsis(value: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }
    let mut output = String::with_capacity(max_chars.min(value.len()));
    let mut count = 0usize;
    for ch in value.chars() {
        if count >= max_chars {
            break;
        }
        output.push(ch);
        count += 1;
    }
    if value.chars().count() > max_chars && max_chars > 1 {
        let mut trimmed = output.chars().take(max_chars - 1).collect::<String>();
        trimmed.push('…');
        return trimmed;
    }
    output
}

fn normalize_optional_usize(value: Option<u64>, default: usize, min: usize, max: usize) -> usize {
    let normalized = value
        .and_then(|entry| usize::try_from(entry).ok())
        .unwrap_or(default);
    normalized.clamp(min, max)
}

fn normalize_optional_u64(value: Option<u64>, default: u64, min: u64, max: u64) -> u64 {
    value.unwrap_or(default).clamp(min, max)
}
