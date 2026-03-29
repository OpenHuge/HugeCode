mod tests {
    use super::{
        build_app_context, build_task_source_dedupe_key, create_initial_state, handle_rpc,
        native_state_store, normalize_github_repo_identity, stable_hash, AppContext,
        ServiceConfig, TaskSourceEventRpc, TaskSourceIngestRequestRpc, TaskSourceLaunchHandshakeRpc,
        TaskSourcePayloadRpc, TaskSourceRepoContextRpc, TaskSourceRequesterRpc,
        DEFAULT_AGENT_MAX_CONCURRENT_TASKS, DEFAULT_AGENT_TASK_HISTORY_LIMIT,
        DEFAULT_ANTHROPIC_ENDPOINT, DEFAULT_ANTHROPIC_VERSION,
        DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS, DEFAULT_DISCOVERY_SERVICE_TYPE,
        DEFAULT_DISCOVERY_STALE_TTL_MS, DEFAULT_GEMINI_ENDPOINT,
        DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL, DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
        DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS, DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
        DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS, DEFAULT_OPENAI_MAX_RETRIES,
        DEFAULT_OPENAI_RETRY_BASE_MS, DEFAULT_OPENAI_TIMEOUT_MS,
        DEFAULT_RUNTIME_WS_MAX_CONNECTIONS, DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES, DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
        DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES, DEFAULT_SANDBOX_NETWORK_ACCESS,
    };
    use serde_json::{json, Value};
    use std::{path::Path, process::Command, sync::Arc};
    use tempfile::TempDir;

    fn task_source_test_config() -> ServiceConfig {
        ServiceConfig {
            default_model_id: "gpt-5.4".to_string(),
            openai_api_key: Some("test-openai-key".to_string()),
            openai_endpoint: "https://api.openai.com/v1/responses".to_string(),
            openai_compat_base_url: None,
            openai_compat_api_key: None,
            anthropic_api_key: None,
            anthropic_endpoint: DEFAULT_ANTHROPIC_ENDPOINT.to_string(),
            anthropic_version: DEFAULT_ANTHROPIC_VERSION.to_string(),
            gemini_api_key: None,
            gemini_endpoint: DEFAULT_GEMINI_ENDPOINT.to_string(),
            openai_timeout_ms: DEFAULT_OPENAI_TIMEOUT_MS,
            openai_max_retries: DEFAULT_OPENAI_MAX_RETRIES,
            openai_retry_base_ms: DEFAULT_OPENAI_RETRY_BASE_MS,
            openai_compat_model_cache_ttl_ms: DEFAULT_OPENAI_COMPAT_MODEL_CACHE_TTL_MS,
            live_skills_network_enabled: false,
            live_skills_network_base_url: DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL.to_string(),
            live_skills_network_timeout_ms: DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS,
            live_skills_network_cache_ttl_ms: DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS,
            sandbox_enabled: false,
            sandbox_network_access: DEFAULT_SANDBOX_NETWORK_ACCESS.to_string(),
            sandbox_allowed_hosts: Vec::new(),
            oauth_pool_db_path: ":memory:".to_string(),
            oauth_secret_key: None,
            oauth_public_base_url: None,
            oauth_loopback_callback_port: DEFAULT_OAUTH_LOOPBACK_CALLBACK_PORT,
            runtime_auth_token: None,
            agent_max_concurrent_tasks: DEFAULT_AGENT_MAX_CONCURRENT_TASKS,
            agent_task_history_limit: DEFAULT_AGENT_TASK_HISTORY_LIMIT,
            distributed_enabled: false,
            distributed_redis_url: None,
            distributed_lane_count: 1,
            distributed_worker_concurrency: 1,
            distributed_claim_idle_ms: 500,
            discovery_enabled: false,
            discovery_service_type: DEFAULT_DISCOVERY_SERVICE_TYPE.to_string(),
            discovery_browse_interval_ms: DEFAULT_DISCOVERY_BROWSE_INTERVAL_MS,
            discovery_stale_ttl_ms: DEFAULT_DISCOVERY_STALE_TTL_MS,
            runtime_backend_id: "task-source-test".to_string(),
            runtime_backend_capabilities: vec!["code".to_string()],
            runtime_port: 8788,
            ws_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES,
            ws_max_write_buffer_size_bytes: DEFAULT_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES,
            ws_max_frame_size_bytes: DEFAULT_RUNTIME_WS_MAX_FRAME_SIZE_BYTES,
            ws_max_message_size_bytes: DEFAULT_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES,
            ws_max_connections: DEFAULT_RUNTIME_WS_MAX_CONNECTIONS,
            provider_extension_seeds: Vec::new(),
        }
    }

    fn task_source_test_context(native_store_path: &Path) -> AppContext {
        build_app_context(
            create_initial_state("gpt-5.4"),
            task_source_test_config(),
            Arc::new(native_state_store::NativeStateStore::new(
                native_store_path.to_path_buf(),
            )),
        )
    }

    fn run_git(workspace_path: &Path, args: &[&str]) {
        let status = Command::new("git")
            .current_dir(workspace_path)
            .args(args)
            .status()
            .expect("spawn git");
        assert!(status.success(), "git {:?} failed", args);
    }

    #[test]
    fn normalize_github_repo_identity_supports_https_and_ssh() {
        assert_eq!(
            normalize_github_repo_identity("https://github.com/OpenHuge/HugeCode.git"),
            Some("openhuge/hugecode".to_string())
        );
        assert_eq!(
            normalize_github_repo_identity("git@github.com:OpenHuge/HugeCode.git"),
            Some("openhuge/hugecode".to_string())
        );
    }

    #[test]
    fn build_task_source_dedupe_key_prefers_comment_identity_for_pr_followups() {
        let request = TaskSourceIngestRequestRpc {
            provider: "github".to_string(),
            event: TaskSourceEventRpc {
                delivery_id: Some("delivery-1".to_string()),
                event_name: "issue_comment".to_string(),
                action: Some("created".to_string()),
                received_at: None,
            },
            payload: TaskSourcePayloadRpc {
                kind: "github_pr_followup".to_string(),
                trigger_mode: "pull_request_comment_command".to_string(),
                repo: TaskSourceRepoContextRpc {
                    full_name: Some("openhuge/hugecode".to_string()),
                    ..TaskSourceRepoContextRpc::default()
                },
                pull_request_number: Some(74),
                comment_id: Some(991),
                command_kind: Some("continue".to_string()),
                head_sha: Some("abc123".to_string()),
                ..TaskSourcePayloadRpc::default()
            },
            launch: None,
        };

        let key = build_task_source_dedupe_key(&request).expect("build dedupe key");
        assert!(key.contains("comment:991"));
        assert!(key.contains("continue"));
        assert_eq!(stable_hash(key.as_str()).len(), 16);
    }

    #[tokio::test]
    async fn prepare_task_source_start_request_injects_approved_plan_version() {
        let temp = TempDir::new().expect("temp dir");
        let workspace = temp.path().join("workspace");
        std::fs::create_dir_all(&workspace).expect("create workspace");
        run_git(workspace.as_path(), &["init", "-q"]);
        run_git(
            workspace.as_path(),
            &["remote", "add", "origin", "https://github.com/OpenHuge/HugeCode.git"],
        );

        let native_store_path = temp.path().join("native.db");
        let ctx = task_source_test_context(native_store_path.as_path());
        let workspace_record = handle_rpc(
            &ctx,
            "code_workspace_create",
            &json!({
                "path": workspace.to_string_lossy().to_string(),
                "displayName": "HugeCode",
            }),
        )
        .await
        .expect("create workspace");
        let workspace_id = workspace_record
            .get("id")
            .and_then(Value::as_str)
            .expect("workspace id");

        let start_request = json!({
            "workspaceId": workspace_id,
            "requestId": "task-source:source-record-1",
            "title": "Stabilize GitHub automation",
            "taskSource": {
                "kind": "github_issue",
                "title": "Stabilize GitHub automation",
                "reference": "Issue #42",
                "url": "https://github.com/OpenHuge/HugeCode/issues/42",
                "issueNumber": 42,
                "repo": {
                    "fullName": "OpenHuge/HugeCode",
                    "remoteUrl": "https://github.com/OpenHuge/HugeCode.git",
                },
                "externalId": "github-issue-42",
                "githubSource": {
                    "sourceRecordId": "source-record-1",
                    "repo": {
                        "fullName": "OpenHuge/HugeCode",
                        "remoteUrl": "https://github.com/OpenHuge/HugeCode.git",
                    },
                    "event": {
                        "deliveryId": "delivery-42",
                        "eventName": "issues",
                        "action": "assigned",
                        "receivedAt": 1,
                    },
                    "ref": {
                        "label": "Issue #42",
                        "issueNumber": 42,
                        "triggerMode": "assignment",
                    },
                    "launchHandshake": {
                        "state": "prepared",
                        "summary": "Runtime prepared a deterministic launch handshake.",
                        "disposition": "launched",
                    },
                },
            },
            "steps": [{
                "kind": "read",
                "input": "GitHub source objective: Stabilize GitHub automation",
                "requiresApproval": true,
                "approvalReason": "test task source launch handshake",
            }],
        });

        let prepared_start_request =
            super::prepare_task_source_start_request(&ctx, start_request.clone())
                .await
                .expect("prepare task source start request");
        let approved_plan_version = prepared_start_request.approved_plan_version.clone();
        let prepared_start_request = prepared_start_request.start_request;
        assert!(
            prepared_start_request["approvedPlanVersion"]
                .as_str()
                .is_some_and(|value| !value.is_empty())
        );
        assert_eq!(
            prepared_start_request["approvedPlanVersion"],
            Value::String(approved_plan_version.clone())
        );
        assert_eq!(prepared_start_request["workspaceId"], json!(workspace_id));
        assert_eq!(
            prepared_start_request["taskSource"]["kind"],
            json!("github_issue")
        );
        assert_eq!(
            prepared_start_request["taskSource"]["githubSource"]["launchHandshake"]["state"],
            json!("started")
        );
        assert_eq!(
            prepared_start_request["taskSource"]["githubSource"]["launchHandshake"]
                ["approvedPlanVersion"],
            Value::String(approved_plan_version)
        );

        let run_record = super::runtime_kernel_v2_dispatch::handle_runtime_run_start_v2(
            &ctx,
            &prepared_start_request,
        )
        .await
        .expect("start run with approved plan version");
        assert_eq!(run_record["run"]["workspaceId"], json!(workspace_id));
        assert!(run_record["run"]["taskId"].as_str().is_some());
    }

    #[test]
    fn build_task_source_github_provenance_captures_event_ref_and_handshake() {
        let provenance = super::build_task_source_github_provenance(
            "source-74",
            &TaskSourceEventRpc {
                delivery_id: Some("delivery-74".to_string()),
                event_name: "issue_comment".to_string(),
                action: Some("created".to_string()),
                received_at: Some(1_234),
            },
            &TaskSourcePayloadRpc {
                kind: "github_pr_followup".to_string(),
                title: Some("Review GitHub provenance".to_string()),
                repo: TaskSourceRepoContextRpc {
                    owner: Some("OpenHuge".to_string()),
                    name: Some("HugeCode".to_string()),
                    full_name: Some("OpenHuge/HugeCode".to_string()),
                    remote_url: Some("https://github.com/OpenHuge/HugeCode.git".to_string()),
                },
                pull_request_number: Some(74),
                comment_id: Some(991),
                comment_author: Some(TaskSourceRequesterRpc {
                    login: Some("reviewer".to_string()),
                    id: Some(2),
                    r#type: Some("User".to_string()),
                }),
                command_kind: Some("continue".to_string()),
                trigger_mode: "pull_request_comment_command".to_string(),
                ..TaskSourcePayloadRpc::default()
            },
            &TaskSourceLaunchHandshakeRpc {
                state: "started".to_string(),
                summary: "Runtime started the GitHub-driven run.".to_string(),
                disposition: Some("launched".to_string()),
                prepared_plan_version: Some("plan-v74".to_string()),
                approved_plan_version: Some("plan-v74".to_string()),
            },
        );

        assert_eq!(provenance.source_record_id, "source-74");
        assert_eq!(provenance.repo.full_name.as_deref(), Some("OpenHuge/HugeCode"));
        assert_eq!(provenance.event.event_name, "issue_comment");
        assert_eq!(provenance.event.action.as_deref(), Some("created"));
        assert_eq!(provenance.r#ref.label, "PR #74");
        assert_eq!(provenance.r#ref.pull_request_number, Some(74));
        assert_eq!(
            provenance.comment.as_ref().and_then(|comment| comment.comment_id),
            Some(991)
        );
        assert_eq!(
            provenance
                .comment
                .as_ref()
                .and_then(|comment| comment.author.as_ref())
                .and_then(|author| author.login.as_deref()),
            Some("reviewer")
        );
        assert_eq!(provenance.launch_handshake.state, "started");
        assert_eq!(
            provenance.launch_handshake.approved_plan_version.as_deref(),
            Some("plan-v74")
        );
    }
}
