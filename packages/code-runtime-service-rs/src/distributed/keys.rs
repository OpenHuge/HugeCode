pub fn lane_commands_stream_key(lane: usize) -> String {
    format!("runtime:agent:lane:{lane}:commands")
}

pub fn lane_invalid_commands_stream_key(lane: usize) -> String {
    format!("runtime:agent:lane:{lane}:invalid")
}

pub fn runtime_backends_hash_key() -> String {
    "runtime:backends:v1".to_string()
}

pub fn task_state_key(task_id: &str) -> String {
    format!("runtime:task:{task_id}")
}

pub fn workspace_task_index_key(workspace_id: &str) -> String {
    format!("runtime:workspace:{workspace_id}:tasks")
}

pub fn task_runtime_checkpoint_key(task_id: &str) -> String {
    format!("runtime:task:{task_id}:checkpoint")
}

pub fn workspace_task_runtime_checkpoint_index_key(workspace_id: &str) -> String {
    format!("runtime:workspace:{workspace_id}:task-checkpoints")
}

pub fn sub_agent_session_runtime_checkpoint_key(session_id: &str) -> String {
    format!("runtime:sub-agent:{session_id}:checkpoint")
}

pub fn workspace_sub_agent_session_runtime_checkpoint_index_key(workspace_id: &str) -> String {
    format!("runtime:workspace:{workspace_id}:sub-agent-checkpoints")
}

pub fn tool_call_lifecycle_checkpoint_key(checkpoint_id: &str) -> String {
    format!("runtime:tool-call:{checkpoint_id}")
}

pub fn task_tool_call_lifecycle_index_key(task_id: &str) -> String {
    format!("runtime:task:{task_id}:tool-call-checkpoints")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_generation_is_stable() {
        assert_eq!(lane_commands_stream_key(7), "runtime:agent:lane:7:commands");
        assert_eq!(
            lane_invalid_commands_stream_key(7),
            "runtime:agent:lane:7:invalid"
        );
        assert_eq!(runtime_backends_hash_key(), "runtime:backends:v1");
        assert_eq!(task_state_key("task-1"), "runtime:task:task-1");
        assert_eq!(
            workspace_task_index_key("workspace-a"),
            "runtime:workspace:workspace-a:tasks"
        );
        assert_eq!(
            task_runtime_checkpoint_key("task-1"),
            "runtime:task:task-1:checkpoint"
        );
        assert_eq!(
            workspace_task_runtime_checkpoint_index_key("workspace-a"),
            "runtime:workspace:workspace-a:task-checkpoints"
        );
        assert_eq!(
            sub_agent_session_runtime_checkpoint_key("sub-agent-1"),
            "runtime:sub-agent:sub-agent-1:checkpoint"
        );
        assert_eq!(
            workspace_sub_agent_session_runtime_checkpoint_index_key("workspace-a"),
            "runtime:workspace:workspace-a:sub-agent-checkpoints"
        );
        assert_eq!(
            tool_call_lifecycle_checkpoint_key("checkpoint-1"),
            "runtime:tool-call:checkpoint-1"
        );
        assert_eq!(
            task_tool_call_lifecycle_index_key("task-1"),
            "runtime:task:task-1:tool-call-checkpoints"
        );
    }
}
