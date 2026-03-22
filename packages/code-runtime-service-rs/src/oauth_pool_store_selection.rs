use super::*;

impl OAuthPoolStore {
    pub fn bind_pool_account(
        &self,
        input: OAuthPoolAccountBindInput,
    ) -> Result<Option<OAuthPoolSelectionResult>, OAuthPoolMutationError> {
        let pool_id =
            sanitize_required(input.pool_id.as_str(), "poolId").map_err(invalid_input_error)?;
        let session_id = sanitize_required(input.session_id.as_str(), "sessionId")
            .map_err(invalid_input_error)?;
        let account_id = sanitize_required(input.account_id.as_str(), "accountId")
            .map_err(invalid_input_error)?;
        let workspace_scope = sanitize_optional(input.workspace_id.as_deref());
        let now = now_ms();

        let conn = self
            .lock_conn("bind_pool_account")
            .map_err(OAuthPoolMutationError::internal)?;
        let (pool, candidates) = self
            .prepare_pool_selection_with_conn(&conn, pool_id, workspace_scope.as_deref(), None, now)
            .map_err(OAuthPoolMutationError::internal)?
            .map_err(|miss_reason| {
                invalid_input_error(format!(
                    "Pool account bind failed for `{pool_id}`: {}",
                    miss_reason.as_str()
                ))
            })?;

        let Some(candidate) = candidates
            .iter()
            .find(|entry| entry.account.account_id == account_id)
        else {
            return Err(invalid_input_error(format!(
                "Account `{account_id}` is not eligible for pool `{pool_id}` for the requested project workspace route."
            )));
        };

        upsert_manual_session_binding(
            &conn,
            session_id,
            pool_id,
            workspace_scope.as_deref(),
            account_id,
            now,
        )
        .map_err(OAuthPoolMutationError::internal)?;

        Ok(Some(OAuthPoolSelectionResult {
            pool_id: pool.pool_id,
            account: candidate.account.clone(),
            reason: "manual_binding".to_string(),
        }))
    }

    pub fn select_pool_account(
        &self,
        input: OAuthPoolSelectionInput,
    ) -> OAuthResult<Option<OAuthPoolSelectionResult>> {
        let (selection, _) = self.select_pool_account_with_reason(input)?;
        Ok(selection)
    }

    pub fn probe_pool_account_with_reason(
        &self,
        input: OAuthPoolSelectionInput,
    ) -> OAuthResult<(
        Option<OAuthPoolSelectionResult>,
        Option<OAuthPoolSelectMissReason>,
    )> {
        let pool_id = sanitize_required(input.pool_id.as_str(), "poolId")?;
        let model_scope = sanitize_optional(input.model_id.as_deref());
        let workspace_scope = sanitize_optional(input.workspace_id.as_deref());
        let now = now_ms();

        let conn = self.lock_conn("probe_pool_account")?;
        let (pool, candidates) = match self.prepare_pool_selection_with_conn(
            &conn,
            pool_id,
            workspace_scope.as_deref(),
            model_scope.as_deref(),
            now,
        )? {
            Ok(prepared) => prepared,
            Err(miss_reason) => return Ok((None, Some(miss_reason))),
        };

        if let Some(preferred_account_id) = pool.preferred_account_id.as_deref() {
            if let Some(candidate) = candidates
                .iter()
                .find(|entry| entry.account.account_id == preferred_account_id)
            {
                return Ok((
                    Some(OAuthPoolSelectionResult {
                        pool_id: pool.pool_id,
                        account: candidate.account.clone(),
                        reason: "preferred_account".to_string(),
                    }),
                    None,
                ));
            }
        }

        let selected = if pool.strategy == STRATEGY_P2C {
            select_p2c_candidate(&candidates).or_else(|| {
                select_round_robin_candidate(&candidates, pool_id, &self.round_robin_cursor, false)
            })
        } else {
            select_round_robin_candidate(&candidates, pool_id, &self.round_robin_cursor, false)
        };

        let Some(selected) = selected else {
            return Ok((None, Some(OAuthPoolSelectMissReason::PoolExhausted)));
        };

        let reason = if pool.strategy == STRATEGY_P2C {
            "p2c"
        } else {
            "round_robin"
        };

        Ok((
            Some(OAuthPoolSelectionResult {
                pool_id: pool.pool_id,
                account: selected.account.clone(),
                reason: reason.to_string(),
            }),
            None,
        ))
    }

    pub fn select_pool_account_with_reason(
        &self,
        input: OAuthPoolSelectionInput,
    ) -> OAuthResult<(
        Option<OAuthPoolSelectionResult>,
        Option<OAuthPoolSelectMissReason>,
    )> {
        let pool_id = sanitize_required(input.pool_id.as_str(), "poolId")?;
        let model_scope = sanitize_optional(input.model_id.as_deref());
        let session_id = sanitize_optional(input.session_id.as_deref());
        let workspace_scope = sanitize_optional(input.workspace_id.as_deref());
        let now = now_ms();

        let conn = self.lock_conn("select_pool_account")?;
        let (pool, candidates) = match self.prepare_pool_selection_with_conn(
            &conn,
            pool_id,
            workspace_scope.as_deref(),
            model_scope.as_deref(),
            now,
        )? {
            Ok(prepared) => prepared,
            Err(miss_reason) => return Ok((None, Some(miss_reason))),
        };

        let manual_binding_candidate = if let Some(session_id) = session_id.as_deref() {
            if let Some(manually_bound_account_id) = resolve_manual_session_binding(
                &conn,
                session_id,
                pool_id,
                workspace_scope.as_deref(),
            )? {
                let matched = candidates
                    .iter()
                    .find(|entry| entry.account.account_id == manually_bound_account_id);
                if matched.is_none() {
                    clear_manual_session_binding(
                        &conn,
                        session_id,
                        pool_id,
                        workspace_scope.as_deref(),
                    )?;
                }
                matched
            } else {
                None
            }
        } else {
            None
        };

        if let Some(candidate) = manual_binding_candidate {
            return Ok((
                Some(OAuthPoolSelectionResult {
                    pool_id: pool.pool_id,
                    account: candidate.account.clone(),
                    reason: "manual_binding".to_string(),
                }),
                None,
            ));
        }

        let sticky_candidate = if matches!(
            pool.sticky_mode.as_str(),
            STICKY_CACHE_FIRST | STICKY_PERFORMANCE_FIRST
        ) {
            if let Some(session_id) = session_id.as_deref() {
                if let Some(sticky_account_id) = resolve_session_binding(
                    &conn,
                    session_id,
                    pool_id,
                    workspace_scope.as_deref(),
                    now,
                )? {
                    candidates
                        .iter()
                        .find(|entry| entry.account.account_id == sticky_account_id)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        if let Some(preferred_account_id) = pool.preferred_account_id.as_deref() {
            if let Some(candidate) = candidates
                .iter()
                .find(|entry| entry.account.account_id == preferred_account_id)
            {
                if let Some(session_id) = session_id.as_deref() {
                    if should_persist_session_binding(pool.sticky_mode.as_str()) {
                        upsert_session_binding(
                            &conn,
                            session_id,
                            pool_id,
                            workspace_scope.as_deref(),
                            preferred_account_id,
                            now,
                        )?;
                    } else {
                        clear_session_binding(&conn, session_id, pool_id)?;
                    }
                }
                return Ok((
                    Some(OAuthPoolSelectionResult {
                        pool_id: pool.pool_id,
                        account: candidate.account.clone(),
                        reason: "preferred_account".to_string(),
                    }),
                    None,
                ));
            }
        }

        if pool.sticky_mode == STICKY_CACHE_FIRST {
            if let Some(candidate) = sticky_candidate {
                return Ok((
                    Some(OAuthPoolSelectionResult {
                        pool_id: pool.pool_id,
                        account: candidate.account.clone(),
                        reason: "sticky_binding".to_string(),
                    }),
                    None,
                ));
            }
        }

        let selected = if pool.strategy == STRATEGY_P2C {
            select_p2c_candidate(&candidates).or_else(|| {
                select_round_robin_candidate(&candidates, pool_id, &self.round_robin_cursor, true)
            })
        } else {
            select_round_robin_candidate(&candidates, pool_id, &self.round_robin_cursor, true)
        };

        let Some(selected) = selected else {
            return Ok((None, Some(OAuthPoolSelectMissReason::PoolExhausted)));
        };

        let mut selected_candidate = selected;
        let mut selection_reason = if pool.strategy == STRATEGY_P2C {
            "p2c"
        } else {
            "round_robin"
        };

        if pool.sticky_mode == STICKY_PERFORMANCE_FIRST {
            if let Some(sticky_candidate) = sticky_candidate {
                if compare_selection_candidate_rank(sticky_candidate, selected_candidate)
                    != Ordering::Greater
                {
                    selected_candidate = sticky_candidate;
                    selection_reason = "sticky_performance";
                }
            }
        }

        if let Some(session_id) = session_id.as_deref() {
            if should_persist_session_binding(pool.sticky_mode.as_str()) {
                upsert_session_binding(
                    &conn,
                    session_id,
                    pool_id,
                    workspace_scope.as_deref(),
                    selected_candidate.account.account_id.as_str(),
                    now,
                )?;
            } else {
                clear_session_binding(&conn, session_id, pool_id)?;
            }
        }

        Ok((
            Some(OAuthPoolSelectionResult {
                pool_id: pool.pool_id,
                account: selected_candidate.account.clone(),
                reason: selection_reason.to_string(),
            }),
            None,
        ))
    }

    fn prepare_pool_selection_with_conn(
        &self,
        conn: &Connection,
        pool_id: &str,
        workspace_scope: Option<&str>,
        model_scope: Option<&str>,
        now: u64,
    ) -> OAuthResult<Result<(OAuthPoolSummary, Vec<SelectionCandidate>), OAuthPoolSelectMissReason>>
    {
        let Some(pool) = self.get_pool_internal_with_conn(conn, pool_id) else {
            return Ok(Err(OAuthPoolSelectMissReason::PoolNotFound));
        };
        if !pool.enabled {
            return Ok(Err(OAuthPoolSelectMissReason::PoolDisabled));
        }

        let members = self.list_pool_members_with_conn(conn, pool_id)?;
        if members.is_empty() {
            return Ok(Err(OAuthPoolSelectMissReason::PoolExhausted));
        }

        let mut candidates = Vec::new();
        let mut has_rate_limited_candidate = false;
        let mut has_auth_missing_candidate = false;
        let mut has_decrypt_failure_candidate = false;
        for member in members.into_iter().filter(|entry| entry.enabled) {
            let Some(account) =
                self.get_account_internal_with_conn(conn, member.account_id.as_str())
            else {
                continue;
            };
            if account.status != STATUS_ENABLED {
                continue;
            }
            if !oauth_account_supports_chatgpt_workspace(&account, workspace_scope) {
                continue;
            }
            if account
                .route_config
                .as_ref()
                .and_then(|config| config.schedulable)
                == Some(false)
            {
                continue;
            }
            if account
                .routing_state
                .as_ref()
                .and_then(|state| state.temp_unschedulable_until)
                .is_some_and(|until| until > now)
            {
                continue;
            }
            if account
                .routing_state
                .as_ref()
                .and_then(|state| state.rate_limited_until)
                .is_some_and(|until| until > now)
                || account
                    .routing_state
                    .as_ref()
                    .and_then(|state| state.overloaded_until)
                    .is_some_and(|until| until > now)
            {
                has_rate_limited_candidate = true;
                continue;
            }
            if account
                .routing_state
                .as_ref()
                .and_then(|state| state.credential_ready)
                == Some(false)
            {
                has_auth_missing_candidate = true;
                continue;
            }
            let (is_limited, penalty) =
                resolve_rate_limit_state(conn, account.account_id.as_str(), model_scope, now)?;
            if is_limited {
                has_rate_limited_candidate = true;
                continue;
            }
            let local_cli_profile_credential_available =
                has_local_codex_cli_profile_credential(&account.metadata);
            match self.resolve_api_key_from_metadata(&account.metadata) {
                Ok(Some(_)) => {}
                Ok(None) if local_cli_profile_credential_available => {}
                Ok(None) => {
                    has_auth_missing_candidate = true;
                    continue;
                }
                Err(_) if local_cli_profile_credential_available => {}
                Err(_) => {
                    has_decrypt_failure_candidate = true;
                    continue;
                }
            }
            candidates.push(SelectionCandidate {
                member,
                account,
                failure_penalty: penalty,
            });
        }

        if candidates.is_empty() {
            let miss_reason = if has_rate_limited_candidate {
                OAuthPoolSelectMissReason::RateLimited
            } else if has_decrypt_failure_candidate {
                OAuthPoolSelectMissReason::DecryptFailed
            } else if has_auth_missing_candidate {
                OAuthPoolSelectMissReason::AuthMissing
            } else {
                OAuthPoolSelectMissReason::PoolExhausted
            };
            return Ok(Err(miss_reason));
        }

        Ok(Ok((pool, candidates)))
    }

    pub fn diagnostics(&self) -> OAuthResult<OAuthPoolDiagnostics> {
        let conn = self.lock_conn("diagnostics")?;
        let now = now_ms();
        let round_robin_cursor_entries = self
            .round_robin_cursor
            .lock()
            .map(|cursor| cursor.len() as u64)
            .unwrap_or(0);

        let accounts_total = query_count(&conn, "SELECT COUNT(*) FROM oauth_accounts", [])?;
        let accounts_enabled = query_count(
            &conn,
            "SELECT COUNT(*) FROM oauth_accounts WHERE status = ?1",
            [STATUS_ENABLED],
        )?;
        let pools_total = query_count(&conn, "SELECT COUNT(*) FROM oauth_pools", [])?;
        let pools_enabled = query_count(
            &conn,
            "SELECT COUNT(*) FROM oauth_pools WHERE enabled = 1",
            [],
        )?;
        let pool_members_total = query_count(&conn, "SELECT COUNT(*) FROM oauth_pool_members", [])?;
        let session_bindings_total = query_count(
            &conn,
            "SELECT COUNT(*) FROM oauth_session_bindings WHERE expires_at IS NULL OR expires_at > ?1",
            [now],
        )?;
        let active_rate_limits_total = query_count(
            &conn,
            "SELECT COUNT(*) FROM oauth_rate_limits WHERE reset_at IS NULL OR reset_at > ?1",
            [now],
        )?;

        let mut accounts_with_api_key = 0_u64;
        let mut statement = conn
            .prepare("SELECT metadata FROM oauth_accounts")
            .map_err(|error| format!("Prepare oauth diagnostics metadata query: {error}"))?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Query oauth diagnostics metadata rows: {error}"))?;
        for row in rows {
            let metadata_raw =
                row.map_err(|error| format!("Read oauth diagnostics metadata row: {error}"))?;
            let metadata = parse_metadata(metadata_raw);
            let metadata_object = metadata
                .as_object()
                .ok_or_else(|| "OAuth diagnostics metadata must be an object.".to_string())?;
            let storage = resolve_secret_storage(
                metadata_object,
                OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY,
                OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES,
                "api key",
            )?;
            if !matches!(storage, SecretStorage::Missing) {
                accounts_with_api_key = accounts_with_api_key.saturating_add(1);
            }
        }

        Ok(OAuthPoolDiagnostics {
            accounts_total,
            accounts_enabled,
            accounts_with_api_key,
            pools_total,
            pools_enabled,
            pool_members_total,
            session_bindings_total,
            round_robin_cursor_entries,
            active_rate_limits_total,
            oauth_secret_key_configured: self.secret_cipher.is_some(),
        })
    }

    pub(super) fn remove_round_robin_cursor_entry(&self, pool_id: &str) {
        if let Ok(mut cursor) = self.round_robin_cursor.lock() {
            cursor.remove(pool_id);
        }
    }

    pub fn report_rate_limit(&self, input: OAuthRateLimitReportInput) -> OAuthResult<bool> {
        let account_id = sanitize_required(input.account_id.as_str(), "accountId")?;
        let model_scope =
            sanitize_optional(input.model_id.as_deref()).unwrap_or_else(|| "*".to_string());
        let mut conn = self.lock_conn("report_rate_limit")?;
        let transaction = conn
            .transaction()
            .map_err(|error| format!("Begin report_rate_limit transaction: {error}"))?;

        let account_provider: Option<String> = transaction
            .query_row(
                "SELECT provider FROM oauth_accounts WHERE account_id = ?1",
                [account_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| format!("Check account existence `{account_id}`: {error}"))?;
        if account_provider.is_none() {
            return Ok(false);
        }

        if input.success {
            transaction
                .execute(
                    "DELETE FROM oauth_rate_limits WHERE account_id = ?1 AND scope_model = ?2",
                    params![account_id, model_scope],
                )
                .map_err(|error| format!("Delete rate limit state on success: {error}"))?;
            transaction.commit().map_err(|error| {
                format!("Commit report_rate_limit success transaction: {error}")
            })?;
            return Ok(true);
        }

        let now = now_ms();
        let (previous_reset_at, previous_failure_count): (Option<u64>, i32) = transaction
            .query_row(
                "SELECT reset_at, failure_count
                 FROM oauth_rate_limits
                 WHERE account_id = ?1 AND scope_model = ?2",
                params![account_id, model_scope],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|error| format!("Read previous rate limit state: {error}"))?
            .unwrap_or((None, 0));
        let next_failure_count = previous_failure_count.saturating_add(1);
        let normalized_retry_after_sec = normalize_retry_after_seconds(input.retry_after_sec);
        let computed_reset_at = normalize_reported_reset_at(input.reset_at, now)
            .or_else(|| {
                normalized_retry_after_sec
                    .map(|retry_after| now.saturating_add(retry_after.saturating_mul(1000)))
            })
            .or_else(|| {
                fallback_rate_limit_reset_at(
                    now,
                    next_failure_count,
                    account_id,
                    model_scope.as_str(),
                    input.error_code.as_deref(),
                    input.error_message.as_deref(),
                )
            });
        let reset_at = merge_rate_limit_reset(previous_reset_at, computed_reset_at, now);

        transaction
            .execute(
                "INSERT INTO oauth_rate_limits (
                    account_id, scope_model, reset_at, failure_count, last_error, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(account_id, scope_model) DO UPDATE SET
                    reset_at = excluded.reset_at,
                    failure_count = excluded.failure_count,
                    last_error = excluded.last_error,
                    updated_at = excluded.updated_at",
                params![
                    account_id,
                    model_scope,
                    reset_at,
                    next_failure_count,
                    sanitize_optional(input.error_message.as_deref()),
                    now
                ],
            )
            .map_err(|error| format!("Upsert rate limit state: {error}"))?;

        if let Some(transition) = resolve_oauth_account_status_transition(
            input.error_code.as_deref(),
            input.error_message.as_deref(),
        ) {
            let (next_status, next_disabled_reason) = match transition {
                OAuthAccountStatusTransition::DisabledInvalidGrant => {
                    (STATUS_DISABLED, DISABLED_REASON_INVALID_GRANT)
                }
                OAuthAccountStatusTransition::ValidationBlockedPolicy => {
                    (STATUS_VALIDATION_BLOCKED, DISABLED_REASON_POLICY_BLOCKED)
                }
                OAuthAccountStatusTransition::ForbiddenUpstreamRestriction => {
                    (STATUS_FORBIDDEN, DISABLED_REASON_PROVIDER_FORBIDDEN)
                }
            };
            transaction
                .execute(
                    "UPDATE oauth_accounts
                     SET status = ?2, disabled_reason = ?3, updated_at = ?4
                     WHERE account_id = ?1",
                    params![account_id, next_status, next_disabled_reason, now],
                )
                .map_err(|error| {
                    format!("Update account status after provider risk signal: {error}")
                })?;
            transaction
                .execute(
                    "DELETE FROM oauth_session_bindings WHERE account_id = ?1",
                    [account_id],
                )
                .map_err(|error| {
                    format!("Delete session bindings for disabled account: {error}")
                })?;
        }
        if account_provider.as_deref() == Some(PROVIDER_CODEX) {
            let current_primary_account_id =
                self.read_primary_account_id_with_conn(&transaction, PROVIDER_CODEX)?;
            if current_primary_account_id
                .as_deref()
                .is_some_and(|primary_account_id| primary_account_id == account_id)
            {
                let primary_account_eligible = self.is_primary_account_route_eligible_with_conn(
                    &transaction,
                    account_id,
                    PROVIDER_CODEX,
                    now,
                )?;
                if !primary_account_eligible {
                    self.reconcile_primary_account_with_conn(&transaction, PROVIDER_CODEX, now)?;
                }
            }
        }

        transaction
            .commit()
            .map_err(|error| format!("Commit report_rate_limit transaction: {error}"))?;
        Ok(true)
    }

    pub(super) fn get_account_internal_with_conn(
        &self,
        conn: &Connection,
        account_id: &str,
    ) -> Option<OAuthAccountSummary> {
        conn.query_row(
            "SELECT account_id, provider, external_account_id, email, display_name, status, disabled_reason, metadata, created_at, updated_at
             FROM oauth_accounts
             WHERE account_id = ?1",
            [account_id],
            row_to_account,
        )
        .optional()
        .ok()
        .flatten()
    }

    pub(super) fn get_pool_internal_with_conn(
        &self,
        conn: &Connection,
        pool_id: &str,
    ) -> Option<OAuthPoolSummary> {
        conn.query_row(
            "SELECT pool_id, provider, name, strategy, sticky_mode, preferred_account_id, enabled, metadata, created_at, updated_at
             FROM oauth_pools
             WHERE pool_id = ?1",
            [pool_id],
            row_to_pool,
        )
        .optional()
        .ok()
        .flatten()
    }

    pub(super) fn list_pool_members_with_conn(
        &self,
        conn: &Connection,
        pool_id: &str,
    ) -> OAuthResult<Vec<OAuthPoolMember>> {
        let mut statement = conn
            .prepare(
                "SELECT pool_id, account_id, weight, priority, position, enabled, created_at, updated_at
                 FROM oauth_pool_members
                 WHERE pool_id = ?1
                 ORDER BY priority ASC, position ASC, created_at ASC",
            )
            .map_err(|error| format!("Prepare list_pool_members_with_conn: {error}"))?;
        let rows = statement
            .query_map([pool_id], row_to_pool_member)
            .map_err(|error| format!("Query list_pool_members_with_conn: {error}"))?;
        let mut members = Vec::new();
        for row in rows {
            members.push(
                row.map_err(|error| format!("Read list_pool_members_with_conn row: {error}"))?,
            );
        }
        Ok(members)
    }
}

fn oauth_account_supports_chatgpt_workspace(
    account: &OAuthAccountSummary,
    workspace_scope: Option<&str>,
) -> bool {
    let Some(workspace_scope) = workspace_scope else {
        return true;
    };
    if account
        .default_chatgpt_workspace_id
        .as_deref()
        .is_some_and(|workspace_id| workspace_id == workspace_scope)
    {
        return true;
    }
    account
        .chatgpt_workspaces
        .as_ref()
        .is_some_and(|workspaces| {
            workspaces
                .iter()
                .any(|workspace| workspace.workspace_id == workspace_scope)
        })
}
