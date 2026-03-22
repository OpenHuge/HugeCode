use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, HeaderMap, StatusCode, Uri},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use super::{
    RuntimeTransportState, ServiceConfig, CODE_RUNTIME_RPC_TRANSPORT_AUTH_HEADER,
    CODE_RUNTIME_RPC_TRANSPORT_AUTH_QUERY,
};

pub(super) fn configured_runtime_auth_token(config: &ServiceConfig) -> Option<&str> {
    config
        .runtime_auth_token
        .as_deref()
        .map(str::trim)
        .filter(|token| !token.is_empty())
}

fn bearer_runtime_auth_token(headers: &HeaderMap) -> Option<&str> {
    let value = headers.get(AUTHORIZATION)?.to_str().ok()?.trim();
    let (scheme, token) = value.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }
    let token = token.trim();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

fn query_runtime_auth_token(uri: &Uri) -> Option<&str> {
    let query = uri.query()?;
    for segment in query.split('&') {
        let mut parts = segment.splitn(2, '=');
        let Some(key) = parts.next() else {
            continue;
        };
        if key != CODE_RUNTIME_RPC_TRANSPORT_AUTH_QUERY {
            continue;
        }
        let value = parts.next().unwrap_or("").trim();
        if value.is_empty() {
            return None;
        }
        return Some(value);
    }
    None
}

fn runtime_transport_request_authorized(
    expected_token: &str,
    headers: &HeaderMap,
    uri: &Uri,
) -> bool {
    let custom_header_matches = headers
        .get(CODE_RUNTIME_RPC_TRANSPORT_AUTH_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(|token| token == expected_token)
        .unwrap_or(false);
    if custom_header_matches {
        return true;
    }

    if bearer_runtime_auth_token(headers)
        .map(|token| token == expected_token)
        .unwrap_or(false)
    {
        return true;
    }

    query_runtime_auth_token(uri)
        .map(|token| token == expected_token)
        .unwrap_or(false)
}

fn runtime_transport_unauthorized_response() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({
            "ok": false,
            "error": {
                "code": "UNAUTHORIZED",
                "message": "Runtime transport authentication required.",
            },
        })),
    )
        .into_response()
}

pub(super) async fn runtime_transport_auth_middleware(
    State(transport): State<RuntimeTransportState>,
    request: Request,
    next: Next,
) -> Response {
    let Some(expected_token) = configured_runtime_auth_token(&transport.config) else {
        return next.run(request).await;
    };
    if runtime_transport_request_authorized(expected_token, request.headers(), request.uri()) {
        next.run(request).await
    } else {
        runtime_transport_unauthorized_response()
    }
}
