use super::*;

fn build_acp_client_capabilities() -> Value {
    json!({
        "terminal": true,
        "configOptions": true,
        "slashCommands": true,
    })
}

fn build_acp_readiness_summary(
    state: &str,
    summary: String,
    reasons: Vec<String>,
    checked_at: u64,
    handshake_state: Option<&str>,
    capability_state: Option<&str>,
    auth_state: Option<&str>,
    protocol_version: Option<String>,
    server_name: Option<String>,
    server_version: Option<String>,
) -> RuntimeBackendReadinessSummary {
    RuntimeBackendReadinessSummary {
        state: state.to_string(),
        summary,
        reasons,
        checked_at: Some(checked_at),
        handshake_state: handshake_state.map(ToOwned::to_owned),
        capability_state: capability_state.map(ToOwned::to_owned),
        auth_state: auth_state.map(ToOwned::to_owned),
        protocol_version,
        server_name,
        server_version,
    }
}

pub(super) fn build_stdio_probe_success(
    checked_at: u64,
    metadata: crate::acp_runtime::AcpInitializeProbeMetadata,
) -> AcpProbeOutcome {
    let mut reasons = Vec::new();
    let handshake_state = if metadata.protocol_version.is_some() {
        "ready"
    } else {
        push_unique_reason(
            &mut reasons,
            "initialize response did not include protocolVersion.",
        );
        "blocked"
    };
    let capability_state = if metadata.capabilities.is_some() {
        "ready"
    } else {
        push_unique_reason(
            &mut reasons,
            "initialize response did not include capabilities.",
        );
        "blocked"
    };
    if metadata.server_name.is_none() {
        push_unique_reason(
            &mut reasons,
            "initialize response did not include server identity.",
        );
    }
    let readiness_state = if handshake_state == "blocked" || capability_state == "blocked" {
        "blocked"
    } else if reasons.is_empty() {
        "ready"
    } else {
        "attention"
    };
    let readiness_summary = match readiness_state {
        "ready" => "ACP initialize handshake completed and runtime capabilities were confirmed."
            .to_string(),
        "attention" => {
            "ACP initialize handshake succeeded, but the runtime is missing some operator-facing readiness metadata."
                .to_string()
        }
        _ => "ACP initialize handshake completed, but the backend did not confirm the required protocol or capabilities."
            .to_string(),
    };
    let config_options = metadata.capabilities.as_ref().and_then(|capabilities| {
        capabilities
            .get("configOptions")
            .cloned()
            .or_else(|| capabilities.get("config_options").cloned())
    });

    AcpProbeOutcome {
        readiness: build_acp_readiness_summary(
            readiness_state,
            readiness_summary.clone(),
            reasons.clone(),
            checked_at,
            Some(handshake_state),
            Some(capability_state),
            Some("not_applicable"),
            metadata.protocol_version.clone(),
            metadata.server_name.clone(),
            metadata.server_version.clone(),
        ),
        healthy: readiness_state == "ready",
        last_error: (readiness_state != "ready").then_some(readiness_summary),
        protocol_version: metadata.protocol_version,
        server_name: metadata.server_name,
        server_version: metadata.server_version,
        config_options,
    }
}

pub(super) fn build_probe_failure(
    checked_at: u64,
    summary: String,
    reason: String,
    handshake_state: Option<&str>,
    capability_state: Option<&str>,
    auth_state: Option<&str>,
) -> AcpProbeOutcome {
    AcpProbeOutcome {
        readiness: build_acp_readiness_summary(
            "blocked",
            summary.clone(),
            vec![reason.clone()],
            checked_at,
            handshake_state,
            capability_state,
            auth_state,
            None,
            None,
            None,
        ),
        healthy: false,
        last_error: Some(reason),
        protocol_version: None,
        server_name: None,
        server_version: None,
        config_options: None,
    }
}

pub(super) async fn probe_acp_http_initialize(
    ctx: &AppContext,
    endpoint: &str,
    headers: &HashMap<String, String>,
) -> AcpProbeOutcome {
    let checked_at = now_ms();
    let mut request = ctx.client.post(endpoint);
    for (key, value) in headers {
        request = request.header(key.as_str(), value.as_str());
    }
    let response = match request
        .json(&json!({
            "jsonrpc": ACP_JSONRPC_VERSION,
            "id": ACP_INITIALIZE_REQUEST_ID,
            "method": "initialize",
            "params": {
                "protocolVersion": ACP_PROTOCOL_VERSION,
                "clientInfo": {
                    "name": "hypecode-runtime",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": build_acp_client_capabilities(),
            }
        }))
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            return build_probe_failure(
                checked_at,
                "ACP HTTP initialize request failed before readiness could be confirmed."
                    .to_string(),
                format!("ACP http initialize request failed: {error}"),
                Some("failed"),
                None,
                Some("unknown"),
            );
        }
    };
    if matches!(
        response.status(),
        reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN
    ) {
        return build_probe_failure(
            checked_at,
            "ACP HTTP endpoint rejected runtime authentication during initialize.".to_string(),
            format!(
                "ACP http initialize returned auth status {}.",
                response.status()
            ),
            Some("rejected"),
            None,
            Some("failed"),
        );
    }
    if !response.status().is_success() {
        return build_probe_failure(
            checked_at,
            "ACP HTTP endpoint did not accept the initialize handshake.".to_string(),
            format!("ACP http initialize returned status {}.", response.status()),
            Some("failed"),
            None,
            Some("unknown"),
        );
    }
    let payload = match response.json::<Value>().await {
        Ok(value) => value,
        Err(error) => {
            return build_probe_failure(
                checked_at,
                "ACP HTTP endpoint responded, but not with a valid JSON-RPC initialize payload."
                    .to_string(),
                format!("ACP http initialize returned invalid JSON: {error}"),
                Some("failed"),
                None,
                Some("unknown"),
            );
        }
    };
    let response: AcpHttpJsonRpcResponse = match serde_json::from_value(payload) {
        Ok(value) => value,
        Err(error) => {
            return build_probe_failure(
                checked_at,
                "ACP HTTP endpoint responded, but the payload was not a JSON-RPC initialize response."
                    .to_string(),
                format!("ACP http initialize response shape was invalid: {error}"),
                Some("failed"),
                None,
                Some("unknown"),
            );
        }
    };
    if response.id != json!(ACP_INITIALIZE_REQUEST_ID) {
        return build_probe_failure(
            checked_at,
            "ACP HTTP endpoint replied with a mismatched initialize response id.".to_string(),
            "ACP http initialize response id did not match the request id.".to_string(),
            Some("failed"),
            None,
            Some("unknown"),
        );
    }
    if let Some(error) = response.error {
        let reason = error.message;
        let auth_state = if reason.to_ascii_lowercase().contains("auth")
            || reason.to_ascii_lowercase().contains("token")
            || reason.to_ascii_lowercase().contains("forbidden")
            || reason.to_ascii_lowercase().contains("unauthorized")
        {
            Some("failed")
        } else {
            Some("unknown")
        };
        return build_probe_failure(
            checked_at,
            "ACP HTTP initialize handshake was rejected by the backend.".to_string(),
            format!("ACP initialize failed: {reason}"),
            Some("rejected"),
            None,
            auth_state,
        );
    }
    let result: AcpHttpInitializeResult = match serde_json::from_value(
        response.result.unwrap_or(Value::Null),
    ) {
        Ok(value) => value,
        Err(error) => {
            return build_probe_failure(
                    checked_at,
                    "ACP HTTP initialize succeeded at the transport layer, but the result payload was invalid."
                        .to_string(),
                    format!("ACP http initialize result was invalid: {error}"),
                    Some("failed"),
                    None,
                    Some("unknown"),
                );
        }
    };
    let mut reasons = Vec::new();
    let handshake_state = if result.protocol_version.is_some() {
        "ready"
    } else {
        push_unique_reason(
            &mut reasons,
            "initialize response did not include protocolVersion.",
        );
        "blocked"
    };
    let capability_state = if result.capabilities.is_some() {
        "ready"
    } else {
        push_unique_reason(
            &mut reasons,
            "initialize response did not include capabilities.",
        );
        "blocked"
    };
    if result
        .server_info
        .as_ref()
        .and_then(|server| server.name.as_deref())
        .is_none()
    {
        push_unique_reason(
            &mut reasons,
            "initialize response did not include server identity.",
        );
    }
    let readiness_state = if handshake_state == "blocked" || capability_state == "blocked" {
        "blocked"
    } else if reasons.is_empty() {
        "ready"
    } else {
        "attention"
    };
    let summary = match readiness_state {
        "ready" => "ACP HTTP initialize handshake completed and runtime capabilities were confirmed."
            .to_string(),
        "attention" => {
            "ACP HTTP initialize handshake succeeded, but the backend omitted some readiness metadata."
                .to_string()
        }
        _ => "ACP HTTP endpoint responded, but it did not confirm ACP protocol readiness."
            .to_string(),
    };
    let protocol_version = result.protocol_version.clone();
    let server_name = result
        .server_info
        .as_ref()
        .and_then(|server| server.name.clone());
    let server_version = result
        .server_info
        .as_ref()
        .and_then(|server| server.version.clone());
    let config_options = result.capabilities.as_ref().and_then(|capabilities| {
        capabilities
            .get("configOptions")
            .cloned()
            .or_else(|| capabilities.get("config_options").cloned())
    });

    AcpProbeOutcome {
        readiness: build_acp_readiness_summary(
            readiness_state,
            summary.clone(),
            reasons.clone(),
            checked_at,
            Some(handshake_state),
            Some(capability_state),
            Some("ready"),
            protocol_version.clone(),
            server_name.clone(),
            server_version.clone(),
        ),
        healthy: readiness_state == "ready",
        last_error: (readiness_state != "ready").then_some(summary),
        protocol_version,
        server_name,
        server_version,
        config_options,
    }
}
