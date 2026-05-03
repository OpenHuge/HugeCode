use axum::response::Html;

fn sanitize_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub(super) fn build_oauth_result_html(
    title: &str,
    message: &str,
    success: bool,
    login_id: Option<&str>,
    post_message_origin: Option<&str>,
) -> Html<String> {
    let heading = sanitize_html(title);
    let body = sanitize_html(message);
    let status_class = if success { "success" } else { "error" };
    let status_label = if success { "Success" } else { "Failed" };
    let callback_script = match (login_id, post_message_origin) {
        (Some(login_id), Some(post_message_origin)) => {
            let serialized_login_id =
                serde_json::to_string(login_id).unwrap_or_else(|_| "\"\"".to_string());
            let serialized_origin =
                serde_json::to_string(post_message_origin).unwrap_or_else(|_| "\"\"".to_string());
            let close_statement = if success {
                "\n      window.close();"
            } else {
                ""
            };
            format!(
                r#"<script>
    try {{
      if (window.opener && !window.opener.closed) {{
        window.opener.postMessage(
          {{
            type: "fastcode:oauth:codex",
            success: {success},
            loginId: {login_id}
          }},
          {target_origin}
        );
      }}{close_statement}
    }} catch (_) {{}}
  </script>"#,
                success = if success { "true" } else { "false" },
                login_id = serialized_login_id,
                target_origin = serialized_origin,
                close_statement = close_statement,
            )
        }
        _ => String::new(),
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
