#[derive(Clone, Debug)]
struct ThreadLiveSubscription {
    subscription_id: String,
    workspace_id: String,
    thread_id: String,
    heartbeat_interval_ms: u64,
}
