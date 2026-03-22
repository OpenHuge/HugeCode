use crate::backend::runtime_backend;
use crate::commands::local_codex_paths::command_exists_on_path;
use crate::models::WorkspaceSummary;
#[cfg(target_os = "macos")]
use base64::Engine as _;
#[cfg(target_os = "macos")]
use std::fs;
#[cfg(target_os = "macos")]
use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
pub fn code_workspaces_list() -> Vec<WorkspaceSummary> {
    runtime_backend().workspaces()
}

#[tauri::command]
pub fn code_workspace_create(
    path: String,
    display_name: Option<String>,
) -> Result<WorkspaceSummary, String> {
    runtime_backend().create_workspace_if_valid(&path, display_name)
}

#[tauri::command]
pub fn code_workspace_rename(
    workspace_id: String,
    display_name: String,
) -> Option<WorkspaceSummary> {
    runtime_backend().rename_workspace(&workspace_id, display_name)
}

#[tauri::command]
pub fn code_workspace_remove(workspace_id: String) -> bool {
    runtime_backend().remove_workspace(&workspace_id)
}

#[allow(dead_code)]
#[derive(Debug, PartialEq, Eq)]
enum WorkspaceOpenTarget {
    Reveal {
        path: String,
    },
    App {
        path: String,
        app: String,
        args: Vec<String>,
    },
    Command {
        path: String,
        command: String,
        args: Vec<String>,
    },
}

#[allow(dead_code)]
fn normalized_open_args(args: Vec<String>) -> Vec<String> {
    args.into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect()
}

#[allow(dead_code)]
fn resolve_open_workspace_target(
    path: String,
    app: Option<String>,
    command: Option<String>,
    args: Vec<String>,
) -> Result<WorkspaceOpenTarget, String> {
    let trimmed_path = path.trim().to_string();
    if trimmed_path.is_empty() {
        return Err("Missing workspace path.".to_string());
    }
    let args = normalized_open_args(args);
    if let Some(command) = command
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        if !command_exists_on_path(&command) {
            return Err(format!(
                "Open app command `{command}` is unavailable on PATH."
            ));
        }
        return Ok(WorkspaceOpenTarget::Command {
            path: trimmed_path,
            command,
            args,
        });
    }
    if let Some(app) = app
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return Ok(WorkspaceOpenTarget::App {
            path: trimmed_path,
            app,
            args,
        });
    }
    Ok(WorkspaceOpenTarget::Reveal { path: trimmed_path })
}

#[allow(dead_code)]
fn run_open_workspace_target(target: WorkspaceOpenTarget) -> Result<(), String> {
    match target {
        WorkspaceOpenTarget::Reveal { path } => {
            tauri_plugin_opener::reveal_item_in_dir(path).map_err(|error| error.to_string())
        }
        WorkspaceOpenTarget::Command {
            path,
            command,
            args,
        } => {
            let mut launch = Command::new(&command);
            launch.args(args);
            launch.arg(path);
            launch
                .spawn()
                .map(|_| ())
                .map_err(|error| format!("Failed to launch `{command}`: {error}"))
        }
        WorkspaceOpenTarget::App { path, app, args } => {
            let _ = &args;
            #[cfg(target_os = "macos")]
            {
                let mut launch = Command::new("open");
                launch.arg("-a");
                launch.arg(&app);
                launch.arg(path);
                if !args.is_empty() {
                    launch.arg("--args");
                    launch.args(args);
                }
                return launch
                    .spawn()
                    .map(|_| ())
                    .map_err(|error| format!("Failed to launch `{app}`: {error}"));
            }

            #[cfg(not(target_os = "macos"))]
            {
                tauri_plugin_opener::open_path(path, Some(app.as_str()))
                    .map_err(|error| error.to_string())
            }
        }
    }
}

#[allow(dead_code)]
#[tauri::command]
pub fn open_workspace_in(
    path: String,
    app: Option<String>,
    command: Option<String>,
    args: Vec<String>,
) -> Result<(), String> {
    let target = resolve_open_workspace_target(path, app, command, args)?;
    run_open_workspace_target(target)
}

#[allow(dead_code)]
#[cfg(target_os = "macos")]
fn find_app_bundle(app_name: &str) -> Option<PathBuf> {
    let trimmed = app_name.trim();
    if trimmed.is_empty() {
        return None;
    }
    let direct = PathBuf::from(trimmed);
    if direct.exists() {
        return Some(direct);
    }
    let bundle_name = if trimmed.to_ascii_lowercase().ends_with(".app") {
        trimmed.to_string()
    } else {
        format!("{trimmed}.app")
    };
    let mut roots = vec![
        PathBuf::from("/Applications"),
        PathBuf::from("/System/Applications"),
        PathBuf::from("/Applications/Utilities"),
    ];
    if let Ok(home) = std::env::var("HOME") {
        roots.push(PathBuf::from(home).join("Applications"));
    }
    roots.into_iter().find_map(|root| {
        let path = root.join(&bundle_name);
        path.exists().then_some(path)
    })
}

#[allow(dead_code)]
#[cfg(target_os = "macos")]
fn defaults_read(info_domain: &PathBuf, key: &str) -> Option<String> {
    let output = Command::new("defaults")
        .arg("read")
        .arg(info_domain)
        .arg(key)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!value.is_empty()).then_some(value)
}

#[allow(dead_code)]
#[cfg(target_os = "macos")]
fn resolve_icon_name(bundle_path: &PathBuf) -> String {
    let info_domain = bundle_path.join("Contents/Info");
    defaults_read(&info_domain, "CFBundleIconFile")
        .or_else(|| defaults_read(&info_domain, "CFBundleIconName"))
        .unwrap_or_else(|| {
            bundle_path
                .file_stem()
                .map(|stem| stem.to_string_lossy().to_string())
                .unwrap_or_else(|| "AppIcon".to_string())
        })
}

#[allow(dead_code)]
#[cfg(target_os = "macos")]
fn resolve_icon_path(bundle_path: &PathBuf, icon_name: &str) -> Option<PathBuf> {
    let resources_dir = bundle_path.join("Contents/Resources");
    if !resources_dir.exists() {
        return None;
    }
    for candidate in [
        format!("{icon_name}.icns"),
        format!("{icon_name}.png"),
        "AppIcon.icns".to_string(),
        "AppIcon.png".to_string(),
    ] {
        let path = resources_dir.join(candidate);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

#[allow(dead_code)]
#[cfg(target_os = "macos")]
fn load_icon_png_bytes(icon_path: &PathBuf, app_name: &str) -> Option<Vec<u8>> {
    let ext = icon_path
        .extension()
        .map(|value| value.to_string_lossy().to_ascii_lowercase());
    if matches!(ext.as_deref(), Some("png")) {
        return fs::read(icon_path).ok();
    }
    let out_path = std::env::temp_dir().join(format!(
        "hugecode-open-app-icon-{}.png",
        app_name
            .chars()
            .filter(|value| value.is_ascii_alphanumeric())
            .collect::<String>()
    ));
    let status = Command::new("sips")
        .arg("-s")
        .arg("format")
        .arg("png")
        .arg(icon_path)
        .arg("--out")
        .arg(&out_path)
        .status()
        .ok()?;
    if !status.success() {
        let _ = fs::remove_file(&out_path);
        return None;
    }
    let bytes = fs::read(&out_path).ok();
    let _ = fs::remove_file(&out_path);
    bytes
}

#[allow(dead_code)]
#[cfg(target_os = "macos")]
fn get_open_app_icon_inner(app_name: &str) -> Option<String> {
    let bundle_path = find_app_bundle(app_name)?;
    let icon_name = resolve_icon_name(&bundle_path);
    let icon_path = resolve_icon_path(&bundle_path, &icon_name)?;
    let png_bytes = load_icon_png_bytes(&icon_path, app_name)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(png_bytes);
    Some(format!("data:image/png;base64,{encoded}"))
}

#[allow(dead_code)]
#[tauri::command]
pub fn get_open_app_icon(app_name: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        return Ok(get_open_app_icon_inner(&app_name));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app_name;
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_open_workspace_target, WorkspaceOpenTarget};

    #[test]
    fn resolves_app_launcher_targets_without_changing_antigravity_app_name() {
        let target = resolve_open_workspace_target(
            "/tmp/workspace".to_string(),
            Some("Antigravity".to_string()),
            None,
            vec!["--new-window".to_string()],
        )
        .expect("app launch target should resolve");

        assert_eq!(
            target,
            WorkspaceOpenTarget::App {
                path: "/tmp/workspace".to_string(),
                app: "Antigravity".to_string(),
                args: vec!["--new-window".to_string()],
            }
        );
    }

    #[test]
    fn resolves_command_launcher_targets_without_changing_antigravity_command() {
        let current_exe = std::env::current_exe()
            .expect("current executable path")
            .to_string_lossy()
            .to_string();
        let target = resolve_open_workspace_target(
            "/tmp/workspace".to_string(),
            None,
            Some(current_exe.clone()),
            vec!["--new-window".to_string()],
        )
        .expect("command launch target should resolve");

        assert_eq!(
            target,
            WorkspaceOpenTarget::Command {
                path: "/tmp/workspace".to_string(),
                command: current_exe,
                args: vec!["--new-window".to_string()],
            }
        );
    }

    #[test]
    fn resolves_default_open_targets_to_reveal_mode() {
        let target =
            resolve_open_workspace_target("/tmp/workspace".to_string(), None, None, Vec::new())
                .expect("reveal target should resolve");

        assert_eq!(
            target,
            WorkspaceOpenTarget::Reveal {
                path: "/tmp/workspace".to_string(),
            }
        );
    }
}
