use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DistributedReadinessSnapshot {
    pub enabled: bool,
    pub redis_connected: bool,
    pub lane_count: u64,
    pub worker_count: u64,
    pub backends_total: u64,
    pub backends_healthy: u64,
    pub backends_draining: u64,
    pub placement_failures_total: u64,
    pub pending_entries: u64,
    pub invalid_command_entries: u64,
    pub oldest_pending_ms: Option<u64>,
    pub last_dispatch_error: Option<String>,
}
