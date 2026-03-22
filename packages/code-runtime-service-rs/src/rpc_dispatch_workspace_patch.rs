use super::*;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command as TokioCommand;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspacePatchApplyRequest {
    workspace_id: String,
    diff: String,
    #[serde(default)]
    dry_run: Option<bool>,
}

fn extract_patch_paths(diff: &str) -> Vec<String> {
    let mut paths = BTreeSet::new();
    for line in diff.lines() {
        if let Some(path) = line.strip_prefix("+++ b/") {
            let trimmed = path.trim();
            if !trimmed.is_empty() && trimmed != "/dev/null" {
                paths.insert(trimmed.to_string());
            }
            continue;
        }
        if let Some(path) = line.strip_prefix("--- a/") {
            let trimmed = path.trim();
            if !trimmed.is_empty() && trimmed != "/dev/null" {
                paths.insert(trimmed.to_string());
            }
            continue;
        }
        if let Some(rest) = line.strip_prefix("diff --git ") {
            let mut parts = rest.split_whitespace();
            let _left = parts.next();
            let right = parts.next();
            if let Some(path) = right.and_then(|value| value.strip_prefix("b/")) {
                let trimmed = path.trim();
                if !trimmed.is_empty() && trimmed != "/dev/null" {
                    paths.insert(trimmed.to_string());
                }
            }
        }
    }
    paths.into_iter().collect()
}

fn ensure_git_repository(workspace_path: &Path) -> Result<(), String> {
    let git_dir = workspace_path.join(".git");
    if git_dir.exists() {
        return Ok(());
    }
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(workspace_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| format!("Failed to inspect git repository: {error}"))?;
    if output.success() {
        Ok(())
    } else {
        Err("Workspace patch apply requires a git repository.".to_string())
    }
}

async fn run_git_apply(
    workspace_path: &Path,
    patch_path: &Path,
    dry_run: bool,
) -> Result<(bool, String, String, Option<String>), String> {
    let mut command = TokioCommand::new("git");
    command.current_dir(workspace_path);
    command.arg("apply");
    if dry_run {
        command.arg("--check");
    }
    command.args(["--recount", "--whitespace=nowarn"]);
    command.arg(patch_path);
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let output = command
        .output()
        .await
        .map_err(|error| format!("Failed to run git apply: {error}"))?;
    let stdout = String::from_utf8_lossy(output.stdout.as_slice())
        .trim()
        .to_string();
    let stderr = String::from_utf8_lossy(output.stderr.as_slice())
        .trim()
        .to_string();
    if output.status.success() {
        return Ok((true, stdout, stderr, None));
    }
    let error = if stderr.is_empty() {
        format!(
            "git apply failed with exit code {}.",
            output.status.code().unwrap_or(-1)
        )
    } else {
        stderr.clone()
    };
    Ok((false, stdout, stderr, Some(error)))
}

async fn write_temp_patch_file(diff: String) -> Result<PathBuf, RpcError> {
    tokio::task::spawn_blocking(move || -> Result<PathBuf, String> {
        let patch_path =
            std::env::temp_dir().join(format!("hypecode-workspace-patch-{}.diff", Uuid::new_v4()));
        std::fs::write(patch_path.as_path(), diff.as_bytes())
            .map_err(|error| format!("Write temp patch file: {error}"))?;
        Ok(patch_path)
    })
    .await
    .map_err(|error| RpcError::internal(format!("create temp patch task join failed: {error}")))?
    .map_err(RpcError::internal)
}

pub(super) async fn handle_workspace_patch_apply_v1(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let request: WorkspacePatchApplyRequest =
        serde_json::from_value(params.clone()).map_err(|error| {
            RpcError::invalid_params(format!("Invalid workspace patch payload: {error}"))
        })?;

    if request.diff.trim().is_empty() {
        return Err(RpcError::invalid_params("diff must not be empty."));
    }

    let workspace_path =
        super::workspace_git_dispatch::resolve_workspace_path(ctx, request.workspace_id.as_str())
            .await?;
    ensure_git_repository(workspace_path.as_path()).map_err(RpcError::invalid_params)?;

    let patch_path = write_temp_patch_file(request.diff.clone()).await?;

    let touched_files = extract_patch_paths(request.diff.as_str());
    let dry_run = request.dry_run.unwrap_or(false);
    let apply_result = run_git_apply(workspace_path.as_path(), patch_path.as_path(), dry_run).await;
    if let Err(error) = std::fs::remove_file(patch_path.as_path()) {
        tracing::debug!(path = ?patch_path, ?error, "Failed to remove workspace patch temp file");
    }
    let (ok, stdout, stderr, error) = apply_result.map_err(RpcError::internal)?;

    Ok(json!({
        "workspaceId": request.workspace_id,
        "ok": ok,
        "applied": ok && !dry_run,
        "dryRun": dry_run,
        "files": touched_files,
        "stdout": stdout,
        "stderr": stderr,
        "error": error,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn init_git_repo(root: &Path) {
        let status = std::process::Command::new("git")
            .args(["init", "-q"])
            .current_dir(root)
            .status()
            .expect("git init");
        assert!(status.success());
    }

    #[tokio::test]
    async fn workspace_patch_apply_dry_run_does_not_modify_files() {
        let temp = TempDir::new().expect("temp dir");
        init_git_repo(temp.path());
        let file_path = temp.path().join("example.txt");
        fs::write(file_path.as_path(), "before\n").expect("write file");
        let patch = "\
diff --git a/example.txt b/example.txt
index 6243d32..11a7c16 100644
--- a/example.txt
+++ b/example.txt
@@ -1 +1 @@
-before
+after
";

        let patch_file = write_temp_patch_file(patch.to_string())
            .await
            .expect("patch file");
        let (ok, _, _, error) = run_git_apply(temp.path(), patch_file.as_path(), true)
            .await
            .expect("run git apply");
        fs::remove_file(patch_file.as_path()).expect("remove patch");

        assert!(ok);
        assert_eq!(error, None);
        assert_eq!(
            fs::read_to_string(file_path).expect("read file"),
            "before\n"
        );
        assert_eq!(extract_patch_paths(patch), vec!["example.txt".to_string()]);
    }

    #[tokio::test]
    async fn workspace_patch_apply_updates_workspace_file() {
        let temp = TempDir::new().expect("temp dir");
        init_git_repo(temp.path());
        let file_path = temp.path().join("example.txt");
        fs::write(file_path.as_path(), "before\n").expect("write file");
        let patch = "\
diff --git a/example.txt b/example.txt
index 6243d32..11a7c16 100644
--- a/example.txt
+++ b/example.txt
@@ -1 +1 @@
-before
+after
";

        let patch_file = write_temp_patch_file(patch.to_string())
            .await
            .expect("patch file");
        let (ok, _, _, error) = run_git_apply(temp.path(), patch_file.as_path(), false)
            .await
            .expect("run git apply");
        fs::remove_file(patch_file.as_path()).expect("remove patch");

        assert!(ok);
        assert_eq!(error, None);
        assert_eq!(fs::read_to_string(file_path).expect("read file"), "after\n");
    }
}
