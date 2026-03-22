use super::agent_policy::resolve_agent_step_requires_approval;
use super::*;
#[path = "agent_tasks_execution_helpers.rs"]
mod helpers;
use helpers::{
    build_agent_step_skill_request, build_tool_calling_event_payload,
    build_tool_result_event_payload, checkpoint_agent_task_runtime_state,
    classify_tool_error_class, finalize_approval_wait_outcome, read_agent_interrupt_message,
    resolve_agent_step_read_requirement_violation, wait_for_agent_task_approval,
    AGENT_STEP_REQUIRES_FRESH_READ_ERROR_CODE,
};
const AGENT_TASK_STEP_HEARTBEAT_FAST_INTERVAL_MS: u64 = 1_000;
const AGENT_TASK_STEP_HEARTBEAT_MEDIUM_INTERVAL_MS: u64 = 2_000;
const AGENT_TASK_STEP_HEARTBEAT_SLOW_INTERVAL_MS: u64 = 5_000;
const AGENT_TASK_STEP_HEARTBEAT_VERY_SLOW_INTERVAL_MS: u64 = 30_000;
const AGENT_TASK_STEP_HEARTBEAT_IDLE_CHECK_INTERVAL_MS: u64 = 15_000;
const AGENT_TASK_STEP_HEARTBEAT_MEDIUM_AFTER_SECS: u64 = 15;
const AGENT_TASK_STEP_HEARTBEAT_SLOW_AFTER_SECS: u64 = 60;
const AGENT_TASK_STEP_HEARTBEAT_VERY_SLOW_AFTER_SECS: u64 = 300;

fn resolve_agent_task_step_heartbeat_interval_ms(elapsed: Duration) -> u64 {
    let elapsed_secs = elapsed.as_secs();
    if elapsed_secs >= AGENT_TASK_STEP_HEARTBEAT_VERY_SLOW_AFTER_SECS {
        AGENT_TASK_STEP_HEARTBEAT_VERY_SLOW_INTERVAL_MS
    } else if elapsed_secs >= AGENT_TASK_STEP_HEARTBEAT_SLOW_AFTER_SECS {
        AGENT_TASK_STEP_HEARTBEAT_SLOW_INTERVAL_MS
    } else if elapsed_secs >= AGENT_TASK_STEP_HEARTBEAT_MEDIUM_AFTER_SECS {
        AGENT_TASK_STEP_HEARTBEAT_MEDIUM_INTERVAL_MS
    } else {
        AGENT_TASK_STEP_HEARTBEAT_FAST_INTERVAL_MS
    }
}

fn resolve_agent_task_step_idle_check_interval_ms(elapsed: Duration) -> u64 {
    resolve_agent_task_step_heartbeat_interval_ms(elapsed)
        .max(AGENT_TASK_STEP_HEARTBEAT_IDLE_CHECK_INTERVAL_MS)
}

#[path = "agent_tasks_execution_runner.rs"]
mod runner;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_agent_task_step_heartbeat_interval_uses_fast_interval_initially() {
        assert_eq!(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(0)),
            AGENT_TASK_STEP_HEARTBEAT_FAST_INTERVAL_MS
        );
        assert_eq!(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(14)),
            AGENT_TASK_STEP_HEARTBEAT_FAST_INTERVAL_MS
        );
    }

    #[test]
    fn resolve_agent_task_step_heartbeat_interval_scales_down_for_long_steps() {
        assert_eq!(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(15)),
            AGENT_TASK_STEP_HEARTBEAT_MEDIUM_INTERVAL_MS
        );
        assert_eq!(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(59)),
            AGENT_TASK_STEP_HEARTBEAT_MEDIUM_INTERVAL_MS
        );
        assert_eq!(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(60)),
            AGENT_TASK_STEP_HEARTBEAT_SLOW_INTERVAL_MS
        );
        assert_eq!(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(299)),
            AGENT_TASK_STEP_HEARTBEAT_SLOW_INTERVAL_MS
        );
        assert_eq!(
            resolve_agent_task_step_heartbeat_interval_ms(Duration::from_secs(300)),
            AGENT_TASK_STEP_HEARTBEAT_VERY_SLOW_INTERVAL_MS
        );
    }

    #[test]
    fn resolve_agent_task_step_idle_interval_uses_slower_floor_without_subscribers() {
        assert_eq!(
            resolve_agent_task_step_idle_check_interval_ms(Duration::from_secs(0)),
            15_000
        );
        assert_eq!(
            resolve_agent_task_step_idle_check_interval_ms(Duration::from_secs(60)),
            15_000
        );
        assert_eq!(
            resolve_agent_task_step_idle_check_interval_ms(Duration::from_secs(300)),
            AGENT_TASK_STEP_HEARTBEAT_VERY_SLOW_INTERVAL_MS
        );
    }
}

pub(super) async fn run_agent_task(ctx: AppContext, task_id: String) {
    runner::run_agent_task(ctx, task_id).await;
}
