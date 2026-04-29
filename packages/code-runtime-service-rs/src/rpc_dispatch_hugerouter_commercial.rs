use super::*;

const HUGEROUTER_ROUTE_TOKEN_ENV_KEY: &str = "HUGEROUTER_ROUTE_TOKEN";
const HUGEROUTER_DEFAULT_ROUTE_BASE_URL: &str = "https://hugerouter.openhuge.local/v1";
const HUGEROUTER_REDACTED_TOKEN: &str = "runtime_managed_route_token_redacted";

pub(super) async fn handle_hugerouter_commercial_service_read(
    ctx: &AppContext,
) -> Result<Value, RpcError> {
    Ok(build_hugerouter_commercial_service_snapshot(ctx))
}

pub(super) async fn handle_hugerouter_route_token_issue(
    ctx: &AppContext,
    params: &Value,
) -> Result<Value, RpcError> {
    let params = as_object(params)?;
    let env_key = read_optional_string(params, "envKey")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| HUGEROUTER_ROUTE_TOKEN_ENV_KEY.to_string());
    let scopes = params
        .get("scopes")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|values| !values.is_empty())
        .unwrap_or_else(default_hugerouter_route_token_scopes);

    let Some(secret) = resolve_runtime_managed_hugerouter_token(ctx) else {
        return Err(RpcError::invalid_params(
            "HugeRouter route-token issue requires HUGEROUTER_ROUTE_TOKEN or CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY.",
        ));
    };

    Ok(json!({
        "token": HUGEROUTER_REDACTED_TOKEN,
        "summary": build_hugerouter_route_token_summary(env_key.as_str(), Some(secret.as_str()), scopes),
    }))
}

fn build_hugerouter_commercial_service_snapshot(ctx: &AppContext) -> Value {
    let route_token = resolve_runtime_managed_hugerouter_token(ctx);
    let route_base_url = resolve_hugerouter_route_base_url(ctx, route_token.as_deref());
    let status = match (route_base_url.as_ref(), route_token.as_ref()) {
        (Some(_), Some(_)) => "connected",
        (Some(_), None) | (None, Some(_)) => "action_required",
        (None, None) => "not_connected",
    };
    let connected = status == "connected";

    json!({
        "connection": {
            "status": status,
            "tenantId": connected.then_some("runtime-configured"),
            "projectId": connected.then_some("runtime-default"),
            "accountLabel": connected.then_some("Runtime-managed HugeRouter route"),
            "dashboardUrl": connected.then_some("https://hugerouter.openhuge.local/dashboard"),
            "routeBaseUrl": route_base_url,
            "diagnostics": build_hugerouter_diagnostics(ctx, route_token.as_deref()),
        },
        "capacity": connected.then(|| json!({
            "capacityKind": "reserved",
            "planId": "hugerouter-pro",
            "planName": "HugeRouter Pro",
            "includedMonthlyCredits": 1_000_000,
            "remainingCredits": Value::Null,
            "concurrencyLimit": 4,
            "sharedCapacityEligible": true,
            "burstCapacityEligible": true,
            "resetsAt": Value::Null,
        })),
        "availablePlans": default_hugerouter_plans(),
        "order": connected.then(|| json!({
            "orderId": Value::Null,
            "status": "active",
            "planId": "hugerouter-pro",
            "checkoutUrl": Value::Null,
            "manageUrl": "https://hugerouter.openhuge.local/dashboard",
            "nextBillingAt": Value::Null,
        })),
        "routeToken": build_hugerouter_route_token_summary(
            HUGEROUTER_ROUTE_TOKEN_ENV_KEY,
            route_token.as_deref(),
            default_hugerouter_route_token_scopes(),
        ),
    })
}

fn resolve_hugerouter_route_base_url(ctx: &AppContext, route_token: Option<&str>) -> Option<String> {
    normalized_openai_compat_base_url(&ctx.config).or_else(|| {
        route_token
            .filter(|token| !token.trim().is_empty())
            .map(|_| HUGEROUTER_DEFAULT_ROUTE_BASE_URL.to_string())
    })
}

fn resolve_runtime_managed_hugerouter_token(ctx: &AppContext) -> Option<String> {
    std::env::var(HUGEROUTER_ROUTE_TOKEN_ENV_KEY)
        .ok()
        .and_then(|value| optional_non_empty_string(value.as_str()))
        .or_else(|| optional_non_empty_string(ctx.config.openai_compat_api_key.as_deref()?))
}

fn optional_non_empty_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn build_hugerouter_route_token_summary(
    env_key: &str,
    token: Option<&str>,
    scopes: Vec<String>,
) -> Value {
    let active = token.map(str::trim).is_some_and(|value| !value.is_empty());
    json!({
        "tokenId": active.then(|| format!("runtime-managed:{}", env_key.trim())),
        "status": if active { "active" } else { "not_issued" },
        "envKey": env_key.trim(),
        "expiresAt": Value::Null,
        "scopes": scopes,
        "lastIssuedAt": Value::Null,
        "lastFour": token.and_then(last_four),
    })
}

fn last_four(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut chars = trimmed.chars().rev().take(4).collect::<Vec<_>>();
    chars.reverse();
    Some(chars.into_iter().collect())
}

fn default_hugerouter_route_token_scopes() -> Vec<String> {
    [
        "route:codex",
        "route:claude",
        "provider:any-relay",
        "provider:hugerouter-commercial",
    ]
    .iter()
    .map(|value| (*value).to_string())
    .collect()
}

fn default_hugerouter_plans() -> Vec<Value> {
    vec![
        json!({
            "planId": "hugerouter-pro",
            "name": "HugeRouter Pro",
            "description": "Runtime-managed HugeRouter route capacity for Codex and Claude provider paths.",
            "capacityKind": "included",
            "includedMonthlyCredits": 1_000_000,
            "currency": "USD",
            "unitPriceLabel": "included",
            "orderUrl": "https://hugerouter.openhuge.local/orders/new?plan=hugerouter-pro",
        }),
        json!({
            "planId": "hugerouter-scale",
            "name": "HugeRouter Scale",
            "description": "Reserved commercial capacity for higher concurrency HugeCode launches.",
            "capacityKind": "reserved",
            "includedMonthlyCredits": 10_000_000,
            "currency": "USD",
            "unitPriceLabel": "reserved",
            "orderUrl": "https://hugerouter.openhuge.local/orders/new?plan=hugerouter-scale",
        }),
    ]
}

fn build_hugerouter_diagnostics(ctx: &AppContext, route_token: Option<&str>) -> Vec<String> {
    let mut diagnostics = Vec::new();
    if normalized_openai_compat_base_url(&ctx.config).is_some() {
        diagnostics.push("CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL is configured.".to_string());
    } else if route_token.is_some() {
        diagnostics.push("Using the default HugeRouter Responses-compatible /v1 route base.".to_string());
    } else {
        diagnostics.push("Configure CODE_RUNTIME_SERVICE_OPENAI_COMPAT_BASE_URL for a custom HugeRouter route base.".to_string());
    }
    if route_token.is_some() {
        diagnostics.push("Route token material is runtime-managed and redacted from UI state.".to_string());
    } else {
        diagnostics.push("Set HUGEROUTER_ROUTE_TOKEN or CODE_RUNTIME_SERVICE_OPENAI_COMPAT_API_KEY to activate routing.".to_string());
    }
    diagnostics
}
