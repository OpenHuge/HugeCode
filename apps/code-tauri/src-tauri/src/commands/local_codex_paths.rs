use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

const CODE_RUNTIME_LOCAL_CODEX_HOME_ENV: &str = "CODE_RUNTIME_LOCAL_CODEX_HOME";
const CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH_ENV: &str = "CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH";
const CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH_ENV: &str = "CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH";
const LOCAL_CODEX_ALWAYS_DISABLED_FEATURE_IDS: &[&str] = &["shell_snapshot"];
const LOCAL_CODEX_DISABLED_IF_ENABLED_FEATURE_IDS: &[&str] =
    &["responses_websockets", "responses_websockets_v2"];
const LOCAL_CODEX_RUNTIME_PRESERVED_MCP_SERVER_IDS: &[&str] = &["playwright"];
const LOCAL_CODEX_PLAYWRIGHT_SERVER_ID: &str = "playwright";
const LOCAL_CODEX_JS_REPL_FEATURE_ID: &str = "js_repl";
const LOCAL_PLAYWRIGHT_MCP_PACKAGE_ID: &str = "@playwright/mcp";
const LOCAL_PLAYWRIGHT_MCP_COMMAND: &str = "playwright-mcp";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct LocalCodexPlaywrightRuntimeAvailability {
    pub(super) package_root: Option<PathBuf>,
    pub(super) available: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub(super) struct LocalCodexMcpServerStatus {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) status: String,
    pub(super) tools: Option<Value>,
    pub(super) warnings: Vec<String>,
}

fn path_from_env_value(value: Option<OsString>) -> Option<PathBuf> {
    value.and_then(|entry| {
        let trimmed = entry.to_string_lossy().trim().to_string();
        if trimmed.is_empty() {
            return None;
        }
        Some(PathBuf::from(trimmed))
    })
}

fn read_non_empty_env_path(name: &str) -> Option<PathBuf> {
    path_from_env_value(std::env::var_os(name))
}

fn resolve_local_codex_home_dir_from_paths(
    runtime_codex_home: Option<PathBuf>,
    codex_home: Option<PathBuf>,
    home: Option<PathBuf>,
    userprofile: Option<PathBuf>,
) -> Option<PathBuf> {
    runtime_codex_home
        .or(codex_home)
        .or_else(|| home.map(|entry| entry.join(".codex")))
        .or_else(|| userprofile.map(|entry| entry.join(".codex")))
}

pub(super) fn resolve_local_codex_home_dir() -> Option<PathBuf> {
    resolve_local_codex_home_dir_from_paths(
        read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_HOME_ENV),
        read_non_empty_env_path("CODEX_HOME"),
        read_non_empty_env_path("HOME"),
        read_non_empty_env_path("USERPROFILE"),
    )
}

pub(super) fn resolve_local_codex_auth_path() -> Option<PathBuf> {
    read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH_ENV)
        .or_else(|| resolve_local_codex_home_dir().map(|home| home.join("auth.json")))
}

pub(super) fn resolve_local_codex_config_path() -> Option<PathBuf> {
    resolve_local_codex_home_dir().map(|home| home.join("config.toml"))
}

fn load_local_codex_config_table() -> Option<toml::Table> {
    let path = resolve_local_codex_config_path()?;
    let raw = std::fs::read_to_string(path).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    toml::from_str::<toml::Table>(trimmed).ok()
}

fn parse_configured_local_codex_mcp_server_ids_from_table(payload: &toml::Table) -> Vec<String> {
    let Some(mcp_servers) = payload.get("mcp_servers").and_then(toml::Value::as_table) else {
        return Vec::new();
    };

    let mut ids = BTreeSet::new();
    for server_id in mcp_servers.keys() {
        let trimmed = server_id.trim();
        if trimmed.is_empty() {
            continue;
        }
        ids.insert(trimmed.to_string());
    }

    ids.into_iter().collect()
}

fn is_runtime_preserved_mcp_server_id(server_id: &str) -> bool {
    LOCAL_CODEX_RUNTIME_PRESERVED_MCP_SERVER_IDS
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(server_id))
}

fn configured_local_codex_mcp_server_enabled(payload: &toml::Table, server_id: &str) -> bool {
    payload
        .get("mcp_servers")
        .and_then(toml::Value::as_table)
        .and_then(|servers| servers.get(server_id))
        .and_then(toml::Value::as_table)
        .and_then(|server| server.get("enabled"))
        .and_then(toml::Value::as_bool)
        .unwrap_or(true)
}

fn build_local_codex_mcp_disabled_config_args(server_ids: &[String]) -> Vec<String> {
    let mut args = Vec::new();
    for server_id in server_ids {
        if is_runtime_preserved_mcp_server_id(server_id) {
            continue;
        }
        if !server_id
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_'))
        {
            continue;
        }
        args.push("-c".to_string());
        args.push(format!("mcp_servers.{server_id}.enabled=false"));
    }
    args
}

pub(crate) fn command_exists_on_path(command: &str) -> bool {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return false;
    }
    let candidate = Path::new(trimmed);
    if candidate.components().count() > 1 {
        return candidate.is_file();
    }
    let Some(path_env) = std::env::var_os("PATH") else {
        return false;
    };
    let executable_suffixes = if cfg!(windows) {
        std::env::var_os("PATHEXT")
            .map(|value| {
                value
                    .to_string_lossy()
                    .split(';')
                    .map(str::trim)
                    .filter(|entry| !entry.is_empty())
                    .map(ToOwned::to_owned)
                    .collect::<Vec<_>>()
            })
            .filter(|entries| !entries.is_empty())
            .unwrap_or_else(|| {
                vec![
                    ".EXE".to_string(),
                    ".CMD".to_string(),
                    ".BAT".to_string(),
                    ".COM".to_string(),
                ]
            })
    } else {
        vec![String::new()]
    };

    std::env::split_paths(path_env.as_os_str()).any(|dir| {
        let joined = dir.join(trimmed);
        if joined.is_file() {
            return true;
        }
        executable_suffixes.iter().any(|suffix| {
            let suffixed = dir.join(format!("{trimmed}{suffix}"));
            suffixed.is_file()
        })
    })
}

fn find_workspace_package_root(workspace_path: Option<&str>) -> Option<PathBuf> {
    let start = workspace_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)?;
    let mut current = if start.is_dir() {
        start
    } else {
        start.parent().map(Path::to_path_buf)?
    };
    loop {
        if current.join("package.json").is_file() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn package_json_exposes_playwright_mcp(path: &Path) -> bool {
    let raw = match std::fs::read_to_string(path.join("package.json")) {
        Ok(value) => value,
        Err(_) => return false,
    };
    let payload = match serde_json::from_str::<Value>(raw.trim()) {
        Ok(value) => value,
        Err(_) => return false,
    };
    for section in [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
    ] {
        if payload
            .get(section)
            .and_then(Value::as_object)
            .is_some_and(|entries| entries.contains_key(LOCAL_PLAYWRIGHT_MCP_PACKAGE_ID))
        {
            return true;
        }
    }
    payload
        .get("scripts")
        .and_then(Value::as_object)
        .is_some_and(|scripts| {
            scripts.values().filter_map(Value::as_str).any(|script| {
                script.contains(LOCAL_PLAYWRIGHT_MCP_COMMAND)
                    || script.contains(LOCAL_PLAYWRIGHT_MCP_PACKAGE_ID)
            })
        })
}

pub(super) fn resolve_local_codex_playwright_runtime_availability(
    workspace_path: Option<&str>,
) -> LocalCodexPlaywrightRuntimeAvailability {
    let package_root = find_workspace_package_root(workspace_path);
    let available = package_root
        .as_ref()
        .is_some_and(|path| package_json_exposes_playwright_mcp(path))
        && command_exists_on_path("node")
        && command_exists_on_path("pnpm");
    LocalCodexPlaywrightRuntimeAvailability {
        package_root,
        available,
    }
}

pub(super) fn resolve_local_codex_browser_debug_config_overrides(
    workspace_path: Option<&str>,
) -> Vec<String> {
    let payload = load_local_codex_config_table();
    let playwright_configured_and_enabled = payload.as_ref().is_some_and(|table| {
        configured_local_codex_mcp_server_enabled(table, LOCAL_CODEX_PLAYWRIGHT_SERVER_ID)
    }) && payload.as_ref().is_some_and(|table| {
        parse_configured_local_codex_mcp_server_ids_from_table(table)
            .iter()
            .any(|server_id| server_id == LOCAL_CODEX_PLAYWRIGHT_SERVER_ID)
    });
    let playwright_runtime = resolve_local_codex_playwright_runtime_availability(workspace_path);
    let should_enable_js_repl = playwright_configured_and_enabled || playwright_runtime.available;
    let should_inject_workspace_playwright =
        !playwright_configured_and_enabled && playwright_runtime.available;

    let mut args = Vec::new();
    if should_enable_js_repl {
        args.push("-c".to_string());
        args.push(format!("features.{LOCAL_CODEX_JS_REPL_FEATURE_ID}=true"));
    }
    if should_inject_workspace_playwright {
        args.push("-c".to_string());
        args.push(format!(
            "mcp_servers.{LOCAL_CODEX_PLAYWRIGHT_SERVER_ID}.command=\"pnpm\""
        ));
        args.push("-c".to_string());
        args.push(format!(
            "mcp_servers.{LOCAL_CODEX_PLAYWRIGHT_SERVER_ID}.args=[\"exec\",\"{LOCAL_PLAYWRIGHT_MCP_COMMAND}\"]"
        ));
        args.push("-c".to_string());
        args.push(format!(
            "mcp_servers.{LOCAL_CODEX_PLAYWRIGHT_SERVER_ID}.enabled=true"
        ));
    }
    args
}

pub(super) fn list_local_codex_mcp_server_status(
    workspace_path: Option<&str>,
) -> Vec<LocalCodexMcpServerStatus> {
    let payload = load_local_codex_config_table();
    let configured_server_ids = payload
        .as_ref()
        .map(parse_configured_local_codex_mcp_server_ids_from_table)
        .unwrap_or_default();
    let playwright_runtime = resolve_local_codex_playwright_runtime_availability(workspace_path);
    let mut statuses = BTreeMap::<String, LocalCodexMcpServerStatus>::new();

    for server_id in configured_server_ids {
        let enabled = payload.as_ref().is_none_or(|table| {
            configured_local_codex_mcp_server_enabled(table, server_id.as_str())
        });
        if server_id == LOCAL_CODEX_PLAYWRIGHT_SERVER_ID {
            let status = if !enabled {
                "disabled"
            } else if playwright_runtime.available {
                "ready"
            } else {
                "configured"
            };
            statuses.insert(
                server_id.clone(),
                LocalCodexMcpServerStatus {
                    id: server_id.clone(),
                    name: server_id,
                    status: status.to_string(),
                    tools: Some(json!({
                        "source": "user-config",
                        "transport": "mcp-stdio",
                        "runtimePreserved": true,
                        "jsReplEnabled": enabled,
                    })),
                    warnings: if enabled && !playwright_runtime.available {
                        vec![
                            "Runtime preserves the configured Playwright MCP server, but live workspace-scoped verification is unavailable.".to_string(),
                        ]
                    } else {
                        Vec::new()
                    },
                },
            );
            continue;
        }
        statuses.insert(
            server_id.clone(),
            LocalCodexMcpServerStatus {
                id: server_id.clone(),
                name: server_id,
                status: if enabled {
                    "disabled_by_runtime".to_string()
                } else {
                    "disabled".to_string()
                },
                tools: Some(json!({
                    "source": "user-config",
                    "runtimePreserved": false,
                })),
                warnings: if enabled {
                    vec![
                        "Runtime local Codex execution disables this configured MCP server."
                            .to_string(),
                    ]
                } else {
                    Vec::new()
                },
            },
        );
    }

    if !statuses.contains_key(LOCAL_CODEX_PLAYWRIGHT_SERVER_ID) && playwright_runtime.available {
        statuses.insert(
            LOCAL_CODEX_PLAYWRIGHT_SERVER_ID.to_string(),
            LocalCodexMcpServerStatus {
                id: LOCAL_CODEX_PLAYWRIGHT_SERVER_ID.to_string(),
                name: LOCAL_CODEX_PLAYWRIGHT_SERVER_ID.to_string(),
                status: "ready".to_string(),
                tools: Some(json!({
                    "source": "workspace-runtime-injected",
                    "transport": "mcp-stdio",
                    "command": "pnpm",
                    "args": ["exec", LOCAL_PLAYWRIGHT_MCP_COMMAND],
                    "jsReplEnabled": true,
                    "workspaceRoot": playwright_runtime
                        .package_root
                        .as_ref()
                        .map(|path| path.to_string_lossy().to_string()),
                })),
                warnings: Vec::new(),
            },
        );
    }

    statuses.into_values().collect()
}

fn build_local_codex_disabled_feature_config_args(payload: &toml::Table) -> Vec<String> {
    let mut args = Vec::new();
    for feature_id in LOCAL_CODEX_ALWAYS_DISABLED_FEATURE_IDS {
        args.push("-c".to_string());
        args.push(format!("features.{feature_id}=false"));
    }

    let Some(features) = payload.get("features").and_then(toml::Value::as_table) else {
        return args;
    };

    for feature_id in LOCAL_CODEX_DISABLED_IF_ENABLED_FEATURE_IDS {
        if !features
            .get(*feature_id)
            .and_then(toml::Value::as_bool)
            .is_some_and(|enabled| enabled)
        {
            continue;
        }
        args.push("-c".to_string());
        args.push(format!("features.{feature_id}=false"));
    }
    args
}

pub(super) fn resolve_local_codex_exec_config_overrides() -> Vec<String> {
    let Some(payload) = load_local_codex_config_table() else {
        return Vec::new();
    };
    let mut args = build_local_codex_mcp_disabled_config_args(
        parse_configured_local_codex_mcp_server_ids_from_table(&payload).as_slice(),
    );
    args.extend(build_local_codex_disabled_feature_config_args(&payload));
    args
}

pub(super) fn resolve_local_codex_sessions_root() -> Option<PathBuf> {
    read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH_ENV)
        .or_else(|| resolve_local_codex_home_dir().map(|home| home.join("sessions")))
}

#[cfg(test)]
mod tests {
    use super::{
        build_local_codex_disabled_feature_config_args, build_local_codex_mcp_disabled_config_args,
        list_local_codex_mcp_server_status, parse_configured_local_codex_mcp_server_ids_from_table,
        path_from_env_value, resolve_local_codex_auth_path,
        resolve_local_codex_browser_debug_config_overrides, resolve_local_codex_config_path,
        resolve_local_codex_exec_config_overrides, resolve_local_codex_home_dir,
        resolve_local_codex_home_dir_from_paths,
        resolve_local_codex_playwright_runtime_availability, resolve_local_codex_sessions_root,
    };
    use std::ffi::OsString;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn local_codex_paths_env_lock() -> &'static std::sync::Mutex<()> {
        crate::commands::policy::rpc_policy_env_lock()
    }

    #[test]
    fn path_from_env_value_rejects_empty_values() {
        assert_eq!(path_from_env_value(None), None);
        assert_eq!(path_from_env_value(Some(OsString::from(""))), None);
        assert_eq!(path_from_env_value(Some(OsString::from("   "))), None);
    }

    #[test]
    fn resolve_local_codex_home_dir_prefers_runtime_override() {
        let resolved = resolve_local_codex_home_dir_from_paths(
            Some(PathBuf::from("/tmp/runtime-codex")),
            Some(PathBuf::from("/tmp/codex-home")),
            Some(PathBuf::from("/Users/example")),
            Some(PathBuf::from("C:/Users/example")),
        );
        assert_eq!(resolved, Some(PathBuf::from("/tmp/runtime-codex")));
    }

    #[test]
    fn resolve_local_codex_home_dir_falls_back_to_codex_home_then_home() {
        assert_eq!(
            resolve_local_codex_home_dir_from_paths(
                None,
                Some(PathBuf::from("/tmp/codex-home")),
                Some(PathBuf::from("/Users/example")),
                None,
            ),
            Some(PathBuf::from("/tmp/codex-home"))
        );
        assert_eq!(
            resolve_local_codex_home_dir_from_paths(
                None,
                None,
                Some(PathBuf::from("/Users/example")),
                None,
            ),
            Some(PathBuf::from("/Users/example/.codex"))
        );
    }

    #[test]
    fn shared_paths_append_expected_files_under_resolved_home() {
        assert_eq!(
            resolve_local_codex_home_dir_from_paths(
                Some(PathBuf::from("/tmp/runtime-codex")),
                None,
                None,
                None,
            )
            .map(|path| path.join("auth.json")),
            Some(PathBuf::from("/tmp/runtime-codex/auth.json"))
        );
        assert_eq!(
            resolve_local_codex_home_dir_from_paths(
                Some(PathBuf::from("/tmp/runtime-codex")),
                None,
                None,
                None,
            )
            .map(|path| path.join("config.toml")),
            Some(PathBuf::from("/tmp/runtime-codex/config.toml"))
        );
        assert_eq!(
            resolve_local_codex_home_dir_from_paths(
                Some(PathBuf::from("/tmp/runtime-codex")),
                None,
                None,
                None,
            )
            .map(|path| path.join("sessions")),
            Some(PathBuf::from("/tmp/runtime-codex/sessions"))
        );
    }

    #[test]
    fn exported_resolvers_return_none_without_any_home_signals() {
        let _guard = local_codex_paths_env_lock()
            .lock()
            .expect("local codex paths env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_runtime_auth = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH");
        let previous_runtime_sessions = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let previous_home = std::env::var_os("HOME");
        let previous_userprofile = std::env::var_os("USERPROFILE");

        unsafe {
            std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME");
            std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH");
            std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH");
            std::env::remove_var("CODEX_HOME");
            std::env::remove_var("HOME");
            std::env::remove_var("USERPROFILE");
        }

        assert_eq!(resolve_local_codex_home_dir(), None);
        assert_eq!(resolve_local_codex_auth_path(), None);
        assert_eq!(resolve_local_codex_config_path(), None);
        assert_eq!(resolve_local_codex_sessions_root(), None);

        unsafe {
            match previous_runtime_home {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
            }
            match previous_runtime_auth {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH"),
            }
            match previous_runtime_sessions {
                Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH", value),
                None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH"),
            }
            match previous_codex_home {
                Some(value) => std::env::set_var("CODEX_HOME", value),
                None => std::env::remove_var("CODEX_HOME"),
            }
            match previous_home {
                Some(value) => std::env::set_var("HOME", value),
                None => std::env::remove_var("HOME"),
            }
            match previous_userprofile {
                Some(value) => std::env::set_var("USERPROFILE", value),
                None => std::env::remove_var("USERPROFILE"),
            }
        }
    }

    #[test]
    fn parse_configured_local_codex_mcp_server_ids_from_table_collects_sorted_ids() {
        let payload = toml::from_str::<toml::Table>(
            r#"
            [mcp_servers.playwright]
            command = "npx"

            [mcp_servers.figma]
            url = "https://example.com/mcp"
        "#,
        )
        .expect("parse mcp config");

        assert_eq!(
            parse_configured_local_codex_mcp_server_ids_from_table(&payload),
            vec!["figma".to_string(), "playwright".to_string()]
        );
    }

    #[test]
    fn build_local_codex_mcp_disabled_config_args_formats_safe_server_ids() {
        let args = build_local_codex_mcp_disabled_config_args(&[
            "figma".to_string(),
            "playwright".to_string(),
            "openaiDeveloperDocs".to_string(),
            "bad id".to_string(),
        ]);

        assert_eq!(
            args,
            vec![
                "-c".to_string(),
                "mcp_servers.figma.enabled=false".to_string(),
                "-c".to_string(),
                "mcp_servers.openaiDeveloperDocs.enabled=false".to_string(),
            ]
        );
    }

    #[test]
    fn resolve_local_codex_playwright_runtime_availability_detects_workspace_dependency() {
        let temp_dir = std::env::temp_dir().join(format!(
            "tauri-runtime-playwright-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(temp_dir.as_path()).expect("create temp dir");
        std::fs::write(
            temp_dir.join("package.json"),
            r#"{
  "name": "playwright-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
        )
        .expect("write package json");

        let availability = resolve_local_codex_playwright_runtime_availability(Some(
            temp_dir.to_string_lossy().as_ref(),
        ));

        assert_eq!(availability.package_root, Some(temp_dir.clone()));
        assert!(availability.available);
        let _ = std::fs::remove_dir_all(temp_dir.as_path());
    }

    #[test]
    fn resolve_local_codex_browser_debug_config_overrides_injects_workspace_playwright() {
        let _guard = local_codex_paths_env_lock()
            .lock()
            .expect("local codex paths env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp_dir = std::env::temp_dir().join(format!(
            "tauri-browser-debug-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(temp_dir.as_path()).expect("create temp dir");
        std::fs::write(
            temp_dir.join("package.json"),
            r#"{
  "name": "playwright-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
        )
        .expect("write package json");

        std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.as_os_str());
        std::env::remove_var("CODEX_HOME");

        let overrides = resolve_local_codex_browser_debug_config_overrides(Some(
            temp_dir.to_string_lossy().as_ref(),
        ));

        assert_eq!(
            overrides,
            vec![
                "-c".to_string(),
                "features.js_repl=true".to_string(),
                "-c".to_string(),
                "mcp_servers.playwright.command=\"pnpm\"".to_string(),
                "-c".to_string(),
                "mcp_servers.playwright.args=[\"exec\",\"playwright-mcp\"]".to_string(),
                "-c".to_string(),
                "mcp_servers.playwright.enabled=true".to_string(),
            ]
        );
        match previous_runtime_home {
            Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
            None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
        }
        match previous_codex_home {
            Some(value) => std::env::set_var("CODEX_HOME", value),
            None => std::env::remove_var("CODEX_HOME"),
        }
        let _ = std::fs::remove_dir_all(temp_dir.as_path());
    }

    #[test]
    fn list_local_codex_mcp_server_status_marks_playwright_ready_when_workspace_can_inject() {
        let _guard = local_codex_paths_env_lock()
            .lock()
            .expect("local codex paths env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp_dir = std::env::temp_dir().join(format!(
            "tauri-playwright-status-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(temp_dir.as_path()).expect("create temp dir");
        std::fs::write(
            temp_dir.join("package.json"),
            r#"{
  "name": "playwright-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
        )
        .expect("write package json");
        std::fs::write(
            temp_dir.join("config.toml"),
            r#"
                [mcp_servers.figma]
                command = "npx"
            "#,
        )
        .expect("write config");

        std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.as_os_str());
        std::env::remove_var("CODEX_HOME");

        let statuses =
            list_local_codex_mcp_server_status(Some(temp_dir.to_string_lossy().as_ref()));

        assert!(statuses.iter().any(|status| {
            status.id == "figma"
                && status.status == "disabled_by_runtime"
                && status
                    .warnings
                    .iter()
                    .any(|warning| warning.contains("disables this configured MCP server"))
        }));
        assert!(statuses.iter().any(|status| {
            status.id == "playwright"
                && status.status == "ready"
                && status
                    .tools
                    .as_ref()
                    .is_some_and(|tools| tools.to_string().contains("workspace-runtime-injected"))
        }));

        match previous_runtime_home {
            Some(value) => std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", value),
            None => std::env::remove_var("CODE_RUNTIME_LOCAL_CODEX_HOME"),
        }
        match previous_codex_home {
            Some(value) => std::env::set_var("CODEX_HOME", value),
            None => std::env::remove_var("CODEX_HOME"),
        }
        let _ = std::fs::remove_dir_all(temp_dir.as_path());
    }

    #[test]
    fn build_local_codex_disabled_feature_config_args_disables_known_unstable_features() {
        let payload = toml::from_str::<toml::Table>(
            r#"
                [features]
                responses_websockets = true
                responses_websockets_v2 = true
                multi_agent = true
            "#,
        )
        .expect("parse features config");

        assert_eq!(
            build_local_codex_disabled_feature_config_args(&payload),
            vec![
                "-c".to_string(),
                "features.shell_snapshot=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets_v2=false".to_string(),
            ]
        );
    }

    #[test]
    fn resolve_local_codex_exec_config_overrides_reads_runtime_config() {
        let _guard = local_codex_paths_env_lock()
            .lock()
            .expect("local codex paths env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_nanos();
        let temp_dir =
            std::env::temp_dir().join(format!("tauri-runtime-codex-config-test-{unique}"));
        std::fs::create_dir_all(temp_dir.as_path()).expect("create temp config dir");
        let config_path = temp_dir.join("config.toml");
        std::fs::write(
            config_path.as_path(),
            r#"
                [mcp_servers.linear]
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
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.as_os_str());
            std::env::remove_var("CODEX_HOME");
        }

        assert_eq!(
            resolve_local_codex_exec_config_overrides(),
            vec![
                "-c".to_string(),
                "mcp_servers.linear.enabled=false".to_string(),
                "-c".to_string(),
                "features.shell_snapshot=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets=false".to_string(),
                "-c".to_string(),
                "features.responses_websockets_v2=false".to_string(),
            ]
        );

        let _ = std::fs::remove_file(config_path.as_path());
        let _ = std::fs::remove_dir_all(temp_dir.as_path());

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
