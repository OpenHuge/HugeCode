use crate::models::{TerminalStatus, TerminalStatusState};
use ku0_runtime_shell_core::{build_terminal_runtime_status, TerminalRuntimeState};

use super::state_utils::runtime_state_path_from_env;
use super::{terminal_process, RuntimeBackend};

pub(crate) fn current_runtime_state_path_display() -> String {
    runtime_state_path_from_env().display().to_string()
}

pub(crate) fn current_terminal_shell_command_line() -> String {
    terminal_process::describe_terminal_shell_command()
}

pub(crate) fn current_terminal_shell_source() -> &'static str {
    terminal_process::terminal_shell_source()
}

impl RuntimeBackend {
    pub fn runtime_state_path_display(&self) -> String {
        self.state_path.to_string_lossy().to_string()
    }

    pub fn terminal_shell_command_line(&self) -> String {
        terminal_process::describe_terminal_shell_command()
    }

    pub fn terminal_shell_source(&self) -> &'static str {
        terminal_process::terminal_shell_source()
    }

    pub fn terminal_status(&self) -> TerminalStatus {
        let state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while reading terminal status");
        let active_count = state
            .terminal_sessions
            .values()
            .filter(|session| session.is_active())
            .count();
        let status = build_terminal_runtime_status(TerminalRuntimeState::Ready, active_count);
        TerminalStatus {
            state: terminal_status_state_from_runtime(status.state),
            message: status.message,
        }
    }
}

fn terminal_status_state_from_runtime(
    state: ku0_runtime_shell_core::TerminalRuntimeState,
) -> TerminalStatusState {
    match state {
        ku0_runtime_shell_core::TerminalRuntimeState::Ready => TerminalStatusState::Ready,
        ku0_runtime_shell_core::TerminalRuntimeState::Uninitialized => {
            TerminalStatusState::Uninitialized
        }
        ku0_runtime_shell_core::TerminalRuntimeState::Unsupported => {
            TerminalStatusState::Unsupported
        }
    }
}
