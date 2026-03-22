use serde::Serialize;

use super::common_utils::remove_path_if_exists;
use super::git_utils::{
    parse_change_id, parse_git_branches, parse_git_changes, parse_untracked_git_changes, run_git,
    run_git_command, run_git_operation, stderr_or_default, validate_branch_name,
};
use super::RuntimeBackend;

const GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES: usize = 256 * 1024;
const GIT_DIFF_READ_PAGE_MAX_BYTES_LIMIT: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGitChangeEntry {
    pub id: String,
    pub path: String,
    pub status: String,
    pub summary: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGitChangesSnapshot {
    pub staged: Vec<RuntimeGitChangeEntry>,
    pub unstaged: Vec<RuntimeGitChangeEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGitDiff {
    pub id: String,
    pub diff: String,
    pub has_more: bool,
    pub next_offset: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGitBranchEntry {
    pub name: String,
    pub last_used_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGitBranchesSnapshot {
    pub current_branch: Option<String>,
    pub branches: Vec<RuntimeGitBranchEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGitOperationResult {
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeGitCommitResult {
    pub committed: bool,
    pub committed_count: usize,
    pub error: Option<String>,
}

impl RuntimeBackend {
    pub fn git_changes(&self, workspace_id: &str) -> RuntimeGitChangesSnapshot {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitChangesSnapshot {
                staged: Vec::new(),
                unstaged: Vec::new(),
            };
        };

        let staged = run_git(&root, &["diff", "--cached", "--name-status"])
            .map(|output| parse_git_changes(&output, true))
            .unwrap_or_default();
        let unstaged = run_git(&root, &["diff", "--name-status"])
            .map(|output| parse_git_changes(&output, false))
            .unwrap_or_default();
        let untracked = run_git(&root, &["ls-files", "--others", "--exclude-standard"])
            .map(parse_untracked_git_changes)
            .unwrap_or_default();

        let mut merged_unstaged = unstaged;
        for entry in untracked {
            if merged_unstaged
                .iter()
                .any(|candidate| candidate.path == entry.path)
            {
                continue;
            }
            merged_unstaged.push(entry);
        }
        merged_unstaged.sort_by(|left, right| left.path.cmp(&right.path));

        RuntimeGitChangesSnapshot {
            staged,
            unstaged: merged_unstaged,
        }
    }

    pub fn git_diff_read(
        &self,
        workspace_id: &str,
        change_id: &str,
        offset: Option<usize>,
        max_bytes: Option<usize>,
    ) -> Option<RuntimeGitDiff> {
        let root = self.workspace_root(workspace_id)?;
        let (staged, relative_path) = parse_change_id(change_id)?;
        let normalized_offset = offset.unwrap_or(0);
        let normalized_max_bytes = max_bytes
            .unwrap_or(GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES)
            .min(GIT_DIFF_READ_PAGE_MAX_BYTES_LIMIT);
        if normalized_max_bytes == 0 {
            return None;
        }

        let mut args: Vec<&str> = if staged {
            vec!["diff", "--cached", "--"]
        } else {
            vec!["diff", "--"]
        };
        args.push(relative_path.as_str());

        let mut diff = run_git(&root, &args).unwrap_or_default();
        if diff.trim().is_empty() {
            let status = run_git(&root, &["status", "--short", "--", relative_path.as_str()])
                .unwrap_or_default();
            diff = if status.trim().is_empty() {
                format!("No diff output for {relative_path}.")
            } else {
                format!("No patch output for {relative_path}.\n{status}")
            };
        }
        let normalized_diff = diff.trim_end();
        if normalized_diff.is_empty() {
            return None;
        }
        let (page, next_offset) =
            slice_git_diff_page(normalized_diff, normalized_offset, normalized_max_bytes);

        Some(RuntimeGitDiff {
            id: change_id.to_string(),
            diff: page,
            has_more: next_offset.is_some(),
            next_offset: next_offset.and_then(|value| u64::try_from(value).ok()),
        })
    }

    pub fn git_branches(&self, workspace_id: &str) -> RuntimeGitBranchesSnapshot {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitBranchesSnapshot {
                current_branch: None,
                branches: Vec::new(),
            };
        };

        let current_branch = run_git(&root, &["branch", "--show-current"])
            .map(|output| output.trim().to_string())
            .filter(|value| !value.is_empty());

        let mut branches = run_git(
            &root,
            &[
                "for-each-ref",
                "--sort=-committerdate",
                "--format=%(refname:short)|%(committerdate:unix)",
                "refs/heads",
            ],
        )
        .map(parse_git_branches)
        .unwrap_or_default();

        if branches.is_empty() {
            if let Some(name) = &current_branch {
                branches.push(RuntimeGitBranchEntry {
                    name: name.clone(),
                    last_used_at: 0,
                });
            }
        }

        RuntimeGitBranchesSnapshot {
            current_branch,
            branches,
        }
    }

    pub fn git_branch_create(
        &self,
        workspace_id: &str,
        branch_name: &str,
    ) -> RuntimeGitOperationResult {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("workspace root is unavailable".to_string()),
            };
        };

        let normalized = match validate_branch_name(&root, branch_name) {
            Ok(normalized) => normalized,
            Err(error) => {
                return RuntimeGitOperationResult {
                    ok: false,
                    error: Some(error),
                };
            }
        };

        let Ok(output) = run_git_command(&root, &["checkout", "-b", normalized.as_str()]) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("failed to run git checkout -b".to_string()),
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
            error: stderr_or_default(output.stderr, "failed to create branch"),
        }
    }

    pub fn git_branch_checkout(
        &self,
        workspace_id: &str,
        branch_name: &str,
    ) -> RuntimeGitOperationResult {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("workspace root is unavailable".to_string()),
            };
        };

        let normalized = match validate_branch_name(&root, branch_name) {
            Ok(normalized) => normalized,
            Err(error) => {
                return RuntimeGitOperationResult {
                    ok: false,
                    error: Some(error),
                };
            }
        };

        let Ok(output) = run_git_command(&root, &["checkout", normalized.as_str()]) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("failed to run git checkout".to_string()),
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
            error: stderr_or_default(output.stderr, "failed to checkout branch"),
        }
    }

    pub fn git_stage_change(
        &self,
        workspace_id: &str,
        change_id: &str,
    ) -> RuntimeGitOperationResult {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("workspace root is unavailable".to_string()),
            };
        };

        let Some((_, relative_path)) = parse_change_id(change_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("invalid change id".to_string()),
            };
        };

        run_git_operation(
            &root,
            &["add", "--", relative_path.as_str()],
            "failed to stage file",
        )
    }

    pub fn git_stage_all(&self, workspace_id: &str) -> RuntimeGitOperationResult {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("workspace root is unavailable".to_string()),
            };
        };

        run_git_operation(&root, &["add", "-A"], "failed to stage all changes")
    }

    pub fn git_unstage_change(
        &self,
        workspace_id: &str,
        change_id: &str,
    ) -> RuntimeGitOperationResult {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("workspace root is unavailable".to_string()),
            };
        };

        let Some((_, relative_path)) = parse_change_id(change_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("invalid change id".to_string()),
            };
        };

        let restore_attempt = run_git_operation(
            &root,
            &["restore", "--staged", "--", relative_path.as_str()],
            "",
        );
        if restore_attempt.ok {
            return restore_attempt;
        }

        run_git_operation(
            &root,
            &["reset", "HEAD", "--", relative_path.as_str()],
            "failed to unstage file",
        )
    }

    pub fn git_revert_change(
        &self,
        workspace_id: &str,
        change_id: &str,
    ) -> RuntimeGitOperationResult {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("workspace root is unavailable".to_string()),
            };
        };

        let Some((_, relative_path)) = parse_change_id(change_id) else {
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("invalid change id".to_string()),
            };
        };

        let status = run_git(
            &root,
            &["status", "--porcelain", "--", relative_path.as_str()],
        )
        .unwrap_or_default();
        if status.trim_start().starts_with("??") {
            let absolute = root.join(relative_path.as_str());
            if remove_path_if_exists(&absolute) {
                return RuntimeGitOperationResult {
                    ok: true,
                    error: None,
                };
            }
            return RuntimeGitOperationResult {
                ok: false,
                error: Some("failed to remove untracked file".to_string()),
            };
        }

        let restore_result = run_git_operation(
            &root,
            &[
                "restore",
                "--source=HEAD",
                "--staged",
                "--worktree",
                "--",
                relative_path.as_str(),
            ],
            "",
        );
        if restore_result.ok {
            return restore_result;
        }

        run_git_operation(
            &root,
            &["checkout", "--", relative_path.as_str()],
            "failed to revert change",
        )
    }

    pub fn git_commit(&self, workspace_id: &str, message: &str) -> RuntimeGitCommitResult {
        let Some(root) = self.workspace_root(workspace_id) else {
            return RuntimeGitCommitResult {
                committed: false,
                committed_count: 0,
                error: Some("workspace root is unavailable".to_string()),
            };
        };

        let normalized = message.trim();
        if normalized.is_empty() {
            return RuntimeGitCommitResult {
                committed: false,
                committed_count: 0,
                error: Some("commit message is required".to_string()),
            };
        }

        let staged_count = run_git(&root, &["diff", "--cached", "--name-only"])
            .map(|output| {
                output
                    .lines()
                    .filter(|line| !line.trim().is_empty())
                    .count()
            })
            .unwrap_or(0);
        if staged_count == 0 {
            return RuntimeGitCommitResult {
                committed: false,
                committed_count: 0,
                error: None,
            };
        }

        let Ok(output) = run_git_command(&root, &["commit", "-m", normalized]) else {
            return RuntimeGitCommitResult {
                committed: false,
                committed_count: 0,
                error: Some("failed to run git commit".to_string()),
            };
        };

        if output.status.success() {
            return RuntimeGitCommitResult {
                committed: true,
                committed_count: staged_count,
                error: None,
            };
        }

        RuntimeGitCommitResult {
            committed: false,
            committed_count: 0,
            error: stderr_or_default(output.stderr, "failed to commit changes"),
        }
    }
}

fn clamp_utf8_boundary(value: &str, mut index: usize) -> usize {
    if index >= value.len() {
        return value.len();
    }
    while index > 0 && !value.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn next_utf8_boundary(value: &str, start: usize) -> usize {
    if start >= value.len() {
        return value.len();
    }
    let mut index = start + 1;
    while index < value.len() && !value.is_char_boundary(index) {
        index += 1;
    }
    index.min(value.len())
}

fn slice_git_diff_page(diff: &str, offset: usize, max_bytes: usize) -> (String, Option<usize>) {
    if diff.is_empty() {
        return (String::new(), None);
    }
    let start = clamp_utf8_boundary(diff, offset.min(diff.len()));
    if start >= diff.len() {
        return (String::new(), None);
    }
    let desired_end = start.saturating_add(max_bytes).min(diff.len());
    let mut end = clamp_utf8_boundary(diff, desired_end);
    if end <= start {
        end = next_utf8_boundary(diff, start);
    }
    let page = diff[start..end].to_string();
    let next_offset = if end < diff.len() { Some(end) } else { None };
    (page, next_offset)
}
