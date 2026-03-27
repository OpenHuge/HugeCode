use super::*;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};

pub(crate) const NATIVE_STATE_DB_PATH_ENV: &str = "CODE_RUNTIME_NATIVE_STATE_DB_PATH";
const NATIVE_STATE_DB_DIR_NAME: &str = ".hugecode";
const NATIVE_STATE_DB_RELATIVE_PATH: &str = ".hugecode/native_state.db";
const LEGACY_HYPECODE_NATIVE_STATE_DB_RELATIVE_PATH: &str = "hypecode/native_state.db";
const LEGACY_FASTCODE_NATIVE_STATE_DB_RELATIVE_PATH: &str = ".fastcode/native_state.db";
const LEGACY_OPEN_WRAP_NATIVE_STATE_DB_RELATIVE_PATH: &str =
    ".open-wrap/native-runtime/native_state.db";
const NATIVE_SCHEMA_VERSION: i64 = 1;

pub(crate) const TABLE_NATIVE_PLUGINS: &str = "native_plugins";
pub(crate) const TABLE_NATIVE_TOOLS: &str = "native_tools";
pub(crate) const TABLE_NATIVE_TOOL_SECRETS_REF: &str = "native_tool_secrets_ref";
pub(crate) const TABLE_NATIVE_SKILLS: &str = "native_skills";
pub(crate) const TABLE_NATIVE_THEMES: &str = "native_themes";
pub(crate) const TABLE_NATIVE_SCHEDULES: &str = "native_schedules";
pub(crate) const TABLE_NATIVE_WATCHERS: &str = "native_watchers";
pub(crate) const TABLE_NATIVE_REVIEW_COMMENTS: &str = "native_review_comments";
pub(crate) const TABLE_NATIVE_TASK_SOURCES: &str = "native_task_sources";
pub(crate) const TABLE_NATIVE_SETTINGS_KV: &str = "native_settings_kv";
pub(crate) const TABLE_NATIVE_RUNTIME_STATE_KV: &str = "native_runtime_state_kv";
pub(crate) const TABLE_NATIVE_VOICE_CONFIG: &str = "native_voice_config";
pub(crate) const TABLE_NATIVE_INSIGHTS_CACHE: &str = "native_insights_cache";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeStateStoreHealth {
    pub(crate) ready: bool,
    pub(crate) schema_version: i64,
    pub(crate) path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) last_error: Option<String>,
}

impl NativeStateStoreHealth {
    fn new(path: &Path) -> Self {
        Self {
            ready: false,
            schema_version: 0,
            path: path.display().to_string(),
            last_error: None,
        }
    }
}

#[derive(Clone)]
pub(crate) struct NativeStateStore {
    db_path: Arc<PathBuf>,
    health: Arc<RwLock<NativeStateStoreHealth>>,
}

impl NativeStateStore {
    pub(crate) fn from_env_or_default() -> Self {
        let env_override = std::env::var(NATIVE_STATE_DB_PATH_ENV)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .map(PathBuf::from);
        let db_path = if let Some(path) = env_override {
            path
        } else if cfg!(test) {
            PathBuf::from(format!(
                "/tmp/hugecode-native-runtime-test-{}.db",
                Uuid::new_v4()
            ))
        } else {
            default_native_state_db_path()
        };
        Self::new(db_path)
    }

    pub(crate) fn new(db_path: PathBuf) -> Self {
        Self {
            health: Arc::new(RwLock::new(NativeStateStoreHealth::new(&db_path))),
            db_path: Arc::new(db_path),
        }
    }

    pub(crate) fn initialize_blocking(&self) {
        let db_path = (*self.db_path).clone();
        let result = open_connection(db_path.as_path())
            .and_then(|mut connection| apply_migrations(&mut connection));
        let mut health = match self.health.try_write() {
            Ok(guard) => guard,
            Err(_) => return,
        };
        match result {
            Ok(()) => {
                health.ready = true;
                health.schema_version = NATIVE_SCHEMA_VERSION;
                health.last_error = None;
            }
            Err(error) => {
                health.ready = false;
                health.schema_version = 0;
                health.last_error = Some(error);
            }
        }
    }

    pub(crate) async fn health_snapshot(&self) -> NativeStateStoreHealth {
        self.health.read().await.clone()
    }

    pub(crate) async fn list_entities(&self, table: &str) -> Result<Vec<Value>, String> {
        let table = table.to_string();
        self.with_connection_blocking(move |connection| {
            ensure_entity_table_name(table.as_str())?;
            let mut statement = connection
                .prepare(format!(
                    "SELECT id, enabled, payload, updated_at FROM {table} ORDER BY updated_at DESC, id ASC"
                )
                .as_str())
                .map_err(|error| format!("prepare list entities statement failed: {error}"))?;

            let rows = statement
                .query_map([], |row| {
                    let id: String = row.get(0)?;
                    let enabled: i64 = row.get(1)?;
                    let payload: String = row.get(2)?;
                    let updated_at: u64 = row.get(3)?;
                    Ok((id, enabled, payload, updated_at))
                })
                .map_err(|error| format!("list entities query failed: {error}"))?;

            let mut items = Vec::new();
            for row in rows {
                let (id, enabled, payload, updated_at) =
                    row.map_err(|error| format!("list entities decode row failed: {error}"))?;
                let value = normalize_entity_payload_from_storage(
                    Some(id.as_str()),
                    Some(enabled != 0),
                    payload.as_str(),
                    updated_at,
                )?;
                items.push(value);
            }
            Ok(items)
        })
        .await
    }

    pub(crate) async fn get_entity(&self, table: &str, id: &str) -> Result<Option<Value>, String> {
        let table = table.to_string();
        let id = id.trim().to_string();
        if id.is_empty() {
            return Ok(None);
        }
        self.with_connection_blocking(move |connection| {
            ensure_entity_table_name(table.as_str())?;
            let mut statement = connection
                .prepare(
                    format!("SELECT enabled, payload, updated_at FROM {table} WHERE id = ?1")
                        .as_str(),
                )
                .map_err(|error| format!("prepare get entity statement failed: {error}"))?;
            let row = statement
                .query_row([id.as_str()], |row| {
                    let enabled: i64 = row.get(0)?;
                    let payload: String = row.get(1)?;
                    let updated_at: u64 = row.get(2)?;
                    Ok((enabled, payload, updated_at))
                })
                .optional()
                .map_err(|error| format!("get entity query failed: {error}"))?;
            let Some((enabled, payload, updated_at)) = row else {
                return Ok(None);
            };
            Ok(Some(normalize_entity_payload_from_storage(
                Some(id.as_str()),
                Some(enabled != 0),
                payload.as_str(),
                updated_at,
            )?))
        })
        .await
    }

    pub(crate) async fn upsert_entity(
        &self,
        table: &str,
        id: &str,
        enabled: Option<bool>,
        payload: Value,
    ) -> Result<Value, String> {
        let table = table.to_string();
        let id = id.trim().to_string();
        if id.is_empty() {
            return Err("entity id is required".to_string());
        }
        self.with_connection_blocking(move |connection| {
            ensure_entity_table_name(table.as_str())?;
            let now = now_ms();
            let normalized_payload =
                normalize_entity_payload(payload, id.as_str(), enabled.unwrap_or(true), now)?;
            let encoded_payload = serde_json::to_string(&normalized_payload)
                .map_err(|error| format!("encode entity payload failed: {error}"))?;
            let payload_object = normalized_payload
                .as_object()
                .ok_or_else(|| "entity payload must be an object".to_string())?;
            let name = payload_object
                .get("name")
                .or_else(|| payload_object.get("displayName"))
                .and_then(Value::as_str)
                .unwrap_or(id.as_str())
                .trim()
                .to_string();
            let version = payload_object
                .get("version")
                .and_then(Value::as_str)
                .unwrap_or("v1")
                .trim()
                .to_string();
            let enabled_flag = payload_object
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(enabled.unwrap_or(true));

            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|error| format!("begin entity upsert transaction failed: {error}"))?;
            tx.execute(
                format!(
                    "INSERT INTO {table} (id, name, version, enabled, payload, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT(id) DO UPDATE SET
                         name=excluded.name,
                         version=excluded.version,
                         enabled=excluded.enabled,
                         payload=excluded.payload,
                         updated_at=excluded.updated_at"
                )
                .as_str(),
                params![
                    id.as_str(),
                    name,
                    version,
                    if enabled_flag { 1_i64 } else { 0_i64 },
                    encoded_payload,
                    now,
                ],
            )
            .map_err(|error| format!("upsert entity failed: {error}"))?;
            tx.commit()
                .map_err(|error| format!("commit entity upsert failed: {error}"))?;
            Ok(normalized_payload)
        })
        .await
    }

    pub(crate) async fn set_entity_enabled(
        &self,
        table: &str,
        id: &str,
        enabled: bool,
    ) -> Result<Value, String> {
        let table = table.to_string();
        let id = id.trim().to_string();
        if id.is_empty() {
            return Err("entity id is required".to_string());
        }
        self.with_connection_blocking(move |connection| {
            ensure_entity_table_name(table.as_str())?;
            let now = now_ms();
            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|error| format!("begin set enabled transaction failed: {error}"))?;

            let mut statement = tx
                .prepare(format!("SELECT payload FROM {table} WHERE id = ?1").as_str())
                .map_err(|error| format!("prepare select existing entity failed: {error}"))?;
            let existing_payload = statement
                .query_row([id.as_str()], |row| row.get::<_, String>(0))
                .optional()
                .map_err(|error| format!("query existing entity failed: {error}"))?
                .ok_or_else(|| format!("entity `{id}` not found"))?;
            drop(statement);

            let normalized_payload = normalize_entity_payload_from_storage(
                Some(id.as_str()),
                Some(enabled),
                existing_payload.as_str(),
                now,
            )?;
            let encoded_payload = serde_json::to_string(&normalized_payload)
                .map_err(|error| format!("encode updated entity payload failed: {error}"))?;

            tx.execute(
                format!(
                    "UPDATE {table} SET enabled = ?2, payload = ?3, updated_at = ?4 WHERE id = ?1"
                )
                .as_str(),
                params![
                    id.as_str(),
                    if enabled { 1_i64 } else { 0_i64 },
                    encoded_payload,
                    now
                ],
            )
            .map_err(|error| format!("update entity enabled failed: {error}"))?;
            tx.commit()
                .map_err(|error| format!("commit set enabled transaction failed: {error}"))?;
            Ok(normalized_payload)
        })
        .await
    }

    pub(crate) async fn remove_entity(&self, table: &str, id: &str) -> Result<bool, String> {
        let table = table.to_string();
        let id = id.trim().to_string();
        if id.is_empty() {
            return Ok(false);
        }
        self.with_connection_blocking(move |connection| {
            ensure_entity_table_name(table.as_str())?;
            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|error| format!("begin entity remove transaction failed: {error}"))?;
            let affected = tx
                .execute(
                    format!("DELETE FROM {table} WHERE id = ?1").as_str(),
                    params![id.as_str()],
                )
                .map_err(|error| format!("remove entity failed: {error}"))?;
            tx.commit()
                .map_err(|error| format!("commit entity remove failed: {error}"))?;
            Ok(affected > 0)
        })
        .await
    }

    pub(crate) async fn upsert_setting_value(
        &self,
        table: &str,
        key: &str,
        value: Value,
    ) -> Result<Value, String> {
        let table = table.to_string();
        let key = key.trim().to_string();
        if key.is_empty() {
            return Err("setting key is required".to_string());
        }
        self.with_connection_blocking(move |connection| {
            ensure_kv_table_name(table.as_str())?;
            let now = now_ms();
            let encoded = serde_json::to_string(&value)
                .map_err(|error| format!("encode setting value failed: {error}"))?;
            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|error| format!("begin setting upsert transaction failed: {error}"))?;
            tx.execute(
                format!(
                    "INSERT INTO {table} (key, value, updated_at)
                     VALUES (?1, ?2, ?3)
                     ON CONFLICT(key) DO UPDATE SET
                         value=excluded.value,
                         updated_at=excluded.updated_at"
                )
                .as_str(),
                params![key.as_str(), encoded, now],
            )
            .map_err(|error| format!("upsert setting value failed: {error}"))?;
            tx.commit()
                .map_err(|error| format!("commit setting upsert failed: {error}"))?;
            Ok(json!({
                "key": key,
                "value": value,
                "updatedAt": now,
            }))
        })
        .await
    }

    pub(crate) fn upsert_setting_value_blocking(
        &self,
        table: &str,
        key: &str,
        value: Value,
    ) -> Result<Value, String> {
        let key = key.trim();
        if key.is_empty() {
            return Err("setting key is required".to_string());
        }

        let mut connection = open_connection(self.db_path.as_path())?;
        apply_migrations(&mut connection)?;
        ensure_kv_table_name(table)?;

        let now = now_ms();
        let encoded = serde_json::to_string(&value)
            .map_err(|error| format!("encode setting value failed: {error}"))?;
        let tx = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|error| format!("begin setting upsert transaction failed: {error}"))?;
        tx.execute(
            format!(
                "INSERT INTO {table} (key, value, updated_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET
                     value=excluded.value,
                     updated_at=excluded.updated_at"
            )
            .as_str(),
            params![key, encoded, now],
        )
        .map_err(|error| format!("upsert setting value failed: {error}"))?;
        tx.commit()
            .map_err(|error| format!("commit setting upsert failed: {error}"))?;
        Ok(json!({
            "key": key,
            "value": value,
            "updatedAt": now,
        }))
    }

    pub(crate) async fn list_setting_values(&self, table: &str) -> Result<Value, String> {
        let table = table.to_string();
        self.with_connection_blocking(move |connection| {
            ensure_kv_table_name(table.as_str())?;
            let mut statement = connection
                .prepare(format!("SELECT key, value FROM {table} ORDER BY key ASC").as_str())
                .map_err(|error| format!("prepare list settings statement failed: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    let key: String = row.get(0)?;
                    let value: String = row.get(1)?;
                    Ok((key, value))
                })
                .map_err(|error| format!("list settings query failed: {error}"))?;
            let mut result = serde_json::Map::new();
            for row in rows {
                let (key, value_raw) =
                    row.map_err(|error| format!("list settings decode row failed: {error}"))?;
                let value = parse_json_value(value_raw.as_str())?;
                result.insert(key, value);
            }
            Ok(Value::Object(result))
        })
        .await
    }

    pub(crate) async fn get_setting_value(
        &self,
        table: &str,
        key: &str,
    ) -> Result<Option<Value>, String> {
        let table = table.to_string();
        let key = key.trim().to_string();
        if key.is_empty() {
            return Ok(None);
        }
        self.with_connection_blocking(move |connection| {
            ensure_kv_table_name(table.as_str())?;
            let mut statement = connection
                .prepare(format!("SELECT value FROM {table} WHERE key = ?1").as_str())
                .map_err(|error| format!("prepare get setting value statement failed: {error}"))?;
            let row = statement
                .query_row([key.as_str()], |row| row.get::<_, String>(0))
                .optional()
                .map_err(|error| format!("get setting value query failed: {error}"))?;
            row.map(|value| parse_json_value(value.as_str()))
                .transpose()
        })
        .await
    }

    pub(crate) fn get_setting_value_blocking(
        &self,
        table: &str,
        key: &str,
    ) -> Result<Option<Value>, String> {
        let key = key.trim();
        if key.is_empty() {
            return Ok(None);
        }

        let mut connection = open_connection(self.db_path.as_path())?;
        apply_migrations(&mut connection)?;
        ensure_kv_table_name(table)?;

        let mut statement = connection
            .prepare(format!("SELECT value FROM {table} WHERE key = ?1").as_str())
            .map_err(|error| format!("prepare get setting value statement failed: {error}"))?;
        let row = statement
            .query_row([key], |row| row.get::<_, String>(0))
            .optional()
            .map_err(|error| format!("get setting value query failed: {error}"))?;
        row.map(|value| parse_json_value(value.as_str()))
            .transpose()
    }

    pub(crate) async fn upsert_tool_secret(
        &self,
        tool_id: &str,
        secret_key: &str,
        secret_ref: &str,
    ) -> Result<Value, String> {
        let tool_id = tool_id.trim().to_string();
        let secret_key = secret_key.trim().to_string();
        let secret_ref = secret_ref.trim().to_string();
        if tool_id.is_empty() || secret_key.is_empty() {
            return Err("toolId and secretKey are required".to_string());
        }

        self.with_connection_blocking(move |connection| {
            let now = now_ms();
            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|error| format!("begin tool secret upsert transaction failed: {error}"))?;
            tx.execute(
                format!(
                    "INSERT INTO {TABLE_NATIVE_TOOL_SECRETS_REF} (tool_id, secret_key, secret_ref, updated_at)
                     VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(tool_id, secret_key) DO UPDATE SET
                         secret_ref=excluded.secret_ref,
                         updated_at=excluded.updated_at"
                )
                .as_str(),
                params![tool_id.as_str(), secret_key.as_str(), secret_ref.as_str(), now],
            )
            .map_err(|error| format!("upsert tool secret failed: {error}"))?;
            tx.commit()
                .map_err(|error| format!("commit tool secret upsert failed: {error}"))?;
            Ok(json!({
                "toolId": tool_id,
                "secretKey": secret_key,
                "secretRef": secret_ref,
                "updatedAt": now,
            }))
        })
        .await
    }

    pub(crate) async fn remove_tool_secret(
        &self,
        tool_id: &str,
        secret_key: &str,
    ) -> Result<bool, String> {
        let tool_id = tool_id.trim().to_string();
        let secret_key = secret_key.trim().to_string();
        if tool_id.is_empty() || secret_key.is_empty() {
            return Ok(false);
        }
        self.with_connection_blocking(move |connection| {
            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|error| format!("begin tool secret remove transaction failed: {error}"))?;
            let affected = tx
                .execute(
                    format!(
                        "DELETE FROM {TABLE_NATIVE_TOOL_SECRETS_REF} WHERE tool_id = ?1 AND secret_key = ?2"
                    )
                    .as_str(),
                    params![tool_id.as_str(), secret_key.as_str()],
                )
                .map_err(|error| format!("remove tool secret failed: {error}"))?;
            tx.commit()
                .map_err(|error| format!("commit tool secret remove failed: {error}"))?;
            Ok(affected > 0)
        })
        .await
    }

    pub(crate) async fn list_tool_secrets(&self, tool_id: &str) -> Result<Vec<Value>, String> {
        let tool_id = tool_id.trim().to_string();
        if tool_id.is_empty() {
            return Ok(Vec::new());
        }
        self.with_connection_blocking(move |connection| {
            let mut statement = connection
                .prepare(
                    format!(
                        "SELECT secret_key, secret_ref, updated_at FROM {TABLE_NATIVE_TOOL_SECRETS_REF} WHERE tool_id = ?1 ORDER BY secret_key ASC"
                    )
                    .as_str(),
                )
                .map_err(|error| format!("prepare list tool secrets statement failed: {error}"))?;
            let rows = statement
                .query_map([tool_id.as_str()], |row| {
                    let secret_key: String = row.get(0)?;
                    let secret_ref: String = row.get(1)?;
                    let updated_at: u64 = row.get(2)?;
                    Ok((secret_key, secret_ref, updated_at))
                })
                .map_err(|error| format!("list tool secrets query failed: {error}"))?;
            let mut secrets = Vec::new();
            for row in rows {
                let (secret_key, secret_ref, updated_at) =
                    row.map_err(|error| format!("list tool secrets decode row failed: {error}"))?;
                secrets.push(json!({
                    "toolId": tool_id,
                    "secretKey": secret_key,
                    "secretRef": secret_ref,
                    "updatedAt": updated_at,
                }));
            }
            Ok(secrets)
        })
        .await
    }

    pub(crate) async fn upsert_insights_cache(
        &self,
        scope: &str,
        payload: Value,
    ) -> Result<Value, String> {
        let scope = scope.trim().to_string();
        if scope.is_empty() {
            return Err("insights scope is required".to_string());
        }
        self.with_connection_blocking(move |connection| {
            let now = now_ms();
            let encoded_payload = serde_json::to_string(&payload)
                .map_err(|error| format!("encode insights payload failed: {error}"))?;
            let tx = connection
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|error| format!("begin insights upsert transaction failed: {error}"))?;
            tx.execute(
                format!(
                    "INSERT INTO {TABLE_NATIVE_INSIGHTS_CACHE} (scope, payload, updated_at)
                     VALUES (?1, ?2, ?3)
                     ON CONFLICT(scope) DO UPDATE SET
                         payload=excluded.payload,
                         updated_at=excluded.updated_at"
                )
                .as_str(),
                params![scope.as_str(), encoded_payload, now],
            )
            .map_err(|error| format!("upsert insights cache failed: {error}"))?;
            tx.commit()
                .map_err(|error| format!("commit insights upsert failed: {error}"))?;
            Ok(json!({
                "scope": scope,
                "payload": payload,
                "updatedAt": now,
            }))
        })
        .await
    }

    pub(crate) async fn get_insights_cache(&self, scope: &str) -> Result<Option<Value>, String> {
        let scope = scope.trim().to_string();
        if scope.is_empty() {
            return Ok(None);
        }
        self.with_connection_blocking(move |connection| {
            let mut statement = connection
                .prepare(
                    format!(
                        "SELECT payload, updated_at FROM {TABLE_NATIVE_INSIGHTS_CACHE} WHERE scope = ?1"
                    )
                    .as_str(),
                )
                .map_err(|error| format!("prepare get insights cache statement failed: {error}"))?;
            let row = statement
                .query_row([scope.as_str()], |row| {
                    let payload: String = row.get(0)?;
                    let updated_at: u64 = row.get(1)?;
                    Ok((payload, updated_at))
                })
                .optional()
                .map_err(|error| format!("query insights cache failed: {error}"))?;
            let Some((payload, updated_at)) = row else {
                return Ok(None);
            };
            Ok(Some(json!({
                "scope": scope,
                "payload": parse_json_value(payload.as_str())?,
                "updatedAt": updated_at,
            })))
        })
        .await
    }

    async fn with_connection_blocking<R, F>(&self, func: F) -> Result<R, String>
    where
        R: Send + 'static,
        F: FnOnce(&mut Connection) -> Result<R, String> + Send + 'static,
    {
        let db_path = (*self.db_path).clone();
        tokio::task::spawn_blocking(move || {
            let mut connection = open_connection(db_path.as_path())?;
            apply_migrations(&mut connection)?;
            func(&mut connection)
        })
        .await
        .map_err(|error| format!("native state store task join failed: {error}"))?
    }
}

fn default_native_state_db_path() -> PathBuf {
    if let Some(base_dir) = desktop_state_home_dir() {
        return base_dir
            .join(NATIVE_STATE_DB_DIR_NAME)
            .join("native_state.db");
    }
    if let Some(user_profile) = std::env::var_os("USERPROFILE") {
        return PathBuf::from(user_profile).join(NATIVE_STATE_DB_RELATIVE_PATH);
    }
    PathBuf::from(format!("/tmp/{NATIVE_STATE_DB_RELATIVE_PATH}"))
}

fn legacy_native_state_db_paths() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        candidates.push(home.join(LEGACY_HYPECODE_NATIVE_STATE_DB_RELATIVE_PATH));
        candidates.push(home.join(LEGACY_FASTCODE_NATIVE_STATE_DB_RELATIVE_PATH));
        candidates.push(home.join(LEGACY_OPEN_WRAP_NATIVE_STATE_DB_RELATIVE_PATH));
    }
    if let Some(user_profile) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
        candidates.push(user_profile.join(LEGACY_HYPECODE_NATIVE_STATE_DB_RELATIVE_PATH));
        candidates.push(user_profile.join(LEGACY_FASTCODE_NATIVE_STATE_DB_RELATIVE_PATH));
        candidates.push(user_profile.join(LEGACY_OPEN_WRAP_NATIVE_STATE_DB_RELATIVE_PATH));
    }
    if let Some(base_dir) = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("APPDATA"))
        .map(PathBuf::from)
    {
        candidates.push(base_dir.join("hypecode").join("native_state.db"));
        candidates.push(
            base_dir
                .join("HypeCode")
                .join("Code")
                .join("native_state.db"),
        );
    }
    candidates.push(PathBuf::from(format!(
        "/tmp/{LEGACY_HYPECODE_NATIVE_STATE_DB_RELATIVE_PATH}"
    )));
    candidates.push(PathBuf::from(format!(
        "/tmp/{LEGACY_FASTCODE_NATIVE_STATE_DB_RELATIVE_PATH}"
    )));
    candidates.push(PathBuf::from(format!(
        "/tmp/{LEGACY_OPEN_WRAP_NATIVE_STATE_DB_RELATIVE_PATH}"
    )));
    candidates
}

fn desktop_state_home_dir() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        return home_dir()
            .map(|home| home.join("Library").join("Application Support"))
            .or_else(|| std::env::var_os("TMPDIR").map(PathBuf::from));
    }
    if cfg!(target_os = "windows") {
        return std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("APPDATA").map(PathBuf::from));
    }
    std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| home_dir().map(|home| home.join(".local").join("state")))
}

fn home_dir() -> Option<PathBuf> {
    if let Some(home) = std::env::var_os("HOME") {
        return Some(PathBuf::from(home));
    }
    std::env::var_os("USERPROFILE").map(PathBuf::from)
}

fn sqlite_wal_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}-wal", path.display()))
}

fn migrate_legacy_native_state_db_if_needed(path: &Path) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }

    let Some(source) = legacy_native_state_db_paths()
        .into_iter()
        .find(|candidate| candidate != path && candidate.exists())
    else {
        return Ok(());
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create native runtime db parent directory `{}` failed: {error}",
                parent.display()
            )
        })?;
    }

    fs::copy(source.as_path(), path).map_err(|error| {
        format!(
            "copy legacy native runtime sqlite database `{}` to `{}` failed: {error}",
            source.display(),
            path.display()
        )
    })?;
    let source_wal = sqlite_wal_path(source.as_path());
    if source_wal.exists() {
        let target_wal = sqlite_wal_path(path);
        fs::copy(source_wal.as_path(), target_wal.as_path()).map_err(|error| {
            format!(
                "copy legacy sqlite wal `{}` to `{}` failed: {error}",
                source_wal.display(),
                target_wal.display()
            )
        })?;
    }

    Ok(())
}

fn open_connection(path: &Path) -> Result<Connection, String> {
    migrate_legacy_native_state_db_if_needed(path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create native runtime db parent directory `{}` failed: {error}",
                parent.display()
            )
        })?;
    }
    Connection::open(path).map_err(|error| {
        format!(
            "open native runtime sqlite database `{}` failed: {error}",
            path.display()
        )
    })
}

fn apply_migrations(connection: &mut Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS native_schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_tools (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_tool_secrets_ref (
                tool_id TEXT NOT NULL,
                secret_key TEXT NOT NULL,
                secret_ref TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (tool_id, secret_key)
            );

            CREATE TABLE IF NOT EXISTS native_skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_themes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_schedules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS native_watchers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS native_review_comments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS native_task_sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL, updated_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS native_settings_kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_runtime_state_kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_voice_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS native_insights_cache (
                scope TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            ",
        )
        .map_err(|error| format!("apply native runtime sqlite schema failed: {error}"))?;

    let now = now_ms();
    connection
        .execute(
            "INSERT OR IGNORE INTO native_schema_migrations(version, applied_at) VALUES(?1, ?2)",
            params![NATIVE_SCHEMA_VERSION, now],
        )
        .map_err(|error| format!("register native runtime schema migration failed: {error}"))?;

    connection
        .execute(
            "INSERT OR IGNORE INTO native_voice_config(key, value, updated_at) VALUES(?1, ?2, ?3)",
            params![
                "vad",
                json!({"enabled": true, "threshold": 0.45, "silenceHoldMs": 700}).to_string(),
                now
            ],
        )
        .map_err(|error| format!("seed default voice vad config failed: {error}"))?;

    connection
        .execute(
            "INSERT OR IGNORE INTO native_voice_config(key, value, updated_at) VALUES(?1, ?2, ?3)",
            params!["hotkey", json!("command+shift+v").to_string(), now],
        )
        .map_err(|error| format!("seed default voice hotkey failed: {error}"))?;

    Ok(())
}

fn ensure_entity_table_name(table: &str) -> Result<(), String> {
    if [
        TABLE_NATIVE_PLUGINS,
        TABLE_NATIVE_TOOLS,
        TABLE_NATIVE_SKILLS,
        TABLE_NATIVE_THEMES,
        TABLE_NATIVE_SCHEDULES,
        TABLE_NATIVE_WATCHERS,
        TABLE_NATIVE_REVIEW_COMMENTS,
        TABLE_NATIVE_TASK_SOURCES,
    ]
    .contains(&table)
    {
        return Ok(());
    }
    Err(format!("unsupported native entity table `{table}`"))
}

fn ensure_kv_table_name(table: &str) -> Result<(), String> {
    if [
        TABLE_NATIVE_SETTINGS_KV,
        TABLE_NATIVE_RUNTIME_STATE_KV,
        TABLE_NATIVE_VOICE_CONFIG,
    ]
    .contains(&table)
    {
        return Ok(());
    }
    Err(format!("unsupported native kv table `{table}`"))
}

fn normalize_entity_payload(
    payload: Value,
    id: &str,
    enabled: bool,
    updated_at: u64,
) -> Result<Value, String> {
    let mut object = match payload {
        Value::Object(object) => object,
        Value::Null => serde_json::Map::new(),
        _ => return Err("entity payload must be an object".to_string()),
    };

    object.insert("id".to_string(), Value::String(id.to_string()));
    object.insert("enabled".to_string(), Value::Bool(enabled));
    object.insert(
        "updatedAt".to_string(),
        Value::Number(serde_json::Number::from(updated_at)),
    );

    if !object.contains_key("name") {
        object.insert("name".to_string(), Value::String(id.to_string()));
    }
    if !object.contains_key("version") {
        object.insert("version".to_string(), Value::String("v1".to_string()));
    }

    Ok(Value::Object(object))
}

fn normalize_entity_payload_from_storage(
    id: Option<&str>,
    enabled: Option<bool>,
    payload: &str,
    updated_at: u64,
) -> Result<Value, String> {
    let value = parse_json_value(payload)?;
    let Value::Object(mut object) = value else {
        return Err("stored entity payload is not an object".to_string());
    };

    if let Some(id) = id {
        object.insert("id".to_string(), Value::String(id.to_string()));
    }
    if let Some(enabled) = enabled {
        object.insert("enabled".to_string(), Value::Bool(enabled));
    }
    object.insert(
        "updatedAt".to_string(),
        Value::Number(serde_json::Number::from(updated_at)),
    );
    Ok(Value::Object(object))
}

fn parse_json_value(raw: &str) -> Result<Value, String> {
    serde_json::from_str(raw).map_err(|error| format!("parse stored json failed: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        default_native_state_db_path, migrate_legacy_native_state_db_if_needed, sqlite_wal_path,
        LEGACY_FASTCODE_NATIVE_STATE_DB_RELATIVE_PATH, NATIVE_STATE_DB_RELATIVE_PATH,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    fn native_state_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn default_native_state_db_path_uses_localappdata_on_windows() {
        if !cfg!(target_os = "windows") {
            return;
        }

        let _guard = native_state_env_lock()
            .lock()
            .expect("native state env lock poisoned");
        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_roaming = std::env::var_os("APPDATA");
        let previous_home = std::env::var_os("HOME");
        let previous_profile = std::env::var_os("USERPROFILE");

        std::env::set_var("LOCALAPPDATA", r"C:\Users\tester\AppData\Local");
        std::env::set_var("APPDATA", r"C:\Users\tester\AppData\Roaming");
        std::env::remove_var("HOME");
        std::env::set_var("USERPROFILE", r"C:\Users\tester");

        let path = default_native_state_db_path();
        assert_eq!(
            path,
            PathBuf::from(r"C:\Users\tester\AppData\Local")
                .join(".hugecode")
                .join("native_state.db")
        );

        match previous_local {
            Some(value) => std::env::set_var("LOCALAPPDATA", value),
            None => std::env::remove_var("LOCALAPPDATA"),
        }
        match previous_roaming {
            Some(value) => std::env::set_var("APPDATA", value),
            None => std::env::remove_var("APPDATA"),
        }
        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_profile {
            Some(value) => std::env::set_var("USERPROFILE", value),
            None => std::env::remove_var("USERPROFILE"),
        }
    }

    #[test]
    fn default_native_state_db_path_uses_dot_hugecode_dir_on_macos() {
        if !cfg!(target_os = "macos") {
            return;
        }

        let _guard = native_state_env_lock()
            .lock()
            .expect("native state env lock poisoned");
        let previous_home = std::env::var_os("HOME");
        let previous_profile = std::env::var_os("USERPROFILE");
        let previous_tmpdir = std::env::var_os("TMPDIR");

        std::env::set_var("HOME", "/Users/tester");
        std::env::remove_var("USERPROFILE");
        std::env::set_var("TMPDIR", "/tmp/native-state-tests");

        let path = default_native_state_db_path();
        assert_eq!(
            path,
            PathBuf::from("/Users/tester")
                .join("Library")
                .join("Application Support")
                .join(".hugecode")
                .join("native_state.db")
        );
        assert!(path.ends_with(PathBuf::from(NATIVE_STATE_DB_RELATIVE_PATH)));

        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_profile {
            Some(value) => std::env::set_var("USERPROFILE", value),
            None => std::env::remove_var("USERPROFILE"),
        }
        match previous_tmpdir {
            Some(value) => std::env::set_var("TMPDIR", value),
            None => std::env::remove_var("TMPDIR"),
        }
    }

    #[test]
    fn default_native_state_db_path_uses_dot_hugecode_dir_on_linux() {
        if !cfg!(target_os = "linux") {
            return;
        }

        let _guard = native_state_env_lock()
            .lock()
            .expect("native state env lock poisoned");
        let previous_xdg_state = std::env::var_os("XDG_STATE_HOME");
        let previous_home = std::env::var_os("HOME");
        let previous_profile = std::env::var_os("USERPROFILE");

        std::env::set_var("XDG_STATE_HOME", "/home/tester/.local/state");
        std::env::set_var("HOME", "/home/tester");
        std::env::remove_var("USERPROFILE");

        let path = default_native_state_db_path();
        assert_eq!(
            path,
            PathBuf::from("/home/tester/.local/state")
                .join(".hugecode")
                .join("native_state.db")
        );
        assert!(path.ends_with(PathBuf::from(NATIVE_STATE_DB_RELATIVE_PATH)));

        match previous_xdg_state {
            Some(value) => std::env::set_var("XDG_STATE_HOME", value),
            None => std::env::remove_var("XDG_STATE_HOME"),
        }
        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_profile {
            Some(value) => std::env::set_var("USERPROFILE", value),
            None => std::env::remove_var("USERPROFILE"),
        }
    }

    #[test]
    fn migrate_legacy_native_state_db_if_needed_copies_windows_legacy_store() {
        if !cfg!(target_os = "windows") {
            return;
        }

        let _guard = native_state_env_lock()
            .lock()
            .expect("native state env lock poisoned");
        let unique = format!("native-state-migration-{}", uuid::Uuid::new_v4());
        let root = std::env::temp_dir().join(unique);
        let local_app_data = root.join("local-app-data");
        let user_profile = root.join("user-profile");
        let target = local_app_data.join(".hugecode").join("native_state.db");
        let legacy = user_profile.join(LEGACY_FASTCODE_NATIVE_STATE_DB_RELATIVE_PATH);

        let previous_local = std::env::var_os("LOCALAPPDATA");
        let previous_roaming = std::env::var_os("APPDATA");
        let previous_home = std::env::var_os("HOME");
        let previous_profile = std::env::var_os("USERPROFILE");

        fs::create_dir_all(legacy.parent().expect("legacy parent")).expect("create legacy parent");
        fs::write(legacy.as_path(), "legacy-native-state").expect("write legacy sqlite file");
        fs::write(sqlite_wal_path(legacy.as_path()), "legacy-native-state-wal")
            .expect("write legacy sqlite wal");
        fs::write(
            PathBuf::from(format!("{}-shm", legacy.display())),
            "legacy-native-state-shm",
        )
        .expect("write legacy sqlite shm");

        std::env::set_var("LOCALAPPDATA", local_app_data.as_os_str());
        std::env::remove_var("APPDATA");
        std::env::remove_var("HOME");
        std::env::set_var("USERPROFILE", user_profile.as_os_str());

        migrate_legacy_native_state_db_if_needed(target.as_path()).expect("migrate legacy store");

        assert_eq!(
            fs::read_to_string(target.as_path()).expect("read migrated sqlite"),
            "legacy-native-state"
        );
        assert_eq!(
            fs::read_to_string(sqlite_wal_path(target.as_path()))
                .expect("read migrated sqlite wal"),
            "legacy-native-state-wal"
        );
        assert!(
            !PathBuf::from(format!("{}-shm", target.display())).exists(),
            "sqlite shm should not be migrated because it is rebuilt from wal state"
        );

        let _ = fs::remove_dir_all(root.as_path());
        match previous_local {
            Some(value) => std::env::set_var("LOCALAPPDATA", value),
            None => std::env::remove_var("LOCALAPPDATA"),
        }
        match previous_roaming {
            Some(value) => std::env::set_var("APPDATA", value),
            None => std::env::remove_var("APPDATA"),
        }
        match previous_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
        match previous_profile {
            Some(value) => std::env::set_var("USERPROFILE", value),
            None => std::env::remove_var("USERPROFILE"),
        }
    }
}
