use std::io;
use std::path::Path;
use std::process::Command;

use super::{RuntimeGitBranchEntry, RuntimeGitChangeEntry, RuntimeGitOperationResult};

pub(super) fn run_git_command(root: &Path, args: &[&str]) -> io::Result<std::process::Output> {
    Command::new("git").arg("-C").arg(root).args(args).output()
}

pub(super) fn run_git(root: &Path, args: &[&str]) -> Option<String> {
    let output = run_git_command(root, args).ok()?;

    if !output.status.success() {
        return None;
    }

    String::from_utf8(output.stdout).ok()
}

pub(super) fn run_git_operation(
    root: &Path,
    args: &[&str],
    fallback_error: &str,
) -> RuntimeGitOperationResult {
    let Ok(output) = run_git_command(root, args) else {
        return RuntimeGitOperationResult {
            ok: false,
            error: Some("failed to execute git".to_string()),
        };
    };

    if output.status.success() {
        return RuntimeGitOperationResult {
            ok: true,
            error: None,
        };
    }

    RuntimeGitOperationResult {
        ok: false,
        error: stderr_or_default(output.stderr, fallback_error),
    }
}

pub(super) fn stderr_or_default(stderr: Vec<u8>, fallback: &str) -> Option<String> {
    let normalized = String::from_utf8_lossy(&stderr).trim().to_string();
    if !normalized.is_empty() {
        return Some(normalized);
    }

    if fallback.is_empty() {
        None
    } else {
        Some(fallback.to_string())
    }
}

pub(super) fn parse_git_changes(output: &str, staged: bool) -> Vec<RuntimeGitChangeEntry> {
    let mut changes = output
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\t');
            let status = parts.next()?.trim().to_string();
            let path = parts.last()?.trim().to_string();
            let prefix = if staged { "staged:" } else { "unstaged:" };

            Some(RuntimeGitChangeEntry {
                id: format!("{prefix}{path}"),
                path: path.clone(),
                status: status.clone(),
                summary: describe_git_status(&status, &path),
            })
        })
        .collect::<Vec<_>>();

    changes.sort_by(|left, right| left.path.cmp(&right.path));
    changes
}

pub(super) fn parse_untracked_git_changes(output: String) -> Vec<RuntimeGitChangeEntry> {
    let mut changes = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|path| RuntimeGitChangeEntry {
            id: format!("unstaged:{path}"),
            path: path.to_string(),
            status: "??".to_string(),
            summary: format!("Untracked · {path}"),
        })
        .collect::<Vec<_>>();
    changes.sort_by(|left, right| left.path.cmp(&right.path));
    changes
}

pub(super) fn parse_git_branches(output: String) -> Vec<RuntimeGitBranchEntry> {
    output
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('|');
            let name = parts.next()?.trim().to_string();
            if name.is_empty() {
                return None;
            }
            let last_used_at = parts
                .next()
                .and_then(|raw| raw.trim().parse::<u64>().ok())
                .unwrap_or(0);

            Some(RuntimeGitBranchEntry { name, last_used_at })
        })
        .collect::<Vec<_>>()
}

pub(super) fn parse_change_id(change_id: &str) -> Option<(bool, String)> {
    if let Some(path) = change_id.strip_prefix("staged:") {
        return Some((true, path.to_string()));
    }
    if let Some(path) = change_id.strip_prefix("unstaged:") {
        return Some((false, path.to_string()));
    }
    None
}

pub(super) fn normalize_branch_name(name: &str) -> String {
    name.trim().split_whitespace().collect::<Vec<_>>().join("-")
}

pub(super) fn validate_branch_name(root: &Path, name: &str) -> Result<String, String> {
    let normalized = normalize_branch_name(name);
    if normalized.is_empty() {
        return Err("branch name is required".to_string());
    }
    if normalized.starts_with('-') {
        return Err("branch name cannot start with '-'".to_string());
    }

    let output = run_git_command(root, &["check-ref-format", "--branch", normalized.as_str()])
        .map_err(|_| "failed to validate branch name".to_string())?;
    if output.status.success() {
        Ok(normalized)
    } else {
        Err("invalid branch name".to_string())
    }
}

fn describe_git_status(status: &str, path: &str) -> String {
    let kind = match status.chars().next() {
        Some('A') => "Added",
        Some('M') => "Modified",
        Some('D') => "Deleted",
        Some('R') => "Renamed",
        Some('C') => "Copied",
        Some('U') => "Unmerged",
        _ => "Changed",
    };

    format!("{kind} · {path}")
}
