use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::prompt_utils::{
    build_prompt_document, build_prompt_entry, collect_prompt_entries, parse_prompt_entry_id,
    prompt_library_dir, resolve_global_prompt_root, resolve_prompt_file_path,
    resolve_unique_prompt_path,
};
use super::RuntimeBackend;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePromptLibraryEntry {
    pub id: String,
    pub title: String,
    pub description: String,
    pub content: String,
    pub scope: RuntimePromptScope,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RuntimePromptScope {
    Global,
    Workspace,
}

impl RuntimePromptScope {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::Workspace => "workspace",
        }
    }
}

impl RuntimeBackend {
    pub fn prompt_library(&self, workspace_id: Option<&str>) -> Vec<RuntimePromptLibraryEntry> {
        let global_root = resolve_global_prompt_root();
        let workspace_root = workspace_id.and_then(|id| self.workspace_root(id));
        let same_root = global_root.as_ref() == workspace_root.as_ref();
        let mut prompts = Vec::new();

        if let Some(root) = &global_root {
            collect_prompt_entries(
                &prompt_library_dir(root),
                RuntimePromptScope::Global,
                &mut prompts,
            );
        }

        if !same_root {
            if let Some(root) = &workspace_root {
                collect_prompt_entries(
                    &prompt_library_dir(root),
                    RuntimePromptScope::Workspace,
                    &mut prompts,
                );
            }
        }

        prompts.sort_by(|left, right| {
            left.title
                .cmp(&right.title)
                .then_with(|| left.scope.as_str().cmp(right.scope.as_str()))
                .then_with(|| left.id.cmp(&right.id))
        });
        prompts
    }

    pub fn prompt_library_create(
        &self,
        workspace_id: Option<&str>,
        scope: RuntimePromptScope,
        title: &str,
        description: &str,
        content: &str,
    ) -> Result<RuntimePromptLibraryEntry, String> {
        let normalized_title = title.trim();
        if normalized_title.is_empty() {
            return Err("prompt title is required".to_string());
        }

        let prompt_dir = self.resolve_prompt_dir_for_scope(workspace_id, scope)?;
        fs::create_dir_all(&prompt_dir)
            .map_err(|error| format!("failed to create prompt directory: {error}"))?;

        let target_path = resolve_unique_prompt_path(&prompt_dir, normalized_title);
        let document = build_prompt_document(normalized_title, description, content);
        fs::write(&target_path, document)
            .map_err(|error| format!("failed to write prompt file: {error}"))?;

        build_prompt_entry(&prompt_dir, &target_path, scope)
            .ok_or_else(|| "failed to read created prompt".to_string())
    }

    pub fn prompt_library_update(
        &self,
        workspace_id: Option<&str>,
        prompt_id: &str,
        title: &str,
        description: &str,
        content: &str,
    ) -> Result<RuntimePromptLibraryEntry, String> {
        let normalized_title = title.trim();
        if normalized_title.is_empty() {
            return Err("prompt title is required".to_string());
        }

        let (scope, relative_path) =
            parse_prompt_entry_id(prompt_id).ok_or_else(|| "invalid prompt id".to_string())?;
        let prompt_dir = self.resolve_prompt_dir_for_scope(workspace_id, scope)?;
        let target_path = resolve_prompt_file_path(&prompt_dir, &relative_path)?;
        if !target_path.is_file() {
            return Err("prompt file not found".to_string());
        }

        let document = build_prompt_document(normalized_title, description, content);
        fs::write(&target_path, document)
            .map_err(|error| format!("failed to update prompt file: {error}"))?;

        build_prompt_entry(&prompt_dir, &target_path, scope)
            .ok_or_else(|| "failed to read updated prompt".to_string())
    }

    pub fn prompt_library_delete(
        &self,
        workspace_id: Option<&str>,
        prompt_id: &str,
    ) -> Result<bool, String> {
        let (scope, relative_path) =
            parse_prompt_entry_id(prompt_id).ok_or_else(|| "invalid prompt id".to_string())?;
        let prompt_dir = self.resolve_prompt_dir_for_scope(workspace_id, scope)?;
        let target_path = resolve_prompt_file_path(&prompt_dir, &relative_path)?;

        if !target_path.exists() {
            return Ok(false);
        }

        fs::remove_file(&target_path)
            .map_err(|error| format!("failed to delete prompt file: {error}"))?;
        Ok(true)
    }

    pub fn prompt_library_move(
        &self,
        workspace_id: Option<&str>,
        prompt_id: &str,
        target_scope: RuntimePromptScope,
    ) -> Result<RuntimePromptLibraryEntry, String> {
        let (source_scope, relative_path) =
            parse_prompt_entry_id(prompt_id).ok_or_else(|| "invalid prompt id".to_string())?;

        let source_dir = self.resolve_prompt_dir_for_scope(workspace_id, source_scope)?;
        let source_path = resolve_prompt_file_path(&source_dir, &relative_path)?;
        if !source_path.is_file() {
            return Err("prompt file not found".to_string());
        }

        if source_scope == target_scope {
            return build_prompt_entry(&source_dir, &source_path, source_scope)
                .ok_or_else(|| "failed to read prompt".to_string());
        }

        let target_dir = self.resolve_prompt_dir_for_scope(workspace_id, target_scope)?;
        if source_dir == target_dir {
            return Err(
                "global and workspace prompt directories are identical; move is unavailable"
                    .to_string(),
            );
        }
        fs::create_dir_all(&target_dir)
            .map_err(|error| format!("failed to create prompt directory: {error}"))?;

        let source_file_name = source_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "invalid prompt file name".to_string())?;
        let initial_target = target_dir.join(source_file_name);
        let target_path = if initial_target.exists() {
            resolve_unique_prompt_path(
                &target_dir,
                initial_target
                    .file_stem()
                    .and_then(|stem| stem.to_str())
                    .unwrap_or("prompt"),
            )
        } else {
            initial_target
        };

        if fs::rename(&source_path, &target_path).is_err() {
            fs::copy(&source_path, &target_path)
                .map_err(|error| format!("failed to move prompt file: {error}"))?;
            fs::remove_file(&source_path)
                .map_err(|error| format!("failed to remove source prompt file: {error}"))?;
        }

        build_prompt_entry(&target_dir, &target_path, target_scope)
            .ok_or_else(|| "failed to read moved prompt".to_string())
    }

    fn resolve_prompt_dir_for_scope(
        &self,
        workspace_id: Option<&str>,
        scope: RuntimePromptScope,
    ) -> Result<PathBuf, String> {
        let root = match scope {
            RuntimePromptScope::Global => resolve_global_prompt_root()
                .ok_or_else(|| "failed to resolve global prompt root".to_string())?,
            RuntimePromptScope::Workspace => {
                let workspace_id = workspace_id
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| "workspace scope requires an active workspace".to_string())?;
                self.workspace_root(workspace_id)
                    .ok_or_else(|| "failed to resolve workspace prompt root".to_string())?
            }
        };

        Ok(prompt_library_dir(&root))
    }
}
