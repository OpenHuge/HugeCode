#[path = "test_shell_commands.rs"]
mod test_shell_commands;
#[path = "tests_turn_send_options.rs"]
mod tests_turn_send_options;
use self::test_shell_commands::{
    echo_many_lines_command, mixed_stdout_stderr_command, stderr_only_command,
};
use super::{
    execute_terminal_command, parse_max_active_turn_lanes, push_terminal_line,
    terminate_terminal_process, truncate_terminal_line, RuntimeBackend, RuntimeTerminalSession,
    DEFAULT_MAX_ACTIVE_TURN_LANES, MAX_TERMINAL_LINE_CHARS, MAX_TERMINAL_OUTPUT_LINES,
    MAX_TERMINAL_SESSION_LINES,
};
use crate::accounts::OAuthAccountRegistry;
use crate::models::{ResolverContext, TurnInterruptRequest, TurnSendRequest};
use crate::remote::RemoteRuntime;
use serde_json::Value;
use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
static TEST_STATE_COUNTER: AtomicU64 = AtomicU64::new(0);
macro_rules! turn_send_request {
    ($($field:tt)*) => { TurnSendRequest { mission_mode: None, execution_profile_id: None, preferred_backend_ids: None, service_tier: None, $($field)* } };
}
fn test_state_path(suffix: &str) -> PathBuf {
    let pid = std::process::id();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let seq = TEST_STATE_COUNTER.fetch_add(1, Ordering::Relaxed);

    std::env::temp_dir().join(format!(
        "code-tauri-runtime-state-{suffix}-{pid}-{nanos}-{seq}.json"
    ))
}

fn cleanup_state_file(path: &PathBuf) {
    let _ = std::fs::remove_file(path);
}

fn backend_with_local_and_oauth() -> RuntimeBackend {
    RuntimeBackend::new_with_state_path_for_tests(
        ResolverContext::new(OAuthAccountRegistry::seeded(), true),
        RemoteRuntime::local(),
        test_state_path("local-oauth"),
        DEFAULT_MAX_ACTIVE_TURN_LANES,
    )
}

fn backend_with_context_and_failures(
    resolver_context: ResolverContext,
    failing_providers: &[&str],
) -> RuntimeBackend {
    RuntimeBackend::new_with_state_path_and_failures_and_lane_limit(
        resolver_context,
        RemoteRuntime::local(),
        test_state_path("custom-failures"),
        failing_providers
            .iter()
            .map(|provider| provider.to_string())
            .collect::<BTreeSet<_>>(),
        DEFAULT_MAX_ACTIVE_TURN_LANES,
    )
}

fn backend_with_context_and_lane_limit(
    resolver_context: ResolverContext,
    max_active_turn_lanes: usize,
) -> RuntimeBackend {
    RuntimeBackend::new_with_state_path_for_tests(
        resolver_context,
        RemoteRuntime::local(),
        test_state_path("custom-lane-limit"),
        max_active_turn_lanes,
    )
}

fn test_git_repo_path(suffix: &str) -> PathBuf {
    let pid = std::process::id();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let seq = TEST_STATE_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("code-tauri-git-repo-{suffix}-{pid}-{nanos}-{seq}"))
}

fn run_git_test(root: &PathBuf, args: &[&str]) {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .expect("git command should execute in tests");
    assert!(
        output.status.success(),
        "git command failed: {:?}\nstdout: {}\nstderr: {}",
        args,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

fn setup_test_git_repo(suffix: &str) -> PathBuf {
    let repo = test_git_repo_path(suffix);
    fs::create_dir_all(&repo).expect("should create test git repo directory");
    run_git_test(&repo, &["init"]);
    run_git_test(
        &repo,
        &["config", "user.email", "code-tauri-tests@example.com"],
    );
    run_git_test(&repo, &["config", "user.name", "Code Tauri Tests"]);
    fs::write(repo.join("README.md"), "seed\n").expect("should write seed file");
    run_git_test(&repo, &["add", "README.md"]);
    run_git_test(&repo, &["commit", "-m", "seed"]);
    repo
}

fn backend_for_repo(repo: &PathBuf) -> RuntimeBackend {
    let backend = backend_with_local_and_oauth();
    {
        let mut state = backend
            .state
            .lock()
            .expect("runtime state lock poisoned while binding test repo");
        let workspace = state
            .workspaces
            .get_mut("workspace-local")
            .expect("workspace-local should exist");
        workspace.path = repo.to_string_lossy().to_string();
    }
    backend
}

#[test]
fn execute_terminal_command_caps_output_and_marks_truncation() {
    let total_lines = MAX_TERMINAL_OUTPUT_LINES + 25;
    let command = echo_many_lines_command(total_lines);
    let cwd = std::env::current_dir().expect("should resolve current working directory");

    let result = execute_terminal_command(&cwd, &command);

    assert!(result.new_cwd.is_none());
    assert_eq!(result.lines.len(), MAX_TERMINAL_OUTPUT_LINES + 1);
    assert_eq!(result.lines.first().map(String::as_str), Some("line-1"));
    let last_kept_line = format!("line-{MAX_TERMINAL_OUTPUT_LINES}");
    assert_eq!(
        result
            .lines
            .get(MAX_TERMINAL_OUTPUT_LINES - 1)
            .map(String::as_str),
        Some(last_kept_line.as_str())
    );
    assert_eq!(
        result.lines.last().map(String::as_str),
        Some("... output truncated (25 additional line(s)).")
    );
}

#[test]
fn execute_terminal_command_preserves_stdout_before_stderr_transcript_order() {
    let cwd = std::env::current_dir().expect("should resolve current working directory");
    let result = execute_terminal_command(&cwd, &mixed_stdout_stderr_command());

    let stdout_first = result
        .lines
        .iter()
        .position(|line| line == "stdout-1")
        .expect("stdout-1 should be present");
    let stdout_second = result
        .lines
        .iter()
        .position(|line| line == "stdout-2")
        .expect("stdout-2 should be present");
    let stderr_first = result
        .lines
        .iter()
        .position(|line| line == "stderr: stderr-1")
        .expect("stderr: stderr-1 should be present");

    assert!(stdout_first < stderr_first);
    assert!(stdout_second < stderr_first);
}

#[test]
fn execute_terminal_command_prefixes_stderr_lines() {
    let cwd = std::env::current_dir().expect("should resolve current working directory");
    let result = execute_terminal_command(&cwd, &stderr_only_command());

    assert!(result
        .lines
        .iter()
        .any(|line| line == "stderr: stderr-only"));
}

#[test]
fn truncate_terminal_line_appends_marker_when_input_exceeds_limit() {
    let short = "short line";
    assert_eq!(truncate_terminal_line(short), short.to_string());

    let long = "x".repeat(MAX_TERMINAL_LINE_CHARS + 16);
    let truncated = truncate_terminal_line(&long);
    let expected_prefix = "x".repeat(MAX_TERMINAL_LINE_CHARS);

    assert!(truncated.starts_with(expected_prefix.as_str()));
    assert!(truncated.ends_with(" ... (truncated)"));
    assert_eq!(
        truncated.chars().count(),
        MAX_TERMINAL_LINE_CHARS + " ... (truncated)".chars().count()
    );
}

#[test]
fn push_terminal_line_caps_session_history_size() {
    let mut session = RuntimeTerminalSession::new(
        "terminal-test".to_string(),
        "workspace-local".to_string(),
        1,
        Some(PathBuf::from(".")),
        super::TerminalSessionState::Created,
    );

    let total_lines = MAX_TERMINAL_SESSION_LINES + 7;
    for index in 0..total_lines {
        push_terminal_line(&mut session, format!("line-{index}"));
    }

    assert_eq!(session.lines.len(), MAX_TERMINAL_SESSION_LINES);
    assert_eq!(session.lines.first().cloned(), Some("line-7".to_string()));
    assert_eq!(
        session.lines.last().cloned(),
        Some(format!("line-{}", total_lines - 1))
    );
}

#[test]
fn send_turn_uses_consistent_routing_metadata_for_explicit_model() {
    let backend = backend_with_local_and_oauth();

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: None,
        request_id: None,
        context_prefix: None,
        content: "Summarize this repo".to_string(),
        provider: None,
        model_id: Some("claude-sonnet-4.5".to_string()),
        reason_effort: None,
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(ack.accepted);
    assert_eq!(ack.routed_provider.as_deref(), Some("anthropic"));
    assert_eq!(ack.routed_model_id.as_deref(), Some("claude-sonnet-4.5"));
    assert_eq!(ack.routed_pool.as_deref(), Some("claude"));
    assert_eq!(ack.routed_source.as_deref(), Some("oauth-account"));
}

#[test]
fn send_turn_updates_thread_metadata_for_follow_up_listing() {
    let backend = backend_with_local_and_oauth();

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-seed".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Implement deterministic fallback.".to_string(),
        provider: None,
        model_id: Some("gemini-3.1-pro".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    let threads = backend.threads("workspace-local");
    let seed_thread = threads
        .iter()
        .find(|thread| thread.id == "thread-seed")
        .expect("thread-seed should exist");

    assert!(ack.accepted);
    assert_eq!(seed_thread.provider, "google");
    assert_eq!(seed_thread.model_id.as_deref(), Some("gemini-3.1-pro"));
}

#[test]
fn send_turn_uses_provider_hint_when_model_id_is_missing() {
    let backend = backend_with_local_and_oauth();

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: None,
        request_id: None,
        context_prefix: None,
        content: "Route by provider hint only".to_string(),
        provider: Some("google".to_string()),
        model_id: None,
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(ack.accepted);
    assert_eq!(ack.routed_provider.as_deref(), Some("google"));
    assert_eq!(ack.routed_model_id.as_deref(), Some("gemini-3.1-pro"));
    assert_eq!(ack.routed_pool.as_deref(), Some("gemini"));
}

#[test]
fn send_turn_rejects_non_queued_follow_up_when_thread_lane_is_busy() {
    let backend = backend_with_local_and_oauth();

    let first = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-lane-busy".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Start active lane".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(first.accepted);
    assert_eq!(first.thread_id.as_deref(), Some("thread-lane-busy"));

    let second = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-lane-busy".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Competing non-queue turn".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(!second.accepted);
    assert_eq!(second.thread_id.as_deref(), Some("thread-lane-busy"));
    assert!(second.message.contains("SESSION_BUSY"));
}

#[test]
fn send_turn_queue_follow_up_keeps_active_thread_running_state() {
    let backend = backend_with_local_and_oauth();

    let first = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-lane-queue".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Start lane".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(first.accepted);

    let queued = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-lane-queue".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Queue follow-up".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: true,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(queued.accepted);

    let thread = backend
        .threads("workspace-local")
        .into_iter()
        .find(|thread| thread.id == "thread-lane-queue")
        .expect("thread-lane-queue should exist");
    assert!(thread.running);
}

#[test]
fn send_turn_rejects_non_queued_turn_when_global_lane_capacity_is_reached() {
    let backend = backend_with_local_and_oauth();

    for thread_id in ["thread-global-lane-1", "thread-global-lane-2"] {
        let ack = backend.send_turn(turn_send_request! {
            workspace_id: "workspace-local".to_string(),
            thread_id: Some(thread_id.to_string()),
            request_id: None,
            context_prefix: None,
            content: format!("Activate {thread_id}"),
            provider: None,
            model_id: Some("gpt-5.3-codex".to_string()),
            reason_effort: Some("high".to_string()),
            execution_mode: None,
            codex_bin: None,
            codex_args: None,
            access_mode: "on-request".to_string(),
            queue: false,
            attachments: vec![],
            collaboration_mode: None,
        });
        assert!(ack.accepted);
    }

    let rejected = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-global-lane-3".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Should be globally throttled".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(!rejected.accepted);
    assert!(rejected.message.contains("GLOBAL_BUSY"));
}

#[test]
fn send_turn_allows_queued_turn_when_global_lane_capacity_is_reached() {
    let backend = backend_with_local_and_oauth();

    for thread_id in ["thread-global-queue-1", "thread-global-queue-2"] {
        let ack = backend.send_turn(turn_send_request! {
            workspace_id: "workspace-local".to_string(),
            thread_id: Some(thread_id.to_string()),
            request_id: None,
            context_prefix: None,
            content: format!("Activate {thread_id}"),
            provider: None,
            model_id: Some("gpt-5.3-codex".to_string()),
            reason_effort: Some("high".to_string()),
            execution_mode: None,
            codex_bin: None,
            codex_args: None,
            access_mode: "on-request".to_string(),
            queue: false,
            attachments: vec![],
            collaboration_mode: None,
        });
        assert!(ack.accepted);
    }

    let queued = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-global-queue-3".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Queue should still be accepted".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: true,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(queued.accepted);

    let queued_thread = backend
        .threads("workspace-local")
        .into_iter()
        .find(|thread| thread.id == "thread-global-queue-3")
        .expect("queued thread should exist");
    assert!(!queued_thread.running);
}

#[test]
fn interrupt_turn_by_id_marks_thread_idle_and_releases_lane_capacity() {
    let backend = backend_with_context_and_lane_limit(
        ResolverContext::new(OAuthAccountRegistry::seeded(), true),
        1,
    );

    let first = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-interrupt-1".to_string()),
        request_id: None,
        context_prefix: None,
        content: "occupy only lane".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(first.accepted);
    let turn_id = first.turn_id.clone().expect("turn id should be assigned");

    let blocked = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-interrupt-2".to_string()),
        request_id: None,
        context_prefix: None,
        content: "should be blocked before interrupt".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(!blocked.accepted);
    assert!(blocked.message.contains("GLOBAL_BUSY"));

    let interrupted = backend.interrupt_turn(&TurnInterruptRequest {
        turn_id: Some(turn_id),
        reason: Some("user-stop".to_string()),
    });
    assert!(interrupted);

    let first_thread = backend
        .threads("workspace-local")
        .into_iter()
        .find(|thread| thread.id == "thread-interrupt-1")
        .expect("first thread should exist");
    assert!(!first_thread.running);

    let retried = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-interrupt-2".to_string()),
        request_id: None,
        context_prefix: None,
        content: "should succeed after interrupt".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(retried.accepted);
}

#[test]
fn interrupt_turn_without_id_interrupts_one_active_lane() {
    let backend = backend_with_local_and_oauth();

    for thread_id in ["thread-interrupt-any-1", "thread-interrupt-any-2"] {
        let ack = backend.send_turn(turn_send_request! {
            workspace_id: "workspace-local".to_string(),
            thread_id: Some(thread_id.to_string()),
            request_id: None,
            context_prefix: None,
            content: format!("activate {thread_id}"),
            provider: None,
            model_id: Some("gpt-5.3-codex".to_string()),
            reason_effort: Some("high".to_string()),
            execution_mode: None,
            codex_bin: None,
            codex_args: None,
            access_mode: "on-request".to_string(),
            queue: false,
            attachments: vec![],
            collaboration_mode: None,
        });
        assert!(ack.accepted);
    }

    let before = backend.settings_summary();
    assert_eq!(before.active_turn_lanes, 2);

    let interrupted = backend.interrupt_turn(&TurnInterruptRequest {
        turn_id: None,
        reason: Some("user-stop".to_string()),
    });
    assert!(interrupted);

    let after = backend.settings_summary();
    assert_eq!(after.active_turn_lanes, 1);
}

#[test]
fn send_turn_rejects_thread_workspace_mismatch_with_invalid_params_message() {
    let backend = backend_with_local_and_oauth();
    let other_workspace = backend.create_workspace("./", Some("Other".to_string()));

    let first = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-workspace-owner".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Seed owner workspace".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(first.accepted);

    let mismatch = backend.send_turn(turn_send_request! {
        workspace_id: other_workspace.id.clone(),
        thread_id: Some("thread-workspace-owner".to_string()),
        request_id: None,
        context_prefix: None,
        content: "Cross-workspace thread hijack".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(!mismatch.accepted);
    assert!(mismatch.message.contains("INVALID_PARAMS"));
    assert!(mismatch.message.contains("thread/workspace mismatch"));
}

#[test]
fn send_turn_fallback_preserves_provider_source_model_pool_metadata() {
    let backend = backend_with_context_and_failures(
        ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["openai", "anthropic"])
                .with_provider_failure_policy(1, 60),
            false,
        ),
        &["openai"],
    );

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: None,
        request_id: None,
        context_prefix: None,
        content: "Route with fallback metadata integrity".to_string(),
        provider: None,
        model_id: None,
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(ack.accepted);
    assert_eq!(ack.routed_provider.as_deref(), Some("anthropic"));
    assert_eq!(ack.routed_model_id.as_deref(), Some("claude-sonnet-4.5"));
    assert_eq!(ack.routed_pool.as_deref(), Some("claude"));
    assert_eq!(ack.routed_source.as_deref(), Some("oauth-account"));
    assert!(ack.message.contains("source: oauth-account"));
}

#[test]
fn settings_summary_reports_lane_capacity_and_active_usage() {
    let backend = backend_with_local_and_oauth();

    let initial = backend.settings_summary();
    assert_eq!(initial.max_active_turn_lanes, 2);
    assert_eq!(initial.active_turn_lanes, 0);

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-settings-lanes".to_string()),
        request_id: None,
        context_prefix: None,
        content: "activate lane".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(ack.accepted);

    let after = backend.settings_summary();
    assert_eq!(after.max_active_turn_lanes, 2);
    assert_eq!(after.active_turn_lanes, 1);
}

#[test]
fn max_active_turn_lanes_parser_enforces_default_and_bounds() {
    assert_eq!(
        parse_max_active_turn_lanes(None),
        DEFAULT_MAX_ACTIVE_TURN_LANES
    );
    assert_eq!(
        parse_max_active_turn_lanes(Some("")),
        DEFAULT_MAX_ACTIVE_TURN_LANES
    );
    assert_eq!(
        parse_max_active_turn_lanes(Some("0")),
        DEFAULT_MAX_ACTIVE_TURN_LANES
    );
    assert_eq!(
        parse_max_active_turn_lanes(Some("invalid")),
        DEFAULT_MAX_ACTIVE_TURN_LANES
    );
    assert_eq!(parse_max_active_turn_lanes(Some("1")), 1);
    assert_eq!(parse_max_active_turn_lanes(Some("7")), 7);
    assert_eq!(parse_max_active_turn_lanes(Some("999")), 32);
}

#[test]
fn send_turn_respects_custom_lane_limit_for_non_queued_requests() {
    let backend = backend_with_context_and_lane_limit(
        ResolverContext::new(OAuthAccountRegistry::seeded(), true),
        1,
    );

    let first = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-lane-limit-1".to_string()),
        request_id: None,
        context_prefix: None,
        content: "occupy lane".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });
    assert!(first.accepted);

    let second = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: Some("thread-lane-limit-2".to_string()),
        request_id: None,
        context_prefix: None,
        content: "should be globally throttled at limit=1".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(!second.accepted);
    assert!(second.message.contains("GLOBAL_BUSY"));
    assert!(second.message.contains("(1/1)"));
}

#[test]
fn send_turn_failure_due_to_route_provider_mismatch_never_returns_empty_message() {
    let backend = backend_with_context_and_failures(
        ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["openai", "anthropic", "google"])
                .with_provider_failure_policy(1, 60),
            false,
        ),
        &["openai", "anthropic", "google"],
    );

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: None,
        request_id: None,
        context_prefix: None,
        content: "force failure".to_string(),
        provider: None,
        model_id: Some("gpt-5.3-codex".to_string()),
        reason_effort: None,
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(!ack.accepted);
    assert!(!ack.message.trim().is_empty());
}

#[test]
fn provider_cooldown_state_persists_across_backend_restart() {
    let path = test_state_path("provider-cooldown-persist");
    {
        let backend = RuntimeBackend::new_with_state_path_and_failures(
            ResolverContext::new(
                OAuthAccountRegistry::from_active_providers(["openai", "anthropic"])
                    .with_provider_failure_policy(1, 300),
                false,
            ),
            RemoteRuntime::local(),
            path.clone(),
            ["openai"]
                .into_iter()
                .map(str::to_string)
                .collect::<BTreeSet<_>>(),
        );

        let ack = backend.send_turn(turn_send_request! {
            workspace_id: "workspace-local".to_string(),
            thread_id: None,
            request_id: None,
            context_prefix: None,
            content: "trigger cooldown".to_string(),
            provider: None,
            model_id: None,
            reason_effort: Some("high".to_string()),
            execution_mode: None,
            codex_bin: None,
            codex_args: None,
            access_mode: "on-request".to_string(),
            queue: false,
            attachments: vec![],
            collaboration_mode: None,
        });

        assert!(ack.accepted);
        assert_eq!(ack.routed_provider.as_deref(), Some("anthropic"));
    }

    let backend = RuntimeBackend::new_with_state_path(
        ResolverContext::new(
            OAuthAccountRegistry::from_active_providers(["openai", "anthropic"])
                .with_provider_failure_policy(1, 300),
            false,
        ),
        RemoteRuntime::local(),
        path.clone(),
    );

    let ack = backend.send_turn(turn_send_request! {
        workspace_id: "workspace-local".to_string(),
        thread_id: None,
        request_id: None,
        context_prefix: None,
        content: "respect persisted cooldown".to_string(),
        provider: None,
        model_id: None,
        reason_effort: Some("high".to_string()),
        execution_mode: None,
        codex_bin: None,
        codex_args: None,
        access_mode: "on-request".to_string(),
        queue: false,
        attachments: vec![],
        collaboration_mode: None,
    });

    assert!(ack.accepted);
    assert_eq!(ack.routed_provider.as_deref(), Some("anthropic"));

    cleanup_state_file(&path);
}

#[test]
fn thread_lifecycle_create_resume_archive_is_consistent() {
    let backend = backend_with_local_and_oauth();
    let created = backend.create_thread("workspace-local", Some("Parity Thread".to_string()));

    assert_eq!(created.workspace_id, "workspace-local");
    assert_eq!(created.title, "Parity Thread");

    let resumed = backend
        .resume_thread("workspace-local", &created.id)
        .expect("thread should be resumable");
    assert_eq!(resumed.id, created.id);
    assert!(!resumed.running);

    let archived = backend.archive_thread("workspace-local", &created.id);
    assert!(archived);
    let after_archive = backend.threads("workspace-local");
    assert!(!after_archive.iter().any(|thread| thread.id == created.id));
}

#[test]
fn workspace_lifecycle_create_rename_remove_cleans_associated_state() {
    let backend = backend_with_local_and_oauth();
    let created = backend.create_workspace("  ./  ", Some("  Workspace One  ".to_string()));
    assert_eq!(created.id, "workspace-1");
    assert_eq!(created.path, "./");
    assert_eq!(created.display_name, "Workspace One");

    let second = backend.create_workspace("./", None);
    assert_eq!(second.id, "workspace-2");
    assert_eq!(second.display_name, "Workspace workspace-2");

    let renamed = backend
        .rename_workspace(
            &format!("  {}  ", created.id),
            "  Renamed Workspace  ".to_string(),
        )
        .expect("workspace should be renamed with a trimmed id");
    assert_eq!(renamed.display_name, "Renamed Workspace");
    assert!(backend
        .rename_workspace("   ", "ignored".to_string())
        .is_none());
    assert!(backend
        .rename_workspace(&created.id, "   ".to_string())
        .is_none());

    let thread = backend.create_thread(&created.id, Some("Workspace thread".to_string()));
    let terminal = backend.terminal_open(&created.id);
    assert_eq!(thread.workspace_id, created.id);
    assert_eq!(terminal.workspace_id, created.id);

    assert!(backend.remove_workspace(&format!("  {}  ", created.id)));
    assert!(!backend.remove_workspace(&created.id));
    assert!(backend.threads(&created.id).is_empty());
    assert!(backend
        .terminal_write(&terminal.id, "echo removed")
        .is_none());

    let state = backend
        .state
        .lock()
        .expect("runtime state lock poisoned while validating workspace remove");
    assert!(!state.workspaces.contains_key(&created.id));
    assert!(!state.workspace_threads.contains_key(&created.id));
    assert!(!state.workspace_terminal_sessions.contains_key(&created.id));
    assert!(!state.threads.contains_key(&thread.id));
    assert!(!state.terminal_sessions.contains_key(&terminal.id));
    drop(state);

    let replacement = backend.create_workspace("./", None);
    assert_eq!(replacement.id, created.id);
}

#[test]
fn workspace_create_if_valid_requires_existing_directory_and_dedupes_canonical_paths() {
    let backend = backend_with_local_and_oauth();
    let temp_root = test_git_repo_path("workspace-create-valid");
    fs::create_dir_all(&temp_root).expect("should create workspace directory");
    let canonical_root = temp_root
        .canonicalize()
        .expect("workspace directory should canonicalize");
    let temp_root_str = temp_root.to_string_lossy().to_string();
    let canonical_root_str = canonical_root.to_string_lossy().to_string();

    let created = backend
        .create_workspace_if_valid(
            temp_root_str.as_str(),
            Some(" Valid Workspace ".to_string()),
        )
        .expect("existing directory should register");
    assert_eq!(created.display_name, "Valid Workspace");
    assert_eq!(created.path, canonical_root_str);
    assert!(created.connected);

    let duplicate = backend
        .create_workspace_if_valid(
            format!("{}/.", temp_root_str).as_str(),
            Some("Ignored".to_string()),
        )
        .expect("canonical duplicate should reuse workspace");
    assert_eq!(duplicate.id, created.id);
    assert_eq!(duplicate.path, created.path);
    assert_eq!(duplicate.display_name, created.display_name);

    let missing = backend
        .create_workspace_if_valid(temp_root.join("missing").to_string_lossy().as_ref(), None);
    assert!(matches!(
        missing,
        Err(ref error) if error == "workspace path must reference an existing directory"
    ));

    let file_path = temp_root.join("README.md");
    fs::write(&file_path, "workspace").expect("should create temp file");
    let file_result = backend.create_workspace_if_valid(file_path.to_string_lossy().as_ref(), None);
    assert!(matches!(
        file_result,
        Err(ref error) if error == "workspace path must reference an existing directory"
    ));

    let _ = fs::remove_dir_all(temp_root);
}

#[test]
fn terminal_open_write_close_returns_session_state() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    assert!(matches!(
        session.state,
        crate::models::TerminalSessionState::Created
    ));
    assert!(!session.lines.is_empty());

    let command = "echo parity";
    let written = backend
        .terminal_write(&session.id, command)
        .expect("terminal write should return session");
    assert!(written
        .lines
        .iter()
        .any(|line| line == &format!("> {command}")));
    assert!(!written.lines.iter().any(|line| line == "parity"));

    let mut read = backend
        .terminal_read(&session.id)
        .expect("terminal read should return session");
    for _attempt in 0..5 {
        if read.lines.iter().any(|line| line == "parity") {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
        read = backend
            .terminal_read(&session.id)
            .expect("terminal read should return session");
    }
    assert!(
        read.lines.iter().any(|line| line == "parity"),
        "expected parity output in lines: {:?}",
        read.lines
    );

    let closed = backend.terminal_close(&session.id);
    assert!(closed);
    let status = backend.terminal_status();
    assert!(matches!(
        status.state,
        crate::models::TerminalStatusState::Ready
    ));
}

#[test]
fn terminal_write_and_close_handle_invalid_session_ids() {
    let backend = backend_with_local_and_oauth();
    assert!(backend
        .terminal_write("missing-session", "echo hi")
        .is_none());
    assert!(!backend.terminal_interrupt("missing-session"));
    assert!(!backend.terminal_resize("missing-session", 24, 80));
    assert!(!backend.terminal_close("missing-session"));
}

#[test]
fn terminal_interrupt_and_resize_require_active_session_and_non_zero_size() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");

    assert!(!backend.terminal_resize(&session.id, 0, 80));
    assert!(!backend.terminal_resize(&session.id, 24, 0));
    assert!(backend.terminal_resize(&session.id, 30, 100));
    assert!(backend.terminal_interrupt(&session.id));

    assert!(backend.terminal_close(&session.id));
    assert!(!backend.terminal_interrupt(&session.id));
    assert!(!backend.terminal_resize(&session.id, 24, 80));
}

#[test]
fn terminal_inactive_cleanup_terminates_spawned_process_after_ensure() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    let cwd = {
        let state = backend
            .state
            .lock()
            .expect("runtime state lock poisoned while reading terminal cwd");
        state
            .terminal_sessions
            .get(&session.id)
            .expect("session should exist")
            .cwd
            .clone()
            .expect("session cwd should be populated")
    };

    if let Some(handle) = backend.take_terminal_process(&session.id) {
        terminate_terminal_process(handle);
    }

    let _ = backend
        .ensure_terminal_process(&session.id, cwd.as_path())
        .expect("should ensure terminal process");
    {
        let mut state = backend
            .state
            .lock()
            .expect("runtime state lock poisoned while marking session inactive");
        let runtime_session = state
            .terminal_sessions
            .get_mut(&session.id)
            .expect("session should exist");
        runtime_session.state = super::TerminalSessionState::Exited;
    }

    let summary = backend
        .terminal_summary_if_inactive_after_process_ready(&session.id)
        .expect("inactive session should return summary");
    assert!(matches!(
        summary.state,
        crate::models::TerminalSessionState::Exited
    ));
    assert!(
        backend.take_terminal_process(&session.id).is_none(),
        "inactive cleanup should terminate and remove process"
    );
}

#[test]
fn terminal_write_captures_command_errors_and_exit_status() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    let command = "command_that_does_not_exist_ku0_12345";

    let written = backend
        .terminal_write(&session.id, command)
        .expect("terminal write should return session");
    assert!(written
        .lines
        .iter()
        .any(|line| line == &format!("> {command}")));

    let mut failed = backend
        .terminal_read(&session.id)
        .expect("terminal read should return session");
    let mut saw_failure = failed.lines.iter().any(|line| {
        line.contains("Command exited with status code")
            || line.contains("Failed to execute")
            || line.contains("not found")
            || line.contains("The term")
            || line.contains("is not recognized")
            || line.contains("不是内部或外部命令")
            || line.contains("批处理文件")
    });
    for _ in 0..24 {
        if saw_failure {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
        failed = backend
            .terminal_read(&session.id)
            .expect("terminal read should return session");
        saw_failure = failed.lines.iter().any(|line| {
            line.contains("Command exited with status code")
                || line.contains("Failed to execute")
                || line.contains("not found")
                || line.contains("The term")
                || line.contains("is not recognized")
                || line.contains("不是内部或外部命令")
                || line.contains("批处理文件")
        });
    }
    assert!(
        saw_failure,
        "expected command failure output in lines: {:?}",
        failed.lines
    );
    assert!(failed
        .lines
        .iter()
        .any(|line| line == &format!("> {command}")));
}

#[test]
fn terminal_read_drains_incremental_process_output() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    let command = "echo incremental-runtime-read";

    let written = backend
        .terminal_write(&session.id, command)
        .expect("terminal write should return session");
    assert!(written
        .lines
        .iter()
        .any(|line| line == &format!("> {command}")));
    assert!(!written
        .lines
        .iter()
        .any(|line| line == "incremental-runtime-read"));

    let mut read_once = backend
        .terminal_read(&session.id)
        .expect("terminal read should return session");
    let mut saw_incremental_output = read_once
        .lines
        .iter()
        .any(|line| line == "incremental-runtime-read");
    for _ in 0..24 {
        if saw_incremental_output {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
        read_once = backend
            .terminal_read(&session.id)
            .expect("terminal read should return session");
        saw_incremental_output = read_once
            .lines
            .iter()
            .any(|line| line == "incremental-runtime-read");
    }
    assert!(
        saw_incremental_output,
        "expected incremental output in lines: {:?}",
        read_once.lines
    );

    let before_len = read_once.lines.len();
    let read_twice = backend
        .terminal_read(&session.id)
        .expect("second terminal read should return session");
    assert_eq!(read_twice.lines.len(), before_len);
}

#[test]
fn terminal_input_raw_requires_active_session() {
    let backend = backend_with_local_and_oauth();
    let session = backend.terminal_open("workspace-local");
    assert!(backend.terminal_close(&session.id));

    assert!(!backend.terminal_input_raw(&session.id, "echo should-not-run\n"));
    assert!(backend.terminal_read_chunks(&session.id).is_some());
}

#[test]
fn git_branch_list_create_and_checkout_work_through_backend() {
    let repo = setup_test_git_repo("branch-ops");
    let backend = backend_for_repo(&repo);

    let before = backend.git_branches("workspace-local");
    let initial_branch = before
        .current_branch
        .clone()
        .expect("test repo should have current branch");
    assert!(before
        .branches
        .iter()
        .any(|entry| entry.name == initial_branch));

    let create = backend.git_branch_create("workspace-local", "feature perf");
    assert!(create.ok, "create branch failed: {:?}", create.error);

    let created_snapshot = backend.git_branches("workspace-local");
    assert_eq!(
        created_snapshot.current_branch.as_deref(),
        Some("feature-perf")
    );
    assert!(created_snapshot
        .branches
        .iter()
        .any(|entry| entry.name == "feature-perf"));

    let checkout = backend.git_branch_checkout("workspace-local", initial_branch.as_str());
    assert!(checkout.ok, "checkout branch failed: {:?}", checkout.error);

    let restored_snapshot = backend.git_branches("workspace-local");
    assert_eq!(
        restored_snapshot.current_branch.as_deref(),
        Some(initial_branch.as_str())
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn git_branch_checkout_rejects_option_like_or_invalid_names() {
    let repo = setup_test_git_repo("branch-ops-invalid");
    let backend = backend_for_repo(&repo);

    let option_like = backend.git_branch_checkout("workspace-local", "--orphan");
    assert!(!option_like.ok);
    assert_eq!(
        option_like.error.as_deref(),
        Some("branch name cannot start with '-'")
    );

    let invalid_ref = backend.git_branch_checkout("workspace-local", "bad..ref");
    assert!(!invalid_ref.ok);
    assert!(invalid_ref
        .error
        .as_deref()
        .is_some_and(|error| error.contains("invalid branch name")));

    let invalid_create = backend.git_branch_create("workspace-local", "--template");
    assert!(!invalid_create.ok);
    assert_eq!(
        invalid_create.error.as_deref(),
        Some("branch name cannot start with '-'")
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn git_stage_unstage_revert_and_commit_work_through_backend() {
    let repo = setup_test_git_repo("mutations");
    let backend = backend_for_repo(&repo);

    fs::write(repo.join("README.md"), "seed\nchange one\n").expect("should update file");
    let snapshot = backend.git_changes("workspace-local");
    let unstaged = snapshot
        .unstaged
        .iter()
        .find(|entry| entry.path == "README.md")
        .expect("README.md should be unstaged")
        .id
        .clone();

    let stage = backend.git_stage_change("workspace-local", unstaged.as_str());
    assert!(stage.ok, "stage failed: {:?}", stage.error);
    let staged_id = backend
        .git_changes("workspace-local")
        .staged
        .iter()
        .find(|entry| entry.path == "README.md")
        .expect("README.md should be staged")
        .id
        .clone();

    let unstage = backend.git_unstage_change("workspace-local", staged_id.as_str());
    assert!(unstage.ok, "unstage failed: {:?}", unstage.error);
    assert!(backend
        .git_changes("workspace-local")
        .unstaged
        .iter()
        .any(|entry| entry.path == "README.md"));

    let revert = backend.git_revert_change("workspace-local", unstaged.as_str());
    assert!(revert.ok, "revert failed: {:?}", revert.error);
    let after_revert = backend.git_changes("workspace-local");
    assert!(after_revert.staged.is_empty());
    assert!(after_revert.unstaged.is_empty());

    fs::write(repo.join("README.md"), "seed\nchange two\n").expect("should update file again");
    let unstaged_after = backend
        .git_changes("workspace-local")
        .unstaged
        .iter()
        .find(|entry| entry.path == "README.md")
        .expect("README.md should be unstaged for commit")
        .id
        .clone();
    let stage_again = backend.git_stage_change("workspace-local", unstaged_after.as_str());
    assert!(
        stage_again.ok,
        "stage before commit failed: {:?}",
        stage_again.error
    );

    let commit = backend.git_commit("workspace-local", "feat: update readme");
    assert!(commit.committed, "commit failed: {:?}", commit.error);
    assert_eq!(commit.committed_count, 1);
    assert!(backend.git_changes("workspace-local").staged.is_empty());
    assert!(backend.git_changes("workspace-local").unstaged.is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn runtime_state_persists_threads_across_backend_restarts() {
    let path = test_state_path("persist-threads");
    let created_thread_id = {
        let backend = RuntimeBackend::new_with_state_path(
            ResolverContext::new(OAuthAccountRegistry::seeded(), true),
            RemoteRuntime::local(),
            path.clone(),
        );
        let created =
            backend.create_thread("workspace-local", Some("Persistent thread".to_string()));
        created.id
    };

    let backend = RuntimeBackend::new_with_state_path(
        ResolverContext::new(OAuthAccountRegistry::seeded(), true),
        RemoteRuntime::local(),
        path.clone(),
    );
    let threads = backend.threads("workspace-local");
    assert!(threads
        .iter()
        .any(|thread| { thread.id == created_thread_id && thread.title == "Persistent thread" }));

    cleanup_state_file(&path);
}

#[test]
fn runtime_state_restores_terminal_sessions_as_inactive_with_history() {
    let path = test_state_path("persist-terminal");
    let persisted_session = {
        let backend = RuntimeBackend::new_with_state_path(
            ResolverContext::new(OAuthAccountRegistry::seeded(), true),
            RemoteRuntime::local(),
            path.clone(),
        );
        let session = backend.terminal_open("workspace-local");
        let written = backend
            .terminal_write(&session.id, "echo terminal-persisted")
            .expect("terminal write should return session");
        assert!(written
            .lines
            .iter()
            .any(|line| line.contains("terminal-persisted")));
        written
    };

    let backend = RuntimeBackend::new_with_state_path(
        ResolverContext::new(OAuthAccountRegistry::seeded(), true),
        RemoteRuntime::local(),
        path.clone(),
    );
    let restored = backend
        .terminal_write(&persisted_session.id, "echo should-not-run")
        .expect("restored session should exist");

    assert!(matches!(
        restored.state,
        crate::models::TerminalSessionState::Exited
    ));
    assert!(restored
        .lines
        .iter()
        .any(|line| line.contains("> echo terminal-persisted")));
    assert!(!restored
        .lines
        .iter()
        .any(|line| line.contains("should-not-run")));
    assert!(backend
        .terminal_status()
        .message
        .contains("No active sessions"));

    cleanup_state_file(&path);
}

#[test]
fn terminal_runtime_state_snapshot_preserves_versioned_shape() {
    let path = test_state_path("snapshot-shape");
    {
        let backend = RuntimeBackend::new_with_state_path(
            ResolverContext::new(OAuthAccountRegistry::seeded(), true),
            RemoteRuntime::local(),
            path.clone(),
        );
        let _ = backend.create_thread("workspace-local", Some("snapshot-shape".to_string()));
        let _ = backend.terminal_open("workspace-local");
    }

    let raw = fs::read_to_string(&path).expect("state file should exist");
    let parsed: Value = serde_json::from_str(&raw).expect("state file should be valid JSON");
    let version = parsed
        .get("version")
        .and_then(Value::as_u64)
        .expect("version field should be present");
    assert_eq!(version, 1);
    let state = parsed
        .get("state")
        .and_then(Value::as_object)
        .expect("state field should be object");
    assert!(state.contains_key("workspaces"));
    assert!(state.contains_key("threads"));
    assert!(state.contains_key("terminal_sessions"));

    cleanup_state_file(&path);
}
