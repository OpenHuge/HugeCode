use super::*;
use std::path::PathBuf;

const TEST_SECRET_KEY_B64: &str = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

#[test]
fn unavailable_store_fails_closed_for_oauth_operations() {
    let store = OAuthPoolStore::unavailable("forced oauth pool bootstrap failure");

    let accounts_error = store
        .list_accounts(None)
        .expect_err("list_accounts should fail when store is unavailable");
    assert!(accounts_error.contains("OAuth pool store unavailable"));
    assert!(accounts_error.contains("forced oauth pool bootstrap failure"));

    let diagnostics_error = store
        .diagnostics()
        .expect_err("diagnostics should fail when store is unavailable");
    assert!(diagnostics_error.contains("OAuth pool store unavailable"));
    assert!(diagnostics_error.contains("forced oauth pool bootstrap failure"));

    let select_error = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: None,
            workspace_id: None,
            model_id: None,
        })
        .expect_err("select_pool_account should fail when store is unavailable");
    assert!(select_error.contains("OAuth pool store unavailable"));
}

#[test]
fn upsert_account_encrypts_api_key_and_resolves_on_read() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let upserted = store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-encrypted".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Encrypted".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"secret-value",
                "compatBaseUrl":"https://compat.example.com/v1/"
            })),
        })
        .expect("upsert account");

    let metadata = upserted.metadata.as_object().expect("metadata object");
    assert!(metadata.get("apiKey").is_none());
    assert!(metadata.get("api_key").is_none());
    assert!(metadata
        .get(OAUTH_ACCOUNT_API_KEY_ENCRYPTED_V1_KEY)
        .and_then(Value::as_str)
        .is_some());
    assert_eq!(
        metadata.get("compatBaseUrl"),
        Some(&Value::String("https://compat.example.com/v1".to_string()))
    );

    let decrypted = store
        .resolve_api_key_from_metadata(&upserted.metadata)
        .expect("decrypt api key");
    assert_eq!(decrypted, Some("secret-value".to_string()));
}

#[test]
fn upsert_account_encrypts_refresh_token_and_resolves_on_read() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let upserted = store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-refresh-encrypted".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Refresh Encrypted".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "refreshToken":"refresh-token-secret"
            })),
        })
        .expect("upsert account");

    let metadata = upserted.metadata.as_object().expect("metadata object");
    assert!(metadata.get("refreshToken").is_none());
    assert!(metadata.get("refresh_token").is_none());
    assert!(metadata
        .get(OAUTH_ACCOUNT_REFRESH_TOKEN_ENCRYPTED_V1_KEY)
        .and_then(Value::as_str)
        .is_some());

    let decrypted = store
        .resolve_refresh_token_from_metadata(&upserted.metadata)
        .expect("decrypt refresh token");
    assert_eq!(decrypted, Some("refresh-token-secret".to_string()));
}

#[test]
fn upsert_account_exposes_typed_route_and_routing_state_from_metadata() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let upserted = store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-routed".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Routed".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"secret-value",
                "routeConfig":{
                    "compatBaseUrl":"https://compat.example.com/v1/",
                    "proxyId":"proxy-east",
                    "priority":5,
                    "concurrencyLimit":2,
                    "schedulable":false
                },
                "routingState":{
                    "credentialReady":false,
                    "lastRoutingError":"upstream timeout",
                    "rateLimitedUntil":123,
                    "overloadedUntil":456,
                    "tempUnschedulableUntil":789,
                    "tempUnschedulableReason":"manual drain"
                }
            })),
        })
        .expect("upsert account with route config");

    let route_config = upserted.route_config.expect("route config");
    assert_eq!(
        route_config.compat_base_url,
        Some("https://compat.example.com/v1".to_string())
    );
    assert_eq!(route_config.proxy_id, Some("proxy-east".to_string()));
    assert_eq!(route_config.priority, Some(5));
    assert_eq!(route_config.concurrency_limit, Some(2));
    assert_eq!(route_config.schedulable, Some(false));

    let routing_state = upserted.routing_state.expect("routing state");
    assert_eq!(routing_state.credential_ready, Some(false));
    assert_eq!(
        routing_state.last_routing_error,
        Some("upstream timeout".to_string())
    );
    assert_eq!(routing_state.rate_limited_until, Some(123));
    assert_eq!(routing_state.overloaded_until, Some(456));
    assert_eq!(routing_state.temp_unschedulable_until, Some(789));
    assert_eq!(
        routing_state.temp_unschedulable_reason,
        Some("manual drain".to_string())
    );
}

#[test]
fn upsert_account_exposes_typed_chatgpt_workspaces_from_metadata() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let upserted = store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-multi-workspace".to_string(),
            provider: "codex".to_string(),
            external_account_id: Some("chatgpt-account-main".to_string()),
            email: Some("multi@example.com".to_string()),
            display_name: Some("Codex Multi Workspace".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"secret-value",
                "chatgptWorkspaces":[
                    {
                        "workspaceId":"org-default",
                        "title":"Default Org",
                        "role":"owner",
                        "isDefault":true
                    },
                    {
                        "workspaceId":"org-shared",
                        "title":"Shared Org",
                        "role":"member",
                        "isDefault":false
                    }
                ]
            })),
        })
        .expect("upsert account with chatgpt workspaces");

    let chatgpt_workspaces = upserted.chatgpt_workspaces.expect("chatgpt workspaces");
    assert_eq!(chatgpt_workspaces.len(), 2);
    assert_eq!(chatgpt_workspaces[0].workspace_id, "org-default");
    assert_eq!(chatgpt_workspaces[0].title, Some("Default Org".to_string()));
    assert_eq!(chatgpt_workspaces[0].role, Some("owner".to_string()));
    assert_eq!(chatgpt_workspaces[0].is_default, true);
    assert_eq!(chatgpt_workspaces[1].workspace_id, "org-shared");
    assert_eq!(chatgpt_workspaces[1].is_default, false);
    assert_eq!(
        upserted.default_chatgpt_workspace_id,
        Some("org-default".to_string())
    );
}

#[test]
fn select_pool_account_skips_unschedulable_accounts() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-paused".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Paused".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"paused-key",
                "routeConfig":{"schedulable":false}
            })),
        })
        .expect("upsert paused account");

    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-ready".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Ready".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"ready-key",
                "routingState":{"credentialReady":true}
            })),
        })
        .expect("upsert ready account");

    let selection = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("session-routed".to_string()),
            workspace_id: None,
            model_id: None,
        })
        .expect("select codex account")
        .expect("selection");

    assert_eq!(selection.account.account_id, "codex-ready");
}

#[test]
fn select_pool_account_filters_candidates_by_requested_chatgpt_workspace() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-org-a".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Org A".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"org-a-key",
                "chatgptWorkspaces":[
                    {"workspaceId":"org-a","title":"Org A","isDefault":true}
                ]
            })),
        })
        .expect("upsert org a account");

    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-org-b".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Org B".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"org-b-key",
                "chatgptWorkspaces":[
                    {"workspaceId":"org-b","title":"Org B","isDefault":true}
                ]
            })),
        })
        .expect("upsert org b account");

    let selection = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("session-org-filter".to_string()),
            workspace_id: Some("org-b".to_string()),
            model_id: None,
        })
        .expect("select codex account")
        .expect("selection");

    assert_eq!(selection.account.account_id, "codex-org-b");
    assert_eq!(
        selection.account.default_chatgpt_workspace_id,
        Some("org-b".to_string())
    );
}

#[test]
fn upsert_account_rejects_unknown_provider_with_invalid_input_code() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let result = store.upsert_account(OAuthAccountUpsertInput {
        account_id: "unknown-provider-a1".to_string(),
        provider: "unknown_vendor".to_string(),
        external_account_id: None,
        email: None,
        display_name: Some("Unknown Provider".to_string()),
        status: Some("enabled".to_string()),
        disabled_reason: None,
        metadata: Some(json!({
            "apiKey":"unknown-key"
        })),
    });
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    assert!(error.message().contains("Unsupported provider"));
}

#[test]
fn upsert_account_rejects_empty_account_id_with_invalid_input_code() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let result = store.upsert_account(OAuthAccountUpsertInput {
        account_id: "  ".to_string(),
        provider: "codex".to_string(),
        external_account_id: None,
        email: None,
        display_name: Some("Empty Account Id".to_string()),
        status: Some("enabled".to_string()),
        disabled_reason: None,
        metadata: Some(json!({
            "apiKey":"empty-id-key"
        })),
    });
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    assert!(error.message().contains("accountId"));
}

#[test]
fn opening_store_without_secret_rejects_encrypted_credentials() {
    let db_path = temp_db_path("oauth-pool-secret-required");
    let db_path_string = db_path.to_string_lossy().to_string();

    let store = OAuthPoolStore::open(db_path_string.as_str(), Some(TEST_SECRET_KEY_B64))
        .expect("open oauth pool store with secret");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-encrypted-required".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: None,
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"secret-value"
            })),
        })
        .expect("upsert account");
    drop(store);

    let reopened = OAuthPoolStore::open(db_path_string.as_str(), None);
    assert!(reopened.is_err());
    let message = reopened.err().unwrap_or_default();
    assert!(message.contains("OAUTH_SECRET_KEY"));

    cleanup_db_path(&db_path);
}

#[test]
fn upsert_account_rejects_reserved_encrypted_metadata_field() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let result = store.upsert_account(OAuthAccountUpsertInput {
        account_id: "codex-reserved".to_string(),
        provider: "codex".to_string(),
        external_account_id: None,
        email: None,
        display_name: None,
        status: Some("enabled".to_string()),
        disabled_reason: None,
        metadata: Some(json!({
            "apiKeyEncryptedV1":"tampered-ciphertext"
        })),
    });

    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("apiKeyEncryptedV1"));
    assert!(message.contains("reserved"));
}

#[test]
fn upsert_account_rejects_reserved_refresh_token_metadata_field() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    let result = store.upsert_account(OAuthAccountUpsertInput {
        account_id: "codex-reserved-refresh".to_string(),
        provider: "codex".to_string(),
        external_account_id: None,
        email: None,
        display_name: None,
        status: Some("enabled".to_string()),
        disabled_reason: None,
        metadata: Some(json!({
            "refreshTokenEncryptedV1":"tampered-ciphertext"
        })),
    });

    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("refreshTokenEncryptedV1"));
    assert!(message.contains("reserved"));
}

#[test]
fn upsert_and_list_accounts_accept_provider_aliases_and_canonicalize_to_gemini() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let upserted = store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "gemini-antigravity-a1".to_string(),
            provider: "antigravity".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Gemini Antigravity".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"secret-value"
            })),
        })
        .expect("upsert antigravity alias account");

    assert_eq!(upserted.provider, "gemini");

    let list_gemini = store
        .list_accounts(Some("gemini"))
        .expect("list gemini provider accounts");
    assert_eq!(list_gemini.len(), 1);
    assert_eq!(list_gemini[0].provider, "gemini");

    let list_google_alias = store
        .list_accounts(Some("google"))
        .expect("list google alias provider accounts");
    assert_eq!(list_google_alias.len(), 1);
    assert_eq!(list_google_alias[0].provider, "gemini");

    let list_anti_gravity_alias = store
        .list_accounts(Some("anti-gravity"))
        .expect("list anti-gravity alias provider accounts");
    assert_eq!(list_anti_gravity_alias.len(), 1);
    assert_eq!(list_anti_gravity_alias[0].provider, "gemini");
}

#[test]
fn upsert_pool_rejects_missing_preferred_account() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let result = store.upsert_pool(OAuthPoolUpsertInput {
        pool_id: "pool-codex-preferred-missing".to_string(),
        provider: "codex".to_string(),
        name: "Codex Preferred Missing".to_string(),
        strategy: Some("round_robin".to_string()),
        sticky_mode: Some("balance".to_string()),
        preferred_account_id: Some("codex-missing-a1".to_string()),
        enabled: Some(true),
        metadata: json!({}),
    });
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("Preferred account"));
    assert!(message.contains("does not exist"));
}

#[test]
fn upsert_pool_rejects_preferred_account_provider_mismatch() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-preferred-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Preferred".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-preferred-key"
            })),
        })
        .expect("upsert codex preferred account");

    let result = store.upsert_pool(OAuthPoolUpsertInput {
        pool_id: "pool-claude-preferred-mismatch".to_string(),
        provider: "claude_code".to_string(),
        name: "Claude Preferred Mismatch".to_string(),
        strategy: Some("round_robin".to_string()),
        sticky_mode: Some("balance".to_string()),
        preferred_account_id: Some("codex-preferred-a1".to_string()),
        enabled: Some(true),
        metadata: json!({}),
    });
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("Preferred account"));
    assert!(message.contains("does not match pool provider"));
}

#[test]
fn upsert_pool_rejects_unknown_provider_with_invalid_input_code() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let result = store.upsert_pool(OAuthPoolUpsertInput {
        pool_id: "pool-unknown-provider".to_string(),
        provider: "unknown_vendor".to_string(),
        name: "Unknown Provider Pool".to_string(),
        strategy: Some("round_robin".to_string()),
        sticky_mode: Some("balance".to_string()),
        preferred_account_id: None,
        enabled: Some(true),
        metadata: json!({}),
    });
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    assert!(error.message().contains("Unsupported provider"));
}

#[test]
fn upsert_pool_rejects_empty_pool_id_with_invalid_input_code() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let result = store.upsert_pool(OAuthPoolUpsertInput {
        pool_id: "   ".to_string(),
        provider: "codex".to_string(),
        name: "Codex Empty Pool Id".to_string(),
        strategy: Some("round_robin".to_string()),
        sticky_mode: Some("balance".to_string()),
        preferred_account_id: None,
        enabled: Some(true),
        metadata: json!({}),
    });
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    assert!(error.message().contains("poolId"));
}

#[test]
fn replace_pool_members_rejects_missing_pool_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let result = store.replace_pool_members(
        "pool-missing-risk",
        &[OAuthPoolMemberInput {
            account_id: "codex-any-a1".to_string(),
            weight: Some(1),
            priority: Some(0),
            position: Some(0),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("Pool `pool-missing-risk` does not exist"));
}

#[test]
fn replace_pool_members_rejects_missing_account_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let result = store.replace_pool_members(
        "pool-codex",
        &[OAuthPoolMemberInput {
            account_id: "codex-missing-a1".to_string(),
            weight: Some(1),
            priority: Some(0),
            position: Some(0),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("Pool member account `codex-missing-a1` does not exist"));
}

#[test]
fn replace_pool_members_rejects_empty_pool_id_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let result = store.replace_pool_members(
        " ",
        &[OAuthPoolMemberInput {
            account_id: "codex-any-a1".to_string(),
            weight: Some(1),
            priority: Some(0),
            position: Some(0),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    assert!(error.message().contains("poolId"));
}

#[test]
fn replace_pool_members_rejects_empty_account_id_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let result = store.replace_pool_members(
        "pool-codex",
        &[OAuthPoolMemberInput {
            account_id: " ".to_string(),
            weight: Some(1),
            priority: Some(0),
            position: Some(0),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    assert!(error.message().contains("accountId"));
}

#[test]
fn replace_pool_members_rejects_provider_mismatch_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "gemini-a1".to_string(),
            provider: "gemini".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Gemini".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"gemini-key"
            })),
        })
        .expect("upsert gemini account");

    let result = store.replace_pool_members(
        "pool-codex",
        &[OAuthPoolMemberInput {
            account_id: "gemini-a1".to_string(),
            weight: Some(1),
            priority: Some(0),
            position: Some(0),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("does not match pool provider"));
}

#[test]
fn replace_pool_members_rejects_out_of_range_weight_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-weight-risk-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Weight Risk".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-weight-risk-key"
            })),
        })
        .expect("upsert codex account");

    let result = store.replace_pool_members(
        "pool-codex",
        &[OAuthPoolMemberInput {
            account_id: "codex-weight-risk-a1".to_string(),
            weight: Some(0),
            priority: Some(0),
            position: Some(0),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("weight"));
    assert!(message.contains("between 1 and 20"));
}

#[test]
fn replace_pool_members_rejects_negative_priority_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-priority-risk-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Priority Risk".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-priority-risk-key"
            })),
        })
        .expect("upsert codex account");

    let result = store.replace_pool_members(
        "pool-codex",
        &[OAuthPoolMemberInput {
            account_id: "codex-priority-risk-a1".to_string(),
            weight: Some(1),
            priority: Some(-1),
            position: Some(0),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("priority"));
    assert!(message.contains("greater than or equal to 0"));
}

#[test]
fn replace_pool_members_rejects_negative_position_with_structured_input_error() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-position-risk-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Position Risk".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-position-risk-key"
            })),
        })
        .expect("upsert codex account");

    let result = store.replace_pool_members(
        "pool-codex",
        &[OAuthPoolMemberInput {
            account_id: "codex-position-risk-a1".to_string(),
            weight: Some(1),
            priority: Some(0),
            position: Some(-1),
            enabled: Some(true),
        }],
    );
    assert!(result.is_err());
    let error = result.err().unwrap_or_default();
    assert_eq!(error.code(), OAuthPoolMutationErrorCode::InvalidInput);
    let message = error.message();
    assert!(message.contains("position"));
    assert!(message.contains("greater than or equal to 0"));
}

#[test]
fn diagnostics_reports_pool_and_account_snapshot() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-diag-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Diagnostics".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"diag-secret"
            })),
        })
        .expect("upsert diagnostics account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-diag-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace diagnostics pool members");
    let _ = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("diag-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select diagnostics pool account");

    let diagnostics = store.diagnostics().expect("read oauth diagnostics");
    assert_eq!(diagnostics.pools_total, 3);
    assert_eq!(diagnostics.pools_enabled, 3);
    assert_eq!(diagnostics.accounts_total, 1);
    assert_eq!(diagnostics.accounts_enabled, 1);
    assert_eq!(diagnostics.accounts_with_api_key, 1);
    assert_eq!(diagnostics.pool_members_total, 1);
    assert_eq!(diagnostics.session_bindings_total, 1);
    assert_eq!(diagnostics.round_robin_cursor_entries, 0);
    assert_eq!(diagnostics.active_rate_limits_total, 0);
    assert!(diagnostics.oauth_secret_key_configured);
}

#[test]
fn remove_pool_clears_round_robin_cursor_entry() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-remove-pool-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Remove Pool".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"remove-pool-secret"
            })),
        })
        .expect("upsert remove-pool account");
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-remove-cursor".to_string(),
            provider: "codex".to_string(),
            name: "Codex Remove Cursor Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("cache_first".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert remove-pool pool");
    store
        .replace_pool_members(
            "pool-codex-remove-cursor",
            &[OAuthPoolMemberInput {
                account_id: "codex-remove-pool-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace remove-pool members");
    let _ = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex-remove-cursor".to_string(),
            session_id: Some("remove-pool-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select remove-pool account");

    let before = store.diagnostics().expect("read diagnostics before remove");
    assert_eq!(before.round_robin_cursor_entries, 1);

    let removed = store
        .remove_pool("pool-codex-remove-cursor")
        .expect("remove pool");
    assert!(removed);

    let after = store.diagnostics().expect("read diagnostics after remove");
    assert_eq!(after.round_robin_cursor_entries, 0);
}

#[test]
fn select_pool_account_without_session_id_does_not_create_binding() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-no-session-binding-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex No Session Binding".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"no-session-binding-secret"
            })),
        })
        .expect("upsert no-session-binding account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-no-session-binding-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace no-session-binding members");

    let selected = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: None,
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select no-session-binding account");
    assert!(selected.is_some());

    let diagnostics = store.diagnostics().expect("read diagnostics");
    assert_eq!(diagnostics.session_bindings_total, 0);
}

#[test]
fn select_pool_account_sets_session_binding_expiration() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-session-expiry-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Session Expiry".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"session-expiry-secret"
            })),
        })
        .expect("upsert session expiry account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-session-expiry-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace session expiry members");

    let _ = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("session-expiry-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select session expiry account");

    let now = now_ms();
    let conn = store
        .lock_conn("session binding query")
        .expect("lock oauth pool store for session binding query");
    let expires_at: Option<u64> = conn
        .query_row(
            "SELECT expires_at FROM oauth_session_bindings
                 WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
            params!["session-expiry-1", "pool-codex", ""],
            |row| row.get::<_, Option<u64>>(0),
        )
        .optional()
        .expect("query session binding expiration")
        .flatten();

    let expires_at = expires_at.expect("session binding expiration should exist");
    assert!(expires_at > now);
    assert!(expires_at <= now.saturating_add(SESSION_BINDING_TTL_MS));
}

#[test]
fn select_pool_account_balance_mode_does_not_persist_session_binding() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for account_id in ["codex-balance-a1", "codex-balance-a2"] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(account_id.to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret")
                })),
            })
            .expect("upsert balance account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-balance".to_string(),
            provider: "codex".to_string(),
            name: "Codex Balance Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("balance".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert balance pool");
    store
        .replace_pool_members(
            "pool-codex-balance",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-balance-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-balance-a2".to_string(),
                    weight: Some(1),
                    priority: Some(1),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace balance pool members");

    let _ = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex-balance".to_string(),
            session_id: Some("balance-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select balance account");

    let conn = store
        .lock_conn("balance session binding query")
        .expect("lock oauth pool store for balance session query");
    let binding: Option<String> = conn
        .query_row(
            "SELECT session_id FROM oauth_session_bindings
                 WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
            params!["balance-session-1", "pool-codex-balance", ""],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .expect("query balance session binding");
    assert!(binding.is_none());
}

#[test]
fn select_pool_account_cache_first_reuses_session_sticky_binding() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for account_id in ["codex-sticky-reuse-a1", "codex-sticky-reuse-a2"] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(account_id.to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret")
                })),
            })
            .expect("upsert sticky-reuse account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-sticky-reuse".to_string(),
            provider: "codex".to_string(),
            name: "Codex Sticky Reuse Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("cache_first".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert sticky-reuse pool");
    store
        .replace_pool_members(
            "pool-codex-sticky-reuse",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-sticky-reuse-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-sticky-reuse-a2".to_string(),
                    weight: Some(1),
                    priority: Some(1),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace sticky-reuse members");

    let first = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-sticky-reuse".to_string(),
            session_id: Some("sticky-reuse-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select first sticky-reuse account")
        .0
        .expect("first sticky-reuse selection");
    assert_eq!(first.account.account_id, "codex-sticky-reuse-a1");
    assert_eq!(first.reason, "round_robin");

    let second = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-sticky-reuse".to_string(),
            session_id: Some("sticky-reuse-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select second sticky-reuse account")
        .0
        .expect("second sticky-reuse selection");
    assert_eq!(second.account.account_id, "codex-sticky-reuse-a1");
    assert_eq!(second.reason, "sticky_binding");
}

#[test]
fn select_pool_account_scopes_sticky_binding_by_chatgpt_workspace() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for (account_id, workspace_id) in [
        ("codex-workspace-stick-a1", "org-a"),
        ("codex-workspace-stick-b1", "org-b"),
    ] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(account_id.to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret"),
                    "chatgptWorkspaces": [
                        { "workspaceId": workspace_id, "title": workspace_id, "isDefault": true }
                    ]
                })),
            })
            .expect("upsert workspace sticky account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-workspace-sticky".to_string(),
            provider: "codex".to_string(),
            name: "Codex Workspace Sticky Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("cache_first".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert workspace sticky pool");
    store
        .replace_pool_members(
            "pool-codex-workspace-sticky",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-workspace-stick-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-workspace-stick-b1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace workspace sticky members");

    let first = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-workspace-sticky".to_string(),
            session_id: Some("workspace-sticky-session-1".to_string()),
            workspace_id: Some("org-a".to_string()),
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select workspace a account")
        .0
        .expect("workspace a selection");
    assert_eq!(first.account.account_id, "codex-workspace-stick-a1");

    let second = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-workspace-sticky".to_string(),
            session_id: Some("workspace-sticky-session-1".to_string()),
            workspace_id: Some("org-b".to_string()),
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select workspace b account")
        .0
        .expect("workspace b selection");
    assert_eq!(second.account.account_id, "codex-workspace-stick-b1");
    assert_ne!(second.reason, "sticky_binding");

    let third = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-workspace-sticky".to_string(),
            session_id: Some("workspace-sticky-session-1".to_string()),
            workspace_id: Some("org-a".to_string()),
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("reselect workspace a account")
        .0
        .expect("workspace a reselection");
    assert_eq!(third.account.account_id, "codex-workspace-stick-a1");
    assert_eq!(third.reason, "sticky_binding");
}

#[test]
fn select_pool_account_cache_first_preferred_account_overrides_sticky_binding() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for account_id in ["codex-preferred-sticky-a1", "codex-preferred-sticky-a2"] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(account_id.to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret")
                })),
            })
            .expect("upsert preferred-sticky account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-preferred-sticky".to_string(),
            provider: "codex".to_string(),
            name: "Codex Preferred Sticky Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("cache_first".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert preferred-sticky pool");
    store
        .replace_pool_members(
            "pool-codex-preferred-sticky",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-preferred-sticky-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-preferred-sticky-a2".to_string(),
                    weight: Some(1),
                    priority: Some(1),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace preferred-sticky members");

    let first = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-preferred-sticky".to_string(),
            session_id: Some("preferred-sticky-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select first preferred-sticky account")
        .0
        .expect("first selection exists");
    assert_eq!(first.account.account_id, "codex-preferred-sticky-a1");

    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-preferred-sticky".to_string(),
            provider: "codex".to_string(),
            name: "Codex Preferred Sticky Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("cache_first".to_string()),
            preferred_account_id: Some("codex-preferred-sticky-a2".to_string()),
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("set preferred account for preferred-sticky pool");

    let second = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-preferred-sticky".to_string(),
            session_id: Some("preferred-sticky-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select second preferred-sticky account")
        .0
        .expect("second selection exists");
    assert_eq!(second.account.account_id, "codex-preferred-sticky-a2");
    assert_eq!(second.reason, "preferred_account");

    let conn = store
        .lock_conn("preferred sticky session binding query")
        .expect("lock oauth pool store for preferred-sticky query");
    let binding_account_id: Option<String> = conn
        .query_row(
            "SELECT account_id FROM oauth_session_bindings
                 WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
            params![
                "preferred-sticky-session-1",
                "pool-codex-preferred-sticky",
                ""
            ],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .expect("query preferred-sticky session binding");
    assert_eq!(
        binding_account_id.as_deref(),
        Some("codex-preferred-sticky-a2")
    );
}

#[test]
fn bind_pool_account_creates_project_workspace_override_that_beats_preferred_account() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for account_id in ["codex-manual-bind-a1", "codex-manual-bind-a2"] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(account_id.to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret")
                })),
            })
            .expect("upsert manual-bind account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-manual-bind".to_string(),
            provider: "codex".to_string(),
            name: "Codex Manual Bind Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("balance".to_string()),
            preferred_account_id: Some("codex-manual-bind-a1".to_string()),
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert manual-bind pool");
    store
        .replace_pool_members(
            "pool-codex-manual-bind",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-manual-bind-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-manual-bind-a2".to_string(),
                    weight: Some(1),
                    priority: Some(1),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace manual-bind members");

    let bound = store
        .bind_pool_account(OAuthPoolAccountBindInput {
            pool_id: "pool-codex-manual-bind".to_string(),
            session_id: "project-ws-bind-1".to_string(),
            workspace_id: None,
            account_id: "codex-manual-bind-a2".to_string(),
        })
        .expect("bind manual project workspace account")
        .expect("manual binding selection");
    assert_eq!(bound.account.account_id, "codex-manual-bind-a2");
    assert_eq!(bound.reason, "manual_binding");

    let selected = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-manual-bind".to_string(),
            session_id: Some("project-ws-bind-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select project workspace after manual binding")
        .0
        .expect("manual-bound selection");
    assert_eq!(selected.account.account_id, "codex-manual-bind-a2");
    assert_eq!(selected.reason, "manual_binding");
}

#[test]
fn select_pool_account_preferred_account_clears_stale_binding_when_sticky_disabled() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for account_id in ["codex-preferred-clear-a1", "codex-preferred-clear-a2"] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(account_id.to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret")
                })),
            })
            .expect("upsert preferred-clear account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-preferred-clear".to_string(),
            provider: "codex".to_string(),
            name: "Codex Preferred Clear Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("cache_first".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert preferred-clear pool");
    store
        .replace_pool_members(
            "pool-codex-preferred-clear",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-preferred-clear-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-preferred-clear-a2".to_string(),
                    weight: Some(1),
                    priority: Some(1),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace preferred-clear members");

    let first = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-preferred-clear".to_string(),
            session_id: Some("preferred-clear-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select first preferred-clear account")
        .0
        .expect("first preferred-clear selection");
    assert_eq!(first.account.account_id, "codex-preferred-clear-a1");

    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-preferred-clear".to_string(),
            provider: "codex".to_string(),
            name: "Codex Preferred Clear Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("balance".to_string()),
            preferred_account_id: Some("codex-preferred-clear-a2".to_string()),
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("disable sticky and set preferred account");

    let second = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-preferred-clear".to_string(),
            session_id: Some("preferred-clear-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select second preferred-clear account")
        .0
        .expect("second preferred-clear selection");
    assert_eq!(second.account.account_id, "codex-preferred-clear-a2");
    assert_eq!(second.reason, "preferred_account");

    let conn = store
        .lock_conn("preferred-clear session binding query")
        .expect("lock oauth pool store for preferred-clear query");
    let binding: Option<String> = conn
        .query_row(
            "SELECT session_id FROM oauth_session_bindings
                 WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
            params![
                "preferred-clear-session-1",
                "pool-codex-preferred-clear",
                ""
            ],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .expect("query preferred-clear session binding");
    assert!(
        binding.is_none(),
        "balance mode should clear stale sticky binding for preferred selection"
    );
}

#[test]
fn select_pool_account_performance_first_uses_sticky_only_when_not_worse() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for account_id in ["codex-performance-a1", "codex-performance-a2"] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(account_id.to_string()),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret")
                })),
            })
            .expect("upsert performance account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-performance".to_string(),
            provider: "codex".to_string(),
            name: "Codex Performance Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("performance_first".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert performance pool");
    store
        .replace_pool_members(
            "pool-codex-performance",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-performance-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-performance-a2".to_string(),
                    weight: Some(1),
                    priority: Some(1),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace performance pool members");

    let (first_selection, first_miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-performance".to_string(),
            session_id: Some("performance-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select first performance account");
    assert_eq!(first_miss_reason, None);
    assert_eq!(
        first_selection
            .as_ref()
            .map(|entry| entry.account.account_id.as_str()),
        Some("codex-performance-a1")
    );

    let report = store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-performance-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: None,
            error_message: None,
        })
        .expect("report failure penalty");
    assert!(report);

    let (second_selection, second_miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-performance".to_string(),
            session_id: Some("performance-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select second performance account");
    assert_eq!(second_miss_reason, None);
    let second = second_selection.expect("second performance selection");
    assert_eq!(second.account.account_id, "codex-performance-a2");
    assert_eq!(second.reason, "round_robin");

    let (third_selection, third_miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex-performance".to_string(),
            session_id: Some("performance-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select third performance account");
    assert_eq!(third_miss_reason, None);
    let third = third_selection.expect("third performance selection");
    assert_eq!(third.account.account_id, "codex-performance-a2");
    assert_eq!(third.reason, "sticky_performance");
}

#[test]
fn upsert_session_binding_prunes_expired_rows() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-prune-expired-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Prune Expired".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"prune-expired-secret"
            })),
        })
        .expect("upsert prune-expired account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-prune-expired-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace prune-expired members");

    let expired_now = now_ms().saturating_sub(1);
    {
        let conn = store
            .lock_conn("expired binding insert")
            .expect("lock oauth pool store for expired binding insert");
        conn.execute(
            "INSERT INTO oauth_session_bindings (
                    session_id, pool_id, workspace_id, account_id, bound_at, expires_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                "session-expired-old",
                "pool-codex",
                "",
                "codex-prune-expired-a1",
                expired_now,
                expired_now
            ],
        )
        .expect("insert expired session binding");
    }

    let _ = store
        .select_pool_account(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("session-fresh-new".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select to trigger session prune");

    let conn = store
        .lock_conn("expired binding read")
        .expect("lock oauth pool store for expired binding read");
    let still_exists: Option<String> = conn
        .query_row(
            "SELECT session_id FROM oauth_session_bindings
                 WHERE session_id = ?1 AND pool_id = ?2 AND workspace_id = ?3",
            params!["session-expired-old", "pool-codex", ""],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .expect("query expired session binding");
    assert!(still_exists.is_none());
}

#[test]
fn select_pool_account_with_reason_reports_pool_exhausted() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");

    let (selection, miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("miss-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select with miss reason");

    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::PoolExhausted));
}

#[test]
fn select_pool_account_with_reason_reports_rate_limited() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-rate-limited-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Rate Limited".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"rate-limited-secret"
            })),
        })
        .expect("upsert rate-limited account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-rate-limited-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace pool members");
    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-rate-limited-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: Some(60),
            reset_at: None,
            error_code: Some("rate_limit_exceeded".to_string()),
            error_message: Some("rate limited".to_string()),
        })
        .expect("report rate limit");

    let (selection, miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("rate-limit-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select with miss reason");

    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::RateLimited));
}

#[test]
fn report_rate_limit_preserves_existing_active_reset_when_followup_has_no_retry_window() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-reset-preserve-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Reset Preserve".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"reset-preserve-secret"
            })),
        })
        .expect("upsert reset-preserve account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-reset-preserve-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace pool members");

    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-reset-preserve-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: Some(120),
            reset_at: None,
            error_code: Some("rate_limit_exceeded".to_string()),
            error_message: Some("rate limited".to_string()),
        })
        .expect("report initial rate limit");

    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-reset-preserve-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: None,
            error_message: None,
        })
        .expect("report followup without retry window");

    let (selection, miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("reset-preserve-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select after followup report");

    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::RateLimited));
}

#[test]
fn report_rate_limit_applies_fallback_cooldown_when_signal_has_no_retry_after() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-fallback-cooldown-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Fallback Cooldown".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"fallback-cooldown-secret"
            })),
        })
        .expect("upsert fallback-cooldown account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-fallback-cooldown-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace pool members");

    let before_report = now_ms();
    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-fallback-cooldown-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: Some("too_many_requests".to_string()),
            error_message: Some("429 Too Many Requests".to_string()),
        })
        .expect("report fallback cooldown signal");

    let conn = store
        .lock_conn("fallback cooldown read")
        .expect("lock oauth pool store for fallback cooldown read");
    let reset_at: Option<u64> = conn
        .query_row(
            "SELECT reset_at FROM oauth_rate_limits WHERE account_id = ?1 AND scope_model = ?2",
            params!["codex-fallback-cooldown-a1", "gpt-5.3-codex"],
            |row| row.get(0),
        )
        .optional()
        .expect("query fallback cooldown reset_at")
        .flatten();
    let reported_reset_at = reset_at.expect("fallback cooldown reset_at");
    assert!(reported_reset_at > before_report);
    drop(conn);

    let (selection, miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("fallback-cooldown-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select after fallback cooldown");

    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::RateLimited));
}

#[test]
fn report_rate_limit_policy_signal_marks_account_validation_blocked() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-policy-block-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Policy Block".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"policy-block-secret"
            })),
        })
        .expect("upsert policy-block account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-policy-block-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace policy-block members");

    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-policy-block-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: Some("policy_violation".to_string()),
            error_message: Some("request blocked by policy violation".to_string()),
        })
        .expect("report policy signal");

    let accounts = store
        .list_accounts(Some("codex"))
        .expect("list codex accounts");
    let account = accounts
        .iter()
        .find(|entry| entry.account_id == "codex-policy-block-a1")
        .expect("policy-block account");
    assert_eq!(account.status, "validation_blocked");
    assert_eq!(
        account.disabled_reason.as_deref(),
        Some("oauth_policy_blocked")
    );

    let (selection, miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("policy-block-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select after policy block");

    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::PoolExhausted));
}

#[test]
fn report_rate_limit_validation_required_signal_marks_account_validation_blocked() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-validation-required-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Validation Required".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"validation-required-secret"
            })),
        })
        .expect("upsert validation-required account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-validation-required-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace validation-required members");

    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-validation-required-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: None,
            error_message: Some(
                "Validation required: captcha challenge due to suspicious activity.".to_string(),
            ),
        })
        .expect("report validation-required signal");

    let accounts = store
        .list_accounts(Some("codex"))
        .expect("list codex accounts");
    let account = accounts
        .iter()
        .find(|entry| entry.account_id == "codex-validation-required-a1")
        .expect("validation-required account");
    assert_eq!(account.status, "validation_blocked");
    assert_eq!(
        account.disabled_reason.as_deref(),
        Some("oauth_policy_blocked")
    );
}

#[test]
fn report_rate_limit_permission_denied_signal_marks_account_forbidden() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-permission-denied-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Permission Denied".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"permission-denied-secret"
            })),
        })
        .expect("upsert permission-denied account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-permission-denied-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace permission-denied members");

    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-permission-denied-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: Some("PERMISSION_DENIED".to_string()),
            error_message: Some("HTTP 403 Forbidden: insufficient permissions".to_string()),
        })
        .expect("report permission-denied signal");

    let accounts = store
        .list_accounts(Some("codex"))
        .expect("list codex accounts");
    let account = accounts
        .iter()
        .find(|entry| entry.account_id == "codex-permission-denied-a1")
        .expect("permission-denied account");
    assert_eq!(account.status, "forbidden");
    assert_eq!(
        account.disabled_reason.as_deref(),
        Some("oauth_provider_forbidden")
    );

    let (selection, miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("permission-denied-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select after permission denied");
    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::PoolExhausted));
}

#[test]
fn report_rate_limit_resource_exhausted_signal_applies_fallback_cooldown() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-resource-exhausted-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Resource Exhausted".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"resource-exhausted-secret"
            })),
        })
        .expect("upsert resource-exhausted account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-resource-exhausted-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace resource-exhausted members");

    let before_report = now_ms();
    store
        .report_rate_limit(OAuthRateLimitReportInput {
            account_id: "codex-resource-exhausted-a1".to_string(),
            model_id: Some("gpt-5.3-codex".to_string()),
            success: false,
            retry_after_sec: None,
            reset_at: None,
            error_code: Some("RESOURCE_EXHAUSTED".to_string()),
            error_message: Some("Quota exceeded: resource exhausted".to_string()),
        })
        .expect("report resource exhausted signal");

    let conn = store
        .lock_conn("resource exhausted fallback cooldown read")
        .expect("lock oauth pool store for resource exhausted read");
    let reset_at: Option<u64> = conn
        .query_row(
            "SELECT reset_at FROM oauth_rate_limits WHERE account_id = ?1 AND scope_model = ?2",
            params!["codex-resource-exhausted-a1", "gpt-5.3-codex"],
            |row| row.get(0),
        )
        .optional()
        .expect("query resource exhausted reset_at")
        .flatten();
    let reported_reset_at = reset_at.expect("resource exhausted reset_at");
    assert!(reported_reset_at > before_report);
}

#[test]
fn select_pool_account_with_reason_reports_auth_missing() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-auth-missing-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Auth Missing".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({})),
        })
        .expect("upsert auth-missing account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-auth-missing-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace pool members");

    let (selection, miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("auth-missing-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select with miss reason");

    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::AuthMissing));
}

#[test]
fn select_pool_account_with_reason_reports_decrypt_failed() {
    const WRONG_SECRET_KEY_B64: &str = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";
    let db_path = temp_db_path("oauth-pool-decrypt-failed");
    let db_path_string = db_path.to_string_lossy().to_string();

    let store = OAuthPoolStore::open(db_path_string.as_str(), Some(TEST_SECRET_KEY_B64))
        .expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-decrypt-failed-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Decrypt Failed".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"decrypt-failed-secret"
            })),
        })
        .expect("upsert decrypt-failed account");
    store
        .replace_pool_members(
            "pool-codex",
            &[OAuthPoolMemberInput {
                account_id: "codex-decrypt-failed-a1".to_string(),
                weight: Some(1),
                priority: Some(0),
                position: Some(0),
                enabled: Some(true),
            }],
        )
        .expect("replace pool members");
    drop(store);

    let reopened = OAuthPoolStore::open(db_path_string.as_str(), Some(WRONG_SECRET_KEY_B64))
        .expect("open oauth pool store with wrong secret");
    let (selection, miss_reason) = reopened
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("decrypt-failed-session-1".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select with miss reason");

    assert!(selection.is_none());
    assert_eq!(miss_reason, Some(OAuthPoolSelectMissReason::DecryptFailed));

    cleanup_db_path(&db_path);
}

#[test]
fn probe_pool_account_with_reason_does_not_advance_round_robin_cursor() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    for account_id in ["codex-probe-a1", "codex-probe-a2"] {
        store
            .upsert_account(OAuthAccountUpsertInput {
                account_id: account_id.to_string(),
                provider: "codex".to_string(),
                external_account_id: None,
                email: None,
                display_name: Some(format!("Codex {account_id}")),
                status: Some("enabled".to_string()),
                disabled_reason: None,
                metadata: Some(json!({
                    "apiKey": format!("{account_id}-secret")
                })),
            })
            .expect("upsert probe account");
    }
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex".to_string(),
            provider: "codex".to_string(),
            name: "Codex Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("balance".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("set deterministic pool strategy for probe cursor test");
    store
        .replace_pool_members(
            "pool-codex",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-probe-a1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-probe-a2".to_string(),
                    weight: Some(1),
                    priority: Some(1),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace probe pool members");

    let (probe_selection, probe_miss_reason) = store
        .probe_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: None,
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("probe pool account with reason");
    assert_eq!(probe_miss_reason, None);
    assert_eq!(
        probe_selection
            .as_ref()
            .map(|entry| entry.account.account_id.as_str()),
        Some("codex-probe-a1")
    );

    let (select_first, first_miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("probe-cursor-session-a".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select first account");
    assert_eq!(first_miss_reason, None);
    assert_eq!(
        select_first
            .as_ref()
            .map(|entry| entry.account.account_id.as_str()),
        Some("codex-probe-a1")
    );

    let (select_second, second_miss_reason) = store
        .select_pool_account_with_reason(OAuthPoolSelectionInput {
            pool_id: "pool-codex".to_string(),
            session_id: Some("probe-cursor-session-b".to_string()),
            workspace_id: None,
            model_id: Some("gpt-5.3-codex".to_string()),
        })
        .expect("select second account");
    assert_eq!(second_miss_reason, None);
    assert_eq!(
        select_second
            .as_ref()
            .map(|entry| entry.account.account_id.as_str()),
        Some("codex-probe-a2")
    );
}

#[test]
fn select_pool_account_round_robin_respects_member_weights() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-weighted-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Weighted A".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"weighted-a-secret"
            })),
        })
        .expect("upsert weighted account a");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-weighted-b1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Weighted B".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"weighted-b-secret"
            })),
        })
        .expect("upsert weighted account b");
    store
        .upsert_pool(OAuthPoolUpsertInput {
            pool_id: "pool-codex-weighted".to_string(),
            provider: "codex".to_string(),
            name: "Codex Weighted Pool".to_string(),
            strategy: Some("round_robin".to_string()),
            sticky_mode: Some("cache_first".to_string()),
            preferred_account_id: None,
            enabled: Some(true),
            metadata: json!({}),
        })
        .expect("upsert weighted pool");
    store
        .replace_pool_members(
            "pool-codex-weighted",
            &[
                OAuthPoolMemberInput {
                    account_id: "codex-weighted-a1".to_string(),
                    weight: Some(2),
                    priority: Some(0),
                    position: Some(0),
                    enabled: Some(true),
                },
                OAuthPoolMemberInput {
                    account_id: "codex-weighted-b1".to_string(),
                    weight: Some(1),
                    priority: Some(0),
                    position: Some(1),
                    enabled: Some(true),
                },
            ],
        )
        .expect("replace weighted pool members");

    let select = || {
        store
            .select_pool_account(OAuthPoolSelectionInput {
                pool_id: "pool-codex-weighted".to_string(),
                session_id: None,
                workspace_id: None,
                model_id: Some("gpt-5.3-codex".to_string()),
            })
            .expect("select weighted account")
            .expect("weighted selection result")
            .account
            .account_id
    };

    assert_eq!(select(), "codex-weighted-a1");
    assert_eq!(select(), "codex-weighted-a1");
    assert_eq!(select(), "codex-weighted-b1");
}

#[test]
fn upsert_account_auto_syncs_default_pool_membership() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-auto-member-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Auto Member".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-auto-member-key"
            })),
        })
        .expect("upsert enabled account");
    let members_enabled = store
        .list_pool_members("pool-codex")
        .expect("list codex pool members");
    assert!(members_enabled
        .iter()
        .any(|member| member.account_id == "codex-auto-member-a1" && member.enabled));

    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-auto-member-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Auto Member Disabled".to_string()),
            status: Some("disabled".to_string()),
            disabled_reason: Some("manual".to_string()),
            metadata: None,
        })
        .expect("upsert disabled account");
    let members_disabled = store
        .list_pool_members("pool-codex")
        .expect("list codex pool members after disable");
    assert!(members_disabled
        .iter()
        .any(|member| member.account_id == "codex-auto-member-a1" && !member.enabled));
}

#[test]
fn upsert_account_provider_change_reassigns_default_pool_membership() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "multi-provider-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Multi Provider".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"provider-1-key"
            })),
        })
        .expect("upsert codex account");
    let codex_members = store
        .list_pool_members("pool-codex")
        .expect("list codex pool members");
    assert!(codex_members
        .iter()
        .any(|member| member.account_id == "multi-provider-a1"));

    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "multi-provider-a1".to_string(),
            provider: "gemini".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Multi Provider Gemini".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"provider-2-key"
            })),
        })
        .expect("upsert gemini account");

    let codex_members_after = store
        .list_pool_members("pool-codex")
        .expect("list codex members after provider switch");
    assert!(!codex_members_after
        .iter()
        .any(|member| member.account_id == "multi-provider-a1"));
    let gemini_members_after = store
        .list_pool_members("pool-gemini")
        .expect("list gemini members after provider switch");
    assert!(gemini_members_after
        .iter()
        .any(|member| member.account_id == "multi-provider-a1" && member.enabled));
}

#[test]
fn set_primary_account_syncs_primary_row_and_default_pool_projection() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-primary-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: Some("chatgpt-account-a1".to_string()),
            email: Some("primary-a1@example.com".to_string()),
            display_name: Some("Codex Primary A1".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-primary-a1-key"
            })),
        })
        .expect("upsert primary account");

    let summary = store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: Some("codex-primary-a1".to_string()),
        })
        .expect("set primary account");
    assert_eq!(summary.provider, "codex");
    assert_eq!(summary.account_id.as_deref(), Some("codex-primary-a1"));
    assert_eq!(
        summary.route_account_id.as_deref(),
        Some("codex-primary-a1")
    );
    assert!(summary.in_sync);
    let account = summary.account.expect("primary account summary");
    assert_eq!(account.account_id, "codex-primary-a1");

    let conn = store
        .lock_conn("assert primary account projection")
        .expect("lock oauth pool store");
    let primary_row_account_id: Option<String> = conn
        .query_row(
            "SELECT account_id FROM oauth_primary_accounts WHERE provider = ?1",
            ["codex"],
            |row| row.get(0),
        )
        .optional()
        .expect("query primary row")
        .flatten();
    assert_eq!(primary_row_account_id.as_deref(), Some("codex-primary-a1"));
    let default_pool_preferred_account_id: Option<String> = conn
        .query_row(
            "SELECT preferred_account_id FROM oauth_pools WHERE pool_id = ?1 AND provider = ?2",
            params!["pool-codex", "codex"],
            |row| row.get(0),
        )
        .optional()
        .expect("query default pool projection")
        .flatten();
    assert_eq!(
        default_pool_preferred_account_id.as_deref(),
        Some("codex-primary-a1")
    );
}

#[test]
fn set_primary_account_recreates_missing_default_pool_before_sync() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-primary-recreate-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Primary Recreate".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-primary-recreate-key"
            })),
        })
        .expect("upsert account");

    let removed = store
        .remove_pool("pool-codex")
        .expect("remove default pool");
    assert!(removed);

    let summary = store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: Some("codex-primary-recreate-a1".to_string()),
        })
        .expect("set primary account");
    assert_eq!(
        summary.route_account_id.as_deref(),
        Some("codex-primary-recreate-a1")
    );

    let conn = store
        .lock_conn("assert recreated default pool")
        .expect("lock oauth pool store");
    let recreated_pool_preferred_account_id: Option<String> = conn
        .query_row(
            "SELECT preferred_account_id FROM oauth_pools WHERE pool_id = ?1 AND provider = ?2",
            params!["pool-codex", "codex"],
            |row| row.get(0),
        )
        .optional()
        .expect("query recreated pool")
        .flatten();
    assert_eq!(
        recreated_pool_preferred_account_id.as_deref(),
        Some("codex-primary-recreate-a1")
    );
}

#[test]
fn set_primary_account_clear_resets_primary_row_and_default_pool_projection() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-primary-clear-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Primary Clear".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"codex-primary-clear-key"
            })),
        })
        .expect("upsert account");
    store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: Some("codex-primary-clear-a1".to_string()),
        })
        .expect("set primary account");

    let cleared = store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: None,
        })
        .expect("clear primary account");
    assert_eq!(cleared.account_id, None);
    assert!(cleared.account.is_none());
    assert_eq!(cleared.route_account_id, None);
    assert!(cleared.in_sync);

    let conn = store
        .lock_conn("assert cleared primary projection")
        .expect("lock oauth pool store");
    let primary_row_account_id: Option<String> = conn
        .query_row(
            "SELECT account_id FROM oauth_primary_accounts WHERE provider = ?1",
            ["codex"],
            |row| row.get(0),
        )
        .optional()
        .expect("query primary row")
        .flatten();
    assert!(primary_row_account_id.is_none());
    let default_pool_preferred_account_id: Option<String> = conn
        .query_row(
            "SELECT preferred_account_id FROM oauth_pools WHERE pool_id = ?1 AND provider = ?2",
            params!["pool-codex", "codex"],
            |row| row.get(0),
        )
        .optional()
        .expect("query default pool projection")
        .flatten();
    assert!(default_pool_preferred_account_id.is_none());
}

#[test]
fn set_primary_account_rejects_invalid_candidates_with_invalid_input_code() {
    let store =
        OAuthPoolStore::open(":memory:", Some(TEST_SECRET_KEY_B64)).expect("open oauth pool store");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "gemini-provider-mismatch-a1".to_string(),
            provider: "gemini".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Gemini Provider Mismatch".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "apiKey":"gemini-provider-mismatch-key"
            })),
        })
        .expect("upsert gemini account");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-disabled-primary-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex Disabled Primary".to_string()),
            status: Some("disabled".to_string()),
            disabled_reason: Some("manual".to_string()),
            metadata: Some(json!({
                "apiKey":"codex-disabled-primary-key"
            })),
        })
        .expect("upsert disabled codex account");
    store
        .upsert_account(OAuthAccountUpsertInput {
            account_id: "codex-no-credential-primary-a1".to_string(),
            provider: "codex".to_string(),
            external_account_id: None,
            email: None,
            display_name: Some("Codex No Credential Primary".to_string()),
            status: Some("enabled".to_string()),
            disabled_reason: None,
            metadata: Some(json!({
                "routingState":{"credentialReady":false}
            })),
        })
        .expect("upsert no-credential codex account");

    let missing_account_error = store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: Some("codex-missing-primary-a1".to_string()),
        })
        .expect_err("missing account should fail");
    assert_eq!(
        missing_account_error.code(),
        OAuthPoolMutationErrorCode::InvalidInput
    );

    let provider_mismatch_error = store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: Some("gemini-provider-mismatch-a1".to_string()),
        })
        .expect_err("provider mismatch should fail");
    assert_eq!(
        provider_mismatch_error.code(),
        OAuthPoolMutationErrorCode::InvalidInput
    );

    let disabled_account_error = store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: Some("codex-disabled-primary-a1".to_string()),
        })
        .expect_err("disabled account should fail");
    assert_eq!(
        disabled_account_error.code(),
        OAuthPoolMutationErrorCode::InvalidInput
    );

    let unroutable_account_error = store
        .set_primary_account(OAuthPrimaryAccountSetInput {
            provider: "codex".to_string(),
            account_id: Some("codex-no-credential-primary-a1".to_string()),
        })
        .expect_err("unroutable account should fail");
    assert_eq!(
        unroutable_account_error.code(),
        OAuthPoolMutationErrorCode::InvalidInput
    );
}

fn temp_db_path(prefix: &str) -> PathBuf {
    std::env::temp_dir().join(format!("{prefix}-{}.db", rand::random::<u64>()))
}

fn cleanup_db_path(path: &PathBuf) {
    let _ = std::fs::remove_file(path);
    let wal = PathBuf::from(format!("{}-wal", path.to_string_lossy()));
    let shm = PathBuf::from(format!("{}-shm", path.to_string_lossy()));
    let _ = std::fs::remove_file(wal);
    let _ = std::fs::remove_file(shm);
}
