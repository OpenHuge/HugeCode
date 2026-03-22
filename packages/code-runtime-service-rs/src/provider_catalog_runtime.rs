use super::*;

const OPENAI_COMPAT_MISSING_API_KEY_ERROR: &str =
    "OpenAI-compat base URL is configured but no compatible API key is available.";

struct CompatCatalogResolutionAttempt {
    preferred_provider: Option<RuntimeProvider>,
    base_url_override: Option<String>,
    api_key_override: Option<String>,
}

pub(super) async fn build_models_pool(ctx: &AppContext) -> Vec<Value> {
    let compat_catalog = resolve_compat_catalog_with_recovery(ctx).await;
    let local_codex_cached_models = load_local_codex_cached_model_slugs();
    let mut pool = Vec::new();

    for provider in RuntimeProvider::all() {
        pool.push(json!({
            "id": provider.default_model_id(),
            "displayName": provider_default_model_display_name(provider),
            "provider": provider.routed_provider(),
            "pool": provider.routed_pool(),
            "source": provider_default_model_source(provider),
            "available": provider_is_available(ctx, &compat_catalog, provider),
            "supportsReasoning": true,
            "supportsVision": true,
            "reasoningEfforts": provider_reasoning_efforts(provider),
            "capabilities": ["chat", "coding", "reasoning", "vision"]
        }));
    }
    for extension in &ctx.config.provider_extensions {
        pool.push(json!({
            "id": extension.default_model_id,
            "displayName": extension.display_name,
            "provider": extension.provider_id,
            "pool": extension.pool,
            "source": "workspace-default",
            "available": provider_extension_is_available(extension),
            "supportsReasoning": true,
            "supportsVision": true,
            "reasoningEfforts": ["low", "medium", "high"],
            "capabilities": ["chat", "coding", "reasoning", "vision"]
        }));
    }

    let mut seen_ids = pool
        .iter()
        .filter_map(|entry| entry.get("id").and_then(Value::as_str))
        .map(str::to_string)
        .collect::<std::collections::HashSet<_>>();
    for provider in RuntimeProvider::all() {
        let fallback_local_codex_models = if provider == RuntimeProvider::OpenAI
            && compat_catalog.models_for_provider(provider).is_empty()
        {
            Some(local_codex_cached_models.as_slice())
        } else {
            None
        };
        let dynamic_models = fallback_local_codex_models
            .unwrap_or_else(|| compat_catalog.models_for_provider(provider));
        let dynamic_source = if fallback_local_codex_models.is_some() {
            "local-codex"
        } else {
            "oauth-account"
        };
        for model_id in dynamic_models {
            let trimmed = model_id.trim();
            if trimmed.is_empty() {
                continue;
            }
            if detect_provider_from_model_id(Some(trimmed)) != Some(provider) {
                continue;
            }
            if !seen_ids.insert(trimmed.to_string()) {
                mark_model_entry_discovered(pool.as_mut_slice(), trimmed, dynamic_source);
                continue;
            }
            pool.push(json!({
                "id": trimmed,
                "displayName": trimmed,
                "provider": provider.routed_provider(),
                "pool": provider.routed_pool(),
                "source": dynamic_source,
                "available": true,
                "supportsReasoning": true,
                "supportsVision": true,
                "reasoningEfforts": provider_reasoning_efforts(provider),
                "capabilities": ["chat", "coding", "reasoning", "vision"]
            }));
        }
    }

    pool
}

fn mark_model_entry_discovered(pool: &mut [Value], model_id: &str, dynamic_source: &str) {
    let Some(existing) = pool.iter_mut().find(|entry| {
        entry
            .get("id")
            .and_then(Value::as_str)
            .is_some_and(|id| id == model_id)
    }) else {
        return;
    };

    if let Some(object) = existing.as_object_mut() {
        object.insert("available".to_string(), Value::Bool(true));
        object.insert(
            "source".to_string(),
            Value::String(dynamic_source.to_string()),
        );
    }
}

pub(super) async fn build_providers_catalog(ctx: &AppContext) -> Vec<RuntimeProviderCatalogEntry> {
    let compat_catalog = resolve_compat_catalog_with_recovery(ctx).await;
    let supports_openai_compat = has_openai_compat_mode(&ctx.config);
    let mut entries = RuntimeProvider::all()
        .map(|provider| RuntimeProviderCatalogEntry {
            provider_id: provider.routed_provider().to_string(),
            display_name: provider.display_name().to_string(),
            pool: Some(provider.routed_pool().to_string()),
            oauth_provider_id: Some(provider.oauth_provider().to_string()),
            aliases: provider
                .aliases()
                .iter()
                .map(|alias| alias.to_string())
                .collect(),
            default_model_id: Some(provider.default_model_id().to_string()),
            available: provider_is_available(ctx, &compat_catalog, provider),
            supports_native: true,
            supports_openai_compat,
            registry_version: Some(CODE_RUNTIME_RPC_CONTRACT_VERSION.to_string()),
        })
        .collect::<Vec<_>>();
    entries.extend(ctx.config.provider_extensions.iter().map(|extension| {
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
            registry_version: Some(CODE_RUNTIME_RPC_CONTRACT_VERSION.to_string()),
        }
    }));

    entries.sort_by(|left, right| left.provider_id.cmp(&right.provider_id));
    entries
}

async fn resolve_compat_catalog_with_recovery(ctx: &AppContext) -> CompatModelCatalog {
    let mut fetch_error = None;

    for attempt in compat_catalog_resolution_attempts(ctx) {
        match resolve_openai_compat_model_catalog(
            ctx,
            attempt.preferred_provider,
            attempt.base_url_override.as_deref(),
            attempt.api_key_override.as_deref(),
        )
        .await
        {
            Ok(catalog) => return catalog,
            Err(error) if is_missing_compat_catalog_api_key_error(error.as_str()) => continue,
            Err(error) => {
                if fetch_error.is_none() {
                    fetch_error = Some(error);
                }
            }
        }
    }

    if has_openai_compat_mode(&ctx.config) {
        if let Some(error) = fetch_error.as_ref() {
            warn!(
                error = error.as_str(),
                "failed to fetch OpenAI-compat model catalog; falling back to static model pool"
            );
        }
    }
    CompatModelCatalog::default()
}

fn compat_catalog_resolution_attempts(ctx: &AppContext) -> Vec<CompatCatalogResolutionAttempt> {
    let mut attempts = RuntimeProvider::all()
        .filter_map(|provider| {
            let credentials = peek_strict_pool_routing_credentials(ctx, provider)?;
            Some(CompatCatalogResolutionAttempt {
                preferred_provider: Some(provider),
                base_url_override: credentials.compat_base_url,
                api_key_override: Some(credentials.api_key),
            })
        })
        .collect::<Vec<_>>();
    attempts.push(CompatCatalogResolutionAttempt {
        preferred_provider: None,
        base_url_override: None,
        api_key_override: None,
    });
    attempts
}

fn is_missing_compat_catalog_api_key_error(error: &str) -> bool {
    error == OPENAI_COMPAT_MISSING_API_KEY_ERROR
}

fn provider_is_available(
    ctx: &AppContext,
    compat_catalog: &CompatModelCatalog,
    provider: RuntimeProvider,
) -> bool {
    provider.has_api_key(&ctx.config)
        || has_available_oauth_account(ctx, provider)
        || compat_catalog.has_provider_models(provider)
}

fn provider_extension_is_available(extension: &RuntimeProviderExtension) -> bool {
    extension
        .api_key
        .as_ref()
        .is_some_and(|entry| !entry.trim().is_empty())
}

fn provider_default_model_source(provider: RuntimeProvider) -> &'static str {
    if provider == RuntimeProvider::OpenAI {
        "local-codex"
    } else {
        "oauth-account"
    }
}

fn provider_default_model_display_name(provider: RuntimeProvider) -> &'static str {
    match provider {
        RuntimeProvider::OpenAI => "GPT-5.4",
        RuntimeProvider::Anthropic => "Claude Sonnet 4.5",
        RuntimeProvider::Google => "Gemini 2.5 Pro",
    }
}

fn provider_reasoning_efforts(provider: RuntimeProvider) -> &'static [&'static str] {
    match provider {
        RuntimeProvider::OpenAI => &["low", "medium", "high", "xhigh"],
        RuntimeProvider::Anthropic | RuntimeProvider::Google => &["low", "medium", "high"],
    }
}

fn has_available_oauth_account(ctx: &AppContext, provider: RuntimeProvider) -> bool {
    peek_strict_pool_routing_credentials(ctx, provider).is_some()
}

fn peek_strict_pool_routing_credentials(
    ctx: &AppContext,
    provider: RuntimeProvider,
) -> Option<OAuthRoutingCredentials> {
    let pool_id = format!("pool-{}", provider.routed_pool());
    let selection = match ctx
        .oauth_pool
        .probe_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id,
            session_id: None,
            workspace_id: None,
            model_id: None,
        }) {
        Ok((selection, _)) => selection,
        Err(error) => {
            warn!(
                provider = provider.routed_provider(),
                error = error.as_str(),
                "failed to probe strict routing credentials from oauth pool"
            );
            return None;
        }
    };
    selection.and_then(|entry| resolve_oauth_routing_credentials_from_account(ctx, &entry.account))
}

async fn resolve_openai_compat_model_catalog(
    ctx: &AppContext,
    preferred_provider: Option<RuntimeProvider>,
    base_url_override: Option<&str>,
    api_key_override: Option<&str>,
) -> Result<CompatModelCatalog, String> {
    let Some(base_url) = resolve_openai_compat_base_url(&ctx.config, base_url_override) else {
        return Ok(CompatModelCatalog::default());
    };
    let Some(api_key) =
        resolve_any_openai_compat_api_key(&ctx.config, preferred_provider, api_key_override)
    else {
        return Err(OPENAI_COMPAT_MISSING_API_KEY_ERROR.to_string());
    };

    let cache_key = build_compat_model_catalog_cache_key(base_url.as_str(), api_key.as_str());
    let cache_ttl = compat_model_cache_ttl(&ctx.config);
    let initial_cached_snapshot = {
        let cache = ctx.compat_model_catalog_cache.read().await;
        cache.get(&cache_key).cloned()
    };

    if let Some(cached) = initial_cached_snapshot.as_ref() {
        if Instant::now().duration_since(cached.fetched_at) <= cache_ttl {
            return Ok(cached.catalog.clone());
        }
    }

    let refresh_lock = resolve_compat_model_catalog_refresh_lock(ctx, &cache_key).await;
    let _refresh_guard = if let Some(cached) = initial_cached_snapshot.as_ref() {
        match refresh_lock.try_lock() {
            Ok(guard) => guard,
            // Another caller is already refreshing this base URL. Serve stale immediately
            // instead of queueing behind the network call.
            Err(_) => return Ok(cached.catalog.clone()),
        }
    } else {
        refresh_lock.lock().await
    };

    let stale_snapshot = {
        let cache = ctx.compat_model_catalog_cache.read().await;
        cache.get(&cache_key).cloned()
    }
    .or_else(|| initial_cached_snapshot.clone());
    if let Some(cached) = stale_snapshot.as_ref() {
        let is_fresh = Instant::now().duration_since(cached.fetched_at) <= cache_ttl;
        // If another request refreshed while we were waiting on the per-base-url lock,
        // reuse that snapshot even when cache TTL is tiny (singleflight should still hold).
        let refreshed_during_wait = initial_cached_snapshot
            .as_ref()
            .map(|initial| cached.fetched_at > initial.fetched_at)
            .unwrap_or(true);
        if is_fresh || refreshed_during_wait {
            return Ok(cached.catalog.clone());
        }
    }
    let error_cooldown = compat_model_error_cooldown();
    if let Some(cached_failure) = {
        let failures = ctx.compat_model_catalog_failure_cache.read().await;
        failures.get(&cache_key).cloned()
    } {
        let elapsed = Instant::now().saturating_duration_since(cached_failure.failed_at);
        if elapsed <= error_cooldown {
            ctx.runtime_diagnostics
                .record_compat_model_catalog_error_cooldown_hit();
            if let Some(cached) = stale_snapshot.as_ref() {
                return Ok(cached.catalog.clone());
            }
            return Err(cached_failure.error);
        }
    }

    match fetch_openai_compat_model_catalog(&ctx.client, base_url.as_str(), api_key.as_str()).await
    {
        Ok(catalog) => {
            let fetched_at = Instant::now();
            let mut cache = ctx.compat_model_catalog_cache.write().await;
            prune_compat_model_catalog_cache(
                &mut cache,
                fetched_at,
                cache_ttl,
                MAX_OPENAI_COMPAT_MODEL_CACHE_ENTRIES,
            );
            cache.insert(
                cache_key.clone(),
                CachedCompatModelCatalog {
                    catalog: catalog.clone(),
                    fetched_at,
                },
            );
            let mut failures = ctx.compat_model_catalog_failure_cache.write().await;
            failures.remove(&cache_key);
            Ok(catalog)
        }
        Err(error) => {
            ctx.runtime_diagnostics
                .record_compat_model_catalog_fetch_failure();
            let failed_at = Instant::now();
            let mut failures = ctx.compat_model_catalog_failure_cache.write().await;
            prune_compat_model_catalog_failure_cache(
                &mut failures,
                failed_at,
                error_cooldown,
                MAX_OPENAI_COMPAT_MODEL_CACHE_ENTRIES,
            );
            failures.insert(
                cache_key,
                CachedCompatModelCatalogFailure {
                    error: error.clone(),
                    failed_at,
                },
            );
            if let Some(cached) = stale_snapshot {
                warn!(
                    error = error.as_str(),
                    "failed to refresh OpenAI-compat model catalog; using stale cache"
                );
                return Ok(cached.catalog);
            }
            Err(error)
        }
    }
}

pub(super) fn prune_compat_model_catalog_cache<K: Clone + Eq + Hash>(
    cache: &mut HashMap<K, CachedCompatModelCatalog>,
    now: Instant,
    cache_ttl: Duration,
    max_entries: usize,
) {
    cache.retain(|_, entry| now.saturating_duration_since(entry.fetched_at) <= cache_ttl);
    while cache.len() >= max_entries {
        let Some(oldest_key) = cache
            .iter()
            .min_by_key(|(_, entry)| entry.fetched_at)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        cache.remove(&oldest_key);
    }
}

pub(super) fn prune_compat_model_catalog_failure_cache<K: Clone + Eq + Hash>(
    cache: &mut HashMap<K, CachedCompatModelCatalogFailure>,
    now: Instant,
    cooldown: Duration,
    max_entries: usize,
) {
    cache.retain(|_, entry| now.saturating_duration_since(entry.failed_at) <= cooldown);
    while cache.len() >= max_entries {
        let Some(oldest_key) = cache
            .iter()
            .min_by_key(|(_, entry)| entry.failed_at)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        cache.remove(&oldest_key);
    }
}

async fn fetch_openai_compat_model_catalog(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
) -> Result<CompatModelCatalog, String> {
    let endpoint = build_openai_compat_endpoint(base_url, "models")?;
    let response = client
        .get(endpoint)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|error| format!("OpenAI-compat models request failed: {error}"))?;
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("Failed to parse OpenAI-compat models response: {error}"))?;
    if !status.is_success() {
        return Err(extract_openai_error_message(
            &payload,
            "OpenAI-compat models request failed.",
        ));
    }
    Ok(parse_openai_compat_model_catalog(&payload))
}

pub(super) async fn resolve_provider_default_model_id(
    ctx: &AppContext,
    provider: RuntimeProvider,
    base_url_override: Option<&str>,
    api_key_override: Option<&str>,
) -> Option<String> {
    let catalog = resolve_openai_compat_model_catalog(
        ctx,
        Some(provider),
        base_url_override,
        api_key_override,
    )
    .await
    .ok()?;
    catalog.preferred_default_for_provider(provider)
}
