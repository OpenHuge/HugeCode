    include!("lib_tests_body_helpers.inc");


    include!("lib_tests_body_oauth.inc");

    include!("lib_tests_body_runtime_helpers.inc");

    include!("lib_tests_body_mock_servers.inc");

    include!("lib_tests_body_stream_helpers.inc");

    include!("lib_tests_body_rpc_and_native_management.inc");

    include!("lib_tests_body_distributed_task_graph.inc");

    include!("lib_tests_body_providers_catalog.inc");

    include!("lib_tests_body_workspace_and_codex.inc");

    include!("lib_tests_body_agent_tasks.inc");

    include!("lib_tests_body_models_and_skills.inc");

    include!("lib_tests_body_events_and_routing.inc");

    #[tokio::test]
    async fn oauth_account_upsert_and_list_support_canonical_and_snake_case_payloads() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "account_id":"codex-a1",
                    "provider":"codex",
                    "display_name":"Codex A1",
                    "route_config":{
                      "compat_base_url":"https://compat.example.com/v1/",
                      "proxy_id":"proxy-east",
                      "priority":7,
                      "concurrency_limit":3,
                      "schedulable":false
                    },
                    "routing_state":{
                      "credential_ready":false,
                      "last_routing_error":"upstream timeout",
                      "rate_limited_until":123,
                      "overloaded_until":456,
                      "temp_unschedulable_until":789,
                      "temp_unschedulable_reason":"manual drain"
                    },
                    "metadata":{
                      "api_key":"secret-codex-token"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app.clone().oneshot(upsert).await.expect("upsert response");
        let upsert_bytes = axum::body::to_bytes(upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let upsert_payload: Value = serde_json::from_slice(&upsert_bytes).expect("parse json");
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["accountId"],
            Value::String("codex-a1".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );
        assert_eq!(
            upsert_payload["result"]["metadata"]["compatBaseUrl"],
            Value::String("https://compat.example.com/v1".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["routeConfig"]["proxyId"],
            Value::String("proxy-east".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["routeConfig"]["schedulable"],
            Value::Bool(false)
        );
        assert_eq!(
            upsert_payload["result"]["routingState"]["tempUnschedulableReason"],
            Value::String("manual drain".to_string())
        );
        assert!(upsert_payload["result"]["metadata"]["apiKey"].is_null());
        assert!(upsert_payload["result"]["metadata"]["api_key"].is_null());

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"codex"}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let accounts = payload["result"].as_array().expect("accounts array");
        let account = accounts
            .iter()
            .find(|entry| entry["accountId"] == Value::String("codex-a1".to_string()))
            .expect("codex account");
        assert_eq!(account["metadata"]["apiKeyConfigured"], Value::Bool(true));
        assert_eq!(
            account["metadata"]["compatBaseUrl"],
            Value::String("https://compat.example.com/v1".to_string())
        );
        assert_eq!(
            account["routeConfig"]["priority"],
            Value::Number(serde_json::Number::from(7))
        );
        assert_eq!(
            account["routingState"]["credentialReady"],
            Value::Bool(false)
        );
        assert!(account["metadata"]["apiKey"].is_null());
        assert!(account["metadata"]["api_key"].is_null());
    }

    #[tokio::test]
    async fn oauth_account_upsert_and_list_accept_antigravity_provider_alias() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"gemini-anti-gravity-a1",
                    "provider":"anti-gravity",
                    "displayName":"Gemini Anti Gravity A1",
                    "metadata":{"api_key":"secret-gemini-token"}
                  }
                }"#,
            ))
            .expect("build upsert request");

        let upsert_response = app.clone().oneshot(upsert).await.expect("upsert response");
        let upsert_bytes = axum::body::to_bytes(upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read upsert body");
        let upsert_payload: Value = serde_json::from_slice(&upsert_bytes).expect("parse upsert");
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["provider"],
            Value::String("gemini".to_string())
        );

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"google"}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read list body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse list");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"][0]["provider"],
            Value::String("gemini".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_and_list_support_chatgpt_workspace_memberships() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-workspaces-a1",
                    "provider":"codex",
                    "chatgpt_workspaces":[
                      {
                        "workspace_id":"org-default",
                        "title":"Default Org",
                        "role":"owner",
                        "is_default":true
                      },
                      {
                        "workspace_id":"org-shared",
                        "title":"Shared Org",
                        "role":"member",
                        "is_default":false
                      }
                    ],
                    "default_chatgpt_workspace_id":"org-default",
                    "metadata":{
                      "api_key":"secret-codex-token"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app.clone().oneshot(upsert).await.expect("upsert response");
        let upsert_bytes = axum::body::to_bytes(upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let upsert_payload: Value = serde_json::from_slice(&upsert_bytes).expect("parse json");
        assert_eq!(upsert_payload["ok"], Value::Bool(true));
        assert_eq!(
            upsert_payload["result"]["defaultChatgptWorkspaceId"],
            Value::String("org-default".to_string())
        );
        assert_eq!(
            upsert_payload["result"]["chatgptWorkspaces"][0]["workspaceId"],
            Value::String("org-default".to_string())
        );

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"codex"}}"#,
            ))
            .expect("build list request");
        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        let accounts = payload["result"].as_array().expect("accounts array");
        let account = accounts
            .iter()
            .find(|entry| entry["accountId"] == Value::String("codex-workspaces-a1".to_string()))
            .expect("workspace aware account");
        assert_eq!(
            account["defaultChatgptWorkspaceId"],
            Value::String("org-default".to_string())
        );
        assert_eq!(
            account["chatgptWorkspaces"][1]["workspaceId"],
            Value::String("org-shared".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_rejects_non_object_metadata() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-invalid-metadata",
                    "provider":"codex",
                    "metadata":"not-an-object"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("metadata"));
    }

    #[tokio::test]
    async fn oauth_account_upsert_rejects_reserved_encrypted_metadata_field() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-reserved-encrypted-key",
                    "provider":"codex",
                    "metadata":{"apiKeyEncryptedV1":"tampered-ciphertext"}
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("apiKeyEncryptedV1"));
        assert!(message.contains("reserved"));
    }

    #[tokio::test]
    async fn oauth_account_upsert_reserved_metadata_rejection_updates_runtime_diagnostics() {
        let app = test_router();
        let upsert_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-reserved-encrypted-key",
                    "provider":"codex",
                    "metadata":{"apiKeyEncryptedV1":"tampered-ciphertext"}
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_request)
            .await
            .expect("upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

        let ready_request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let ready_response = app.oneshot(ready_request).await.expect("ready response");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let ready_payload: Value = serde_json::from_slice(&ready_bytes).expect("parse ready json");
        assert_eq!(
            ready_payload["runtimeDiagnostics"]["oauthReservedMetadataRejectionsTotal"],
            Value::Number(serde_json::Number::from(1))
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_requires_oauth_secret_key_for_api_key_storage() {
        let mut config = test_service_config();
        config.oauth_secret_key = None;
        let app = test_router_with_config(config);

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-missing-secret-key",
                    "provider":"codex",
                    "metadata":{"apiKey":"raw-key"}
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("OAUTH_SECRET_KEY"));
    }

    #[tokio::test]
    async fn oauth_account_upsert_without_metadata_preserves_existing_credentials() {
        let (compat_base_url, compat_handle) =
            spawn_openai_compat_mock_server(vec!["gpt-5.3-codex"], Some("oauth-preserved-key"))
                .await;
        let config = test_service_config_with_openai_compat_oauth_only(compat_base_url.as_str());
        let app = test_router_with_config(config);

        let first_upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-preserved",
                    "provider":"codex",
                    "metadata":{"apiKey":"oauth-preserved-key"}
                  }
                }"#,
            ))
            .expect("build first upsert request");
        let first_upsert_response = app
            .clone()
            .oneshot(first_upsert)
            .await
            .expect("first upsert response");
        assert_eq!(first_upsert_response.status(), StatusCode::OK);

        let second_upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-preserved",
                    "provider":"codex",
                    "displayName":"Codex Preserved"
                  }
                }"#,
            ))
            .expect("build second upsert request");
        let second_upsert_response = app
            .clone()
            .oneshot(second_upsert)
            .await
            .expect("second upsert response");
        let second_bytes = axum::body::to_bytes(second_upsert_response.into_body(), 1024 * 1024)
            .await
            .expect("read second upsert body");
        let second_payload: Value =
            serde_json::from_slice(&second_bytes).expect("parse second upsert json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(
            second_payload["result"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );

        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-preserved-account-metadata",
                      "content":"Ping preserved key",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");
        let turn_response = app.oneshot(turn_request).await.expect("turn response");
        compat_handle.abort();
        assert_eq!(turn_response.status(), StatusCode::OK);
        let turn_bytes = axum::body::to_bytes(turn_response.into_body(), 1024 * 1024)
            .await
            .expect("read turn body");
        let turn_payload: Value = serde_json::from_slice(&turn_bytes).expect("parse turn json");
        assert_eq!(turn_payload["ok"], Value::Bool(true));
        assert_eq!(turn_payload["result"]["accepted"], Value::Bool(true));
        assert_eq!(
            turn_payload["result"]["routedSource"],
            Value::String("oauth-account".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_primary_account_get_and_set_return_redacted_account_summary() {
        let app = test_router();
        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-rpc-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-primary-rpc-a1-key"}
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-rpc-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));
        assert_eq!(
            set_payload["result"]["accountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(
            set_payload["result"]["routeAccountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(set_payload["result"]["inSync"], Value::Bool(true));
        assert_eq!(
            set_payload["result"]["account"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );
        assert!(set_payload["result"]["account"]["metadata"]["apiKey"].is_null());

        let get_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["accountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(
            get_payload["result"]["routeAccountId"],
            Value::String("codex-primary-rpc-a1".to_string())
        );
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["account"]["metadata"]["apiKeyConfigured"],
            Value::Bool(true)
        );
        assert!(get_payload["result"]["account"]["metadata"]["apiKey"].is_null());
    }

    #[tokio::test]
    async fn oauth_primary_account_reconciles_to_fallback_after_primary_account_remove() {
        let app = test_router();
        for account_id in ["codex-primary-remove-a1", "codex-primary-remove-a2"] {
            let upsert_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method":"code_oauth_account_upsert",
                    "params":{
                        "accountId":account_id,
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{"apiKey":format!("{account_id}-key")}
                    }
                }),
            )
            .await;
            assert_eq!(upsert_payload["ok"], Value::Bool(true));
        }

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-remove-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));

        let remove_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_remove",
                "params":{"accountId":"codex-primary-remove-a1"}
            }),
        )
        .await;
        assert_eq!(remove_payload["ok"], Value::Bool(true));
        assert_eq!(remove_payload["result"], Value::Bool(true));

        let get_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["accountId"],
            Value::String("codex-primary-remove-a2".to_string())
        );
        assert_eq!(
            get_payload["result"]["routeAccountId"],
            Value::String("codex-primary-remove-a2".to_string())
        );
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));
    }

    #[tokio::test]
    async fn oauth_primary_account_reconciles_to_fallback_after_primary_account_disabled() {
        let app = test_router();
        for account_id in ["codex-primary-disable-a1", "codex-primary-disable-a2"] {
            let upsert_payload = send_rpc_request(
                app.clone(),
                json!({
                    "method":"code_oauth_account_upsert",
                    "params":{
                        "accountId":account_id,
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{"apiKey":format!("{account_id}-key")}
                    }
                }),
            )
            .await;
            assert_eq!(upsert_payload["ok"], Value::Bool(true));
        }

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-disable-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));

        let disable_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-disable-a1",
                    "provider":"codex",
                    "status":"disabled",
                    "disabledReason":"manual"
                }
            }),
        )
        .await;
        assert_eq!(disable_payload["ok"], Value::Bool(true));

        let get_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert_eq!(
            get_payload["result"]["accountId"],
            Value::String("codex-primary-disable-a2".to_string())
        );
        assert_eq!(
            get_payload["result"]["routeAccountId"],
            Value::String("codex-primary-disable-a2".to_string())
        );
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));
    }

    #[tokio::test]
    async fn oauth_primary_account_clears_when_last_candidate_becomes_invalid() {
        let app = test_router();
        let upsert_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-clear-last-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-primary-clear-last-a1-key"}
                }
            }),
        )
        .await;
        assert_eq!(upsert_payload["ok"], Value::Bool(true));

        let set_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_set",
                "params":{
                    "provider":"codex",
                    "accountId":"codex-primary-clear-last-a1"
                }
            }),
        )
        .await;
        assert_eq!(set_payload["ok"], Value::Bool(true));

        let disable_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_account_upsert",
                "params":{
                    "accountId":"codex-primary-clear-last-a1",
                    "provider":"codex",
                    "status":"disabled",
                    "disabledReason":"manual"
                }
            }),
        )
        .await;
        assert_eq!(disable_payload["ok"], Value::Bool(true));

        let get_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_oauth_primary_account_get",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(get_payload["ok"], Value::Bool(true));
        assert!(get_payload["result"]["accountId"].is_null());
        assert!(get_payload["result"]["account"].is_null());
        assert!(get_payload["result"]["routeAccountId"].is_null());
        assert_eq!(get_payload["result"]["inSync"], Value::Bool(true));

        let pools_payload = send_rpc_request(
            app,
            json!({
                "method":"code_oauth_pools_list",
                "params":{"provider":"codex"}
            }),
        )
        .await;
        assert_eq!(pools_payload["ok"], Value::Bool(true));
        let pool = pools_payload["result"]
            .as_array()
            .and_then(|entries| {
                entries
                    .iter()
                    .find(|entry| entry["poolId"] == Value::String("pool-codex".to_string()))
            })
            .expect("codex default pool");
        assert!(pool["preferredAccountId"].is_null());
    }

    #[tokio::test]
    async fn oauth_rate_limit_invalid_grant_disables_account() {
        let app = test_router();

        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"claude-a1","provider":"claude_code"}
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let report = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_rate_limit_report",
                  "params":{
                    "accountId":"claude-a1",
                    "modelId":"claude-sonnet-4.5",
                    "success":false,
                    "errorCode":"invalid_grant"
                  }
                }"#,
            ))
            .expect("build report request");
        let report_response = app.clone().oneshot(report).await.expect("report response");
        let report_bytes = axum::body::to_bytes(report_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let report_payload: Value = serde_json::from_slice(&report_bytes).expect("parse json");
        assert_eq!(report_payload["ok"], Value::Bool(true));
        assert_eq!(report_payload["result"], Value::Bool(true));

        let list = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"claude_code"}}"#,
            ))
            .expect("build list request");

        let response = app.oneshot(list).await.expect("list response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        let account = payload["result"]
            .as_array()
            .and_then(|accounts| accounts.first())
            .expect("account");
        assert_eq!(account["status"], Value::String("disabled".to_string()));
        assert_eq!(
            account["disabledReason"],
            Value::String("oauth_invalid_grant".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_accounts_list_rejects_unsupported_provider_filter() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"provider":"unknown_vendor"}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_accounts_list_rejects_unsupported_usage_refresh_mode() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{"method":"code_oauth_accounts_list","params":{"usageRefresh":"fastest"}}"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_returns_token_payload_when_account_has_access_token() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-refresh-a1",
                    "provider":"codex",
                    "externalAccountId":"chatgpt-account-1",
                    "metadata":{
                      "apiKey":"chatgpt-access-token-1",
                      "chatgptAccountId":"chatgpt-account-1",
                      "chatgptPlanType":"pro"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"unauthorized","previousAccountId":"chatgpt-account-1"}
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-1".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-1".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptPlanType"],
            Value::String("pro".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-a1".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_prefers_refresh_token_over_stale_access_token_for_unauthorized(
    ) {
        static CODEX_OAUTH_ISSUER_ENV_LOCK: std::sync::LazyLock<std::sync::Mutex<()>> =
            std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

        let _guard = CODEX_OAUTH_ISSUER_ENV_LOCK
            .lock()
            .expect("codex oauth issuer env lock poisoned");
        let (issuer_base_url, refresh_requests, handle) = spawn_codex_oauth_refresh_mock_server(
            "refresh-token-1",
            "chatgpt-access-token-refreshed",
            Some("refresh-token-2"),
        )
        .await;
        let _issuer_guard =
            TestEnvVarGuard::set(CODE_RUNTIME_CODEX_OAUTH_ISSUER_ENV, issuer_base_url.as_str());

        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-refresh-stale-a1",
                    "provider":"codex",
                    "externalAccountId":"chatgpt-account-stale-1",
                    "metadata":{
                      "apiKey":"chatgpt-access-token-stale",
                      "refreshToken":"refresh-token-1",
                      "refreshTokenAvailable":true,
                      "chatgptAccountId":"chatgpt-account-stale-1",
                      "chatgptPlanType":"pro"
                    }
                  }
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"unauthorized","previousAccountId":"chatgpt-account-stale-1"}
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-refreshed".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-stale-1".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptPlanType"],
            Value::String("pro".to_string())
        );
        assert_eq!(
            refresh_requests.load(AtomicOrdering::SeqCst),
            1,
            "unauthorized refresh should exchange refreshToken even when a stale access token is present"
        );

        handle.abort();
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_returns_null_when_account_credentials_are_missing() {
        let app = test_router();
        let upsert = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-refresh-no-credential",
                    "provider":"codex",
                    "externalAccountId":"chatgpt-account-2",
                    "metadata":{"chatgptAccountId":"chatgpt-account-2"}
                  }
                }"#,
            ))
            .expect("build upsert request");
        let _ = app.clone().oneshot(upsert).await.expect("upsert response");

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"unauthorized","previousAccountId":"chatgpt-account-2"}
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert!(payload["result"].is_null());
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_rejects_unsupported_reason() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{"reason":"expired"}
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_cross_provider_accounts() {
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"codex-a1","provider":"codex"}
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-claude-risk","provider":"claude_code","name":"Claude Risk Pool"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-claude-risk","members":[{"accountId":"codex-a1"}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("does not match pool provider"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_duplicate_account_ids() {
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-dup-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-dup-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-codex-dup-risk","provider":"codex","name":"Codex Dup Risk Pool"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{
                    "poolId":"pool-codex-dup-risk",
                    "members":[{"accountId":"codex-dup-a1"},{"accountId":"codex-dup-a1"}]
                  }
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("duplicates"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_missing_account_as_invalid_params() {
        let app = test_router();

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-codex-missing-member","provider":"codex","name":"Codex Missing Member Pool"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-codex-missing-member","members":[{"accountId":"codex-missing-a1"}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("does not exist"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_missing_pool_as_invalid_params() {
        let app = test_router();

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-risk-missing","members":[{"accountId":"codex-any-a1"}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("Pool `pool-risk-missing` does not exist"));
    }

    #[tokio::test]
    async fn oauth_pool_members_replace_rejects_out_of_range_weight_as_invalid_params() {
        let app = test_router();

        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-risk-weight-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-risk-weight-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{"poolId":"pool-codex","members":[{"accountId":"codex-risk-weight-a1","weight":0}]}
                }"#,
            ))
            .expect("build replace members request");

        let response = app
            .oneshot(replace_members)
            .await
            .expect("replace members response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let error_message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(error_message.contains("weight"));
        assert!(error_message.contains("between 1 and 20"));
    }

    #[tokio::test]
    async fn oauth_pool_apply_upserts_pool_and_members_atomically_with_canonical_method() {
        let app = test_router();

        let upsert_account_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_account_upsert",
                "params": {
                    "accountId": "codex-apply-a1",
                    "provider": "codex",
                    "status": "enabled",
                    "metadata": {"apiKey":"codex-apply-a1-key"}
                }
            }),
        )
        .await;
        assert_eq!(upsert_account_payload["ok"], Value::Bool(true));

        let apply_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_pool_apply",
                "params": {
                    "pool": {
                        "poolId": "pool-codex-apply",
                        "provider": "codex",
                        "name": "Codex Apply Pool",
                        "strategy": "p2c",
                        "stickyMode": "balance",
                        "enabled": true,
                        "metadata": {"source":"test"}
                    },
                    "members": [
                        {
                            "accountId": "codex-apply-a1",
                            "weight": 3,
                            "priority": 1,
                            "position": 0,
                            "enabled": true
                        }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(apply_payload["ok"], Value::Bool(true));
        assert_eq!(
            apply_payload["result"]["pool"]["poolId"],
            Value::String("pool-codex-apply".to_string())
        );
        assert_eq!(
            apply_payload["result"]["pool"]["strategy"],
            Value::String("p2c".to_string())
        );
        assert_eq!(
            apply_payload["result"]["members"][0]["accountId"],
            Value::String("codex-apply-a1".to_string())
        );
        assert_eq!(
            apply_payload["result"]["members"][0]["weight"],
            Value::Number(3.into())
        );

    }

    #[tokio::test]
    async fn oauth_pool_apply_rejects_pool_version_mismatch() {
        let app = test_router();

        let initial_apply = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_pool_apply",
                "params": {
                    "pool": {
                        "poolId": "pool-codex-versioned",
                        "provider": "codex",
                        "name": "Versioned Pool"
                    },
                    "members": []
                }
            }),
        )
        .await;
        assert_eq!(initial_apply["ok"], Value::Bool(true));
        let updated_at = initial_apply["result"]["pool"]["updatedAt"]
            .as_u64()
            .expect("updatedAt");

        let conflict_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_oauth_pool_apply",
                "params": {
                    "pool": {
                        "poolId": "pool-codex-versioned",
                        "provider": "codex",
                        "name": "Versioned Pool Updated"
                    },
                    "members": [],
                    "expectedUpdatedAt": updated_at.saturating_sub(1)
                }
            }),
        )
        .await;
        assert_eq!(conflict_payload["ok"], Value::Bool(false));
        assert_eq!(
            conflict_payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = conflict_payload["error"]["message"]
            .as_str()
            .unwrap_or_default();
        assert!(message.starts_with("POOL_VERSION_MISMATCH:"));
    }

    #[test]
    fn map_oauth_account_upsert_error_uses_typed_error_code() {
        let invalid = map_oauth_account_upsert_error(OAuthPoolMutationError::invalid_input(
            "metadata `apiKeyEncryptedV1` is reserved and cannot be set directly.",
        ));
        assert_eq!(invalid.code.as_str(), "INVALID_PARAMS");
        assert_eq!(
            invalid.message,
            "metadata `apiKeyEncryptedV1` is reserved and cannot be set directly."
        );

        let internal = map_oauth_account_upsert_error(OAuthPoolMutationError::internal(
            "Begin upsert_account transaction: database locked",
        ));
        assert_eq!(internal.code.as_str(), "INTERNAL_ERROR");
        assert_eq!(
            internal.message,
            "Begin upsert_account transaction: database locked"
        );
    }

    #[test]
    fn map_oauth_pool_mutation_error_uses_typed_error_code() {
        let invalid = map_oauth_pool_mutation_error(OAuthPoolMutationError::invalid_input(
            "Pool member account `codex-a1` does not exist",
        ));
        assert_eq!(invalid.code.as_str(), "INVALID_PARAMS");
        assert_eq!(
            invalid.message,
            "Pool member account `codex-a1` does not exist"
        );

        let internal = map_oauth_pool_mutation_error(OAuthPoolMutationError::internal(
            "database locked while writing oauth pool members",
        ));
        assert_eq!(internal.code.as_str(), "INTERNAL_ERROR");
        assert_eq!(
            internal.message,
            "database locked while writing oauth pool members"
        );
    }

    #[tokio::test]
    async fn oauth_pool_select_skips_disabled_account_and_uses_sticky_binding() {
        let app = test_router();

        let upsert_enabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-enabled",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-enabled-key"}
                  }
                }"#,
            ))
            .expect("build upsert enabled request");
        let _ = app
            .clone()
            .oneshot(upsert_enabled)
            .await
            .expect("upsert enabled response");

        let upsert_disabled = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"codex-disabled","provider":"codex","status":"disabled"}
                }"#,
            ))
            .expect("build upsert disabled request");
        let _ = app
            .clone()
            .oneshot(upsert_disabled)
            .await
            .expect("upsert disabled response");

        let upsert_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{"poolId":"pool-codex-sticky","provider":"codex","name":"Codex Sticky Pool","strategy":"round_robin"}
                }"#,
            ))
            .expect("build upsert pool request");
        let _ = app
            .clone()
            .oneshot(upsert_pool)
            .await
            .expect("upsert pool response");

        let replace_members = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{
                    "poolId":"pool-codex-sticky",
                    "members":[
                      {"accountId":"codex-disabled","enabled":true},
                      {"accountId":"codex-enabled","enabled":true}
                    ]
                  }
                }"#,
            ))
            .expect("build replace members request");
        let _ = app
            .clone()
            .oneshot(replace_members)
            .await
            .expect("replace members response");

        let select_first = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{"poolId":"pool-codex-sticky","sessionId":"session-sticky"}
                }"#,
            ))
            .expect("build select first request");
        let select_first_response = app
            .clone()
            .oneshot(select_first)
            .await
            .expect("select first response");
        let first_bytes = axum::body::to_bytes(select_first_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let first_payload: Value = serde_json::from_slice(&first_bytes).expect("parse json");
        assert_eq!(first_payload["ok"], Value::Bool(true));
        assert_eq!(
            first_payload["result"]["account"]["accountId"],
            Value::String("codex-enabled".to_string())
        );

        let select_second = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{"poolId":"pool-codex-sticky","sessionId":"session-sticky"}
                }"#,
            ))
            .expect("build select second request");
        let select_second_response = app
            .clone()
            .oneshot(select_second)
            .await
            .expect("select second response");
        let second_bytes = axum::body::to_bytes(select_second_response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let second_payload: Value = serde_json::from_slice(&second_bytes).expect("parse json");
        assert_eq!(second_payload["ok"], Value::Bool(true));
        assert_eq!(
            second_payload["result"]["reason"],
            Value::String("sticky_binding".to_string())
        );
        assert_eq!(
            second_payload["result"]["account"]["accountId"],
            Value::String("codex-enabled".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_select_filters_by_chatgpt_workspace_id_over_rpc() {
        let app = test_router();

        for (account_id, workspace_id) in [("codex-org-a", "org-a"), ("codex-org-b", "org-b")] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{account_id}-key",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"session-workspace-filter",
                    "chatgptWorkspaceId":"org-b"
                  }
                }"#,
            ))
            .expect("build select request");
        let response = app.oneshot(select).await.expect("select response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["account"]["accountId"],
            Value::String("codex-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["account"]["defaultChatgptWorkspaceId"],
            Value::String("org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_account_bind_creates_project_workspace_override_over_preferred_route() {
        let app = test_router();

        for account_id in ["codex-bind-a1", "codex-bind-a2"] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{{"apiKey":"{account_id}-key"}}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let preferred_pool = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-codex",
                    "provider":"codex",
                    "name":"Codex Pool",
                    "strategy":"round_robin",
                    "stickyMode":"balance",
                    "preferredAccountId":"codex-bind-a1",
                    "enabled":true
                  }
                }"#,
            ))
            .expect("build pool upsert request");
        let _ = app
            .clone()
            .oneshot(preferred_pool)
            .await
            .expect("preferred pool response");

        let bind = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_account_bind",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"project-ws-bind-rpc-1",
                    "accountId":"codex-bind-a2"
                  }
                }"#,
            ))
            .expect("build bind request");
        let bind_response = app.clone().oneshot(bind).await.expect("bind response");
        let bind_bytes = axum::body::to_bytes(bind_response.into_body(), 1024 * 1024)
            .await
            .expect("read bind body");
        let bind_payload: Value = serde_json::from_slice(&bind_bytes).expect("parse bind json");
        assert_eq!(bind_payload["ok"], Value::Bool(true));
        assert_eq!(
            bind_payload["result"]["account"]["accountId"],
            Value::String("codex-bind-a2".to_string())
        );
        assert_eq!(
            bind_payload["result"]["reason"],
            Value::String("manual_binding".to_string())
        );

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"project-ws-bind-rpc-1"
                  }
                }"#,
            ))
            .expect("build select request");
        let select_response = app.oneshot(select).await.expect("select response");
        let select_bytes = axum::body::to_bytes(select_response.into_body(), 1024 * 1024)
            .await
            .expect("read select body");
        let select_payload: Value = serde_json::from_slice(&select_bytes).expect("parse select json");
        assert_eq!(select_payload["ok"], Value::Bool(true));
        assert_eq!(
            select_payload["result"]["account"]["accountId"],
            Value::String("codex-bind-a2".to_string())
        );
        assert_eq!(
            select_payload["result"]["reason"],
            Value::String("manual_binding".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_select_prefers_explicit_chatgpt_workspace_id_over_legacy_workspace_id() {
        let app = test_router();

        for (account_id, workspace_id) in [("codex-org-a", "org-a"), ("codex-org-b", "org-b")] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{account_id}-key",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"session-workspace-priority",
                    "chatgptWorkspaceId":"org-b",
                    "workspaceId":"org-a"
                  }
                }"#,
            ))
            .expect("build select request");
        let response = app.oneshot(select).await.expect("select response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["account"]["accountId"],
            Value::String("codex-org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_prefers_explicit_chatgpt_workspace_id() {
        let app = test_router();

        for (account_id, external_account_id, workspace_id, token) in [
            (
                "codex-refresh-org-a",
                "chatgpt-account-org-a",
                "org-a",
                "chatgpt-access-token-org-a",
            ),
            (
                "codex-refresh-org-b",
                "chatgpt-account-org-b",
                "org-b",
                "chatgpt-access-token-org-b",
            ),
        ] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "externalAccountId":"{external_account_id}",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{token}",
                          "chatgptAccountId":"{external_account_id}",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{
                    "reason":"unauthorized",
                    "chatgptWorkspaceId":"org-b"
                  }
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_reuses_workspace_aware_session_binding() {
        let app = test_router();

        for (account_id, external_account_id, workspace_id, token) in [
            (
                "codex-refresh-bound-a",
                "chatgpt-account-bound-a",
                "org-a",
                "chatgpt-access-token-bound-a",
            ),
            (
                "codex-refresh-bound-b",
                "chatgpt-account-bound-b",
                "org-b",
                "chatgpt-access-token-bound-b",
            ),
        ] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "externalAccountId":"{external_account_id}",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{token}",
                          "chatgptAccountId":"{external_account_id}",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let select = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_select",
                  "params":{
                    "poolId":"pool-codex",
                    "sessionId":"session-refresh-bound-1",
                    "chatgptWorkspaceId":"org-b"
                  }
                }"#,
            ))
            .expect("build select request");
        let select_response = app.clone().oneshot(select).await.expect("select response");
        let select_bytes = axum::body::to_bytes(select_response.into_body(), 1024 * 1024)
            .await
            .expect("read select body");
        let select_payload: Value = serde_json::from_slice(&select_bytes).expect("parse select");
        assert_eq!(
            select_payload["result"]["account"]["accountId"],
            Value::String("codex-refresh-bound-b".to_string())
        );

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{
                    "reason":"unauthorized",
                    "sessionId":"session-refresh-bound-1",
                    "chatgptWorkspaceId":"org-b",
                    "previousAccountId":"chatgpt-account-bound-a"
                  }
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-bound-b".to_string())
        );
        assert_eq!(
            payload["result"]["chatgptAccountId"],
            Value::String("chatgpt-account-bound-b".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-bound-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_chatgpt_auth_tokens_refresh_prefers_explicit_chatgpt_workspace_id_over_legacy_workspace_id(
    ) {
        let app = test_router();

        for (account_id, external_account_id, workspace_id, token) in [
            (
                "codex-refresh-org-a",
                "chatgpt-account-org-a",
                "org-a",
                "chatgpt-access-token-org-a",
            ),
            (
                "codex-refresh-org-b",
                "chatgpt-account-org-b",
                "org-b",
                "chatgpt-access-token-org-b",
            ),
        ] {
            let upsert = Request::builder()
                .method("POST")
                .uri("/rpc")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{
                      "method":"code_oauth_account_upsert",
                      "params":{{
                        "accountId":"{account_id}",
                        "provider":"codex",
                        "externalAccountId":"{external_account_id}",
                        "status":"enabled",
                        "metadata":{{
                          "apiKey":"{token}",
                          "chatgptAccountId":"{external_account_id}",
                          "chatgptWorkspaces":[{{"workspaceId":"{workspace_id}","title":"{workspace_id}","isDefault":true}}]
                        }}
                      }}
                    }}"#
                )))
                .expect("build upsert request");
            let _ = app.clone().oneshot(upsert).await.expect("upsert response");
        }

        let refresh = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_chatgpt_auth_tokens_refresh",
                  "params":{
                    "reason":"unauthorized",
                    "chatgptWorkspaceId":"org-b",
                    "workspaceId":"org-a"
                  }
                }"#,
            ))
            .expect("build refresh request");

        let response = app.oneshot(refresh).await.expect("refresh response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(true));
        assert_eq!(
            payload["result"]["accessToken"],
            Value::String("chatgpt-access-token-org-b".to_string())
        );
        assert_eq!(
            payload["result"]["sourceAccountId"],
            Value::String("codex-refresh-org-b".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_account_upsert_rejects_invalid_status() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{"accountId":"codex-a1","provider":"codex","status":"paused"}
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_upsert_rejects_invalid_strategy_and_sticky_mode() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-risk-invalid",
                    "provider":"codex",
                    "name":"Risk Invalid",
                    "strategy":"weighted_random",
                    "stickyMode":"memory_optimized"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
    }

    #[tokio::test]
    async fn oauth_pool_upsert_rejects_non_object_metadata() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-invalid-metadata",
                    "provider":"codex",
                    "name":"Invalid Metadata Pool",
                    "metadata":"not-an-object"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("metadata"));
        assert!(message.contains("JSON object"));
    }

    #[tokio::test]
    async fn oauth_pool_upsert_rejects_missing_preferred_account() {
        let app = test_router();
        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-missing-preferred",
                    "provider":"codex",
                    "name":"Missing Preferred",
                    "preferredAccountId":"codex-missing-a1"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("Preferred account"));
        assert!(message.contains("does not exist"));
    }

    #[tokio::test]
    async fn oauth_pool_upsert_rejects_preferred_account_provider_mismatch() {
        let app = test_router();
        let upsert_account = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-preferred-a1",
                    "provider":"codex",
                    "status":"enabled",
                    "metadata":{"apiKey":"codex-preferred-key"}
                  }
                }"#,
            ))
            .expect("build upsert account request");
        let _ = app
            .clone()
            .oneshot(upsert_account)
            .await
            .expect("upsert account response");

        let request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_upsert",
                  "params":{
                    "poolId":"pool-claude-preferred-mismatch",
                    "provider":"claude_code",
                    "name":"Preferred Mismatch",
                    "preferredAccountId":"codex-preferred-a1"
                  }
                }"#,
            ))
            .expect("build request");

        let response = app.oneshot(request).await.expect("rpc response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse json");
        assert_eq!(payload["ok"], Value::Bool(false));
        assert_eq!(
            payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );
        let message = payload["error"]["message"].as_str().unwrap_or_default();
        assert!(message.contains("Preferred account"));
        assert!(message.contains("does not match pool provider"));
    }

    #[tokio::test]
    async fn readiness_returns_service_unavailable_when_openai_key_is_missing() {
        let app = test_router();
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn readiness_returns_ok_when_required_openai_config_is_present() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn readiness_returns_ok_when_compat_mode_is_configured_for_default_provider() {
        let mut config = test_service_config_with_openai_compat("http://127.0.0.1:8045/v1");
        config.default_model_id = "claude-sonnet-4-5".to_string();
        config.anthropic_api_key = None;
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn readiness_includes_oauth_pool_diagnostics_snapshot() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(
            payload["oauthPool"]["accountsTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["oauthPool"]["poolsTotal"],
            Value::Number(serde_json::Number::from(3))
        );
        assert_eq!(
            payload["oauthPool"]["oauthSecretKeyConfigured"],
            Value::Bool(true)
        );
        assert_eq!(
            payload["oauthPool"]["roundRobinCursorEntries"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["oauthRoutingFailuresTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["oauthReservedMetadataRejectionsTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogRefreshLocksTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFetchFailuresTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogErrorCooldownHitsTotal"],
            Value::Number(serde_json::Number::from(0))
        );
        assert!(payload.get("oauthPoolError").is_none());
    }

    #[tokio::test]
    async fn readiness_reports_oauth_pool_bootstrap_fallback_error() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        let missing_parent = format!(
            "/tmp/code-runtime-oauth-missing-parent-{}",
            uuid::Uuid::new_v4()
        );
        config.oauth_pool_db_path = format!("{missing_parent}/oauth-pool.db");
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        let oauth_pool_error = payload["oauthPoolError"]
            .as_str()
            .expect("oauth pool bootstrap fallback error");
        assert!(oauth_pool_error.contains("Falling back to in-memory oauth pool."));
        assert_eq!(
            payload["oauthPool"]["poolsTotal"],
            Value::Number(serde_json::Number::from(3))
        );
    }

    #[tokio::test]
    async fn readiness_reports_oauth_pool_secret_key_fallback_without_key() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        config.oauth_secret_key = Some("invalid-base64-secret".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");

        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        let oauth_pool_error = payload["oauthPoolError"]
            .as_str()
            .expect("oauth pool fallback error");
        assert!(oauth_pool_error.contains("without secret key"));
        assert_eq!(
            payload["oauthPool"]["oauthSecretKeyConfigured"],
            Value::Bool(false)
        );
    }

    #[tokio::test]
    async fn readiness_reports_compat_model_catalog_failure_cache_entries() {
        let (compat_base_url, _models_counter, compat_handle) =
            spawn_openai_compat_models_error_server(Some("compat-test-key")).await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);

        let models_pool_payload = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;
        assert_eq!(models_pool_payload["ok"], Value::Bool(true));

        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(1))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogFetchFailuresTotal"],
            Value::Number(serde_json::Number::from(1))
        );
        assert_eq!(
            payload["runtimeDiagnostics"]["compatModelCatalogErrorCooldownHitsTotal"],
            Value::Number(serde_json::Number::from(0))
        );

        compat_handle.abort();
    }

    #[tokio::test]
    async fn readiness_prunes_expired_compat_model_catalog_failure_cache_entries() {
        let (compat_base_url, _models_counter, compat_handle) =
            spawn_openai_compat_models_error_server(Some("compat-test-key")).await;
        let mut config = test_service_config_with_openai_compat(compat_base_url.as_str());
        config.openai_api_key = Some("test-key".to_string());
        let app = test_router_with_config(config);

        let _ = send_rpc_request(
            app.clone(),
            json!({"method":"code_models_pool","params":{}}),
        )
        .await;

        let ready_before = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request before prune");
        let response_before = app
            .clone()
            .oneshot(ready_before)
            .await
            .expect("ready response before prune");
        let bytes_before = axum::body::to_bytes(response_before.into_body(), 1024 * 1024)
            .await
            .expect("read ready body before prune");
        let payload_before: Value =
            serde_json::from_slice(&bytes_before).expect("parse ready payload before prune");
        assert_eq!(
            payload_before["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(1))
        );

        tokio::time::sleep(Duration::from_millis(
            OPENAI_COMPAT_MODEL_CATALOG_ERROR_COOLDOWN_MS + 50,
        ))
        .await;

        let ready_after = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request after prune");
        let response_after = app
            .oneshot(ready_after)
            .await
            .expect("ready response after prune");
        let bytes_after = axum::body::to_bytes(response_after.into_body(), 1024 * 1024)
            .await
            .expect("read ready body after prune");
        let payload_after: Value =
            serde_json::from_slice(&bytes_after).expect("parse ready payload after prune");
        assert_eq!(
            payload_after["runtimeDiagnostics"]["compatModelCatalogFailureCacheEntries"],
            Value::Number(serde_json::Number::from(0))
        );

        compat_handle.abort();
    }

    #[tokio::test]
    async fn turn_send_oauth_routing_failure_updates_runtime_diagnostics() {
        let app = test_router();
        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-routing-failure-metrics",
                      "content":"Ping routing diagnostics",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");

        let turn_response = app
            .clone()
            .oneshot(turn_request)
            .await
            .expect("turn response");
        assert_eq!(turn_response.status(), StatusCode::OK);

        let ready_request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let ready_response = app.oneshot(ready_request).await.expect("ready response");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let ready_payload: Value = serde_json::from_slice(&ready_bytes).expect("parse ready json");

        let failures_total = ready_payload["runtimeDiagnostics"]["oauthRoutingFailuresTotal"]
            .as_u64()
            .unwrap_or(0);
        let pool_exhausted_total = ready_payload["runtimeDiagnostics"]
            ["oauthRoutingPoolExhaustedTotal"]
            .as_u64()
            .unwrap_or(0);
        assert!(failures_total >= 1);
        assert!(pool_exhausted_total >= 1);
    }

    #[tokio::test]
    async fn turn_send_oauth_auth_missing_updates_runtime_diagnostics() {
        let app = test_router();
        let upsert_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_account_upsert",
                  "params":{
                    "accountId":"codex-auth-missing-service",
                    "provider":"codex",
                    "metadata":{}
                  }
                }"#,
            ))
            .expect("build upsert request");
        let upsert_response = app
            .clone()
            .oneshot(upsert_request)
            .await
            .expect("upsert response");
        assert_eq!(upsert_response.status(), StatusCode::OK);

        let replace_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_oauth_pool_members_replace",
                  "params":{
                    "poolId":"pool-codex",
                    "members":[{"accountId":"codex-auth-missing-service","weight":1,"priority":0,"position":0,"enabled":true}]
                  }
                }"#,
            ))
            .expect("build members replace request");
        let replace_response = app
            .clone()
            .oneshot(replace_request)
            .await
            .expect("members replace response");
        assert_eq!(replace_response.status(), StatusCode::OK);

        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-auth-missing-metrics",
                      "content":"Ping auth missing diagnostics",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");
        let turn_response = app
            .clone()
            .oneshot(turn_request)
            .await
            .expect("turn response");
        assert_eq!(turn_response.status(), StatusCode::OK);

        let ready_request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let ready_response = app.oneshot(ready_request).await.expect("ready response");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let ready_payload: Value = serde_json::from_slice(&ready_bytes).expect("parse ready json");
        assert!(
            ready_payload["runtimeDiagnostics"]["oauthRoutingAuthMissingTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );
    }

    #[tokio::test]
    async fn turn_send_oauth_decrypt_failed_updates_runtime_diagnostics() {
        const WRONG_SECRET_KEY_B64: &str = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";
        let db_path = temp_sqlite_db_path("code-runtime-oauth-decrypt-failed");
        let db_path_string = db_path.to_string_lossy().to_string();
        let seeded_store = OAuthPoolStore::open(
            db_path_string.as_str(),
            Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="),
        )
        .expect("open seed oauth store");
        seeded_store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: "codex-decrypt-failed-service".to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some("Codex Decrypt Failed".to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey":"decrypt-failed-key"
                })),
            })
            .expect("seed oauth account");
        seeded_store
            .replace_pool_members(
                "pool-codex",
                &[OAuthPoolMemberInput {
                    account_id: "codex-decrypt-failed-service".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                }],
            )
            .expect("seed pool members");
        drop(seeded_store);

        let mut config = test_service_config();
        config.oauth_pool_db_path = db_path_string;
        config.oauth_secret_key = Some(WRONG_SECRET_KEY_B64.to_string());
        let app = test_router_with_config(config);

        let turn_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                r#"{
                  "method":"code_turn_send",
                  "params":{
                    "payload":{
                      "workspaceId":"workspace-web",
                      "threadId":"thread-decrypt-failed-metrics",
                      "content":"Ping decrypt failed diagnostics",
                      "provider":"openai",
                      "reasonEffort":"high",
                      "accessMode":"on-request",
                      "executionMode": "runtime",
                      "queue": false,
                      "attachments":[]
                    }
                  }
                }"#,
            ))
            .expect("build turn request");
        let turn_response = app
            .clone()
            .oneshot(turn_request)
            .await
            .expect("turn response");
        assert_eq!(turn_response.status(), StatusCode::OK);

        let ready_request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let ready_response = app.oneshot(ready_request).await.expect("ready response");
        let ready_bytes = axum::body::to_bytes(ready_response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let ready_payload: Value = serde_json::from_slice(&ready_bytes).expect("parse ready json");
        assert!(
            ready_payload["runtimeDiagnostics"]["oauthRoutingDecryptFailedTotal"]
                .as_u64()
                .unwrap_or(0)
                >= 1
        );

        cleanup_sqlite_db(db_path.as_path());
    }

    #[test]
    fn validate_service_config_reports_endpoint_errors_without_provider_key_warnings() {
        let mut config = test_service_config();
        config.openai_endpoint = "not-a-url".to_string();

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
    }

    #[test]
    fn validate_service_config_oauth_first_mode_avoids_startup_provider_warnings() {
        let mut config = test_service_config();
        config.default_model_id = DEFAULT_GEMINI_MODEL_ID.to_string();

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("ANTHROPIC_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("GEMINI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("Default model provider is not fully configured")));
    }

    #[test]
    fn validate_service_config_compat_mode_avoids_provider_key_warnings() {
        let mut config = test_service_config_with_openai_compat("http://127.0.0.1:8045/v1");
        config.default_model_id = "claude-sonnet-4-5".to_string();
        config.anthropic_api_key = None;
        config.gemini_api_key = None;
        config.openai_api_key = None;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("ANTHROPIC_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("GEMINI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("Default model provider is not fully configured")));
    }

    #[test]
    fn validate_service_config_compat_oauth_only_avoids_provider_and_compat_warnings() {
        let mut config =
            test_service_config_with_openai_compat_oauth_only("http://127.0.0.1:8045/v1");
        config.default_model_id = "claude-sonnet-4-5".to_string();

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OPENAI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("ANTHROPIC_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("GEMINI_API_KEY")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("OpenAI-compat mode is enabled but no compatible API key is configured")));
        assert!(!validation
            .warnings
            .iter()
            .any(|entry| entry.contains("Default model provider is not fully configured")));
    }

    #[test]
    fn validate_service_config_warns_for_zero_openai_timeout_and_retry_base() {
        let mut config = test_service_config();
        config.openai_timeout_ms = 0;
        config.openai_retry_base_ms = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_TIMEOUT_MS")));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_RETRY_BASE_MS")));
    }

    #[test]
    fn validate_service_config_warns_for_invalid_ws_transport_limits() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = 0;
        config.ws_max_write_buffer_size_bytes = 0;
        config.ws_max_frame_size_bytes = 0;
        config.ws_max_message_size_bytes = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_WS_WRITE_BUFFER_SIZE_BYTES") }));
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES")
        }));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES") }));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES") }));
    }

    #[test]
    fn validate_service_config_warns_for_inconsistent_ws_transport_limits() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = 128 * 1024;
        config.ws_max_write_buffer_size_bytes = 64 * 1024;
        config.ws_max_frame_size_bytes = 2 * 1024 * 1024;
        config.ws_max_message_size_bytes = 1 * 1024 * 1024;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES")
                && entry.contains("backpressure headroom")
        }));
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES")
                && entry.contains("protocol consistency")
        }));
    }

    #[test]
    fn validate_service_config_warns_for_oversized_ws_transport_limits() {
        let mut config = test_service_config();
        config.ws_max_write_buffer_size_bytes = MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD + 1;
        config.ws_max_frame_size_bytes = MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD + 1;
        config.ws_max_message_size_bytes = MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD + 1;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_WRITE_BUFFER_SIZE_BYTES")));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_FRAME_SIZE_BYTES")));
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_MESSAGE_SIZE_BYTES")));
    }

    #[test]
    fn validate_service_config_warns_for_invalid_ws_connection_limit() {
        let mut config = test_service_config();
        config.ws_max_connections = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS")));
    }

    #[test]
    fn validate_service_config_warns_for_oversized_ws_connection_limit() {
        let mut config = test_service_config();
        config.ws_max_connections = MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD + 1;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_WS_MAX_CONNECTIONS")));
    }

    #[test]
    fn resolve_ws_transport_limits_clamps_invalid_values() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = 0;
        config.ws_max_write_buffer_size_bytes = 0;
        config.ws_max_frame_size_bytes = 0;
        config.ws_max_message_size_bytes = 0;

        let limits = resolve_ws_transport_limits(&config);
        assert_eq!(limits.write_buffer_size_bytes, 1);
        assert_eq!(limits.max_write_buffer_size_bytes, 2);
        assert_eq!(limits.max_frame_size_bytes, 1);
        assert_eq!(limits.max_message_size_bytes, 1);
    }

    #[test]
    fn resolve_ws_transport_limits_clamps_oversized_values_to_hard_caps() {
        let mut config = test_service_config();
        config.ws_write_buffer_size_bytes = usize::MAX;
        config.ws_max_write_buffer_size_bytes = usize::MAX;
        config.ws_max_frame_size_bytes = usize::MAX;
        config.ws_max_message_size_bytes = usize::MAX;

        let limits = resolve_ws_transport_limits(&config);
        assert_eq!(
            limits.write_buffer_size_bytes,
            MAX_RUNTIME_WS_WRITE_BUFFER_SIZE_BYTES_HARD
        );
        assert_eq!(
            limits.max_write_buffer_size_bytes,
            MAX_RUNTIME_WS_MAX_WRITE_BUFFER_SIZE_BYTES_HARD
        );
        assert_eq!(
            limits.max_frame_size_bytes,
            MAX_RUNTIME_WS_MAX_FRAME_SIZE_BYTES_HARD
        );
        assert_eq!(
            limits.max_message_size_bytes,
            MAX_RUNTIME_WS_MAX_MESSAGE_SIZE_BYTES_HARD
        );
    }

    #[test]
    fn resolve_ws_max_connections_clamps_invalid_values() {
        let mut config = test_service_config();
        config.ws_max_connections = 0;
        assert_eq!(resolve_ws_max_connections(&config), 1);
    }

    #[test]
    fn resolve_ws_max_connections_clamps_oversized_values() {
        let mut config = test_service_config();
        config.ws_max_connections = usize::MAX;
        assert_eq!(
            resolve_ws_max_connections(&config),
            MAX_RUNTIME_WS_MAX_CONNECTIONS_HARD
        );
    }

    #[test]
    fn validate_service_config_warns_for_excessive_openai_retry_budget() {
        let mut config = test_service_config();
        config.openai_max_retries = 12;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OPENAI_MAX_RETRIES")));
    }

    #[test]
    fn validate_service_config_warns_for_zero_openai_compat_model_cache_ttl() {
        let mut config = test_service_config();
        config.openai_compat_model_cache_ttl_ms = 0;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS")
        }));
    }

    #[test]
    fn validate_service_config_warns_for_low_openai_compat_model_cache_ttl() {
        let mut config = test_service_config();
        config.openai_compat_model_cache_ttl_ms =
            MIN_RECOMMENDED_OPENAI_COMPAT_MODEL_CACHE_TTL_MS - 1;

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OPENAI_COMPAT_MODEL_CACHE_TTL_MS")
                && entry.contains("routing jitter")
        }));
    }

    #[test]
    fn openai_http_timeout_clamps_zero_to_one_millisecond() {
        let mut config = test_service_config();
        config.openai_timeout_ms = 0;
        assert_eq!(openai_http_timeout(&config), Duration::from_millis(1));
    }

    #[test]
    fn openai_http_timeout_preserves_positive_timeout() {
        let mut config = test_service_config();
        config.openai_timeout_ms = 2_500;
        assert_eq!(openai_http_timeout(&config), Duration::from_millis(2_500));
    }

    #[test]
    fn validate_service_config_accepts_complete_valid_configuration() {
        let mut config = test_service_config();
        config.openai_api_key = Some("test-key".to_string());
        config.anthropic_api_key = Some("test-key".to_string());
        config.gemini_api_key = Some("test-key".to_string());

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.is_empty());
    }

    #[test]
    fn validate_service_config_warns_for_missing_oauth_pool_parent_directory() {
        let mut config = test_service_config();
        config.oauth_pool_db_path = format!(
            "{}/missing-parent-{}/oauth-pool.db",
            std::env::temp_dir().display(),
            rand::random::<u64>()
        );

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation
            .warnings
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_OAUTH_POOL_DB parent directory")));
    }

    #[test]
    fn validate_service_config_warns_for_invalid_oauth_secret_key() {
        let mut config = test_service_config();
        config.oauth_secret_key = Some("invalid-base64-secret".to_string());

        let validation = validate_service_config(&config);
        assert!(validation.errors.is_empty());
        assert!(validation.warnings.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is invalid")
                && entry.contains("fall back without secret key")
        }));
    }

    #[test]
    fn validate_service_config_rejects_invalid_oauth_public_base_url() {
        let mut config = test_service_config();
        config.oauth_public_base_url = Some("://bad-url".to_string());

        let validation = validate_service_config(&config);
        assert!(validation.errors.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL is invalid")
        }));
    }

    #[test]
    fn validate_service_config_rejects_zero_agent_concurrency_limit() {
        let mut config = test_service_config();
        config.agent_max_concurrent_tasks = 0;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS") }));
    }

    #[test]
    fn validate_service_config_rejects_agent_concurrency_limit_above_maximum() {
        let mut config = test_service_config();
        config.agent_max_concurrent_tasks = MAX_AGENT_MAX_CONCURRENT_TASKS + 1;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS") }));
    }

    #[test]
    fn validate_service_config_rejects_zero_agent_task_history_limit() {
        let mut config = test_service_config();
        config.agent_task_history_limit = 0;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT") }));
    }

    #[test]
    fn validate_service_config_rejects_agent_task_history_limit_above_maximum() {
        let mut config = test_service_config();
        config.agent_task_history_limit = MAX_AGENT_TASK_HISTORY_LIMIT + 1;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| { entry.contains("CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT") }));
    }

    #[test]
    fn validate_service_config_rejects_agent_history_limit_below_concurrency_limit() {
        let mut config = test_service_config();
        config.agent_max_concurrent_tasks = 16;
        config.agent_task_history_limit = 8;

        let validation = validate_service_config(&config);
        assert!(validation.errors.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_AGENT_TASK_HISTORY_LIMIT")
                && entry.contains("CODE_RUNTIME_SERVICE_AGENT_MAX_CONCURRENT_TASKS")
        }));
    }

    #[tokio::test]
    async fn readiness_includes_distributed_snapshot_defaults() {
        let app = test_router();
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(payload["distributed"]["enabled"], Value::Bool(false));
        assert_eq!(payload["distributed"]["redisConnected"], Value::Bool(true));
        assert_eq!(
            payload["distributed"]["invalidCommandEntries"],
            Value::Number(0.into())
        );
    }

    #[tokio::test]
    async fn readiness_reports_distributed_mode_when_enabled() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        config.distributed_redis_url = Some("redis://127.0.0.1:1/0".to_string());
        let app = test_router_with_config(config);
        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(payload["distributed"]["enabled"], Value::Bool(true));
        assert_eq!(payload["distributed"]["redisConnected"], Value::Bool(false));
        assert_eq!(
            payload["distributed"]["invalidCommandEntries"],
            Value::Number(0.into())
        );
    }

    #[tokio::test]
    async fn readiness_reports_backend_pool_observability_counters() {
        let app = test_router();
        for (backend_id, status) in [
            ("worker-active", "active"),
            ("worker-draining", "draining"),
            ("worker-disabled", "disabled"),
        ] {
            let payload = send_rpc_request(
                app.clone(),
                json!({
                    "method": "code_runtime_backend_upsert",
                    "params": {
                        "backendId": backend_id,
                        "displayName": backend_id,
                        "capabilities": ["code"],
                        "maxConcurrency": 4,
                        "costTier": "standard",
                        "latencyClass": "regional",
                        "rolloutState": "current",
                        "status": status
                    }
                }),
            )
            .await;
            assert_eq!(payload["ok"], Value::Bool(true));
        }

        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        assert_eq!(payload["distributed"]["backendsTotal"], Value::Number(3.into()));
        assert_eq!(
            payload["distributed"]["backendsHealthy"],
            Value::Number(1.into())
        );
        assert_eq!(
            payload["distributed"]["backendsDraining"],
            Value::Number(1.into())
        );
        assert_eq!(
            payload["distributed"]["placementFailuresTotal"],
            Value::Number(0.into())
        );
    }

    #[tokio::test]
    async fn readiness_tracks_backend_placement_failures_total() {
        let app = test_router();
        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": "workspace-web",
                    "executionMode": "distributed",
                    "requiredCapabilities": ["code"],
                    "steps": [
                        { "kind": "read", "input": "trigger distributed placement failure" }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(false));
        assert_eq!(
            start_payload["error"]["code"],
            Value::String("INVALID_PARAMS".to_string())
        );

        let request = Request::builder()
            .method("GET")
            .uri("/ready")
            .body(Body::empty())
            .expect("build ready request");
        let response = app.oneshot(request).await.expect("ready response");
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read ready body");
        let payload: Value = serde_json::from_slice(&bytes).expect("parse ready payload");
        let failures_total = payload["distributed"]["placementFailuresTotal"]
            .as_u64()
            .unwrap_or(0);
        assert!(failures_total >= 1);
    }

    #[tokio::test]
    async fn readiness_aggregates_distributed_dispatch_errors_by_source() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        let temp_dir = tempfile::tempdir().expect("temp native state dir");
        let native_state_store = Arc::new(crate::native_state_store::NativeStateStore::new(
            temp_dir.path().join("native-state.sqlite"),
        ));
        let ctx = build_app_context(
            create_initial_state("gpt-5.3-codex"),
            config,
            native_state_store,
        );

        set_distributed_dispatch_error(
            &ctx,
            DISTRIBUTED_ERROR_SOURCE_STATE_SYNC,
            "failed to persist distributed task summary",
        )
        .await;
        set_distributed_dispatch_error(
            &ctx,
            DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP,
            "failed to construct redis bootstrap client",
        )
        .await;

        let snapshot = build_cached_distributed_readiness_snapshot(&ctx).await;
        let dispatch_error = snapshot
            .last_dispatch_error
            .as_deref()
            .expect("dispatch error");
        let bootstrap_index = dispatch_error
            .find("bootstrap:")
            .expect("bootstrap source present");
        let state_sync_index = dispatch_error
            .find("state-sync:")
            .expect("state-sync source present");
        assert!(dispatch_error.contains(" | "));
        assert!(bootstrap_index < state_sync_index);
    }

    #[test]
    fn compute_pending_task_metrics_ignores_terminal_states() {
        let now = 20_000u64;
        let (pending, oldest) = compute_pending_task_metrics(
            [
                ("queued", 10_000u64),
                ("running", 11_000u64),
                ("awaiting_approval", 12_000u64),
                ("completed", 1_000u64),
                ("failed", 2_000u64),
                ("cancelled", 3_000u64),
                ("interrupted", 4_000u64),
            ],
            now,
        );
        assert_eq!(pending, 3);
        assert_eq!(oldest, Some(10_000));
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_keeps_short_message() {
        let message = "enqueue: upstream timeout".to_string();
        let normalized = normalize_distributed_dispatch_error_message(message.clone());
        assert_eq!(normalized, message);
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_truncates_oversized_message() {
        let message = "x".repeat(MAX_DISTRIBUTED_DISPATCH_ERROR_CHARS + 128);
        let normalized = normalize_distributed_dispatch_error_message(message);
        assert_eq!(
            normalized.chars().count(),
            MAX_DISTRIBUTED_DISPATCH_ERROR_CHARS
        );
        assert!(normalized.ends_with('\u{2026}'));
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_collapses_whitespace() {
        let message = " enqueue:\n\tupstream   timeout \r\n".to_string();
        let normalized = normalize_distributed_dispatch_error_message(message);
        assert_eq!(normalized, "enqueue: upstream timeout");
    }

    #[test]
    fn normalize_distributed_dispatch_error_message_falls_back_for_empty_input() {
        let message = " \n\t\r ".to_string();
        let normalized = normalize_distributed_dispatch_error_message(message);
        assert_eq!(normalized, "unknown distributed dispatch error");
    }

    #[test]
    fn truncate_chars_with_ellipsis_handles_small_limits() {
        assert_eq!(truncate_chars_with_ellipsis("abc", 0), "");
        assert_eq!(truncate_chars_with_ellipsis("abc", 1), "\u{2026}");
        assert_eq!(truncate_chars_with_ellipsis("abc", 2), format!("a{}", '\u{2026}'));
    }

    #[test]
    fn truncate_chars_with_ellipsis_keeps_short_strings() {
        assert_eq!(truncate_chars_with_ellipsis("abc", 8), "abc");
    }

    #[test]
    fn normalize_distributed_dispatch_error_source_keeps_known_sources() {
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP),
            DISTRIBUTED_ERROR_SOURCE_BOOTSTRAP
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_STATE_SYNC),
            DISTRIBUTED_ERROR_SOURCE_STATE_SYNC
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY),
            DISTRIBUTED_ERROR_SOURCE_BACKEND_REGISTRY
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_WORKER),
            DISTRIBUTED_ERROR_SOURCE_WORKER
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_DISCOVERY),
            DISTRIBUTED_ERROR_SOURCE_DISCOVERY
        );
        assert_eq!(
            normalize_distributed_dispatch_error_source(DISTRIBUTED_ERROR_SOURCE_ENQUEUE),
            DISTRIBUTED_ERROR_SOURCE_ENQUEUE
        );
    }

    #[test]
    fn normalize_distributed_dispatch_error_source_maps_unknown_to_bucket() {
        assert_eq!(
            normalize_distributed_dispatch_error_source("dynamic-source"),
            DISTRIBUTED_ERROR_SOURCE_UNKNOWN
        );
    }

    #[test]
    fn resolve_cached_distributed_readiness_snapshot_hits_within_ttl() {
        let now = Instant::now();
        let snapshot = distributed::diagnostics::DistributedReadinessSnapshot {
            enabled: true,
            redis_connected: false,
            lane_count: 2,
            worker_count: 4,
            backends_total: 6,
            backends_healthy: 5,
            backends_draining: 1,
            placement_failures_total: 3,
            pending_entries: 9,
            invalid_command_entries: 2,
            oldest_pending_ms: Some(1200),
            last_dispatch_error: Some("worker: timeout".to_string()),
        };
        let cached = CachedDistributedReadinessSnapshot {
            snapshot: snapshot.clone(),
            fetched_at: now - Duration::from_millis(300),
        };

        let resolved = resolve_cached_distributed_readiness_snapshot(Some(&cached), now)
            .expect("snapshot should be served from cache");
        assert_eq!(resolved.enabled, snapshot.enabled);
        assert_eq!(resolved.pending_entries, snapshot.pending_entries);
        assert_eq!(
            resolved.last_dispatch_error.as_deref(),
            snapshot.last_dispatch_error.as_deref()
        );
    }

    #[test]
    fn resolve_cached_distributed_readiness_snapshot_expires_after_ttl() {
        let now = Instant::now();
        let cached = CachedDistributedReadinessSnapshot {
            snapshot: distributed::diagnostics::DistributedReadinessSnapshot {
                enabled: true,
                redis_connected: true,
                lane_count: 1,
                worker_count: 1,
                backends_total: 1,
                backends_healthy: 1,
                backends_draining: 0,
                placement_failures_total: 0,
                pending_entries: 1,
                invalid_command_entries: 0,
                oldest_pending_ms: Some(10),
                last_dispatch_error: None,
            },
            fetched_at: now - Duration::from_millis(700),
        };

        assert!(resolve_cached_distributed_readiness_snapshot(Some(&cached), now).is_none());
    }

    #[test]
    fn merge_optional_errors_combines_inputs() {
        assert_eq!(merge_optional_errors(None, None), None);
        assert_eq!(
            merge_optional_errors(Some("first"), None),
            Some("first".to_string())
        );
        assert_eq!(
            merge_optional_errors(None, Some("second")),
            Some("second".to_string())
        );
        assert_eq!(
            merge_optional_errors(Some("first"), Some("second")),
            Some("first | second".to_string())
        );
    }

    #[test]
    fn initialize_oauth_pool_fails_closed_without_panic_when_all_backends_fail() {
        let config = test_service_config();
        let (store, bootstrap_error) =
            initialize_oauth_pool_with_opener(&config, |_path, _secret_key| {
                Err("forced oauth bootstrap failure".to_string())
            });
        let bootstrap_error = bootstrap_error.expect("bootstrap error should be present");
        assert!(bootstrap_error.contains("forced oauth bootstrap failure"));

        let diagnostics_error = store
            .diagnostics()
            .expect_err("unavailable oauth pool should fail closed");
        assert!(diagnostics_error.contains("OAuth pool store unavailable"));
        assert!(diagnostics_error.contains("forced oauth bootstrap failure"));
    }

    #[test]
    fn distributed_enqueue_mode_uses_strict_for_start_and_unknown_kinds() {
        assert_eq!(
            distributed_enqueue_mode_for_kind(distributed::queue::COMMAND_KIND_TASK_START),
            DistributedCommandEnqueueMode::Strict
        );
        assert_eq!(
            distributed_enqueue_mode_for_kind("task.unknown"),
            DistributedCommandEnqueueMode::Strict
        );
    }

    #[test]
    fn distributed_enqueue_mode_uses_best_effort_for_control_plane_commands() {
        assert_eq!(
            distributed_enqueue_mode_for_kind(distributed::queue::COMMAND_KIND_TASK_INTERRUPT),
            DistributedCommandEnqueueMode::BestEffort
        );
        assert_eq!(
            distributed_enqueue_mode_for_kind(distributed::queue::COMMAND_KIND_APPROVAL_DECISION),
            DistributedCommandEnqueueMode::BestEffort
        );
    }

    #[test]
    fn supported_distributed_command_kind_matches_contract() {
        assert!(is_supported_distributed_command_kind(
            distributed::queue::COMMAND_KIND_TASK_START
        ));
        assert!(is_supported_distributed_command_kind(
            distributed::queue::COMMAND_KIND_TASK_INTERRUPT
        ));
        assert!(is_supported_distributed_command_kind(
            distributed::queue::COMMAND_KIND_APPROVAL_DECISION
        ));
        assert!(!is_supported_distributed_command_kind("task.unknown"));
    }

    #[test]
    fn reclaim_loop_schedule_uses_fixed_interval() {
        assert!(should_reclaim_distributed_pending(0, 0));
        assert!(!should_reclaim_distributed_pending(1, 0));
        assert!(!should_reclaim_distributed_pending(
            DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS.saturating_sub(1),
            0,
        ));
        assert!(should_reclaim_distributed_pending(
            DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS,
            0
        ));
    }

    #[test]
    fn distributed_worker_read_blocking_enabled_for_single_lane() {
        assert_eq!(
            resolve_distributed_worker_read_block_ms(1),
            DISTRIBUTED_WORKER_POLL_INTERVAL_MS
        );
    }

    #[test]
    fn distributed_worker_read_blocking_disabled_for_multi_lane() {
        assert_eq!(resolve_distributed_worker_read_block_ms(0), 0);
        assert_eq!(resolve_distributed_worker_read_block_ms(2), 0);
    }

    #[test]
    fn distributed_worker_idle_polling_sleeps_between_iterations() {
        assert!(should_sleep_after_distributed_worker_iteration(0, false));
    }

    #[test]
    fn distributed_worker_active_polling_yields_without_forced_sleep() {
        assert!(!should_sleep_after_distributed_worker_iteration(0, true));
        assert!(!should_sleep_after_distributed_worker_iteration(
            DISTRIBUTED_WORKER_POLL_INTERVAL_MS,
            true
        ));
    }

    #[test]
    fn reclaim_loop_schedule_staggers_by_worker_index() {
        let interval = DISTRIBUTED_WORKER_RECLAIM_INTERVAL_LOOPS;
        assert!(should_reclaim_distributed_pending(0, 0));
        assert!(should_reclaim_distributed_pending(
            interval.saturating_sub(1),
            1
        ));
        assert!(should_reclaim_distributed_pending(
            interval.saturating_sub(2),
            2
        ));
        assert!(should_reclaim_distributed_pending(interval, 0));
        assert!(should_reclaim_distributed_pending(
            interval.saturating_mul(2),
            0
        ));
    }

    #[tokio::test]
    async fn distributed_task_start_fails_closed_without_redis_client() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        // `redis::Client::open` fails for this value, simulating broken bootstrap.
        config.distributed_redis_url = Some("://invalid-redis-url".to_string());
        let app = test_router_with_config(config);
        let workspace_id = format!("workspace-web-{}", rand::random::<u64>());

        let start_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_start_v2",
                "params": {
                    "workspaceId": workspace_id,
                    "steps": [
                        { "kind": "read", "path": "README.md" }
                    ]
                }
            }),
        )
        .await;
        assert_eq!(start_payload["ok"], Value::Bool(false));
        assert_eq!(
            start_payload["error"]["code"],
            Value::String("INTERNAL_ERROR".to_string())
        );

        let list_payload = send_rpc_request(
            app,
            json!({
                "method": "code_runtime_runs_list",
                "params": { "workspaceId": workspace_id }
            }),
        )
        .await;
        assert_eq!(list_payload["ok"], Value::Bool(true));
        assert_eq!(
            list_payload["result"].as_array().map(|items| items.len()),
            Some(0)
        );
    }

    #[test]
    fn validate_service_config_rejects_distributed_mode_without_redis_url() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        config.distributed_redis_url = None;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_REDIS_URL")));
    }

    #[test]
    fn validate_service_config_rejects_invalid_distributed_limits() {
        let mut config = test_service_config();
        config.distributed_enabled = true;
        config.distributed_redis_url = Some("redis://127.0.0.1:6379/0".to_string());
        config.distributed_lane_count = 0;
        config.distributed_worker_concurrency = 0;
        config.distributed_claim_idle_ms = 0;

        let validation = validate_service_config(&config);
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_LANE_COUNT")));
        assert!(validation.errors.iter().any(|entry| {
            entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_WORKER_CONCURRENCY")
        }));
        assert!(validation
            .errors
            .iter()
            .any(|entry| entry.contains("CODE_RUNTIME_SERVICE_DISTRIBUTED_CLAIM_IDLE_MS")));
    }

    #[test]
    fn parse_local_codex_cli_auth_profile_prefers_openai_api_key_and_extracts_id_token_fields() {
        let id_token_payload = json!({
            "email": "user@example.com",
            "sub": "subject-123",
            "https://api.openai.com/auth": {
                "chatgpt_account_id": "chatgpt-account-123",
                "chatgpt_plan_type": "pro"
            }
        });
        let id_token = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(id_token_payload.to_string())
        );
        let payload = json!({
            "auth_mode": "chatgpt",
            "last_refresh": "2026-02-12T14:35:04.312445Z",
            "OPENAI_API_KEY": "sk-local-key",
            "tokens": {
                "access_token": "access-token-fallback",
                "refresh_token": "refresh-token-1",
                "account_id": "tokens-account-1",
                "id_token": id_token
            }
        });

        let profile = parse_local_codex_cli_auth_profile_from_value(&payload)
            .expect("profile should parse from valid auth payload");
        assert_eq!(
            profile.external_account_id.as_deref(),
            Some("tokens-account-1")
        );
        assert_eq!(profile.email.as_deref(), Some("user@example.com"));
        assert_eq!(profile.auth_mode.as_deref(), Some("chatgpt"));
        assert_eq!(profile.plan_type.as_deref(), Some("pro"));
        assert_eq!(
            profile.last_refresh.as_deref(),
            Some("2026-02-12T14:35:04.312445Z")
        );
        assert_eq!(profile.openai_api_key.as_deref(), Some("sk-local-key"));
        assert!(profile.id_token.as_deref().is_some());
        assert_eq!(
            profile.access_token.as_deref(),
            Some("access-token-fallback")
        );
        assert_eq!(profile.refresh_token.as_deref(), Some("refresh-token-1"));
        assert_eq!(profile.api_credential.as_deref(), Some("sk-local-key"));
        assert_eq!(
            profile.api_credential_source.as_deref(),
            Some("openai_api_key")
        );
    }

    #[test]
    fn parse_local_codex_cli_auth_profile_falls_back_to_access_token() {
        let payload = json!({
            "auth_mode": "chatgpt",
            "OPENAI_API_KEY": null,
            "tokens": {
                "access_token": "access-token-only",
                "refresh_token": "refresh-token-only",
                "account_id": "tokens-account-2"
            }
        });

        let profile = parse_local_codex_cli_auth_profile_from_value(&payload)
            .expect("profile should parse when access token is present");
        assert_eq!(
            profile.external_account_id.as_deref(),
            Some("tokens-account-2")
        );
        assert_eq!(profile.email, None);
        assert_eq!(profile.openai_api_key, None);
        assert_eq!(profile.id_token, None);
        assert_eq!(profile.access_token.as_deref(), Some("access-token-only"));
        assert_eq!(profile.refresh_token.as_deref(), Some("refresh-token-only"));
        assert_eq!(profile.api_credential.as_deref(), Some("access-token-only"));
        assert_eq!(
            profile.api_credential_source.as_deref(),
            Some("access_token")
        );
    }

    #[test]
    fn should_attempt_local_codex_sync_applies_min_interval_throttle() {
        let last_attempt_ms = AtomicU64::new(0);
        assert!(should_attempt_local_codex_sync(
            1_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert!(!should_attempt_local_codex_sync(
            1_001,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert!(!should_attempt_local_codex_sync(
            5_999,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert!(should_attempt_local_codex_sync(
            6_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
    }

    #[test]
    fn should_attempt_local_codex_sync_does_not_advance_timestamp_while_throttled() {
        let last_attempt_ms = AtomicU64::new(10_000);
        assert!(!should_attempt_local_codex_sync(
            10_500,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 10_000);

        assert!(!should_attempt_local_codex_sync(
            14_999,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 10_000);
    }

    #[test]
    fn should_attempt_local_codex_sync_handles_clock_rollback_without_opening_throttle() {
        let last_attempt_ms = AtomicU64::new(20_000);
        assert!(!should_attempt_local_codex_sync(
            19_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 20_000);

        assert!(should_attempt_local_codex_sync(
            25_000,
            &last_attempt_ms,
            LOCAL_CODEX_CLI_SYNC_MIN_INTERVAL_MS,
        ));
        assert_eq!(last_attempt_ms.load(AtomicOrdering::Relaxed), 25_000);
    }

    #[test]
    fn load_local_codex_cli_auth_profile_from_path_invalidates_cache_when_file_changes() {
        let root = std::env::temp_dir().join(format!(
            "code-runtime-local-codex-auth-cache-{}",
            rand::random::<u64>()
        ));
        let codex_dir = root.join(".codex");
        let auth_path = codex_dir.join("auth.json");
        std::fs::create_dir_all(codex_dir.as_path()).expect("create codex auth dir");
        let cache = Mutex::new(LocalCodexCliAuthProfileCache::default());

        std::fs::write(
            auth_path.as_path(),
            r#"{"auth_mode":"chatgpt","OPENAI_API_KEY":"api-key-a","tokens":{"account_id":"account-a"}}"#,
        )
        .expect("write initial auth profile");
        let first = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache)
            .expect("load initial profile");
        assert_eq!(first.api_credential.as_deref(), Some("api-key-a"));
        assert_eq!(first.external_account_id.as_deref(), Some("account-a"));

        let second = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache)
            .expect("reuse cached profile");
        assert_eq!(second.api_credential.as_deref(), Some("api-key-a"));

        std::fs::write(
            auth_path.as_path(),
            r#"{"auth_mode":"chatgpt","OPENAI_API_KEY":"api-key-bb","tokens":{"account_id":"account-bb"}}"#,
        )
        .expect("write updated auth profile");
        let refreshed = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache)
            .expect("reload changed profile");
        assert_eq!(refreshed.api_credential.as_deref(), Some("api-key-bb"));
        assert_eq!(refreshed.external_account_id.as_deref(), Some("account-bb"));

        std::fs::remove_file(auth_path.as_path()).expect("remove auth profile");
        let missing = load_local_codex_cli_auth_profile_from_path(auth_path.as_path(), &cache);
        assert!(missing.is_none());

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn parse_oauth_account_upsert_input_strips_local_cli_reserved_metadata_keys() {
        let params = json!({
            "accountId": LOCAL_CODEX_CLI_ACCOUNT_ID,
            "provider": "codex",
            "metadata": {
                "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                "localCliManaged": true,
                "credentialAvailable": true,
                "credentialSource": "access_token",
                "note": "keep-me"
            }
        });
        let params = params
            .as_object()
            .cloned()
            .expect("params should be object");
        let diagnostics = RuntimeDiagnosticsState::default();

        let input =
            parse_oauth_account_upsert_input(&params, &diagnostics).expect("parse upsert payload");
        let metadata = input
            .metadata
            .as_ref()
            .and_then(Value::as_object)
            .expect("metadata object");
        assert!(metadata.get("source").is_none());
        assert!(metadata.get("localCliManaged").is_none());
        assert!(metadata.get("credentialAvailable").is_none());
        assert!(metadata.get("credentialSource").is_none());
        assert_eq!(
            metadata.get("note"),
            Some(&Value::String("keep-me".to_string()))
        );
    }

    #[test]
    fn runtime_diagnostics_tracks_local_codex_sync_failures() {
        let diagnostics = RuntimeDiagnosticsState::default();
        diagnostics.record_local_codex_sync_failure();
        diagnostics.record_local_codex_sync_failure();

        let snapshot = diagnostics.snapshot();
        assert_eq!(snapshot.local_codex_sync_failures_total, 2);
    }

    #[test]
    fn runtime_diagnostics_tracks_sse_event_stream_lagged_metrics() {
        let diagnostics = RuntimeDiagnosticsState::default();
        diagnostics.record_sse_event_stream_lagged(3);
        diagnostics.record_sse_event_stream_lagged(5);

        let snapshot = diagnostics.snapshot();
        assert_eq!(snapshot.sse_event_stream_lagged_total, 2);
        assert_eq!(snapshot.sse_event_stream_lagged_dropped_total, 8);
    }

    #[test]
    fn sync_local_codex_cli_account_from_profile_upserts_into_codex_pool() {
        let store = OAuthPoolStore::open(
            ":memory:",
            Some("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="),
        )
        .expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account-1".to_string()),
            email: Some("local@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T15:00:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: Some("local-access-token".to_string()),
            refresh_token: None,
            api_credential: Some("local-access-token".to_string()),
            api_credential_source: Some("access_token".to_string()),
        };

        sync_local_codex_cli_account_from_profile(&store, profile)
            .expect("sync local codex account");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("synced local codex account");
        assert_eq!(account.provider, "codex");
        assert_eq!(account.email.as_deref(), Some("local@example.com"));
        assert_eq!(
            account.external_account_id.as_deref(),
            Some("local-account-1")
        );
        assert_eq!(
            account.metadata["source"],
            Value::String(LOCAL_CODEX_CLI_ACCOUNT_SOURCE.to_string())
        );
        assert_eq!(
            account.metadata["planType"],
            Value::String("plus".to_string())
        );
        assert_eq!(
            store
                .resolve_api_key_from_metadata(&account.metadata)
                .expect("resolve api key")
                .as_deref(),
            Some("local-access-token")
        );

        let selected = store
            .select_pool_account(OAuthPoolSelectionInput {
                pool_id: "pool-codex".to_string(),
                session_id: Some("session-local-sync".to_string()),
                workspace_id: None,
                model_id: Some("gpt-5.3-codex".to_string()),
            })
            .expect("select codex pool account")
            .expect("pool selection should return synced account");
        assert_eq!(selected.account.account_id, LOCAL_CODEX_CLI_ACCOUNT_ID);
    }

    #[test]
    fn sync_local_codex_cli_account_without_secret_uses_profile_credential_fallback() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account-no-secret".to_string()),
            email: Some("local-no-secret@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T15:30:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: Some("local-no-secret-token".to_string()),
            refresh_token: None,
            api_credential: Some("local-no-secret-token".to_string()),
            api_credential_source: Some("access_token".to_string()),
        };

        sync_local_codex_cli_account_from_profile(&store, profile.clone())
            .expect("sync local codex account without secret");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("synced local codex account");
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(true));
        assert_eq!(
            account.metadata["credentialSource"],
            Value::String("access_token".to_string())
        );
        assert!(account.metadata.get("apiKey").is_none());
        assert_eq!(
            store
                .resolve_api_key_from_metadata(&account.metadata)
                .expect("resolve api key from metadata"),
            None
        );

        let resolved = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect("resolve oauth key with local profile fallback");
        assert_eq!(resolved.as_deref(), Some("local-no-secret-token"));

        let (selection, miss_reason) = store
            .select_pool_account_with_reason(OAuthPoolSelectionInput {
                pool_id: "pool-codex".to_string(),
                session_id: Some("session-local-no-secret".to_string()),
                workspace_id: None,
                model_id: Some("gpt-5.3-codex".to_string()),
            })
            .expect("select codex pool account with local profile fallback");
        assert_eq!(miss_reason, None);
        let selected = selection.expect("pool selection should keep local codex account routable");
        assert_eq!(selected.account.account_id, LOCAL_CODEX_CLI_ACCOUNT_ID);
    }

    #[test]
    fn sync_local_codex_cli_account_without_profile_disables_unusable_local_account() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
                provider: "codex".to_string(),
                external_account_id: Some("local-account".to_string()),
                email: Some("local@example.com".to_string()),
                display_name: Some("Local Codex CLI".to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                    "localCliManaged": true,
                    "credentialAvailable": true,
                    "credentialSource": "access_token"
                })),
            })
            .expect("seed local codex account");

        sync_local_codex_cli_account_without_profile(&store)
            .expect("reconcile local codex account without profile");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account remains present");
        assert_eq!(account.status, "disabled");
        assert_eq!(
            account.disabled_reason.as_deref(),
            Some(LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING)
        );
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(false));
        assert!(account.metadata.get("credentialSource").is_none());
    }

    #[test]
    fn sync_local_codex_cli_account_without_profile_preserves_manual_disable_reason() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
                provider: "codex".to_string(),
                external_account_id: Some("local-account".to_string()),
                email: Some("local@example.com".to_string()),
                display_name: Some("Local Codex CLI".to_string()),
                status: Some("disabled".to_string()),
                disabled_reason: Some("manual_toggle".to_string()),
                metadata: Some(json!({
                    "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                    "localCliManaged": true,
                    "credentialAvailable": false
                })),
            })
            .expect("seed disabled local codex account");

        sync_local_codex_cli_account_without_profile(&store)
            .expect("reconcile local codex account without profile");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account remains present");
        assert_eq!(account.status, "disabled");
        assert_eq!(account.disabled_reason.as_deref(), Some("manual_toggle"));
    }

    #[test]
    fn sync_local_codex_cli_account_from_profile_reenables_auto_disabled_account() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
                provider: "codex".to_string(),
                external_account_id: Some("local-account".to_string()),
                email: Some("local@example.com".to_string()),
                display_name: Some("Local Codex CLI".to_string()),
                status: Some("disabled".to_string()),
                disabled_reason: Some(LOCAL_CODEX_CLI_DISABLED_REASON_PROFILE_MISSING.to_string()),
                metadata: Some(json!({
                    "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                    "localCliManaged": true,
                    "credentialAvailable": false
                })),
            })
            .expect("seed auto-disabled local codex account");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account".to_string()),
            email: Some("local@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T15:45:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: Some("local-refresh-token".to_string()),
            refresh_token: None,
            api_credential: Some("local-refresh-token".to_string()),
            api_credential_source: Some("access_token".to_string()),
        };

        sync_local_codex_cli_account_from_profile(&store, profile)
            .expect("sync local codex account from profile");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account remains present");
        assert_eq!(account.status, "enabled");
        assert_eq!(account.disabled_reason, None);
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(true));
    }

    #[test]
    fn sync_local_codex_cli_account_from_profile_disables_when_credential_missing() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            external_account_id: Some("local-account".to_string()),
            email: Some("local@example.com".to_string()),
            auth_mode: Some("chatgpt".to_string()),
            plan_type: Some("plus".to_string()),
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            last_refresh: Some("2026-02-12T16:00:00.000Z".to_string()),
            id_token: None,
            openai_api_key: None,
            access_token: None,
            refresh_token: None,
            api_credential: None,
            api_credential_source: None,
        };

        sync_local_codex_cli_account_from_profile(&store, profile)
            .expect("sync local codex account without credential");

        let account = store
            .list_accounts(Some("codex"))
            .expect("list codex accounts")
            .into_iter()
            .find(|entry| entry.account_id == LOCAL_CODEX_CLI_ACCOUNT_ID)
            .expect("local codex account exists");
        assert_eq!(account.status, "disabled");
        assert_eq!(
            account.disabled_reason.as_deref(),
            Some(LOCAL_CODEX_CLI_DISABLED_REASON_CREDENTIAL_MISSING)
        );
        assert_eq!(account.metadata["credentialAvailable"], Value::Bool(false));
    }

    #[test]
    fn resolve_oauth_api_key_for_local_codex_account_recovers_from_decrypt_error_with_profile_fallback(
    ) {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            api_credential: Some("local-fallback-token".to_string()),
            ..Default::default()
        };
        let account = oauth_pool::OAuthAccountSummary {
            account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Local Codex CLI".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
                "localCliManaged": true,
                "apiKeyEncryptedV1": "tampered-ciphertext"
            }),
            created_at: 0,
            updated_at: 0,
        };

        let resolved = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect("fallback should recover from decrypt error");
        assert_eq!(resolved.as_deref(), Some("local-fallback-token"));
    }

    #[test]
    fn resolve_oauth_api_key_for_non_local_account_keeps_decrypt_error() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            api_credential: Some("local-fallback-token".to_string()),
            ..Default::default()
        };
        let account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-non-local".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Non Local".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": "manual",
                "apiKeyEncryptedV1": "tampered-ciphertext"
            }),
            created_at: 0,
            updated_at: 0,
        };

        let error = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect_err("non-local account should preserve decrypt error");
        assert!(error.contains("CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY"));
    }

    #[test]
    fn resolve_oauth_api_key_for_reserved_id_without_local_markers_does_not_fallback() {
        let store = OAuthPoolStore::open(":memory:", None).expect("open oauth pool store");
        let profile = LocalCodexCliAuthProfile {
            api_credential: Some("local-fallback-token".to_string()),
            ..Default::default()
        };
        let account = oauth_pool::OAuthAccountSummary {
            account_id: LOCAL_CODEX_CLI_ACCOUNT_ID.to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Local Codex CLI".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": "manual"
            }),
            created_at: 0,
            updated_at: 0,
        };

        let resolved = resolve_oauth_api_key_for_account(&store, &account, Some(&profile))
            .expect("non-managed local id should not fail resolution");
        assert_eq!(resolved, None);
    }

    #[test]
    fn redact_oauth_account_metadata_marks_local_cli_credential_as_configured() {
        let metadata = json!({
            "source": LOCAL_CODEX_CLI_ACCOUNT_SOURCE,
            "localCliManaged": true,
            "credentialAvailable": true,
            "credentialSource": "access_token",
            "note": "visible"
        });

        let redacted = redact_oauth_account_metadata(&metadata);
        assert_eq!(redacted["apiKeyConfigured"], Value::Bool(true));
        assert_eq!(
            redacted["source"],
            Value::String(LOCAL_CODEX_CLI_ACCOUNT_SOURCE.to_string())
        );
        assert_eq!(redacted["localCliManaged"], Value::Bool(true));
        assert_eq!(redacted["credentialAvailable"], Value::Bool(true));
        assert_eq!(
            redacted["credentialSource"],
            Value::String("access_token".to_string())
        );
        assert_eq!(redacted["note"], Value::String("visible".to_string()));
        assert!(redacted["apiKey"].is_null());
        assert!(redacted["api_key"].is_null());
    }

    #[test]
    fn redact_oauth_account_metadata_marks_refresh_token_available() {
        let metadata = json!({
            "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
            "refreshToken": "refresh-token-secret",
            "refreshTokenEncryptedV1": "v1:test:test",
            "note": "visible"
        });

        let redacted = redact_oauth_account_metadata(&metadata);
        assert_eq!(redacted["refreshTokenAvailable"], Value::Bool(true));
        assert_eq!(redacted["note"], Value::String("visible".to_string()));
        assert!(redacted["refreshToken"].is_null());
        assert!(redacted["refresh_token"].is_null());
        assert!(redacted["refreshTokenEncryptedV1"].is_null());
    }

    #[test]
    fn should_refresh_service_codex_oauth_usage_checks_staleness() {
        let stale_account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-service-stale".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: None,
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 1_000
            }),
            created_at: 0,
            updated_at: 0,
        };
        let fresh_account = oauth_pool::OAuthAccountSummary {
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 100_000
            }),
            ..stale_account.clone()
        };
        let manual_account = oauth_pool::OAuthAccountSummary {
            metadata: json!({
                "source": "manual",
                "usageCheckedAt": 1_000
            }),
            ..stale_account.clone()
        };

        assert!(should_refresh_service_codex_oauth_usage(
            &stale_account,
            1_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS + 1
        ));
        assert!(!should_refresh_service_codex_oauth_usage(
            &fresh_account,
            100_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS - 1
        ));
        assert!(!should_refresh_service_codex_oauth_usage(
            &manual_account,
            1_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS + 1
        ));
    }

    #[test]
    fn select_service_codex_usage_refresh_accounts_auto_skips_backoffed_account() {
        let base_account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-service-a".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: None,
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 1_000
            }),
            created_at: 0,
            updated_at: 0,
        };
        let account_b = oauth_pool::OAuthAccountSummary {
            account_id: "codex-service-b".to_string(),
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": 2_000
            }),
            ..base_account.clone()
        };
        let now = 2_000 + SERVICE_CODEX_USAGE_STALE_AFTER_MS + 1;
        let mut attempts = HashMap::new();
        attempts.insert(
            "codex-service-a".to_string(),
            now.saturating_sub(SERVICE_CODEX_USAGE_REFRESH_RETRY_BACKOFF_MS - 1),
        );

        let selected = select_service_codex_usage_refresh_accounts(
            &[base_account, account_b.clone()],
            now,
            ServiceCodexUsageRefreshMode::Auto,
            &mut attempts,
        );

        assert_eq!(selected.len(), 1);
        assert_eq!(selected[0].account_id, "codex-service-b");
        assert_eq!(attempts.get("codex-service-b"), Some(&now));
    }

    #[test]
    fn select_service_codex_usage_refresh_accounts_force_refreshes_multiple_accounts() {
        let make_account = |id: &str, checked_at: u64| oauth_pool::OAuthAccountSummary {
            account_id: id.to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: None,
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: None,
            default_chatgpt_workspace_id: None,
            metadata: json!({
                "source": SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE,
                "usageCheckedAt": checked_at
            }),
            created_at: 0,
            updated_at: 0,
        };
        let now = 200_000;
        let mut attempts = HashMap::new();
        let selected = select_service_codex_usage_refresh_accounts(
            &[
                make_account("codex-service-a", 10_000),
                make_account("codex-service-b", 20_000),
                make_account("codex-service-c", 30_000),
                make_account("codex-service-d", 40_000),
            ],
            now,
            ServiceCodexUsageRefreshMode::Force,
            &mut attempts,
        );

        assert_eq!(selected.len(), SERVICE_CODEX_USAGE_FORCE_REFRESH_MAX_ACCOUNTS);
        assert_eq!(selected[0].account_id, "codex-service-a");
        assert_eq!(selected[1].account_id, "codex-service-b");
        assert_eq!(selected[2].account_id, "codex-service-c");
        assert_eq!(attempts.get("codex-service-a"), Some(&now));
        assert_eq!(attempts.get("codex-service-b"), Some(&now));
        assert_eq!(attempts.get("codex-service-c"), Some(&now));
    }

    #[test]
    fn classify_oauth_api_key_resolution_error_maps_reason_codes() {
        assert_eq!(
            classify_oauth_api_key_resolution_error(
                "Decrypt oauth api key: authentication failure"
            ),
            "decrypt_failed"
        );
        assert_eq!(
            classify_oauth_api_key_resolution_error(
                "Encrypted OAuth account API keys are present but CODE_RUNTIME_SERVICE_OAUTH_SECRET_KEY is not configured."
            ),
            "decrypt_failed"
        );
        assert_eq!(
            classify_oauth_api_key_resolution_error("metadata `apiKey` must be a string"),
            "auth_missing"
        );
    }

    #[test]
    fn parse_chatgpt_account_profile_from_payload_prefers_matching_external_account_id() {
        let account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-local-cli".to_string(),
            provider: "codex".to_string(),
            external_account_id: Some("account-2".to_string()),
            email: Some("iappsky@gmail.com".to_string()),
            display_name: Some("iappsky@gmail.com".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: Some(vec![oauth_pool::OAuthAccountChatgptWorkspace {
                workspace_id: "org-personal".to_string(),
                title: Some("Personal".to_string()),
                role: Some("owner".to_string()),
                is_default: true,
            }]),
            default_chatgpt_workspace_id: Some("org-personal".to_string()),
            metadata: json!({ "authMode": "chatgpt" }),
            created_at: 0,
            updated_at: 0,
        };
        let payload = json!({
            "accounts": [
                {
                    "id": "account-1",
                    "name": "wrong-workspace",
                    "structure": "workspace"
                },
                {
                    "id": "account-2",
                    "name": "lewiszlewisl1983",
                    "structure": "workspace"
                }
            ],
            "default_account_id": "account-1",
            "account_ordering": ["account-1", "account-2"]
        });

        let parsed = parse_chatgpt_account_profile_from_payload(&payload, &account);

        assert_eq!(
            parsed,
            Some(("lewiszlewisl1983".to_string(), Some("workspace".to_string())))
        );
    }

    #[test]
    fn parse_chatgpt_account_profile_from_payload_falls_back_to_account_ordering() {
        let account = oauth_pool::OAuthAccountSummary {
            account_id: "codex-local-cli".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: Some("iappsky@gmail.com".to_string()),
            display_name: Some("iappsky@gmail.com".to_string()),
            status: "enabled".to_string(),
            disabled_reason: None,
            route_config: None,
            routing_state: None,
            chatgpt_workspaces: Some(vec![oauth_pool::OAuthAccountChatgptWorkspace {
                workspace_id: "org-personal".to_string(),
                title: Some("Personal".to_string()),
                role: Some("owner".to_string()),
                is_default: true,
            }]),
            default_chatgpt_workspace_id: Some("org-personal".to_string()),
            metadata: json!({ "authMode": "chatgpt" }),
            created_at: 0,
            updated_at: 0,
        };
        let payload = json!({
            "accounts": [
                {
                    "id": "account-1",
                    "name": "fallback-workspace",
                    "structure": "workspace"
                },
                {
                    "id": "account-2",
                    "name": "ignored-workspace",
                    "structure": "workspace"
                }
            ],
            "default_account_id": "account-1",
            "account_ordering": ["account-1", "account-2"]
        });

        let parsed = parse_chatgpt_account_profile_from_payload(&payload, &account);

        assert_eq!(
            parsed,
            Some(("fallback-workspace".to_string(), Some("workspace".to_string())))
        );
    }

    #[tokio::test]
    async fn runtime_eval_fixture_research_multi_repo_analysis_executes_and_matches_expectations() {
        let fixture = load_runtime_eval_scenario_fixture("research-multi-repo-analysis");
        assert_eq!(fixture.id, "research-multi-repo-analysis");
        assert_eq!(fixture.policy, "always_passes");
        assert_eq!(fixture.kind, "research_orchestrator");
        assert!(
            fixture
                .description
                .contains("Bounded multi-repo research"),
            "unexpected fixture description: {}",
            fixture.description
        );
        let (base_url, handle) = spawn_live_skills_network_mock_server().await;
        let mut config = test_service_config();
        config.live_skills_network_base_url = base_url;
        config.live_skills_network_timeout_ms = 3_000;
        let app = test_router_with_config(config);
        let payload = send_rpc_request(
            app,
            json!({
                "method":"code_live_skill_execute",
                "params":{
                    "skillId":"research-orchestrator",
                    "input": fixture.input.clone().expect("fixture input"),
                    "options": fixture.options.clone().expect("fixture options")
                }
            }),
        )
        .await;
        handle.abort();

        assert_eq!(payload["ok"], Value::Bool(true), "payload: {payload:#}");
        assert_eq!(
            payload["result"]["status"],
            Value::String(fixture.expectations.status.clone())
        );
        assert_eq!(
            payload["result"]["metadata"]["profileUsed"],
            Value::String(
                fixture
                    .expectations
                    .profile_used
                    .clone()
                    .expect("research profile used expectation")
            )
        );
        assert_eq!(
            payload["result"]["metadata"]["checkpointState"]["state"],
            Value::String(fixture.expectations.checkpoint_state.clone())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["profileUsed"],
            Value::String(fixture.expectations.scope_profile.clone())
        );
        assert_eq!(
            payload["result"]["metadata"]["researchRun"]["sessions"]
                .as_array()
                .map(Vec::len),
            fixture.expectations.research_session_count
        );
        assert!(payload["result"]["metadata"]["researchRun"]["citations"]
            .as_array()
            .is_some_and(|citations| !citations.is_empty()));
        assert_eval_tags_include(
            &payload["result"]["metadata"]["evalTags"],
            &fixture.expectations.eval_tags,
        );
    }

    #[tokio::test]
    async fn runtime_eval_fixture_review_bounded_delegation_executes_and_matches_expectations() {
        let fixture = load_runtime_eval_scenario_fixture("review-bounded-delegation");
        assert_eq!(fixture.id, "review-bounded-delegation");
        assert_eq!(fixture.policy, "always_passes");
        assert_eq!(fixture.kind, "review_sub_agent");
        assert!(
            fixture
                .description
                .contains("Review delegation should remain read-only"),
            "unexpected fixture description: {}",
            fixture.description
        );
        let app = test_router();
        let spawn_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_spawn",
                "params":{
                    "workspaceId":"workspace-test",
                    "title":"runtime eval review worker",
                    "accessMode":"read-only",
                    "scopeProfile": fixture.expectations.scope_profile.clone(),
                }
            }),
        )
        .await;
        assert_eq!(spawn_payload["ok"], Value::Bool(true), "payload: {spawn_payload:#}");
        assert_eq!(
            spawn_payload["result"]["allowNetwork"],
            Value::Bool(
                fixture
                    .expectations
                    .allow_network
                    .expect("review allowNetwork expectation")
            )
        );
        assert_eq!(
            spawn_payload["result"]["allowedSkillIds"],
            json!(
                fixture
                    .expectations
                    .allowed_skill_ids
                    .clone()
                    .expect("review allowedSkillIds expectation")
            )
        );
        assert_eval_tags_include(
            &spawn_payload["result"]["evalTags"],
            &fixture.expectations.eval_tags,
        );

        let session_id = spawn_payload["result"]["sessionId"]
            .as_str()
            .expect("review eval session id")
            .to_string();
        let send_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_send",
                "params":{
                    "sessionId": session_id,
                    "instruction": fixture
                        .instruction
                        .clone()
                        .expect("review instruction"),
                    "requiresApproval": fixture.requires_approval.unwrap_or(false),
                    "approvalReason": fixture.approval_reason.clone(),
                }
            }),
        )
        .await;
        assert_eq!(send_payload["ok"], Value::Bool(true), "payload: {send_payload:#}");
        let task_id = send_payload["result"]["task"]["taskId"]
            .as_str()
            .expect("review eval task id")
            .to_string();
        let approval_state = fixture
            .expectations
            .approval_state
            .clone()
            .expect("review approval state expectation");

        let awaiting_payload = wait_for_agent_task_terminal_status(
            app.clone(),
            task_id.as_str(),
            &[approval_state.as_str()],
        )
        .await;
        let approval_id = awaiting_payload["result"]["pendingApprovalId"]
            .as_str()
            .expect("review eval approval id")
            .to_string();

        let pending_wait_payload = send_rpc_request(
            app.clone(),
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": send_payload["result"]["session"]["sessionId"],
                    "timeoutMs": fixture.wait_timeout_ms.unwrap_or(50),
                    "pollIntervalMs": 25,
                }
            }),
        )
        .await;
        assert_eq!(pending_wait_payload["ok"], Value::Bool(true));
        assert_eq!(pending_wait_payload["result"]["done"], Value::Bool(false));
        assert_eq!(pending_wait_payload["result"]["timedOut"], Value::Bool(true));
        assert_eq!(
            pending_wait_payload["result"]["session"]["checkpointState"]["state"],
            Value::String(approval_state)
        );

        let approval_payload = send_rpc_request(
            app.clone(),
            json!({
                "method": "code_runtime_run_checkpoint_approval",
                "params": {
                    "approvalId": approval_id,
                    "decision": fixture
                        .approval_decision
                        .clone()
                        .expect("review approval decision"),
                    "reason": "runtime eval fixture rejection"
                }
            }),
        )
        .await;
        assert_eq!(approval_payload["ok"], Value::Bool(true));

        let wait_payload = send_rpc_request(
            app,
            json!({
                "method":"code_sub_agent_wait",
                "params":{
                    "sessionId": send_payload["result"]["session"]["sessionId"],
                    "timeoutMs": 1_000,
                }
            }),
        )
        .await;
        assert_eq!(wait_payload["ok"], Value::Bool(true), "payload: {wait_payload:#}");
        assert_eq!(wait_payload["result"]["done"], Value::Bool(true));
        assert_eq!(
            wait_payload["result"]["session"]["status"],
            Value::String(fixture.expectations.status.clone())
        );
        assert_eq!(
            wait_payload["result"]["session"]["checkpointState"]["state"],
            Value::String(fixture.expectations.checkpoint_state.clone())
        );
        assert_eval_tags_include(
            &wait_payload["result"]["session"]["evalTags"],
            &fixture.expectations.eval_tags,
        );
    }
