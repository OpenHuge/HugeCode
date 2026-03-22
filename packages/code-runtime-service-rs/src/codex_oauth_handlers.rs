use super::*;
use rand::Rng;

#[derive(Debug)]
pub(crate) struct CodexOauthLoopbackListenerHandle {
    shutdown_tx: tokio::sync::watch::Sender<bool>,
}

#[derive(Clone, Debug)]
pub(super) struct PendingCodexOauthLogin {
    pub(super) login_id: String,
    pub(super) workspace_id: String,
    pub(super) redirect_uri: String,
    pub(super) code_verifier: String,
    pub(super) expires_at_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CodexOauthStartInput {
    #[serde(default, alias = "workspace_id")]
    pub(super) workspace_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CodexOauthStartOutput {
    pub(super) login_id: String,
    pub(super) auth_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CodexOauthCancelInput {
    #[serde(default, alias = "workspace_id")]
    pub(super) workspace_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CodexOauthCancelOutput {
    pub(super) canceled: bool,
    pub(super) status: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CodexOauthCallbackQuery {
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    state: Option<String>,
    #[serde(default)]
    error: Option<String>,
    #[serde(default, alias = "error_description")]
    error_description: Option<String>,
}

fn normalize_workspace_id(value: Option<String>) -> String {
    value
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .unwrap_or(CODEX_OAUTH_DEFAULT_WORKSPACE_ID)
        .to_string()
}

fn build_runtime_rpc_origin_headers(runtime_port: u16) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    let host = HeaderValue::from_str(format!("localhost:{runtime_port}").as_str())
        .map_err(|error| format!("Invalid loopback host for Codex OAuth callback: {error}"))?;
    headers.insert(HOST, host);
    Ok(headers)
}

fn sanitize_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn should_use_dedicated_codex_oauth_loopback_listener(config: &ServiceConfig) -> bool {
    config.oauth_public_base_url.is_none()
        && config.oauth_loopback_callback_port != config.runtime_port
}

async fn ensure_codex_oauth_loopback_listener(ctx: &AppContext) -> Result<(), String> {
    if !should_use_dedicated_codex_oauth_loopback_listener(&ctx.config) {
        return Ok(());
    }

    let mut listener_guard = ctx.codex_oauth_loopback_listener.lock().await;
    if listener_guard.is_some() {
        return Ok(());
    }

    let callback_address =
        std::net::SocketAddr::from(([127, 0, 0, 1], ctx.config.oauth_loopback_callback_port));
    let listener = tokio::net::TcpListener::bind(callback_address)
        .await
        .map_err(|error| {
            format!(
                "Port 127.0.0.1:{} is already in use; finish the active OAuth flow or free that port, then retry. ({error})",
                ctx.config.oauth_loopback_callback_port
            )
        })?;
    let callback_app = axum::Router::new()
        .route(
            CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH,
            axum::routing::get(codex_oauth_callback_handler),
        )
        .route(
            CODE_RUNTIME_OAUTH_CODEX_CALLBACK_LEGACY_PATH,
            axum::routing::get(codex_oauth_callback_handler),
        )
        .with_state(ctx.clone())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
    let (shutdown_tx, mut shutdown_rx) = tokio::sync::watch::channel(false);

    tokio::spawn(async move {
        let server = axum::serve(listener, callback_app).with_graceful_shutdown(async move {
            let _ = shutdown_rx.changed().await;
        });
        if let Err(error) = server.await {
            let error_message = error.to_string();
            warn!(
                error = error_message.as_str(),
                "codex oauth loopback listener crashed"
            );
        }
    });

    *listener_guard = Some(CodexOauthLoopbackListenerHandle { shutdown_tx });
    info!("codex oauth callback listening on http://{callback_address}");
    Ok(())
}

async fn maybe_stop_codex_oauth_loopback_listener(ctx: &AppContext) {
    if !should_use_dedicated_codex_oauth_loopback_listener(&ctx.config) {
        return;
    }

    let has_pending_logins = {
        let pending = ctx.codex_oauth_pending_logins.lock().await;
        !pending.is_empty()
    };
    if has_pending_logins {
        return;
    }

    let listener_handle = {
        let mut listener_guard = ctx.codex_oauth_loopback_listener.lock().await;
        listener_guard.take()
    };
    if let Some(listener_handle) = listener_handle {
        let _ = listener_handle.shutdown_tx.send(true);
        info!(
            port = ctx.config.oauth_loopback_callback_port,
            "released codex oauth callback listener"
        );
    }
}

pub(super) fn build_oauth_result_html(title: &str, message: &str, success: bool) -> Html<String> {
    let heading = sanitize_html(title);
    let body = sanitize_html(message);
    let status_class = if success { "success" } else { "error" };
    let status_label = if success { "Success" } else { "Failed" };
    let callback_script = if success {
        r#"<script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "fastcode:oauth:codex", success: true }, "*");
      }
      window.close();
    } catch (_) {}
  </script>"#
    } else {
        r#"<script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "fastcode:oauth:codex", success: false }, "*");
      }
    } catch (_) {}
  </script>"#
    };
    Html(format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{heading}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f6f8; color: #1f2328; margin: 0; }}
    .wrap {{ max-width: 480px; margin: 8vh auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }}
    .status {{ display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 10px; }}
    .status.success {{ background: #e8f5e9; color: #1b5e20; }}
    .status.error {{ background: #ffebee; color: #b71c1c; }}
    h1 {{ margin: 12px 0 8px; font-size: 20px; }}
    p {{ margin: 0; color: #4f5661; line-height: 1.5; }}
  </style>
</head>
<body>
  <main class="wrap">
    <span class="status {status_class}">{status_label}</span>
    <h1>{heading}</h1>
    <p>{body}</p>
  </main>
  {callback_script}
</body>
</html>"#
    ))
}

fn resolve_request_origin(headers: &HeaderMap) -> Option<String> {
    let forwarded_host = headers
        .get("x-forwarded-host")
        .and_then(|entry| entry.to_str().ok())
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string);
    let host = forwarded_host.or_else(|| {
        headers
            .get(HOST)
            .and_then(|entry| entry.to_str().ok())
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(str::to_string)
    })?;
    if host.starts_with("http://") || host.starts_with("https://") {
        return Some(host);
    }

    let forwarded_proto = headers
        .get("x-forwarded-proto")
        .and_then(|entry| entry.to_str().ok())
        .and_then(|entry| entry.split(',').next())
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .unwrap_or("http");
    Some(format!("{forwarded_proto}://{host}"))
}

fn build_codex_oauth_redirect_uri(
    public_base_url: Option<&str>,
    loopback_callback_port: u16,
    headers: &HeaderMap,
) -> Result<String, String> {
    let (origin, from_public_base_url) = if let Some(base_url) = public_base_url {
        let trimmed = base_url.trim();
        if trimmed.is_empty() {
            return Err(
                "CODE_RUNTIME_SERVICE_OAUTH_PUBLIC_BASE_URL is empty; expected absolute URL."
                    .to_string(),
            );
        }
        (trimmed.to_string(), true)
    } else {
        (
            resolve_request_origin(headers)
                .ok_or_else(|| "Missing request host for Codex OAuth callback.".to_string())?,
            false,
        )
    };
    let mut url = reqwest::Url::parse(origin.as_str())
        .map_err(|error| format!("Invalid request origin for Codex OAuth callback: {error}"))?;
    if !from_public_base_url
        && matches!(
            url.host_str(),
            Some("127.0.0.1") | Some("::1") | Some("[::1]") | Some("localhost")
        )
    {
        let _ = url.set_host(Some("localhost"));
        let _ = url.set_port(Some(loopback_callback_port));
    }
    url.set_path(CODE_RUNTIME_OAUTH_CODEX_CALLBACK_PATH);
    url.set_query(None);
    url.set_fragment(None);
    Ok(url.to_string())
}

fn build_codex_authorize_url(
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> Result<String, String> {
    fn percent_encode(input: &str) -> String {
        let mut encoded = String::with_capacity(input.len());
        for byte in input.as_bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(*byte as char);
                }
                _ => {
                    encoded.push('%');
                    let _ = write!(encoded, "{byte:02X}");
                }
            }
        }
        encoded
    }

    let query = [
        ("response_type", "code".to_string()),
        ("client_id", CODEX_OAUTH_CLIENT_ID.to_string()),
        ("redirect_uri", redirect_uri.to_string()),
        ("scope", CODEX_OAUTH_SCOPE.to_string()),
        ("code_challenge", code_challenge.to_string()),
        ("code_challenge_method", "S256".to_string()),
        ("id_token_add_organizations", "true".to_string()),
        ("codex_cli_simplified_flow", "true".to_string()),
        ("state", state.to_string()),
        ("originator", CODEX_OAUTH_ORIGINATOR.to_string()),
    ]
    .into_iter()
    .map(|(key, value)| format!("{key}={}", percent_encode(value.as_str())))
    .collect::<Vec<_>>()
    .join("&");

    Ok(format!("{CODEX_OAUTH_ISSUER}/oauth/authorize?{query}"))
}

fn generate_codex_oauth_state() -> String {
    let mut bytes = [0u8; CODEX_OAUTH_STATE_BYTES];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub(super) fn generate_codex_pkce_verifier() -> String {
    let mut bytes = [0u8; CODEX_OAUTH_PKCE_VERIFIER_BYTES];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn generate_codex_pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn prune_expired_codex_oauth_logins(
    pending: &mut HashMap<String, PendingCodexOauthLogin>,
    now: u64,
) {
    pending.retain(|_, entry| entry.expires_at_ms > now);
}

pub(super) enum PendingCodexOauthLoginLookup {
    Found(PendingCodexOauthLogin),
    Expired(PendingCodexOauthLogin),
    Missing,
}

pub(super) fn take_pending_codex_oauth_login(
    pending: &mut HashMap<String, PendingCodexOauthLogin>,
    state: &str,
    now: u64,
) -> PendingCodexOauthLoginLookup {
    let Some(entry) = pending.remove(state) else {
        prune_expired_codex_oauth_logins(pending, now);
        return PendingCodexOauthLoginLookup::Missing;
    };
    if entry.expires_at_ms <= now {
        return PendingCodexOauthLoginLookup::Expired(entry);
    }
    PendingCodexOauthLoginLookup::Found(entry)
}

#[derive(Debug, Deserialize)]
pub(super) struct CodexOauthTokenResponse {
    #[serde(default)]
    pub(super) refresh_token: Option<String>,
    #[serde(default)]
    pub(super) id_token: Option<String>,
    #[serde(default)]
    pub(super) access_token: Option<String>,
}

#[derive(Debug, Default)]
struct ParsedCodexClaims {
    external_account_id: Option<String>,
    email: Option<String>,
    plan_type: Option<String>,
    chatgpt_workspaces: Vec<oauth_pool::OAuthAccountChatgptWorkspace>,
    default_chatgpt_workspace_id: Option<String>,
}

fn parse_chatgpt_workspace_from_codex_claims(
    value: &Value,
) -> Option<oauth_pool::OAuthAccountChatgptWorkspace> {
    let object = value.as_object()?;
    let workspace_id = parse_optional_non_empty_string(
        object
            .get("workspace_id")
            .or_else(|| object.get("workspaceId"))
            .or_else(|| object.get("organization_id"))
            .or_else(|| object.get("organizationId"))
            .or_else(|| object.get("id")),
    )?;
    let title = parse_optional_non_empty_string(object.get("title").or_else(|| object.get("name")));
    let role = parse_optional_non_empty_string(object.get("role"));
    let is_default = object
        .get("is_default")
        .or_else(|| object.get("isDefault"))
        .or_else(|| object.get("default"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    Some(oauth_pool::OAuthAccountChatgptWorkspace {
        workspace_id,
        title,
        role,
        is_default,
    })
}

fn parse_codex_claims(id_token: Option<&str>) -> ParsedCodexClaims {
    let claims = id_token.and_then(parse_jwt_payload_without_verification);
    let auth_claims = claims
        .as_ref()
        .and_then(Value::as_object)
        .and_then(|entry| entry.get("https://api.openai.com/auth"))
        .and_then(Value::as_object);

    let external_account_id = auth_claims
        .and_then(|entry| parse_optional_non_empty_string(entry.get("chatgpt_account_id")))
        .or_else(|| {
            claims
                .as_ref()
                .and_then(Value::as_object)
                .and_then(|entry| parse_optional_non_empty_string(entry.get("sub")))
        });
    let email = claims
        .as_ref()
        .and_then(Value::as_object)
        .and_then(|entry| parse_optional_non_empty_string(entry.get("email")));
    let plan_type = auth_claims
        .and_then(|entry| parse_optional_non_empty_string(entry.get("chatgpt_plan_type")));
    let mut chatgpt_workspaces = auth_claims
        .and_then(|entry| {
            entry
                .get("organizations")
                .or_else(|| entry.get("workspaces"))
        })
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(parse_chatgpt_workspace_from_codex_claims)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let default_chatgpt_workspace_id = chatgpt_workspaces
        .iter()
        .find(|workspace| workspace.is_default)
        .map(|workspace| workspace.workspace_id.clone())
        .or_else(|| {
            auth_claims.and_then(|entry| {
                parse_optional_non_empty_string(
                    entry
                        .get("default_workspace_id")
                        .or_else(|| entry.get("defaultWorkspaceId"))
                        .or_else(|| entry.get("default_organization_id"))
                        .or_else(|| entry.get("defaultOrganizationId")),
                )
            })
        });
    if let Some(default_chatgpt_workspace_id) = default_chatgpt_workspace_id.as_deref() {
        for workspace in &mut chatgpt_workspaces {
            if workspace.workspace_id == default_chatgpt_workspace_id {
                workspace.is_default = true;
            }
        }
    }

    ParsedCodexClaims {
        external_account_id,
        email,
        plan_type,
        chatgpt_workspaces,
        default_chatgpt_workspace_id,
    }
}

fn sanitize_account_id_fragment(value: &str) -> Option<String> {
    let mut output = String::with_capacity(value.len());
    let mut previous_dash = false;
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            output.push(ch.to_ascii_lowercase());
            previous_dash = false;
            continue;
        }
        if !previous_dash {
            output.push('-');
            previous_dash = true;
        }
    }
    let trimmed = output.trim_matches('-').to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn summarize_oauth_error_for_user(error: &str) -> String {
    let trimmed = error.trim();
    if trimmed.is_empty() {
        return "unknown error".to_string();
    }
    let mut output = String::new();
    for ch in trimmed.chars().take(240) {
        output.push(ch);
    }
    if trimmed.chars().count() > 240 {
        output.push_str("...");
    }
    output
}

fn build_codex_oauth_account_id(
    external_account_id: Option<&str>,
    email: Option<&str>,
    access_token: &str,
) -> String {
    if let Some(fragment) = external_account_id.and_then(sanitize_account_id_fragment) {
        return format!("codex-oauth-{fragment}");
    }
    if let Some(fragment) = email.and_then(sanitize_account_id_fragment) {
        return format!("codex-oauth-{fragment}");
    }
    let mut hasher = DefaultHasher::new();
    access_token.hash(&mut hasher);
    format!("codex-oauth-{:x}", hasher.finish())
}

async fn exchange_codex_authorization_code(
    client: &reqwest::Client,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<CodexOauthTokenResponse, String> {
    let response = client
        .post(format!(
            "{}/oauth/token",
            crate::resolve_codex_oauth_issuer()
        ))
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("client_id", CODEX_OAUTH_CLIENT_ID),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await
        .map_err(|error| format!("Codex OAuth token exchange failed: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| String::from("<response body unavailable>"));
        return Err(format!(
            "Codex OAuth token exchange returned {status}: {}",
            body.trim()
        ));
    }
    response
        .json::<CodexOauthTokenResponse>()
        .await
        .map_err(|error| format!("Parse Codex OAuth token response: {error}"))
}

pub(super) fn codex_oauth_error_response(
    status: StatusCode,
    title: &str,
    message: &str,
) -> impl IntoResponse {
    (status, build_oauth_result_html(title, message, false))
}

pub(super) async fn start_codex_oauth(
    ctx: &AppContext,
    input: CodexOauthStartInput,
    request_headers: Option<&HeaderMap>,
) -> Result<CodexOauthStartOutput, String> {
    let fallback_headers;
    let headers = if let Some(headers) = request_headers {
        headers
    } else {
        fallback_headers = build_runtime_rpc_origin_headers(ctx.config.runtime_port)?;
        &fallback_headers
    };
    let workspace_id = normalize_workspace_id(input.workspace_id);
    let redirect_uri = build_codex_oauth_redirect_uri(
        ctx.config.oauth_public_base_url.as_deref(),
        ctx.config.oauth_loopback_callback_port,
        headers,
    )?;
    let login_id = new_id("codex-login");
    let state = generate_codex_oauth_state();
    let code_verifier = generate_codex_pkce_verifier();
    let code_challenge = generate_codex_pkce_challenge(&code_verifier);
    let auth_url = build_codex_authorize_url(&redirect_uri, &state, &code_challenge)?;
    ensure_codex_oauth_loopback_listener(ctx).await?;
    let now = now_ms();
    {
        let mut pending = ctx.codex_oauth_pending_logins.lock().await;
        prune_expired_codex_oauth_logins(&mut pending, now);
        pending.insert(
            state,
            PendingCodexOauthLogin {
                login_id: login_id.clone(),
                workspace_id,
                redirect_uri,
                code_verifier,
                expires_at_ms: now.saturating_add(CODEX_OAUTH_LOGIN_TTL_MS),
            },
        );
    }
    Ok(CodexOauthStartOutput { login_id, auth_url })
}

pub(super) async fn cancel_codex_oauth(
    ctx: &AppContext,
    input: CodexOauthCancelInput,
) -> CodexOauthCancelOutput {
    let workspace_id = normalize_workspace_id(input.workspace_id);
    let now = now_ms();
    let canceled = {
        let mut pending = ctx.codex_oauth_pending_logins.lock().await;
        prune_expired_codex_oauth_logins(&mut pending, now);
        let before = pending.len();
        pending.retain(|_, entry| entry.workspace_id != workspace_id);
        before != pending.len()
    };
    maybe_stop_codex_oauth_loopback_listener(ctx).await;
    CodexOauthCancelOutput {
        canceled: true,
        status: if canceled { "canceled" } else { "idle" },
    }
}

pub(super) async fn codex_oauth_start_handler(
    State(ctx): State<AppContext>,
    headers: HeaderMap,
    Json(input): Json<CodexOauthStartInput>,
) -> impl IntoResponse {
    match start_codex_oauth(&ctx, input, Some(&headers)).await {
        Ok(output) => (StatusCode::OK, Json(output)).into_response(),
        Err(error) => {
            warn!(error = error.as_str(), "failed to start codex oauth flow");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": { "message": error }
                })),
            )
                .into_response();
        }
    }
}

pub(super) async fn codex_oauth_cancel_handler(
    State(ctx): State<AppContext>,
    Json(input): Json<CodexOauthCancelInput>,
) -> impl IntoResponse {
    (StatusCode::OK, Json(cancel_codex_oauth(&ctx, input).await))
}

pub(super) async fn codex_oauth_callback_handler(
    State(ctx): State<AppContext>,
    Query(query): Query<CodexOauthCallbackQuery>,
) -> impl IntoResponse {
    let state = match query
        .state
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        Some(value) => value.to_string(),
        None => {
            return codex_oauth_error_response(
                StatusCode::BAD_REQUEST,
                "Codex OAuth sign-in failed",
                "Missing OAuth state parameter.",
            )
            .into_response();
        }
    };

    let now = now_ms();
    let pending_login = {
        let mut pending = ctx.codex_oauth_pending_logins.lock().await;
        take_pending_codex_oauth_login(&mut pending, state.as_str(), now)
    };
    let pending_login = match pending_login {
        PendingCodexOauthLoginLookup::Found(entry) => entry,
        PendingCodexOauthLoginLookup::Expired(expired_login) => {
            let error_detail =
                "This login attempt is no longer valid. Start the sign-in flow again.";
            publish_workspace_oauth_runtime_updated_event(
                &ctx,
                expired_login.workspace_id.as_str(),
                "oauth_codex_login_failed",
                Some(OAuthLoginUpdatePayload {
                    login_id: expired_login.login_id.as_str(),
                    success: false,
                    error: Some(error_detail),
                }),
            );
            let response = codex_oauth_error_response(
                StatusCode::BAD_REQUEST,
                "Codex OAuth sign-in expired",
                error_detail,
            )
            .into_response();
            maybe_stop_codex_oauth_loopback_listener(&ctx).await;
            return response;
        }
        PendingCodexOauthLoginLookup::Missing => {
            maybe_stop_codex_oauth_loopback_listener(&ctx).await;
            return codex_oauth_error_response(
                StatusCode::BAD_REQUEST,
                "Codex OAuth sign-in expired",
                "This login attempt is no longer valid. Start the sign-in flow again.",
            )
            .into_response();
        }
    };

    if let Some(error_code) = query
        .error
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        let detail = query
            .error_description
            .as_deref()
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .unwrap_or(error_code);
        publish_workspace_oauth_runtime_updated_event(
            &ctx,
            pending_login.workspace_id.as_str(),
            "oauth_codex_login_failed",
            Some(OAuthLoginUpdatePayload {
                login_id: pending_login.login_id.as_str(),
                success: false,
                error: Some(detail),
            }),
        );
        let response = codex_oauth_error_response(
            StatusCode::BAD_REQUEST,
            "Codex OAuth sign-in failed",
            detail,
        )
        .into_response();
        maybe_stop_codex_oauth_loopback_listener(&ctx).await;
        return response;
    }

    let code = match query
        .code
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        Some(value) => value,
        None => {
            publish_workspace_oauth_runtime_updated_event(
                &ctx,
                pending_login.workspace_id.as_str(),
                "oauth_codex_login_failed",
                Some(OAuthLoginUpdatePayload {
                    login_id: pending_login.login_id.as_str(),
                    success: false,
                    error: Some("Missing OAuth authorization code."),
                }),
            );
            let response = codex_oauth_error_response(
                StatusCode::BAD_REQUEST,
                "Codex OAuth sign-in failed",
                "Missing OAuth authorization code.",
            )
            .into_response();
            maybe_stop_codex_oauth_loopback_listener(&ctx).await;
            return response;
        }
    };

    let token_payload = match exchange_codex_authorization_code(
        &ctx.client,
        code,
        pending_login.redirect_uri.as_str(),
        pending_login.code_verifier.as_str(),
    )
    .await
    {
        Ok(payload) => payload,
        Err(error) => {
            warn!(
                error = error.as_str(),
                workspace_id = pending_login.workspace_id.as_str(),
                "codex oauth token exchange failed"
            );
            publish_workspace_oauth_runtime_updated_event(
                &ctx,
                pending_login.workspace_id.as_str(),
                "oauth_codex_login_failed",
                Some(OAuthLoginUpdatePayload {
                    login_id: pending_login.login_id.as_str(),
                    success: false,
                    error: Some("Unable to exchange authorization code for tokens."),
                }),
            );
            let response = codex_oauth_error_response(
                StatusCode::BAD_GATEWAY,
                "Codex OAuth sign-in failed",
                "Unable to exchange authorization code for tokens.",
            )
            .into_response();
            maybe_stop_codex_oauth_loopback_listener(&ctx).await;
            return response;
        }
    };

    let parsed_claims = parse_codex_claims(token_payload.id_token.as_deref());
    let Some(id_token) = token_payload.id_token.as_deref() else {
        publish_workspace_oauth_runtime_updated_event(
            &ctx,
            pending_login.workspace_id.as_str(),
            "oauth_codex_login_failed",
            Some(OAuthLoginUpdatePayload {
                login_id: pending_login.login_id.as_str(),
                success: false,
                error: Some("OAuth token response did not include id_token."),
            }),
        );
        let response = codex_oauth_error_response(
            StatusCode::BAD_GATEWAY,
            "Codex OAuth sign-in failed",
            "OAuth token response did not include id_token.",
        )
        .into_response();
        maybe_stop_codex_oauth_loopback_listener(&ctx).await;
        return response;
    };
    let (api_credential, credential_source) =
        match exchange_codex_openai_api_key(&ctx.client, id_token).await {
            Ok(api_key) => (api_key, "openai_api_key".to_string()),
            Err(error) => {
                let fallback_access_token = token_payload
                    .access_token
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string);
                if let Some(access_token) = fallback_access_token {
                    warn!(
                        error = error.as_str(),
                        workspace_id = pending_login.workspace_id.as_str(),
                        "codex oauth api-key exchange failed; falling back to oauth access token"
                    );
                    (access_token, "access_token_fallback".to_string())
                } else {
                    warn!(
                        error = error.as_str(),
                        workspace_id = pending_login.workspace_id.as_str(),
                        "codex oauth api-key exchange failed"
                    );
                    let detail = summarize_oauth_error_for_user(error.as_str());
                    publish_workspace_oauth_runtime_updated_event(
                        &ctx,
                        pending_login.workspace_id.as_str(),
                        "oauth_codex_login_failed",
                        Some(OAuthLoginUpdatePayload {
                            login_id: pending_login.login_id.as_str(),
                            success: false,
                            error: Some("Failed to exchange OAuth id_token for API key."),
                        }),
                    );
                    let response = codex_oauth_error_response(
                        StatusCode::BAD_GATEWAY,
                        "Codex OAuth sign-in failed",
                        format!("Failed to exchange OAuth id_token for API key ({detail}).")
                            .as_str(),
                    )
                    .into_response();
                    maybe_stop_codex_oauth_loopback_listener(&ctx).await;
                    return response;
                }
            }
        };
    if api_credential.trim().is_empty() {
        publish_workspace_oauth_runtime_updated_event(
            &ctx,
            pending_login.workspace_id.as_str(),
            "oauth_codex_login_failed",
            Some(OAuthLoginUpdatePayload {
                login_id: pending_login.login_id.as_str(),
                success: false,
                error: Some("OAuth token response did not include a usable API key."),
            }),
        );
        let response = codex_oauth_error_response(
            StatusCode::BAD_GATEWAY,
            "Codex OAuth sign-in failed",
            "OAuth token response did not include a usable API key.",
        )
        .into_response();
        maybe_stop_codex_oauth_loopback_listener(&ctx).await;
        return response;
    }

    let account_id = build_codex_oauth_account_id(
        parsed_claims.external_account_id.as_deref(),
        parsed_claims.email.as_deref(),
        api_credential.as_str(),
    );
    let mut metadata = serde_json::Map::new();
    metadata.insert(
        "source".to_string(),
        Value::String(SERVICE_CODEX_OAUTH_ACCOUNT_SOURCE.to_string()),
    );
    metadata.insert("authMode".to_string(), Value::String("chatgpt".to_string()));
    metadata.insert("credentialAvailable".to_string(), Value::Bool(true));
    metadata.insert(
        "credentialSource".to_string(),
        Value::String(credential_source),
    );
    metadata.insert(
        "oauthIssuer".to_string(),
        Value::String(CODEX_OAUTH_ISSUER.to_string()),
    );
    metadata.insert(
        "oauthClientId".to_string(),
        Value::String(CODEX_OAUTH_CLIENT_ID.to_string()),
    );
    metadata.insert("apiKey".to_string(), Value::String(api_credential));
    if let Some(refresh_token) = token_payload
        .refresh_token
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        metadata.insert(
            "refreshToken".to_string(),
            Value::String(refresh_token.to_string()),
        );
        metadata.insert(
            "refreshTokenAvailable".to_string(),
            Value::Bool(!refresh_token.is_empty()),
        );
    }
    if let Some(plan_type) = parsed_claims.plan_type.clone() {
        metadata.insert("planType".to_string(), Value::String(plan_type));
    }
    if let Some(email) = parsed_claims.email.clone() {
        metadata.insert("email".to_string(), Value::String(email));
    }
    if !parsed_claims.chatgpt_workspaces.is_empty() {
        metadata.insert(
            "chatgptWorkspaces".to_string(),
            serde_json::to_value(&parsed_claims.chatgpt_workspaces)
                .unwrap_or_else(|_| Value::Array(Vec::new())),
        );
    }
    if let Some(default_chatgpt_workspace_id) = parsed_claims.default_chatgpt_workspace_id.clone() {
        metadata.insert(
            "defaultChatgptWorkspaceId".to_string(),
            Value::String(default_chatgpt_workspace_id),
        );
    }
    if let Some(access_token) = token_payload
        .access_token
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        match provider_requests::query_chatgpt_codex_usage(
            &ctx.client,
            &ctx.config,
            access_token,
            parsed_claims.external_account_id.as_deref(),
        )
        .await
        {
            Ok(usage_payload) => {
                let observed_at_ms = now_ms();
                if let Some(rate_limits) = build_rate_limits_snapshot_from_chatgpt_usage_payload(
                    &usage_payload,
                    observed_at_ms,
                ) {
                    metadata.insert("rateLimits".to_string(), rate_limits.clone());
                    metadata.insert("rate_limits".to_string(), rate_limits);
                }
                metadata.insert("usageCheckedAt".to_string(), json!(observed_at_ms));
            }
            Err(error) => {
                warn!(
                    error = error.as_str(),
                    workspace_id = pending_login.workspace_id.as_str(),
                    "codex oauth usage probe failed"
                );
            }
        }
    }

    let upsert_result = ctx.oauth_pool.upsert_account(OAuthAccountUpsertInput {
        account_id,
        provider: "codex".to_string(),
        external_account_id: parsed_claims.external_account_id,
        email: parsed_claims.email.clone(),
        display_name: parsed_claims.email.clone(),
        status: Some("enabled".to_string()),
        disabled_reason: None,
        metadata: Some(Value::Object(metadata)),
    });
    if let Err(error) = upsert_result {
        warn!(
            error = error.message(),
            workspace_id = pending_login.workspace_id.as_str(),
            "failed to upsert codex oauth account"
        );
        publish_workspace_oauth_runtime_updated_event(
            &ctx,
            pending_login.workspace_id.as_str(),
            "oauth_codex_login_failed",
            Some(OAuthLoginUpdatePayload {
                login_id: pending_login.login_id.as_str(),
                success: false,
                error: Some("Failed to persist Codex account in OAuth pool."),
            }),
        );
        let response = codex_oauth_error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Codex OAuth sign-in failed",
            "Failed to persist Codex account in OAuth pool.",
        )
        .into_response();
        maybe_stop_codex_oauth_loopback_listener(&ctx).await;
        return response;
    }

    publish_workspace_oauth_runtime_updated_event(
        &ctx,
        pending_login.workspace_id.as_str(),
        "oauth_codex_login_completed",
        Some(OAuthLoginUpdatePayload {
            login_id: pending_login.login_id.as_str(),
            success: true,
            error: None,
        }),
    );

    let response = (
        StatusCode::OK,
        build_oauth_result_html(
            "Codex OAuth sign-in complete",
            "Account is now available in this workspace.",
            true,
        ),
    )
        .into_response();
    maybe_stop_codex_oauth_loopback_listener(&ctx).await;
    response
}
