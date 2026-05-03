use super::*;
use crate::rpc_params::snake_to_camel;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::ffi::OsString;
use std::io::Read;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

const MAX_ROLLOUT_FIRST_LINE_BYTES: usize = 1_048_576;
const CODE_RUNTIME_LOCAL_CODEX_HOME_ENV: &str = "CODE_RUNTIME_LOCAL_CODEX_HOME";
const CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH_ENV: &str = "CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH";
const CODE_RUNTIME_LOCAL_CODEX_CONFIG_PATH_ENV: &str = "CODE_RUNTIME_LOCAL_CODEX_CONFIG_PATH";
const CODE_RUNTIME_LOCAL_CODEX_MODELS_CACHE_PATH_ENV: &str =
    "CODE_RUNTIME_LOCAL_CODEX_MODELS_CACHE_PATH";
const CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH_ENV: &str = "CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH";
const CODE_RUNTIME_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS_ENV: &str =
    "CODE_RUNTIME_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS";
const DEFAULT_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS: u64 = 1_500;
const MIN_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS: u64 = 100;
const MAX_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS: u64 = 30_000;
const LOCAL_CODEX_ALWAYS_DISABLED_FEATURE_IDS: &[&str] = &["shell_snapshot"];
const LOCAL_CODEX_DISABLED_IF_ENABLED_FEATURE_IDS: &[&str] =
    &["responses_websockets", "responses_websockets_v2"];
const LOCAL_CODEX_RUNTIME_PRESERVED_MCP_SERVER_IDS: &[&str] = &["playwright"];
const LOCAL_CODEX_PLAYWRIGHT_SERVER_ID: &str = "playwright";
const LOCAL_CODEX_JS_REPL_FEATURE_ID: &str = "js_repl";
const LOCAL_PLAYWRIGHT_MCP_PACKAGE_ID: &str = "@playwright/mcp";
const LOCAL_PLAYWRIGHT_MCP_COMMAND: &str = "playwright-mcp";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LocalCodexPlaywrightRuntimeAvailability {
    pub(crate) package_root: Option<PathBuf>,
    pub(crate) available: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct LocalCodexMcpServerStatus {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) status: String,
    pub(crate) tools: Option<Value>,
    pub(crate) warnings: Vec<String>,
}

#[path = "local_codex_cli_sessions_auth.rs"]
mod auth;
#[path = "local_codex_cli_sessions_rollout.rs"]
mod rollout;

pub(super) fn load_local_codex_cli_auth_profile() -> Option<LocalCodexCliAuthProfile> {
    auth::load_local_codex_cli_auth_profile()
}

#[cfg(test)]
pub(super) fn load_local_codex_cli_auth_profile_from_path(
    path: &Path,
    cache: &Mutex<LocalCodexCliAuthProfileCache>,
) -> Option<LocalCodexCliAuthProfile> {
    auth::load_local_codex_cli_auth_profile_from_path(path, cache)
}

pub(super) fn parse_local_codex_cli_auth_profile_from_value(
    payload: &Value,
) -> Option<LocalCodexCliAuthProfile> {
    auth::parse_local_codex_cli_auth_profile_from_value(payload)
}

pub(super) fn persist_local_codex_cli_auth_updates(
    id_token: Option<&str>,
    access_token: Option<&str>,
    refresh_token: Option<&str>,
    openai_api_key: Option<&str>,
    account_id: Option<&str>,
    auth_mode: Option<&str>,
) -> Result<(), String> {
    auth::persist_local_codex_cli_auth_updates(
        id_token,
        access_token,
        refresh_token,
        openai_api_key,
        account_id,
        auth_mode,
    )
}

pub(super) fn list_local_cli_sessions(limit: usize) -> Vec<CliSessionSummary> {
    rollout::list_local_cli_sessions(limit, resolve_local_cli_sessions_scan_budget_ms())
}

pub(super) fn load_local_codex_cached_model_slugs() -> Vec<String> {
    let Some(path) = resolve_local_codex_models_cache_path() else {
        return Vec::new();
    };
    load_local_codex_cached_model_slugs_from_path(path.as_path())
}

fn parse_optional_non_empty_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(ToOwned::to_owned)
}

fn parse_local_codex_cached_model_slugs_from_value(payload: &Value) -> Vec<String> {
    let Some(models) = payload.get("models").and_then(Value::as_array) else {
        return Vec::new();
    };

    let mut seen = HashSet::new();
    let mut slugs = Vec::new();
    for model in models {
        let Some(object) = model.as_object() else {
            continue;
        };
        if object
            .get("visibility")
            .and_then(Value::as_str)
            .is_some_and(|value| value.trim() != "list")
        {
            continue;
        }
        if object
            .get("supported_in_api")
            .and_then(Value::as_bool)
            .is_some_and(|value| !value)
        {
            continue;
        }
        let Some(slug) = parse_optional_non_empty_string(object.get("slug").or(object.get("id")))
        else {
            continue;
        };
        if seen.insert(slug.clone()) {
            slugs.push(slug);
        }
    }
    slugs
}

fn load_local_codex_cached_model_slugs_from_path(path: &Path) -> Vec<String> {
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let Ok(payload) = serde_json::from_str::<Value>(trimmed) else {
        return Vec::new();
    };
    parse_local_codex_cached_model_slugs_from_value(&payload)
}

fn system_time_to_epoch_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn read_non_empty_env_path(name: &str) -> Option<PathBuf> {
    let value = std::env::var_os(name)?;
    path_from_env_value(Some(value))
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

fn resolve_local_cli_sessions_scan_budget_ms() -> u64 {
    let configured = std::env::var(CODE_RUNTIME_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or(DEFAULT_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS);
    configured.clamp(
        MIN_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS,
        MAX_LOCAL_CODEX_SESSIONS_SCAN_BUDGET_MS,
    )
}

pub(super) fn resolve_local_codex_home_dir() -> Option<PathBuf> {
    read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_HOME_ENV)
        .or_else(|| read_non_empty_env_path("CODEX_HOME"))
        .or_else(|| read_non_empty_env_path("HOME").map(|home| home.join(".codex")))
        .or_else(|| read_non_empty_env_path("USERPROFILE").map(|home| home.join(".codex")))
}

fn resolve_local_codex_config_path_from_home(home: Option<PathBuf>) -> Option<PathBuf> {
    home.map(|entry| entry.join("config.toml"))
}

pub(super) fn resolve_local_codex_auth_path() -> Option<PathBuf> {
    read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH_ENV)
        .or_else(|| resolve_local_codex_home_dir().map(|home| home.join("auth.json")))
}

pub(super) fn resolve_local_codex_config_path() -> Option<PathBuf> {
    read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_CONFIG_PATH_ENV)
        .or_else(|| resolve_local_codex_config_path_from_home(resolve_local_codex_home_dir()))
}

fn load_local_codex_config_table() -> Option<toml::Table> {
    let path = resolve_local_codex_config_path()?;
    let raw = fs::read_to_string(path).ok()?;
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

fn command_exists_on_path(command: &str) -> bool {
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
    let raw = match fs::read_to_string(path.join("package.json")) {
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

pub(crate) fn resolve_local_codex_playwright_runtime_availability(
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

pub(crate) fn resolve_local_codex_browser_debug_config_overrides(
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

pub(crate) fn list_local_codex_mcp_server_status(
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

fn resolve_local_codex_models_cache_path() -> Option<PathBuf> {
    read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_MODELS_CACHE_PATH_ENV)
        .or_else(|| resolve_local_codex_home_dir().map(|home| home.join("models_cache.json")))
}

pub(super) fn resolve_local_codex_sessions_root() -> Option<PathBuf> {
    read_non_empty_env_path(CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH_ENV)
        .or_else(|| resolve_local_codex_home_dir().map(|home| home.join("sessions")))
}

#[cfg(test)]
mod tests {
    use super::{
        build_local_codex_disabled_feature_config_args, build_local_codex_mcp_disabled_config_args,
        list_local_codex_mcp_server_status, load_local_codex_cached_model_slugs_from_path,
        parse_configured_local_codex_mcp_server_ids_from_table,
        parse_local_codex_cached_model_slugs_from_value, path_from_env_value,
        resolve_local_codex_browser_debug_config_overrides,
        resolve_local_codex_config_path_from_home, resolve_local_codex_exec_config_overrides,
        resolve_local_codex_playwright_runtime_availability,
    };
    use crate::local_codex_exec_path::local_codex_exec_env_lock;
    use serde_json::json;
    use std::{env, ffi::OsString, fs, path::PathBuf};
    use uuid::Uuid;

    struct TempDir {
        path: PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let path = env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
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
    fn path_from_env_value_returns_none_for_empty_values() {
        assert_eq!(path_from_env_value(None), None);
        assert_eq!(path_from_env_value(Some(OsString::from(""))), None);
        assert_eq!(path_from_env_value(Some(OsString::from("   "))), None);
    }

    #[test]
    fn path_from_env_value_preserves_non_empty_path() {
        assert_eq!(
            path_from_env_value(Some(OsString::from("/tmp/custom-codex"))),
            Some(PathBuf::from("/tmp/custom-codex"))
        );
    }

    #[test]
    fn resolve_local_codex_config_path_appends_config_toml() {
        let home = PathBuf::from("/tmp/codex-home");

        assert_eq!(
            resolve_local_codex_config_path_from_home(Some(home.clone())),
            Some(home.join("config.toml"))
        );
        assert_eq!(resolve_local_codex_config_path_from_home(None), None);
    }

    #[test]
    fn parse_local_codex_cached_model_slugs_filters_visible_supported_models() {
        let payload = json!({
            "models": [
                {
                    "slug": "gpt-5.3-codex",
                    "visibility": "list",
                    "supported_in_api": true
                },
                {
                    "slug": "gpt-5.4",
                    "visibility": "list",
                    "supported_in_api": true
                },
                {
                    "slug": "gpt-5.4",
                    "visibility": "list",
                    "supported_in_api": true
                },
                {
                    "slug": "internal-preview",
                    "visibility": "hidden",
                    "supported_in_api": true
                },
                {
                    "slug": "web-only",
                    "visibility": "list",
                    "supported_in_api": false
                }
            ]
        });

        assert_eq!(
            parse_local_codex_cached_model_slugs_from_value(&payload),
            vec!["gpt-5.3-codex".to_string(), "gpt-5.4".to_string()]
        );
    }

    #[test]
    fn load_local_codex_cached_model_slugs_reads_models_cache_file() {
        let temp = TempDir::new("codex-model-cache");
        let path = temp.path.join("models_cache.json");
        fs::write(
            path.as_path(),
            r#"{
  "models": [
    { "slug": "gpt-5.3-codex", "visibility": "list", "supported_in_api": true },
    { "slug": "gpt-5.2-codex", "visibility": "list", "supported_in_api": true },
    { "slug": "hidden-model", "visibility": "hidden", "supported_in_api": true }
  ]
}"#,
        )
        .expect("write models cache");

        assert_eq!(
            load_local_codex_cached_model_slugs_from_path(path.as_path()),
            vec!["gpt-5.3-codex".to_string(), "gpt-5.2-codex".to_string()]
        );
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
        .expect("parse mcp server config");

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
        let temp = TempDir::new("runtime-playwright-availability");
        fs::write(
            temp.path.join("package.json"),
            r#"{
  "name": "playwright-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
        )
        .expect("write package json");

        let availability = resolve_local_codex_playwright_runtime_availability(Some(
            temp.path.to_string_lossy().as_ref(),
        ));

        assert_eq!(availability.package_root, Some(temp.path.clone()));
        assert!(availability.available);
    }

    #[test]
    fn resolve_local_codex_browser_debug_config_overrides_injects_workspace_playwright() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex config env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp = TempDir::new("runtime-browser-debug-overrides");
        fs::write(
            temp.path.join("package.json"),
            r#"{
  "name": "playwright-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
        )
        .expect("write package json");

        unsafe {
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp.path.as_os_str());
            std::env::remove_var("CODEX_HOME");
        }

        let overrides = resolve_local_codex_browser_debug_config_overrides(Some(
            temp.path.to_string_lossy().as_ref(),
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
    fn list_local_codex_mcp_server_status_marks_playwright_ready_when_workspace_can_inject() {
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex config env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp = TempDir::new("runtime-playwright-status");
        fs::write(
            temp.path.join("package.json"),
            r#"{
  "name": "playwright-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
        )
        .expect("write package json");
        fs::write(
            temp.path.join("config.toml"),
            r#"
                [mcp_servers.figma]
                command = "npx"
            "#,
        )
        .expect("write config");

        unsafe {
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp.path.as_os_str());
            std::env::remove_var("CODEX_HOME");
        }

        let statuses =
            list_local_codex_mcp_server_status(Some(temp.path.to_string_lossy().as_ref()));

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
        let _guard = local_codex_exec_env_lock()
            .lock()
            .expect("local codex config env lock poisoned");
        let previous_runtime_home = std::env::var_os("CODE_RUNTIME_LOCAL_CODEX_HOME");
        let previous_codex_home = std::env::var_os("CODEX_HOME");
        let temp_dir = TempDir::new("runtime-codex-config");
        let config_path = temp_dir.path.join("config.toml");
        fs::write(
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
            std::env::set_var("CODE_RUNTIME_LOCAL_CODEX_HOME", temp_dir.path.as_os_str());
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
