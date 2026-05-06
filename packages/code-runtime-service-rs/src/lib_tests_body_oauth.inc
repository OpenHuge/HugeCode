
    #[tokio::test]
    async fn runtime_auth_token_rejects_unauthorized_rpc_events_and_ws_routes() {
        let app = test_router_with_config(test_service_config_with_runtime_auth_token(
            "test-runtime-auth-token",
        ));

        let unauthorized_rpc_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "method":"code_health",
                    "params": {}
                })
                .to_string(),
            ))
            .expect("build unauthorized rpc request");
        let unauthorized_rpc_response = app
            .clone()
            .oneshot(unauthorized_rpc_request)
            .await
            .expect("unauthorized rpc response");
        assert_eq!(unauthorized_rpc_response.status(), StatusCode::UNAUTHORIZED);
        let unauthorized_rpc_bytes =
            axum::body::to_bytes(unauthorized_rpc_response.into_body(), 1024 * 1024)
                .await
                .expect("read unauthorized rpc body");
        let unauthorized_rpc_payload: Value = serde_json::from_slice(&unauthorized_rpc_bytes)
            .expect("parse unauthorized rpc payload");
        assert_eq!(
            unauthorized_rpc_payload["error"]["code"],
            Value::String("UNAUTHORIZED".to_string())
        );

        let authorized_rpc_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .header("x-code-runtime-auth-token", "test-runtime-auth-token")
            .body(Body::from(
                json!({
                    "method":"code_health",
                    "params": {}
                })
                .to_string(),
            ))
            .expect("build authorized rpc request");
        let authorized_rpc_response = app
            .clone()
            .oneshot(authorized_rpc_request)
            .await
            .expect("authorized rpc response");
        assert_eq!(authorized_rpc_response.status(), StatusCode::OK);

        let bearer_rpc_request = Request::builder()
            .method("POST")
            .uri("/rpc")
            .header("content-type", "application/json")
            .header("authorization", "Bearer test-runtime-auth-token")
            .body(Body::from(
                json!({
                    "method":"code_health",
                    "params": {}
                })
                .to_string(),
            ))
            .expect("build bearer rpc request");
        let bearer_rpc_response = app
            .clone()
            .oneshot(bearer_rpc_request)
            .await
            .expect("bearer rpc response");
        assert_eq!(bearer_rpc_response.status(), StatusCode::OK);

        let unauthorized_events_request = Request::builder()
            .method("GET")
            .uri("/events")
            .body(Body::empty())
            .expect("build unauthorized events request");
        let unauthorized_events_response = app
            .clone()
            .oneshot(unauthorized_events_request)
            .await
            .expect("unauthorized events response");
        assert_eq!(
            unauthorized_events_response.status(),
            StatusCode::UNAUTHORIZED
        );

        let authorized_events_request = Request::builder()
            .method("GET")
            .uri("/events?token=test-runtime-auth-token")
            .body(Body::empty())
            .expect("build authorized events request");
        let authorized_events_response = app
            .clone()
            .oneshot(authorized_events_request)
            .await
            .expect("authorized events response");
        assert_eq!(authorized_events_response.status(), StatusCode::OK);

        let unauthorized_ws_request = Request::builder()
            .method("GET")
            .uri("/ws")
            .body(Body::empty())
            .expect("build unauthorized ws request");
        let unauthorized_ws_response = app
            .clone()
            .oneshot(unauthorized_ws_request)
            .await
            .expect("unauthorized ws response");
        assert_eq!(unauthorized_ws_response.status(), StatusCode::UNAUTHORIZED);

        let authorized_ws_request = Request::builder()
            .method("GET")
            .uri("/ws?token=test-runtime-auth-token")
            .body(Body::empty())
            .expect("build authorized ws request");
        let authorized_ws_response = app
            .clone()
            .oneshot(authorized_ws_request)
            .await
            .expect("authorized ws response");
        assert_ne!(authorized_ws_response.status(), StatusCode::UNAUTHORIZED);

        let health_request = Request::builder()
            .method("GET")
            .uri("/health")
            .body(Body::empty())
            .expect("build health request");
        let health_response = app
            .clone()
            .oneshot(health_request)
            .await
            .expect("health response");
        assert_eq!(health_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn codex_oauth_start_returns_authorize_url_and_callback_rejects_missing_code() {
        let app = test_router();
        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-1"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let parsed_url = reqwest::Url::parse(auth_url).expect("parse authorize url");
        assert!(parsed_url.as_str().contains("/oauth/authorize"));
        assert!(
            auth_url.contains(
                "scope=openid%20profile%20email%20offline_access%20api.connectors.read%20api.connectors.invoke"
            ),
            "authorize url should include connector scopes using percent encoding"
        );
        assert!(
            !auth_url.contains("openid+profile+email+offline_access"),
            "authorize url should not use form '+' encoding"
        );
        let state = parsed_url
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| value.to_string())
            .expect("state query param");
        let redirect_uri = parsed_url
            .query_pairs()
            .find(|(key, _)| key == "redirect_uri")
            .map(|(_, value)| value.to_string())
            .expect("redirect_uri query param");
        assert_eq!(redirect_uri, "http://localhost:1455/auth/callback");
        let originator = parsed_url
            .query_pairs()
            .find(|(key, _)| key == "originator")
            .map(|(_, value)| value.to_string())
            .expect("originator query param");
        assert_eq!(originator, CODEX_OAUTH_ORIGINATOR);
        assert_eq!(originator, "hypecode");
        assert!(
            parsed_url
                .query_pairs()
                .find(|(key, _)| key == "allowed_workspace_id")
                .is_none(),
            "authorize url should not include allowed_workspace_id by default"
        );

        let callback_request = Request::builder()
            .method("GET")
            .uri(format!(
                "{CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH}?state={state}"
            ))
            .body(Body::empty())
            .expect("build oauth callback request");
        let callback_response = app
            .clone()
            .oneshot(callback_request)
            .await
            .expect("oauth callback response");
        assert_eq!(callback_response.status(), StatusCode::BAD_REQUEST);
        let callback_body = axum::body::to_bytes(callback_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth callback response");
        let callback_html = String::from_utf8_lossy(&callback_body);
        assert!(callback_html.contains("Missing OAuth authorization code"));
        assert!(
            !callback_html.contains("window.close"),
            "error callback html should remain open for debugging"
        );
    }

    #[tokio::test]
    async fn codex_oauth_loopback_listener_binds_on_demand_and_releases_on_cancel() {
        let mut config = test_service_config();
        let loopback_port = reserve_loopback_port();
        config.oauth_loopback_callback_port = loopback_port;
        let app = test_router_with_config(config);

        wait_for_loopback_port_availability(loopback_port, true).await;

        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-bind-on-demand"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);

        wait_for_loopback_port_availability(loopback_port, false).await;

        let cancel_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_CANCEL_PATH)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-bind-on-demand"}"#))
            .expect("build oauth cancel request");
        let cancel_response = app
            .clone()
            .oneshot(cancel_request)
            .await
            .expect("oauth cancel response");
        assert_eq!(cancel_response.status(), StatusCode::OK);

        wait_for_loopback_port_availability(loopback_port, true).await;
    }

    #[tokio::test]
    async fn codex_oauth_loopback_listener_releases_after_callback_failure() {
        let mut config = test_service_config();
        let loopback_port = reserve_loopback_port();
        config.oauth_loopback_callback_port = loopback_port;
        let app = test_router_with_config(config);

        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-release-after-callback"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let state = reqwest::Url::parse(auth_url)
            .expect("parse authorize url")
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| value.to_string())
            .expect("state query param");

        wait_for_loopback_port_availability(loopback_port, false).await;

        let callback_request = Request::builder()
            .method("GET")
            .uri(format!(
                "{CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH}?state={state}"
            ))
            .body(Body::empty())
            .expect("build oauth callback request");
        let callback_response = app
            .clone()
            .oneshot(callback_request)
            .await
            .expect("oauth callback response");
        assert_eq!(callback_response.status(), StatusCode::BAD_REQUEST);

        wait_for_loopback_port_availability(loopback_port, true).await;
    }

    #[tokio::test]
    async fn codex_oauth_cancel_revokes_pending_workspace_attempt() {
        let app = test_router();
        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("host", "127.0.0.1:8788")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-cancel"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let state = reqwest::Url::parse(auth_url)
            .expect("parse authorize url")
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| value.to_string())
            .expect("state query param");

        let cancel_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_CANCEL_PATH)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-cancel"}"#))
            .expect("build oauth cancel request");
        let cancel_response = app
            .clone()
            .oneshot(cancel_request)
            .await
            .expect("oauth cancel response");
        assert_eq!(cancel_response.status(), StatusCode::OK);
        let cancel_body = axum::body::to_bytes(cancel_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth cancel response");
        let cancel_payload: Value =
            serde_json::from_slice(&cancel_body).expect("parse oauth cancel payload");
        assert_eq!(
            cancel_payload.get("canceled").and_then(Value::as_bool),
            Some(true)
        );

        let callback_request = Request::builder()
            .method("GET")
            .uri(format!(
                "{CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH}?state={state}&code=test-code"
            ))
            .body(Body::empty())
            .expect("build oauth callback request");
        let callback_response = app
            .clone()
            .oneshot(callback_request)
            .await
            .expect("oauth callback response");
        assert_eq!(callback_response.status(), StatusCode::BAD_REQUEST);
        let callback_body = axum::body::to_bytes(callback_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth callback response");
        let callback_html = String::from_utf8_lossy(&callback_body);
        assert!(callback_html.contains("no longer valid"));
    }

    #[tokio::test]
    async fn codex_oauth_start_uses_public_base_url_when_configured() {
        let mut config = test_service_config();
        config.oauth_public_base_url = Some("https://runtime.example.com".to_string());
        let app = test_router_with_config(config);

        let start_request = Request::builder()
            .method("POST")
            .uri(CODE_RUNTIME_OAUTH_CODEX_START_PATH)
            .header("content-type", "application/json")
            .body(Body::from(r#"{"workspaceId":"ws-oauth-public"}"#))
            .expect("build oauth start request");
        let start_response = app
            .clone()
            .oneshot(start_request)
            .await
            .expect("oauth start response");
        assert_eq!(start_response.status(), StatusCode::OK);
        let start_body = axum::body::to_bytes(start_response.into_body(), 1024 * 1024)
            .await
            .expect("read oauth start response");
        let start_payload: Value =
            serde_json::from_slice(&start_body).expect("parse oauth start payload");
        let auth_url = start_payload
            .get("authUrl")
            .and_then(Value::as_str)
            .expect("oauth start authUrl");
        let redirect_uri = reqwest::Url::parse(auth_url)
            .expect("parse authorize url")
            .query_pairs()
            .find(|(key, _)| key == "redirect_uri")
            .map(|(_, value)| value.to_string())
            .expect("redirect_uri query param");

        assert_eq!(redirect_uri, "https://runtime.example.com/auth/callback");
    }

    #[test]
    fn codex_oauth_token_response_parses_access_token_field() {
        let parsed: codex_oauth_handlers::CodexOauthTokenResponse = serde_json::from_value(json!({
            "id_token": "id-token",
            "refresh_token": "refresh-token",
            "access_token": "access-token"
        }))
        .expect("parse codex oauth token response");
        assert_eq!(parsed.id_token.as_deref(), Some("id-token"));
        assert_eq!(parsed.refresh_token.as_deref(), Some("refresh-token"));
        assert_eq!(parsed.access_token.as_deref(), Some("access-token"));
    }

    #[test]
    fn take_pending_codex_oauth_login_returns_expired_entry_for_expired_state() {
        let now = 10_000_u64;
        let mut pending = HashMap::new();
        pending.insert(
            "state-expired".to_string(),
            codex_oauth_handlers::PendingCodexOauthLogin {
                login_id: "login-expired".to_string(),
                workspace_id: "ws-expired".to_string(),
                redirect_uri: "http://127.0.0.1:8788/auth/callback".to_string(),
                code_verifier: "verifier".to_string(),
                post_message_origin: None,
                expires_at_ms: now.saturating_sub(1),
            },
        );

        let lookup =
            codex_oauth_handlers::take_pending_codex_oauth_login(&mut pending, "state-expired", now);
        match lookup {
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Expired(entry) => {
                assert_eq!(entry.login_id, "login-expired");
                assert_eq!(entry.workspace_id, "ws-expired");
            }
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Found(_) => {
                panic!("expired login unexpectedly returned as active")
            }
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Missing => {
                panic!("expired login unexpectedly returned as missing")
            }
        }
        assert!(pending.is_empty());
    }

    #[test]
    fn oauth_result_html_posts_popup_message_and_only_autocloses_on_success() {
        let success_html =
            codex_oauth_handlers::build_oauth_result_html(
                "Codex OAuth sign-in complete",
                "ok",
                true,
                Some("login-1"),
                Some("https://app.example.test"),
            )
            .0;
        assert!(success_html.contains("fastcode:oauth:codex"));
        assert!(success_html.contains("success: true"));
        assert!(success_html.contains("loginId: \"login-1\""));
        assert!(success_html.contains("\"https://app.example.test\""));
        assert!(!success_html.contains(", \"*\""));
        assert!(success_html.contains("window.close"));

        let failure_html =
            codex_oauth_handlers::build_oauth_result_html(
                "Codex OAuth sign-in failed",
                "failed",
                false,
                Some("login-1"),
                Some("https://app.example.test"),
            )
            .0;
        assert!(failure_html.contains("fastcode:oauth:codex"));
        assert!(failure_html.contains("success: false"));
        assert!(failure_html.contains("loginId: \"login-1\""));
        assert!(!failure_html.contains(", \"*\""));
        assert!(!failure_html.contains("window.close"));
    }

    #[test]
    fn take_pending_codex_oauth_login_prunes_expired_entries_on_missing_lookup() {
        let now = 20_000_u64;
        let mut pending = HashMap::new();
        pending.insert(
            "state-expired".to_string(),
            codex_oauth_handlers::PendingCodexOauthLogin {
                login_id: "login-expired".to_string(),
                workspace_id: "ws-expired".to_string(),
                redirect_uri: "http://127.0.0.1:8788/auth/callback".to_string(),
                code_verifier: "verifier-expired".to_string(),
                post_message_origin: None,
                expires_at_ms: now.saturating_sub(1),
            },
        );
        pending.insert(
            "state-active".to_string(),
            codex_oauth_handlers::PendingCodexOauthLogin {
                login_id: "login-active".to_string(),
                workspace_id: "ws-active".to_string(),
                redirect_uri: "http://127.0.0.1:8788/auth/callback".to_string(),
                code_verifier: "verifier-active".to_string(),
                post_message_origin: None,
                expires_at_ms: now.saturating_add(30_000),
            },
        );

        let lookup =
            codex_oauth_handlers::take_pending_codex_oauth_login(&mut pending, "state-missing", now);
        assert!(matches!(
            lookup,
            codex_oauth_handlers::PendingCodexOauthLoginLookup::Missing
        ));
        assert!(!pending.contains_key("state-expired"));
        assert!(pending.contains_key("state-active"));
    }

    #[test]
    fn generate_codex_pkce_verifier_matches_codex_cli_length_profile() {
        let verifier = codex_oauth_handlers::generate_codex_pkce_verifier();
        assert_eq!(
            verifier.len(),
            86,
            "64 random bytes should produce an 86-char URL-safe verifier"
        );
        assert!(
            verifier
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_'),
            "verifier should be URL-safe base64 without padding"
        );
    }
