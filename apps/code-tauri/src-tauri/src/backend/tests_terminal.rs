use super::{RuntimeBackend, DEFAULT_MAX_ACTIVE_TURN_LANES};
use crate::accounts::OAuthAccountRegistry;
use crate::models::ResolverContext;
use crate::remote::RemoteRuntime;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TERMINAL_TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

fn terminal_test_state_path(suffix: &str) -> PathBuf {
    let pid = std::process::id();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let seq = TERMINAL_TEST_COUNTER.fetch_add(1, Ordering::Relaxed);

    std::env::temp_dir().join(format!(
        "code-tauri-terminal-state-{suffix}-{pid}-{nanos}-{seq}.json"
    ))
}

fn backend_with_local_and_oauth() -> RuntimeBackend {
    RuntimeBackend::new_with_state_path_for_tests(
        ResolverContext::new(OAuthAccountRegistry::seeded(), true),
        RemoteRuntime::local(),
        terminal_test_state_path("local-oauth"),
        DEFAULT_MAX_ACTIVE_TURN_LANES,
    )
}

fn print_working_dir_command() -> String {
    if cfg!(target_os = "windows") && !windows_shell_is_powershell_like() {
        "cd".to_string()
    } else if cfg!(target_os = "windows") {
        "(Get-Location).Path".to_string()
    } else {
        "pwd".to_string()
    }
}

fn raw_echo_command(marker: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("echo {marker}\r\n")
    } else {
        format!("echo {marker}\n")
    }
}

fn windows_shell_is_powershell_like() -> bool {
    if !cfg!(target_os = "windows") {
        return false;
    }

    let descriptor = super::terminal_process::resolve_terminal_shell_descriptor();
    let lower = PathBuf::from(descriptor.program)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "pwsh" | "pwsh.exe" | "powershell" | "powershell.exe"
    )
}

fn normalize_windows_terminal_path_display(path: &Path) -> String {
    let display = path.to_string_lossy().to_string();
    if !cfg!(target_os = "windows") {
        return display;
    }
    if let Some(stripped) = display.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{stripped}");
    }
    if let Some(stripped) = display.strip_prefix(r"\\?\") {
        return stripped.to_string();
    }
    display
}

#[test]
fn desktop_smoke_terminal_shell_descriptor_is_resolved() {
    let command_line = super::terminal_process::describe_terminal_shell_command();
    assert!(!command_line.trim().is_empty());

    if cfg!(target_os = "windows") {
        assert!(matches!(
            super::terminal_process::terminal_shell_source(),
            "env" | "pwsh" | "powershell" | "cmd"
        ));
    }
}

#[test]
fn desktop_smoke_runtime_backend_exposes_ready_state_path_metadata() {
    let backend = backend_with_local_and_oauth();
    let terminal_status = backend.terminal_status();
    assert!(matches!(
        terminal_status.state,
        crate::models::TerminalStatusState::Ready
    ));
    assert!(terminal_status.message.contains("Terminal runtime ready"));

    let settings = backend.settings_summary();
    assert!(settings.max_active_turn_lanes >= 1);

    let runtime_state_path = super::state_utils::runtime_state_path_from_env();
    assert!(!runtime_state_path.to_string_lossy().trim().is_empty());
    let normalized = runtime_state_path.to_string_lossy().replace('\\', "/");
    assert!(normalized.contains(".hugecode/runtime-state.json"));
    assert!(!normalized.contains("open-wrap"));
    assert!(!normalized.contains("OpenFast/Code"));
}

#[test]
fn terminal_read_chunks_drains_incremental_raw_output() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    let marker = "chunk-runtime-read";

    assert!(backend.terminal_input_raw(&session.id, raw_echo_command(marker).as_str()));

    let mut saw_chunk = false;
    for _ in 0..24 {
        let chunk_read = backend
            .terminal_read_chunks(&session.id)
            .expect("terminal chunk read should return session");
        if chunk_read.chunks.iter().any(|chunk| chunk.contains(marker)) {
            saw_chunk = true;
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    assert!(saw_chunk, "expected marker in raw chunks");

    let session_read = backend
        .terminal_read(&session.id)
        .expect("terminal read should still return session");
    assert!(session_read.lines.iter().any(|line| line.contains(marker)));
}

#[test]
fn terminal_raw_output_subscription_streams_chunks_and_disconnects_after_unsubscribe() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    let marker = "chunk-runtime-subscribe";
    let subscription = backend
        .terminal_subscribe_raw_output(&session.id)
        .expect("terminal raw output subscription should attach");

    assert!(backend.terminal_input_raw(&session.id, raw_echo_command(marker).as_str()));

    let chunk = subscription
        .recv_timeout(std::time::Duration::from_secs(1))
        .expect("terminal subscription should receive a chunk");
    assert!(chunk.contains(marker), "unexpected chunk: {chunk:?}");

    assert!(backend.terminal_unsubscribe_raw_output(&session.id, subscription.subscription_id()));
    assert!(
        matches!(
            subscription.recv_timeout(std::time::Duration::from_millis(250)),
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected)
        ),
        "terminal subscription should disconnect after unsubscribe"
    );
}

#[test]
fn terminal_write_cd_updates_cwd_for_subsequent_commands() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    let temp_root = std::env::temp_dir().join(format!(
        "code-tauri-terminal-cd-{}-{}",
        std::process::id(),
        TERMINAL_TEST_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&temp_root).expect("should create temporary directory");
    let canonical_target = temp_root
        .canonicalize()
        .expect("temporary directory should canonicalize");
    let cd_command = format!("cd {}", canonical_target.display());

    let written_cd = backend
        .terminal_write(&session.id, &cd_command)
        .expect("cd command should return session");
    assert!(written_cd
        .lines
        .iter()
        .any(|line| line == &format!("> {cd_command}")));

    let after_cd_read = backend
        .terminal_read(&session.id)
        .expect("terminal read after cd should return session");
    let expected_cd_message = format!("Changed directory to {}.", canonical_target.display());
    assert!(after_cd_read
        .lines
        .iter()
        .any(|line| line == &expected_cd_message));

    let print_cwd = print_working_dir_command();
    backend
        .terminal_write(&session.id, &print_cwd)
        .expect("print cwd command should return session");

    let after_pwd_read = backend
        .terminal_read(&session.id)
        .expect("terminal read after pwd should return session");
    let target_display = normalize_windows_terminal_path_display(&canonical_target);
    assert!(after_pwd_read
        .lines
        .iter()
        .any(|line| line == &target_display || line.contains(target_display.as_str())));

    let _ = fs::remove_dir_all(&temp_root);
}
