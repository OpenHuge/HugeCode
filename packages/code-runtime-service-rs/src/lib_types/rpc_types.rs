#[derive(Debug, Deserialize)]
struct RpcRequest {
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct RpcErrorPayload {
    code: String,
    message: String,
}

#[derive(Debug, Serialize)]
struct RpcResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcErrorPayload>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(default)]
struct WsRuntimeQuery {
    #[serde(alias = "lastEventId", alias = "last_event_id")]
    last_event_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct WsClientMessage {
    #[serde(rename = "type")]
    message_type: String,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Clone, Copy)]
enum RpcErrorCode {
    MethodNotFound,
    InvalidParams,
    InternalError,
}

impl RpcErrorCode {
    fn as_str(self) -> &'static str {
        match self {
            Self::MethodNotFound => "METHOD_NOT_FOUND",
            Self::InvalidParams => "INVALID_PARAMS",
            Self::InternalError => "INTERNAL_ERROR",
        }
    }
}

#[derive(Debug)]
struct RpcError {
    code: RpcErrorCode,
    message: String,
}

impl RpcError {
    fn method_not_found(method: &str) -> Self {
        Self {
            code: RpcErrorCode::MethodNotFound,
            message: format!("Unsupported RPC method: {method}"),
        }
    }

    fn invalid_params(message: impl Into<String>) -> Self {
        Self {
            code: RpcErrorCode::InvalidParams,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            code: RpcErrorCode::InternalError,
            message: message.into(),
        }
    }

    pub(crate) fn code_str(&self) -> &'static str {
        self.code.as_str()
    }

    pub(crate) fn message(&self) -> &str {
        self.message.as_str()
    }
}
