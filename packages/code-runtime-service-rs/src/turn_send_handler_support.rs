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
