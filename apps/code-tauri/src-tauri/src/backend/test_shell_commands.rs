use ku0_runtime_shell_core::{resolve_shell, ShellFamily};

pub(super) fn echo_many_lines_command(total_lines: usize) -> String {
    match resolve_shell(None).family {
        ShellFamily::PowerShell => {
            format!("1..{total_lines} | ForEach-Object {{ Write-Output (\"line-{{0}}\" -f $_) }}")
        }
        ShellFamily::Cmd => format!("for /L %i in (1,1,{total_lines}) do @echo line-%i"),
        ShellFamily::Posix => {
            format!("i=1; while [ \"$i\" -le {total_lines} ]; do echo line-$i; i=$((i+1)); done")
        }
    }
}

pub(super) fn mixed_stdout_stderr_command() -> String {
    match resolve_shell(None).family {
        ShellFamily::PowerShell => "[Console]::Out.WriteLine('stdout-1'); [Console]::Error.WriteLine('stderr-1'); [Console]::Out.WriteLine('stdout-2'); [Console]::Error.WriteLine('stderr-2')".to_string(),
        ShellFamily::Cmd => {
            "echo stdout-1 & echo stderr-1 1>&2 & echo stdout-2 & echo stderr-2 1>&2".to_string()
        }
        ShellFamily::Posix => {
            "printf 'stdout-1\\n'; printf 'stderr-1\\n' 1>&2; printf 'stdout-2\\n'; printf 'stderr-2\\n' 1>&2".to_string()
        }
    }
}

pub(super) fn stderr_only_command() -> String {
    match resolve_shell(None).family {
        ShellFamily::PowerShell => "[Console]::Error.WriteLine('stderr-only')".to_string(),
        ShellFamily::Cmd => "echo stderr-only 1>&2".to_string(),
        ShellFamily::Posix => "printf 'stderr-only\\n' 1>&2".to_string(),
    }
}
