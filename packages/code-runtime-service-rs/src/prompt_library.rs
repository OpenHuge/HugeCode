use serde_json::Value;

use super::{
    read_required_string, resolve_default_workspace_path, RpcError, RuntimePromptLibraryEntry,
    RuntimePromptLibraryRecord, RuntimePromptScope, RuntimeState, WorkspaceSummary,
};

pub(super) fn derive_title(content: &str) -> String {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return "New thread".to_string();
    }
    trimmed
        .lines()
        .next()
        .unwrap_or(trimmed)
        .chars()
        .take(64)
        .collect()
}

pub(super) fn ensure_workspace(
    state: &mut RuntimeState,
    workspace_id: &str,
    default_model_id: &str,
) {
    if state
        .workspaces
        .iter()
        .any(|entry| entry.id == workspace_id)
    {
        return;
    }
    let workspace_path = state
        .workspaces
        .iter()
        .find_map(|workspace| {
            let trimmed = workspace.path.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(workspace.path.clone())
            }
        })
        .unwrap_or_else(resolve_default_workspace_path);
    state.workspaces.push(WorkspaceSummary {
        id: workspace_id.to_string(),
        path: workspace_path,
        display_name: workspace_id.to_string(),
        connected: true,
        default_model_id: Some(default_model_id.to_string()),
    });
}

pub(super) fn build_prompt_library_entry(
    record: &RuntimePromptLibraryRecord,
    scope: RuntimePromptScope,
) -> RuntimePromptLibraryEntry {
    RuntimePromptLibraryEntry {
        id: record.id.clone(),
        title: record.title.clone(),
        description: record.description.clone(),
        content: record.content.clone(),
        scope: scope.as_str().to_string(),
    }
}

pub(super) fn list_prompt_library_entries(
    state: &RuntimeState,
    workspace_id: Option<&str>,
) -> Vec<RuntimePromptLibraryEntry> {
    let mut entries: Vec<RuntimePromptLibraryEntry> = state
        .prompt_library_global
        .iter()
        .map(|record| build_prompt_library_entry(record, RuntimePromptScope::Global))
        .collect();

    if let Some(workspace_id) = workspace_id {
        if let Some(workspace_entries) = state.prompt_library_workspace.get(workspace_id) {
            entries.extend(
                workspace_entries.iter().map(|record| {
                    build_prompt_library_entry(record, RuntimePromptScope::Workspace)
                }),
            );
        }
    }

    entries.sort_by(|left, right| {
        left.title
            .cmp(&right.title)
            .then_with(|| left.scope.cmp(&right.scope))
            .then_with(|| left.id.cmp(&right.id))
    });
    entries
}

pub(super) fn remove_prompt_from_workspace_store(
    state: &mut RuntimeState,
    prompt_id: &str,
) -> Option<(String, RuntimePromptLibraryRecord)> {
    let workspace_ids = state
        .prompt_library_workspace
        .keys()
        .cloned()
        .collect::<Vec<_>>();

    for workspace_id in workspace_ids {
        let mut removed = None;
        let mut is_empty = false;
        if let Some(records) = state
            .prompt_library_workspace
            .get_mut(workspace_id.as_str())
        {
            if let Some(index) = records.iter().position(|entry| entry.id == prompt_id) {
                removed = Some(records.remove(index));
            }
            is_empty = records.is_empty();
        }

        if is_empty {
            state.prompt_library_workspace.remove(workspace_id.as_str());
        }

        if let Some(record) = removed {
            return Some((workspace_id, record));
        }
    }

    None
}

pub(super) fn read_required_prompt_scope(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<RuntimePromptScope, RpcError> {
    let value = read_required_string(params, field)?;
    RuntimePromptScope::parse(value).ok_or_else(|| {
        RpcError::invalid_params(format!(
            "Invalid prompt scope `{value}`. Expected `global` or `workspace`."
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::{ensure_workspace, RuntimeState, WorkspaceSummary};
    use std::sync::{LazyLock, Mutex};

    fn workspace_env_lock() -> &'static Mutex<()> {
        static LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
        &LOCK
    }

    #[test]
    fn ensure_workspace_reuses_existing_workspace_path_for_implicit_registration() {
        let mut state = RuntimeState::default();
        state.workspaces.push(WorkspaceSummary {
            id: "workspace-web".to_string(),
            path: "/tmp/current-workspace".to_string(),
            display_name: "Current Workspace".to_string(),
            connected: true,
            default_model_id: Some("gpt-5.4".to_string()),
        });

        ensure_workspace(&mut state, "workspace-implicit", "gpt-5.4");

        let workspace = state
            .workspaces
            .iter()
            .find(|entry| entry.id == "workspace-implicit")
            .expect("implicit workspace should be registered");
        assert_eq!(workspace.path, "/tmp/current-workspace");
    }

    #[test]
    fn ensure_workspace_uses_env_override_when_no_workspace_exists() {
        let _guard = workspace_env_lock()
            .lock()
            .expect("workspace env lock poisoned");
        let previous = std::env::var_os("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH");
        let expected = std::env::temp_dir().join("runtime-default-workspace");

        unsafe {
            std::env::set_var(
                "CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH",
                expected.as_os_str(),
            );
        }

        let mut state = RuntimeState::default();
        ensure_workspace(&mut state, "workspace-env", "gpt-5.4");

        let workspace = state
            .workspaces
            .iter()
            .find(|entry| entry.id == "workspace-env")
            .expect("env workspace should be registered");
        assert_eq!(workspace.path, expected.to_string_lossy());

        unsafe {
            match previous {
                Some(value) => {
                    std::env::set_var("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH", value)
                }
                None => std::env::remove_var("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH"),
            }
        }
    }

    #[test]
    fn ensure_workspace_falls_back_to_current_dir_when_no_workspace_exists() {
        let _guard = workspace_env_lock()
            .lock()
            .expect("workspace env lock poisoned");
        let previous = std::env::var_os("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH");

        unsafe {
            std::env::remove_var("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH");
        }

        let mut state = RuntimeState::default();
        ensure_workspace(&mut state, "workspace-cwd", "gpt-5.4");

        let workspace = state
            .workspaces
            .iter()
            .find(|entry| entry.id == "workspace-cwd")
            .expect("cwd workspace should be registered");
        assert_eq!(
            workspace.path,
            std::env::current_dir()
                .expect("current dir should resolve")
                .to_string_lossy()
                .to_string()
        );

        unsafe {
            match previous {
                Some(value) => {
                    std::env::set_var("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH", value)
                }
                None => std::env::remove_var("CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH"),
            }
        }
    }
}
