use serde_json::{json, Map, Value};

use crate::{now_ms, RpcError};

const INVOCATION_HOST_REGISTRY_VERSION: &str = "runtime-invocation-host-registry-v1";

#[derive(Clone, Copy)]
struct InvocationHost {
    host_id: &'static str,
    category: &'static str,
    label: &'static str,
    summary: &'static str,
    authority: &'static str,
    dispatch_mode: &'static str,
    readiness_state: &'static str,
    available: bool,
    reason: Option<&'static str>,
    requirement_keys: &'static [&'static str],
    dispatch_methods: &'static [&'static str],
}

const INVOCATION_HOSTS: &[InvocationHost] = &[
    InvocationHost {
        host_id: "runtime:built-in-tools",
        category: "built_in_runtime_tool",
        label: "Built-in runtime tools",
        summary: "Runtime-owned host for built-in launch, preflight, and live-skill execution.",
        authority: "runtime",
        dispatch_mode: "execute",
        readiness_state: "ready",
        available: true,
        reason: None,
        requirement_keys: &["runtime_service"],
        dispatch_methods: &[
            "code_runtime_run_start_v2",
            "code_runtime_tool_preflight_v2",
            "code_live_skill_execute",
        ],
    },
    InvocationHost {
        host_id: "runtime:extension-tools",
        category: "runtime_extension_tool",
        label: "Runtime extension tools",
        summary: "Runtime-owned host for extension-contributed tool dispatch.",
        authority: "runtime",
        dispatch_mode: "execute",
        readiness_state: "attention",
        available: true,
        reason: Some("Extension execution also depends on the selected extension being installed and enabled."),
        requirement_keys: &["runtime_service", "extension_bridge"],
        dispatch_methods: &["code_extension_tool_invoke_v2"],
    },
    InvocationHost {
        host_id: "workspace:skills",
        category: "workspace_skill",
        label: "Workspace skills",
        summary: "Runtime-owned host seam for workspace skill manifests and skill-derived tools.",
        authority: "workspace",
        dispatch_mode: "execute",
        readiness_state: "attention",
        available: true,
        reason: Some("Workspace skill execution depends on activation-backed skill availability."),
        requirement_keys: &["runtime_service", "workspace_skill_manifest"],
        dispatch_methods: &["code_live_skill_execute"],
    },
    InvocationHost {
        host_id: "workspace:prompt-overlay",
        category: "prompt_overlay",
        label: "Prompt overlay resolver",
        summary: "Resolve-only host for prompt-library overlays that shape operator input without bypassing runtime policy.",
        authority: "workspace",
        dispatch_mode: "resolve_only",
        readiness_state: "ready",
        available: true,
        reason: None,
        requirement_keys: &["prompt_library"],
        dispatch_methods: &["code_prompt_library_list"],
    },
    InvocationHost {
        host_id: "reserved:rpc-host",
        category: "reserved_rpc_host",
        label: "Reserved RPC host",
        summary: "Reserved model for future RPC host binding without adding UI-side dispatch assumptions.",
        authority: "runtime",
        dispatch_mode: "reserved",
        readiness_state: "unsupported",
        available: false,
        reason: Some("Reserved host is modeled for contract portability but is not executable yet."),
        requirement_keys: &["rpc_method"],
        dispatch_methods: &[],
    },
    InvocationHost {
        host_id: "reserved:wasi-component-host",
        category: "reserved_wasi_host",
        label: "Reserved WASI component host",
        summary: "Reserved model for future WASI/component execution behind a runtime-owned boundary.",
        authority: "runtime",
        dispatch_mode: "reserved",
        readiness_state: "unsupported",
        available: false,
        reason: Some("WASI/component execution is reserved and intentionally unavailable in this phase."),
        requirement_keys: &["wasi_component_host"],
        dispatch_methods: &[],
    },
];

fn read_string(params: &Map<String, Value>, key: &str) -> Option<String> {
    params
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn read_bool(params: &Map<String, Value>, key: &str) -> Option<bool> {
    params.get(key).and_then(Value::as_bool)
}

fn read_caller(params: &Map<String, Value>) -> &'static str {
    match read_string(params, "caller").as_deref() {
        Some("model") => "model",
        _ => "operator",
    }
}

fn as_params_object(params: &Value) -> Result<&Map<String, Value>, RpcError> {
    params
        .as_object()
        .ok_or_else(|| RpcError::invalid_params("Runtime invocation RPC params must be an object."))
}

fn host_payload(host: InvocationHost, workspace_id: Option<&str>, generated_at: u64) -> Value {
    json!({
        "hostId": host.host_id,
        "category": host.category,
        "label": host.label,
        "summary": host.summary,
        "authority": host.authority,
        "dispatchMode": host.dispatch_mode,
        "readiness": {
            "state": host.readiness_state,
            "available": host.available,
            "reason": host.reason,
            "checkedAt": generated_at,
        },
        "requirementKeys": host.requirement_keys,
        "dispatchMethods": host.dispatch_methods,
        "provenance": {
            "source": "runtime_host_registry",
            "registryVersion": INVOCATION_HOST_REGISTRY_VERSION,
            "workspaceId": workspace_id,
        },
    })
}

fn registry_summary(hosts: &[InvocationHost]) -> Value {
    let mut executable = 0_u64;
    let mut resolve_only = 0_u64;
    let mut reserved = 0_u64;
    let mut unsupported = 0_u64;
    let mut ready = 0_u64;
    let mut attention = 0_u64;
    let mut blocked = 0_u64;

    for host in hosts {
        match host.dispatch_mode {
            "execute" => executable += 1,
            "resolve_only" => resolve_only += 1,
            "reserved" => reserved += 1,
            _ => unsupported += 1,
        }
        match host.readiness_state {
            "ready" => ready += 1,
            "attention" => attention += 1,
            "blocked" => blocked += 1,
            _ => {}
        }
    }

    json!({
        "total": hosts.len(),
        "executable": executable,
        "resolveOnly": resolve_only,
        "reserved": reserved,
        "unsupported": unsupported,
        "ready": ready,
        "attention": attention,
        "blocked": blocked,
    })
}

pub(crate) fn build_runtime_invocation_host_registry(workspace_id: Option<&str>) -> Value {
    let generated_at = now_ms();
    json!({
        "registryVersion": INVOCATION_HOST_REGISTRY_VERSION,
        "workspaceId": workspace_id,
        "generatedAt": generated_at,
        "hosts": INVOCATION_HOSTS
            .iter()
            .copied()
            .map(|host| host_payload(host, workspace_id, generated_at))
            .collect::<Vec<_>>(),
        "summary": registry_summary(INVOCATION_HOSTS),
    })
}

fn resolve_host(host_id: Option<&str>) -> InvocationHost {
    let Some(host_id) = host_id else {
        return INVOCATION_HOSTS[0];
    };
    INVOCATION_HOSTS
        .iter()
        .copied()
        .find(|host| host.host_id == host_id)
        .unwrap_or(INVOCATION_HOSTS[4])
}

pub(crate) fn handle_runtime_invocation_hosts_list_v1(params: &Value) -> Result<Value, RpcError> {
    let params = as_params_object(params)?;
    let workspace_id = read_string(params, "workspaceId");
    Ok(build_runtime_invocation_host_registry(
        workspace_id.as_deref(),
    ))
}

pub(crate) fn handle_runtime_invocation_dispatch_v1(params: &Value) -> Result<Value, RpcError> {
    let params = as_params_object(params)?;
    let invocation_id = read_string(params, "invocationId").ok_or_else(|| {
        RpcError::invalid_params("Runtime invocation dispatch requires invocationId.")
    })?;
    let workspace_id = read_string(params, "workspaceId");
    let caller = read_caller(params);
    let host = resolve_host(read_string(params, "hostId").as_deref());
    let dry_run = read_bool(params, "dryRun").unwrap_or(false);

    let (status, preflight_state, summary, shaping_applied) = match host.dispatch_mode {
        "execute" if host.available && dry_run => (
            "accepted",
            "ready",
            "Runtime invocation dispatch preflight resolved to an executable host; dryRun left execution untouched.",
            false,
        ),
        "execute" if host.available => (
            "accepted",
            "ready",
            "Runtime invocation dispatch resolved to an executable host. Existing execution methods remain the concrete executor for this phase.",
            false,
        ),
        "resolve_only" => (
            "resolved",
            "not_required",
            "Runtime invocation resolved through a non-executing host.",
            true,
        ),
        "reserved" => (
            "unsupported",
            "blocked",
            "Runtime invocation host is reserved and not executable in this phase.",
            false,
        ),
        _ => (
            "unsupported",
            "blocked",
            "Runtime invocation host is unavailable.",
            false,
        ),
    };

    Ok(json!({
        "invocationId": invocation_id,
        "status": status,
        "summary": summary,
        "preflight": {
            "state": preflight_state,
            "reason": host.reason,
            "hostId": host.host_id,
        },
        "provenance": {
            "invocationId": invocation_id,
            "hostId": host.host_id,
            "category": host.category,
            "source": "runtime_host_registry",
            "registryVersion": INVOCATION_HOST_REGISTRY_VERSION,
            "workspaceId": workspace_id,
            "caller": caller,
        },
        "postExecution": {
            "applied": shaping_applied,
            "summary": if shaping_applied {
                "Resolve-only invocation shaping completed without execution."
            } else {
                "No post-execution shaping was applied by the registry preflight."
            },
            "metadata": Value::Null,
        },
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invocation_plane_registry_lists_all_host_categories() {
        let registry = build_runtime_invocation_host_registry(Some("workspace-1"));
        let hosts = registry["hosts"].as_array().expect("hosts array");
        let categories = hosts
            .iter()
            .map(|host| host["category"].as_str().expect("category"))
            .collect::<std::collections::BTreeSet<_>>();

        assert_eq!(hosts.len(), 6);
        assert!(categories.contains("built_in_runtime_tool"));
        assert!(categories.contains("runtime_extension_tool"));
        assert!(categories.contains("workspace_skill"));
        assert!(categories.contains("prompt_overlay"));
        assert!(categories.contains("reserved_rpc_host"));
        assert!(categories.contains("reserved_wasi_host"));
        assert_eq!(
            registry["summary"]["executable"],
            Value::Number(3_u64.into())
        );
        assert_eq!(
            registry["summary"]["resolveOnly"],
            Value::Number(1_u64.into())
        );
        assert_eq!(registry["summary"]["reserved"], Value::Number(2_u64.into()));
    }

    #[test]
    fn invocation_plane_dispatch_reports_runtime_owned_provenance() {
        let response = handle_runtime_invocation_dispatch_v1(&json!({
            "invocationId": "runtime:start-run",
            "hostId": "runtime:built-in-tools",
            "workspaceId": "workspace-1",
            "caller": "operator",
            "dryRun": true,
        }))
        .expect("dispatch response");

        assert_eq!(response["status"], Value::String("accepted".to_string()));
        assert_eq!(
            response["provenance"]["source"],
            Value::String("runtime_host_registry".to_string())
        );
        assert_eq!(
            response["provenance"]["category"],
            Value::String("built_in_runtime_tool".to_string())
        );
        assert_eq!(
            response["preflight"]["state"],
            Value::String("ready".to_string())
        );
    }

    #[test]
    fn invocation_plane_dispatch_canonicalizes_unknown_callers() {
        let response = handle_runtime_invocation_dispatch_v1(&json!({
            "invocationId": "runtime:start-run",
            "caller": "unexpected",
            "dryRun": true,
        }))
        .expect("dispatch response");

        assert_eq!(
            response["provenance"]["caller"],
            Value::String("operator".to_string())
        );
    }

    #[test]
    fn invocation_plane_dispatch_blocks_reserved_hosts() {
        let response = handle_runtime_invocation_dispatch_v1(&json!({
            "invocationId": "future:wasi",
            "hostId": "reserved:wasi-component-host",
        }))
        .expect("dispatch response");

        assert_eq!(response["status"], Value::String("unsupported".to_string()));
        assert_eq!(
            response["preflight"]["state"],
            Value::String("blocked".to_string())
        );
    }
}
