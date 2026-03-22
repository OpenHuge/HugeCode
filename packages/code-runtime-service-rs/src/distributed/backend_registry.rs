use std::collections::HashMap;

use redis::AsyncCommands;

use super::super::RuntimeBackendSummary;
use super::keys;

async fn open_connection(
    client: &redis::Client,
) -> Result<redis::aio::MultiplexedConnection, String> {
    client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection for backend registry: {error}"))
}

fn parse_backend_registry_entry(
    backend_id: &str,
    payload: &str,
) -> Result<RuntimeBackendSummary, String> {
    let mut summary: RuntimeBackendSummary = serde_json::from_str(payload).map_err(|error| {
        format!("Parse runtime backend summary for `{backend_id}` from redis payload: {error}")
    })?;
    if summary.backend_id.trim().is_empty() || summary.backend_id != backend_id {
        summary.backend_id = backend_id.to_string();
    }
    Ok(summary)
}

pub async fn list_backends(client: &redis::Client) -> Result<Vec<RuntimeBackendSummary>, String> {
    let key = keys::runtime_backends_hash_key();
    let mut connection = open_connection(client).await?;
    let raw_entries = connection
        .hgetall::<_, HashMap<String, String>>(key.as_str())
        .await
        .map_err(|error| format!("HGETALL runtime backend registry failed: {error}"))?;
    let mut summaries = raw_entries
        .into_iter()
        .map(|(backend_id, payload)| {
            parse_backend_registry_entry(backend_id.as_str(), payload.as_str())
        })
        .collect::<Result<Vec<_>, _>>()?;
    summaries.sort_by(|left, right| left.backend_id.cmp(&right.backend_id));
    Ok(summaries)
}

pub async fn upsert_backend(
    client: &redis::Client,
    summary: &RuntimeBackendSummary,
) -> Result<(), String> {
    let key = keys::runtime_backends_hash_key();
    let payload = serde_json::to_string(summary)
        .map_err(|error| format!("Serialize runtime backend summary for redis: {error}"))?;
    let mut connection = open_connection(client).await?;
    connection
        .hset::<_, _, _, ()>(key.as_str(), summary.backend_id.as_str(), payload.as_str())
        .await
        .map_err(|error| format!("HSET runtime backend registry failed: {error}"))?;
    Ok(())
}

pub async fn remove_backend(client: &redis::Client, backend_id: &str) -> Result<bool, String> {
    let key = keys::runtime_backends_hash_key();
    let mut connection = open_connection(client).await?;
    let removed = connection
        .hdel::<_, _, u64>(key.as_str(), backend_id)
        .await
        .map_err(|error| format!("HDEL runtime backend registry failed: {error}"))?;
    Ok(removed > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_backend_registry_entry_normalizes_backend_id_from_field_name() {
        let summary = parse_backend_registry_entry(
            "worker-a",
            r#"{
                "backendId": "",
                "displayName": "Worker A",
                "capabilities": ["code"],
                "maxConcurrency": 4,
                "costTier": "standard",
                "latencyClass": "regional",
                "rolloutState": "current",
                "status": "active",
                "healthy": true,
                "healthScore": 0.98,
                "failures": 0,
                "queueDepth": 2,
                "runningTasks": 1,
                "createdAt": 1,
                "updatedAt": 2,
                "lastHeartbeatAt": 2
            }"#,
        )
        .expect("parse backend summary");
        assert_eq!(summary.backend_id, "worker-a");
    }
}
