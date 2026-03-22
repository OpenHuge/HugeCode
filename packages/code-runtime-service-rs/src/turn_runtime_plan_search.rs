use ku0_runtime_shell_core::ShellFamily;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

fn preferred_search_output_limit_suffix(shell_family: ShellFamily) -> &'static str {
    match shell_family {
        ShellFamily::PowerShell => " | Select-Object -First 200",
        _ => " | head -n 200",
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum WorkspaceSearchBackend {
    Rg,
    NativeFallback,
}

fn probe_command_available(executable: &str, args: &[&str]) -> bool {
    Command::new(executable)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub(super) fn runtime_rg_available() -> bool {
    static RG_AVAILABLE: OnceLock<bool> = OnceLock::new();
    *RG_AVAILABLE.get_or_init(|| probe_command_available("rg", &["--version"]))
}

pub(super) fn preferred_workspace_search_backend(
    _shell_family: ShellFamily,
    rg_available: bool,
) -> WorkspaceSearchBackend {
    if rg_available {
        WorkspaceSearchBackend::Rg
    } else {
        WorkspaceSearchBackend::NativeFallback
    }
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn powershell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn cmd_double_quote(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn shell_quote_for_family(value: &str, shell_family: ShellFamily) -> String {
    match shell_family {
        ShellFamily::Posix => shell_single_quote(value),
        ShellFamily::PowerShell => powershell_single_quote(value),
        ShellFamily::Cmd => cmd_double_quote(value),
    }
}

fn build_native_workspace_search_command(pattern: &str, shell_family: ShellFamily) -> String {
    match shell_family {
        ShellFamily::PowerShell => format!(
            "Get-ChildItem -Path src, apps, packages, . -Recurse -File -ErrorAction SilentlyContinue | Where-Object {{ $_.FullName -notmatch '[\\\\/](node_modules|dist|\\.git|coverage|target|\\.turbo|build)[\\\\/]' }} | Select-String -Pattern {} | ForEach-Object {{ \"{{0}}:{{1}}:{{2}}\" -f $_.Path, $_.LineNumber, $_.Line.Trim() }} | Select-Object -First 200",
            powershell_single_quote(pattern)
        ),
        ShellFamily::Cmd => format!(
            "powershell -NoLogo -NoProfile -Command \"Get-ChildItem -Path src, apps, packages, . -Recurse -File -ErrorAction SilentlyContinue | Where-Object {{ $_.FullName -notmatch '[\\\\/](node_modules|dist|\\.git|coverage|target|\\.turbo|build)[\\\\/]' }} | Select-String -Pattern {} | ForEach-Object {{ '{{0}}:{{1}}:{{2}}' -f $_.Path, $_.LineNumber, $_.Line.Trim() }} | Select-Object -First 200\"",
            powershell_single_quote(pattern)
        ),
        ShellFamily::Posix => format!(
            "grep -RInE --binary-files=without-match --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=coverage --exclude-dir=target --exclude-dir=.turbo --exclude-dir=build -- {} src apps packages .{}",
            shell_single_quote(pattern),
            preferred_search_output_limit_suffix(shell_family)
        ),
    }
}

pub(super) fn build_sanitized_workspace_search_command_for_backend(
    pattern: &str,
    shell_family: ShellFamily,
    backend: WorkspaceSearchBackend,
) -> String {
    match backend {
        WorkspaceSearchBackend::Rg => format!(
            "rg -n -S --hidden --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.git/**' --glob '!**/coverage/**' --glob '!**/target/**' --glob '!**/.turbo/**' --glob '!**/build/**' -e {} .{}",
            shell_quote_for_family(pattern, shell_family),
            preferred_search_output_limit_suffix(shell_family)
        ),
        WorkspaceSearchBackend::NativeFallback => {
            build_native_workspace_search_command(pattern, shell_family)
        }
    }
}
