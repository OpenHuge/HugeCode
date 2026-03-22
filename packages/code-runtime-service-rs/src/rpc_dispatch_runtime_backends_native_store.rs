use super::*;
use crate::native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV;

fn backend_is_acp_projection_for_native_store(summary: &RuntimeBackendSummary) -> bool {
    summary.origin.as_deref() == Some("acp-projection")
        || summary.backend_kind.as_deref() == Some("acp")
        || summary.backend_id.starts_with("acp:")
}

fn backend_is_persistable_to_native_store(
    summary: &RuntimeBackendSummary,
    discovery_managed: &std::collections::HashMap<String, u64>,
) -> bool {
    if backend_is_acp_projection_for_native_store(summary) {
        return false;
    }
    !discovery_managed.contains_key(summary.backend_id.as_str())
}

pub(crate) async fn persist_runtime_backends_to_native_store(
    ctx: &AppContext,
) -> Result<(), RpcError> {
    let discovery_managed = {
        let managed = ctx.discovery_managed_backends.read().await;
        managed.clone()
    };
    let entries = {
        let backends = ctx.runtime_backends.read().await;
        let mut items = backends
            .values()
            .filter(|summary| backend_is_persistable_to_native_store(summary, &discovery_managed))
            .cloned()
            .collect::<Vec<_>>();
        items.sort_by(|left, right| left.backend_id.cmp(&right.backend_id));
        items
    };
    let encoded = serde_json::to_value(entries)
        .map_err(|error| RpcError::internal(format!("encode runtime backends failed: {error}")))?;
    ctx.native_state_store
        .upsert_setting_value(
            TABLE_NATIVE_RUNTIME_STATE_KV,
            RUNTIME_BACKENDS_STATE_KEY,
            encoded,
        )
        .await
        .map_err(RpcError::internal)?;
    Ok(())
}

pub(crate) fn hydrate_runtime_backends_from_native_store(
    native_state_store: &native_state_store::NativeStateStore,
) -> std::collections::HashMap<String, RuntimeBackendSummary> {
    let persisted = match native_state_store
        .get_setting_value_blocking(TABLE_NATIVE_RUNTIME_STATE_KV, RUNTIME_BACKENDS_STATE_KEY)
    {
        Ok(value) => value,
        Err(error) => {
            warn!(
                error = error.as_str(),
                "failed to hydrate runtime backends from native state store"
            );
            return std::collections::HashMap::new();
        }
    };
    let Some(value) = persisted else {
        return std::collections::HashMap::new();
    };
    let Ok(entries) = serde_json::from_value::<Vec<RuntimeBackendSummary>>(value) else {
        warn!("persisted runtime backends payload is invalid");
        return std::collections::HashMap::new();
    };
    let mut store = std::collections::HashMap::new();
    for mut entry in entries {
        if entry.backend_id.trim().is_empty() {
            continue;
        }
        entry.policy = Some(normalize_runtime_backend_policy_profile(entry.policy.take()));
        if entry.contract.is_none() {
            entry.contract = Some(build_runtime_backend_contract(&entry));
        }
        store.insert(entry.backend_id.clone(), entry);
    }
    store
}
