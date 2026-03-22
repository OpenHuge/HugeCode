use crate::ShellSpec;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

pub const MAX_TERMINAL_SESSION_LINES: usize = 1_000;
pub const MAX_TERMINAL_LINE_CHARS: usize = 2_000;
pub const TERMINAL_READ_INITIAL_TIMEOUT: Duration = Duration::from_millis(60);
pub const TERMINAL_READ_SETTLE_TIMEOUT: Duration = Duration::from_millis(18);
pub const TERMINAL_PTY_DEFAULT_ROWS: u16 = 24;
pub const TERMINAL_PTY_DEFAULT_COLS: u16 = 80;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalRuntimeState {
    Uninitialized,
    Ready,
    Unsupported,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TerminalRuntimeStatus {
    pub state: TerminalRuntimeState,
    pub message: String,
}

pub fn build_terminal_runtime_status(
    state: TerminalRuntimeState,
    active_session_count: usize,
) -> TerminalRuntimeStatus {
    match state {
        TerminalRuntimeState::Uninitialized => TerminalRuntimeStatus {
            state,
            message: "Terminal runtime has not been initialized yet.".to_string(),
        },
        TerminalRuntimeState::Unsupported => TerminalRuntimeStatus {
            state,
            message: "Terminal runtime is not supported by this backend.".to_string(),
        },
        TerminalRuntimeState::Ready => TerminalRuntimeStatus {
            state,
            message: if active_session_count == 0 {
                "Terminal runtime ready. No active sessions.".to_string()
            } else {
                format!("Terminal runtime ready. {active_session_count} active session(s).")
            },
        },
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalSessionState {
    Created,
    Exited,
    IoFailed,
    Unsupported,
}

impl TerminalSessionState {
    pub fn is_active(self) -> bool {
        matches!(self, Self::Created)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitStatus {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signal: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionRecord {
    pub id: String,
    pub workspace_id: String,
    pub state: TerminalSessionState,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(default)]
    pub cwd: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_status: Option<TerminalExitStatus>,
    pub lines: Vec<String>,
}

impl TerminalSessionRecord {
    pub fn new(
        id: String,
        workspace_id: String,
        now: u64,
        cwd: Option<PathBuf>,
        state: TerminalSessionState,
    ) -> Self {
        Self {
            id,
            workspace_id,
            state,
            created_at: now,
            updated_at: now,
            cwd,
            exit_status: None,
            lines: Vec::new(),
        }
    }

    pub fn is_active(&self) -> bool {
        self.state.is_active()
    }

    pub fn set_cwd(&mut self, cwd: PathBuf) {
        self.cwd = Some(cwd);
    }

    pub fn set_exit_status(&mut self, exit_status: TerminalExitStatus, now: u64) {
        self.exit_status = Some(exit_status);
        self.updated_at = now;
    }

    pub fn set_state(&mut self, state: TerminalSessionState, now: u64) {
        self.state = state;
        self.updated_at = now;
    }

    pub fn touch(&mut self, now: u64) {
        self.updated_at = now;
    }

    pub fn push_line(&mut self, line: impl AsRef<str>) {
        push_terminal_line(self, line.as_ref().to_string());
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TerminalOperationErrorKind {
    InvalidDimensions,
    SpawnFailed,
    ProcessUnavailable,
    SessionNotFound,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TerminalOperationError {
    kind: TerminalOperationErrorKind,
    message: String,
}

impl TerminalOperationError {
    fn new(kind: TerminalOperationErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn kind(&self) -> TerminalOperationErrorKind {
        self.kind
    }

    pub fn message(&self) -> &str {
        self.message.as_str()
    }
}

impl fmt::Display for TerminalOperationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message.as_str())
    }
}

impl std::error::Error for TerminalOperationError {}

#[derive(Clone, Debug)]
pub struct TerminalSpawnSpec {
    pub cwd: PathBuf,
    pub shell: ShellSpec,
    pub args: Vec<String>,
    pub rows: u16,
    pub cols: u16,
    pub env: Vec<(String, String)>,
}

impl TerminalSpawnSpec {
    pub fn new(cwd: PathBuf, shell: ShellSpec) -> Self {
        Self {
            cwd,
            args: shell.terminal_args(),
            shell,
            rows: TERMINAL_PTY_DEFAULT_ROWS,
            cols: TERMINAL_PTY_DEFAULT_COLS,
            env: Vec::new(),
        }
    }
}

pub struct TerminalProcessHandle {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
    line_output_rx: mpsc::Receiver<String>,
    raw_output_rx: mpsc::Receiver<String>,
    raw_output_subscribers: Arc<Mutex<TerminalRawOutputSubscribers>>,
    output_reader: thread::JoinHandle<()>,
    observed_exit_status: Option<TerminalExitStatus>,
}

#[derive(Debug, Default)]
struct TerminalRawOutputSubscribers {
    next_subscription_id: u64,
    senders: HashMap<u64, mpsc::Sender<String>>,
}

#[derive(Debug)]
pub struct TerminalRawOutputSubscription {
    subscription_id: u64,
    receiver: mpsc::Receiver<String>,
}

impl TerminalRawOutputSubscription {
    pub fn subscription_id(&self) -> u64 {
        self.subscription_id
    }

    pub fn recv(&self) -> Result<String, mpsc::RecvError> {
        self.receiver.recv()
    }

    pub fn recv_timeout(&self, timeout: Duration) -> Result<String, mpsc::RecvTimeoutError> {
        self.receiver.recv_timeout(timeout)
    }
}

impl fmt::Debug for TerminalProcessHandle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("TerminalProcessHandle")
            .field("reader_running", &!self.output_reader.is_finished())
            .finish()
    }
}

impl TerminalProcessHandle {
    pub fn write_command(&mut self, command: &str) -> Result<(), TerminalOperationError> {
        self.writer
            .write_all(command.as_bytes())
            .map_err(|error| io_failed(format!("failed to write command bytes: {error}")))?;
        self.writer
            .write_all(terminal_command_newline())
            .map_err(|error| io_failed(format!("failed to write command newline: {error}")))?;
        self.writer
            .flush()
            .map_err(|error| io_failed(format!("failed to flush command input: {error}")))?;
        Ok(())
    }

    pub fn write_raw_input(&mut self, input: &str) -> Result<(), TerminalOperationError> {
        self.writer
            .write_all(input.as_bytes())
            .map_err(|error| io_failed(format!("failed to write raw input bytes: {error}")))?;
        self.writer
            .flush()
            .map_err(|error| io_failed(format!("failed to flush raw input: {error}")))?;
        Ok(())
    }

    pub fn send_interrupt(&mut self) -> Result<(), TerminalOperationError> {
        self.writer
            .write_all(b"\x03")
            .map_err(|error| io_failed(format!("failed to write interrupt byte: {error}")))?;
        self.writer
            .flush()
            .map_err(|error| io_failed(format!("failed to flush interrupt byte: {error}")))?;
        Ok(())
    }

    pub fn resize(&mut self, rows: u16, cols: u16) -> Result<(), TerminalOperationError> {
        if rows == 0 || cols == 0 {
            return Err(TerminalOperationError::new(
                TerminalOperationErrorKind::InvalidDimensions,
                "terminal PTY resize rows/cols must be non-zero",
            ));
        }
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| io_failed(format!("failed to resize PTY: {error}")))?;
        Ok(())
    }

    pub fn drain_line_output(&mut self) -> Vec<String> {
        drain_stream_channel(&self.line_output_rx)
    }

    pub fn drain_raw_output(&mut self) -> Vec<String> {
        drain_stream_channel(&self.raw_output_rx)
    }

    pub fn subscribe_raw_output(&mut self) -> TerminalRawOutputSubscription {
        let (sender, receiver) = mpsc::channel();
        let subscription_id = {
            let mut subscribers = self
                .raw_output_subscribers
                .lock()
                .expect("terminal raw output subscribers lock poisoned while subscribing");
            let subscription_id = subscribers.next_subscription_id;
            subscribers.next_subscription_id = subscribers.next_subscription_id.saturating_add(1);
            subscribers.senders.insert(subscription_id, sender);
            subscription_id
        };

        TerminalRawOutputSubscription {
            subscription_id,
            receiver,
        }
    }

    pub fn unsubscribe_raw_output(&mut self, subscription_id: u64) -> bool {
        self.raw_output_subscribers
            .lock()
            .expect("terminal raw output subscribers lock poisoned while unsubscribing")
            .senders
            .remove(&subscription_id)
            .is_some()
    }

    pub fn try_wait(&mut self) -> Result<Option<TerminalExitStatus>, TerminalOperationError> {
        if let Some(exit_status) = self.observed_exit_status.clone() {
            return Ok(Some(exit_status));
        }
        let exit_status = self
            .child
            .try_wait()
            .map_err(|error| io_failed(format!("failed to poll terminal process: {error}")))?;
        let Some(exit_status) = exit_status else {
            return Ok(None);
        };
        let mapped = map_exit_status(&exit_status);
        self.observed_exit_status = Some(mapped.clone());
        Ok(Some(mapped))
    }

    pub fn wait(&mut self) -> Result<TerminalExitStatus, TerminalOperationError> {
        if let Some(exit_status) = self.observed_exit_status.clone() {
            return Ok(exit_status);
        }
        let exit_status = self
            .child
            .wait()
            .map_err(|error| io_failed(format!("failed to wait for terminal process: {error}")))?;
        let mapped = map_exit_status(&exit_status);
        self.observed_exit_status = Some(mapped.clone());
        Ok(mapped)
    }

    pub fn terminate(&mut self) -> Result<TerminalExitStatus, TerminalOperationError> {
        if let Some(exit_status) = self.try_wait()? {
            return Ok(exit_status);
        }
        self.child
            .kill()
            .map_err(|error| io_failed(format!("failed to terminate terminal process: {error}")))?;
        self.wait()
    }
}

pub fn spawn_terminal_process(
    spec: &TerminalSpawnSpec,
) -> Result<TerminalProcessHandle, TerminalOperationError> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: spec.rows,
            cols: spec.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| {
            TerminalOperationError::new(
                TerminalOperationErrorKind::SpawnFailed,
                format!("failed to open PTY in {}: {error}", spec.cwd.display()),
            )
        })?;

    let mut command = CommandBuilder::new(spec.shell.executable.clone());
    for arg in &spec.args {
        command.arg(arg);
    }
    let shell_cwd = normalize_terminal_cwd(spec.cwd.as_path());
    command.cwd(&shell_cwd);
    for (name, value) in &spec.env {
        command.env(name, value);
    }
    if cfg!(unix)
        && std::env::var_os("TERM").is_none()
        && !spec.env.iter().any(|(name, _)| name == "TERM")
    {
        command.env("TERM", "xterm-256color");
    }

    let child = pair.slave.spawn_command(command).map_err(|error| {
        TerminalOperationError::new(
            TerminalOperationErrorKind::SpawnFailed,
            format!(
                "failed to spawn shell process in {}: {error}",
                spec.cwd.display()
            ),
        )
    })?;
    let master = pair.master;
    let writer = master
        .take_writer()
        .map_err(|error| io_failed(format!("failed to capture shell PTY writer: {error}")))?;
    let reader = master
        .try_clone_reader()
        .map_err(|error| io_failed(format!("failed to clone shell PTY reader: {error}")))?;

    let (line_output_tx, line_output_rx) = mpsc::channel();
    let (raw_output_tx, raw_output_rx) = mpsc::channel();
    let raw_output_subscribers = Arc::new(Mutex::new(TerminalRawOutputSubscribers::default()));
    let output_reader = spawn_terminal_live_stream_reader(
        reader,
        line_output_tx,
        raw_output_tx,
        Arc::clone(&raw_output_subscribers),
    );

    Ok(TerminalProcessHandle {
        master,
        writer,
        child,
        line_output_rx,
        raw_output_rx,
        raw_output_subscribers,
        output_reader,
        observed_exit_status: None,
    })
}

pub fn terminate_terminal_process(process: TerminalProcessHandle) {
    let TerminalProcessHandle {
        master,
        mut writer,
        mut child,
        line_output_rx: _line_output_rx,
        raw_output_rx: _raw_output_rx,
        raw_output_subscribers: _raw_output_subscribers,
        output_reader,
        observed_exit_status: _observed_exit_status,
    } = process;

    let _ = writer.write_all(b"exit");
    let _ = writer.write_all(terminal_command_newline());
    let _ = writer.flush();
    let _ = child.kill();
    let _ = child.wait();

    drop(writer);
    drop(master);
    drop(output_reader);
}

#[derive(Default, Debug)]
pub struct TerminalProcessRegistry {
    processes: HashMap<String, TerminalProcessHandle>,
}

impl TerminalProcessRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn contains(&self, session_id: &str) -> bool {
        self.processes.contains_key(session_id)
    }

    pub fn ensure_process(
        &mut self,
        session_id: &str,
        spec: &TerminalSpawnSpec,
    ) -> Result<bool, TerminalOperationError> {
        if self.processes.contains_key(session_id) {
            return Ok(false);
        }
        let handle = spawn_terminal_process(spec)?;
        self.insert(session_id.to_string(), handle);
        Ok(true)
    }

    pub fn restart_process(
        &mut self,
        session_id: &str,
        spec: &TerminalSpawnSpec,
    ) -> Result<(), TerminalOperationError> {
        let handle = spawn_terminal_process(spec)?;
        self.insert(session_id.to_string(), handle);
        Ok(())
    }

    pub fn insert(&mut self, session_id: String, handle: TerminalProcessHandle) {
        if let Some(previous) = self.processes.insert(session_id, handle) {
            terminate_terminal_process(previous);
        }
    }

    pub fn with_process_mut<T>(
        &mut self,
        session_id: &str,
        callback: impl FnOnce(&mut TerminalProcessHandle) -> Result<T, TerminalOperationError>,
    ) -> Result<T, TerminalOperationError> {
        let handle = self.processes.get_mut(session_id).ok_or_else(|| {
            TerminalOperationError::new(
                TerminalOperationErrorKind::ProcessUnavailable,
                "Terminal process is not available for this session.",
            )
        })?;
        callback(handle)
    }

    pub fn drain_line_output(&mut self, session_id: &str) -> Vec<String> {
        self.processes
            .get_mut(session_id)
            .map(TerminalProcessHandle::drain_line_output)
            .unwrap_or_default()
    }

    pub fn drain_raw_output(&mut self, session_id: &str) -> Vec<String> {
        self.processes
            .get_mut(session_id)
            .map(TerminalProcessHandle::drain_raw_output)
            .unwrap_or_default()
    }

    pub fn subscribe_raw_output(
        &mut self,
        session_id: &str,
    ) -> Option<TerminalRawOutputSubscription> {
        self.processes
            .get_mut(session_id)
            .map(TerminalProcessHandle::subscribe_raw_output)
    }

    pub fn unsubscribe_raw_output(&mut self, session_id: &str, subscription_id: u64) -> bool {
        self.processes
            .get_mut(session_id)
            .map(|handle| handle.unsubscribe_raw_output(subscription_id))
            .unwrap_or(false)
    }

    pub fn remove(&mut self, session_id: &str) -> Option<TerminalProcessHandle> {
        self.processes.remove(session_id)
    }

    pub fn remove_many(&mut self, session_ids: &[String]) -> Vec<TerminalProcessHandle> {
        session_ids
            .iter()
            .filter_map(|session_id| self.processes.remove(session_id))
            .collect()
    }

    pub fn terminate(&mut self, session_id: &str) -> bool {
        self.remove(session_id)
            .map(|handle| {
                terminate_terminal_process(handle);
                true
            })
            .unwrap_or(false)
    }

    pub fn terminate_many(&mut self, session_ids: &[String]) {
        for handle in self.remove_many(session_ids) {
            terminate_terminal_process(handle);
        }
    }

    pub fn terminate_all(&mut self) {
        let handles = self
            .processes
            .drain()
            .map(|(_, handle)| handle)
            .collect::<Vec<_>>();
        for handle in handles {
            terminate_terminal_process(handle);
        }
    }
}

pub fn push_terminal_line(session: &mut TerminalSessionRecord, line: String) {
    if line.trim().is_empty() {
        return;
    }
    if session.lines.len() >= MAX_TERMINAL_SESSION_LINES {
        let drain_count = session.lines.len() + 1 - MAX_TERMINAL_SESSION_LINES;
        session.lines.drain(..drain_count);
    }
    session.lines.push(truncate_terminal_line(line.trim_end()));
}

pub fn truncate_terminal_line(line: &str) -> String {
    if line.chars().count() <= MAX_TERMINAL_LINE_CHARS {
        return line.to_string();
    }

    let mut shortened = line
        .chars()
        .take(MAX_TERMINAL_LINE_CHARS)
        .collect::<String>();
    shortened.push_str(" ... (truncated)");
    shortened
}

pub fn sanitize_terminal_line(line: &str) -> String {
    let mut cleaned = String::with_capacity(line.len());
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch != '\u{1b}' {
            cleaned.push(ch);
            continue;
        }

        match chars.next() {
            Some('[') => {
                for next in chars.by_ref() {
                    if ('@'..='~').contains(&next) {
                        break;
                    }
                }
            }
            Some(']') => {
                for next in chars.by_ref() {
                    if next == '\u{7}' {
                        break;
                    }
                }
            }
            Some(_) | None => {}
        }
    }

    cleaned
}

fn io_failed(message: impl Into<String>) -> TerminalOperationError {
    TerminalOperationError::new(TerminalOperationErrorKind::ProcessUnavailable, message)
}

fn map_exit_status(status: &portable_pty::ExitStatus) -> TerminalExitStatus {
    let exit_code = i32::try_from(status.exit_code()).ok();
    TerminalExitStatus {
        exit_code,
        signal: status.signal().map(ToOwned::to_owned),
    }
}

fn drain_stream_channel(receiver: &mpsc::Receiver<String>) -> Vec<String> {
    let mut drained = Vec::new();
    while let Ok(value) = receiver.try_recv() {
        drained.push(value);
    }

    if drained.is_empty() {
        match receiver.recv_timeout(TERMINAL_READ_INITIAL_TIMEOUT) {
            Ok(value) => {
                drained.push(value);
                while let Ok(next) = receiver.try_recv() {
                    drained.push(next);
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => {}
        }
    }

    while !drained.is_empty() {
        match receiver.recv_timeout(TERMINAL_READ_SETTLE_TIMEOUT) {
            Ok(value) => {
                drained.push(value);
                while let Ok(next) = receiver.try_recv() {
                    drained.push(next);
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => break,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    drained
}

fn terminal_command_newline() -> &'static [u8] {
    if cfg!(target_os = "windows") {
        b"\r\n"
    } else {
        b"\n"
    }
}

fn normalize_terminal_cwd(cwd: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let display = cwd.to_string_lossy();
        if let Some(stripped) = display.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{stripped}"));
        }
        if let Some(stripped) = display.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }

    cwd.to_path_buf()
}

fn spawn_terminal_live_stream_reader<R>(
    reader: R,
    line_sender: mpsc::Sender<String>,
    raw_sender: mpsc::Sender<String>,
    raw_output_subscribers: Arc<Mutex<TerminalRawOutputSubscribers>>,
) -> thread::JoinHandle<()>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut stream = reader;
        let mut pending = String::new();
        let mut buffer = [0u8; 4096];
        loop {
            match stream.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes_read) => {
                    let decoded = String::from_utf8_lossy(&buffer[..bytes_read]).into_owned();
                    if raw_sender.send(decoded.clone()).is_err() {
                        return;
                    }
                    broadcast_terminal_raw_output(
                        raw_output_subscribers.as_ref(),
                        decoded.as_str(),
                    );
                    pending.push_str(decoded.as_str());

                    loop {
                        let Some(line_end) = pending.find(['\n', '\r']) else {
                            break;
                        };

                        let raw_line = pending[..line_end].trim_end();
                        let cleaned_line = sanitize_terminal_line(raw_line);
                        if !cleaned_line.is_empty()
                            && line_sender
                                .send(truncate_terminal_line(cleaned_line.as_str()))
                                .is_err()
                        {
                            return;
                        }

                        let mut consumed = line_end;
                        while let Some(next) = pending[consumed..].chars().next() {
                            if next == '\n' || next == '\r' {
                                consumed += next.len_utf8();
                            } else {
                                break;
                            }
                        }
                        pending.replace_range(..consumed, "");
                    }
                }
                Err(error) => {
                    let message = format!("Failed to read terminal stream: {error}");
                    let _ = line_sender.send(message);
                    break;
                }
            }
        }

        let tail = pending.trim_end();
        let cleaned_tail = sanitize_terminal_line(tail);
        if !cleaned_tail.is_empty() {
            let _ = line_sender.send(truncate_terminal_line(cleaned_tail.as_str()));
        }
    })
}

fn broadcast_terminal_raw_output(
    raw_output_subscribers: &Mutex<TerminalRawOutputSubscribers>,
    chunk: &str,
) {
    let stale_subscribers = {
        let subscribers = raw_output_subscribers
            .lock()
            .expect("terminal raw output subscribers lock poisoned while broadcasting");
        subscribers
            .senders
            .iter()
            .filter_map(|(subscription_id, sender)| {
                sender
                    .send(chunk.to_string())
                    .err()
                    .map(|_| *subscription_id)
            })
            .collect::<Vec<_>>()
    };

    if stale_subscribers.is_empty() {
        return;
    }

    let mut subscribers = raw_output_subscribers
        .lock()
        .expect("terminal raw output subscribers lock poisoned while pruning");
    for subscription_id in stale_subscribers {
        subscribers.senders.remove(&subscription_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::resolve_shell;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn test_session(state: TerminalSessionState) -> TerminalSessionRecord {
        TerminalSessionRecord::new(
            "terminal-test".to_string(),
            "workspace-local".to_string(),
            10,
            Some(std::env::current_dir().expect("cwd")),
            state,
        )
    }

    fn echo_command(marker: &str) -> String {
        if cfg!(target_os = "windows") {
            format!("echo {marker}\r\n")
        } else {
            format!("echo {marker}\n")
        }
    }

    fn unique_temp_dir() -> PathBuf {
        let suffix = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "runtime-shell-core-terminal-{}-{}",
            std::process::id(),
            suffix
        ));
        std::fs::create_dir_all(&dir).expect("temporary test directory should be created");
        dir
    }

    #[test]
    fn session_lifecycle_tracks_state_and_caps_history() {
        let mut session = test_session(TerminalSessionState::Created);
        assert!(session.is_active());

        for index in 0..(MAX_TERMINAL_SESSION_LINES + 5) {
            session.push_line(format!("line-{index}"));
        }
        assert_eq!(session.lines.len(), MAX_TERMINAL_SESSION_LINES);
        assert_eq!(session.lines.first().map(String::as_str), Some("line-5"));

        session.set_state(TerminalSessionState::Exited, 42);
        assert!(!session.is_active());
        assert_eq!(session.updated_at, 42);
    }

    #[test]
    fn registry_write_read_and_resize_round_trip() {
        let cwd = unique_temp_dir();
        let mut registry = TerminalProcessRegistry::new();
        let spec = TerminalSpawnSpec::new(cwd, resolve_shell(None));

        registry
            .ensure_process("session-1", &spec)
            .expect("terminal process should spawn");
        registry
            .with_process_mut("session-1", |handle| handle.resize(40, 120))
            .expect("resize should succeed");
        registry
            .with_process_mut("session-1", |handle| {
                handle.write_raw_input(echo_command("runtime-shell-core").as_str())
            })
            .expect("raw input should succeed");

        let mut saw_line = false;
        let mut saw_chunk = false;
        for _ in 0..24 {
            let lines = registry.drain_line_output("session-1");
            if lines.iter().any(|line| line.contains("runtime-shell-core")) {
                saw_line = true;
            }
            let chunks = registry.drain_raw_output("session-1");
            if chunks
                .iter()
                .any(|chunk| chunk.contains("runtime-shell-core"))
            {
                saw_chunk = true;
            }
            if saw_line && saw_chunk {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }

        assert!(saw_line, "expected echoed line in drained output");
        assert!(saw_chunk, "expected echoed chunk in raw output");
        registry.terminate_all();
    }

    #[test]
    fn registry_raw_output_subscription_receives_chunks_and_unsubscribe_disconnects() {
        let cwd = unique_temp_dir();
        let mut registry = TerminalProcessRegistry::new();
        let spec = TerminalSpawnSpec::new(cwd, resolve_shell(None));

        registry
            .ensure_process("session-stream", &spec)
            .expect("terminal process should spawn");
        let subscription = registry
            .subscribe_raw_output("session-stream")
            .expect("subscription should attach to active session");

        registry
            .with_process_mut("session-stream", |handle| {
                handle.write_raw_input(echo_command("runtime-shell-subscribe").as_str())
            })
            .expect("raw input should succeed");

        let chunk = subscription
            .recv_timeout(Duration::from_secs(1))
            .expect("subscription should receive echoed chunk");
        assert!(
            chunk.contains("runtime-shell-subscribe"),
            "unexpected subscription chunk: {chunk:?}"
        );

        assert!(registry.unsubscribe_raw_output("session-stream", subscription.subscription_id()));
        assert!(
            !registry.unsubscribe_raw_output("session-stream", subscription.subscription_id()),
            "unsubscribing twice should report false"
        );
        assert!(
            matches!(
                subscription.recv_timeout(Duration::from_millis(250)),
                Err(mpsc::RecvTimeoutError::Disconnected)
            ),
            "subscription should disconnect once unsubscribed"
        );

        registry.terminate_all();
    }

    #[test]
    fn registry_close_and_cleanup_removes_processes() {
        let cwd = unique_temp_dir();
        let mut registry = TerminalProcessRegistry::new();
        let spec = TerminalSpawnSpec::new(cwd.clone(), resolve_shell(None));
        registry
            .ensure_process("session-close", &spec)
            .expect("terminal process should spawn");
        assert!(registry.contains("session-close"));
        assert!(registry.terminate("session-close"));
        assert!(!registry.contains("session-close"));
        assert!(!registry.terminate("session-close"));
    }

    #[test]
    fn runtime_status_reports_ready_and_unsupported_states() {
        let ready = build_terminal_runtime_status(TerminalRuntimeState::Ready, 2);
        assert_eq!(ready.state, TerminalRuntimeState::Ready);
        assert!(ready.message.contains("2 active session(s)"));

        let unsupported = build_terminal_runtime_status(TerminalRuntimeState::Unsupported, 0);
        assert_eq!(unsupported.state, TerminalRuntimeState::Unsupported);
        assert!(unsupported.message.contains("not supported"));
    }

    #[test]
    fn map_exit_status_preserves_signal_when_available() {
        let mapped = map_exit_status(&portable_pty::ExitStatus::with_signal("SIGTERM"));
        assert_eq!(mapped.exit_code, Some(1));
        assert_eq!(mapped.signal.as_deref(), Some("SIGTERM"));
    }
}
