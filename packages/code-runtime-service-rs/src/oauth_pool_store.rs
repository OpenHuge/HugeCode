#[path = "oauth_pool_store_selection.rs"]
mod selection;
include!("oauth_pool_store_primary.rs");

pub struct OAuthPoolStore {
    conn: Option<Mutex<Connection>>,
    round_robin_cursor: Mutex<HashMap<String, usize>>,
    secret_cipher: Option<AccountSecretCipher>,
    startup_failure: Option<String>,
}

#[derive(Clone)]
struct AccountSecretCipher {
    key: [u8; OAUTH_SECRET_KEY_LEN_BYTES],
}

impl AccountSecretCipher {
    fn from_base64(encoded: &str) -> OAuthResult<Self> {
        let decoded = STANDARD
            .decode(encoded.trim())
            .map_err(|error| format!("Invalid oauth secret key base64: {error}"))?;
        if decoded.len() != OAUTH_SECRET_KEY_LEN_BYTES {
            return Err(format!(
                "Invalid oauth secret key length: expected {OAUTH_SECRET_KEY_LEN_BYTES} bytes after base64 decode, got {} bytes.",
                decoded.len()
            ));
        }
        let mut key = [0_u8; OAUTH_SECRET_KEY_LEN_BYTES];
        key.copy_from_slice(decoded.as_slice());
        Ok(Self { key })
    }

    fn encrypt_api_key(&self, plaintext: &str) -> OAuthResult<String> {
        let cipher = Aes256GcmSiv::new_from_slice(&self.key)
            .map_err(|error| format!("Initialize oauth secret cipher: {error}"))?;
        let mut nonce = [0_u8; OAUTH_SECRET_NONCE_LEN_BYTES];
        rand::rng().fill(&mut nonce);
        let ciphertext = cipher
            .encrypt(Nonce::from_slice(&nonce), plaintext.as_bytes())
            .map_err(|error| format!("Encrypt oauth api key: {error}"))?;
        Ok(format!(
            "v1:{}:{}",
            STANDARD.encode(nonce),
            STANDARD.encode(ciphertext)
        ))
    }

    fn decrypt_api_key(&self, encoded_payload: &str) -> OAuthResult<String> {
        let mut parts = encoded_payload.splitn(3, ':');
        let version = parts.next().unwrap_or_default();
        let nonce_b64 = parts.next().unwrap_or_default();
        let ciphertext_b64 = parts.next().unwrap_or_default();
        if version != "v1" || nonce_b64.is_empty() || ciphertext_b64.is_empty() {
            return Err("Invalid encrypted oauth api key payload format.".to_string());
        }

        let nonce = STANDARD
            .decode(nonce_b64)
            .map_err(|error| format!("Decode oauth api key nonce: {error}"))?;
        if nonce.len() != OAUTH_SECRET_NONCE_LEN_BYTES {
            return Err("Invalid encrypted oauth api key nonce length.".to_string());
        }
        let ciphertext = STANDARD
            .decode(ciphertext_b64)
            .map_err(|error| format!("Decode oauth api key ciphertext: {error}"))?;

        let cipher = Aes256GcmSiv::new_from_slice(&self.key)
            .map_err(|error| format!("Initialize oauth secret cipher: {error}"))?;
        let plaintext = cipher
            .decrypt(Nonce::from_slice(nonce.as_slice()), ciphertext.as_slice())
            .map_err(|error| format!("Decrypt oauth api key: {error}"))?;
        String::from_utf8(plaintext).map_err(|error| format!("Decode oauth api key UTF-8: {error}"))
    }
}

impl OAuthPoolStore {
    pub fn open(path: &str, oauth_secret_key: Option<&str>) -> OAuthResult<Self> {
        let secret_cipher = oauth_secret_key
            .map(AccountSecretCipher::from_base64)
            .transpose()?;
        let connection = if path.trim() == ":memory:" {
            Connection::open_in_memory()
                .map_err(|error| format!("Open sqlite memory db: {error}"))?
        } else {
            Connection::open(path).map_err(|error| format!("Open sqlite db `{path}`: {error}"))?
        };

        configure_connection(&connection)?;
        init_schema(&connection)?;
        migrate_legacy_session_bindings_schema(&connection)?;
        seed_default_pools(&connection)?;
        migrate_legacy_plaintext_api_keys(&connection, secret_cipher.as_ref())?;

        Ok(Self {
            conn: Some(Mutex::new(connection)),
            round_robin_cursor: Mutex::new(HashMap::new()),
            secret_cipher,
            startup_failure: None,
        })
    }

    pub fn unavailable(startup_failure: impl Into<String>) -> Self {
        Self {
            conn: None,
            round_robin_cursor: Mutex::new(HashMap::new()),
            secret_cipher: None,
            startup_failure: Some(startup_failure.into()),
        }
    }

    fn lock_conn<'a>(
        &'a self,
        operation: &str,
    ) -> OAuthResult<std::sync::MutexGuard<'a, Connection>> {
        let conn = self
            .conn
            .as_ref()
            .ok_or_else(|| self.unavailable_error(operation))?;
        conn.lock()
            .map_err(|_| format!("Lock oauth pool store for {operation}"))
    }

    fn unavailable_error(&self, operation: &str) -> String {
        let reason = self
            .startup_failure
            .as_deref()
            .unwrap_or("oauth pool backend is unavailable");
        format!("OAuth pool store unavailable for {operation}: {reason}")
    }

    pub fn resolve_api_key_from_metadata(&self, metadata: &Value) -> OAuthResult<Option<String>> {
        let object = metadata
            .as_object()
            .ok_or_else(|| "Account metadata must be an object.".to_string())?;
        if let Some(encrypted_payload) = object
            .get(OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
        {
            let cipher = self.secret_cipher.as_ref().ok_or_else(|| {
                "Encrypted OAuth account API keys are present but CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is not configured."
                    .to_string()
            })?;
            return cipher.decrypt_api_key(encrypted_payload).map(Some);
        }

        resolve_metadata_string_value(
            object,
            OAUTH_ACCOUNT_API_KEY_METADATA_CANDIDATES,
            false,
            "api key",
        )
    }

    pub fn resolve_refresh_token_from_metadata(
        &self,
        metadata: &Value,
    ) -> OAuthResult<Option<String>> {
        let object = metadata
            .as_object()
            .ok_or_else(|| "Account metadata must be an object.".to_string())?;
        if let Some(encrypted_payload) = object
            .get(OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
        {
            let cipher = self.secret_cipher.as_ref().ok_or_else(|| {
                "Encrypted OAuth account refresh tokens are present but CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is not configured."
                    .to_string()
            })?;
            return cipher.decrypt_api_key(encrypted_payload).map(Some);
        }

        resolve_metadata_string_value(
            object,
            OAUTH_ACCOUNT_REFRESH_TOKEN_METADATA_CANDIDATES,
            false,
            "refresh token",
        )
    }

    pub fn list_accounts(&self, provider: Option<&str>) -> OAuthResult<Vec<OAuthAccountSummary>> {
        let conn = self.lock_conn("list_accounts")?;
        let mut accounts = Vec::new();

        if let Some(provider) = provider.filter(|entry| !entry.trim().is_empty()) {
            let provider = normalize_provider(provider)?;
            let mut statement = conn
                .prepare(
                    "SELECT account_id, provider, external_account_id, email, display_name, status, disabled_reason, metadata, created_at, updated_at
                     FROM oauth_accounts
                     WHERE provider = ?1
                     ORDER BY created_at ASC",
                )
                .map_err(|error| format!("Prepare list_accounts(provider): {error}"))?;
            let rows = statement
                .query_map([provider], row_to_account)
                .map_err(|error| format!("Query list_accounts(provider): {error}"))?;
            for row in rows {
                accounts.push(row.map_err(|error| format!("Read account row: {error}"))?);
            }
        } else {
            let mut statement = conn
                .prepare(
                    "SELECT account_id, provider, external_account_id, email, display_name, status, disabled_reason, metadata, created_at, updated_at
                     FROM oauth_accounts
                     ORDER BY created_at ASC",
                )
                .map_err(|error| format!("Prepare list_accounts: {error}"))?;
            let rows = statement
                .query_map([], row_to_account)
                .map_err(|error| format!("Query list_accounts: {error}"))?;
            for row in rows {
                accounts.push(row.map_err(|error| format!("Read account row: {error}"))?);
            }
        }

        Ok(accounts)
    }

    pub fn upsert_account(
        &self,
        input: OAuthAccountUpsertInput,
    ) -> Result<OAuthAccountSummary, OAuthPoolMutationError> {
        let provider = normalize_provider(input.provider.as_str()).map_err(invalid_input_error)?;
        let account_id = sanitize_required(input.account_id.as_str(), "accountId")
            .map_err(invalid_input_error)?;
        let now = now_ms();
        let status =
            normalize_account_status(input.status.as_deref()).map_err(invalid_input_error)?;

        let mut conn = self
            .lock_conn("upsert_account")
            .map_err(OAuthPoolMutationError::internal)?;
        let transaction = conn.transaction().map_err(|error| {
            OAuthPoolMutationError::internal(format!("Begin upsert_account transaction: {error}"))
        })?;
        let existing_metadata: Value = transaction
            .query_row(
                "SELECT metadata FROM oauth_accounts WHERE account_id = ?1",
                [account_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| {
                OAuthPoolMutationError::internal(format!(
                    "Read existing account metadata `{account_id}`: {error}"
                ))
            })?
            .map(parse_metadata)
            .unwrap_or_else(|| json!({}));
        let metadata = merge_account_metadata(
            existing_metadata,
            input.metadata,
            self.secret_cipher.as_ref(),
        )?;
        transaction
            .execute(
            "INSERT INTO oauth_accounts (
                account_id, provider, external_account_id, email, display_name, status, disabled_reason, metadata, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(account_id) DO UPDATE SET
                provider = excluded.provider,
                external_account_id = excluded.external_account_id,
                email = excluded.email,
                display_name = excluded.display_name,
                status = excluded.status,
                disabled_reason = excluded.disabled_reason,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at",
            params![
                account_id,
                provider,
                sanitize_optional(input.external_account_id.as_deref()),
                sanitize_optional(input.email.as_deref()),
                sanitize_optional(input.display_name.as_deref()),
                status,
                sanitize_optional(input.disabled_reason.as_deref()),
                metadata.to_string(),
                now,
                now
            ],
        )
            .map_err(|error| OAuthPoolMutationError::internal(format!(
                "Upsert oauth account `{account_id}`: {error}"
            )))?;

        sync_default_pool_member_with_conn(
            &transaction,
            account_id,
            provider.as_str(),
            status.as_str(),
            now,
        )
        .map_err(OAuthPoolMutationError::internal)?;
        transaction
            .execute(
                "DELETE FROM oauth_pool_members
                 WHERE account_id = ?1
                   AND pool_id IN (
                     SELECT pool_id FROM oauth_pools WHERE provider <> ?2
                   )",
                params![account_id, provider.as_str()],
            )
            .map_err(|error| {
                OAuthPoolMutationError::internal(format!(
                    "Delete cross-provider pool members for `{account_id}`: {error}"
                ))
            })?;
        transaction
            .execute(
                "DELETE FROM oauth_session_bindings
                 WHERE account_id = ?1
                   AND pool_id IN (
                     SELECT pool_id FROM oauth_pools WHERE provider <> ?2
                   )",
                params![account_id, provider.as_str()],
            )
            .map_err(|error| {
                OAuthPoolMutationError::internal(format!(
                    "Delete cross-provider session bindings for `{account_id}`: {error}"
                ))
            })?;
        transaction
            .execute(
                "DELETE FROM oauth_manual_session_bindings
                 WHERE account_id = ?1
                   AND pool_id IN (
                     SELECT pool_id FROM oauth_pools WHERE provider <> ?2
                   )",
                params![account_id, provider.as_str()],
            )
            .map_err(|error| {
                OAuthPoolMutationError::internal(format!(
                    "Delete cross-provider manual session bindings for `{account_id}`: {error}"
                ))
            })?;
        if provider == PROVIDER_CODEX {
            let current_primary_account_id = self
                .read_primary_account_id_with_conn(&transaction, provider.as_str())
                .map_err(OAuthPoolMutationError::internal)?;
            if current_primary_account_id
                .as_deref()
                .is_some_and(|primary_account_id| primary_account_id == account_id)
            {
                let primary_account_eligible = self
                    .is_primary_account_route_eligible_with_conn(
                        &transaction,
                        account_id,
                        provider.as_str(),
                        now,
                    )
                    .map_err(OAuthPoolMutationError::internal)?;
                if !primary_account_eligible {
                    self.reconcile_primary_account_with_conn(&transaction, provider.as_str(), now)
                        .map_err(OAuthPoolMutationError::internal)?;
                }
            }
        }
        transaction.commit().map_err(|error| {
            OAuthPoolMutationError::internal(format!("Commit upsert_account transaction: {error}"))
        })?;

        self.get_account_internal_with_conn(&conn, account_id)
            .ok_or_else(|| format!("Upserted account `{account_id}` is not readable"))
            .map_err(Into::into)
    }

    pub fn remove_account(&self, account_id: &str) -> OAuthResult<bool> {
        let account_id = sanitize_required(account_id, "accountId")?;
        let now = now_ms();
        let mut conn = self.lock_conn("remove_account")?;
        let transaction = conn
            .transaction()
            .map_err(|error| format!("Begin remove_account transaction: {error}"))?;
        let removed_provider: Option<String> = transaction
            .query_row(
                "SELECT provider FROM oauth_accounts WHERE account_id = ?1",
                [account_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| format!("Resolve account provider for `{account_id}`: {error}"))?;
        transaction
            .execute(
                "DELETE FROM oauth_pool_members WHERE account_id = ?1",
                [account_id],
            )
            .map_err(|error| format!("Delete pool members for account `{account_id}`: {error}"))?;
        transaction
            .execute(
                "DELETE FROM oauth_session_bindings WHERE account_id = ?1",
                [account_id],
            )
            .map_err(|error| {
                format!("Delete session bindings for account `{account_id}`: {error}")
            })?;
        transaction
            .execute(
                "DELETE FROM oauth_manual_session_bindings WHERE account_id = ?1",
                [account_id],
            )
            .map_err(|error| {
                format!("Delete manual session bindings for account `{account_id}`: {error}")
            })?;
        transaction
            .execute(
                "DELETE FROM oauth_rate_limits WHERE account_id = ?1",
                [account_id],
            )
            .map_err(|error| format!("Delete rate limits for account `{account_id}`: {error}"))?;
        let removed = transaction
            .execute(
                "DELETE FROM oauth_accounts WHERE account_id = ?1",
                [account_id],
            )
            .map_err(|error| format!("Delete account `{account_id}`: {error}"))?
            > 0;
        if removed && removed_provider.as_deref() == Some(PROVIDER_CODEX) {
            self.reconcile_primary_account_with_conn(&transaction, PROVIDER_CODEX, now)?;
        }
        transaction
            .commit()
            .map_err(|error| format!("Commit remove_account transaction: {error}"))?;
        Ok(removed)
    }

    pub fn list_pools(&self, provider: Option<&str>) -> OAuthResult<Vec<OAuthPoolSummary>> {
        let conn = self.lock_conn("list_pools")?;
        let mut pools = Vec::new();

        if let Some(provider) = provider.filter(|entry| !entry.trim().is_empty()) {
            let provider = normalize_provider(provider)?;
            let mut statement = conn
                .prepare(
                    "SELECT pool_id, provider, name, strategy, sticky_mode, preferred_account_id, enabled, metadata, created_at, updated_at
                     FROM oauth_pools
                     WHERE provider = ?1
                     ORDER BY created_at ASC",
                )
                .map_err(|error| format!("Prepare list_pools(provider): {error}"))?;
            let rows = statement
                .query_map([provider], row_to_pool)
                .map_err(|error| format!("Query list_pools(provider): {error}"))?;
            for row in rows {
                pools.push(row.map_err(|error| format!("Read pool row: {error}"))?);
            }
        } else {
            let mut statement = conn
                .prepare(
                    "SELECT pool_id, provider, name, strategy, sticky_mode, preferred_account_id, enabled, metadata, created_at, updated_at
                     FROM oauth_pools
                     ORDER BY created_at ASC",
                )
                .map_err(|error| format!("Prepare list_pools: {error}"))?;
            let rows = statement
                .query_map([], row_to_pool)
                .map_err(|error| format!("Query list_pools: {error}"))?;
            for row in rows {
                pools.push(row.map_err(|error| format!("Read pool row: {error}"))?);
            }
        }

        Ok(pools)
    }

    pub fn upsert_pool(
        &self,
        input: OAuthPoolUpsertInput,
    ) -> Result<OAuthPoolSummary, OAuthPoolMutationError> {
        let provider = normalize_provider(input.provider.as_str()).map_err(invalid_input_error)?;
        let pool_id =
            sanitize_required(input.pool_id.as_str(), "poolId").map_err(invalid_input_error)?;
        let name = sanitize_required(input.name.as_str(), "name").map_err(invalid_input_error)?;
        let now = now_ms();
        let strategy =
            normalize_strategy(input.strategy.as_deref()).map_err(invalid_input_error)?;
        let sticky_mode =
            normalize_sticky_mode(input.sticky_mode.as_deref()).map_err(invalid_input_error)?;
        let metadata = normalize_metadata(input.metadata);
        let enabled = input.enabled.unwrap_or(true);
        let preferred_account_id = sanitize_optional(input.preferred_account_id.as_deref());

        let conn = self
            .lock_conn("upsert_pool")
            .map_err(OAuthPoolMutationError::internal)?;
        if let Some(account_id) = preferred_account_id.as_deref() {
            let account_provider: Option<String> = conn
                .query_row(
                    "SELECT provider FROM oauth_accounts WHERE account_id = ?1",
                    [account_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| {
                    format!("Resolve provider for preferred account `{account_id}`: {error}")
                })?;
            let Some(account_provider) = account_provider else {
                return Err(invalid_input_error(format!(
                    "Preferred account `{account_id}` does not exist"
                )));
            };
            if account_provider != provider {
                return Err(invalid_input_error(format!(
                    "Preferred account `{account_id}` provider `{account_provider}` does not match pool provider `{provider}`"
                )));
            }
        }
        conn.execute(
            "INSERT INTO oauth_pools (
                pool_id, provider, name, strategy, sticky_mode, preferred_account_id, enabled, metadata, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(pool_id) DO UPDATE SET
                provider = excluded.provider,
                name = excluded.name,
                strategy = excluded.strategy,
                sticky_mode = excluded.sticky_mode,
                preferred_account_id = excluded.preferred_account_id,
                enabled = excluded.enabled,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at",
            params![
                pool_id,
                provider,
                name,
                strategy,
                sticky_mode,
                preferred_account_id,
                if enabled { 1 } else { 0 },
                metadata.to_string(),
                now,
                now
            ],
        )
        .map_err(|error| format!("Upsert oauth pool `{pool_id}`: {error}"))?;

        self.get_pool_internal_with_conn(&conn, pool_id)
            .ok_or_else(|| format!("Upserted pool `{pool_id}` is not readable"))
            .map_err(Into::into)
    }

    pub fn apply_pool(
        &self,
        input: OAuthPoolApplyInput,
    ) -> Result<OAuthPoolApplyResult, OAuthPoolMutationError> {
        let pool = input.pool;
        let members = input.members;
        let provider = normalize_provider(pool.provider.as_str()).map_err(invalid_input_error)?;
        let pool_id =
            sanitize_required(pool.pool_id.as_str(), "poolId").map_err(invalid_input_error)?;
        let name = sanitize_required(pool.name.as_str(), "name").map_err(invalid_input_error)?;
        let now = now_ms();
        let strategy = normalize_strategy(pool.strategy.as_deref()).map_err(invalid_input_error)?;
        let sticky_mode =
            normalize_sticky_mode(pool.sticky_mode.as_deref()).map_err(invalid_input_error)?;
        let metadata = normalize_metadata(pool.metadata);
        let enabled = pool.enabled.unwrap_or(true);
        let preferred_account_id = sanitize_optional(pool.preferred_account_id.as_deref());

        let mut conn = self
            .lock_conn("apply_pool")
            .map_err(OAuthPoolMutationError::internal)?;
        let current_pool = self.get_pool_internal_with_conn(&conn, pool_id);
        if let Some(expected_updated_at) = input.expected_updated_at {
            let current_updated_at = current_pool.as_ref().map(|entry| entry.updated_at);
            if current_updated_at != Some(expected_updated_at) {
                let current_label = current_updated_at
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "null".to_string());
                return Err(invalid_input_error(format!(
                    "POOL_VERSION_MISMATCH: expectedUpdatedAt `{expected_updated_at}` does not match current `{current_label}` for pool `{pool_id}`"
                )));
            }
        }

        let transaction = conn
            .transaction()
            .map_err(|error| format!("Begin apply_pool transaction: {error}"))?;

        if let Some(account_id) = preferred_account_id.as_deref() {
            let account_provider: Option<String> = transaction
                .query_row(
                    "SELECT provider FROM oauth_accounts WHERE account_id = ?1",
                    [account_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| {
                    format!("Resolve provider for preferred account `{account_id}`: {error}")
                })?;
            let Some(account_provider) = account_provider else {
                return Err(invalid_input_error(format!(
                    "Preferred account `{account_id}` does not exist"
                )));
            };
            if account_provider != provider {
                return Err(invalid_input_error(format!(
                    "Preferred account `{account_id}` provider `{account_provider}` does not match pool provider `{provider}`"
                )));
            }
        }

        transaction
            .execute(
                "INSERT INTO oauth_pools (
                pool_id, provider, name, strategy, sticky_mode, preferred_account_id, enabled, metadata, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(pool_id) DO UPDATE SET
                provider = excluded.provider,
                name = excluded.name,
                strategy = excluded.strategy,
                sticky_mode = excluded.sticky_mode,
                preferred_account_id = excluded.preferred_account_id,
                enabled = excluded.enabled,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at",
                params![
                    pool_id,
                    provider,
                    name,
                    strategy,
                    sticky_mode,
                    preferred_account_id,
                    if enabled { 1 } else { 0 },
                    metadata.to_string(),
                    now,
                    now
                ],
            )
            .map_err(|error| format!("Upsert oauth pool `{pool_id}` during apply: {error}"))?;

        transaction
            .execute(
                "DELETE FROM oauth_pool_members WHERE pool_id = ?1",
                [pool_id],
            )
            .map_err(|error| format!("Clear pool members for `{pool_id}`: {error}"))?;

        for (index, member) in members.iter().enumerate() {
            let account_id = sanitize_required(member.account_id.as_str(), "accountId")
                .map_err(invalid_input_error)?;
            let account_provider: Option<String> = transaction
                .query_row(
                    "SELECT provider FROM oauth_accounts WHERE account_id = ?1",
                    [account_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| format!("Resolve provider for account `{account_id}`: {error}"))?;
            let Some(account_provider) = account_provider else {
                return Err(invalid_input_error(format!(
                    "Pool member account `{account_id}` does not exist"
                )));
            };
            if account_provider != provider {
                return Err(invalid_input_error(format!(
                    "Pool member account `{account_id}` provider `{account_provider}` does not match pool provider `{provider}`"
                )));
            }

            let weight = member.weight.unwrap_or(1);
            if !(1..=20).contains(&weight) {
                return Err(invalid_input_error(format!(
                    "Pool member `{account_id}` weight `{weight}` must be between 1 and 20"
                )));
            }
            let priority = member.priority.unwrap_or(index as i32);
            if priority < 0 {
                return Err(invalid_input_error(format!(
                    "Pool member `{account_id}` priority `{priority}` must be greater than or equal to 0"
                )));
            }
            let position = member.position.unwrap_or(index as i32);
            if position < 0 {
                return Err(invalid_input_error(format!(
                    "Pool member `{account_id}` position `{position}` must be greater than or equal to 0"
                )));
            }
            let enabled = member.enabled.unwrap_or(true);

            transaction
                .execute(
                    "INSERT INTO oauth_pool_members (
                        pool_id, account_id, weight, priority, position, enabled, created_at, updated_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        pool_id,
                        account_id,
                        weight,
                        priority,
                        position,
                        if enabled { 1 } else { 0 },
                        now,
                        now
                    ],
                )
                .map_err(|error| format!("Insert pool member `{account_id}`: {error}"))?;
        }

        transaction
            .commit()
            .map_err(|error| format!("Commit apply_pool transaction: {error}"))?;

        let applied_pool = self
            .get_pool_internal_with_conn(&conn, pool_id)
            .ok_or_else(|| format!("Applied pool `{pool_id}` is not readable"))?;
        let applied_members = self
            .list_pool_members_with_conn(&conn, pool_id)
            .map_err(OAuthPoolMutationError::internal)?;
        Ok(OAuthPoolApplyResult {
            pool: applied_pool,
            members: applied_members,
        })
    }

    pub fn remove_pool(&self, pool_id: &str) -> OAuthResult<bool> {
        let pool_id = sanitize_required(pool_id, "poolId")?;
        let mut conn = self.lock_conn("remove_pool")?;
        let transaction = conn
            .transaction()
            .map_err(|error| format!("Begin remove_pool transaction: {error}"))?;
        transaction
            .execute(
                "DELETE FROM oauth_pool_members WHERE pool_id = ?1",
                [pool_id],
            )
            .map_err(|error| format!("Delete pool members for pool `{pool_id}`: {error}"))?;
        transaction
            .execute(
                "DELETE FROM oauth_session_bindings WHERE pool_id = ?1",
                [pool_id],
            )
            .map_err(|error| format!("Delete session bindings for pool `{pool_id}`: {error}"))?;
        transaction
            .execute(
                "DELETE FROM oauth_manual_session_bindings WHERE pool_id = ?1",
                [pool_id],
            )
            .map_err(|error| {
                format!("Delete manual session bindings for pool `{pool_id}`: {error}")
            })?;
        let removed = transaction
            .execute("DELETE FROM oauth_pools WHERE pool_id = ?1", [pool_id])
            .map_err(|error| format!("Delete pool `{pool_id}`: {error}"))?
            > 0;
        transaction
            .commit()
            .map_err(|error| format!("Commit remove_pool transaction: {error}"))?;
        if removed {
            self.remove_round_robin_cursor_entry(pool_id);
        }
        Ok(removed)
    }

    pub fn list_pool_members(&self, pool_id: &str) -> OAuthResult<Vec<OAuthPoolMember>> {
        let pool_id = sanitize_required(pool_id, "poolId")?;
        let conn = self.lock_conn("list_pool_members")?;
        let mut statement = conn
            .prepare(
                "SELECT pool_id, account_id, weight, priority, position, enabled, created_at, updated_at
                 FROM oauth_pool_members
                 WHERE pool_id = ?1
                 ORDER BY priority ASC, position ASC, created_at ASC",
            )
            .map_err(|error| format!("Prepare list_pool_members: {error}"))?;
        let rows = statement
            .query_map([pool_id], row_to_pool_member)
            .map_err(|error| format!("Query list_pool_members: {error}"))?;
        let mut members = Vec::new();
        for row in rows {
            members.push(row.map_err(|error| format!("Read pool member row: {error}"))?);
        }
        Ok(members)
    }

    pub fn replace_pool_members(
        &self,
        pool_id: &str,
        members: &[OAuthPoolMemberInput],
    ) -> Result<Vec<OAuthPoolMember>, OAuthPoolMutationError> {
        let pool_id = sanitize_required(pool_id, "poolId").map_err(invalid_input_error)?;
        let mut conn = self
            .lock_conn("replace_pool_members")
            .map_err(OAuthPoolMutationError::internal)?;

        let pool = self
            .get_pool_internal_with_conn(&conn, pool_id)
            .ok_or_else(|| invalid_input_error(format!("Pool `{pool_id}` does not exist")))?;

        let transaction = conn
            .transaction()
            .map_err(|error| format!("Begin replace_pool_members transaction: {error}"))?;
        transaction
            .execute(
                "DELETE FROM oauth_pool_members WHERE pool_id = ?1",
                [pool_id],
            )
            .map_err(|error| format!("Clear pool members for `{pool_id}`: {error}"))?;

        let now = now_ms();
        for (index, member) in members.iter().enumerate() {
            let account_id = sanitize_required(member.account_id.as_str(), "accountId")
                .map_err(invalid_input_error)?;
            let account_provider: Option<String> = transaction
                .query_row(
                    "SELECT provider FROM oauth_accounts WHERE account_id = ?1",
                    [account_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| format!("Resolve provider for account `{account_id}`: {error}"))?;
            let Some(account_provider) = account_provider else {
                return Err(invalid_input_error(format!(
                    "Pool member account `{account_id}` does not exist"
                )));
            };
            if account_provider != pool.provider {
                return Err(invalid_input_error(format!(
                    "Pool member account `{account_id}` provider `{account_provider}` does not match pool provider `{}`",
                    pool.provider
                )));
            }

            let weight = member.weight.unwrap_or(1);
            if !(1..=20).contains(&weight) {
                return Err(invalid_input_error(format!(
                    "Pool member `{account_id}` weight `{weight}` must be between 1 and 20"
                )));
            }

            let priority = member.priority.unwrap_or(index as i32);
            if priority < 0 {
                return Err(invalid_input_error(format!(
                    "Pool member `{account_id}` priority `{priority}` must be greater than or equal to 0"
                )));
            }

            let position = member.position.unwrap_or(index as i32);
            if position < 0 {
                return Err(invalid_input_error(format!(
                    "Pool member `{account_id}` position `{position}` must be greater than or equal to 0"
                )));
            }
            let enabled = member.enabled.unwrap_or(true);

            transaction
                .execute(
                    "INSERT INTO oauth_pool_members (
                        pool_id, account_id, weight, priority, position, enabled, created_at, updated_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        pool_id,
                        account_id,
                        weight,
                        priority,
                        position,
                        if enabled { 1 } else { 0 },
                        now,
                        now
                    ],
                )
                .map_err(|error| format!("Insert pool member `{account_id}`: {error}"))?;
        }

        transaction
            .commit()
            .map_err(|error| format!("Commit replace_pool_members transaction: {error}"))?;

        self.list_pool_members_with_conn(&conn, pool_id)
            .map_err(Into::into)
    }
}

pub fn validate_oauth_secret_key(encoded: &str) -> OAuthResult<()> {
    let _ = AccountSecretCipher::from_base64(encoded)?;
    Ok(())
}
