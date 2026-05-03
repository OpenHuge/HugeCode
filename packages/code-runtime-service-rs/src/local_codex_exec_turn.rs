use std::fs;
use std::io::ErrorKind;

use uuid::Uuid;

use super::{
    is_full_access_mode, is_read_only_access_mode,
    local_codex_cli_sessions::{
        resolve_local_codex_browser_debug_config_overrides,
        resolve_local_codex_exec_config_overrides, resolve_local_codex_home_dir,
    },
    local_codex_exec_path::{
        format_local_codex_command, new_local_codex_command, resolve_local_codex_exec_binary,
        CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV,
    },
    truncate_text_for_error, CODE_RUNTIME_TURNS_USE_LOCAL_CODEX_EXEC_ENV,
};

fn env_flag_enabled(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_some_and(|value| matches!(value.as_str(), "1" | "true" | "yes" | "on"))
}

pub(super) fn should_use_local_codex_exec_for_turn() -> bool {
    env_flag_enabled(CODE_RUNTIME_TURNS_USE_LOCAL_CODEX_EXEC_ENV)
}

fn summarize_command_output(bytes: &[u8], max_chars: usize) -> String {
    let text = String::from_utf8_lossy(bytes);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "<empty>".to_string();
    }
    truncate_text_for_error(trimmed, max_chars)
}

fn parse_codex_turn_message_from_stdout(stdout: &[u8]) -> Option<String> {
    String::from_utf8_lossy(stdout)
        .lines()
        .map(str::trim)
        .rev()
        .find(|line| !line.is_empty() && !line.eq_ignore_ascii_case("tokens used"))
        .map(str::to_string)
}

fn local_codex_exec_mode_flags(access_mode: &str) -> Vec<&'static str> {
    if is_read_only_access_mode(access_mode) {
        return vec!["--sandbox", "read-only"];
    }
    if is_full_access_mode(access_mode) {
        return vec!["--dangerously-bypass-approvals-and-sandbox"];
    }
    vec!["--full-auto"]
}

fn local_codex_command_environment_overrides() -> Vec<(&'static str, String)> {
    resolve_local_codex_home_dir()
        .map(|home| vec![("CODEX_HOME", home.to_string_lossy().to_string())])
        .unwrap_or_default()
}

fn local_codex_command_config_overrides(workspace_path: Option<&str>) -> Vec<String> {
    let mut args = resolve_local_codex_exec_config_overrides();
    args.extend(resolve_local_codex_browser_debug_config_overrides(
        workspace_path,
    ));
    args
}

fn resolve_local_codex_exec_command_args(
    workspace_path: &str,
    content: &str,
    model_id: Option<&str>,
    access_mode: &str,
    output_path: &str,
    codex_args: &[String],
    config_args: &[String],
) -> Vec<String> {
    let mut args = codex_args
        .iter()
        .chain(config_args.iter())
        .map(|entry| entry.trim())
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    args.push("exec".to_string());
    if let Some(model_id) = model_id.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("--model".to_string());
        args.push(model_id.to_string());
    }
    args.push("--ephemeral".to_string());
    args.push("--skip-git-repo-check".to_string());
    args.push("--output-last-message".to_string());
    args.push(output_path.to_string());
    args.push("-C".to_string());
    args.push(workspace_path.to_string());
    for flag in local_codex_exec_mode_flags(access_mode) {
        args.push(flag.to_string());
    }
    args.push(content.to_string());
    args
}

pub(super) async fn query_local_codex_exec_turn(
    workspace_path: &str,
    content: &str,
    model_id: Option<&str>,
    access_mode: &str,
    codex_bin_override: Option<&str>,
    codex_args: &[String],
) -> Result<String, String> {
    let workspace = workspace_path.trim();
    if workspace.is_empty() {
        return Err("workspace path is empty for local codex execution.".to_string());
    }
    fs::create_dir_all(workspace).map_err(|error| {
        format!("failed to prepare workspace path for local codex execution: {error}")
    })?;

    let output_path =
        std::env::temp_dir().join(format!("code-runtime-turn-{}.txt", Uuid::new_v4()));
    let codex_exec_path = resolve_local_codex_exec_binary(codex_bin_override);
    let display_binary = format_local_codex_command(codex_exec_path.as_str());
    let mut command = new_local_codex_command(codex_exec_path.as_str());
    for (key, value) in local_codex_command_environment_overrides() {
        command.env(key, value);
    }
    let command_args = resolve_local_codex_exec_command_args(
        workspace,
        content,
        model_id,
        access_mode,
        output_path.to_string_lossy().as_ref(),
        codex_args,
        local_codex_command_config_overrides(Some(workspace)).as_slice(),
    );
    for argument in command_args {
        command.arg(argument);
    }

    let output = command
        .output()
        .await
        .map_err(|error| {
            if error.kind() == ErrorKind::NotFound {
                return format!(
                    "failed to run `{}` (not found). Install Codex CLI or set {} to a valid executable path.",
                    display_binary, CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH_ENV
                );
            }
            format!("failed to run `{}`: {error}", display_binary)
        })?;

    let read_output_message = fs::read_to_string(output_path.as_path())
        .ok()
        .and_then(|message| {
            let trimmed = message.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        });
    let _ = fs::remove_file(output_path.as_path());

    if !output.status.success() {
        return Err(format!(
            "`codex exec` failed (status {:?}): stderr={}, stdout={}",
            output.status.code(),
            summarize_command_output(output.stderr.as_slice(), 600),
            summarize_command_output(output.stdout.as_slice(), 600)
        ));
    }

    if let Some(message) = read_output_message {
        return Ok(message);
    }
    if let Some(message) = parse_codex_turn_message_from_stdout(output.stdout.as_slice()) {
        return Ok(message);
    }
    Err("local codex execution completed without a final response message.".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        local_codex_command_config_overrides, local_codex_command_environment_overrides,
        local_codex_exec_mode_flags, resolve_local_codex_exec_command_args,
    };
    use crate::local_codex_exec_path::{
        local_codex_exec_env_lock, resolve_local_codex_exec_binary,
    };
    use std::fs;
    use uuid::Uuid;

    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let path = std::env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
            fs::create_dir_all(path.as_path()).expect("create temp dir");
            Self { path }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(self.path.as_path());
        }
    }

    #[test]
    fn local_codex_exec_mode_flags_map_access_modes() {
        assert_eq!(
            local_codex_exec_mode_flags("read-only"),
            vec!["--sandbox", "read-only"]
        );
        assert_eq!(
            local_codex_exec_mode_flags("read_only"),
            vec!["--sandbox", "read-only"]
        );
        assert_eq!(
            local_codex_exec_mode_flags("full-access"),
            vec!["--dangerously-bypass-approvals-and-sandbox"]
        );
        assert_eq!(
            local_codex_exec_mode_flags("danger-full-access"),
            vec!["--dangerously-bypass-approvals-and-sandbox"]
        );
        assert_eq!(
            local_codex_exec_mode_flags("on-request"),
            vec!["--full-auto"]
        );
    }

    #[test]
    fn resolve_local_codex_exec_binary_uses_override_when_present() {
        assert_eq!(
            resolve_local_codex_exec_binary(Some("custom-codex")),
            "custom-codex".to_string()
        );
        assert_eq!(
            resolve_local_codex_exec_binary(Some("  /usr/local/bin/codex  ")),
            "/usr/local/bin/codex".to_string()
        );
    }

    #[test]
    fn resolve_local_codex_exec_command_args_prefixes_codex_args_before_exec() {
        let args = resolve_local_codex_exec_command_args(
            "/tmp/workspace",
            "hello",
            Some("gpt-5.3-codex"),
            "on-request",
            "/tmp/out.txt",
            &["--profile".to_string(), "personal".to_string()],
            &[
                "-c".to_string(),
                "mcp_servers.figma.enabled=false".to_string(),
            ],
        );

        assert_eq!(
            args,
            vec![
                "--profile".to_string(),
                "personal".to_string(),
                "-c".to_string(),
                "mcp_servers.figma.enabled=false".to_string(),
                "exec".to_string(),
                "--model".to_string(),
                "gpt-5.3-codex".to_string(),
                "--ephemeral".to_string(),
                "--skip-git-repo-check".to_string(),
                "--output-last-message".to_string(),
                "/tmp/out.txt".to_string(),
                "-C".to_string(),
                "/tmp/workspace".to_string(),
                "--full-auto".to_string(),
                "hello".to_string(),
            ]
        );
    }

    #[test]
    fn local_codex_command_environment_overrides_export_runtime_home_as_codex_home() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex exec env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");

        unsafe {
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", "/tmp/runtime-codex-home");
            std::env::remove_var("CODEX_HOME");
        }

        let overrides = local_codex_command_environment_overrides();
        assert_eq!(
            overrides,
            vec![("CODEX_HOME", "/tmp/runtime-codex-home".to_string())]
        );

        unsafe {
            match previous_runtime_home {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
            }
            match previous_codex_home {
                Some(value) => std::env::set_var("CODEX_HOME", value),
                None => std::env::remove_var("CODEX_HOME"),
            }
        }
    }

    #[test]
    fn local_codex_command_config_overrides_disable_configured_mcp_servers() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex exec env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp_dir = TempDir::new("local-codex-exec-config");
        fs::write(
            temp_dir.path.join("config.toml"),
            r#"
                [mcp_servers.figma]
                command = "npx"

                [mcp_servers.playwright]
                command = "npx"

                [features]
                responses_websockets = true
                responses_websockets_v2 = true
            "#,
        )
        .expect("write config");

        unsafe {
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.path.as_os_str());
            std::env::remove_var("CODEX_HOME");
        }

        assert_eq!(
            local_codex_command_config_overrides(None),
            vec![
                "-c".to_string(),
                "mcp_servers.figma.enabled=false".to_string(),
                "-c".to_string(),
                "features.shell_snapshot=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets_v2=false".to_string(),
                "-c".to_string(),
                "features.js_repl=true".to_string(),
            ]
        );

        unsafe {
            match previous_runtime_home {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
            }
            match previous_codex_home {
                Some(value) => std::env::set_var("CODEX_HOME", value),
                None => std::env::remove_var("CODEX_HOME"),
            }
        }
    }
}
