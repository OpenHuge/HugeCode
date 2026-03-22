use std::fs;
use std::path::{Path, PathBuf};

use super::RuntimeWorkspaceFileEntry;

pub(super) fn resolve_workspace_root(workspace_path: &str) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let candidate = if Path::new(workspace_path).is_absolute() {
        PathBuf::from(workspace_path)
    } else {
        cwd.join(workspace_path)
    };

    let canonical = candidate.canonicalize().ok()?;
    canonical.is_dir().then_some(canonical)
}

pub(super) fn collect_workspace_file_paths(root: &Path, max_files: usize) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        if files.len() >= max_files {
            break;
        }

        let mut entries = match fs::read_dir(&dir) {
            Ok(rows) => rows.flatten().collect::<Vec<_>>(),
            Err(_) => continue,
        };
        entries.sort_by_key(|entry| entry.path());

        for entry in entries {
            if files.len() >= max_files {
                break;
            }

            let path = entry.path();
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default();

            if entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                if should_skip_directory(file_name) {
                    continue;
                }
                stack.push(path);
                continue;
            }

            if !is_supported_text_file(&path) {
                continue;
            }

            files.push(path);
        }
    }

    files
}

fn should_skip_directory(name: &str) -> bool {
    matches!(
        name,
        ".git" | ".turbo" | "node_modules" | "target" | "dist" | "coverage"
    )
}

fn is_supported_text_file(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|ext| ext.to_str()) else {
        return false;
    };

    matches!(
        extension,
        "md" | "markdown" | "ts" | "tsx" | "js" | "jsx" | "json" | "rs" | "toml" | "css"
    )
}

pub(super) fn build_workspace_file_entry(
    root: &Path,
    absolute_path: &Path,
) -> Option<RuntimeWorkspaceFileEntry> {
    let relative = absolute_path.strip_prefix(root).ok()?;
    let relative_path = relative.to_string_lossy().replace('\\', "/");

    Some(RuntimeWorkspaceFileEntry {
        id: relative_path.clone(),
        path: relative_path,
        summary: describe_file(absolute_path),
    })
}

pub(super) fn describe_file(path: &Path) -> String {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("file")
        .to_ascii_uppercase();
    let bytes = fs::metadata(path).map(|meta| meta.len()).unwrap_or(0);

    format!("{extension} · {bytes} B")
}

pub(super) fn resolve_workspace_file(root: &Path, file_id: &str) -> Option<PathBuf> {
    if file_id.is_empty() {
        return None;
    }

    let absolute = root.join(file_id);
    let canonical_root = root.canonicalize().ok()?;
    let canonical_file = absolute.canonicalize().ok()?;

    if !canonical_file.starts_with(canonical_root) || !canonical_file.is_file() {
        return None;
    }

    Some(canonical_file)
}
