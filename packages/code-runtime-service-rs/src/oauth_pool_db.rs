fn configure_connection(conn: &Connection) -> OAuthResult<()> {
    let _ = conn.pragma_update(None, "journal_mode", "WAL");
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|error| format!("Set sqlite busy_timeout: {error}"))?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| format!("Set sqlite synchronous pragma: {error}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| format!("Enable sqlite foreign keys pragma: {error}"))?;
    Ok(())
}

fn init_schema(conn: &Connection) -> OAuthResult<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS oauth_accounts (
            account_id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            external_account_id TEXT,
            email TEXT,
            display_name TEXT,
            status TEXT NOT NULL,
            disabled_reason TEXT,
            metadata TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_status
            ON oauth_accounts(provider, status);

        CREATE TABLE IF NOT EXISTS oauth_primary_accounts (
            provider TEXT PRIMARY KEY,
            account_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS oauth_pools (
            pool_id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            name TEXT NOT NULL,
            strategy TEXT NOT NULL,
            sticky_mode TEXT NOT NULL,
            preferred_account_id TEXT,
            enabled INTEGER NOT NULL,
            metadata TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_pools_provider_enabled
            ON oauth_pools(provider, enabled);

        CREATE TABLE IF NOT EXISTS oauth_pool_members (
            pool_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            weight INTEGER NOT NULL,
            priority INTEGER NOT NULL,
            position INTEGER NOT NULL,
            enabled INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (pool_id, account_id),
            FOREIGN KEY (pool_id) REFERENCES oauth_pools(pool_id),
            FOREIGN KEY (account_id) REFERENCES oauth_accounts(account_id)
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_pool_members_pool
            ON oauth_pool_members(pool_id, enabled, priority, position);

        CREATE TABLE IF NOT EXISTS oauth_session_bindings (
            session_id TEXT NOT NULL,
            pool_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL DEFAULT '',
            account_id TEXT NOT NULL,
            bound_at INTEGER NOT NULL,
            expires_at INTEGER,
            PRIMARY KEY (session_id, pool_id, workspace_id)
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_session_bindings_expires_at
            ON oauth_session_bindings(expires_at);

        CREATE TABLE IF NOT EXISTS oauth_manual_session_bindings (
            session_id TEXT NOT NULL,
            pool_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL DEFAULT '',
            account_id TEXT NOT NULL,
            bound_at INTEGER NOT NULL,
            PRIMARY KEY (session_id, pool_id, workspace_id)
        );

        CREATE TABLE IF NOT EXISTS oauth_rate_limits (
            account_id TEXT NOT NULL,
            scope_model TEXT NOT NULL,
            reset_at INTEGER,
            failure_count INTEGER NOT NULL,
            last_error TEXT,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (account_id, scope_model)
        );
        ",
    )
    .map_err(|error| format!("Initialize sqlite oauth schema: {error}"))
}

fn migrate_legacy_session_bindings_schema(conn: &Connection) -> OAuthResult<()> {
    let mut statement = conn
        .prepare("PRAGMA table_info(oauth_session_bindings)")
        .map_err(|error| format!("Prepare oauth session bindings schema probe: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            let column_name: String = row.get(1)?;
            let pk_position: i32 = row.get(5)?;
            Ok((column_name, pk_position))
        })
        .map_err(|error| format!("Query oauth session bindings schema probe: {error}"))?;

    let mut column_names = Vec::new();
    let mut primary_key_columns = Vec::new();
    for row in rows {
        let (column_name, pk_position) =
            row.map_err(|error| format!("Read oauth session bindings schema probe row: {error}"))?;
        column_names.push(column_name.clone());
        if pk_position > 0 {
            primary_key_columns.push((pk_position, column_name));
        }
    }

    if column_names.is_empty() {
        return Ok(());
    }

    primary_key_columns.sort_by_key(|(pk_position, _)| *pk_position);
    let primary_key_column_names = primary_key_columns
        .into_iter()
        .map(|(_, column_name)| column_name)
        .collect::<Vec<_>>();

    if column_names
        .iter()
        .any(|column_name| column_name == "workspace_id")
        && primary_key_column_names
            == vec![
                "session_id".to_string(),
                "pool_id".to_string(),
                "workspace_id".to_string(),
            ]
    {
        return Ok(());
    }

    conn.execute_batch(
        "
        DROP INDEX IF EXISTS idx_oauth_session_bindings_expires_at;
        CREATE TABLE oauth_session_bindings_next (
            session_id TEXT NOT NULL,
            pool_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL DEFAULT '',
            account_id TEXT NOT NULL,
            bound_at INTEGER NOT NULL,
            expires_at INTEGER,
            PRIMARY KEY (session_id, pool_id, workspace_id)
        );
        INSERT OR REPLACE INTO oauth_session_bindings_next (
            session_id, pool_id, workspace_id, account_id, bound_at, expires_at
        )
        SELECT
            session_id,
            pool_id,
            '',
            account_id,
            bound_at,
            expires_at
        FROM oauth_session_bindings;
        DROP TABLE oauth_session_bindings;
        ALTER TABLE oauth_session_bindings_next RENAME TO oauth_session_bindings;
        CREATE INDEX IF NOT EXISTS idx_oauth_session_bindings_expires_at
            ON oauth_session_bindings(expires_at);
        ",
    )
    .map_err(|error| format!("Migrate oauth session bindings schema: {error}"))?;

    Ok(())
}

fn query_count<P>(conn: &Connection, sql: &str, params: P) -> OAuthResult<u64>
where
    P: rusqlite::Params,
{
    let value: i64 = conn
        .query_row(sql, params, |row| row.get(0))
        .map_err(|error| format!("Execute count query `{sql}`: {error}"))?;
    Ok(value.max(0) as u64)
}

fn default_pool_id_for_provider(provider: &str) -> Option<&'static str> {
    match provider {
        PROVIDER_CODEX => Some(DEFAULT_POOL_CODEX),
        PROVIDER_GEMINI => Some(DEFAULT_POOL_GEMINI),
        PROVIDER_CLAUDE_CODE => Some(DEFAULT_POOL_CLAUDE),
        _ => None,
    }
}

fn sync_default_pool_member_with_conn(
    conn: &Connection,
    account_id: &str,
    provider: &str,
    status: &str,
    now: u64,
) -> OAuthResult<()> {
    let Some(default_pool_id) = default_pool_id_for_provider(provider) else {
        return Ok(());
    };
    let pool_exists: Option<String> = conn
        .query_row(
            "SELECT pool_id FROM oauth_pools WHERE pool_id = ?1 AND provider = ?2",
            params![default_pool_id, provider],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Resolve default pool `{default_pool_id}`: {error}"))?;
    if pool_exists.is_none() {
        return Ok(());
    }

    let next_position: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1
             FROM oauth_pool_members
             WHERE pool_id = ?1",
            [default_pool_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Resolve next default pool member position: {error}"))?;
    let member_enabled = if status == STATUS_ENABLED { 1 } else { 0 };

    conn.execute(
        "INSERT INTO oauth_pool_members (
            pool_id, account_id, weight, priority, position, enabled, created_at, updated_at
         ) VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?6)
         ON CONFLICT(pool_id, account_id) DO UPDATE SET
            enabled = excluded.enabled,
            updated_at = excluded.updated_at",
        params![
            default_pool_id,
            account_id,
            next_position,
            next_position,
            member_enabled,
            now
        ],
    )
    .map_err(|error| {
        format!("Upsert default pool member `{account_id}` for pool `{default_pool_id}`: {error}")
    })?;

    Ok(())
}

fn seed_default_pools(conn: &Connection) -> OAuthResult<()> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM oauth_pools", [], |row| row.get(0))
        .map_err(|error| format!("Count oauth pools: {error}"))?;
    if count > 0 {
        return Ok(());
    }

    let now = now_ms();
    let defaults = [
        (DEFAULT_POOL_CODEX, PROVIDER_CODEX, "Codex Pool"),
        (DEFAULT_POOL_GEMINI, PROVIDER_GEMINI, "Gemini Pool"),
        (DEFAULT_POOL_CLAUDE, PROVIDER_CLAUDE_CODE, "Claude Pool"),
    ];
    for (pool_id, provider, name) in defaults {
        conn.execute(
            "INSERT INTO oauth_pools (
                pool_id, provider, name, strategy, sticky_mode, preferred_account_id, enabled, metadata, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, 1, ?6, ?7, ?8)",
            params![
                pool_id,
                provider,
                name,
                STRATEGY_P2C,
                STICKY_CACHE_FIRST,
                "{}",
                now,
                now
            ],
        )
        .map_err(|error| format!("Seed default pool `{pool_id}`: {error}"))?;
    }
    Ok(())
}

fn migrate_legacy_plaintext_api_keys(
    conn: &Connection,
    cipher: Option<&AccountSecretCipher>,
) -> OAuthResult<()> {
    let mut statement = conn
        .prepare("SELECT account_id, metadata FROM oauth_accounts")
        .map_err(|error| format!("Prepare oauth account metadata migration query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            let account_id: String = row.get(0)?;
            let metadata_raw: String = row.get(1)?;
            Ok((account_id, metadata_raw))
        })
        .map_err(|error| format!("Query oauth account metadata migration rows: {error}"))?;

    let mut updates: Vec<(String, Value)> = Vec::new();
    for row in rows {
        let (account_id, metadata_raw) =
            row.map_err(|error| format!("Read oauth account metadata migration row: {error}"))?;
        let existing = parse_metadata(metadata_raw);
        let merged = merge_account_metadata(existing.clone(), None, cipher)
            .map_err(|error| format!("Migrate account `{account_id}` metadata: {error}"))?;
        if merged != existing {
            updates.push((account_id, merged));
        }
    }

    if updates.is_empty() {
        return Ok(());
    }

    let now = now_ms();
    for (account_id, metadata) in updates {
        conn.execute(
            "UPDATE oauth_accounts SET metadata = ?2, updated_at = ?3 WHERE account_id = ?1",
            params![account_id, metadata.to_string(), now],
        )
        .map_err(|error| {
            format!("Persist migrated metadata for account `{account_id}`: {error}")
        })?;
    }

    Ok(())
}

fn row_to_account(row: &Row<'_>) -> rusqlite::Result<OAuthAccountSummary> {
    let metadata_raw: String = row.get(7)?;
    let metadata = parse_metadata(metadata_raw);
    let (chatgpt_workspaces, default_chatgpt_workspace_id) =
        oauth_account_chatgpt_workspaces_from_metadata_value(&metadata)
            .map(|(workspaces, default_workspace_id)| (Some(workspaces), default_workspace_id))
            .unwrap_or((None, None));
    Ok(OAuthAccountSummary {
        account_id: row.get(0)?,
        provider: row.get(1)?,
        external_account_id: row.get(2)?,
        email: row.get(3)?,
        display_name: row.get(4)?,
        status: row.get(5)?,
        disabled_reason: row.get(6)?,
        route_config: oauth_account_route_config_from_metadata_value(&metadata),
        routing_state: oauth_account_routing_state_from_metadata_value(&metadata),
        chatgpt_workspaces,
        default_chatgpt_workspace_id,
        metadata,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn row_to_pool(row: &Row<'_>) -> rusqlite::Result<OAuthPoolSummary> {
    let metadata_raw: String = row.get(7)?;
    let enabled: i64 = row.get(6)?;
    Ok(OAuthPoolSummary {
        pool_id: row.get(0)?,
        provider: row.get(1)?,
        name: row.get(2)?,
        strategy: row.get(3)?,
        sticky_mode: row.get(4)?,
        preferred_account_id: row.get(5)?,
        enabled: enabled > 0,
        metadata: parse_metadata(metadata_raw),
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn row_to_pool_member(row: &Row<'_>) -> rusqlite::Result<OAuthPoolMember> {
    let enabled: i64 = row.get(5)?;
    Ok(OAuthPoolMember {
        pool_id: row.get(0)?,
        account_id: row.get(1)?,
        weight: row.get(2)?,
        priority: row.get(3)?,
        position: row.get(4)?,
        enabled: enabled > 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn select_round_robin_candidate<'a>(
    candidates: &'a [SelectionCandidate],
    pool_id: &str,
    cursor_store: &Mutex<HashMap<String, usize>>,
    advance_cursor: bool,
) -> Option<&'a SelectionCandidate> {
    if candidates.is_empty() {
        return None;
    }

    let total_weight: usize = candidates
        .iter()
        .map(|candidate| candidate.member.weight.max(1).min(20) as usize)
        .sum();
    if total_weight == 0 {
        return None;
    }

    // Keep the mutex critical section as short as possible: only read/update
    // the per-pool cursor while holding the lock, then traverse candidates
    // outside the lock to reduce contention under concurrent selections.
    let next_offset = {
        let mut cursor = cursor_store.lock().ok()?;
        if advance_cursor {
            let entry = cursor.entry(pool_id.to_string()).or_insert(0);
            let current = *entry % total_weight;
            *entry = (current + 1) % total_weight;
            current
        } else {
            cursor.get(pool_id).copied().unwrap_or(0) % total_weight
        }
    };

    let mut traversed = 0_usize;
    for candidate in candidates {
        traversed = traversed.saturating_add(candidate.member.weight.max(1).min(20) as usize);
        if next_offset < traversed {
            return Some(candidate);
        }
    }

    candidates.last()
}

fn select_p2c_candidate(candidates: &[SelectionCandidate]) -> Option<&SelectionCandidate> {
    if candidates.is_empty() {
        return None;
    }
    if candidates.len() == 1 {
        return candidates.first();
    }

    let first_index = pick_weighted_candidate_index(candidates, None)?;
    let first = candidates.get(first_index)?;
    let second_index =
        pick_weighted_candidate_index(candidates, Some(first.account.account_id.as_str()))
            .unwrap_or(first_index);
    let second = candidates.get(second_index)?;

    let compare = compare_selection_candidate_rank(first, second);
    match compare {
        Ordering::Less | Ordering::Equal => Some(first),
        Ordering::Greater => Some(second),
    }
}

fn compare_selection_candidate_rank(
    first: &SelectionCandidate,
    second: &SelectionCandidate,
) -> Ordering {
    first
        .failure_penalty
        .cmp(&second.failure_penalty)
        .then_with(|| first.member.priority.cmp(&second.member.priority))
        .then_with(|| first.member.position.cmp(&second.member.position))
        .then_with(|| first.account.account_id.cmp(&second.account.account_id))
}

fn pick_weighted_candidate_index(
    candidates: &[SelectionCandidate],
    exclude_account_id: Option<&str>,
) -> Option<usize> {
    let weighted: Vec<(usize, u64)> = candidates
        .iter()
        .enumerate()
        .filter(|(_, candidate)| {
            if let Some(exclude_account_id) = exclude_account_id {
                candidate.account.account_id != exclude_account_id
            } else {
                true
            }
        })
        .map(|(index, candidate)| (index, candidate.member.weight.max(1).min(20) as u64))
        .collect();

    if weighted.is_empty() {
        return None;
    }

    let total_weight: u64 = weighted.iter().map(|(_, weight)| *weight).sum();
    if total_weight == 0 {
        return weighted.first().map(|(index, _)| *index);
    }

    let mut rng = rand::rng();
    let mut roll = rng.random_range(0..total_weight);
    for (index, weight) in weighted.iter().copied() {
        if roll < weight {
            return Some(index);
        }
        roll -= weight;
    }
    weighted.last().map(|(index, _)| *index)
}

fn resolve_rate_limit_state(
    conn: &Connection,
    account_id: &str,
    model_scope: Option<&str>,
    now: u64,
) -> OAuthResult<(bool, i32)> {
    let mut statement = conn
        .prepare(
            "SELECT reset_at, failure_count
             FROM oauth_rate_limits
             WHERE account_id = ?1
               AND (scope_model = '*' OR scope_model = ?2)",
        )
        .map_err(|error| format!("Prepare resolve_rate_limit_state: {error}"))?;
    let rows = statement
        .query_map(params![account_id, model_scope.unwrap_or("*")], |row| {
            let reset_at: Option<u64> = row.get(0)?;
            let failure_count: i32 = row.get(1)?;
            Ok((reset_at, failure_count))
        })
        .map_err(|error| format!("Query resolve_rate_limit_state: {error}"))?;

    let mut is_limited = false;
    let mut failure_penalty = 0_i32;
    for row in rows {
        let (reset_at, failure_count) =
            row.map_err(|error| format!("Read resolve_rate_limit_state row: {error}"))?;
        if let Some(reset_at) = reset_at {
            if reset_at > now {
                is_limited = true;
            }
        }
        failure_penalty = failure_penalty.saturating_add(failure_count);
    }

    Ok((is_limited, failure_penalty))
}

fn resolve_session_binding(
    conn: &Connection,
    session_id: &str,
    pool_id: &str,
    workspace_id: Option<&str>,
    now: u64,
) -> OAuthResult<Option<String>> {
    let workspace_scope = workspace_id.unwrap_or("");
    let binding: Option<(String, Option<u64>)> = conn
        .query_row(
            "SELECT account_id, expires_at
             FROM oauth_session_bindings
             WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
            params![session_id, pool_id, workspace_scope],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|error| format!("Resolve session binding for `{session_id}`: {error}"))?;

    let Some((account_id, expires_at)) = binding else {
        return Ok(None);
    };
    if let Some(expires_at) = expires_at {
        if expires_at <= now {
            conn.execute(
                "DELETE FROM oauth_session_bindings
                 WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
                params![session_id, pool_id, workspace_scope],
            )
            .map_err(|error| format!("Delete expired session binding `{session_id}`: {error}"))?;
            return Ok(None);
        }
    }

    Ok(Some(account_id))
}

fn resolve_manual_session_binding(
    conn: &Connection,
    session_id: &str,
    pool_id: &str,
    workspace_id: Option<&str>,
) -> OAuthResult<Option<String>> {
    let workspace_scope = workspace_id.unwrap_or("");
    conn.query_row(
        "SELECT account_id
         FROM oauth_manual_session_bindings
         WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
        params![session_id, pool_id, workspace_scope],
        |row| row.get(0),
    )
    .optional()
    .map_err(|error| format!("Resolve manual session binding for `{session_id}`: {error}"))
}

fn clear_session_binding(conn: &Connection, session_id: &str, pool_id: &str) -> OAuthResult<()> {
    conn.execute(
        "DELETE FROM oauth_session_bindings WHERE session_id = ?1 AND pool_id = ?2",
        params![session_id, pool_id],
    )
    .map_err(|error| format!("Clear session binding `{session_id}` for `{pool_id}`: {error}"))?;
    Ok(())
}

fn upsert_session_binding(
    conn: &Connection,
    session_id: &str,
    pool_id: &str,
    workspace_id: Option<&str>,
    account_id: &str,
    now: u64,
) -> OAuthResult<()> {
    let workspace_scope = workspace_id.unwrap_or("");
    let expires_at = now.saturating_add(SESSION_BINDING_TTL_MS);
    prune_expired_session_bindings(conn, now)?;
    conn.execute(
        "INSERT INTO oauth_session_bindings (
            session_id, pool_id, workspace_id, account_id, bound_at, expires_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(session_id, pool_id, workspace_id) DO UPDATE SET
            account_id = excluded.account_id,
            bound_at = excluded.bound_at,
            expires_at = excluded.expires_at",
        params![
            session_id,
            pool_id,
            workspace_scope,
            account_id,
            now,
            expires_at
        ],
    )
    .map_err(|error| format!("Upsert session binding `{session_id}`: {error}"))?;
    Ok(())
}

fn upsert_manual_session_binding(
    conn: &Connection,
    session_id: &str,
    pool_id: &str,
    workspace_id: Option<&str>,
    account_id: &str,
    now: u64,
) -> OAuthResult<()> {
    let workspace_scope = workspace_id.unwrap_or("");
    conn.execute(
        "INSERT INTO oauth_manual_session_bindings (
            session_id, pool_id, workspace_id, account_id, bound_at
         ) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(session_id, pool_id, workspace_id) DO UPDATE SET
            account_id = excluded.account_id,
            bound_at = excluded.bound_at",
        params![session_id, pool_id, workspace_scope, account_id, now],
    )
    .map_err(|error| format!("Upsert manual session binding `{session_id}`: {error}"))?;
    Ok(())
}

fn clear_manual_session_binding(
    conn: &Connection,
    session_id: &str,
    pool_id: &str,
    workspace_id: Option<&str>,
) -> OAuthResult<()> {
    let workspace_scope = workspace_id.unwrap_or("");
    conn.execute(
        "DELETE FROM oauth_manual_session_bindings
         WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
        params![session_id, pool_id, workspace_scope],
    )
    .map_err(|error| {
        format!("Clear manual session binding `{session_id}` for `{pool_id}`: {error}")
    })?;
    Ok(())
}

fn prune_expired_session_bindings(conn: &Connection, now: u64) -> OAuthResult<()> {
    conn.execute(
        "DELETE FROM oauth_session_bindings WHERE expires_at IS NOT NULL AND expires_at <= ?1",
        [now],
    )
    .map_err(|error| format!("Prune expired session bindings: {error}"))?;
    Ok(())
}

fn has_local_codex_cli_profile_credential(metadata: &Value) -> bool {
    let Some(object) = metadata.as_object() else {
        return false;
    };
    let local_cli_managed = object
        .get(LOCAL_CODEX_CLI_MANAGED_METADATA_KEY)
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !local_cli_managed {
        return false;
    }

    let credential_available = object
        .get(LOCAL_CODEX_CLI_CREDENTIAL_AVAILABLE_METADATA_KEY)
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !credential_available {
        return false;
    }

    object
        .get(OAUTH_ACCOUNT_SOURCE_METADATA_KEY)
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|source| source.eq_ignore_ascii_case(LOCAL_CODEX_CLI_ACCOUNT_SOURCE))
}

fn should_persist_session_binding(sticky_mode: &str) -> bool {
    matches!(sticky_mode, STICKY_CACHE_FIRST | STICKY_PERFORMANCE_FIRST)
}

pub fn canonicalize_provider_alias(provider: &str) -> Option<&'static str> {
    let normalized = provider.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }
    match normalized.as_str() {
        PROVIDER_CODEX | "openai" | "openai-codex" => Some(PROVIDER_CODEX),
        PROVIDER_GEMINI | "google" | "antigravity" | "anti-gravity" | "gemini-antigravity" => {
            Some(PROVIDER_GEMINI)
        }
        PROVIDER_CLAUDE_CODE | "claude" | "claude-code" | "anthropic" => Some(PROVIDER_CLAUDE_CODE),
        _ => None,
    }
}

fn normalize_provider(provider: &str) -> OAuthResult<String> {
    let normalized = provider.trim();
    if normalized.is_empty() {
        return Err("provider must be a non-empty string".to_string());
    }
    if let Some(canonical) = canonicalize_provider_alias(normalized) {
        return Ok(canonical.to_string());
    }
    Err(format!(
        "Unsupported provider `{}`. Expected canonical providers: codex, gemini, claude_code (aliases: openai, google/antigravity, anthropic/claude).",
        normalized
    ))
}

pub fn is_supported_provider(provider: &str) -> bool {
    canonicalize_provider_alias(provider).is_some()
}

fn sanitize_required<'a>(value: &'a str, field: &str) -> OAuthResult<&'a str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field} must be a non-empty string"));
    }
    Ok(trimmed)
}

fn sanitize_optional(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

include!("oauth_pool_db_metadata.rs");
include!("oauth_pool_db_rate_limits.rs");
