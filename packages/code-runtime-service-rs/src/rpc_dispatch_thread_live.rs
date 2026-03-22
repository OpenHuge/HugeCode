use super::*;

pub(super) async fn publish_thread_live_update_for_thread(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    reason: &str,
) {
    publish_thread_live_update_events(ctx, workspace_id, thread_id, Some(reason)).await;
}

pub(super) async fn handle_threads_list(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let state = ctx.state.read().await;
    let threads = state
        .workspace_threads
        .get(workspace_id)
        .cloned()
        .unwrap_or_default();
    Ok(json!(threads))
}

pub(super) async fn handle_thread_create(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?.to_string();
    let title = read_optional_string(params, "title").unwrap_or_else(|| "New thread".to_string());
    let default_provider = infer_provider(None, Some(ctx.config.default_model_id.as_str()));
    let mut state = ctx.state.write().await;
    ensure_workspace(
        &mut state,
        workspace_id.as_str(),
        &ctx.config.default_model_id,
    );
    let now = now_ms();
    let thread = ThreadSummary {
        id: new_id("thread"),
        workspace_id: workspace_id.clone(),
        title,
        unread: false,
        running: false,
        created_at: now,
        updated_at: now,
        provider: default_provider.routed_provider().to_string(),
        model_id: Some(ctx.config.default_model_id.clone()),
        status: Some("idle".to_string()),
        archived: false,
        last_activity_at: Some(now),
        agent_role: None,
        agent_nickname: None,
    };
    state
        .workspace_threads
        .entry(workspace_id.clone())
        .or_default()
        .insert(0, thread.clone());
    drop(state);
    publish_thread_live_update_for_thread(
        ctx,
        workspace_id.as_str(),
        thread.id.as_str(),
        "code_thread_create",
    )
    .await;
    Ok(json!(thread))
}

pub(super) async fn handle_thread_resume(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?.to_string();
    let thread_id = read_required_string(params, "threadId")?;
    let state = ctx.state.read().await;
    let thread = state
        .workspace_threads
        .get(workspace_id.as_str())
        .and_then(|threads| threads.iter().find(|entry| entry.id == thread_id))
        .cloned();
    drop(state);
    if let Some(thread) = thread.as_ref() {
        publish_thread_live_update_for_thread(
            ctx,
            workspace_id.as_str(),
            thread.id.as_str(),
            "code_thread_resume",
        )
        .await;
    }
    Ok(json!(thread))
}

pub(super) async fn handle_thread_archive(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?.to_string();
    let thread_id = read_required_string(params, "threadId")?.to_string();
    let mut state = ctx.state.write().await;
    let Some(threads) = state.workspace_threads.get_mut(workspace_id.as_str()) else {
        return Ok(json!(false));
    };
    let before = threads.len();
    threads.retain(|entry| entry.id != thread_id);
    let archived = before != threads.len();
    drop(state);

    if archived {
        detach_thread_live_subscriptions_for_thread(
            ctx,
            workspace_id.as_str(),
            thread_id.as_str(),
            "code_thread_archive",
        )
        .await;
    }

    Ok(json!(archived))
}

pub(super) async fn detach_thread_live_subscriptions_for_workspace(
    ctx: &AppContext,
    workspace_id: &str,
    reason: &str,
) {
    let detached =
        remove_thread_live_subscriptions(ctx, |entry| entry.workspace_id == workspace_id).await;
    publish_detached_events(ctx, detached, reason);
}

pub(super) async fn detach_thread_live_subscriptions_for_thread(
    ctx: &AppContext,
    workspace_id: &str,
    thread_id: &str,
    reason: &str,
) {
    let detached = remove_thread_live_subscriptions(ctx, |entry| {
        entry.workspace_id == workspace_id && entry.thread_id == thread_id
    })
    .await;
    publish_detached_events(ctx, detached, reason);
}

pub(super) async fn handle_thread_live_subscribe(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?.to_string();
    let thread_id = read_required_string(params, "threadId")?.to_string();

    let state = ctx.state.read().await;
    let Some(threads) = state.workspace_threads.get(workspace_id.as_str()) else {
        return Err(RpcError::invalid_params(format!(
            "workspace `{workspace_id}` has no threads."
        )));
    };
    if !threads.iter().any(|entry| entry.id == thread_id) {
        return Err(RpcError::invalid_params(format!(
            "thread `{thread_id}` was not found in workspace `{workspace_id}`."
        )));
    }
    drop(state);

    let subscription_id = new_id("thread-live");
    let subscription = ThreadLiveSubscription {
        subscription_id: subscription_id.clone(),
        workspace_id: workspace_id.clone(),
        thread_id: thread_id.clone(),
        heartbeat_interval_ms: DEFAULT_THREAD_LIVE_HEARTBEAT_INTERVAL_MS,
    };
    {
        let mut subscriptions = ctx.thread_live_subscriptions.write().await;
        subscriptions.insert(subscription_id.clone(), subscription.clone());
    }

    publish_thread_live_heartbeat_event(
        ctx,
        subscription.workspace_id.as_str(),
        subscription.thread_id.as_str(),
        subscription.subscription_id.as_str(),
        subscription.heartbeat_interval_ms,
    );
    spawn_thread_live_heartbeat_task(ctx.clone(), subscription.clone()).await;

    Ok(json!({
        "subscriptionId": subscription_id,
        "heartbeatIntervalMs": subscription.heartbeat_interval_ms,
        "transportMode": "push",
    }))
}

pub(super) async fn handle_thread_live_unsubscribe(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let subscription_id = read_required_string(params, "subscriptionId")?.to_string();
    let removed = {
        let mut subscriptions = ctx.thread_live_subscriptions.write().await;
        subscriptions.remove(subscription_id.as_str())
    };
    stop_thread_live_heartbeat_task(ctx, subscription_id.as_str()).await;
    if let Some(subscription) = removed {
        publish_thread_live_detached_event(
            ctx,
            subscription.workspace_id.as_str(),
            subscription.thread_id.as_str(),
            subscription.subscription_id.as_str(),
            Some("code_thread_live_unsubscribe"),
        );
    }
    Ok(json!({"ok": true}))
}

async fn remove_thread_live_subscriptions<F>(
    ctx: &AppContext,
    mut matches: F,
) -> Vec<ThreadLiveSubscription>
where
    F: FnMut(&ThreadLiveSubscription) -> bool,
{
    let mut subscriptions = ctx.thread_live_subscriptions.write().await;
    let removed_ids = subscriptions
        .iter()
        .filter_map(|(subscription_id, entry)| {
            if matches(entry) {
                Some(subscription_id.clone())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    let removed = removed_ids
        .into_iter()
        .filter_map(|subscription_id| subscriptions.remove(&subscription_id))
        .collect::<Vec<_>>();
    drop(subscriptions);
    stop_thread_live_heartbeat_tasks(
        ctx,
        removed
            .iter()
            .map(|entry| entry.subscription_id.clone())
            .collect::<Vec<_>>(),
    )
    .await;
    removed
}

fn publish_detached_events(
    ctx: &AppContext,
    subscriptions: Vec<ThreadLiveSubscription>,
    reason: &str,
) {
    for subscription in subscriptions {
        publish_thread_live_detached_event(
            ctx,
            subscription.workspace_id.as_str(),
            subscription.thread_id.as_str(),
            subscription.subscription_id.as_str(),
            Some(reason),
        );
    }
}

async fn spawn_thread_live_heartbeat_task(ctx: AppContext, subscription: ThreadLiveSubscription) {
    let subscription_id = subscription.subscription_id.clone();
    let task_ctx = ctx.clone();
    let handle = ctx.task_supervisor.spawn_cancellable(
        RuntimeTaskDomain::Subscription,
        format!("thread.live.heartbeat.{subscription_id}"),
        async move {
            loop {
                tokio::time::sleep(Duration::from_millis(subscription.heartbeat_interval_ms)).await;

                let still_registered = {
                    let subscriptions = task_ctx.thread_live_subscriptions.read().await;
                    subscriptions
                        .get(subscription.subscription_id.as_str())
                        .is_some()
                };
                if !still_registered {
                    break;
                }

                publish_thread_live_heartbeat_event(
                    &task_ctx,
                    subscription.workspace_id.as_str(),
                    subscription.thread_id.as_str(),
                    subscription.subscription_id.as_str(),
                    subscription.heartbeat_interval_ms,
                );
            }
        },
    );
    let mut tasks = ctx.thread_live_heartbeat_tasks.lock().await;
    tasks.insert(subscription_id, handle);
}

async fn stop_thread_live_heartbeat_task(ctx: &AppContext, subscription_id: &str) {
    stop_thread_live_heartbeat_tasks(ctx, vec![subscription_id.to_string()]).await;
}

async fn stop_thread_live_heartbeat_tasks(ctx: &AppContext, subscription_ids: Vec<String>) {
    let mut handles = Vec::new();
    {
        let mut tasks = ctx.thread_live_heartbeat_tasks.lock().await;
        for subscription_id in subscription_ids {
            if let Some(handle) = tasks.remove(subscription_id.as_str()) {
                handles.push(handle);
            }
        }
    }
    for mut handle in handles {
        let _ = handle.cancel_and_wait().await;
    }
}
