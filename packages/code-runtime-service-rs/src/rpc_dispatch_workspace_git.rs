use super::*;

const WORKSPACE_FILES_LIST_MAX_RESULTS: usize = 1_000;
const WORKSPACE_FILE_READ_MAX_BYTES: usize = 512 * 1024;
const GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES: usize = 256 * 1024;
const GIT_DIFF_READ_PAGE_MAX_BYTES_LIMIT: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFileSummaryPayload {
    id: String,
    path: String,
    summary: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFileContentPayload {
    id: String,
    path: String,
    summary: String,
    content: String,
}

fn normalize_workspace_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub(crate) async fn resolve_workspace_path(
    ctx: &AppContext,
    workspace_id: &str,
) -> Result<PathBuf, RpcError> {
    let state = ctx.state.read().await;
    let workspace_path = state
        .workspaces
        .iter()
        .find(|entry| entry.id == workspace_id)
        .map(|entry| entry.path.clone())
        .ok_or_else(|| {
            RpcError::invalid_params(format!("Workspace `{workspace_id}` not found."))
        })?;
    Ok(PathBuf::from(workspace_path))
}

fn collect_workspace_files(
    workspace_root: &Path,
    directory: &Path,
    files: &mut Vec<WorkspaceFileSummaryPayload>,
) {
    if files.len() >= WORKSPACE_FILES_LIST_MAX_RESULTS {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        if files.len() >= WORKSPACE_FILES_LIST_MAX_RESULTS {
            return;
        }
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == ".git" || file_name == "node_modules" || file_name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_workspace_files(workspace_root, path.as_path(), files);
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let Ok(relative) = path.strip_prefix(workspace_root) else {
            continue;
        };
        let relative_path = normalize_workspace_path(relative);
        let metadata = fs::metadata(path.as_path()).ok();
        let bytes = metadata.map(|meta| meta.len()).unwrap_or_default();
        files.push(WorkspaceFileSummaryPayload {
            id: relative_path.clone(),
            path: relative_path,
            summary: format!("{bytes} B"),
        });
    }
}

fn resolve_workspace_file_path(
    workspace_root: &Path,
    raw_file_id: &str,
) -> Result<Option<(PathBuf, String)>, RpcError> {
    let file_id = raw_file_id.trim();
    if file_id.is_empty() {
        return Err(RpcError::invalid_params("fileId is required."));
    }
    let joined = workspace_root.join(file_id);
    if !joined.exists() || !joined.is_file() {
        return Ok(None);
    }
    let canonical_workspace = fs::canonicalize(workspace_root).map_err(|error| {
        RpcError::internal(format!(
            "resolve workspace root `{}`: {error}",
            workspace_root.display()
        ))
    })?;
    let canonical_file = fs::canonicalize(joined.as_path()).map_err(|error| {
        RpcError::internal(format!("resolve file `{}`: {error}", joined.display()))
    })?;
    if !canonical_file.starts_with(canonical_workspace.as_path()) {
        return Err(RpcError::invalid_params(
            "fileId must stay inside the workspace root.",
        ));
    }
    let relative = canonical_file
        .strip_prefix(canonical_workspace.as_path())
        .map(normalize_workspace_path)
        .map_err(|error| RpcError::internal(format!("normalize workspace file path: {error}")))?;
    Ok(Some((canonical_file, relative)))
}

pub(super) async fn handle_workspace_files_list(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let files = tokio::task::spawn_blocking(move || {
        if !workspace_path.exists() || !workspace_path.is_dir() {
            return Vec::new();
        }
        let mut files = Vec::new();
        collect_workspace_files(
            workspace_path.as_path(),
            workspace_path.as_path(),
            &mut files,
        );
        files.sort_by(|left, right| left.path.cmp(&right.path));
        files
    })
    .await
    .map_err(|error| RpcError::internal(format!("collect workspace files: {error}")))?;
    Ok(json!(files))
}

pub(super) async fn handle_workspace_file_read(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let file_id = read_required_string(params, "fileId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let workspace_path_for_read = workspace_path.clone();
    let file_id_for_read = file_id.to_string();
    let resolved =
        tokio::task::spawn_blocking(move || -> Result<Option<(String, Vec<u8>)>, RpcError> {
            let Some((file_path, relative_path)) = resolve_workspace_file_path(
                workspace_path_for_read.as_path(),
                file_id_for_read.as_str(),
            )?
            else {
                return Ok(None);
            };
            let file_path_display = file_path.display().to_string();
            let content_bytes = fs::read(file_path.as_path()).map_err(|error| {
                RpcError::internal(format!(
                    "read workspace file `{file_path_display}`: {error}"
                ))
            })?;
            Ok(Some((relative_path, content_bytes)))
        })
        .await
        .map_err(|error| {
            RpcError::internal(format!("read workspace file task join error: {error}"))
        })??;
    let Some((relative_path, content_bytes)) = resolved else {
        return Ok(Value::Null);
    };
    let truncated = content_bytes.len() > WORKSPACE_FILE_READ_MAX_BYTES;
    let content_slice = if truncated {
        &content_bytes[..WORKSPACE_FILE_READ_MAX_BYTES]
    } else {
        content_bytes.as_slice()
    };
    let mut summary = format!("{} B", content_bytes.len());
    if truncated {
        summary.push_str(" (truncated)");
    }
    let payload = WorkspaceFileContentPayload {
        id: relative_path.clone(),
        path: relative_path,
        summary,
        content: String::from_utf8_lossy(content_slice).to_string(),
    };
    Ok(json!(payload))
}

pub(super) async fn handle_git_changes_list(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let output = run_git_stdout(
        workspace_path.to_string_lossy().as_ref(),
        &["status", "--porcelain=v1", "--untracked-files=all"],
    )
    .await;
    let Ok(stdout) = output else {
        return Ok(json!({"staged": [], "unstaged": []}));
    };
    let mut staged = Vec::<Value>::new();
    let mut unstaged = Vec::<Value>::new();
    for raw_line in stdout.lines() {
        if raw_line.len() < 3 {
            continue;
        }
        let status_raw = &raw_line[..2];
        let mut path = raw_line[3..].trim().to_string();
        if let Some((_, renamed_to)) = path.split_once(" -> ") {
            path = renamed_to.trim().to_string();
        }
        if path.is_empty() {
            continue;
        }
        let mut status_iter = status_raw.chars();
        let staged_status = status_iter.next().unwrap_or(' ');
        let unstaged_status = status_iter.next().unwrap_or(' ');
        if staged_status != ' ' && staged_status != '?' {
            staged.push(json!({
                "id": path.clone(),
                "path": path.clone(),
                "status": staged_status.to_string(),
                "summary": format!("staged {staged_status}"),
            }));
        }
        if unstaged_status != ' ' || status_raw == "??" {
            let unstaged_status_text = if status_raw == "??" {
                "?".to_string()
            } else {
                unstaged_status.to_string()
            };
            unstaged.push(json!({
                "id": path.clone(),
                "path": path,
                "status": unstaged_status_text,
                "summary": if status_raw == "??" {
                    "untracked".to_string()
                } else {
                    format!("unstaged {unstaged_status}")
                },
            }));
        }
    }
    Ok(json!({ "staged": staged, "unstaged": unstaged }))
}

pub(super) async fn handle_git_diff_read(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let change_id = read_required_string(params, "changeId")?;
    let offset = read_optional_usize(params, "offset")?.unwrap_or(0);
    let requested_max_bytes = read_optional_usize(params, "maxBytes")?;
    let max_bytes = requested_max_bytes.unwrap_or(GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES);
    if max_bytes == 0 {
        return Err(RpcError::invalid_params("maxBytes must be greater than 0."));
    }
    let page_max_bytes = max_bytes.min(GIT_DIFF_READ_PAGE_MAX_BYTES_LIMIT);
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let cwd = workspace_path.to_string_lossy().to_string();
    let unstaged = run_git_stdout(cwd.as_str(), &["diff", "--", change_id])
        .await
        .unwrap_or_default();
    let staged = run_git_stdout(cwd.as_str(), &["diff", "--cached", "--", change_id])
        .await
        .unwrap_or_default();
    let mut diff = String::new();
    if !unstaged.trim().is_empty() {
        diff.push_str(unstaged.as_str());
    }
    if !staged.trim().is_empty() {
        if !diff.is_empty() {
            diff.push('\n');
        }
        diff.push_str(staged.as_str());
    }
    if diff.trim().is_empty() {
        return Ok(Value::Null);
    }
    let (page, next_offset) = slice_git_diff_page(diff.as_str(), offset, page_max_bytes);
    let has_more = next_offset.is_some();
    Ok(json!({
        "id": change_id,
        "diff": page,
        "hasMore": has_more,
        "nextOffset": next_offset,
    }))
}

fn read_optional_usize(
    params: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<Option<usize>, RpcError> {
    let Some(value) = read_optional_u64(params, field) else {
        return Ok(None);
    };
    usize::try_from(value)
        .map(Some)
        .map_err(|_| RpcError::invalid_params(format!("{field} exceeds supported range.")))
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

pub(super) async fn handle_git_branches_list(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let cwd = workspace_path.to_string_lossy().to_string();
    let current = run_git_stdout(cwd.as_str(), &["rev-parse", "--abbrev-ref", "HEAD"])
        .await
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && value != "HEAD");
    let branches_stdout = run_git_stdout(
        cwd.as_str(),
        &[
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(refname:short)%x00%(committerdate:unix)",
            "refs/heads",
        ],
    )
    .await
    .unwrap_or_default();
    let mut branches = Vec::<Value>::new();
    for line in branches_stdout.lines() {
        let mut parts = line.split('\0');
        let Some(name) = parts
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let last_used_at = parts
            .next()
            .and_then(|value| value.trim().parse::<u64>().ok())
            .unwrap_or_else(now_ms);
        branches.push(json!({
            "name": name,
            "lastUsedAt": last_used_at.saturating_mul(1000),
        }));
    }
    Ok(json!({
        "currentBranch": current,
        "branches": branches,
    }))
}

pub(super) async fn handle_git_branch_create(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let branch_name = read_required_string(params, "branchName")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    Ok(json!(
        git_operation_result(
            workspace_path.to_string_lossy().as_ref(),
            &["branch", branch_name]
        )
        .await
    ))
}

pub(super) async fn handle_git_branch_checkout(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let branch_name = read_required_string(params, "branchName")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    Ok(json!(
        git_operation_result(
            workspace_path.to_string_lossy().as_ref(),
            &["checkout", branch_name]
        )
        .await
    ))
}

pub(super) async fn handle_git_stage_change(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let change_id = read_required_string(params, "changeId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    Ok(json!(
        git_operation_result(
            workspace_path.to_string_lossy().as_ref(),
            &["add", "--", change_id]
        )
        .await
    ))
}

pub(super) async fn handle_git_stage_all(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    Ok(json!(
        git_operation_result(workspace_path.to_string_lossy().as_ref(), &["add", "-A"]).await
    ))
}

pub(super) async fn handle_git_unstage_change(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let change_id = read_required_string(params, "changeId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let cwd = workspace_path.to_string_lossy().to_string();
    let primary =
        git_operation_result(cwd.as_str(), &["restore", "--staged", "--", change_id]).await;
    if primary.ok {
        return Ok(json!(primary));
    }
    Ok(json!(
        git_operation_result(cwd.as_str(), &["reset", "HEAD", "--", change_id]).await
    ))
}

pub(super) async fn handle_git_revert_change(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let change_id = read_required_string(params, "changeId")?;
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let cwd = workspace_path.to_string_lossy().to_string();
    let primary = git_operation_result(
        cwd.as_str(),
        &["restore", "--staged", "--worktree", "--", change_id],
    )
    .await;
    if primary.ok {
        return Ok(json!(primary));
    }
    Ok(json!(
        git_operation_result(cwd.as_str(), &["checkout", "--", change_id]).await
    ))
}

pub(super) async fn handle_git_commit(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let message = read_required_string(params, "message")?;
    if message.trim().is_empty() {
        return Ok(
            json!({"committed": false, "committedCount": 0, "error": "commit message is required"}),
        );
    }
    let workspace_path = resolve_workspace_path(ctx, workspace_id).await?;
    let cwd = workspace_path.to_string_lossy().to_string();
    let staged_files = run_git_stdout(cwd.as_str(), &["diff", "--cached", "--name-only"])
        .await
        .unwrap_or_default();
    let staged_count = staged_files
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .count();
    if staged_count == 0 {
        return Ok(json!({
            "committed": false,
            "committedCount": 0,
            "error": "No staged changes to commit.",
        }));
    }
    match run_git_stdout(cwd.as_str(), &["commit", "-m", message]).await {
        Ok(_) => Ok(json!({
            "committed": true,
            "committedCount": staged_count,
            "error": Value::Null,
        })),
        Err(error) => Ok(json!({
            "committed": false,
            "committedCount": 0,
            "error": error,
        })),
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitOperationResultPayload {
    ok: bool,
    error: Option<String>,
}

async fn git_operation_result(cwd: &str, args: &[&str]) -> GitOperationResultPayload {
    match run_git_stdout(cwd, args).await {
        Ok(_) => GitOperationResultPayload {
            ok: true,
            error: None,
        },
        Err(error) => GitOperationResultPayload {
            ok: false,
            error: Some(error),
        },
    }
}

pub(super) async fn handle_git_log(ctx: &AppContext, params: &Value) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let workspace_id = read_required_string(params, "workspaceId")?;
    let limit = read_optional_u64(params, "limit").unwrap_or(40) as usize;
    let workspace_path = {
        let state = ctx.state.read().await;
        // Resolve workspace path before awaiting git I/O.
        state
            .workspaces
            .iter()
            .find(|w| w.id == workspace_id)
            .map(|w| w.path.clone())
            .ok_or_else(|| {
                RpcError::invalid_params(format!("Workspace {workspace_id} not found"))
            })?
    };

    // Ideally we would run actual git commands here.
    // simpler implementation for now: return empty/dummy to fix crash,
    // or try running git command if possible.
    // Attempt to run git log
    // Format: %H%x00%s%x00%an%x00%at
    let output = run_git_stdout(
        &workspace_path,
        &[
            "log",
            &format!("-n{}", limit),
            "--pretty=format:%H%x00%s%x00%an%x00%at",
        ],
    )
    .await;

    let entries = match output {
        Ok(stdout) => parse_git_log_output(&stdout),
        Err(_) => Vec::new(),
    };

    Ok(json!(GitLogResponse {
        total: entries.len(),
        entries,
        ahead: 0,
        behind: 0,
        ahead_entries: vec![],
        behind_entries: vec![],
        upstream: None,
    }))
}

async fn run_git_stdout(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = tokio::process::Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_git_log_output(stdout: &str) -> Vec<GitLogEntry> {
    stdout
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\0').collect();
            if parts.len() >= 4 {
                Some(GitLogEntry {
                    sha: parts[0].to_string(),
                    summary: parts[1].to_string(),
                    author: parts[2].to_string(),
                    timestamp: parts[3].parse().unwrap_or_default(),
                })
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slice_git_diff_page_returns_full_page_when_within_limit() {
        let diff = "small diff";
        let (page, next_offset) = slice_git_diff_page(diff, 0, 1024);
        assert_eq!(page, "small diff");
        assert_eq!(next_offset, None);
    }

    #[test]
    fn slice_git_diff_page_advances_with_next_offset() {
        let diff = "a".repeat((GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES * 2) + 32);
        let (first_page, first_next_offset) =
            slice_git_diff_page(diff.as_str(), 0, GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES);
        assert_eq!(first_page.len(), GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES);
        let Some(next_offset) = first_next_offset else {
            panic!("expected next offset for paged diff");
        };
        let (second_page, second_next_offset) = slice_git_diff_page(
            diff.as_str(),
            next_offset,
            GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES,
        );
        assert!(!second_page.is_empty());
        assert!(second_next_offset.is_some());
    }

    #[test]
    fn slice_git_diff_page_preserves_utf8_boundaries() {
        let diff = "你好".repeat((GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES / 2) + 128);
        let (page, next_offset) =
            slice_git_diff_page(diff.as_str(), 1, GIT_DIFF_READ_DEFAULT_PAGE_MAX_BYTES);
        assert!(!page.is_empty());
        assert!(page.is_char_boundary(page.len()));
        let Some(next) = next_offset else {
            panic!("expected next offset for utf8 paged diff");
        };
        assert!(diff.is_char_boundary(next));
    }
}
