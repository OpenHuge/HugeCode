use redis::AsyncCommands;
use serde_json::Value;

use super::keys;

const TASK_SUMMARY_TTL_SECONDS: u64 = 7 * 24 * 60 * 60;
const DEFAULT_WORKSPACE_TASK_LIST_LIMIT: usize = 512;
const DISTRIBUTED_STATE_CAS_ENABLED_ENV: &str =
    "CODE_RUNTIME_SERVICE_DISTRIBUTED_STATE_CAS_ENABLED";
const TEST_FAULT_INJECTION_ENABLED_ENV: &str = "CODE_RUNTIME_SERVICE_TEST_FAULT_INJECTION_ENABLED";
const TEST_FAULT_PROFILE_ENV: &str = "CODE_RUNTIME_SERVICE_TEST_FAULT_PROFILE";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PersistWriteResult {
    Applied,
    StaleWriteRejected,
}

fn distributed_state_cas_enabled() -> bool {
    !matches!(
        std::env::var(DISTRIBUTED_STATE_CAS_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

fn test_fault_profile_enabled(profile: &str) -> bool {
    let enabled = matches!(
        std::env::var(TEST_FAULT_INJECTION_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("1" | "true" | "yes" | "on")
    );
    if !enabled {
        return false;
    }
    std::env::var(TEST_FAULT_PROFILE_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_some_and(|value| value == profile)
}

async fn persist_with_optional_monotonic_cas(
    connection: &mut redis::aio::MultiplexedConnection,
    data_key: &str,
    index_key: &str,
    index_member: &str,
    updated_at: u64,
    payload_json: &str,
) -> Result<PersistWriteResult, String> {
    if test_fault_profile_enabled("cas_stale_spike") {
        return Ok(PersistWriteResult::StaleWriteRejected);
    }
    if !distributed_state_cas_enabled() {
        redis::pipe()
            .atomic()
            .cmd("SET")
            .arg(data_key)
            .arg(payload_json)
            .ignore()
            .cmd("EXPIRE")
            .arg(data_key)
            .arg(TASK_SUMMARY_TTL_SECONDS)
            .ignore()
            .cmd("ZADD")
            .arg(index_key)
            .arg(updated_at as f64)
            .arg(index_member)
            .ignore()
            .cmd("EXPIRE")
            .arg(index_key)
            .arg(TASK_SUMMARY_TTL_SECONDS)
            .ignore()
            .query_async::<()>(connection)
            .await
            .map_err(|error| format!("Persist distributed state transaction: {error}"))?;
        return Ok(PersistWriteResult::Applied);
    }

    let updated_at_score = updated_at.to_string();
    let cas_script = redis::Script::new(
        r#"
local existing = redis.call('ZSCORE', KEYS[2], ARGV[3])
if existing and tonumber(ARGV[2]) < tonumber(existing) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
redis.call('ZADD', KEYS[2], tonumber(ARGV[2]), ARGV[3])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]))
return 1
"#,
    );

    let applied = cas_script
        .key(data_key)
        .key(index_key)
        .arg(payload_json)
        .arg(updated_at_score)
        .arg(index_member)
        .arg(TASK_SUMMARY_TTL_SECONDS.to_string())
        .invoke_async::<i32>(connection)
        .await
        .map_err(|error| format!("Persist distributed state CAS transaction: {error}"))?;

    Ok(if applied == 1 {
        PersistWriteResult::Applied
    } else {
        PersistWriteResult::StaleWriteRejected
    })
}

pub async fn persist_task_summary(
    client: &redis::Client,
    workspace_id: &str,
    task_id: &str,
    updated_at: u64,
    summary: &Value,
) -> Result<PersistWriteResult, String> {
    let summary_json = serde_json::to_string(summary)
        .map_err(|error| format!("Serialize task summary for redis: {error}"))?;

    let task_key = keys::task_state_key(task_id);
    let workspace_index_key = keys::workspace_task_index_key(workspace_id);

    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for state store: {error}"))?;
    persist_with_optional_monotonic_cas(
        &mut connection,
        task_key.as_str(),
        workspace_index_key.as_str(),
        task_id,
        updated_at,
        summary_json.as_str(),
    )
    .await
}

pub async fn remove_task_summary(
    client: &redis::Client,
    workspace_id: &str,
    task_id: &str,
) -> Result<(), String> {
    let task_key = keys::task_state_key(task_id);
    let workspace_index_key = keys::workspace_task_index_key(workspace_id);
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for state delete: {error}"))?;
    redis::pipe()
        .atomic()
        .cmd("DEL")
        .arg(task_key.as_str())
        .ignore()
        .cmd("ZREM")
        .arg(workspace_index_key.as_str())
        .arg(task_id)
        .ignore()
        .query_async::<()>(&mut connection)
        .await
        .map_err(|error| format!("Delete distributed task summary transaction: {error}"))?;
    Ok(())
}

pub async fn read_task_summary(
    client: &redis::Client,
    task_id: &str,
) -> Result<Option<Value>, String> {
    let task_key = keys::task_state_key(task_id);
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for state read: {error}"))?;
    let encoded: Option<String> = connection
        .get(task_key.as_str())
        .await
        .map_err(|error| format!("Read distributed task summary `{task_id}`: {error}"))?;
    match encoded {
        Some(raw) => serde_json::from_str::<Value>(raw.as_str())
            .map(Some)
            .map_err(|error| format!("Parse distributed task summary `{task_id}`: {error}")),
        None => Ok(None),
    }
}

pub async fn read_workspace_task_summaries(
    client: &redis::Client,
    workspace_id: &str,
    limit: Option<usize>,
) -> Result<Vec<Value>, String> {
    let workspace_index_key = keys::workspace_task_index_key(workspace_id);
    let max_entries = limit.unwrap_or(DEFAULT_WORKSPACE_TASK_LIST_LIMIT).max(1);
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for workspace index read: {error}"))?;
    let task_ids = redis::cmd("ZREVRANGE")
        .arg(workspace_index_key.as_str())
        .arg(0)
        .arg((max_entries - 1) as i64)
        .query_async::<Vec<String>>(&mut connection)
        .await
        .map_err(|error| format!("Read workspace task index `{workspace_id}`: {error}"))?;
    if task_ids.is_empty() {
        return Ok(Vec::new());
    }

    let task_keys = task_ids
        .iter()
        .map(|task_id| keys::task_state_key(task_id.as_str()))
        .collect::<Vec<_>>();
    let encoded_entries = redis::cmd("MGET")
        .arg(task_keys)
        .query_async::<Vec<Option<String>>>(&mut connection)
        .await
        .map_err(|error| format!("Read workspace task summaries `{workspace_id}`: {error}"))?;

    let mut summaries = Vec::with_capacity(encoded_entries.len());
    for entry in encoded_entries {
        let Some(raw) = entry else {
            continue;
        };
        if let Ok(value) = serde_json::from_str::<Value>(raw.as_str()) {
            summaries.push(value);
        }
    }
    Ok(summaries)
}

pub async fn persist_agent_task_runtime_snapshot(
    client: &redis::Client,
    workspace_id: &str,
    task_id: &str,
    updated_at: u64,
    snapshot: &Value,
) -> Result<PersistWriteResult, String> {
    let snapshot_json = serde_json::to_string(snapshot)
        .map_err(|error| format!("Serialize task runtime snapshot for redis: {error}"))?;
    let checkpoint_key = keys::task_runtime_checkpoint_key(task_id);
    let workspace_index_key = keys::workspace_task_runtime_checkpoint_index_key(workspace_id);
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for task runtime checkpoint: {error}"))?;
    persist_with_optional_monotonic_cas(
        &mut connection,
        checkpoint_key.as_str(),
        workspace_index_key.as_str(),
        task_id,
        updated_at,
        snapshot_json.as_str(),
    )
    .await
}

pub async fn persist_sub_agent_session_runtime_snapshot(
    client: &redis::Client,
    workspace_id: &str,
    session_id: &str,
    updated_at: u64,
    snapshot: &Value,
) -> Result<PersistWriteResult, String> {
    let snapshot_json = serde_json::to_string(snapshot)
        .map_err(|error| format!("Serialize sub-agent runtime snapshot for redis: {error}"))?;
    let checkpoint_key = keys::sub_agent_session_runtime_checkpoint_key(session_id);
    let workspace_index_key =
        keys::workspace_sub_agent_session_runtime_checkpoint_index_key(workspace_id);
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for sub-agent checkpoint: {error}"))?;
    persist_with_optional_monotonic_cas(
        &mut connection,
        checkpoint_key.as_str(),
        workspace_index_key.as_str(),
        session_id,
        updated_at,
        snapshot_json.as_str(),
    )
    .await
}

pub async fn persist_tool_call_lifecycle_snapshot(
    client: &redis::Client,
    workspace_id: &str,
    task_id: &str,
    checkpoint_id: &str,
    updated_at: u64,
    snapshot: &Value,
) -> Result<PersistWriteResult, String> {
    let snapshot_json = serde_json::to_string(snapshot)
        .map_err(|error| format!("Serialize tool call lifecycle snapshot for redis: {error}"))?;
    let checkpoint_key = keys::tool_call_lifecycle_checkpoint_key(checkpoint_id);
    let task_index_key = keys::task_tool_call_lifecycle_index_key(task_id);
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for tool call checkpoint: {error}"))?;
    let result = persist_with_optional_monotonic_cas(
        &mut connection,
        checkpoint_key.as_str(),
        task_index_key.as_str(),
        checkpoint_id,
        updated_at,
        snapshot_json.as_str(),
    )
    .await
    .map_err(|error| {
        format!("Persist distributed tool call lifecycle checkpoint transaction: {error}")
    })?;
    let _ = workspace_id;
    Ok(result)
}

pub async fn try_acquire_lease(
    client: &redis::Client,
    key: &str,
    token: &str,
    ttl_ms: u64,
) -> Result<bool, String> {
    if test_fault_profile_enabled("redis_timeout") {
        return Err("fault injection: redis timeout".to_string());
    }
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for lease acquire: {error}"))?;
    let acquired: Option<String> = redis::cmd("SET")
        .arg(key)
        .arg(token)
        .arg("NX")
        .arg("PX")
        .arg(ttl_ms)
        .query_async(&mut connection)
        .await
        .map_err(|error| format!("Acquire lifecycle sweeper lease: {error}"))?;
    Ok(acquired.is_some())
}

pub async fn renew_lease_if_owner(
    client: &redis::Client,
    key: &str,
    token: &str,
    ttl_ms: u64,
) -> Result<bool, String> {
    if test_fault_profile_enabled("redis_timeout") {
        return Err("fault injection: redis timeout".to_string());
    }
    if test_fault_profile_enabled("lease_renew_fail") {
        return Err("fault injection: lease renew failed".to_string());
    }
    let renew_script = redis::Script::new(
        r#"
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]))
  return 1
end
return 0
"#,
    );
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for lease renew: {error}"))?;
    let renewed = renew_script
        .key(key)
        .arg(token)
        .arg(ttl_ms.to_string())
        .invoke_async::<i32>(&mut connection)
        .await
        .map_err(|error| format!("Renew lifecycle sweeper lease: {error}"))?;
    Ok(renewed == 1)
}

pub async fn read_lease_owner(client: &redis::Client, key: &str) -> Result<Option<String>, String> {
    if test_fault_profile_enabled("redis_timeout") {
        return Err("fault injection: redis timeout".to_string());
    }
    let mut connection = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for lease read: {error}"))?;
    connection
        .get(key)
        .await
        .map_err(|error| format!("Read lifecycle sweeper lease owner: {error}"))
}

#[cfg(test)]
mod tests {
    #[test]
    fn serialization_accepts_summary_payload() {
        let payload = serde_json::json!({
            "taskId": "task-1",
            "status": "queued"
        });
        let encoded = serde_json::to_string(&payload).expect("serialize summary payload");
        assert!(encoded.contains("task-1"));
    }
}
