use serde::Serialize;
use serde_json::Value;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::local_codex_paths::resolve_local_codex_sessions_root;

const MAX_CLI_SESSIONS: usize = 64;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliSessionSummary {
    pub session_id: String,
    pub updated_at: u64,
    pub path: String,
}

#[tauri::command]
pub fn code_cli_sessions_list() -> Vec<CliSessionSummary> {
    let Some(root) = resolve_codex_sessions_root() else {
        return Vec::new();
    };
    collect_cli_sessions(root.as_path(), MAX_CLI_SESSIONS)
}

fn resolve_codex_sessions_root() -> Option<PathBuf> {
    resolve_local_codex_sessions_root()
}

fn collect_cli_sessions(root: &Path, limit: usize) -> Vec<CliSessionSummary> {
    if !root.exists() {
        return Vec::new();
    }

    let mut collected = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(next_dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(next_dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_dir() {
                stack.push(path);
                continue;
            }
            if !file_type.is_file() || !is_rollout_file(path.as_path()) {
                continue;
            }

            if let Some(summary) = parse_cli_session_rollout(path.as_path()) {
                collected.push(summary);
            }
        }
    }

    collected.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.session_id.cmp(&right.session_id))
    });
    if collected.len() > limit {
        collected.truncate(limit);
    }
    collected
}

fn is_rollout_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("jsonl"))
        .unwrap_or(false)
}

fn parse_cli_session_rollout(path: &Path) -> Option<CliSessionSummary> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    let line_size = reader.read_line(&mut first_line).ok()?;
    if line_size == 0 {
        return None;
    }

    let payload: Value = serde_json::from_str(first_line.trim()).ok()?;
    let session_id = payload
        .get("payload")
        .and_then(Value::as_object)
        .and_then(|session_payload| session_payload.get("id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_string();

    let updated_at = fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(system_time_to_epoch_ms)
        .unwrap_or(0);

    Some(CliSessionSummary {
        session_id,
        updated_at,
        path: path.to_string_lossy().to_string(),
    })
}

fn system_time_to_epoch_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

#[cfg(test)]
mod tests {
    use super::{collect_cli_sessions, parse_cli_session_rollout};
    use std::fs;
    use std::io::Write;

    fn write_rollout(
        root: &std::path::Path,
        file_name: &str,
        session_id: &str,
    ) -> std::path::PathBuf {
        let path = root.join(file_name);
        let mut file = fs::File::create(&path).expect("create rollout file");
        writeln!(
            file,
            r#"{{"timestamp":"2026-02-11T00:00:00.000Z","type":"session_meta","payload":{{"id":"{session_id}"}}}}"#
        )
        .expect("write session meta");
        path
    }

    #[test]
    fn parse_rollout_returns_session_summary() {
        let temp_root =
            std::env::temp_dir().join(format!("code-tauri-cli-sessions-{}", std::process::id()));
        fs::create_dir_all(&temp_root).expect("create temp root");
        let rollout_path = write_rollout(&temp_root, "rollout-a.jsonl", "session-a");

        let parsed = parse_cli_session_rollout(rollout_path.as_path()).expect("parsed summary");
        assert_eq!(parsed.session_id, "session-a");
        assert!(parsed.path.ends_with("rollout-a.jsonl"));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn collect_rollouts_returns_non_empty_for_valid_tree() {
        let temp_root = std::env::temp_dir().join(format!(
            "code-tauri-cli-sessions-tree-{}",
            std::process::id()
        ));
        let day_dir = temp_root.join("2026/02/11");
        fs::create_dir_all(&day_dir).expect("create nested temp root");
        let _ = write_rollout(&day_dir, "rollout-a.jsonl", "session-a");
        let _ = write_rollout(&day_dir, "rollout-b.jsonl", "session-b");

        let sessions = collect_cli_sessions(temp_root.as_path(), 64);
        assert!(!sessions.is_empty());
        assert!(sessions.iter().any(|entry| entry.session_id == "session-a"));
        assert!(sessions.iter().any(|entry| entry.session_id == "session-b"));

        let _ = fs::remove_dir_all(&temp_root);
    }
}
