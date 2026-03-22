use std::time::{SystemTime, UNIX_EPOCH};

use redis::aio::MultiplexedConnection;
use redis::streams::{
    StreamAutoClaimOptions, StreamAutoClaimReply, StreamId, StreamPendingCountReply,
    StreamPendingReply, StreamReadOptions, StreamReadReply,
};
use redis::{AsyncCommands, RedisError};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::keys;

pub const COMMAND_KIND_TASK_START: &str = "task.start";
pub const COMMAND_KIND_TASK_INTERRUPT: &str = "task.interrupt";
pub const COMMAND_KIND_APPROVAL_DECISION: &str = "approval.decision";
pub const COMMAND_CONSUMER_GROUP: &str = "runtime-agent-workers";
pub const COMMAND_STREAM_READ_COUNT_DEFAULT: usize = 32;
pub const COMMAND_STREAM_RECLAIM_COUNT_DEFAULT: usize = 64;
const COMMAND_STREAM_MAX_LEN: usize = 20_000;
const INVALID_COMMAND_STREAM_MAX_LEN: usize = 2_000;
const INVALID_COMMAND_FIELD_MAX_CHARS: usize = 1_024;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DistributedCommandEnvelope {
    pub task_id: String,
    pub workspace_id: Option<String>,
    pub thread_id: Option<String>,
    pub request_id: Option<String>,
    pub lane: usize,
    pub kind: String,
    pub payload: Value,
    pub created_at: u64,
    pub attempt: u32,
    pub trace_id: String,
}

#[derive(Clone, Debug)]
pub struct QueuedDistributedCommand {
    pub stream_id: String,
    pub envelope: DistributedCommandEnvelope,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DistributedCommandParseFailure {
    pub stream_id: String,
    pub error: String,
}

#[derive(Clone, Debug, Default)]
pub struct DistributedCommandReadBatch {
    pub commands: Vec<QueuedDistributedCommand>,
    pub parse_failures: Vec<DistributedCommandParseFailure>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DistributedPendingMetrics {
    pub pending_entries: u64,
    pub oldest_pending_ms: Option<u64>,
}

#[derive(Clone, Debug, Default)]
pub struct ReclaimedDistributedCommands {
    pub next_start_id: String,
    pub commands: Vec<QueuedDistributedCommand>,
    pub parse_failures: Vec<DistributedCommandParseFailure>,
}

impl DistributedCommandEnvelope {
    pub fn new(
        task_id: impl Into<String>,
        workspace_id: Option<String>,
        thread_id: Option<String>,
        request_id: Option<String>,
        lane: usize,
        kind: impl Into<String>,
        payload: Value,
    ) -> Self {
        Self {
            task_id: task_id.into(),
            workspace_id,
            thread_id,
            request_id,
            lane,
            kind: kind.into(),
            payload,
            created_at: now_ms(),
            attempt: 1,
            trace_id: format!("trace-{}", uuid::Uuid::new_v4()),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

async fn open_connection(client: &redis::Client) -> Result<MultiplexedConnection, String> {
    client
        .get_multiplexed_async_connection()
        .await
        .map_err(|error| format!("Open redis connection: {error}"))
}

fn is_redis_response_error(error: &RedisError, code: &str) -> bool {
    error.to_string().contains(code)
}

fn merge_pending_metrics(
    aggregate: &mut DistributedPendingMetrics,
    lane_metrics: &DistributedPendingMetrics,
) {
    aggregate.pending_entries += lane_metrics.pending_entries;
    aggregate.oldest_pending_ms =
        match (aggregate.oldest_pending_ms, lane_metrics.oldest_pending_ms) {
            (Some(left), Some(right)) => Some(left.max(right)),
            (Some(left), None) => Some(left),
            (None, Some(right)) => Some(right),
            (None, None) => None,
        };
}

fn truncate_chars_with_ascii_ellipsis(value: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }
    let value_len = value.chars().count();
    if value_len <= max_chars {
        return value.to_string();
    }
    if max_chars <= 3 {
        return value.chars().take(max_chars).collect();
    }
    let mut truncated = value.chars().take(max_chars - 3).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn normalize_invalid_command_field(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    let normalized = if trimmed.is_empty() {
        fallback
    } else {
        trimmed
    };
    truncate_chars_with_ascii_ellipsis(normalized, INVALID_COMMAND_FIELD_MAX_CHARS)
}

fn parse_command_stream_entry(entry: StreamId) -> Result<QueuedDistributedCommand, String> {
    let stream_id = entry.id.clone();
    let payload = entry.get::<String>("payload").ok_or_else(|| {
        format!(
            "Command stream entry `{}` is missing `payload` field.",
            stream_id.as_str()
        )
    })?;
    let envelope: DistributedCommandEnvelope = serde_json::from_str(payload.as_str()).map_err(
        |error| {
            format!(
                "Parse distributed command envelope for stream entry `{}` from redis payload: {error}",
                stream_id.as_str()
            )
        },
    )?;
    if envelope.task_id.trim().is_empty() {
        return Err(format!(
            "Distributed command envelope in stream entry `{}` contains empty task id.",
            stream_id.as_str()
        ));
    }
    Ok(QueuedDistributedCommand {
        stream_id,
        envelope,
    })
}

pub async fn ping(client: &redis::Client) -> Result<(), String> {
    let mut connection = open_connection(client).await?;
    let response: String = redis::cmd("PING")
        .query_async(&mut connection)
        .await
        .map_err(|error| format!("Redis PING failed: {error}"))?;
    if response.eq_ignore_ascii_case("PONG") {
        Ok(())
    } else {
        Err(format!("Redis PING unexpected response: {response}"))
    }
}

pub async fn ensure_lane_consumer_group(client: &redis::Client, lane: usize) -> Result<(), String> {
    let stream_key = keys::lane_commands_stream_key(lane);
    let mut connection = open_connection(client).await?;
    let create_result = connection
        .xgroup_create_mkstream(stream_key.as_str(), COMMAND_CONSUMER_GROUP, "0")
        .await;
    match create_result {
        Ok(()) => Ok(()),
        Err(error) if is_redis_response_error(&error, "BUSYGROUP") => Ok(()),
        Err(error) => Err(format!(
            "Create redis command stream group `{COMMAND_CONSUMER_GROUP}` for lane {lane}: {error}"
        )),
    }
}

pub async fn ensure_lane_consumer(
    client: &redis::Client,
    lane: usize,
    consumer_name: &str,
) -> Result<(), String> {
    let stream_key = keys::lane_commands_stream_key(lane);
    let mut connection = open_connection(client).await?;
    connection
        .xgroup_createconsumer(stream_key.as_str(), COMMAND_CONSUMER_GROUP, consumer_name)
        .await
        .map(|_: bool| ())
        .map_err(|error| {
            format!(
                "Create redis command stream consumer `{consumer_name}` for lane {lane}: {error}"
            )
        })
}

pub async fn enqueue_command(
    client: &redis::Client,
    command: &DistributedCommandEnvelope,
) -> Result<String, String> {
    let stream_key = keys::lane_commands_stream_key(command.lane);
    let payload_json = serde_json::to_string(command)
        .map_err(|error| format!("Serialize distributed command payload: {error}"))?;

    let mut connection = open_connection(client).await?;
    redis::cmd("XADD")
        .arg(stream_key.as_str())
        .arg("MAXLEN")
        .arg("~")
        .arg(COMMAND_STREAM_MAX_LEN)
        .arg("*")
        .arg("kind")
        .arg(command.kind.as_str())
        .arg("taskId")
        .arg(command.task_id.as_str())
        .arg("payload")
        .arg(payload_json)
        .query_async::<String>(&mut connection)
        .await
        .map_err(|error| format!("XADD distributed command failed: {error}"))
}

pub async fn record_invalid_command(
    client: &redis::Client,
    lane: usize,
    stream_id: &str,
    consumer_name: &str,
    source: &str,
    error: &str,
) -> Result<String, String> {
    let stream_key = keys::lane_invalid_commands_stream_key(lane);
    let source_value = normalize_invalid_command_field(source, "unknown");
    let error_value = normalize_invalid_command_field(error, "unknown parse failure");
    let mut connection = open_connection(client).await?;
    redis::cmd("XADD")
        .arg(stream_key.as_str())
        .arg("MAXLEN")
        .arg("~")
        .arg(INVALID_COMMAND_STREAM_MAX_LEN)
        .arg("*")
        .arg("lane")
        .arg(lane as u64)
        .arg("streamId")
        .arg(stream_id)
        .arg("consumer")
        .arg(consumer_name)
        .arg("source")
        .arg(source_value.as_str())
        .arg("error")
        .arg(error_value.as_str())
        .arg("observedAt")
        .arg(now_ms())
        .query_async::<String>(&mut connection)
        .await
        .map_err(|record_error| {
            format!(
                "XADD invalid distributed command record for lane {lane} stream `{stream_id}` failed: {record_error}"
            )
        })
}

pub async fn read_new_commands(
    client: &redis::Client,
    lane: usize,
    consumer_name: &str,
    count: usize,
    block_ms: u64,
) -> Result<DistributedCommandReadBatch, String> {
    let stream_key = keys::lane_commands_stream_key(lane);
    let mut options = StreamReadOptions::default()
        .group(COMMAND_CONSUMER_GROUP, consumer_name)
        .count(count.max(1));
    if block_ms > 0 {
        options = options.block(block_ms as usize);
    }

    let mut connection = open_connection(client).await?;
    let reply: Option<StreamReadReply> = connection
        .xread_options(&[stream_key.as_str()], &[">"], &options)
        .await
        .map_err(|error| {
            format!("Read distributed command stream for lane {lane} via XREADGROUP: {error}")
        })?;
    let mut batch = DistributedCommandReadBatch::default();
    if let Some(reply) = reply {
        for key in reply.keys {
            for entry in key.ids {
                let stream_id = entry.id.clone();
                match parse_command_stream_entry(entry) {
                    Ok(command) => batch.commands.push(command),
                    Err(error) => batch
                        .parse_failures
                        .push(DistributedCommandParseFailure { stream_id, error }),
                }
            }
        }
    }
    Ok(batch)
}

pub async fn ack_command(
    client: &redis::Client,
    lane: usize,
    stream_id: &str,
) -> Result<bool, String> {
    let stream_key = keys::lane_commands_stream_key(lane);
    let mut connection = open_connection(client).await?;
    connection
        .xack(stream_key.as_str(), COMMAND_CONSUMER_GROUP, &[stream_id])
        .await
        .map(|acked: usize| acked > 0)
        .map_err(|error| {
            format!(
                "Acknowledge distributed command `{stream_id}` for lane {lane} via XACK: {error}"
            )
        })
}

pub async fn reclaim_idle_commands(
    client: &redis::Client,
    lane: usize,
    consumer_name: &str,
    min_idle_ms: u64,
    start_id: &str,
    count: usize,
) -> Result<ReclaimedDistributedCommands, String> {
    let stream_key = keys::lane_commands_stream_key(lane);
    let mut connection = open_connection(client).await?;
    let options = StreamAutoClaimOptions::default().count(count.max(1));
    let claim: StreamAutoClaimReply = connection
        .xautoclaim_options(
            stream_key.as_str(),
            COMMAND_CONSUMER_GROUP,
            consumer_name,
            min_idle_ms,
            if start_id.trim().is_empty() {
                "0-0"
            } else {
                start_id
            },
            options,
        )
        .await
        .map_err(|error| {
            format!("Reclaim distributed idle commands for lane {lane} via XAUTOCLAIM: {error}")
        })?;
    let mut commands = Vec::with_capacity(claim.claimed.len());
    let mut parse_failures = Vec::new();
    for entry in claim.claimed {
        let stream_id = entry.id.clone();
        match parse_command_stream_entry(entry) {
            Ok(command) => commands.push(command),
            Err(error) => parse_failures.push(DistributedCommandParseFailure { stream_id, error }),
        }
    }
    Ok(ReclaimedDistributedCommands {
        next_start_id: claim.next_stream_id,
        commands,
        parse_failures,
    })
}

async fn read_lane_pending_metrics_with_connection(
    connection: &mut MultiplexedConnection,
    lane: usize,
) -> Result<DistributedPendingMetrics, String> {
    let stream_key = keys::lane_commands_stream_key(lane);
    let pending = connection
        .xpending(stream_key.as_str(), COMMAND_CONSUMER_GROUP)
        .await;
    let pending: StreamPendingReply = match pending {
        Ok(value) => value,
        Err(error) if is_redis_response_error(&error, "NOGROUP") => {
            return Ok(DistributedPendingMetrics::default());
        }
        Err(error) => {
            return Err(format!(
                "Read distributed pending summary for lane {lane} via XPENDING: {error}"
            ));
        }
    };

    let pending_entries = pending.count() as u64;
    if pending_entries == 0 {
        return Ok(DistributedPendingMetrics::default());
    }

    let pending_details = connection
        .xpending_count(stream_key.as_str(), COMMAND_CONSUMER_GROUP, "-", "+", 1)
        .await;
    let pending_details: StreamPendingCountReply = match pending_details {
        Ok(value) => value,
        Err(error) if is_redis_response_error(&error, "NOGROUP") => {
            return Ok(DistributedPendingMetrics::default());
        }
        Err(error) => {
            return Err(format!(
                "Read distributed pending details for lane {lane} via XPENDING range: {error}"
            ));
        }
    };

    Ok(DistributedPendingMetrics {
        pending_entries,
        oldest_pending_ms: pending_details
            .ids
            .first()
            .map(|entry| entry.last_delivered_ms as u64),
    })
}

pub async fn read_all_lanes_pending_metrics(
    client: &redis::Client,
    lane_count: usize,
) -> Result<DistributedPendingMetrics, String> {
    if lane_count == 0 {
        return Ok(DistributedPendingMetrics::default());
    }
    let mut connection = open_connection(client).await?;
    let mut aggregate = DistributedPendingMetrics::default();
    for lane in 0..lane_count {
        let lane_metrics = read_lane_pending_metrics_with_connection(&mut connection, lane).await?;
        merge_pending_metrics(&mut aggregate, &lane_metrics);
    }
    Ok(aggregate)
}

async fn read_lane_invalid_command_entries_with_connection(
    connection: &mut MultiplexedConnection,
    lane: usize,
) -> Result<u64, String> {
    let stream_key = keys::lane_invalid_commands_stream_key(lane);
    redis::cmd("XLEN")
        .arg(stream_key.as_str())
        .query_async::<u64>(connection)
        .await
        .map_err(|error| {
            format!("Read invalid command stream length for lane {lane} via XLEN: {error}")
        })
}

pub async fn read_all_lanes_invalid_command_entries(
    client: &redis::Client,
    lane_count: usize,
) -> Result<u64, String> {
    if lane_count == 0 {
        return Ok(0);
    }
    let mut connection = open_connection(client).await?;
    let mut total = 0u64;
    for lane in 0..lane_count {
        let lane_entries =
            read_lane_invalid_command_entries_with_connection(&mut connection, lane).await?;
        total = total.saturating_add(lane_entries);
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    use redis::Value as RedisValue;

    fn build_stream_entry_with_payload(entry_id: &str, payload: Option<&str>) -> StreamId {
        let mut map = HashMap::<String, RedisValue>::new();
        if let Some(payload) = payload {
            map.insert(
                "payload".to_string(),
                RedisValue::BulkString(payload.as_bytes().to_vec()),
            );
        }
        StreamId {
            id: entry_id.to_string(),
            map,
            milliseconds_elapsed_from_delivery: None,
            delivered_count: None,
        }
    }

    #[test]
    fn command_envelope_builder_sets_expected_defaults() {
        let envelope = DistributedCommandEnvelope::new(
            "task-1",
            Some("workspace-a".to_string()),
            Some("thread-a".to_string()),
            Some("request-a".to_string()),
            3,
            COMMAND_KIND_TASK_START,
            serde_json::json!({"x":1}),
        );
        assert_eq!(envelope.task_id, "task-1");
        assert_eq!(envelope.workspace_id.as_deref(), Some("workspace-a"));
        assert_eq!(envelope.thread_id.as_deref(), Some("thread-a"));
        assert_eq!(envelope.request_id.as_deref(), Some("request-a"));
        assert_eq!(envelope.lane, 3);
        assert_eq!(envelope.kind, COMMAND_KIND_TASK_START);
        assert_eq!(envelope.attempt, 1);
        assert!(envelope.created_at > 0);
        assert!(envelope.trace_id.starts_with("trace-"));
    }

    #[test]
    fn parse_command_stream_entry_accepts_valid_payload() {
        let payload = serde_json::json!({
            "taskId":"task-1",
            "workspaceId":"workspace-a",
            "threadId":"thread-a",
            "requestId":"request-a",
            "lane": 2,
            "kind":"task.start",
            "payload":{"k":"v"},
            "createdAt": 1000,
            "attempt": 1,
            "traceId":"trace-1"
        })
        .to_string();
        let entry = build_stream_entry_with_payload("1-0", Some(payload.as_str()));
        let parsed = parse_command_stream_entry(entry).expect("parse entry");
        assert_eq!(parsed.stream_id, "1-0");
        assert_eq!(parsed.envelope.task_id, "task-1");
        assert_eq!(parsed.envelope.lane, 2);
        assert_eq!(parsed.envelope.kind, "task.start");
    }

    #[test]
    fn parse_command_stream_entry_rejects_missing_payload_field() {
        let entry = build_stream_entry_with_payload("2-0", None);
        let error = parse_command_stream_entry(entry).expect_err("missing payload should fail");
        assert!(error.contains("payload"));
        assert!(error.contains("2-0"));
    }

    #[test]
    fn parse_command_stream_entry_rejects_invalid_json_with_stream_id() {
        let entry = build_stream_entry_with_payload("2-9", Some("{invalid-json"));
        let error = parse_command_stream_entry(entry).expect_err("invalid json should fail");
        assert!(error.contains("Parse distributed command envelope"));
        assert!(error.contains("2-9"));
    }

    #[test]
    fn normalize_invalid_command_field_uses_fallback_for_blank_values() {
        let normalized = normalize_invalid_command_field("   ", "fallback");
        assert_eq!(normalized, "fallback");
    }

    #[test]
    fn normalize_invalid_command_field_truncates_oversized_values() {
        let oversized = "x".repeat(INVALID_COMMAND_FIELD_MAX_CHARS + 50);
        let normalized = normalize_invalid_command_field(oversized.as_str(), "fallback");
        assert!(normalized.ends_with("..."));
        assert_eq!(normalized.chars().count(), INVALID_COMMAND_FIELD_MAX_CHARS);
    }

    #[test]
    fn read_batch_collects_parse_errors_without_failing_entire_lane() {
        let valid_payload = serde_json::json!({
            "taskId":"task-1",
            "workspaceId":"workspace-a",
            "threadId":"thread-a",
            "requestId":"request-a",
            "lane": 2,
            "kind":"task.start",
            "payload":{"k":"v"},
            "createdAt": 1000,
            "attempt": 1,
            "traceId":"trace-1"
        })
        .to_string();
        let valid_entry = build_stream_entry_with_payload("3-0", Some(valid_payload.as_str()));
        let invalid_entry = build_stream_entry_with_payload("3-1", None);
        let mut batch = DistributedCommandReadBatch::default();
        for entry in [valid_entry, invalid_entry] {
            let stream_id = entry.id.clone();
            match parse_command_stream_entry(entry) {
                Ok(command) => batch.commands.push(command),
                Err(error) => batch
                    .parse_failures
                    .push(DistributedCommandParseFailure { stream_id, error }),
            }
        }
        assert_eq!(batch.commands.len(), 1);
        assert_eq!(batch.parse_failures.len(), 1);
        assert_eq!(
            batch.parse_failures[0],
            DistributedCommandParseFailure {
                stream_id: "3-1".to_string(),
                error: "Command stream entry `3-1` is missing `payload` field.".to_string()
            }
        );
    }

    #[test]
    fn merge_pending_metrics_adds_counts_and_keeps_max_oldest() {
        let mut aggregate = DistributedPendingMetrics {
            pending_entries: 2,
            oldest_pending_ms: Some(120),
        };
        merge_pending_metrics(
            &mut aggregate,
            &DistributedPendingMetrics {
                pending_entries: 5,
                oldest_pending_ms: Some(80),
            },
        );
        merge_pending_metrics(
            &mut aggregate,
            &DistributedPendingMetrics {
                pending_entries: 3,
                oldest_pending_ms: Some(220),
            },
        );
        assert_eq!(aggregate.pending_entries, 10);
        assert_eq!(aggregate.oldest_pending_ms, Some(220));
    }

    #[tokio::test]
    async fn read_all_lanes_invalid_command_entries_returns_zero_for_empty_lane_set() {
        let client = redis::Client::open("redis://127.0.0.1:1/0")
            .expect("build client should not require active redis");
        let total = read_all_lanes_invalid_command_entries(&client, 0)
            .await
            .expect("zero lanes should bypass redis requests");
        assert_eq!(total, 0);
    }

    #[tokio::test]
    async fn read_all_lanes_pending_metrics_returns_default_for_empty_lane_set() {
        let client = redis::Client::open("redis://127.0.0.1:1/0")
            .expect("build client should not require active redis");
        let metrics = read_all_lanes_pending_metrics(&client, 0)
            .await
            .expect("zero lanes should bypass redis requests");
        assert_eq!(metrics.pending_entries, 0);
        assert_eq!(metrics.oldest_pending_ms, None);
    }
}
