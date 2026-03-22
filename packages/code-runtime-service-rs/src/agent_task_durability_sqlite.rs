use super::*;
use rusqlite::{params, OptionalExtension};

const HYPECODE_DIR_NAME: &str = ".hugecode";
const LEGACY_DURABILITY_DB_FILE_NAME: &str = "agent-task-durability.sqlite3";
const LEGACY_DURABILITY_DIR_NAMES: &[&str] = &[
    ".code-runtime-service",
    ".code-runtime-service-rs",
    "hypecode",
    "code-runtime-service",
    "code-runtime-service-rs",
];

impl AgentTaskDurabilityStore {
    pub(super) fn persist_agent_task_snapshot_local(
        &self,
        snapshot: &AgentTaskRuntimeSnapshot,
    ) -> Result<(), String> {
        let conn = self
            .conn
            .as_ref()
            .ok_or_else(|| self.unavailable_error("persist agent task runtime snapshot"))?;
        let conn = conn
            .lock()
            .map_err(|_| "Lock durability sqlite connection".to_string())?;
        let payload = serde_json::to_string(snapshot)
            .map_err(|error| format!("Serialize agent runtime snapshot: {error}"))?;
        conn.execute(
            "INSERT INTO agent_task_runtime_snapshots (
                task_id, workspace_id, updated_at, checkpoint_id, payload
             ) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(task_id) DO UPDATE SET
                workspace_id = excluded.workspace_id,
                updated_at = excluded.updated_at,
                checkpoint_id = excluded.checkpoint_id,
                payload = excluded.payload",
            params![
                snapshot.task_id.as_str(),
                snapshot.workspace_id.as_str(),
                snapshot.updated_at as i64,
                snapshot.checkpoint_id.as_str(),
                payload
            ],
        )
        .map_err(|error| format!("Persist agent runtime snapshot sqlite row: {error}"))?;
        Ok(())
    }

    pub(super) fn persist_sub_agent_session_snapshot_local(
        &self,
        snapshot: &SubAgentSessionRuntimeSnapshot,
    ) -> Result<(), String> {
        let conn = self
            .conn
            .as_ref()
            .ok_or_else(|| self.unavailable_error("persist sub-agent session runtime snapshot"))?;
        let conn = conn
            .lock()
            .map_err(|_| "Lock durability sqlite connection".to_string())?;
        let payload = serde_json::to_string(snapshot)
            .map_err(|error| format!("Serialize sub-agent session snapshot: {error}"))?;
        conn.execute(
            "INSERT INTO sub_agent_session_runtime_snapshots (
                session_id, workspace_id, updated_at, checkpoint_id, payload
             ) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(session_id) DO UPDATE SET
                workspace_id = excluded.workspace_id,
                updated_at = excluded.updated_at,
                checkpoint_id = excluded.checkpoint_id,
                payload = excluded.payload",
            params![
                snapshot.session_id.as_str(),
                snapshot.workspace_id.as_str(),
                snapshot.updated_at as i64,
                snapshot.checkpoint_id.as_str(),
                payload
            ],
        )
        .map_err(|error| format!("Persist sub-agent session snapshot sqlite row: {error}"))?;
        Ok(())
    }

    pub(super) fn persist_tool_call_lifecycle_snapshot_local(
        &self,
        snapshot: &ToolCallLifecycleSnapshot,
    ) -> Result<(), String> {
        let conn = self
            .conn
            .as_ref()
            .ok_or_else(|| self.unavailable_error("persist tool call lifecycle snapshot"))?;
        let conn = conn
            .lock()
            .map_err(|_| "Lock durability sqlite connection".to_string())?;
        let payload = serde_json::to_string(snapshot)
            .map_err(|error| format!("Serialize tool call lifecycle snapshot: {error}"))?;
        conn.execute(
            "INSERT INTO tool_call_lifecycle_snapshots (
                checkpoint_id, task_id, workspace_id, updated_at, payload
             ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                snapshot.checkpoint_id.as_str(),
                snapshot.task_id.as_str(),
                snapshot.workspace_id.as_str(),
                snapshot.updated_at as i64,
                payload
            ],
        )
        .map_err(|error| format!("Persist tool call lifecycle sqlite row: {error}"))?;
        Ok(())
    }

    pub(super) fn read_recent_agent_task_snapshots_local(
        &self,
        limit: usize,
    ) -> Result<Vec<AgentTaskRuntimeSnapshot>, String> {
        let Some(conn) = self.conn.as_ref() else {
            return Ok(Vec::new());
        };
        let conn = conn
            .lock()
            .map_err(|_| "Lock durability sqlite connection".to_string())?;
        let mut statement = conn
            .prepare(
                "SELECT payload FROM agent_task_runtime_snapshots
                 ORDER BY updated_at DESC
                 LIMIT ?1",
            )
            .map_err(|error| format!("Prepare agent task durability snapshot query: {error}"))?;
        let rows = statement
            .query_map([limit as i64], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Query agent task durability snapshots: {error}"))?;
        let mut snapshots = Vec::new();
        for row in rows {
            let payload =
                row.map_err(|error| format!("Read agent task durability snapshot row: {error}"))?;
            let snapshot = serde_json::from_str::<AgentTaskRuntimeSnapshot>(payload.as_str())
                .map_err(|error| {
                    format!("Parse agent task durability snapshot payload: {error}")
                })?;
            snapshots.push(snapshot);
        }
        Ok(snapshots)
    }

    pub(super) fn read_agent_task_snapshot_local(
        &self,
        task_id: &str,
    ) -> Result<Option<AgentTaskRuntimeSnapshot>, String> {
        let Some(conn) = self.conn.as_ref() else {
            return Ok(None);
        };
        let conn = conn
            .lock()
            .map_err(|_| "Lock durability sqlite connection".to_string())?;
        let payload: Option<String> = conn
            .query_row(
                "SELECT payload FROM agent_task_runtime_snapshots WHERE task_id = ?1",
                [task_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| format!("Read agent task durability snapshot `{task_id}`: {error}"))?;
        payload
            .map(|raw| {
                serde_json::from_str::<AgentTaskRuntimeSnapshot>(raw.as_str()).map_err(|error| {
                    format!("Parse agent task durability snapshot `{task_id}`: {error}")
                })
            })
            .transpose()
    }

    pub(super) fn read_recent_sub_agent_session_snapshots_local(
        &self,
        limit: usize,
    ) -> Result<Vec<SubAgentSessionRuntimeSnapshot>, String> {
        let Some(conn) = self.conn.as_ref() else {
            return Ok(Vec::new());
        };
        let conn = conn
            .lock()
            .map_err(|_| "Lock durability sqlite connection".to_string())?;
        let mut statement = conn
            .prepare(
                "SELECT payload FROM sub_agent_session_runtime_snapshots
                 ORDER BY updated_at DESC
                 LIMIT ?1",
            )
            .map_err(|error| format!("Prepare sub-agent durability snapshot query: {error}"))?;
        let rows = statement
            .query_map([limit as i64], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Query sub-agent durability snapshots: {error}"))?;
        let mut snapshots = Vec::new();
        for row in rows {
            let payload =
                row.map_err(|error| format!("Read sub-agent durability snapshot row: {error}"))?;
            let snapshot = serde_json::from_str::<SubAgentSessionRuntimeSnapshot>(payload.as_str())
                .map_err(|error| format!("Parse sub-agent durability snapshot payload: {error}"))?;
            snapshots.push(snapshot);
        }
        Ok(snapshots)
    }

    pub(super) fn unavailable_error(&self, operation: &str) -> String {
        let reason = self
            .startup_error
            .as_deref()
            .unwrap_or("agent task durability backend is unavailable");
        format!("Agent task durability unavailable for {operation}: {reason}")
    }
}

pub(super) fn resolve_agent_task_durability_db_path(config: &ServiceConfig) -> Option<PathBuf> {
    if let Some(path) = std::env::var(AGENT_TASK_DURABILITY_DB_PATH_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return Some(PathBuf::from(path));
    }

    let oauth_db = config.oauth_pool_db_path.trim();
    if !oauth_db.is_empty() && oauth_db != ":memory:" {
        let oauth_path = Path::new(oauth_db);
        if let Some(parent) = oauth_path.parent() {
            return Some(parent.join("agent-task-durability.sqlite3"));
        }
    }

    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok());
    if let Some(home) = home {
        let trimmed = home.trim();
        if !trimmed.is_empty() {
            let target = PathBuf::from(trimmed)
                .join(HYPECODE_DIR_NAME)
                .join(LEGACY_DURABILITY_DB_FILE_NAME);
            if let Err(error) = migrate_legacy_durability_db_if_needed(target.as_path()) {
                eprintln!(
                    "failed to migrate legacy agent task durability sqlite into `{}`: {error}",
                    target.display()
                );
            }
            return Some(target);
        }
    }

    let target = std::env::temp_dir()
        .join(HYPECODE_DIR_NAME)
        .join(LEGACY_DURABILITY_DB_FILE_NAME);
    if let Err(error) = migrate_legacy_durability_db_if_needed(target.as_path()) {
        eprintln!(
            "failed to migrate legacy agent task durability sqlite into `{}`: {error}",
            target.display()
        );
    }
    Some(target)
}

fn sqlite_wal_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}-wal", path.display()))
}

fn legacy_durability_db_paths() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(home) = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())
    {
        let home = home.trim();
        if !home.is_empty() {
            let home = PathBuf::from(home);
            for dir_name in LEGACY_DURABILITY_DIR_NAMES {
                candidates.push(home.join(dir_name).join(LEGACY_DURABILITY_DB_FILE_NAME));
            }
        }
    }

    let temp_dir = std::env::temp_dir();
    for dir_name in LEGACY_DURABILITY_DIR_NAMES {
        candidates.push(temp_dir.join(dir_name).join(LEGACY_DURABILITY_DB_FILE_NAME));
    }
    candidates
}

fn migrate_legacy_durability_db_if_needed(path: &Path) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }

    let Some(source) = legacy_durability_db_paths()
        .into_iter()
        .find(|candidate| candidate != path && candidate.exists())
    else {
        return Ok(());
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Create durability sqlite parent directory `{}`: {error}",
                parent.display()
            )
        })?;
    }
    fs::copy(source.as_path(), path).map_err(|error| {
        format!(
            "Copy legacy durability sqlite `{}` to `{}` failed: {error}",
            source.display(),
            path.display()
        )
    })?;

    let source_wal = sqlite_wal_path(source.as_path());
    if source_wal.exists() {
        let target_wal = sqlite_wal_path(path);
        fs::copy(source_wal.as_path(), target_wal.as_path()).map_err(|error| {
            format!(
                "Copy legacy durability sqlite wal `{}` to `{}` failed: {error}",
                source_wal.display(),
                target_wal.display()
            )
        })?;
    }

    Ok(())
}

pub(super) fn open_durability_sqlite(path: &Path) -> Result<Connection, String> {
    if path != Path::new(":memory:") {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Create durability sqlite parent directory `{}`: {error}",
                    parent.display()
                )
            })?;
        }
    }
    let conn = Connection::open(path)
        .map_err(|error| format!("Open durability sqlite `{}`: {error}", path.display()))?;
    let _ = conn.pragma_update(None, "journal_mode", "WAL");
    conn.busy_timeout(Duration::from_secs(3))
        .map_err(|error| format!("Set durability sqlite busy_timeout: {error}"))?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| format!("Set durability sqlite synchronous pragma: {error}"))?;
    init_durability_schema(&conn)?;
    Ok(conn)
}

fn init_durability_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS agent_task_runtime_snapshots (
            task_id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            checkpoint_id TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_task_runtime_snapshots_updated
            ON agent_task_runtime_snapshots(updated_at DESC);

        CREATE TABLE IF NOT EXISTS sub_agent_session_runtime_snapshots (
            session_id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            checkpoint_id TEXT NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sub_agent_session_runtime_snapshots_updated
            ON sub_agent_session_runtime_snapshots(updated_at DESC);

        CREATE TABLE IF NOT EXISTS tool_call_lifecycle_snapshots (
            checkpoint_id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tool_call_lifecycle_snapshots_task_updated
            ON tool_call_lifecycle_snapshots(task_id, updated_at DESC);
        ",
    )
    .map_err(|error| format!("Initialize durability sqlite schema: {error}"))
}
