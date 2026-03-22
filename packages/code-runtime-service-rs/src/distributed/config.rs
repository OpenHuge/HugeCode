pub const DEFAULT_DISTRIBUTED_LANE_COUNT: usize = 16;
pub const MAX_DISTRIBUTED_LANE_COUNT: usize = 4096;

pub const DEFAULT_DISTRIBUTED_WORKER_CONCURRENCY: usize = 1;
pub const MAX_DISTRIBUTED_WORKER_CONCURRENCY: usize = 256;

pub const DEFAULT_DISTRIBUTED_CLAIM_IDLE_MS: u64 = 30_000;

#[derive(Clone, Debug)]
pub struct DistributedRuntimeConfig {
    pub enabled: bool,
    pub redis_url: Option<String>,
    pub lane_count: usize,
    pub worker_concurrency: usize,
    pub claim_idle_ms: u64,
}

impl DistributedRuntimeConfig {
    pub fn normalized_redis_url(&self) -> Option<&str> {
        self.redis_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
    }
}
