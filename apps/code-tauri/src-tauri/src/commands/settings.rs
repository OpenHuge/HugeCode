include!("settings_support.rs");

#[tauri::command]
pub async fn code_app_settings_get() -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_app_settings_get", empty_payload()).await
}

#[tauri::command]
pub async fn code_app_settings_update(payload: Value) -> Result<Value, String> {
    runtime_service::invoke_runtime_rpc("code_app_settings_update", payload).await
}

#[tauri::command]
pub async fn get_app_settings() -> Result<Value, String> {
    code_app_settings_get().await
}

#[tauri::command]
pub async fn update_app_settings(settings: Value) -> Result<Value, String> {
    code_app_settings_update(json!({ "payload": settings })).await
}

#[tauri::command]
pub fn is_mobile_runtime() -> bool {
    cfg!(target_os = "ios") || cfg!(target_os = "android")
}

#[tauri::command]
pub async fn tailscale_status() -> Result<TailscaleStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    let remote_host = configured_remote_host(&settings);
    let Some(command_path) = resolve_command_bin(DEFAULT_TAILSCALE_BIN) else {
        return Ok(TailscaleStatusPayload {
            installed: false,
            running: false,
            version: None,
            dns_name: None,
            host_name: None,
            tailnet_name: None,
            ipv4: Vec::new(),
            ipv6: Vec::new(),
            suggested_remote_host: None,
            message: "Tailscale CLI was not found on this system.".to_string(),
        });
    };

    let payload = match run_json_command(&command_path, &["status", "--json"]) {
        Ok(payload) => payload,
        Err(message) => {
            return Ok(TailscaleStatusPayload {
                installed: true,
                running: false,
                version: None,
                dns_name: None,
                host_name: None,
                tailnet_name: None,
                ipv4: Vec::new(),
                ipv6: Vec::new(),
                suggested_remote_host: None,
                message,
            })
        }
    };

    let root = payload.as_object().cloned().unwrap_or_default();
    let self_object = root
        .get("Self")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let dns_name = get_string_field(&self_object, "DNSName");
    let host_name = get_string_field(&self_object, "HostName");
    let tailnet_name = root
        .get("CurrentTailnet")
        .and_then(Value::as_object)
        .and_then(|tailnet| get_string_field(tailnet, "Name"));
    let version = get_string_field(&root, "Version");
    let backend_state = get_string_field(&root, "BackendState");
    let ips = get_array_strings(self_object.get("TailscaleIPs"));
    let (ipv4, ipv6): (Vec<_>, Vec<_>) =
        ips.into_iter().partition(|address| !address.contains(':'));
    let running = !matches!(
        backend_state.as_deref(),
        Some("NoState" | "Stopped" | "NeedsLogin")
    );
    let message = if running {
        let identity = dns_name
            .as_deref()
            .or(host_name.as_deref())
            .unwrap_or("this device");
        format!("Tailscale connected as {identity}.")
    } else if let Some(state) = backend_state.as_deref() {
        command_message("Tailscale", state)
    } else {
        "Tailscale is installed but not currently connected.".to_string()
    };

    Ok(TailscaleStatusPayload {
        installed: true,
        running,
        version,
        dns_name: dns_name.clone(),
        host_name,
        tailnet_name,
        ipv4,
        ipv6,
        suggested_remote_host: suggested_remote_host(dns_name.as_deref(), &remote_host),
        message,
    })
}

#[tauri::command]
pub async fn netbird_status() -> Result<NetbirdStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    let remote_host = configured_remote_host(&settings);
    let Some(command_path) = resolve_command_bin(DEFAULT_NETBIRD_BIN) else {
        return Ok(NetbirdStatusPayload {
            installed: false,
            running: false,
            version: None,
            dns_name: None,
            host_name: None,
            management_url: None,
            ipv4: Vec::new(),
            suggested_remote_host: None,
            message: "NetBird CLI was not found on this system.".to_string(),
        });
    };

    let payload = match run_json_command(&command_path, &["status", "--json"]) {
        Ok(payload) => payload,
        Err(message) => {
            return Ok(NetbirdStatusPayload {
                installed: true,
                running: false,
                version: None,
                dns_name: None,
                host_name: None,
                management_url: None,
                ipv4: Vec::new(),
                suggested_remote_host: None,
                message,
            })
        }
    };

    let root = payload.as_object().cloned().unwrap_or_default();
    let dns_name = ["peerFQDN", "fqdn", "dnsName"]
        .iter()
        .find_map(|key| get_string_field(&root, key));
    let host_name = ["peerName", "hostname", "hostName"]
        .iter()
        .find_map(|key| get_string_field(&root, key));
    let version = ["daemonVersion", "cliVersion", "version"]
        .iter()
        .find_map(|key| get_string_field(&root, key));
    let management_url = ["managementURL", "managementUrl"]
        .iter()
        .find_map(|key| get_string_field(&root, key));
    let ipv4 = get_array_strings(root.get("netbirdIPs"));
    let ipv4 = if ipv4.is_empty() {
        ["netbirdIp", "ip", "ipv4"]
            .iter()
            .find_map(|key| get_string_field(&root, key))
            .map(|value| vec![value])
            .unwrap_or_default()
    } else {
        ipv4
    };
    let status_text = get_string_field(&root, "status");
    let running = get_bool_field(&root, "connected").unwrap_or_else(|| {
        matches!(
            status_text.as_deref(),
            Some("Connected" | "connected" | "Running" | "running")
        )
    });
    let message = if running {
        let identity = dns_name
            .as_deref()
            .or(host_name.as_deref())
            .unwrap_or("this peer");
        format!("NetBird connected as {identity}.")
    } else if let Some(status_text) = status_text {
        command_message("NetBird", status_text.as_str())
    } else {
        "NetBird is installed but not currently connected.".to_string()
    };

    Ok(NetbirdStatusPayload {
        installed: true,
        running,
        version,
        dns_name: dns_name.clone(),
        host_name,
        management_url,
        ipv4,
        suggested_remote_host: suggested_remote_host(dns_name.as_deref(), &remote_host),
        message,
    })
}

#[tauri::command]
pub async fn tailscale_daemon_command_preview(
) -> Result<TailscaleDaemonCommandPreviewPayload, String> {
    let settings = current_app_settings_object().await?;
    let remote_host = configured_remote_host(&settings);
    let remote_token = configured_remote_token(&settings);
    let port = configured_remote_port(&remote_host);
    let daemon_path = resolve_runtime_service_bin()
        .unwrap_or_else(|| PathBuf::from(DEFAULT_RUNTIME_SERVICE_BIN))
        .display()
        .to_string();
    let args = build_runtime_service_args(port, remote_token.as_deref());
    let command = format_shell_command(&daemon_path, &args);

    Ok(TailscaleDaemonCommandPreviewPayload {
        command,
        daemon_path,
        args,
        token_configured: remote_token.is_some(),
    })
}

#[tauri::command]
pub async fn netbird_daemon_command_preview() -> Result<NetbirdDaemonCommandPreviewPayload, String>
{
    let settings = current_app_settings_object().await?;
    let remote_host = configured_remote_host(&settings);
    let remote_token = configured_remote_token(&settings);
    let port = configured_remote_port(&remote_host);
    let cli_path = resolve_runtime_service_bin()
        .unwrap_or_else(|| PathBuf::from(DEFAULT_RUNTIME_SERVICE_BIN))
        .display()
        .to_string();
    let args = build_runtime_service_args(port, remote_token.as_deref());
    let command = format_shell_command(&cli_path, &args);

    Ok(NetbirdDaemonCommandPreviewPayload {
        command,
        cli_path,
        args,
        token_configured: remote_token.is_some(),
    })
}

#[tauri::command]
pub async fn backend_pool_bootstrap_preview() -> Result<BackendPoolBootstrapPreviewPayload, String>
{
    let settings = current_app_settings_object().await?;
    let remote_host = configured_remote_host(&settings);
    let remote_token_configured = configured_remote_token(&settings).is_some();
    let port = configured_remote_port(&remote_host);
    let runtime_service_bin = resolve_runtime_service_bin()
        .unwrap_or_else(|| PathBuf::from(DEFAULT_RUNTIME_SERVICE_BIN))
        .display()
        .to_string();
    let preview_args = build_runtime_service_preview_args(port, remote_token_configured);
    let workspace_path = first_workspace_path();

    let templates = vec![
        BackendPoolBootstrapTemplatePayload {
            backend_class: "primary",
            title: "Primary backend".to_string(),
            command: format_shell_command(&runtime_service_bin, &preview_args),
            args: preview_args.clone(),
            backend_id_example: "backend-primary-home".to_string(),
            registration_example: build_backend_registration_example(
                "primary",
                "backend-primary-home",
                "Primary Home Backend",
            ),
            notes: vec![
                "Keep one primary backend stable and always reachable for default execution.".to_string(),
                "Use code_runtime_backend_upsert from the control plane to register the backend metadata after the service is reachable.".to_string(),
            ],
        },
        BackendPoolBootstrapTemplatePayload {
            backend_class: "burst",
            title: "Burst backend".to_string(),
            command: format_shell_command(&runtime_service_bin, &preview_args),
            args: preview_args.clone(),
            backend_id_example: "backend-burst-laptop".to_string(),
            registration_example: build_backend_registration_example(
                "burst",
                "backend-burst-laptop",
                "Burst Laptop Backend",
            ),
            notes: vec![
                "Burst backends are expected to join and leave cleanly.".to_string(),
                "Use a short-lived lease and mark rollout or status transitions explicitly instead of inferring availability from overlay state.".to_string(),
            ],
        },
        BackendPoolBootstrapTemplatePayload {
            backend_class: "specialized",
            title: "Specialized backend".to_string(),
            command: format_shell_command(&runtime_service_bin, &preview_args),
            args: preview_args,
            backend_id_example: "backend-specialized-gpu".to_string(),
            registration_example: build_backend_registration_example(
                "specialized",
                "backend-specialized-gpu",
                "Specialized GPU Backend",
            ),
            notes: vec![
                "Advertise explicit capabilities and specialization tags for specialized nodes.".to_string(),
                "Specialization metadata informs pool operations and routing intent only; runtime still confirms placement per task.".to_string(),
            ],
        },
    ];

    Ok(BackendPoolBootstrapPreviewPayload {
        generated_at_ms: now_ms(),
        runtime_service_bin,
        remote_host,
        remote_token_configured,
        workspace_path,
        templates,
    })
}

#[tauri::command]
pub async fn backend_pool_onboarding_preflight(
    input: BackendPoolOnboardingPreflightInput,
) -> Result<BackendPoolOnboardingPreflightPayload, String> {
    let provider = normalize_provider_input(input.provider.as_deref());
    let backend_class = normalize_backend_class_input(input.backend_class.as_deref())
        .map_err(|error| error.to_string())?;
    let overlay = normalize_overlay_input(input.overlay.as_deref());
    let remote_token = input
        .remote_token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let remote_host = normalize_remote_host_input(input.remote_host.as_deref());
    let orbit_ws_url = input
        .orbit_ws_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let runtime_service_bin = resolve_runtime_service_bin()
        .unwrap_or_else(|| PathBuf::from(DEFAULT_RUNTIME_SERVICE_BIN))
        .display()
        .to_string();

    let mut checks = Vec::new();
    let mut warnings = Vec::new();
    let mut errors = Vec::new();
    let mut operator_actions = Vec::new();

    if provider == "orbit" {
        checks.push(onboarding_check(
            "orbit_adapter_unavailable",
            "failed",
            "Orbit onboarding is blocked in the desktop compatibility layer.",
            Some(
                "Use TCP onboarding for now or switch to a build that bundles the Orbit relay adapter."
                    .to_string(),
            ),
            false,
        ));
        warnings.push(diagnostic_reason(
            "orbit_adapter_unavailable",
            "error",
            "Orbit setup is not bundled into this desktop compatibility layer.",
            orbit_ws_url.clone(),
            false,
        ));
        return Ok(BackendPoolOnboardingPreflightPayload {
            generated_at_ms: now_ms(),
            ok: false,
            safe_to_persist: false,
            state: "blocked",
            checks,
            warnings,
            errors,
            profile_patch: None,
            apply_contract: None,
            operator_actions: vec![
                "Switch the remote provider to TCP for validate-before-persist onboarding."
                    .to_string(),
                "Do not save Orbit settings until an Orbit-capable desktop adapter is available."
                    .to_string(),
            ],
        });
    }

    let Some(remote_host) = remote_host else {
        errors.push(diagnostic_reason(
            "remote_host_missing",
            "error",
            "Remote host is required before onboarding can continue.",
            None,
            false,
        ));
        return Ok(BackendPoolOnboardingPreflightPayload {
            generated_at_ms: now_ms(),
            ok: false,
            safe_to_persist: false,
            state: "blocked",
            checks,
            warnings,
            errors,
            profile_patch: None,
            apply_contract: None,
            operator_actions: vec![
                "Provide a desktop backend host and rerun preflight.".to_string()
            ],
        });
    };
    checks.push(onboarding_check(
        "remote_host_present",
        "ok",
        "Remote host draft is present.",
        Some(remote_host.clone()),
        false,
    ));

    let Some(remote_token) = remote_token else {
        errors.push(diagnostic_reason(
            "remote_token_missing",
            "error",
            "Remote token is required before onboarding can continue.",
            None,
            false,
        ));
        return Ok(BackendPoolOnboardingPreflightPayload {
            generated_at_ms: now_ms(),
            ok: false,
            safe_to_persist: false,
            state: "blocked",
            checks,
            warnings,
            errors,
            profile_patch: None,
            apply_contract: None,
            operator_actions: vec![
                "Generate or copy a backend auth token before saving remote settings.".to_string(),
            ],
        });
    };
    checks.push(onboarding_check(
        "remote_token_present",
        "ok",
        "Remote token draft is present.",
        Some("Token is configured and ready for auth validation.".to_string()),
        false,
    ));

    if overlay.as_deref() == Some("tailscale") {
        let status = tailscale_status().await?;
        if status.installed && status.running {
            checks.push(onboarding_check(
                "tailscale_ready",
                "ok",
                "Tailscale helper is installed and running.",
                status.suggested_remote_host.clone(),
                false,
            ));
        } else {
            warnings.push(diagnostic_reason(
                "overlay_helper_missing",
                "warning",
                "Tailscale is selected but not fully ready on this machine.",
                Some(status.message.clone()),
                true,
            ));
            checks.push(onboarding_check(
                "tailscale_ready",
                "warning",
                "Tailscale helper is not fully ready.",
                Some(status.message),
                true,
            ));
        }
    }

    if overlay.as_deref() == Some("netbird") {
        let status = netbird_status().await?;
        if status.installed && status.running {
            checks.push(onboarding_check(
                "netbird_ready",
                "ok",
                "NetBird helper is installed and running.",
                status.suggested_remote_host.clone(),
                false,
            ));
        } else {
            warnings.push(diagnostic_reason(
                "overlay_helper_missing",
                "warning",
                "NetBird is selected but not fully ready on this machine.",
                Some(status.message.clone()),
                true,
            ));
            checks.push(onboarding_check(
                "netbird_ready",
                "warning",
                "NetBird helper is not fully ready.",
                Some(status.message),
                true,
            ));
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|error| format!("Failed to build onboarding preflight HTTP client: {error}"))?;
    let base_url = build_remote_base_url(remote_host.as_str());
    let health_url = format!("{base_url}/health");
    match client.get(health_url).send().await {
        Ok(response) if response.status().is_success() => {
            checks.push(onboarding_check(
                "remote_health_ok",
                "ok",
                "Remote health endpoint responded successfully.",
                Some(format!(
                    "{} {}",
                    response.status().as_u16(),
                    response.status()
                )),
                false,
            ));
        }
        Ok(response) => {
            errors.push(diagnostic_reason(
                "remote_health_failed",
                "error",
                "Remote health endpoint did not respond with success.",
                Some(format!(
                    "{} {}",
                    response.status().as_u16(),
                    response.status()
                )),
                true,
            ));
            checks.push(onboarding_check(
                "remote_health_ok",
                "failed",
                "Remote health endpoint failed.",
                Some(format!(
                    "{} {}",
                    response.status().as_u16(),
                    response.status()
                )),
                true,
            ));
        }
        Err(error) => {
            errors.push(diagnostic_reason(
                "remote_health_unreachable",
                "error",
                "Remote health endpoint could not be reached.",
                Some(error.to_string()),
                true,
            ));
            checks.push(onboarding_check(
                "remote_health_ok",
                "failed",
                "Remote health endpoint could not be reached.",
                Some(error.to_string()),
                true,
            ));
        }
    }

    let rpc_url = format!("{base_url}/rpc");
    match client
        .post(rpc_url)
        .bearer_auth(remote_token.as_str())
        .json(&json!({
            "method": "code_workspaces_list",
            "params": {}
        }))
        .send()
        .await
    {
        Ok(response)
            if response.status() == reqwest::StatusCode::UNAUTHORIZED
                || response.status() == reqwest::StatusCode::FORBIDDEN =>
        {
            errors.push(diagnostic_reason(
                "auth_invalid",
                "error",
                "Remote backend rejected the supplied token.",
                Some(format!(
                    "{} {}",
                    response.status().as_u16(),
                    response.status()
                )),
                false,
            ));
            checks.push(onboarding_check(
                "remote_rpc_auth",
                "failed",
                "Remote RPC auth failed.",
                Some(format!(
                    "{} {}",
                    response.status().as_u16(),
                    response.status()
                )),
                false,
            ));
        }
        Ok(response) if response.status().is_success() => {
            let status = response.status();
            let body = response.json::<Value>().await.map_err(|error| {
                format!("Parse onboarding preflight RPC response failed: {error}")
            })?;
            if body.get("ok").and_then(Value::as_bool) == Some(true) {
                let workspace_count = body
                    .get("result")
                    .and_then(Value::as_array)
                    .map(Vec::len)
                    .unwrap_or(0);
                checks.push(onboarding_check(
                    "remote_rpc_auth",
                    "ok",
                    "Remote RPC auth succeeded.",
                    Some(format!(
                        "{} workspace{} visible after auth.",
                        workspace_count,
                        if workspace_count == 1 { "" } else { "s" }
                    )),
                    false,
                ));
                checks.push(onboarding_check(
                    "remote_workspace_list",
                    "ok",
                    "Workspace listing succeeded against the remote backend.",
                    Some(format!("{} {}", status.as_u16(), status)),
                    false,
                ));
            } else {
                let error_code = body
                    .get("error")
                    .and_then(Value::as_object)
                    .and_then(|error| get_string_field(error, "code"))
                    .unwrap_or_else(|| "REMOTE_RPC_FAILED".to_string());
                let error_message = body
                    .get("error")
                    .and_then(Value::as_object)
                    .and_then(|error| get_string_field(error, "message"));
                errors.push(diagnostic_reason(
                    "remote_rpc_failed",
                    "error",
                    "Remote RPC responded but did not confirm workspace access.",
                    error_message.clone().or(Some(error_code)),
                    true,
                ));
                checks.push(onboarding_check(
                    "remote_workspace_list",
                    "failed",
                    "Workspace listing failed against the remote backend.",
                    error_message,
                    true,
                ));
            }
        }
        Ok(response) => {
            errors.push(diagnostic_reason(
                "remote_rpc_unreachable",
                "error",
                "Remote RPC responded with a non-success status.",
                Some(format!(
                    "{} {}",
                    response.status().as_u16(),
                    response.status()
                )),
                true,
            ));
            checks.push(onboarding_check(
                "remote_workspace_list",
                "failed",
                "Remote RPC responded with a non-success status.",
                Some(format!(
                    "{} {}",
                    response.status().as_u16(),
                    response.status()
                )),
                true,
            ));
        }
        Err(error) => {
            errors.push(diagnostic_reason(
                "remote_rpc_unreachable",
                "error",
                "Remote RPC could not be reached.",
                Some(error.to_string()),
                true,
            ));
            checks.push(onboarding_check(
                "remote_workspace_list",
                "failed",
                "Remote RPC could not be reached.",
                Some(error.to_string()),
                true,
            ));
        }
    }

    let ok = errors.is_empty();
    let profile_patch = ok.then_some(BackendPoolNormalizedProfilePatchPayload {
        provider: provider.to_string(),
        host: Some(remote_host.clone()),
        token: Some(remote_token.clone()),
        orbit_ws_url: None,
        tcp_overlay: overlay.clone(),
    });
    let join_args =
        build_runtime_service_preview_args(configured_remote_port(remote_host.as_str()), true);
    let apply_contract = ok.then_some(BackendPoolPreparedApplyContractPayload {
        backend_class: backend_class.clone(),
        join_command: format_shell_command(runtime_service_bin.as_str(), &join_args),
        join_args,
        env_contract: vec![BackendPoolJoinEnvVarPayload {
            name: "CODEX_BACKEND_TOKEN".to_string(),
            required: true,
            value_hint: Some("paste-the-remote-token".to_string()),
            description:
                "Export this token on the joining node before starting the runtime service."
                    .to_string(),
        }],
        registration_payload: build_backend_registration_contract(
            backend_class.as_str(),
            &format!("backend-{backend_class}-node"),
            &format!(
                "{} Backend",
                backend_class[..1].to_uppercase() + &backend_class[1..]
            ),
            Some(remote_host.as_str()),
            overlay.as_deref(),
        ),
        retry_action: "Fix failing checks and rerun backend_pool_onboarding_preflight.".to_string(),
        regenerate_action:
            "Regenerate the backend token, then rerun preflight before persisting settings."
                .to_string(),
        revoke_action:
            "Revoke the backend token and remove the backend from the registry when offboarding."
                .to_string(),
        operator_actions: vec![
            "Persist the normalized profile only after this preflight passes.".to_string(),
            "Use the prepared registration payload instead of hand-editing backend metadata."
                .to_string(),
        ],
    });

    if ok {
        operator_actions.push(
            "Persist the returned profile patch, then register the backend with the prepared payload."
                .to_string(),
        );
    } else {
        operator_actions.push("Do not persist remote settings until preflight passes.".to_string());
    }

    Ok(BackendPoolOnboardingPreflightPayload {
        generated_at_ms: now_ms(),
        ok,
        safe_to_persist: ok,
        state: if ok {
            "validated"
        } else if errors.iter().all(|error| error.retryable) {
            "retryable_failure"
        } else {
            "blocked"
        },
        checks,
        warnings,
        errors,
        profile_patch,
        apply_contract,
        operator_actions,
    })
}

#[tauri::command]
pub async fn backend_pool_diagnostics() -> Result<BackendPoolDiagnosticsPayload, String> {
    let settings = current_app_settings_object().await?;
    let remote_host = configured_remote_host(&settings);
    let fallback_listen_addr = Some(format!(
        "{DEFAULT_TCP_LISTEN_HOST}:{}",
        configured_remote_port(&remote_host)
    ));
    let runtime_service_bin = resolve_runtime_service_bin()
        .unwrap_or_else(|| PathBuf::from(DEFAULT_RUNTIME_SERVICE_BIN))
        .display()
        .to_string();
    let tailscale = tailscale_status().await?;
    let netbird = netbird_status().await?;
    let tcp_daemon = read_managed_tcp_daemon_status(fallback_listen_addr)?;
    let tcp_overlay = configured_tcp_overlay(&settings);
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();
    let backends_payload =
        runtime_service::invoke_runtime_rpc("code_runtime_backends_list", empty_payload()).await;
    let mut backends = Vec::new();
    let mut operator_actions = Vec::new();

    if !tailscale.installed && !netbird.installed {
        warnings.push(
            "Neither Tailscale nor NetBird CLI was detected. Overlay-assisted onboarding may be unavailable."
                .to_string(),
        );
        reasons.push(diagnostic_reason(
            "overlay_helper_missing",
            "warning",
            "No supported overlay helper is installed on this machine.",
            Some(
                "Install Tailscale or NetBird if operator workflows depend on overlay-assisted connectivity."
                    .to_string(),
            ),
            true,
        ));
    }
    if configured_remote_token(&settings).is_none() {
        warnings.push(
            "Remote backend token is not configured. Self-host onboarding should provision one before exposing a backend."
                .to_string(),
        );
        reasons.push(diagnostic_reason(
            "auth_missing",
            "error",
            "Remote backend token is not configured.",
            Some(
                "Provision a token before trying to onboard or diagnose a self-hosted backend."
                    .to_string(),
            ),
            false,
        ));
    }
    if tcp_daemon.state == "error" {
        warnings.push(
            normalize_optional_text(tcp_daemon.last_error.clone())
                .unwrap_or_else(|| "Managed TCP daemon reported an error state.".to_string()),
        );
        reasons.push(diagnostic_reason(
            "daemon_error",
            "error",
            "Managed TCP daemon reported an error state.",
            normalize_optional_text(tcp_daemon.last_error.clone()),
            true,
        ));
    }

    if let Some(overlay) = tcp_overlay.as_deref() {
        match overlay {
            "tailscale" if !(tailscale.installed && tailscale.running) => {
                reasons.push(diagnostic_reason(
                    "overlay_not_authenticated",
                    "warning",
                    "Tailscale is the selected overlay but is not fully connected.",
                    Some(tailscale.message.clone()),
                    true,
                ))
            }
            "netbird" if !(netbird.installed && netbird.running) => {
                reasons.push(diagnostic_reason(
                    "overlay_not_authenticated",
                    "warning",
                    "NetBird is the selected overlay but is not fully connected.",
                    Some(netbird.message.clone()),
                    true,
                ))
            }
            _ => {}
        }
    }

    match backends_payload {
        Ok(Value::Array(entries)) => {
            for entry in entries {
                if let Some(item) = build_backend_diagnostic_entry(&entry) {
                    backends.push(item);
                }
            }
        }
        Ok(_) => {
            warnings.push("Runtime backend registry returned an unexpected payload.".to_string());
            reasons.push(diagnostic_reason(
                "registry_payload_invalid",
                "error",
                "Runtime backend registry returned an unexpected payload.",
                None,
                true,
            ));
        }
        Err(error) => {
            warnings.push(format!(
                "Runtime backend registry could not be read: {error}"
            ));
            reasons.push(diagnostic_reason(
                "registry_unavailable",
                "error",
                "Runtime backend registry could not be read.",
                Some(error),
                true,
            ));
        }
    }

    if backends.is_empty() {
        warnings.push("No registered backends were reported by the runtime registry.".to_string());
        reasons.push(diagnostic_reason(
            "backend_unregistered",
            "warning",
            "No registered backends were reported by the runtime registry.",
            Some(
                "Run onboarding preflight, persist the validated profile, then register a backend."
                    .to_string(),
            ),
            true,
        ));
    }
    if let Some(default_backend_id) = configured_default_execution_backend_id(&settings) {
        let found = backends
            .iter()
            .any(|backend| backend.backend_id == default_backend_id);
        if !found {
            warnings.push(format!(
                "Default execution backend `{default_backend_id}` is not currently registered."
            ));
            reasons.push(diagnostic_reason(
                "default_backend_missing",
                "warning",
                "Default execution backend is not present in the current backend registry.",
                Some(default_backend_id),
                true,
            ));
        }
    }

    operator_actions.push(
        "Use backend_pool_onboarding_preflight before persisting new remote backend settings."
            .to_string(),
    );
    operator_actions.push(
        "Treat overlay and daemon status as connectivity evidence only; placement truth remains runtime-owned."
            .to_string(),
    );

    Ok(BackendPoolDiagnosticsPayload {
        generated_at_ms: now_ms(),
        runtime_service_bin,
        workspace_path: first_workspace_path(),
        remote_host,
        remote_token_configured: configured_remote_token(&settings).is_some(),
        default_execution_backend_id: configured_default_execution_backend_id(&settings),
        tcp_overlay,
        registry_source: if distributed_backend_registry_enabled() {
            "distributed".to_string()
        } else {
            "native".to_string()
        },
        reasons,
        backends,
        operator_actions,
        tailscale,
        netbird,
        tcp_daemon,
        warnings,
    })
}

#[tauri::command]
pub async fn tailscale_daemon_start() -> Result<TcpDaemonStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    let remote_host = configured_remote_host(&settings);
    let remote_token = configured_remote_token(&settings);
    let port = configured_remote_port(&remote_host);
    let listen_addr = format!("{DEFAULT_TCP_LISTEN_HOST}:{port}");
    let Some(daemon_path) = resolve_runtime_service_bin() else {
        return Ok(errored_tcp_daemon_status(
            Some(listen_addr),
            "code-runtime-service-rs binary was not found. Build it first or use the preview command.",
        ));
    };

    let mut daemon_guard = managed_tcp_daemon()
        .lock()
        .map_err(|_| "Managed TCP daemon state lock poisoned.".to_string())?;

    if let Some(existing) = daemon_guard.as_mut() {
        match existing.child.try_wait() {
            Ok(None) => return Ok(tcp_daemon_status_from_process(existing)),
            Ok(Some(status)) => {
                let exit_message = format!("Managed TCP daemon exited with status {status}.");
                *daemon_guard = None;
                return Ok(errored_tcp_daemon_status(Some(listen_addr), exit_message));
            }
            Err(error) => {
                *daemon_guard = None;
                return Ok(errored_tcp_daemon_status(
                    Some(listen_addr),
                    error.to_string(),
                ));
            }
        }
    }

    let args = build_runtime_service_args(port, remote_token.as_deref());
    let mut command = Command::new(&daemon_path);
    command
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(workspace_path) = first_workspace_path() {
        command.env(
            "CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH",
            workspace_path,
        );
    }

    let child = command
        .spawn()
        .map_err(|error| format!("Failed to start managed TCP daemon: {error}"))?;
    let process = ManagedTcpDaemonProcess {
        daemon_path: daemon_path.display().to_string(),
        listen_addr: listen_addr.clone(),
        started_at_ms: now_ms(),
        child,
    };
    let status = tcp_daemon_status_from_process(&process);
    *daemon_guard = Some(process);
    Ok(status)
}

#[tauri::command]
pub async fn tailscale_daemon_stop() -> Result<TcpDaemonStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    let listen_addr = Some(format!(
        "{DEFAULT_TCP_LISTEN_HOST}:{}",
        configured_remote_port(&configured_remote_host(&settings))
    ));
    let mut daemon_guard = managed_tcp_daemon()
        .lock()
        .map_err(|_| "Managed TCP daemon state lock poisoned.".to_string())?;
    let Some(mut process) = daemon_guard.take() else {
        return Ok(stopped_tcp_daemon_status(listen_addr));
    };

    if let Err(error) = process.child.kill() {
        return Ok(errored_tcp_daemon_status(
            Some(process.listen_addr),
            format!("Failed to stop managed TCP daemon: {error}"),
        ));
    }
    let _ = process.child.wait();
    Ok(stopped_tcp_daemon_status(Some(process.listen_addr)))
}

#[tauri::command]
pub async fn tailscale_daemon_status() -> Result<TcpDaemonStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    let fallback_listen_addr = Some(format!(
        "{DEFAULT_TCP_LISTEN_HOST}:{}",
        configured_remote_port(&configured_remote_host(&settings))
    ));
    read_managed_tcp_daemon_status(fallback_listen_addr)
}

#[tauri::command]
pub async fn orbit_connect_test() -> Result<OrbitConnectTestResultPayload, String> {
    let settings = current_app_settings_object().await?;
    Ok(OrbitConnectTestResultPayload {
        ok: false,
        latency_ms: None,
        message: "Orbit desktop adapter is unavailable in this build.".to_string(),
        details: Some(orbit_unavailable_message(&settings)),
    })
}

#[tauri::command]
pub async fn orbit_sign_in_start() -> Result<Value, String> {
    let settings = current_app_settings_object().await?;
    Err(format!(
        "{} Sign-in cannot continue until an Orbit-capable adapter is bundled.",
        orbit_unavailable_message(&settings)
    ))
}

#[tauri::command]
pub async fn orbit_sign_in_poll(_device_code: String) -> Result<Value, String> {
    let settings = current_app_settings_object().await?;
    Err(format!(
        "{} Polling cannot continue until an Orbit-capable adapter is bundled.",
        orbit_unavailable_message(&settings)
    ))
}

#[tauri::command]
pub async fn orbit_sign_out() -> Result<OrbitSignOutResultPayload, String> {
    let settings = current_app_settings_object().await?;
    Ok(OrbitSignOutResultPayload {
        success: false,
        message: Some(orbit_unavailable_message(&settings)),
    })
}

#[tauri::command]
pub async fn orbit_runner_start() -> Result<OrbitRunnerStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    Ok(OrbitRunnerStatusPayload {
        state: "error",
        pid: None,
        started_at_ms: None,
        last_error: Some(orbit_unavailable_message(&settings)),
        orbit_url: configured_orbit_ws_url(&settings),
    })
}

#[tauri::command]
pub async fn orbit_runner_stop() -> Result<OrbitRunnerStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    Ok(OrbitRunnerStatusPayload {
        state: "error",
        pid: None,
        started_at_ms: None,
        last_error: Some(orbit_unavailable_message(&settings)),
        orbit_url: configured_orbit_ws_url(&settings),
    })
}

#[tauri::command]
pub async fn orbit_runner_status() -> Result<OrbitRunnerStatusPayload, String> {
    let settings = current_app_settings_object().await?;
    Ok(OrbitRunnerStatusPayload {
        state: "error",
        pid: None,
        started_at_ms: None,
        last_error: Some(orbit_unavailable_message(&settings)),
        orbit_url: configured_orbit_ws_url(&settings),
    })
}
