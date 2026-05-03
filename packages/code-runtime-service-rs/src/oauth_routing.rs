use super::*;

pub(super) fn resolve_oauth_routing_credentials(
    ctx: &AppContext,
    provider: RuntimeProvider,
    session_id: Option<&str>,
    model_id: &str,
) -> Option<OAuthRoutingCredentials> {
    let pool_id = format!("pool-{}", provider.routed_pool());
    let session_id_log = session_id.unwrap_or("<none>");
    let (selection, miss_reason) =
        match ctx
            .oauth_pool
            .select_pool_account_with_reason(OAuthPoolSelectionInput {
                pool_id,
                session_id: session_id.map(ToOwned::to_owned),
                workspace_id: None,
                model_id: Some(model_id.to_string()),
            }) {
            Ok(result) => result,
            Err(error) => {
                ctx.runtime_diagnostics
                    .record_oauth_routing_failure("pool_select_error");
                warn!(
                    provider = provider.routed_provider(),
                    session_id = session_id_log,
                    model_id,
                    reason_code = "pool_select_error",
                    error = error.as_str(),
                    "failed to select oauth pool account"
                );
                return None;
            }
        };

    let selection = match selection {
        Some(selection) => selection,
        None => {
            let reason_code = miss_reason
                .map(OAuthPoolSelectMissReason::as_str)
                .unwrap_or("pool_exhausted");
            ctx.runtime_diagnostics
                .record_oauth_routing_failure(reason_code);
            warn!(
                provider = provider.routed_provider(),
                session_id = session_id_log,
                model_id,
                reason_code,
                "oauth routing account is unavailable"
            );
            return None;
        }
    };

    let local_codex_cli_profile = resolve_local_codex_cli_profile_for_account(&selection.account);
    let api_key = match resolve_oauth_api_key_for_account(
        ctx.oauth_pool.as_ref(),
        &selection.account,
        local_codex_cli_profile.as_ref(),
    ) {
        Ok(Some(api_key)) => api_key,
        Ok(None) => {
            ctx.runtime_diagnostics
                .record_oauth_routing_failure("auth_missing");
            warn!(
                provider = provider.routed_provider(),
                session_id = session_id_log,
                model_id,
                account_id = selection.account.account_id.as_str(),
                reason_code = "auth_missing",
                "oauth routing account is missing api key"
            );
            return None;
        }
        Err(error) => {
            let reason_code = classify_oauth_api_key_resolution_error(error.as_str());
            ctx.runtime_diagnostics
                .record_oauth_routing_failure(reason_code);
            warn!(
                provider = provider.routed_provider(),
                session_id = session_id_log,
                model_id,
                account_id = selection.account.account_id.as_str(),
                reason_code,
                error = error.as_str(),
                "oauth routing api key resolution failed"
            );
            return None;
        }
    };
    let fallback_api_key = resolve_local_codex_cli_fallback_api_credential_from_profile(
        &selection.account,
        local_codex_cli_profile.as_ref(),
        api_key.as_str(),
    );
    let local_codex_id_token = resolve_local_codex_cli_id_token_from_profile(
        &selection.account,
        local_codex_cli_profile.as_ref(),
    );
    let local_codex_refresh_token = resolve_local_codex_cli_refresh_token_from_profile(
        &selection.account,
        local_codex_cli_profile.as_ref(),
    )
    .or_else(|| {
        resolve_oauth_refresh_token_from_metadata(
            ctx.oauth_pool.as_ref(),
            &selection.account.metadata,
        )
    });
    let credential_source =
        extract_oauth_credential_source_from_metadata(&selection.account.metadata).or_else(|| {
            local_codex_cli_profile
                .as_ref()
                .and_then(|profile| profile.api_credential_source.clone())
        });
    let auth_mode =
        extract_oauth_auth_mode_from_metadata(&selection.account.metadata).or_else(|| {
            local_codex_cli_profile
                .as_ref()
                .and_then(|profile| profile.auth_mode.clone())
        });
    let external_account_id = selection.account.external_account_id.clone().or_else(|| {
        local_codex_cli_profile
            .as_ref()
            .and_then(|profile| profile.external_account_id.clone())
    });
    let persist_local_codex_auth_updates = is_local_codex_cli_managed_account(&selection.account);

    let compat_base_url = extract_openai_compat_base_url_from_metadata(&selection.account.metadata)
        .or_else(|| normalized_openai_compat_base_url(&ctx.config));
    Some(OAuthRoutingCredentials {
        account_id: selection.account.account_id.clone(),
        api_key,
        fallback_api_key,
        local_codex_id_token,
        local_codex_refresh_token,
        persist_local_codex_auth_updates,
        credential_source,
        auth_mode,
        external_account_id,
        compat_base_url,
    })
}

pub(super) fn refresh_local_codex_cli_account_for_turn(
    ctx: &AppContext,
    provider: RuntimeProvider,
) {
    if provider != RuntimeProvider::OpenAI {
        return;
    }
    if !should_attempt_local_codex_sync(
        now_ms(),
        ctx.local_codex_sync_last_attempt_ms.as_ref(),
        LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
    ) {
        return;
    }
    if let Err(error) = sync_local_codex_cli_account(ctx.oauth_pool.as_ref()) {
        ctx.runtime_diagnostics.record_local_codex_sync_failure();
        warn!(
            provider = provider.routed_provider(),
            error = error.as_str(),
            "failed to refresh local codex cli auth account before turn routing"
        );
    }
}

pub(super) fn should_attempt_local_codex_sync(
    now: u64,
    last_attempt_ms: &AtomicU64,
    min_interval_ms: u64,
) -> bool {
    loop {
        let previous = last_attempt_ms.load(Ordering::Relaxed);
        if previous > 0 && now.saturating_sub(previous) < min_interval_ms {
            return false;
        }
        match last_attempt_ms.compare_exchange(previous, now, Ordering::Relaxed, Ordering::Relaxed)
        {
            Ok(_) => return true,
            Err(observed) => {
                if observed > 0 && now.saturating_sub(observed) < min_interval_ms {
                    return false;
                }
            }
        }
    }
}

pub(super) fn resolve_oauth_routing_credentials_from_account(
    ctx: &AppContext,
    account: &oauth_pool::OAuthAccountSummary,
) -> Option<OAuthRoutingCredentials> {
    let local_codex_cli_profile = resolve_local_codex_cli_profile_for_account(account);
    let api_key = match resolve_oauth_api_key_for_account(
        ctx.oauth_pool.as_ref(),
        account,
        local_codex_cli_profile.as_ref(),
    ) {
        Ok(Some(api_key)) => api_key,
        Ok(None) => return None,
        Err(error) => {
            warn!(
                account_id = account.account_id.as_str(),
                provider = account.provider.as_str(),
                error = error.as_str(),
                "failed to resolve oauth api key from account metadata"
            );
            return None;
        }
    };
    let fallback_api_key = resolve_local_codex_cli_fallback_api_credential_from_profile(
        account,
        local_codex_cli_profile.as_ref(),
        api_key.as_str(),
    );
    let local_codex_id_token =
        resolve_local_codex_cli_id_token_from_profile(account, local_codex_cli_profile.as_ref());
    let local_codex_refresh_token = resolve_local_codex_cli_refresh_token_from_profile(
        account,
        local_codex_cli_profile.as_ref(),
    )
    .or_else(|| {
        resolve_oauth_refresh_token_from_metadata(ctx.oauth_pool.as_ref(), &account.metadata)
    });
    let credential_source = extract_oauth_credential_source_from_metadata(&account.metadata)
        .or_else(|| {
            local_codex_cli_profile
                .as_ref()
                .and_then(|profile| profile.api_credential_source.clone())
        });
    let auth_mode = extract_oauth_auth_mode_from_metadata(&account.metadata).or_else(|| {
        local_codex_cli_profile
            .as_ref()
            .and_then(|profile| profile.auth_mode.clone())
    });
    let external_account_id = account.external_account_id.clone().or_else(|| {
        local_codex_cli_profile
            .as_ref()
            .and_then(|profile| profile.external_account_id.clone())
    });
    let persist_local_codex_auth_updates = is_local_codex_cli_managed_account(account);
    let compat_base_url = extract_openai_compat_base_url_from_metadata(&account.metadata)
        .or_else(|| normalized_openai_compat_base_url(&ctx.config));
    Some(OAuthRoutingCredentials {
        account_id: account.account_id.clone(),
        api_key,
        fallback_api_key,
        local_codex_id_token,
        local_codex_refresh_token,
        persist_local_codex_auth_updates,
        credential_source,
        auth_mode,
        external_account_id,
        compat_base_url,
    })
}

pub(super) async fn recover_local_codex_cli_api_credential(
    client: &reqwest::Client,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
) -> Result<String, String> {
    let id_token = local_codex_id_token_override
        .map(str::trim)
        .filter(|entry| !entry.is_empty());
    let refresh_token = local_codex_refresh_token_override
        .map(str::trim)
        .filter(|entry| !entry.is_empty());

    if let Some(id_token) = id_token {
        if let Ok(api_key) = exchange_codex_openai_api_key(client, id_token).await {
            if persist_local_codex_auth_updates {
                if let Err(error) = persist_local_codex_cli_auth_updates(
                    None,
                    None,
                    None,
                    Some(api_key.as_str()),
                    None,
                    None,
                ) {
                    warn!(
                        error = error.as_str(),
                        "failed to persist local codex auth update after id_token exchange"
                    );
                }
            }
            return Ok(api_key);
        }
    }

    let Some(refresh_token) = refresh_token else {
        return Err(
            "local codex credential recovery unavailable: missing refresh_token".to_string(),
        );
    };

    let refreshed = refresh_codex_chatgpt_tokens(client, refresh_token).await?;
    let refreshed_id_token = refreshed
        .id_token
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .or(id_token);
    let refreshed_access_token = refreshed
        .access_token
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string);
    let refreshed_refresh_token = refreshed
        .refresh_token
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty());

    let exchanged_api_key = if let Some(id_token) = refreshed_id_token {
        exchange_codex_openai_api_key(client, id_token).await.ok()
    } else {
        None
    };

    let recovered_credential = exchanged_api_key
        .as_deref()
        .map(str::to_string)
        .or(refreshed_access_token.clone())
        .ok_or_else(|| {
            "local codex credential recovery failed: refresh returned no usable access token"
                .to_string()
        })?;

    if persist_local_codex_auth_updates {
        if let Err(error) = persist_local_codex_cli_auth_updates(
            refreshed_id_token,
            refreshed_access_token.as_deref(),
            refreshed_refresh_token,
            exchanged_api_key.as_deref(),
            None,
            None,
        ) {
            warn!(
                error = error.as_str(),
                "failed to persist local codex auth update after refresh"
            );
        }
    }

    Ok(recovered_credential)
}
