#![cfg_attr(test, allow(dead_code))]

use super::*;
use std::{
    path::{Path, PathBuf},
    sync::mpsc,
};

pub(super) struct RuntimeToolMetricsFlushWorker {
    pub(super) sender: mpsc::Sender<RuntimeToolExecutionMetricsSnapshot>,
}

pub(super) fn runtime_tool_metrics_async_flush_enabled() -> bool {
    let default_enabled = !cfg!(test);
    std::env::var(CODE_RUNTIME_TOOL_METRICS_ASYNC_FLUSH_ENABLED_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .map(|value| !matches!(value.as_str(), "0" | "false" | "no" | "off"))
        .unwrap_or(default_enabled)
}

pub(super) fn resolve_metrics_flush_batch_size() -> usize {
    std::env::var(CODE_RUNTIME_TOOL_METRICS_FLUSH_BATCH_SIZE_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .and_then(|value| value.parse::<usize>().ok())
        .map(|value| value.clamp(1, MAX_RUNTIME_TOOL_METRICS_FLUSH_BATCH_SIZE))
        .unwrap_or(DEFAULT_RUNTIME_TOOL_METRICS_FLUSH_BATCH_SIZE)
}

pub(super) fn resolve_metrics_flush_interval_ms() -> u64 {
    std::env::var(CODE_RUNTIME_TOOL_METRICS_FLUSH_INTERVAL_MS_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .and_then(|value| value.parse::<u64>().ok())
        .map(|value| value.clamp(1, MAX_RUNTIME_TOOL_METRICS_FLUSH_INTERVAL_MS))
        .unwrap_or(DEFAULT_RUNTIME_TOOL_METRICS_FLUSH_INTERVAL_MS)
}

pub(super) fn spawn_runtime_tool_metrics_flush_worker(
    path: PathBuf,
) -> Option<RuntimeToolMetricsFlushWorker> {
    let (sender, receiver) = mpsc::channel::<RuntimeToolExecutionMetricsSnapshot>();
    let thread_name = format!("runtime-tool-metrics-flush-{}", Uuid::new_v4().as_simple());
    let spawn_result = std::thread::Builder::new()
        .name(thread_name)
        .spawn(move || {
            while let Ok(mut snapshot) = receiver.recv() {
                while let Ok(next_snapshot) = receiver.try_recv() {
                    snapshot = next_snapshot;
                }
                if let Err(error) = persist_snapshot(path.as_path(), &snapshot) {
                    eprintln!(
                        "runtime tool metrics async flush failed for `{}`: {}",
                        path.display(),
                        error
                    );
                }
            }
        });
    if spawn_result.is_err() {
        return None;
    }
    Some(RuntimeToolMetricsFlushWorker { sender })
}

pub(super) fn resolve_metrics_snapshot_path() -> PathBuf {
    if let Some(path) = std::env::var(CODE_RUNTIME_TOOL_METRICS_PATH_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return PathBuf::from(path);
    }

    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok());
    if let Some(home_dir) = home {
        let target = PathBuf::from(home_dir)
            .join(DEFAULT_RUNTIME_TOOL_METRICS_DIR_NAME)
            .join(DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME);
        if let Err(error) = migrate_legacy_metrics_snapshot_if_needed(target.as_path()) {
            eprintln!(
                "runtime tool metrics legacy migration failed for `{}`: {}",
                target.display(),
                error
            );
        }
        return target;
    }

    let target = std::env::temp_dir()
        .join(DEFAULT_RUNTIME_TOOL_METRICS_DIR_NAME)
        .join(DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME);
    if let Err(error) = migrate_legacy_metrics_snapshot_if_needed(target.as_path()) {
        eprintln!(
            "runtime tool metrics legacy migration failed for `{}`: {}",
            target.display(),
            error
        );
    }
    target
}

fn migrate_legacy_metrics_snapshot_if_needed(path: &Path) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }
    let Some(source) = legacy_metrics_snapshot_paths()
        .into_iter()
        .find(|candidate| candidate != path && candidate.exists())
    else {
        return Ok(());
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create runtime tool metrics directory `{}`: {error}",
                parent.display()
            )
        })?;
    }
    fs::copy(source.as_path(), path).map_err(|error| {
        format!(
            "copy runtime tool metrics snapshot `{}` to `{}` failed: {error}",
            source.display(),
            path.display()
        )
    })?;
    Ok(())
}

fn legacy_metrics_snapshot_paths() -> Vec<PathBuf> {
    const LEGACY_DIR_NAMES: &[&str] = &[".code-runtime-service-rs", ".code-runtime-service"];

    let mut paths = Vec::new();
    if let Some(home_dir) = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())
    {
        let home_dir = home_dir.trim();
        if !home_dir.is_empty() {
            let home_dir = PathBuf::from(home_dir);
            for dir_name in LEGACY_DIR_NAMES {
                paths.push(
                    home_dir
                        .join(dir_name)
                        .join(DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME),
                );
            }
        }
    }

    let temp_dir = std::env::temp_dir();
    for dir_name in LEGACY_DIR_NAMES {
        paths.push(
            temp_dir
                .join(dir_name)
                .join(DEFAULT_RUNTIME_TOOL_METRICS_FILE_NAME),
        );
    }
    paths
}

pub(super) fn resolve_metrics_window_size() -> usize {
    std::env::var(CODE_RUNTIME_TOOL_METRICS_WINDOW_SIZE_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .and_then(|value| value.parse::<usize>().ok())
        .map(|value| value.clamp(1, MAX_RUNTIME_TOOL_METRICS_WINDOW_SIZE))
        .unwrap_or(DEFAULT_RUNTIME_TOOL_METRICS_WINDOW_SIZE)
}

pub(super) fn load_snapshot(path: &Path) -> Result<RuntimeToolExecutionMetricsSnapshot, String> {
    let raw = fs::read_to_string(path).map_err(|error| {
        format!(
            "read runtime tool metrics snapshot `{}`: {error}",
            path.display()
        )
    })?;
    serde_json::from_str::<RuntimeToolExecutionMetricsSnapshot>(raw.as_str()).map_err(|error| {
        format!(
            "parse runtime tool metrics snapshot `{}`: {error}",
            path.display()
        )
    })
}

pub(super) fn persist_snapshot(
    path: &Path,
    snapshot: &RuntimeToolExecutionMetricsSnapshot,
) -> Result<(), String> {
    persist_compact_json_snapshot(path, snapshot, "runtime tool metrics")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_metrics_path(test_name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "code-runtime-tool-metrics-{test_name}-{}.json",
            Uuid::new_v4()
        ))
    }

    #[test]
    fn persists_metrics_snapshot_as_compact_json() {
        let path = temp_metrics_path("compact");
        let snapshot = RuntimeToolExecutionMetricsSnapshot {
            totals: RuntimeToolExecutionTotals::default(),
            by_tool: HashMap::new(),
            recent: Vec::new(),
            updated_at: 42,
            window_size: 32,
            channel_health: RuntimeToolExecutionChannelHealth {
                status: RuntimeToolExecutionChannelHealthStatus::Healthy,
                reason: None,
                last_error_code: None,
                updated_at: Some(42),
            },
            scope_rates: Some(Vec::new()),
            error_code_top_k: Some(Vec::new()),
            circuit_breakers: Vec::new(),
        };

        persist_snapshot(path.as_path(), &snapshot).expect("persist snapshot");

        let raw = fs::read_to_string(path.as_path()).expect("read metrics snapshot");
        assert_eq!(
            raw,
            serde_json::to_string(&snapshot).expect("serialize compact metrics snapshot")
        );
        let loaded = load_snapshot(path.as_path()).expect("reload metrics snapshot");
        assert_eq!(loaded, snapshot);

        let _ = fs::remove_file(path);
    }
}
