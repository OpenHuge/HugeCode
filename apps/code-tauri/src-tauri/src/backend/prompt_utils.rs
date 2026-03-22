use std::fs;
use std::path::{Component, Path, PathBuf};

use super::common_utils::truncate_text;
use super::{RuntimePromptLibraryEntry, RuntimePromptScope};

pub(super) fn resolve_global_prompt_root() -> Option<PathBuf> {
    std::env::current_dir().ok()?.canonicalize().ok()
}

pub(super) fn prompt_library_dir(root: &Path) -> PathBuf {
    root.join(".github").join("codex").join("prompts")
}

pub(super) fn collect_prompt_entries(
    prompt_dir: &Path,
    scope: RuntimePromptScope,
    buffer: &mut Vec<RuntimePromptLibraryEntry>,
) {
    let Ok(entries) = fs::read_dir(prompt_dir) else {
        return;
    };

    let mut next_entries = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && path.extension().is_some_and(|ext| ext == "md"))
        .collect::<Vec<_>>();
    next_entries.sort();

    for path in next_entries {
        if let Some(entry) = build_prompt_entry(prompt_dir, &path, scope) {
            buffer.push(entry);
        }
    }
}

pub(super) fn parse_prompt_entry_id(prompt_id: &str) -> Option<(RuntimePromptScope, String)> {
    let trimmed = prompt_id.trim();
    if trimmed.is_empty() {
        return None;
    }
    let (scope_raw, relative_path_raw) = trimmed.split_once(':')?;
    let scope = match scope_raw.trim() {
        "global" => RuntimePromptScope::Global,
        "workspace" => RuntimePromptScope::Workspace,
        _ => return None,
    };
    let relative_path = relative_path_raw.trim();
    if relative_path.is_empty() {
        return None;
    }
    if !is_safe_prompt_relative_path(relative_path) {
        return None;
    }
    Some((scope, relative_path.to_string()))
}

fn is_safe_prompt_relative_path(relative_path: &str) -> bool {
    if relative_path.is_empty() {
        return false;
    }
    let path = Path::new(relative_path);
    if path.is_absolute() {
        return false;
    }
    if !path
        .components()
        .all(|component| matches!(component, Component::Normal(_)))
    {
        return false;
    }
    path.extension().is_some_and(|ext| ext == "md")
}

pub(super) fn resolve_prompt_file_path(
    prompt_dir: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    if !is_safe_prompt_relative_path(relative_path) {
        return Err("invalid prompt path".to_string());
    }
    Ok(prompt_dir.join(relative_path))
}

fn normalize_prompt_file_stem(input: &str) -> String {
    let normalized = input
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>();
    let collapsed = normalized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "prompt".to_string()
    } else {
        collapsed
    }
}

pub(super) fn resolve_unique_prompt_path(prompt_dir: &Path, title: &str) -> PathBuf {
    let stem = normalize_prompt_file_stem(title);
    let mut candidate = prompt_dir.join(format!("{stem}.md"));
    let mut suffix = 2_u32;
    while candidate.exists() {
        candidate = prompt_dir.join(format!("{stem}-{suffix}.md"));
        suffix = suffix.saturating_add(1);
    }
    candidate
}

pub(super) fn build_prompt_document(title: &str, description: &str, content: &str) -> String {
    let normalized_title = title.trim();
    let normalized_description = description.trim();
    let normalized_content = content.trim();

    let mut lines = Vec::new();
    lines.push(format!("# {normalized_title}"));

    if !normalized_description.is_empty() {
        lines.push(String::new());
        lines.push(normalized_description.to_string());
    }

    if !normalized_content.is_empty() {
        lines.push(String::new());
        lines.push(normalized_content.to_string());
    }

    format!("{}\n", lines.join("\n"))
}

pub(super) fn build_prompt_entry(
    prompt_dir: &Path,
    path: &Path,
    scope: RuntimePromptScope,
) -> Option<RuntimePromptLibraryEntry> {
    let raw = fs::read_to_string(path).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let relative = path
        .strip_prefix(prompt_dir)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    let title = first_markdown_heading(trimmed).unwrap_or_else(|| {
        path.file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("Prompt")
            .replace('-', " ")
    });
    let description = trimmed
        .lines()
        .find_map(|line| {
            let next = line.trim();
            if next.is_empty() || next.starts_with('#') {
                None
            } else {
                Some(next.to_string())
            }
        })
        .unwrap_or_else(|| "Runtime prompt source".to_string());

    Some(RuntimePromptLibraryEntry {
        id: format!("{}:{relative}", scope.as_str()),
        title,
        description: truncate_text(description, 120),
        content: trimmed.to_string(),
        scope,
    })
}

fn first_markdown_heading(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let text = line.trim();
        if !text.starts_with('#') {
            return None;
        }

        let heading = text.trim_start_matches('#').trim();
        (!heading.is_empty()).then(|| heading.to_string())
    })
}
