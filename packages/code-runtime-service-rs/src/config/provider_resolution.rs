use super::*;

pub(super) fn has_non_empty(value: Option<&str>) -> bool {
    value.map(str::trim).is_some_and(|entry| !entry.is_empty())
}

pub(super) fn normalize_provider_hint(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

pub(super) fn resolve_provider_extension_by_alias<'a>(
    config: &'a ServiceConfig,
    provider_hint: &str,
) -> Option<&'a RuntimeProviderExtension> {
    let normalized = normalize_provider_hint(provider_hint)?;
    config
        .provider_extensions
        .iter()
        .find(|extension| extension.aliases.iter().any(|alias| alias == &normalized))
}

pub(super) fn resolve_provider_extension_by_model_id<'a>(
    config: &'a ServiceConfig,
    model_id: &str,
) -> Option<&'a RuntimeProviderExtension> {
    let normalized_model_id = model_id.trim().to_ascii_lowercase();
    if normalized_model_id.is_empty() {
        return None;
    }

    config.provider_extensions.iter().find(|extension| {
        let default_model_id = extension.default_model_id.trim().to_ascii_lowercase();
        if default_model_id == normalized_model_id {
            return true;
        }
        extension.aliases.iter().any(|alias| {
            normalized_model_id.starts_with(format!("{alias}/").as_str())
                || normalized_model_id.starts_with(format!("{alias}-").as_str())
        })
    })
}

pub(super) fn normalize_openai_compat_base_url(base_url: &str) -> Option<String> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let parsed = reqwest::Url::parse(trimmed).ok()?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return None;
    }
    Some(trimmed.trim_end_matches('/').to_string())
}

pub(super) fn normalized_openai_compat_base_url(config: &ServiceConfig) -> Option<String> {
    config
        .openai_compat_base_url
        .as_deref()
        .and_then(normalize_openai_compat_base_url)
}

pub(super) fn resolve_openai_compat_base_url(
    config: &ServiceConfig,
    base_url_override: Option<&str>,
) -> Option<String> {
    base_url_override
        .and_then(normalize_openai_compat_base_url)
        .or_else(|| normalized_openai_compat_base_url(config))
        .or_else(|| {
            derive_openai_compat_base_url_from_responses_endpoint(config.openai_endpoint.as_str())
        })
}

pub(super) fn derive_openai_compat_base_url_from_responses_endpoint(endpoint: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(endpoint.trim()).ok()?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return None;
    }
    let mut path_segments = parsed
        .path_segments()
        .map(|segments| segments.map(str::to_string).collect::<Vec<_>>())
        .unwrap_or_default();
    if path_segments.is_empty() {
        return None;
    }
    if path_segments
        .last()
        .is_some_and(|segment| segment.eq_ignore_ascii_case("responses"))
    {
        path_segments.pop();
    } else if path_segments
        .last()
        .is_some_and(|segment| segment.eq_ignore_ascii_case("completions"))
    {
        path_segments.pop();
        if path_segments
            .last()
            .is_some_and(|segment| segment.eq_ignore_ascii_case("chat"))
        {
            path_segments.pop();
        }
    }
    if path_segments.is_empty() {
        return None;
    }
    let mut base_url = parsed;
    base_url.set_path(format!("/{}", path_segments.join("/")).as_str());
    base_url.set_query(None);
    base_url.set_fragment(None);
    normalize_openai_compat_base_url(base_url.as_str())
}

pub(super) fn should_fallback_from_responses_to_chat_completions(error: &str) -> bool {
    let normalized = error.trim().to_ascii_lowercase();
    let mentions_responses_scope = normalized.contains("api.responses.write")
        || normalized.contains("responses.write")
        || (normalized.contains("responses") && normalized.contains("scope"));
    if !mentions_responses_scope {
        return false;
    }
    normalized.contains("missing scope")
        || normalized.contains("missing scopes")
        || normalized.contains("insufficient permission")
        || normalized.contains("insufficient permissions")
        || normalized.contains("forbidden")
}

pub(super) fn has_openai_compat_mode(config: &ServiceConfig) -> bool {
    normalized_openai_compat_base_url(config).is_some()
}

pub(super) fn is_openai_compat_ready_for_provider(config: &ServiceConfig, provider: RuntimeProvider) -> bool {
    let Some(base_url) = normalized_openai_compat_base_url(config) else {
        return false;
    };
    if reqwest::Url::parse(base_url.as_str()).is_err() {
        return false;
    }
    has_non_empty(resolve_openai_compat_api_key(config, provider, None))
}

pub(super) fn has_routable_api_key(config: &ServiceConfig, provider: RuntimeProvider) -> bool {
    provider.has_api_key(config) || is_openai_compat_ready_for_provider(config, provider)
}

pub(super) fn resolve_openai_compat_api_key<'a>(
    config: &'a ServiceConfig,
    provider: RuntimeProvider,
    api_key_override: Option<&'a str>,
) -> Option<&'a str> {
    api_key_override
        .or(config.openai_compat_api_key.as_deref())
        .or(config.openai_api_key.as_deref())
        .or_else(|| match provider {
            RuntimeProvider::OpenAI => config.openai_api_key.as_deref(),
            RuntimeProvider::Anthropic => config.anthropic_api_key.as_deref(),
            RuntimeProvider::Google => config.gemini_api_key.as_deref(),
        })
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
}

pub(super) fn resolve_any_openai_compat_api_key(
    config: &ServiceConfig,
    preferred_provider: Option<RuntimeProvider>,
    api_key_override: Option<&str>,
) -> Option<String> {
    let mut candidates = Vec::with_capacity(5);
    if let Some(override_key) = api_key_override
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        candidates.push(override_key.to_string());
    }

    if let Some(provider) = preferred_provider {
        if let Some(provider_key) = resolve_openai_compat_api_key(config, provider, None) {
            candidates.push(provider_key.to_string());
        }
    }

    for candidate in [
        config.openai_compat_api_key.as_deref(),
        config.openai_api_key.as_deref(),
        config.anthropic_api_key.as_deref(),
        config.gemini_api_key.as_deref(),
    ] {
        if let Some(candidate) = candidate.map(str::trim).filter(|entry| !entry.is_empty()) {
            candidates.push(candidate.to_string());
        }
    }

    candidates
        .into_iter()
        .find(|candidate| !candidate.trim().is_empty())
}

pub(super) fn build_compat_model_catalog_cache_key(
    base_url: &str,
    api_key: &str,
) -> CompatModelCatalogCacheKey {
    let mut hasher = DefaultHasher::new();
    api_key.hash(&mut hasher);
    CompatModelCatalogCacheKey {
        base_url: base_url.to_string(),
        api_key_fingerprint: hasher.finish(),
    }
}

pub(super) fn sanitize_extension_identifier(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.is_empty() || normalized.len() > 64 {
        return None;
    }
    if normalized
        .chars()
        .all(|char| char.is_ascii_lowercase() || char.is_ascii_digit() || matches!(char, '-' | '_'))
    {
        return Some(normalized);
    }
    None
}

pub(super) fn normalize_extension_aliases(
    provider_id: &str,
    aliases: &[String],
) -> Result<Vec<String>, String> {
    let mut normalized_aliases = vec![provider_id.to_string()];
    for alias in aliases {
        let Some(normalized_alias) = sanitize_extension_identifier(alias.as_str()) else {
            return Err(format!(
                "Invalid provider extension alias `{alias}`. Aliases must match [a-z0-9_-] and be <= 64 chars."
            ));
        };
        normalized_aliases.push(normalized_alias);
    }
    normalized_aliases.sort_unstable();
    normalized_aliases.dedup();
    Ok(normalized_aliases)
}

pub(super) fn normalize_extension_api_key(
    explicit_api_key: Option<&str>,
    api_key_env: &str,
) -> Option<String> {
    if let Some(key) = explicit_api_key
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        return Some(key.to_string());
    }

    if api_key_env.trim().is_empty() {
        return None;
    }

    std::env::var(api_key_env)
        .ok()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

pub fn parse_runtime_provider_extensions(
    raw: Option<&str>,
) -> Result<Vec<RuntimeProviderExtension>, String> {
    let Some(raw) = raw.map(str::trim).filter(|entry| !entry.is_empty()) else {
        return Ok(Vec::new());
    };

    let inputs: Vec<RuntimeProviderExtensionInput> =
        serde_json::from_str(raw).map_err(|error| {
            format!("CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON must be a JSON array: {error}")
        })?;

    let mut extensions = Vec::with_capacity(inputs.len());
    let mut seen_provider_ids = std::collections::HashSet::new();
    let mut seen_aliases = RuntimeProvider::specs()
        .iter()
        .flat_map(|spec| spec.aliases.iter().copied())
        .map(str::to_string)
        .collect::<std::collections::HashSet<_>>();

    for input in inputs {
        let provider_id =
            sanitize_extension_identifier(input.provider_id.as_str()).ok_or_else(|| {
                format!(
                    "Invalid provider extension id `{}`. Expected [a-z0-9_-] and <= 64 chars.",
                    input.provider_id
                )
            })?;
        if RuntimeProvider::from_alias(Some(provider_id.as_str())).is_some() {
            return Err(format!(
                "Provider extension id `{provider_id}` collides with a built-in provider alias."
            ));
        }
        if !seen_provider_ids.insert(provider_id.clone()) {
            return Err(format!(
                "Duplicate provider extension id `{provider_id}` in extension config."
            ));
        }

        let display_name = input.display_name.trim();
        if display_name.is_empty() {
            return Err(format!(
                "Provider extension `{provider_id}` is missing `displayName`."
            ));
        }

        let pool = sanitize_extension_identifier(input.pool.as_str()).ok_or_else(|| {
            format!(
                "Invalid pool `{}` for provider extension `{provider_id}`.",
                input.pool
            )
        })?;
        let default_model_id = input.default_model_id.trim().to_string();
        if default_model_id.is_empty() {
            return Err(format!(
                "Provider extension `{provider_id}` is missing `defaultModelId`."
            ));
        }

        let compat_base_url = normalize_openai_compat_base_url(input.compat_base_url.as_str())
            .ok_or_else(|| {
                format!(
                    "Provider extension `{provider_id}` has invalid `compatBaseUrl`: {}",
                    input.compat_base_url
                )
            })?;

        let aliases = normalize_extension_aliases(provider_id.as_str(), input.aliases.as_slice())?;
        for alias in &aliases {
            if !seen_aliases.insert(alias.clone()) {
                return Err(format!(
                    "Provider extension alias `{alias}` collides with an existing provider alias."
                ));
            }
        }

        let api_key_env = input
            .api_key_env
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .unwrap_or("")
            .to_string();
        let api_key = normalize_extension_api_key(input.api_key.as_deref(), api_key_env.as_str());

        extensions.push(RuntimeProviderExtension {
            provider_id,
            display_name: display_name.to_string(),
            pool,
            default_model_id,
            compat_base_url,
            aliases,
            api_key_env,
            api_key,
        });
    }

    Ok(extensions)
}
