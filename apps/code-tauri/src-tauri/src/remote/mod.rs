#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RuntimeMode {
    Local,
    Remote,
}

impl RuntimeMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Remote => "remote",
        }
    }
}

#[derive(Clone, Debug)]
pub struct RemoteRuntime {
    connected: bool,
    mode: RuntimeMode,
    endpoint: Option<String>,
    latency_ms: Option<u64>,
}

impl RemoteRuntime {
    pub fn local() -> Self {
        Self {
            connected: false,
            mode: RuntimeMode::Local,
            endpoint: None,
            latency_ms: None,
        }
    }

    pub fn from_env() -> Self {
        match std::env::var("CODE_TAURI_REMOTE_ENDPOINT") {
            Ok(endpoint) if !endpoint.trim().is_empty() => {
                let latency_ms = std::env::var("CODE_TAURI_REMOTE_LATENCY_MS")
                    .ok()
                    .and_then(|value| value.parse::<u64>().ok());

                Self {
                    connected: true,
                    mode: RuntimeMode::Remote,
                    endpoint: Some(endpoint),
                    latency_ms,
                }
            }
            _ => Self::local(),
        }
    }

    pub fn connected(&self) -> bool {
        self.connected
    }

    pub fn mode(&self) -> &RuntimeMode {
        &self.mode
    }

    pub fn endpoint(&self) -> Option<&str> {
        self.endpoint.as_deref()
    }

    pub fn latency_ms(&self) -> Option<u64> {
        self.latency_ms
    }
}

#[cfg(test)]
mod tests {
    use super::{RemoteRuntime, RuntimeMode};

    #[test]
    fn local_runtime_defaults_to_disconnected() {
        let runtime = RemoteRuntime::local();

        assert!(!runtime.connected());
        assert_eq!(runtime.mode(), &RuntimeMode::Local);
        assert_eq!(runtime.endpoint(), None);
    }
}
