use super::{
    browser_debug_env_lock, collect_browser_debug_status, run_browser_debug_operation,
    BrowserDebugRunRequest, BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV,
    BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV, BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV,
    BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV,
};
use serde_json::{json, Map};
use std::fs;
use tempfile::TempDir;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn write_fake_playwright_server_script(temp: &TempDir) -> std::path::PathBuf {
    let script_path = temp.path().join("fake-playwright-mcp.sh");
    let script = r#"#!/bin/sh
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-playwright-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"browser_snapshot","description":"Snapshot","annotations":{"readOnlyHint":true},"inputSchema":{"type":"object"}},{"name":"browser_take_screenshot","description":"Screenshot","inputSchema":{"type":"object"}},{"name":"browser_navigate","description":"Navigate","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"browser_snapshot"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Page snapshot: Example"}],"structuredContent":{"url":"https://example.com","title":"Example"}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"browser_take_screenshot"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"image","mimeType":"image/png","data":"YWJj"}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"browser_navigate"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Navigated"}]}}\n' "$id"
      ;;
  esac
done
"#;
    fs::write(&script_path, script).expect("write fake playwright server script");
    #[cfg(unix)]
    let mut permissions = fs::metadata(&script_path)
        .expect("fake server metadata")
        .permissions();
    #[cfg(unix)]
    permissions.set_mode(0o755);
    #[cfg(unix)]
    fs::set_permissions(&script_path, permissions).expect("set fake server permissions");
    script_path
}

fn write_workspace_manifest(temp: &TempDir) {
    fs::write(
        temp.path().join("package.json"),
        r#"{
  "name": "browser-debug-test",
  "devDependencies": {
    "@playwright/mcp": "^0.0.68"
  }
}"#,
    )
    .expect("write package.json");
}

fn write_fake_chrome_devtools_server_script(temp: &TempDir) -> std::path::PathBuf {
    let script_path = temp.path().join("fake-chrome-devtools-mcp.sh");
    let script = r#"#!/bin/sh
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-chrome-devtools-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"list_pages","description":"List pages","inputSchema":{"type":"object"}},{"name":"select_page","description":"Select page","inputSchema":{"type":"object"}},{"name":"evaluate_script","description":"Eval","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
  esac
done
"#;
    fs::write(&script_path, script).expect("write fake chrome devtools server script");
    #[cfg(unix)]
    let mut permissions = fs::metadata(&script_path)
        .expect("fake chrome devtools metadata")
        .permissions();
    #[cfg(unix)]
    permissions.set_mode(0o755);
    #[cfg(unix)]
    fs::set_permissions(&script_path, permissions)
        .expect("set fake chrome devtools permissions");
    script_path
}

fn write_fake_banner_chrome_devtools_server_script(temp: &TempDir) -> std::path::PathBuf {
    let script_path = temp.path().join("fake-banner-chrome-devtools-mcp.sh");
    let script = r#"#!/bin/sh
printf '%s\n' 'chrome-devtools-mcp banner line 1'
printf '%s\n' 'chrome-devtools-mcp banner line 2'
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-chrome-devtools-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"list_pages","description":"List pages","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
  esac
done
"#;
    fs::write(&script_path, script).expect("write fake banner chrome devtools server script");
    #[cfg(unix)]
    let mut permissions = fs::metadata(&script_path)
        .expect("fake banner chrome devtools metadata")
        .permissions();
    #[cfg(unix)]
    permissions.set_mode(0o755);
    #[cfg(unix)]
    fs::set_permissions(&script_path, permissions)
        .expect("set fake banner chrome devtools permissions");
    script_path
}

fn write_fake_lingering_chrome_devtools_server_script(temp: &TempDir) -> std::path::PathBuf {
    let script_path = temp.path().join("fake-lingering-chrome-devtools-mcp.sh");
    let script = r#"#!/bin/sh
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-chrome-devtools-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"list_pages","description":"List pages","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
  esac
done
sleep 10
"#;
    fs::write(&script_path, script).expect("write fake lingering chrome devtools server script");
    #[cfg(unix)]
    let mut permissions = fs::metadata(&script_path)
        .expect("fake lingering chrome devtools metadata")
        .permissions();
    #[cfg(unix)]
    permissions.set_mode(0o755);
    #[cfg(unix)]
    fs::set_permissions(&script_path, permissions)
        .expect("set fake lingering chrome devtools permissions");
    script_path
}

fn write_fake_chrome_devtools_inspect_server_script(temp: &TempDir) -> std::path::PathBuf {
    let script_path = temp.path().join("fake-inspect-chrome-devtools-mcp.sh");
    let args_log_path = temp.path().join("fake-chrome-devtools-args.txt");
    let script = [
        format!(
            "#!/bin/sh\nprintf '%s\\n' \"$*\" > \"{}\"\n",
            args_log_path.display()
        ),
        r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')
  case "$line" in
    *'"method":"initialize"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"fake-chrome-devtools-mcp","version":"0.0.0"},"protocolVersion":"2025-03-26"}}\n' "$id"
      ;;
    *'"method":"notifications/initialized"'*)
      ;;
    *'"method":"tools/list"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"tools":[{"name":"list_pages","description":"List pages","inputSchema":{"type":"object"}},{"name":"select_page","description":"Select page","inputSchema":{"type":"object"}},{"name":"take_snapshot","description":"Snapshot","inputSchema":{"type":"object"}},{"name":"take_screenshot","description":"Screenshot","inputSchema":{"type":"object"}}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"list_pages"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"1: https://example.com"}],"structuredContent":{"pages":[{"pageId":1,"url":"https://example.com"}]}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"select_page"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"selected"}]}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"take_snapshot"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"text","text":"Page snapshot: Example"}],"structuredContent":{"url":"https://example.com","title":"Example"}}}\n' "$id"
      ;;
    *'"method":"tools/call"'*'"name":"take_screenshot"'*)
      printf '{"jsonrpc":"2.0","id":%s,"result":{"content":[{"type":"image","mimeType":"image/png","data":"YWJj"}]}}\n' "$id"
      ;;
  esac
done
"#
        .to_string(),
    ]
    .concat();
    fs::write(&script_path, script).expect("write fake inspect chrome devtools server script");
    #[cfg(unix)]
    let mut permissions = fs::metadata(&script_path)
        .expect("fake inspect chrome devtools metadata")
        .permissions();
    #[cfg(unix)]
    permissions.set_mode(0o755);
    #[cfg(unix)]
    fs::set_permissions(&script_path, permissions)
        .expect("set fake inspect chrome devtools permissions");
    script_path
}

#[tokio::test]
async fn collect_browser_debug_status_lists_playwright_tools_via_override() {
    let _guard = browser_debug_env_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let temp = TempDir::new().expect("create temp dir");
    write_workspace_manifest(&temp);
    let script_path = write_fake_playwright_server_script(&temp);

    std::env::set_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV, script_path.as_os_str());
    std::env::set_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV, "[]");

    let snapshot = collect_browser_debug_status(temp.path(), 5_000, None).await;
    assert!(snapshot.available);
    assert_eq!(snapshot.mode, "mcp-playwright");
    assert_eq!(snapshot.status, "ready");
    assert!(snapshot
        .tools
        .iter()
        .any(|tool| tool.get("name") == Some(&json!("browser_snapshot"))));

    std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
}

#[tokio::test]
async fn collect_browser_debug_status_falls_back_to_chrome_devtools_when_playwright_is_unavailable()
{
    let _guard = browser_debug_env_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let temp = TempDir::new().expect("create temp dir");
    let script_path = write_fake_chrome_devtools_server_script(&temp);

    std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
    std::env::set_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV, script_path.as_os_str());
    std::env::set_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV, "[]");

    let snapshot = collect_browser_debug_status(temp.path(), 5_000, None).await;
    assert!(snapshot.available, "{snapshot:?}");
    assert_eq!(snapshot.mode, "mcp-chrome-devtools");
    assert_eq!(snapshot.status, "ready");
    assert_eq!(snapshot.server_name.as_deref(), Some("chrome-devtools"));
    assert!(snapshot
        .tools
        .iter()
        .any(|tool| tool.get("name") == Some(&json!("list_pages"))));

    std::env::remove_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV);
}

#[tokio::test]
async fn collect_browser_debug_status_ignores_non_json_banner_lines_from_chrome_devtools() {
    let _guard = browser_debug_env_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let temp = TempDir::new().expect("create temp dir");
    let script_path = write_fake_banner_chrome_devtools_server_script(&temp);

    std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
    std::env::set_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV, script_path.as_os_str());
    std::env::set_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV, "[]");

    let snapshot = collect_browser_debug_status(temp.path(), 5_000, None).await;
    assert!(snapshot.available, "{snapshot:?}");
    assert_eq!(snapshot.mode, "mcp-chrome-devtools");
    assert_eq!(snapshot.status, "ready");
    assert!(snapshot
        .tools
        .iter()
        .any(|tool| tool.get("name") == Some(&json!("list_pages"))));

    std::env::remove_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV);
}

#[tokio::test]
async fn collect_browser_debug_status_does_not_time_out_while_closing_a_lingering_server() {
    let _guard = browser_debug_env_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let temp = TempDir::new().expect("create temp dir");
    let script_path = write_fake_lingering_chrome_devtools_server_script(&temp);

    std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
    std::env::set_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV, script_path.as_os_str());
    std::env::set_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV, "[]");

    let snapshot = collect_browser_debug_status(temp.path(), 5_000, None).await;
    assert!(snapshot.available, "{snapshot:?}");
    assert_eq!(snapshot.mode, "mcp-chrome-devtools");
    assert_eq!(snapshot.status, "ready");

    std::env::remove_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV);
}

#[tokio::test]
async fn run_browser_debug_operation_executes_multiple_steps_and_collects_artifacts() {
    let _guard = browser_debug_env_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let temp = TempDir::new().expect("create temp dir");
    write_workspace_manifest(&temp);
    let script_path = write_fake_playwright_server_script(&temp);

    std::env::set_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV, script_path.as_os_str());
    std::env::set_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV, "[]");

    let request = BrowserDebugRunRequest {
        workspace_id: "ws-browser".to_string(),
        operation: "automation".to_string(),
        browser_url: None,
        prompt: None,
        include_screenshot: Some(false),
        timeout_ms: Some(5_000),
        steps: Some(vec![
            super::BrowserDebugToolCallRequest {
                tool_name: "browser_navigate".to_string(),
                arguments: Some(Map::from_iter([("url".to_string(), json!("https://example.com"))])),
            },
            super::BrowserDebugToolCallRequest {
                tool_name: "browser_take_screenshot".to_string(),
                arguments: Some(Map::new()),
            },
        ]),
        decision_lab: None,
    };

    let result = run_browser_debug_operation(temp.path(), &request).await;
    assert!(result.available);
    assert_eq!(result.status, "completed");
    assert_eq!(result.mode, "mcp-playwright");
    assert_eq!(result.tool_calls.len(), 2);
    assert_eq!(result.artifacts.len(), 1);
    assert_eq!(result.artifacts[0].get("kind"), Some(&json!("image")));

    std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
}

#[tokio::test]
async fn run_browser_debug_operation_uses_chrome_devtools_for_inspect_when_browser_url_requested() {
    let _guard = browser_debug_env_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let temp = TempDir::new().expect("create temp dir");
    let script_path = write_fake_chrome_devtools_inspect_server_script(&temp);
    let args_log_path = temp.path().join("fake-chrome-devtools-args.txt");
    let _ = fs::remove_file(&args_log_path);

    std::env::remove_var(BROWSER_DEBUG_MCP_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_MCP_ARGS_OVERRIDE_ENV);
    std::env::set_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV, script_path.as_os_str());
    std::env::set_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV, "[]");

    let request = BrowserDebugRunRequest {
        workspace_id: "ws-browser".to_string(),
        operation: "inspect".to_string(),
        browser_url: Some("http://127.0.0.1:9333".to_string()),
        prompt: Some("Inspect the current page".to_string()),
        include_screenshot: Some(true),
        timeout_ms: Some(5_000),
        steps: None,
        decision_lab: None,
    };

    let result = run_browser_debug_operation(temp.path(), &request).await;
    assert!(result.available, "{result:?}");
    assert_eq!(result.status, "completed");
    assert_eq!(result.mode, "mcp-chrome-devtools");
    assert_eq!(result.browser_url.as_deref(), Some("http://127.0.0.1:9333"));
    assert!(result
        .tool_calls
        .iter()
        .any(|entry| entry.get("toolName") == Some(&json!("take_snapshot"))));
    assert_eq!(result.artifacts.len(), 1);

    let args_log = fs::read_to_string(&args_log_path).expect("read args log");
    assert!(args_log.contains("--browserUrl=http://127.0.0.1:9333"));

    std::env::remove_var(BROWSER_DEBUG_CHROME_COMMAND_OVERRIDE_ENV);
    std::env::remove_var(BROWSER_DEBUG_CHROME_ARGS_OVERRIDE_ENV);
    let _ = fs::remove_file(args_log_path);
}
