use super::*;
use ku0_runtime_diagnostics_export_core as diagnostics_export_core;

const CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED_ENV: &str = "CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED";

pub(crate) use diagnostics_export_core::{
    RuntimeDiagnosticsExportBuildInput, RuntimeDiagnosticsExportBuildOutput,
    RuntimeDiagnosticsRedactionLevel, RuntimeDiagnosticsSection,
    RUNTIME_DIAGNOSTICS_EXPORT_SCHEMA_VERSION,
};

pub(crate) fn runtime_diagnostics_export_enabled() -> bool {
    matches!(
        std::env::var(CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("1" | "true" | "yes" | "on")
    )
}

#[cfg(test)]
pub(crate) static RUNTIME_DIAGNOSTICS_EXPORT_ENV_TEST_LOCK: std::sync::LazyLock<
    std::sync::Mutex<()>,
> = std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

#[cfg(test)]
pub(crate) fn with_runtime_diagnostics_export_env_for_test(
    value: Option<&str>,
    run: impl FnOnce(),
) {
    let _guard = RUNTIME_DIAGNOSTICS_EXPORT_ENV_TEST_LOCK
        .lock()
        .expect("lock diagnostics export env");
    let previous = std::env::var(CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED_ENV).ok();
    match value {
        Some(value) => std::env::set_var(CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED_ENV, value),
        None => std::env::remove_var(CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED_ENV),
    }
    run();
    match previous {
        Some(previous) => std::env::set_var(CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED_ENV, previous),
        None => std::env::remove_var(CODE_RUNTIME_DIAGNOSTICS_EXPORT_ENABLED_ENV),
    }
}

pub(crate) fn parse_runtime_diagnostics_redaction_level(
    raw: Option<&str>,
) -> Result<RuntimeDiagnosticsRedactionLevel, RpcError> {
    diagnostics_export_core::parse_runtime_diagnostics_redaction_level(raw)
        .map_err(RpcError::invalid_params)
}

pub(crate) fn build_runtime_diagnostics_export(
    input: RuntimeDiagnosticsExportBuildInput,
) -> Result<RuntimeDiagnosticsExportBuildOutput, RpcError> {
    diagnostics_export_core::build_runtime_diagnostics_export(input).map_err(RpcError::internal)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostics_export_enabled_is_opt_in() {
        with_runtime_diagnostics_export_env_for_test(Some("0"), || {
            assert!(!runtime_diagnostics_export_enabled());
        });
        with_runtime_diagnostics_export_env_for_test(Some("true"), || {
            assert!(runtime_diagnostics_export_enabled());
        });
    }
}
