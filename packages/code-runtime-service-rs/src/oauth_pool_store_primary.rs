impl OAuthPoolStore {
    pub fn get_primary_account(&self, provider: &str) -> OAuthResult<OAuthPrimaryAccountSummary> {
        let provider = normalize_provider(provider)?;
        let conn = self.lock_conn("get_primary_account")?;
        self.get_primary_account_with_conn(&conn, provider.as_str())
    }

    pub fn set_primary_account(
        &self,
        input: OAuthPrimaryAccountSetInput,
    ) -> Result<OAuthPrimaryAccountSummary, OAuthPoolMutationError> {
        let provider = normalize_provider(input.provider.as_str()).map_err(invalid_input_error)?;
        let account_id = sanitize_optional(input.account_id.as_deref());
        let now = now_ms();
        let mut conn = self
            .lock_conn("set_primary_account")
            .map_err(OAuthPoolMutationError::internal)?;
        let transaction = conn.transaction().map_err(|error| {
            OAuthPoolMutationError::internal(format!(
                "Begin set_primary_account transaction: {error}"
            ))
        })?;

        if let Some(account_id) = account_id.as_deref() {
            let Some(account) = self.get_account_internal_with_conn(&transaction, account_id)
            else {
                return Err(invalid_input_error(format!(
                    "Primary account `{account_id}` does not exist."
                )));
            };
            if account.provider != provider {
                return Err(invalid_input_error(format!(
                    "Primary account `{account_id}` provider `{}` does not match `{provider}`.",
                    account.provider
                )));
            }
            if account.status != STATUS_ENABLED {
                return Err(invalid_input_error(format!(
                    "Primary account `{account_id}` must be `{STATUS_ENABLED}`."
                )));
            }
            let route_eligible = self
                .is_primary_account_route_eligible_with_conn(
                    &transaction,
                    account_id,
                    provider.as_str(),
                    now,
                )
                .map_err(OAuthPoolMutationError::internal)?;
            if !route_eligible {
                return Err(invalid_input_error(format!(
                    "Primary account `{account_id}` is not route-eligible for provider `{provider}`."
                )));
            }
        }

        self.write_primary_account_projection_with_conn(
            &transaction,
            provider.as_str(),
            account_id.as_deref(),
            now,
        )
        .map_err(OAuthPoolMutationError::internal)?;

        let summary = self
            .get_primary_account_with_conn(&transaction, provider.as_str())
            .map_err(OAuthPoolMutationError::internal)?;
        transaction.commit().map_err(|error| {
            OAuthPoolMutationError::internal(format!(
                "Commit set_primary_account transaction: {error}"
            ))
        })?;
        Ok(summary)
    }

    pub fn reconcile_primary_account(
        &self,
        provider: &str,
    ) -> OAuthResult<OAuthPrimaryAccountSummary> {
        let provider = normalize_provider(provider)?;
        let now = now_ms();
        let mut conn = self.lock_conn("reconcile_primary_account")?;
        let transaction = conn
            .transaction()
            .map_err(|error| format!("Begin reconcile_primary_account transaction: {error}"))?;
        let summary =
            self.reconcile_primary_account_with_conn(&transaction, provider.as_str(), now)?;
        transaction
            .commit()
            .map_err(|error| format!("Commit reconcile_primary_account transaction: {error}"))?;
        Ok(summary)
    }

    pub(super) fn read_primary_account_id_with_conn(
        &self,
        conn: &Connection,
        provider: &str,
    ) -> OAuthResult<Option<String>> {
        conn.query_row(
            "SELECT account_id FROM oauth_primary_accounts WHERE provider = ?1",
            [provider],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map(|value| value.flatten())
        .map_err(|error| format!("Read primary account id for `{provider}`: {error}"))
    }

    pub(super) fn is_primary_account_route_eligible_with_conn(
        &self,
        conn: &Connection,
        account_id: &str,
        provider: &str,
        now: u64,
    ) -> OAuthResult<bool> {
        let Some(account) = self.get_account_internal_with_conn(conn, account_id) else {
            return Ok(false);
        };
        self.is_primary_account_summary_route_eligible_with_conn(conn, &account, provider, now)
    }

    pub(super) fn reconcile_primary_account_with_conn(
        &self,
        conn: &Connection,
        provider: &str,
        now: u64,
    ) -> OAuthResult<OAuthPrimaryAccountSummary> {
        let current_primary_account_id = self.read_primary_account_id_with_conn(conn, provider)?;
        let next_primary_account_id = match current_primary_account_id.as_deref() {
            Some(current_account_id)
                if self.is_primary_account_route_eligible_with_conn(
                    conn,
                    current_account_id,
                    provider,
                    now,
                )? =>
            {
                Some(current_account_id.to_string())
            }
            _ => self.select_reconcile_primary_candidate_with_conn(conn, provider, now)?,
        };

        self.write_primary_account_projection_with_conn(
            conn,
            provider,
            next_primary_account_id.as_deref(),
            now,
        )?;
        self.get_primary_account_with_conn(conn, provider)
    }

    fn get_primary_account_with_conn(
        &self,
        conn: &Connection,
        provider: &str,
    ) -> OAuthResult<OAuthPrimaryAccountSummary> {
        let default_pool_id = default_pool_id_for_primary_provider(provider);
        let primary_row: Option<(Option<String>, u64, u64)> = conn
            .query_row(
                "SELECT account_id, created_at, updated_at
                 FROM oauth_primary_accounts
                 WHERE provider = ?1",
                [provider],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(|error| format!("Read primary account row for `{provider}`: {error}"))?;
        let (account_id, created_at, updated_at) = primary_row.unwrap_or((None, 0, 0));

        let account = account_id
            .as_deref()
            .and_then(|entry| self.get_account_internal_with_conn(conn, entry))
            .filter(|entry| entry.provider == provider);
        let route_account_id: Option<String> = conn
            .query_row(
                "SELECT preferred_account_id
                 FROM oauth_pools
                 WHERE pool_id = ?1 AND provider = ?2",
                params![default_pool_id.as_str(), provider],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .map(|value| value.flatten())
            .map_err(|error| format!("Read default pool projection for `{provider}`: {error}"))?;
        let in_sync = account_id == route_account_id;

        Ok(OAuthPrimaryAccountSummary {
            provider: provider.to_string(),
            account_id,
            account,
            default_pool_id,
            route_account_id,
            in_sync,
            created_at,
            updated_at,
        })
    }

    fn write_primary_account_projection_with_conn(
        &self,
        conn: &Connection,
        provider: &str,
        account_id: Option<&str>,
        now: u64,
    ) -> OAuthResult<()> {
        let default_pool_id = default_pool_id_for_primary_provider(provider);
        self.ensure_default_pool_for_provider_with_conn(conn, provider, now)?;
        conn.execute(
            "INSERT INTO oauth_primary_accounts (
                provider, account_id, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(provider) DO UPDATE SET
                account_id = excluded.account_id,
                updated_at = excluded.updated_at",
            params![provider, account_id, now, now],
        )
        .map_err(|error| format!("Upsert primary account projection for `{provider}`: {error}"))?;
        conn.execute(
            "UPDATE oauth_pools
             SET preferred_account_id = ?3, updated_at = ?4
             WHERE pool_id = ?1 AND provider = ?2",
            params![default_pool_id, provider, account_id, now],
        )
        .map_err(|error| format!("Update default pool projection for `{provider}`: {error}"))?;
        Ok(())
    }

    fn ensure_default_pool_for_provider_with_conn(
        &self,
        conn: &Connection,
        provider: &str,
        now: u64,
    ) -> OAuthResult<()> {
        let default_pool_id = default_pool_id_for_primary_provider(provider);
        let pool_exists = conn
            .query_row(
                "SELECT 1 FROM oauth_pools WHERE pool_id = ?1 AND provider = ?2",
                params![default_pool_id.as_str(), provider],
                |_| Ok(()),
            )
            .optional()
            .map_err(|error| format!("Check default pool `{default_pool_id}` existence: {error}"))?
            .is_some();
        if !pool_exists {
            let pool_name = default_pool_name_for_provider(provider);
            conn.execute(
                "INSERT INTO oauth_pools (
                    pool_id, provider, name, strategy, sticky_mode, preferred_account_id, enabled, metadata, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, 1, ?6, ?7, ?8)",
                params![
                    default_pool_id.as_str(),
                    provider,
                    pool_name,
                    STRATEGY_P2C,
                    STICKY_CACHE_FIRST,
                    "{}",
                    now,
                    now
                ],
            )
            .map_err(|error| format!("Recreate default pool `{default_pool_id}`: {error}"))?;

            let mut statement = conn
                .prepare(
                    "SELECT account_id, status
                     FROM oauth_accounts
                     WHERE provider = ?1
                     ORDER BY created_at ASC",
                )
                .map_err(|error| {
                    format!("Prepare default pool backfill for `{provider}`: {error}")
                })?;
            let rows = statement
                .query_map([provider], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map_err(|error| {
                    format!("Query default pool backfill for `{provider}`: {error}")
                })?;
            for row in rows {
                let (account_id, status) =
                    row.map_err(|error| format!("Read default pool backfill row: {error}"))?;
                sync_default_pool_member_with_conn(
                    conn,
                    account_id.as_str(),
                    provider,
                    status.as_str(),
                    now,
                )?;
            }
        }
        Ok(())
    }

    fn select_reconcile_primary_candidate_with_conn(
        &self,
        conn: &Connection,
        provider: &str,
        now: u64,
    ) -> OAuthResult<Option<String>> {
        let mut statement = conn
            .prepare(
                "SELECT account_id, provider, external_account_id, email, display_name, status, disabled_reason, metadata, created_at, updated_at
                 FROM oauth_accounts
                 WHERE provider = ?1",
            )
            .map_err(|error| format!("Prepare primary candidate query for `{provider}`: {error}"))?;
        let rows = statement
            .query_map([provider], row_to_account)
            .map_err(|error| format!("Query primary candidate rows for `{provider}`: {error}"))?;
        let mut candidates = Vec::new();
        for row in rows {
            let account = row.map_err(|error| format!("Read primary candidate row: {error}"))?;
            if self.is_primary_account_summary_route_eligible_with_conn(
                conn, &account, provider, now,
            )? {
                candidates.push(account);
            }
        }
        candidates.sort_by(|left, right| {
            primary_identity_score(right)
                .cmp(&primary_identity_score(left))
                .then_with(|| right.updated_at.cmp(&left.updated_at))
                .then_with(|| right.created_at.cmp(&left.created_at))
                .then_with(|| left.account_id.cmp(&right.account_id))
        });
        Ok(candidates
            .into_iter()
            .next()
            .map(|account| account.account_id))
    }

    fn is_primary_account_summary_route_eligible_with_conn(
        &self,
        conn: &Connection,
        account: &OAuthAccountSummary,
        provider: &str,
        now: u64,
    ) -> OAuthResult<bool> {
        if account.provider != provider || account.status != STATUS_ENABLED {
            return Ok(false);
        }
        if account
            .route_config
            .as_ref()
            .and_then(|config| config.schedulable)
            == Some(false)
        {
            return Ok(false);
        }
        if account
            .routing_state
            .as_ref()
            .and_then(|state| state.temp_unschedulable_until)
            .is_some_and(|until| until > now)
        {
            return Ok(false);
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
            return Ok(false);
        }
        if account
            .routing_state
            .as_ref()
            .and_then(|state| state.credential_ready)
            == Some(false)
        {
            return Ok(false);
        }
        let (is_limited, _) =
            resolve_rate_limit_state(conn, account.account_id.as_str(), None, now)?;
        if is_limited {
            return Ok(false);
        }

        let local_cli_profile_credential_available =
            has_local_codex_cli_profile_credential(&account.metadata);
        match self.resolve_api_key_from_metadata(&account.metadata) {
            Ok(Some(_)) => Ok(true),
            Ok(None) if local_cli_profile_credential_available => Ok(true),
            Ok(None) => Ok(false),
            Err(_) if local_cli_profile_credential_available => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

fn default_pool_id_for_primary_provider(provider: &str) -> String {
    default_pool_id_for_provider(provider)
        .unwrap_or(DEFAULT_POOL_CODEX)
        .to_string()
}

fn default_pool_name_for_provider(provider: &str) -> &'static str {
    match provider {
        PROVIDER_CODEX => "Codex Pool",
        PROVIDER_GEMINI => "Gemini Pool",
        PROVIDER_CLAUDE_CODE => "Claude Pool",
        _ => "OAuth Pool",
    }
}

fn primary_identity_score(account: &OAuthAccountSummary) -> i32 {
    let mut score = 0;
    if account
        .external_account_id
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        score += 4;
    }
    if account
        .email
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        score += 2;
    }
    if account
        .display_name
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        score += 1;
    }
    score
}
