use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) fn derive_thread_title(content: &str) -> String {
    let trimmed = content.trim();

    if trimmed.is_empty() {
        return "New thread".to_string();
    }

    let first_line = trimmed.lines().next().unwrap_or(trimmed);
    let mut chars = first_line.chars();
    let title: String = chars.by_ref().take(64).collect();

    if chars.next().is_some() {
        format!("{title}...")
    } else {
        title
    }
}

#[cfg(test)]
pub(super) fn normalize_workspace_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        ".".to_string()
    } else {
        trimmed.to_string()
    }
}

pub(super) fn normalize_workspace_display_name(
    display_name: Option<&str>,
    path: &str,
    workspace_id: &str,
) -> String {
    let normalized = display_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    if let Some(value) = normalized {
        return value;
    }

    let inferred = Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    if let Some(value) = inferred {
        return value;
    }

    format!("Workspace {workspace_id}")
}

pub(super) fn unix_timestamp_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

pub(super) fn truncate_text(content: String, max_chars: usize) -> String {
    if content.chars().count() <= max_chars {
        return content;
    }

    let mut result = content.chars().take(max_chars).collect::<String>();
    result.push_str("\n\n... (truncated)");
    result
}

pub(super) fn remove_path_if_exists(path: &Path) -> bool {
    if !path.exists() {
        return true;
    }

    if path.is_file() {
        return fs::remove_file(path).is_ok();
    }

    if path.is_dir() {
        return fs::remove_dir_all(path).is_ok();
    }

    false
}
