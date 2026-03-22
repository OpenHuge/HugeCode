#![allow(dead_code)]

use super::*;

const DEFAULT_THREAD_LIVE_HEARTBEAT_INTERVAL_MS: u64 = 10_000;
#[derive(Clone, Debug)]
pub(super) struct RuntimeThreadLiveSubscription {
    pub(super) subscription_id: String,
    pub(super) workspace_id: String,
    pub(super) thread_id: String,
    pub(super) heartbeat_interval_ms: u64,
}

impl RuntimeBackend {
    pub fn thread_live_subscribe(
        &self,
        workspace_id: &str,
        thread_id: &str,
    ) -> Result<(String, u64), String> {
        let state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while subscribing thread live updates");
        let thread_exists = state
            .workspace_threads
            .get(workspace_id)
            .map(|thread_ids| thread_ids.iter().any(|entry| entry == thread_id))
            .unwrap_or(false);
        drop(state);
        if !thread_exists {
            return Err(format!(
                "thread `{thread_id}` was not found in workspace `{workspace_id}`."
            ));
        }

        let mut sequence = self
            .next_thread_live_subscription_seq
            .lock()
            .expect("thread live sequence lock poisoned");
        let subscription_id = format!("thread-live-{workspace_id}-{:04}", *sequence);
        *sequence = sequence.saturating_add(1);
        drop(sequence);

        let mut subscriptions = self
            .thread_live_subscriptions
            .lock()
            .expect("thread live subscriptions lock poisoned");
        subscriptions.insert(
            subscription_id.clone(),
            RuntimeThreadLiveSubscription {
                subscription_id: subscription_id.clone(),
                workspace_id: workspace_id.to_string(),
                thread_id: thread_id.to_string(),
                heartbeat_interval_ms: DEFAULT_THREAD_LIVE_HEARTBEAT_INTERVAL_MS,
            },
        );
        drop(subscriptions);

        Ok((subscription_id, DEFAULT_THREAD_LIVE_HEARTBEAT_INTERVAL_MS))
    }

    pub fn thread_live_unsubscribe(&self, subscription_id: &str) -> bool {
        let mut subscriptions = self
            .thread_live_subscriptions
            .lock()
            .expect("thread live subscriptions lock poisoned");
        let Some(removed) = subscriptions.remove(subscription_id) else {
            return false;
        };
        removed.subscription_id == subscription_id
            && !removed.workspace_id.trim().is_empty()
            && !removed.thread_id.trim().is_empty()
            && removed.heartbeat_interval_ms > 0
    }
}
