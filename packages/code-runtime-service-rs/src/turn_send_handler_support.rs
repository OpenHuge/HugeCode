use super::*;

pub(super) async fn register_turn_interrupt_waiter(ctx: &AppContext, turn_id: &str) -> Arc<Notify> {
    let waiter = Arc::new(Notify::new());
    let mut waiters = ctx.turn_interrupt_waiters.write().await;
    waiters.insert(turn_id.to_string(), waiter.clone());
    waiter
}

pub(super) async fn clear_turn_interrupt_waiter(ctx: &AppContext, turn_id: &str) {
    let mut waiters = ctx.turn_interrupt_waiters.write().await;
    waiters.remove(turn_id);
}

pub(super) fn read_optional_string_array(
    payload: &serde_json::Map<String, Value>,
    key: &str,
    compat_key: &str,
) -> Vec<String> {
    payload
        .get(key)
        .or_else(|| payload.get(compat_key))
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}
