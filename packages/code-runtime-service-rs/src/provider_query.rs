use super::*;

pub(super) async fn query_provider(
    client: &reqwest::Client,
    config: &ServiceConfig,
    provider_route: &TurnProviderRoute,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
) -> Result<provider_requests::ProviderQueryResult, String> {
    query_provider_with_delta(
        client,
        config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        content,
        model_id,
        reason_effort,
        service_tier,
        None,
    )
    .await
}

pub(super) async fn query_provider_with_delta(
    client: &reqwest::Client,
    config: &ServiceConfig,
    provider_route: &TurnProviderRoute,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    delta_callback: Option<provider_requests::ProviderDeltaCallback>,
) -> Result<provider_requests::ProviderQueryResult, String> {
    if let Some(replayed_output) = provider_replay::maybe_replay_provider_response(
        None,
        provider_route,
        content,
        model_id,
        reason_effort,
        delta_callback.clone(),
    )
    .await?
    {
        return Ok(provider_requests::ProviderQueryResult::from_output(
            replayed_output,
        ));
    }

    match provider_route {
        TurnProviderRoute::Core(provider) => {
            // Only pre-route via OpenAI-compat when explicitly configured.
            // For OpenAI core routing with a Responses endpoint, we should hit
            // `/responses` first and only derive compat fallback after a
            // scope-missing error.
            let explicit_compat_base_url = compat_base_url_override
                .and_then(normalize_openai_compat_base_url)
                .or_else(|| normalized_openai_compat_base_url(config));

            if let Some(base_url) = explicit_compat_base_url {
                if let Some(api_key) =
                    resolve_openai_compat_api_key(config, *provider, api_key_override)
                {
                    return provider_requests::query_openai_compat_chat(
                        client,
                        config,
                        base_url.as_str(),
                        api_key,
                        content,
                        model_id,
                        reason_effort,
                        service_tier,
                    )
                    .await;
                }
            }

            match provider {
                RuntimeProvider::OpenAI => {
                    if should_route_oauth_via_chatgpt_codex_backend(
                        oauth_credential_source_override,
                        oauth_auth_mode_override,
                    ) {
                        let Some(access_token) = api_key_override
                            .map(str::trim)
                            .filter(|entry| !entry.is_empty())
                        else {
                            return Err(
                                "ChatGPT OAuth access token is unavailable for Codex routing."
                                    .to_string(),
                            );
                        };
                        let primary_result = provider_requests::query_chatgpt_codex_responses(
                            client,
                            config,
                            access_token,
                            content,
                            model_id,
                            reason_effort,
                            service_tier,
                            oauth_external_account_id_override,
                            delta_callback.clone(),
                        )
                        .await;
                        return match primary_result {
                            Ok(response) => Ok(response),
                            Err(primary_error) => {
                                if !is_chatgpt_oauth_auth_error(primary_error.as_str()) {
                                    return Err(primary_error);
                                }
                                let refresh_token = local_codex_refresh_token_override
                                    .map(str::trim)
                                    .filter(|entry| !entry.is_empty());
                                let Some(refresh_token) = refresh_token else {
                                    return Err(primary_error);
                                };
                                let refreshed = refresh_codex_chatgpt_tokens(client, refresh_token)
                                    .await
                                    .map_err(|refresh_error| {
                                        format!(
                                            "{primary_error} (oauth refresh failed: {refresh_error})"
                                        )
                                    })?;
                                let refreshed_access_token = refreshed
                                    .access_token
                                    .as_deref()
                                    .map(str::trim)
                                    .filter(|entry| !entry.is_empty())
                                    .ok_or_else(|| {
                                        format!(
                                            "{primary_error} (oauth refresh returned no access token)"
                                        )
                                    })?;
                                provider_requests::query_chatgpt_codex_responses(
                                    client,
                                    config,
                                    refreshed_access_token,
                                    content,
                                    model_id,
                                    reason_effort,
                                    service_tier,
                                    oauth_external_account_id_override,
                                    delta_callback.clone(),
                                )
                                .await
                                .map_err(|retry_error| {
                                    format!(
                                        "{primary_error} (refreshed ChatGPT Codex request failed: {retry_error})"
                                    )
                                })
                            }
                        };
                    }

                    let alternate_api_key = fallback_api_key_override
                        .map(str::trim)
                        .filter(|entry| !entry.is_empty())
                        .filter(|entry| api_key_override.map(str::trim) != Some(*entry));
                    let primary_result = provider_requests::query_openai(
                        client,
                        config,
                        api_key_override,
                        content,
                        model_id,
                        reason_effort,
                        service_tier,
                    )
                    .await;
                    match primary_result {
                        Ok(response) => Ok(response),
                        Err(primary_error)
                            if should_fallback_from_responses_to_chat_completions(
                                primary_error.as_str(),
                            ) =>
                        {
                            let fallback_base_url =
                                resolve_openai_compat_base_url(config, compat_base_url_override)
                                    .or_else(|| {
                                        derive_openai_compat_base_url_from_responses_endpoint(
                                            config.openai_endpoint.as_str(),
                                        )
                                    });
                            let local_refresh_error = match recover_local_codex_cli_api_credential(
                                client,
                                local_codex_id_token_override,
                                local_codex_refresh_token_override,
                                persist_local_codex_auth_updates,
                            )
                            .await
                            {
                                Ok(recovered_api_key) => {
                                    let recovered_primary = provider_requests::query_openai(
                                        client,
                                        config,
                                        Some(recovered_api_key.as_str()),
                                        content,
                                        model_id,
                                        reason_effort,
                                        service_tier,
                                    )
                                    .await;
                                    match recovered_primary {
                                        Ok(response) => return Ok(response),
                                        Err(recovered_primary_error) => {
                                            if should_fallback_from_responses_to_chat_completions(
                                                recovered_primary_error.as_str(),
                                            ) {
                                                if let Some(base_url) = fallback_base_url.as_deref()
                                                {
                                                    match provider_requests::query_openai_compat_chat(
                                                        client,
                                                        config,
                                                        base_url,
                                                        recovered_api_key.as_str(),
                                                        content,
                                                        model_id,
                                                        None,
                                                        service_tier,
                                                    )
                                                    .await
                                                    {
                                                        Ok(response) => return Ok(response),
                                                        Err(recovered_fallback_error) => Some(format!(
                                                            "{recovered_primary_error} (refreshed fallback chat/completions failed: {recovered_fallback_error})"
                                                        )),
                                                    }
                                                } else {
                                                    Some(recovered_primary_error)
                                                }
                                            } else {
                                                Some(recovered_primary_error)
                                            }
                                        }
                                    }
                                }
                                Err(error) => Some(error),
                            };
                            let mut alternate_error = None;

                            if let Some(alternate_api_key) = alternate_api_key {
                                let alternate_primary = provider_requests::query_openai(
                                    client,
                                    config,
                                    Some(alternate_api_key),
                                    content,
                                    model_id,
                                    reason_effort,
                                    service_tier,
                                )
                                .await;
                                match alternate_primary {
                                    Ok(response) => return Ok(response),
                                    Err(alternate_primary_error) => {
                                        if should_fallback_from_responses_to_chat_completions(
                                            alternate_primary_error.as_str(),
                                        ) {
                                            if let Some(base_url) = fallback_base_url.as_deref() {
                                                match provider_requests::query_openai_compat_chat(
                                                    client,
                                                    config,
                                                    base_url,
                                                    alternate_api_key,
                                                    content,
                                                    model_id,
                                                    None,
                                                    service_tier,
                                                )
                                                .await
                                                {
                                                    Ok(response) => return Ok(response),
                                                    Err(alternate_fallback_error) => {
                                                        alternate_error = Some(format!(
                                                            "{alternate_primary_error} (alternate fallback chat/completions failed: {alternate_fallback_error})"
                                                        ));
                                                    }
                                                }
                                            } else {
                                                alternate_error = Some(alternate_primary_error);
                                            }
                                        } else {
                                            alternate_error = Some(alternate_primary_error);
                                        }
                                    }
                                }
                            }

                            let Some(base_url) = fallback_base_url else {
                                if let Some(local_refresh_error) = local_refresh_error {
                                    if let Some(alternate_error) = alternate_error {
                                        return Err(format!(
                                            "{primary_error} (local codex refresh failed: {local_refresh_error}) (alternate local credential failed: {alternate_error})"
                                        ));
                                    }
                                    return Err(format!(
                                        "{primary_error} (local codex refresh failed: {local_refresh_error})"
                                    ));
                                }
                                if let Some(alternate_error) = alternate_error {
                                    return Err(format!(
                                        "{primary_error} (alternate local credential failed: {alternate_error})"
                                    ));
                                }
                                return Err(primary_error);
                            };
                            let Some(fallback_api_key) =
                                resolve_openai_compat_api_key(config, *provider, api_key_override)
                            else {
                                if let Some(local_refresh_error) = local_refresh_error {
                                    if let Some(alternate_error) = alternate_error {
                                        return Err(format!(
                                            "{primary_error} (local codex refresh failed: {local_refresh_error}) (alternate local credential failed: {alternate_error})"
                                        ));
                                    }
                                    return Err(format!(
                                        "{primary_error} (local codex refresh failed: {local_refresh_error})"
                                    ));
                                }
                                if let Some(alternate_error) = alternate_error {
                                    return Err(format!(
                                        "{primary_error} (alternate local credential failed: {alternate_error})"
                                    ));
                                }
                                return Err(primary_error);
                            };
                            match provider_requests::query_openai_compat_chat(
                                client,
                                config,
                                base_url.as_str(),
                                fallback_api_key,
                                content,
                                model_id,
                                None,
                                service_tier,
                            )
                            .await
                            {
                                Ok(response) => Ok(response),
                                Err(fallback_error) => {
                                    if let Some(local_refresh_error) = local_refresh_error {
                                        if let Some(alternate_error) = alternate_error {
                                            Err(format!(
                                                "{primary_error} (fallback chat/completions failed: {fallback_error}) (local codex refresh failed: {local_refresh_error}) (alternate local credential failed: {alternate_error})"
                                            ))
                                        } else {
                                            Err(format!(
                                                "{primary_error} (fallback chat/completions failed: {fallback_error}) (local codex refresh failed: {local_refresh_error})"
                                            ))
                                        }
                                    } else if let Some(alternate_error) = alternate_error {
                                        Err(format!(
                                            "{primary_error} (fallback chat/completions failed: {fallback_error}) (alternate local credential failed: {alternate_error})"
                                        ))
                                    } else {
                                        Err(format!(
                                            "{primary_error} (fallback chat/completions failed: {fallback_error})"
                                        ))
                                    }
                                }
                            }
                        }
                        Err(primary_error) => Err(primary_error),
                    }
                }
                RuntimeProvider::Anthropic => {
                    provider_requests::query_anthropic(
                        client,
                        config,
                        api_key_override,
                        content,
                        model_id,
                    )
                    .await
                }
                RuntimeProvider::ClaudeCodeLocal => Err(
                    "Claude Code Local must be executed through the local Claude CLI transport."
                        .to_string(),
                ),
                RuntimeProvider::Google => {
                    provider_requests::query_google(
                        client,
                        config,
                        api_key_override,
                        content,
                        model_id,
                    )
                    .await
                }
            }
        }
        TurnProviderRoute::Extension(extension) => {
            let api_key = api_key_override
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .or(extension.api_key.as_deref())
                .ok_or_else(|| {
                    if extension.api_key_env.trim().is_empty() {
                        format!(
                            "Provider extension `{}` has no API key configured.",
                            extension.provider_id
                        )
                    } else {
                        format!(
                            "Provider extension `{}` API key is not configured (expected env `{}`).",
                            extension.provider_id, extension.api_key_env
                        )
                    }
                })?;
            provider_requests::query_openai_compat_chat(
                client,
                config,
                extension.compat_base_url.as_str(),
                api_key,
                content,
                model_id,
                reason_effort,
                service_tier,
            )
            .await
        }
    }
}

pub(super) async fn query_provider_runtime_tool_call(
    client: &reqwest::Client,
    config: &ServiceConfig,
    provider_route: &TurnProviderRoute,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
) -> Result<crate::provider_runtime_tool_call::OpenAiRuntimeToolCallResponse, String> {
    match provider_route {
        TurnProviderRoute::Core(RuntimeProvider::OpenAI) => {
            if should_route_oauth_via_chatgpt_codex_backend(
                oauth_credential_source_override,
                oauth_auth_mode_override,
            ) {
                return Err(
                    "Runtime tool-call orchestration is not yet available on ChatGPT OAuth routing."
                        .to_string(),
                );
            }
            if compat_base_url_override
                .and_then(normalize_openai_compat_base_url)
                .or_else(|| normalized_openai_compat_base_url(config))
                .is_some()
            {
                return Err(
                    "Runtime tool-call orchestration is not available in OpenAI-compat mode."
                        .to_string(),
                );
            }

            let primary = crate::provider_runtime_tool_call::query_openai_runtime_tool_call(
                client,
                config,
                api_key_override,
                content,
                model_id,
                reason_effort,
                service_tier,
            )
            .await;

            match primary {
                Ok(response) => Ok(response),
                Err(primary_error) => {
                    let alternate_api_key = fallback_api_key_override
                        .map(str::trim)
                        .filter(|entry| !entry.is_empty())
                        .filter(|entry| api_key_override.map(str::trim) != Some(*entry));
                    if let Some(alternate_api_key) = alternate_api_key {
                        match crate::provider_runtime_tool_call::query_openai_runtime_tool_call(
                            client,
                            config,
                            Some(alternate_api_key),
                            content,
                            model_id,
                            reason_effort,
                            service_tier,
                        )
                        .await
                        {
                            Ok(response) => Ok(response),
                            Err(alternate_error) => Err(format!(
                                "{primary_error} (alternate local credential failed: {alternate_error})"
                            )),
                        }
                    } else {
                        Err(primary_error)
                    }
                }
            }
        }
        _ => {
            Err("Runtime tool-call orchestration currently supports OpenAI route only.".to_string())
        }
    }
}
