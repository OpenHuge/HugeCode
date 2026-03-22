use std::path::{Path, PathBuf};

#[cfg(test)]
use ku0_runtime_shell_core::resolve_shell;
#[cfg(test)]
use std::io;
#[cfg(test)]
use std::io::BufRead;
#[cfg(test)]
use std::process::Command;
#[cfg(test)]
use std::process::Stdio;
#[cfg(test)]
use std::thread;

#[cfg(test)]
use super::TerminalLineAccumulator;
use super::MAX_TERMINAL_LINE_CHARS;

#[cfg(test)]
pub(super) fn execute_terminal_command(cwd: &Path, command: &str) -> super::TerminalCommandResult {
    if let Some(target) = parse_cd_target(command) {
        return match resolve_terminal_cwd(cwd, target.as_str()) {
            Ok(next_cwd) => super::TerminalCommandResult {
                lines: vec![format!("Changed directory to {}.", next_cwd.display())],
                new_cwd: Some(next_cwd),
            },
            Err(message) => super::TerminalCommandResult {
                lines: vec![message],
                new_cwd: None,
            },
        };
    }

    let output = run_terminal_subprocess(cwd, command);
    let mut lines = match output {
        Ok(mut command_output) => {
            if !command_output.status.success() {
                let status_line = match command_output.status.code() {
                    Some(code) => format!("Command exited with status code {code}."),
                    None => "Command terminated by signal.".to_string(),
                };
                command_output.lines.push(status_line);
            }
            command_output.lines.into_lines()
        }
        Err(message) => vec![message],
    };

    if lines.is_empty() {
        lines.push("Command completed with no output.".to_string());
    }

    super::TerminalCommandResult {
        lines,
        new_cwd: None,
    }
}

#[cfg(test)]
pub(super) fn run_terminal_subprocess(
    cwd: &Path,
    command: &str,
) -> Result<super::TerminalSubprocessOutput, String> {
    let shell_spec = resolve_shell(None);
    let mut shell_command = Command::new(shell_spec.executable.as_str());
    shell_command.args(shell_spec.command_args(command));

    shell_command
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = shell_command
        .spawn()
        .map_err(|error| format!("Failed to execute command '{command}': {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("Failed to capture stdout for command '{command}'."))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| format!("Failed to capture stderr for command '{command}'."))?;

    let stdout_reader = spawn_terminal_stream_reader(stdout, false);
    let stderr_reader = spawn_terminal_stream_reader(stderr, true);

    let status = child
        .wait()
        .map_err(|error| format!("Failed to wait for command '{command}': {error}"))?;

    let stdout_capture = match stdout_reader.join() {
        Ok(capture) => capture,
        Err(_) => {
            let mut capture = super::TerminalStreamCapture::new();
            capture.push(format!(
                "Failed to join stdout capture for command '{command}'."
            ));
            capture
        }
    };
    let stderr_capture = match stderr_reader.join() {
        Ok(capture) => capture,
        Err(_) => {
            let mut capture = super::TerminalStreamCapture::new();
            capture.push(format!(
                "Failed to join stderr capture for command '{command}'."
            ));
            capture
        }
    };

    // Preserve prior semantics: stdout lines are emitted before stderr lines.
    let mut lines = TerminalLineAccumulator::new();
    lines.merge_capture(stdout_capture);
    lines.merge_capture(stderr_capture);

    Ok(super::TerminalSubprocessOutput { lines, status })
}

#[cfg(test)]
fn spawn_terminal_stream_reader<R>(
    reader: R,
    is_stderr: bool,
) -> thread::JoinHandle<super::TerminalStreamCapture>
where
    R: io::Read + Send + 'static,
{
    thread::spawn(move || {
        let mut buffered = io::BufReader::new(reader);
        let mut raw_line = Vec::new();
        let mut capture = super::TerminalStreamCapture::new();
        loop {
            raw_line.clear();
            match buffered.read_until(b'\n', &mut raw_line) {
                Ok(0) => break,
                Ok(_) => {
                    let decoded = String::from_utf8_lossy(&raw_line);
                    let trimmed = decoded.trim_end();
                    let cleaned = sanitize_terminal_line(trimmed);
                    if cleaned.is_empty() {
                        continue;
                    }
                    let line = truncate_terminal_line(cleaned.as_str());
                    if is_stderr {
                        capture.push(format!("stderr: {line}"));
                    } else {
                        capture.push(line);
                    }
                }
                Err(error) => {
                    let message = format!(
                        "Failed to read {} stream: {error}",
                        if is_stderr { "stderr" } else { "stdout" }
                    );
                    capture.push(message);
                    break;
                }
            }
        }
        capture
    })
}

pub(super) fn truncate_terminal_line(line: &str) -> String {
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

#[cfg(test)]
fn sanitize_terminal_line(line: &str) -> String {
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
                let mut saw_escape = false;
                for next in chars.by_ref() {
                    if saw_escape && next == '\\' {
                        break;
                    }
                    if next == '\u{7}' {
                        break;
                    }
                    saw_escape = next == '\u{1b}';
                }
            }
            Some(_) | None => {}
        }
    }

    cleaned.trim().to_string()
}

pub(super) fn parse_cd_target(command: &str) -> Option<String> {
    let trimmed = command.trim();
    let remainder = trimmed.strip_prefix("cd")?;
    if !remainder.is_empty() && !remainder.chars().next().is_some_and(char::is_whitespace) {
        return None;
    }

    let mut target = remainder.trim();
    if target.is_empty() {
        return Some("~".to_string());
    }
    if let Some(stripped) = target
        .strip_prefix("/d")
        .or_else(|| target.strip_prefix("/D"))
        .filter(|value| value.is_empty() || value.chars().next().is_some_and(char::is_whitespace))
    {
        target = stripped.trim();
        if target.is_empty() {
            return Some("~".to_string());
        }
    }
    if target.len() >= 2 {
        let mut chars = target.chars();
        let first = chars.next().unwrap_or_default();
        let last = target.chars().last().unwrap_or_default();
        if matches!(first, '"' | '\'') && first == last {
            target = &target[first.len_utf8()..target.len() - last.len_utf8()];
        }
    }
    if target
        .chars()
        .any(|char| matches!(char, '&' | '|' | ';' | '\n'))
    {
        return None;
    }
    Some(target.trim().to_string())
}

pub(super) fn resolve_terminal_cwd(current_cwd: &Path, target: &str) -> Result<PathBuf, String> {
    let resolved = if target.is_empty() || target == "~" {
        home_dir().ok_or_else(|| "Unable to resolve home directory for cd command.".to_string())?
    } else if let Some(rest) = target.strip_prefix("~/") {
        home_dir()
            .ok_or_else(|| "Unable to resolve home directory for cd command.".to_string())?
            .join(rest)
    } else {
        let path = PathBuf::from(target);
        if path.is_absolute() {
            path
        } else {
            current_cwd.join(path)
        }
    };

    let canonical = resolved
        .canonicalize()
        .map_err(|error| format!("Unable to change directory to '{target}': {error}"))?;
    if !canonical.is_dir() {
        return Err(format!(
            "Unable to change directory to '{target}': target is not a directory."
        ));
    }
    Ok(canonical)
}

fn home_dir() -> Option<PathBuf> {
    if let Some(home) = std::env::var_os("HOME") {
        return Some(PathBuf::from(home));
    }
    std::env::var_os("USERPROFILE").map(PathBuf::from)
}

pub(super) fn fallback_current_dir() -> PathBuf {
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[cfg(test)]
mod tests {
    use super::{parse_cd_target, sanitize_terminal_line};

    #[test]
    fn parse_cd_target_supports_quoted_and_drive_switch_forms() {
        assert_eq!(
            parse_cd_target(r#"cd "C:\Program Files""#),
            Some(r"C:\Program Files".to_string())
        );
        assert_eq!(
            parse_cd_target(r#"cd /d "D:\Workspace Root""#),
            Some(r"D:\Workspace Root".to_string())
        );
        assert_eq!(parse_cd_target("cd"), Some("~".to_string()));
        assert_eq!(parse_cd_target("cd && whoami"), None);
    }

    #[test]
    fn sanitize_terminal_line_removes_ansi_sequences() {
        assert_eq!(
            sanitize_terminal_line("\u{1b}[2J\u{1b}[?25lparity\u{1b}[46X"),
            "parity"
        );
        assert_eq!(
            sanitize_terminal_line("\u{1b}]0;C:\\Windows\\system32\\cmd.exe\u{7}ready"),
            "ready"
        );
    }
}
