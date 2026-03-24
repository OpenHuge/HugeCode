    use super::*;
    use crate::{build_app_context, create_initial_state, WorkspaceSummary};
    use std::path::PathBuf;
    use std::sync::{LazyLock, Mutex};
    static COMPUTER_OBSERVE_ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
    static RUNTIME_TOOL_STATE_ENV_LOCK: LazyLock<Mutex<()>> =
        LazyLock::new(|| Mutex::new(()));

    fn mock_network_result(query: &str) -> LiveSkillNetworkResult {
        LiveSkillNetworkResult {
            query: query.to_string(),
            provider: "network".to_string(),
            fetched_at: now_ms(),
            items: vec![LiveSkillExecutionResultItem {
                title: "title".to_string(),
                url: "https://example.com".to_string(),
                snippet: "snippet".to_string(),
                content: None,
                domain: Some("example.com".to_string()),
                dedupe_key: Some("example.com".to_string()),
                fetched_at: Some(now_ms()),
                published_at: None,
            }],
        }
    }

    #[allow(dead_code)]
    fn test_service_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.3-codex".to_string(),
            openai_api_key: None,
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: "https://api.anthropic.com/v1/messages".to_string(),
            anthropic_version: "2023-06-01".to_string(),
            gemini_api_key: None,
            gemini_endpoint: "https://generativelanguage.googleapis.com/v1beta/models".to_string(),
            openai_timeout_ms: 5_000,
            openai_max_retries: 2,
            openai_retry_base_ms: 1,
            openai_compat_model_cache_ttl_ms: 300_000,
            live_skills_network_enabled: true,
            live_skills_network_base_url: "https://s.jina.ai".to_string(),
            live_skills_network_timeout_ms: 5_000,
            live_skills_network_cache_ttl_ms: 300_000,
            sandbox_enabled: false,
            sandbox_network_access: "none".to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: ":memory:".to_string(),
            oauth_secret_key: None,
            oauth_public_base_url: None,
            oauth_loopback_callback_port: 1455,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: 2,
            agent_task_history_limit: 64,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: 1,
            distributed_worker_concurrency: 1,
            distributed_claim_idle_ms: 30_000,
            discovery_enabled: false,
            discovery_service_type: "_openwrap-code-runtime._tcp.local.".to_string(),
            discovery_browse_interval_ms: 5_000,
            discovery_stale_ttl_ms: 15_000,
            runtime_backend_id: "runtime-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: 256 * 1024,
            ws_max_write_buffer_size_bytes: 16 * 1024 * 1024,
            ws_max_frame_size_bytes: 8 * 1024 * 1024,
            ws_max_message_size_bytes: 8 * 1024 * 1024,
            ws_max_connections: 256,
            provider_extensions: Vec::new(),
        }
    }

    async fn test_live_skill_app_context(
        config: ServiceConfig,
        workspace_id: &str,
        workspace_path: &std::path::Path,
    ) -> AppContext {
        let state = create_initial_state("gpt-5.3-codex");
        {
            let mut guard = state.write().await;
            guard.workspaces = vec![WorkspaceSummary {
                id: workspace_id.to_string(),
                path: workspace_path.display().to_string(),
                display_name: "Test Workspace".to_string(),
                connected: true,
                default_model_id: Some("gpt-5.3-codex".to_string()),
            }];
        }
        let native_state_path =
            unique_test_workspace_dir("live-skill-native-state").join("native-state.sqlite3");
        build_app_context(
            state,
            config,
            Arc::new(crate::native_state_store::NativeStateStore::new(
                native_state_path,
            )),
        )
    }

    fn set_test_runtime_tool_state_paths(test_name: &str) -> (PathBuf, PathBuf) {
        let guardrails_path = unique_test_workspace_dir(&format!("{test_name}-guardrails"))
            .join("runtime-tool-guardrails.json");
        let metrics_path = unique_test_workspace_dir(&format!("{test_name}-metrics"))
            .join("runtime-tool-metrics.json");
        std::env::set_var("CODE_RUNTIME_TOOL_GUARDRAILS_PATH", guardrails_path.as_os_str());
        std::env::set_var("CODE_RUNTIME_TOOL_METRICS_PATH", metrics_path.as_os_str());
        (guardrails_path, metrics_path)
    }

    fn clear_test_runtime_tool_state_paths(
        guardrails_path: PathBuf,
        metrics_path: PathBuf,
    ) {
        std::env::remove_var("CODE_RUNTIME_TOOL_GUARDRAILS_PATH");
        std::env::remove_var("CODE_RUNTIME_TOOL_METRICS_PATH");
        let _ = fs::remove_file(guardrails_path.as_path());
        let _ = fs::remove_file(metrics_path.as_path());
        if let Some(parent) = guardrails_path.parent() {
            let _ = fs::remove_dir_all(parent);
        }
        if let Some(parent) = metrics_path.parent() {
            let _ = fs::remove_dir_all(parent);
        }
    }

    #[test]
    fn prune_live_skill_network_cache_drops_expired_entries() {
        let mut cache = HashMap::from([
            (
                "expired".to_string(),
                CachedLiveSkillNetworkResult {
                    result: mock_network_result("expired"),
                    fetched_at: Instant::now() - Duration::from_secs(10),
                },
            ),
            (
                "fresh".to_string(),
                CachedLiveSkillNetworkResult {
                    result: mock_network_result("fresh"),
                    fetched_at: Instant::now(),
                },
            ),
        ]);

        prune_live_skill_network_cache(
            &mut cache,
            Duration::from_secs(1),
            8,
            MAX_LIVE_SKILL_NETWORK_CACHE_BYTES,
        );

        assert!(!cache.contains_key("expired"));
        assert!(cache.contains_key("fresh"));
    }

    #[test]
    fn prune_live_skill_network_cache_evicts_oldest_when_full() {
        let mut cache = HashMap::from([
            (
                "oldest".to_string(),
                CachedLiveSkillNetworkResult {
                    result: mock_network_result("oldest"),
                    fetched_at: Instant::now() - Duration::from_secs(5),
                },
            ),
            (
                "newer-a".to_string(),
                CachedLiveSkillNetworkResult {
                    result: mock_network_result("newer-a"),
                    fetched_at: Instant::now() - Duration::from_secs(2),
                },
            ),
            (
                "newer-b".to_string(),
                CachedLiveSkillNetworkResult {
                    result: mock_network_result("newer-b"),
                    fetched_at: Instant::now() - Duration::from_secs(1),
                },
            ),
        ]);

        prune_live_skill_network_cache(
            &mut cache,
            Duration::from_secs(30),
            2,
            MAX_LIVE_SKILL_NETWORK_CACHE_BYTES,
        );

        assert!(!cache.contains_key("oldest"));
        assert!(cache.contains_key("newer-a"));
        assert!(cache.contains_key("newer-b"));
        assert_eq!(cache.len(), 2);
    }

    #[test]
    fn prune_live_skill_network_cache_evicts_oldest_until_under_byte_budget() {
        let mut oldest = mock_network_result("oldest");
        oldest.items[0].snippet = "x".repeat(1_024);
        let mut middle = mock_network_result("middle");
        middle.items[0].snippet = "y".repeat(1_024);
        let newest = mock_network_result("newest");

        let mut cache = HashMap::from([
            (
                "oldest".to_string(),
                CachedLiveSkillNetworkResult {
                    result: oldest,
                    fetched_at: Instant::now() - Duration::from_secs(5),
                },
            ),
            (
                "middle".to_string(),
                CachedLiveSkillNetworkResult {
                    result: middle,
                    fetched_at: Instant::now() - Duration::from_secs(3),
                },
            ),
            (
                "newest".to_string(),
                CachedLiveSkillNetworkResult {
                    result: newest,
                    fetched_at: Instant::now() - Duration::from_secs(1),
                },
            ),
        ]);

        prune_live_skill_network_cache(&mut cache, Duration::from_secs(30), 8, 1_500);

        assert!(!cache.contains_key("oldest"));
        assert!(cache.contains_key("newest"));
        assert!(cache.len() <= 2);
        assert!(estimate_live_skill_network_cache_bytes(&cache) <= 1_500);
    }

    #[test]
    fn validate_live_skill_query_rejects_oversized_input() {
        let oversized = "x".repeat(MAX_LIVE_SKILL_QUERY_CHARS + 1);
        let error = validate_live_skill_query(oversized.as_str())
            .expect_err("oversized query should be rejected");
        assert!(error.message.contains("Live skill query must be <="));
    }

    #[test]
    fn build_live_skill_network_cache_key_is_stable_and_query_sensitive() {
        let base_url = "https://s.jina.ai";
        let first = build_live_skill_network_cache_key(base_url, "alpha query", 5, 1200, false, 0);
        let second =
            build_live_skill_network_cache_key(base_url, "alpha query", 5, 1200, false, 0);
        let different_query =
            build_live_skill_network_cache_key(base_url, "beta query", 5, 1200, false, 0);
        assert_eq!(first, second);
        assert_ne!(first, different_query);
    }

    #[test]
    fn claim_live_skill_network_fetch_deduplicates_same_key() {
        let key = "live-skill-fetch-test-key";
        let (leader_waiter, leader) = claim_live_skill_network_fetch(key);
        assert!(leader);

        let (follower_waiter, follower_leader) = claim_live_skill_network_fetch(key);
        assert!(!follower_leader);
        assert!(Arc::ptr_eq(&leader_waiter, &follower_waiter));

        release_live_skill_network_fetch(key, &leader_waiter);
    }

    #[test]
    fn release_live_skill_network_fetch_requires_matching_waiter() {
        let key = "live-skill-fetch-release-guard";
        let (leader_waiter, leader) = claim_live_skill_network_fetch(key);
        assert!(leader);

        release_live_skill_network_fetch(key, &Arc::new(Notify::new()));
        let (_same_waiter, still_follower) = claim_live_skill_network_fetch(key);
        assert!(!still_follower);

        release_live_skill_network_fetch(key, &leader_waiter);
        let (next_waiter, next_leader) = claim_live_skill_network_fetch(key);
        assert!(next_leader);
        release_live_skill_network_fetch(key, &next_waiter);
    }

    #[test]
    fn append_bytes_with_limit_respects_remaining_capacity() {
        let mut buffer = b"abc".to_vec();
        let truncated = append_bytes_with_limit(&mut buffer, b"defghi", 6);
        assert!(truncated);
        assert_eq!(buffer, b"abcdef");
    }

    #[test]
    fn append_bytes_with_limit_allows_small_chunks() {
        let mut buffer = Vec::new();
        let truncated = append_bytes_with_limit(&mut buffer, b"abc", 6);
        assert!(!truncated);
        let truncated = append_bytes_with_limit(&mut buffer, b"def", 6);
        assert!(!truncated);
        assert_eq!(buffer, b"abcdef");
    }

    #[test]
    fn validate_core_shell_command_rejects_oversized_input() {
        let oversized = "x".repeat(MAX_CORE_SHELL_COMMAND_CHARS + 1);
        let error = validate_core_shell_command(oversized.as_str())
            .expect_err("oversized command should be rejected");
        assert!(error.contains("command must be <="));
    }

    #[test]
    fn validate_core_shell_command_accepts_reasonable_input() {
        let command = "echo hello";
        assert!(validate_core_shell_command(command).is_ok());
    }

    #[test]
    fn shell_exit_represents_no_matches_for_search_commands() {
        assert!(shell_exit_represents_no_matches(
            "rg -n \"runtime validation\" .",
            1,
            "",
            "",
        ));
        assert!(shell_exit_represents_no_matches(
            "grep -RIn \"runtime validation\" .",
            1,
            "",
            "",
        ));
    }

    #[test]
    fn shell_exit_represents_no_matches_requires_search_shape_and_empty_streams() {
        assert!(!shell_exit_represents_no_matches("echo nope", 1, "", ""));
        assert!(!shell_exit_represents_no_matches(
            "rg -n \"runtime validation\" .",
            1,
            "match",
            "",
        ));
        assert!(!shell_exit_represents_no_matches(
            "rg -n \"runtime validation\" .",
            1,
            "",
            "regex parse error",
        ));
    }

    #[test]
    fn shell_exit_represents_no_matches_for_truncated_search_pipeline_without_output() {
        assert!(shell_exit_represents_no_matches(
            "rg -n -S --hidden -e 'runtime validation' . | head -n 200",
            0,
            "",
            "",
        ));
    }

    #[test]
    fn classify_shell_command_result_marks_search_no_matches_as_completed() {
        let (status, message, no_matches, error_code) =
            classify_shell_command_result("rg -n \"runtime validation\" .", 1, "", "");

        assert_eq!(status, "completed");
        assert_eq!(message, "Search completed with no matches.");
        assert!(no_matches);
        assert_eq!(error_code, None);
    }

    #[test]
    fn classify_shell_command_result_marks_truncated_search_pipeline_without_output_as_no_matches()
    {
        let (status, message, no_matches, error_code) = classify_shell_command_result(
            "rg -n -S --hidden -e 'runtime validation' . | head -n 200",
            0,
            "",
            "",
        );

        assert_eq!(status, "completed");
        assert_eq!(message, "Search completed with no matches.");
        assert!(no_matches);
        assert_eq!(error_code, None);
    }

    #[test]
    fn classify_shell_command_result_marks_windows_command_unavailable() {
        let (status, message, no_matches, error_code) = classify_shell_command_result(
            "rg --files src",
            9009,
            "",
            "'rg' is not recognized as an internal or external command",
        );

        assert_eq!(status, "failed");
        assert!(!no_matches);
        assert_eq!(message, "Command failed because a referenced executable or shell command is unavailable in this environment.");
        assert_eq!(error_code, Some(CORE_RUNTIME_COMMAND_UNAVAILABLE_ERROR_CODE));
    }

    #[test]
    fn classify_shell_command_result_marks_windows_permission_denied() {
        let (status, message, no_matches, error_code) = classify_shell_command_result(
            "rg --files src",
            1,
            "",
            "Program 'rg.exe' failed to run: Access is denied.",
        );

        assert_eq!(status, "failed");
        assert!(!no_matches);
        assert_eq!(message, "Command failed because the environment denied access to an executable, file, or path.");
        assert_eq!(error_code, Some(CORE_RUNTIME_PERMISSION_DENIED_ERROR_CODE));
    }

    #[test]
    fn classify_shell_command_launch_error_code_recognizes_access_denied() {
        assert_eq!(
            classify_shell_command_launch_error_code(
                "Failed to run command `rg --files`: Access is denied."
            ),
            CORE_RUNTIME_PERMISSION_DENIED_ERROR_CODE
        );
    }

    #[test]
    fn resolve_core_shell_command_prefers_non_empty_command_option() {
        let options = LiveSkillExecuteOptions {
            command: Some("echo from-option".to_string()),
            ..LiveSkillExecuteOptions::default()
        };
        let resolved = resolve_core_shell_command("echo from-input", &options);
        assert_eq!(resolved, Some("echo from-option"));
    }

    #[test]
    fn resolve_core_shell_command_falls_back_to_input_when_command_option_blank() {
        let options = LiveSkillExecuteOptions {
            command: Some("   ".to_string()),
            ..LiveSkillExecuteOptions::default()
        };
        let resolved = resolve_core_shell_command("echo from-input", &options);
        assert_eq!(resolved, Some("echo from-input"));
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_tree_path_traversal_failure_sets_stable_error_code() {
        let workspace = unique_test_workspace_dir("tree-path-guard");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-tree-path-guard".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            path: Some("../outside".to_string()),
            ..LiveSkillExecuteOptions::default()
        };

        let result =
            execute_core_tree_skill(Ok(&scope), "", &options, BUILTIN_LIVE_CORE_TREE_SKILL_ID)
                .await;

        assert_eq!(result.status, "failed");
        assert_eq!(
            result.metadata["errorCode"],
            Value::String(CORE_VALIDATION_PATH_ERROR_CODE.to_string())
        );
        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_write_oversized_payload_sets_stable_error_code() {
        let workspace = unique_test_workspace_dir("write-payload-guard");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-write-payload-guard".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            path: Some("notes/oversized.txt".to_string()),
            content: Some("x".repeat(MAX_CORE_FILE_BYTES + 1)),
            ..LiveSkillExecuteOptions::default()
        };

        let result =
            execute_core_write_skill(Ok(&scope), "", &options, BUILTIN_LIVE_CORE_WRITE_SKILL_ID)
                .await;

        assert_eq!(result.status, "failed");
        assert_eq!(
            result.metadata["errorCode"],
            Value::String(CORE_VALIDATION_PAYLOAD_TOO_LARGE_ERROR_CODE.to_string())
        );
        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_bash_restricted_command_sets_stable_error_code() {
        let workspace = unique_test_workspace_dir("bash-command-guard");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-bash-command-guard".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            command: Some("x".repeat(MAX_CORE_SHELL_COMMAND_CHARS + 1)),
            ..LiveSkillExecuteOptions::default()
        };

        let config = test_service_config();
        let counters = LiveSkillExecutionCounters::default();
        let result = execute_core_bash_skill(
            &config,
            &counters,
            Ok(&scope),
            "",
            &options,
            BUILTIN_LIVE_CORE_BASH_SKILL_ID,
            None,
        )
        .await;

        assert_eq!(result.status, "failed");
        assert_eq!(
            result.metadata["errorCode"],
            Value::String(CORE_VALIDATION_COMMAND_RESTRICTED_ERROR_CODE.to_string())
        );
        let _ = fs::remove_dir_all(workspace);
    }

    fn unique_test_workspace_dir(suffix: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "code-runtime-live-skill-{suffix}-{}-{}",
            std::process::id(),
            now_ms()
        ));
        path
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_tree_skill_lists_workspace_paths() {
        let workspace = unique_test_workspace_dir("tree-list");
        fs::create_dir_all(workspace.join("src")).expect("create src dir");
        fs::write(workspace.join("src/main.ts"), "console.log('ok');").expect("write file");

        let scope = WorkspaceScope {
            workspace_id: "ws-tree".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            path: Some(".".to_string()),
            max_depth: Some(4),
            max_results: Some(50),
            ..LiveSkillExecuteOptions::default()
        };

        let result =
            execute_core_tree_skill(Ok(&scope), "", &options, BUILTIN_LIVE_CORE_TREE_SKILL_ID)
                .await;

        assert_eq!(result.status, "completed");
        assert!(result.output.contains("./"));
        assert!(result.output.contains("src/"));
        assert!(result.output.contains("src/main.ts"));

        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_tree_skill_hides_dotfiles_by_default() {
        let workspace = unique_test_workspace_dir("tree-hidden");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");
        fs::write(workspace.join(".env"), "SECRET=1").expect("write hidden file");
        fs::write(workspace.join("README.md"), "# readme").expect("write visible file");

        let scope = WorkspaceScope {
            workspace_id: "ws-tree-hidden".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            path: Some(".".to_string()),
            max_depth: Some(2),
            max_results: Some(20),
            ..LiveSkillExecuteOptions::default()
        };

        let result =
            execute_core_tree_skill(Ok(&scope), "", &options, BUILTIN_LIVE_CORE_TREE_SKILL_ID)
                .await;

        assert_eq!(result.status, "completed");
        assert!(result.output.contains("README.md"));
        assert!(!result.output.contains(".env"));

        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_grep_skill_supports_literal_and_context_lines() {
        let workspace = unique_test_workspace_dir("grep-literal-context");
        fs::create_dir_all(workspace.join("src")).expect("create src dir");
        fs::write(
            workspace.join("src/main.ts"),
            "alpha\nworkspace token here\nomega\n",
        )
        .expect("write file");

        let scope = WorkspaceScope {
            workspace_id: "ws-grep".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            path: Some(".".to_string()),
            pattern: Some("workspace token".to_string()),
            match_mode: Some("literal".to_string()),
            context_before: Some(1),
            context_after: Some(1),
            max_results: Some(20),
            ..LiveSkillExecuteOptions::default()
        };

        let result =
            execute_core_grep_skill(Ok(&scope), "", &options, BUILTIN_LIVE_CORE_GREP_SKILL_ID)
                .await;

        assert_eq!(result.status, "completed");
        assert!(result.output.contains("src/main.ts:2: workspace token here"));
        assert!(result.output.contains("src/main.ts:1- alpha"));
        assert!(result.output.contains("src/main.ts:3- omega"));

        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_grep_skill_supports_regex_and_glob_filters() {
        let workspace = unique_test_workspace_dir("grep-regex-globs");
        fs::create_dir_all(workspace.join("src")).expect("create src dir");
        fs::create_dir_all(workspace.join("docs")).expect("create docs dir");
        fs::write(workspace.join("src/main.ts"), "const API_KEY = 'a';\n").expect("write src");
        fs::write(workspace.join("docs/readme.md"), "API_KEY in docs\n").expect("write docs");

        let scope = WorkspaceScope {
            workspace_id: "ws-grep-regex".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            path: Some(".".to_string()),
            pattern: Some(r"API_[A-Z]+".to_string()),
            match_mode: Some("regex".to_string()),
            include_globs: Some(vec!["src/**/*.ts".to_string()]),
            exclude_globs: Some(vec!["**/*.md".to_string()]),
            max_results: Some(20),
            ..LiveSkillExecuteOptions::default()
        };

        let result =
            execute_core_grep_skill(Ok(&scope), "", &options, BUILTIN_LIVE_CORE_GREP_SKILL_ID)
                .await;

        assert_eq!(result.status, "completed");
        assert!(result.output.contains("src/main.ts:1: const API_KEY = 'a';"));
        assert!(!result.output.contains("docs/readme.md"));

        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn core_read_skill_reports_missing_file_with_specific_error_code() {
        let workspace = unique_test_workspace_dir("read-missing");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-read-missing".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            path: Some("README.md".to_string()),
            ..LiveSkillExecuteOptions::default()
        };

        let result =
            execute_core_read_skill(Ok(&scope), "", &options, BUILTIN_LIVE_CORE_READ_SKILL_ID)
                .await;

        assert_eq!(result.status, "failed");
        assert!(result.message.contains("does not exist"));
        assert_eq!(
            result.metadata["errorCode"],
            Value::String("runtime.read.file_not_found".to_string())
        );
        assert_eq!(
            result.metadata["path"],
            Value::String(workspace.join("README.md").display().to_string())
        );

        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn run_shell_command_caps_large_stdout_capture() {
        let workspace = unique_test_workspace_dir("stdout-cap");
        fs::create_dir_all(workspace.as_path()).expect("create test workspace");

        let result =
            run_shell_command(
                workspace.as_path(),
                "yes 1234567890 | head -n 50000",
                5_000,
                &ku0_runtime_shell_core::resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL"),
            )
            .await
            .expect("run shell command");
        let (exit_code, stdout, stderr, timed_out) = result;

        assert!(!timed_out);
        assert_eq!(exit_code, Some(0));
        assert!(stderr.is_empty());
        assert!(stdout.chars().count() <= MAX_CORE_SHELL_OUTPUT_CHARS);

        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn run_shell_command_times_out_and_returns_timeout_signal() {
        let workspace = unique_test_workspace_dir("timeout");
        fs::create_dir_all(workspace.as_path()).expect("create test workspace");

        let result = run_shell_command(
            workspace.as_path(),
            "sleep 2",
            50,
            &ku0_runtime_shell_core::resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL"),
        )
            .await
            .expect("run shell command");
        let (exit_code, stdout, stderr, timed_out) = result;

        assert!(timed_out);
        assert!(exit_code.is_none());
        assert!(stdout.is_empty());
        assert!(stderr.is_empty());

        let _ = fs::remove_dir_all(workspace);
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn run_shell_command_respects_cancellation_token() {
        let workspace = unique_test_workspace_dir("cancel");
        fs::create_dir_all(workspace.as_path()).expect("create test workspace");
        let cancellation = tokio_util::sync::CancellationToken::new();
        let cancellation_for_task = cancellation.clone();

        let join = tokio::spawn(async move {
            run_shell_command_with_cancel(
                workspace.as_path(),
                "sleep 2",
                5_000,
                &ku0_runtime_shell_core::resolve_shell_from_env("CODE_RUNTIME_CORE_SHELL"),
                Some(&cancellation_for_task),
            )
            .await
        });

        tokio::time::sleep(Duration::from_millis(50)).await;
        cancellation.cancel();

        let result = join
            .await
            .expect("cancelled shell command task should join")
            .expect("run shell command");

        assert!(result.cancelled);
        assert!(!result.timed_out);
    }

    #[tokio::test]
    async fn core_js_repl_skill_persists_workspace_session_state() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) =
            set_test_runtime_tool_state_paths("js-repl-persistent");
        let workspace = unique_test_workspace_dir("js-repl-persistent");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-persistent".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(config.clone(), scope.workspace_id.as_str(), scope.workspace_path.as_path()).await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let first = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "globalThis.__runtimeCounter = (globalThis.__runtimeCounter ?? 0) + 1; globalThis.__runtimeCounter;",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;
        let second = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "globalThis.__runtimeCounter = (globalThis.__runtimeCounter ?? 0) + 1; globalThis.__runtimeCounter;",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(first.status, "completed");
        assert_eq!(second.status, "completed");
        assert_eq!(first.output.trim(), "1");
        assert_eq!(second.output.trim(), "2");
        assert_eq!(first.metadata["persistentSession"].as_bool(), Some(true));
        assert_eq!(
            first.metadata["sessionId"].as_str(),
            second.metadata["sessionId"].as_str()
        );

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[tokio::test]
    async fn core_js_repl_reset_skill_clears_persistent_workspace_session_state() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) = set_test_runtime_tool_state_paths("js-repl-reset");
        let workspace = unique_test_workspace_dir("js-repl-reset");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-reset".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(config.clone(), scope.workspace_id.as_str(), scope.workspace_path.as_path()).await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let seeded = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "globalThis.__runtimeValue = 41; globalThis.__runtimeValue;",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;
        let reset = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let after_reset = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "globalThis.__runtimeValue ?? 'missing'",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(seeded.status, "completed");
        assert_eq!(seeded.output.trim(), "41");
        assert_eq!(reset.status, "completed");
        assert_eq!(
            reset.metadata["previousSessionId"].as_str(),
            seeded.metadata["sessionId"].as_str()
        );
        assert_eq!(after_reset.status, "completed");
        assert_eq!(after_reset.output.trim(), "missing");
        assert_ne!(
            after_reset.metadata["sessionId"].as_str(),
            seeded.metadata["sessionId"].as_str()
        );

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[tokio::test]
    async fn core_js_repl_skill_exposes_stable_tmp_dir_until_reset() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) = set_test_runtime_tool_state_paths("js-repl-tmp-dir");
        let workspace = unique_test_workspace_dir("js-repl-tmp-dir");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-tmp-dir".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(
            config.clone(),
            scope.workspace_id.as_str(),
            scope.workspace_path.as_path(),
        )
        .await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let first = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "codex.tmpDir",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;
        let second = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "codex.tmpDir",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;
        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let after_reset = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "codex.tmpDir",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        let first_tmp_dir = first.metadata["kernel"]["tmpDir"]
            .as_str()
            .expect("first tmp dir");
        let second_tmp_dir = second.metadata["kernel"]["tmpDir"]
            .as_str()
            .expect("second tmp dir");
        let reset_tmp_dir = after_reset.metadata["kernel"]["tmpDir"]
            .as_str()
            .expect("reset tmp dir");
        assert_eq!(first.status, "completed");
        assert_eq!(first.output.trim(), first_tmp_dir);
        assert_eq!(second.output.trim(), second_tmp_dir);
        assert_eq!(first_tmp_dir, second_tmp_dir);
        assert_ne!(first_tmp_dir, reset_tmp_dir);

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[tokio::test]
    async fn core_js_repl_skill_routes_nested_runtime_tools() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) =
            set_test_runtime_tool_state_paths("js-repl-nested-tool");
        let workspace = unique_test_workspace_dir("js-repl-nested-tool");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");
        fs::write(workspace.join("example.ts"), "const value: number = 1;\n").expect("write file");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-nested-tool".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(
            config.clone(),
            scope.workspace_id.as_str(),
            scope.workspace_path.as_path(),
        )
        .await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let result = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "const response = await codex.tool('read-file', { path: 'example.ts' }); response.output.includes('const value')",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(result.status, "completed");
        assert_eq!(result.output.trim(), "true");
        assert_eq!(
            result.metadata["kernel"]["nestedToolCalls"][0]["name"].as_str(),
            Some("read-file")
        );
        assert_eq!(
            result.metadata["kernel"]["nestedToolCalls"][0]["ok"].as_bool(),
            Some(true)
        );

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[tokio::test]
    async fn core_js_repl_browser_debug_status_probe_completes_when_playwright_is_unavailable() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) =
            set_test_runtime_tool_state_paths("js-repl-browser-debug-status");
        let workspace = unique_test_workspace_dir("js-repl-browser-debug-status");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-browser-debug-status".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(
            config.clone(),
            scope.workspace_id.as_str(),
            scope.workspace_path.as_path(),
        )
        .await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let result = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "const summarize = (value) => console.log(value.output ?? JSON.stringify(value, null, 2));\
             const status = await (async () => {\
               try {\
                 return await codex.tool('get-runtime-browser-debug-status', {});\
               } catch (error) {\
                 return { error: String(error?.message ?? error) };\
               }\
             })();\
             summarize(status);\
             const inspection = await (async () => {\
               try {\
                 return await codex.tool('inspect-runtime-browser', { prompt: 'Inspect the current page.', timeoutMs: 20000 });\
               } catch (error) {\
                 return { error: String(error?.message ?? error) };\
               }\
             })();\
             summarize(inspection);",
            &LiveSkillExecuteOptions {
                timeout_ms: Some(30_000),
                ..LiveSkillExecuteOptions::default()
            },
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(result.status, "completed");
        assert!(
            result.output.contains("Playwright MCP is unavailable")
                || result
                    .output
                    .contains("Chrome DevTools MCP is unavailable")
                || result.output.contains("runtime browser debug")
                || result.output.contains("\"available\":false")
                || result.output.contains("\"available\": false")
                || result.output.contains("\"status\":\"unavailable\"")
                || result.output.contains("\"status\": \"unavailable\"")
                || result.output.contains("\"status\":\"blocked\"")
                || result.output.contains("\"status\": \"blocked\"")
                || result.output.contains("\"status\":\"degraded\"")
                || result.output.contains("\"status\": \"degraded\"")
                || result.output.contains("\"status\":\"ready\"")
                || result.output.contains("\"status\": \"ready\"")
                || result.output.contains("\"mode\":\"unavailable\"")
                || result.output.contains("\"mode\": \"unavailable\"")
                || result.output.contains("\"mode\":\"mcp-chrome-devtools\"")
                || result.output.contains("\"mode\": \"mcp-chrome-devtools\"")
                || result.output.contains("Workspace `ws-js-repl-browser-debug-status` not found."),
            "unexpected browser debug fallback output: {}",
            result.output
        );

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[tokio::test]
    async fn core_js_repl_mixed_browser_debug_prompt_completes_when_playwright_is_unavailable() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) =
            set_test_runtime_tool_state_paths("js-repl-browser-debug-mixed");
        let workspace = unique_test_workspace_dir("js-repl-browser-debug-mixed");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-browser-debug-mixed".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(
            config.clone(),
            scope.workspace_id.as_str(),
            scope.workspace_path.as_path(),
        )
        .await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let result = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "const request = \"Use browser debugging tools to inspect the current page. If browser debug is unavailable, then search this workspace for where the recent thread/tool timeline UI is rendered and name the actual component or file. Use executed evidence only.\";\
             const summarize = (value) => console.log(value.output ?? JSON.stringify(value, null, 2));\
             const status = await (async () => {\
               try {\
                 return await codex.tool('get-runtime-browser-debug-status', {});\
               } catch (error) {\
                 return { error: String(error?.message ?? error) };\
               }\
             })();\
             summarize(status);\
             const inspection = await (async () => {\
               try {\
                 return await codex.tool('inspect-runtime-browser', { prompt: request, timeoutMs: 20000 });\
               } catch (error) {\
                 return { error: String(error?.message ?? error) };\
               }\
             })();\
             summarize(inspection);",
            &LiveSkillExecuteOptions {
                timeout_ms: Some(30_000),
                ..LiveSkillExecuteOptions::default()
            },
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(result.status, "completed");
        assert!(
            result.output.contains("Playwright MCP is unavailable")
                || result
                    .output
                    .contains("Chrome DevTools MCP is unavailable")
                || result.output.contains("runtime browser debug")
                || result.output.contains("\"available\":false")
                || result.output.contains("\"available\": false")
                || result.output.contains("\"status\":\"unavailable\"")
                || result.output.contains("\"status\": \"unavailable\"")
                || result.output.contains("\"status\":\"blocked\"")
                || result.output.contains("\"status\": \"blocked\"")
                || result.output.contains("\"status\":\"degraded\"")
                || result.output.contains("\"status\": \"degraded\"")
                || result.output.contains("\"status\":\"ready\"")
                || result.output.contains("\"status\": \"ready\"")
                || result.output.contains("\"mode\":\"unavailable\"")
                || result.output.contains("\"mode\": \"unavailable\"")
                || result.output.contains("\"mode\":\"mcp-chrome-devtools\"")
                || result.output.contains("\"mode\": \"mcp-chrome-devtools\"")
                || result.output.contains("Workspace `ws-js-repl-browser-debug-mixed` not found."),
            "unexpected browser debug fallback output: {}",
            result.output
        );

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[test]
    fn core_js_repl_timeout_retry_policy_is_scoped_to_runtime_browser_debug_flows() {
        assert!(should_retry_core_js_repl_after_timeout(
            "await codex.tool('get-runtime-browser-debug-status', {});"
        ));
        assert!(should_retry_core_js_repl_after_timeout(
            "await codex.tool('inspect-runtime-browser', { prompt: 'Inspect the current page.' });"
        ));
        assert!(should_retry_core_js_repl_after_timeout(
            "await codex.tool('run-runtime-browser-automation', { steps: [] });"
        ));
        assert!(!should_retry_core_js_repl_after_timeout(
            "while (true) {}"
        ));
        assert!(!should_retry_core_js_repl_after_timeout(
            "await import('node:fs/promises');"
        ));
    }

    #[tokio::test]
    async fn core_js_repl_skill_routes_nested_mutations_through_runtime_guardrails() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) =
            set_test_runtime_tool_state_paths("js-repl-nested-mutations");
        let workspace = unique_test_workspace_dir("js-repl-nested-mutations");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-nested-mutations".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(
            config.clone(),
            scope.workspace_id.as_str(),
            scope.workspace_path.as_path(),
        )
        .await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let result = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "const writeResult = await codex.tool('write-file', { path: 'note.txt', content: 'alpha' });\
             const editResult = await codex.tool('edit-file', { path: 'note.txt', find: 'alpha', replace: 'beta' });\
             const shellResult = await codex.tool('run-shell-command', { command: 'echo shell-ok' });\
             writeResult.status === 'completed' && editResult.status === 'completed' && shellResult.output.includes('shell-ok');",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(result.status, "completed");
        assert_eq!(result.output.trim(), "true");
        assert!(
            !result.message.contains("requires external approval"),
            "unexpected nested approval error: {}",
            result.message
        );
        assert_eq!(
            fs::read_to_string(workspace.join("note.txt")).expect("read note"),
            "beta"
        );

        let metrics = ctx.runtime_tool_metrics.lock().await.read_snapshot();
        for tool_name in [
            "runtime:write-workspace-file",
            "runtime:edit-workspace-file",
            "runtime:execute-workspace-command",
        ] {
            let entry = metrics.by_tool.get(tool_name).unwrap_or_else(|| panic!("missing metrics for {tool_name}"));
            assert_eq!(entry.totals.attempted_total, 1, "{tool_name} attempted");
            assert_eq!(entry.totals.started_total, 1, "{tool_name} started");
            assert_eq!(entry.totals.completed_total, 1, "{tool_name} completed");
            assert_eq!(entry.totals.success_total, 1, "{tool_name} success");
            assert_eq!(entry.totals.blocked_total, 0, "{tool_name} blocked");
        }

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[tokio::test]
    async fn core_js_repl_skill_blocks_large_nested_patch_and_browser_payloads() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) =
            set_test_runtime_tool_state_paths("js-repl-guardrail-block");
        let workspace = unique_test_workspace_dir("js-repl-guardrail-block");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-guardrail-block".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(
            config.clone(),
            scope.workspace_id.as_str(),
            scope.workspace_path.as_path(),
        )
        .await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let result = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "const oversized = 'x'.repeat(70_000);\
             const patchError = await (async () => { try { await codex.tool('apply-workspace-patch', { diff: oversized }); return 'ok'; } catch (error) { return String(error?.message ?? error); } })();\
             const browserError = await (async () => { try { await codex.tool('run-runtime-browser-automation', { prompt: oversized }); return 'ok'; } catch (error) { return String(error?.message ?? error); } })();\
             patchError.includes('runtime guardrail') && browserError.includes('runtime guardrail');",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(result.status, "completed");
        assert_eq!(result.output.trim(), "true");
        assert_eq!(
            result.metadata["kernel"]["nestedToolCalls"][0]["name"].as_str(),
            Some("apply-workspace-patch")
        );
        assert_eq!(
            result.metadata["kernel"]["nestedToolCalls"][0]["ok"].as_bool(),
            Some(false)
        );
        assert_eq!(
            result.metadata["kernel"]["nestedToolCalls"][1]["name"].as_str(),
            Some("run-runtime-browser-automation")
        );
        assert_eq!(
            result.metadata["kernel"]["nestedToolCalls"][1]["ok"].as_bool(),
            Some(false)
        );

        let metrics = ctx.runtime_tool_metrics.lock().await.read_snapshot();
        for tool_name in [
            "runtime:apply-workspace-patch",
            "runtime:run-runtime-browser-automation",
        ] {
            let entry = metrics.by_tool.get(tool_name).unwrap_or_else(|| panic!("missing metrics for {tool_name}"));
            assert_eq!(entry.totals.attempted_total, 1, "{tool_name} attempted");
            assert_eq!(entry.totals.started_total, 0, "{tool_name} started");
            assert_eq!(entry.totals.completed_total, 1, "{tool_name} completed");
            assert_eq!(entry.totals.blocked_total, 1, "{tool_name} blocked");
        }

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[tokio::test]
    async fn core_js_repl_skill_emits_image_artifacts() {
        let _guard = RUNTIME_TOOL_STATE_ENV_LOCK
            .lock()
            .expect("lock runtime tool state env");
        let (guardrails_path, metrics_path) =
            set_test_runtime_tool_state_paths("js-repl-emit-image");
        let workspace = unique_test_workspace_dir("js-repl-emit-image");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-js-repl-emit-image".to_string(),
            workspace_path: workspace.clone(),
        };
        let config = test_service_config();
        let ctx = test_live_skill_app_context(
            config.clone(),
            scope.workspace_id.as_str(),
            scope.workspace_path.as_path(),
        )
        .await;
        let counters = LiveSkillExecutionCounters::default();
        let session_store = Arc::new(RwLock::new(HashMap::new()));

        let result = execute_core_js_repl_skill(
            &ctx,
            &config,
            &counters,
            &session_store,
            Ok(&scope),
            "await codex.emitImage('data:image/png;base64,YWJj'); 'ok';",
            &LiveSkillExecuteOptions::default(),
            BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID,
            Some("workspace-write"),
        )
        .await;

        assert_eq!(result.status, "completed");
        assert_eq!(result.output.trim(), "ok");
        assert_eq!(result.artifacts.len(), 1);
        let artifact = serde_json::to_value(&result.artifacts[0]).expect("artifact json");
        assert_eq!(artifact["kind"].as_str(), Some("image"));
        assert_eq!(artifact["mimeType"].as_str(), Some("image/png"));

        let _ = execute_core_js_repl_reset_skill(
            &session_store,
            Ok(&scope),
            BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID,
        )
        .await;
        let _ = fs::remove_dir_all(workspace);
        clear_test_runtime_tool_state_paths(guardrails_path, metrics_path);
    }

    #[test]
    fn extract_core_js_repl_image_artifact_rejects_message_and_artifact() {
        let result = extract_core_js_repl_image_artifact(&json!({
            "message": "browser snapshot ready",
            "artifacts": [{
                "kind": "image",
                "mimeType": "image/png",
                "dataBase64": "YWJj"
            }]
        }));

        assert_eq!(
            result.expect_err("message + artifact should be rejected"),
            "codex.emitImage(...) rejects mixed text-and-image tool results."
        );
    }

    #[test]
    fn extract_core_js_repl_image_artifact_rejects_content_text_and_artifact() {
        let result = extract_core_js_repl_image_artifact(&json!({
            "contentText": "browser snapshot ready",
            "artifacts": [{
                "kind": "image",
                "mimeType": "image/png",
                "dataBase64": "YWJj"
            }]
        }));

        assert_eq!(
            result.expect_err("contentText + artifact should be rejected"),
            "codex.emitImage(...) rejects mixed text-and-image tool results."
        );
    }

    #[test]
    fn extract_core_js_repl_image_artifact_rejects_output_and_artifact() {
        let result = extract_core_js_repl_image_artifact(&json!({
            "output": "browser snapshot ready",
            "artifacts": [{
                "kind": "image",
                "mimeType": "image/png",
                "dataBase64": "YWJj"
            }]
        }));

        assert_eq!(
            result.expect_err("output + artifact should be rejected"),
            "codex.emitImage(...) rejects mixed text-and-image tool results."
        );
    }

    #[test]
    fn extract_core_js_repl_image_artifact_accepts_single_pure_artifact() {
        let result = extract_core_js_repl_image_artifact(&json!({
            "artifacts": [{
                "kind": "image",
                "mimeType": "image/png",
                "dataBase64": "YWJj"
            }]
        }))
        .expect("pure artifact should be accepted");

        let artifact = serde_json::to_value(result).expect("artifact json");
        assert_eq!(artifact["kind"].as_str(), Some("image"));
        assert_eq!(artifact["mimeType"].as_str(), Some("image/png"));
    }

    #[tokio::test]
    async fn core_computer_observe_skill_blocks_when_disabled() {
        let _guard = COMPUTER_OBSERVE_ENV_LOCK
            .lock()
            .expect("lock computer observe env");
        std::env::remove_var(CORE_COMPUTER_OBSERVE_ENV_KEY);
        let workspace = unique_test_workspace_dir("computer-observe-blocked");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-computer-observe-blocked".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions::default();
        let result = execute_core_computer_observe_skill(
            Ok(&scope),
            "check editor state",
            &options,
            BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID,
        )
        .await;

        assert_eq!(result.status, "blocked");
        assert!(
            result
                .message
                .contains("disabled by runtime policy"),
            "expected blocked message, got: {}",
            result.message
        );
        assert_eq!(
            result.metadata["reason"].as_str(),
            Some("capability_unavailable")
        );
        assert_eq!(
            result.metadata["errorCode"].as_str(),
            Some("runtime.validation.request.blocked")
        );
        let _ = fs::remove_dir_all(workspace);
    }

    #[tokio::test]
    async fn core_computer_observe_skill_returns_observation_when_enabled() {
        let _guard = COMPUTER_OBSERVE_ENV_LOCK
            .lock()
            .expect("lock computer observe env");
        std::env::set_var(CORE_COMPUTER_OBSERVE_ENV_KEY, "1");
        let workspace = unique_test_workspace_dir("computer-observe-enabled");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-computer-observe-enabled".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            query: Some("toolbar status".to_string()),
            ..LiveSkillExecuteOptions::default()
        };
        let result = execute_core_computer_observe_skill(
            Ok(&scope),
            "",
            &options,
            BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID,
        )
        .await;

        assert_eq!(result.status, "completed");
        assert!(result.output.contains("toolbar status"));
        assert_eq!(result.metadata["supportsControl"].as_bool(), Some(false));
        assert_eq!(result.metadata["supportsObserve"].as_bool(), Some(true));
        assert_eq!(
            result.metadata["capabilityNegotiation"]["mode"].as_str(),
            Some("observe_only")
        );

        std::env::remove_var(CORE_COMPUTER_OBSERVE_ENV_KEY);
        let _ = fs::remove_dir_all(workspace);
    }

    #[tokio::test]
    async fn core_computer_observe_skill_blocks_command_passthrough() {
        let _guard = COMPUTER_OBSERVE_ENV_LOCK
            .lock()
            .expect("lock computer observe env");
        std::env::set_var(CORE_COMPUTER_OBSERVE_ENV_KEY, "1");
        let workspace = unique_test_workspace_dir("computer-observe-command-blocked");
        fs::create_dir_all(workspace.as_path()).expect("create workspace");

        let scope = WorkspaceScope {
            workspace_id: "ws-computer-observe-command-blocked".to_string(),
            workspace_path: workspace.clone(),
        };
        let options = LiveSkillExecuteOptions {
            command: Some("echo should-not-run".to_string()),
            ..LiveSkillExecuteOptions::default()
        };
        let result = execute_core_computer_observe_skill(
            Ok(&scope),
            "",
            &options,
            BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID,
        )
        .await;

        assert_eq!(result.status, "blocked");
        assert!(
            result
                .message
                .contains("Command passthrough is not supported"),
            "expected command blocked message, got: {}",
            result.message
        );
        assert_eq!(
            result.metadata["reason"].as_str(),
            Some("command_restricted")
        );
        assert_eq!(
            result.metadata["errorCode"].as_str(),
            Some("runtime.validation.command.restricted")
        );

        std::env::remove_var(CORE_COMPUTER_OBSERVE_ENV_KEY);
        let _ = fs::remove_dir_all(workspace);
    }
