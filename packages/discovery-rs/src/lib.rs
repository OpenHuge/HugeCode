use mdns_sd::{ResolvedService, ServiceDaemon, ServiceEvent, ServiceInfo};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use once_cell::sync::Lazy;
use std::collections::{BTreeSet, HashMap};
use std::sync::{
    Mutex,
    atomic::{AtomicUsize, Ordering},
};
use std::time::{Duration, Instant};

static SERVICE_DAEMON: Lazy<std::result::Result<ServiceDaemon, String>> =
    Lazy::new(|| ServiceDaemon::new().map_err(|error| error.to_string()));
static ADVERTISEMENTS: Lazy<Mutex<HashMap<String, String>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_ID: AtomicUsize = AtomicUsize::new(1);

pub const PROP_BACKEND_ID: &str = "backendId";
pub const PROP_DISPLAY_NAME: &str = "displayName";
pub const PROP_CAPABILITIES: &str = "capabilities";
pub const PROP_MAX_CONCURRENCY: &str = "maxConcurrency";
pub const PROP_COST_TIER: &str = "costTier";
pub const PROP_LATENCY_CLASS: &str = "latencyClass";
pub const PROP_ROLLOUT_STATE: &str = "rolloutState";
pub const PROP_STATUS: &str = "status";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeBackendAdvertisementMetadata {
    pub backend_id: String,
    pub display_name: Option<String>,
    pub capabilities: Vec<String>,
    pub max_concurrency: u64,
    pub cost_tier: String,
    pub latency_class: String,
    pub rollout_state: String,
    pub status: String,
}

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscoveryProperty {
    pub key: String,
    pub value: String,
}

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscoveredService {
    pub fullname: String,
    pub host: String,
    pub port: u16,
    pub addresses: Vec<String>,
    pub properties: Vec<DiscoveryProperty>,
}

pub fn encode_runtime_backend_properties(
    metadata: &RuntimeBackendAdvertisementMetadata,
) -> Vec<DiscoveryProperty> {
    let capabilities = normalize_capabilities(metadata.capabilities.clone()).join(",");
    let mut properties = vec![
        DiscoveryProperty {
            key: PROP_BACKEND_ID.to_string(),
            value: metadata.backend_id.trim().to_string(),
        },
        DiscoveryProperty {
            key: PROP_CAPABILITIES.to_string(),
            value: capabilities,
        },
        DiscoveryProperty {
            key: PROP_MAX_CONCURRENCY.to_string(),
            value: metadata.max_concurrency.to_string(),
        },
        DiscoveryProperty {
            key: PROP_COST_TIER.to_string(),
            value: metadata.cost_tier.trim().to_string(),
        },
        DiscoveryProperty {
            key: PROP_LATENCY_CLASS.to_string(),
            value: metadata.latency_class.trim().to_string(),
        },
        DiscoveryProperty {
            key: PROP_ROLLOUT_STATE.to_string(),
            value: metadata.rollout_state.trim().to_string(),
        },
        DiscoveryProperty {
            key: PROP_STATUS.to_string(),
            value: metadata.status.trim().to_string(),
        },
    ];
    if let Some(display_name) = metadata
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        properties.push(DiscoveryProperty {
            key: PROP_DISPLAY_NAME.to_string(),
            value: display_name.to_string(),
        });
    }
    properties
}

pub fn decode_runtime_backend_properties(
    properties: &[DiscoveryProperty],
) -> std::result::Result<RuntimeBackendAdvertisementMetadata, String> {
    let map = properties_to_hash_map(properties);
    let backend_id = map
        .get(PROP_BACKEND_ID)
        .map(String::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if backend_id.is_empty() {
        return Err("backendId is required in discovery properties".to_string());
    }

    let capabilities = normalize_capabilities(
        map.get(PROP_CAPABILITIES)
            .map(|entry| parse_capabilities(entry.as_str()))
            .unwrap_or_default(),
    );
    if capabilities.is_empty() {
        return Err("capabilities is required in discovery properties".to_string());
    }

    let max_concurrency = map
        .get(PROP_MAX_CONCURRENCY)
        .and_then(|entry| entry.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(1);

    Ok(RuntimeBackendAdvertisementMetadata {
        backend_id,
        display_name: map
            .get(PROP_DISPLAY_NAME)
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        capabilities,
        max_concurrency,
        cost_tier: map
            .get(PROP_COST_TIER)
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("standard")
            .to_string(),
        latency_class: map
            .get(PROP_LATENCY_CLASS)
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("regional")
            .to_string(),
        rollout_state: map
            .get(PROP_ROLLOUT_STATE)
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("current")
            .to_string(),
        status: map
            .get(PROP_STATUS)
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("active")
            .to_string(),
    })
}

pub fn advertise_start(
    service_type: &str,
    instance_name: &str,
    port: u16,
    properties: Option<Vec<DiscoveryProperty>>,
) -> std::result::Result<String, String> {
    let daemon = service_daemon()?;
    let host_name = format!("{}.local.", instance_name);
    let props = properties_to_map(properties);
    let info = ServiceInfo::new(service_type, instance_name, &host_name, "", port, props)
        .map_err(|error| error.to_string())?
        .enable_addr_auto();
    let fullname = info.get_fullname().to_string();

    daemon.register(info).map_err(|error| error.to_string())?;

    let id = next_id("adv");
    let mut guard = ADVERTISEMENTS
        .lock()
        .map_err(|_| "Failed to lock advertisements".to_string())?;
    guard.insert(id.clone(), fullname);
    Ok(id)
}

pub fn advertise_stop(advertisement_id: &str) -> std::result::Result<bool, String> {
    let daemon = service_daemon()?;
    let mut guard = ADVERTISEMENTS
        .lock()
        .map_err(|_| "Failed to lock advertisements".to_string())?;
    if let Some(fullname) = guard.remove(advertisement_id) {
        let receiver = daemon
            .unregister(&fullname)
            .map_err(|error| error.to_string())?;
        let _ = receiver.recv_timeout(Duration::from_millis(250));
        return Ok(true);
    }
    Ok(false)
}

pub fn discover_once(
    service_type: &str,
    timeout_ms: u32,
) -> std::result::Result<Vec<DiscoveredService>, String> {
    let daemon = service_daemon()?;
    let receiver = daemon
        .browse(service_type)
        .map_err(|error| error.to_string())?;

    let mut results: HashMap<String, DiscoveredService> = HashMap::new();
    let timeout = Duration::from_millis(timeout_ms as u64);
    let start = Instant::now();

    loop {
        let elapsed = start.elapsed();
        if elapsed >= timeout {
            break;
        }
        let remaining = timeout.saturating_sub(elapsed);
        match receiver.recv_timeout(remaining) {
            Ok(ServiceEvent::ServiceResolved(info)) => {
                let service = to_discovered_service(&info);
                results.insert(service.fullname.clone(), service);
            }
            Ok(_) => {}
            Err(_) => break,
        }
    }

    let _ = daemon.stop_browse(service_type);

    Ok(dedupe_discovered_services(
        results.into_values().collect::<Vec<_>>(),
    ))
}

pub fn dedupe_discovered_services(mut services: Vec<DiscoveredService>) -> Vec<DiscoveredService> {
    let mut dedup = HashMap::<String, DiscoveredService>::new();
    for service in services.drain(..) {
        dedup.insert(service.fullname.clone(), service);
    }
    let mut output = dedup.into_values().collect::<Vec<_>>();
    output.sort_by(|left, right| left.fullname.cmp(&right.fullname));
    output
}

#[napi]
pub fn start_advertisement(
    service_type: String,
    instance_name: String,
    port: u16,
    properties: Option<Vec<DiscoveryProperty>>,
) -> Result<String> {
    advertise_start(
        service_type.as_str(),
        instance_name.as_str(),
        port,
        properties,
    )
    .map_err(to_napi_error)
}

#[napi]
pub fn stop_advertisement(advertisement_id: String) -> Result<bool> {
    advertise_stop(advertisement_id.as_str()).map_err(to_napi_error)
}

#[napi]
pub fn browse_once(service_type: String, timeout_ms: u32) -> Result<Vec<DiscoveredService>> {
    discover_once(service_type.as_str(), timeout_ms).map_err(to_napi_error)
}

fn service_daemon() -> std::result::Result<&'static ServiceDaemon, String> {
    match SERVICE_DAEMON.as_ref() {
        Ok(daemon) => Ok(daemon),
        Err(error) => Err(error.clone()),
    }
}

fn to_discovered_service(info: &ResolvedService) -> DiscoveredService {
    let addresses = info
        .get_addresses()
        .iter()
        .map(|addr| addr.to_string())
        .collect();
    let properties = info
        .get_properties()
        .iter()
        .map(|prop| DiscoveryProperty {
            key: prop.key().to_string(),
            value: prop.val_str().to_string(),
        })
        .collect();

    DiscoveredService {
        fullname: info.get_fullname().to_string(),
        host: info.get_hostname().to_string(),
        port: info.get_port(),
        addresses,
        properties,
    }
}

fn properties_to_hash_map(properties: &[DiscoveryProperty]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for property in properties {
        map.insert(property.key.clone(), property.value.clone());
    }
    map
}

fn properties_to_map(properties: Option<Vec<DiscoveryProperty>>) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Some(props) = properties {
        for entry in props {
            map.insert(entry.key, entry.value);
        }
    }
    map
}

fn parse_capabilities(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect()
}

fn normalize_capabilities(capabilities: Vec<String>) -> Vec<String> {
    let mut unique = BTreeSet::new();
    for capability in capabilities {
        let normalized = capability.trim().to_string();
        if normalized.is_empty() {
            continue;
        }
        unique.insert(normalized);
    }
    unique.into_iter().collect::<Vec<_>>()
}

fn to_napi_error(message: String) -> Error {
    Error::new(Status::GenericFailure, message)
}

fn next_id(prefix: &str) -> String {
    let next = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    format!("{}-{}", prefix, next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_backend_properties_roundtrip() {
        let metadata = RuntimeBackendAdvertisementMetadata {
            backend_id: "backend-a".to_string(),
            display_name: Some("Backend A".to_string()),
            capabilities: vec!["code".to_string(), "plan".to_string(), "code".to_string()],
            max_concurrency: 8,
            cost_tier: "standard".to_string(),
            latency_class: "regional".to_string(),
            rollout_state: "current".to_string(),
            status: "active".to_string(),
        };
        let encoded = encode_runtime_backend_properties(&metadata);
        let decoded = decode_runtime_backend_properties(encoded.as_slice()).expect("decode");
        assert_eq!(decoded.backend_id, "backend-a");
        assert_eq!(decoded.display_name, Some("Backend A".to_string()));
        assert_eq!(
            decoded.capabilities,
            vec!["code".to_string(), "plan".to_string()]
        );
        assert_eq!(decoded.max_concurrency, 8);
        assert_eq!(decoded.status, "active");
    }

    #[test]
    fn decode_backend_properties_rejects_missing_required_fields() {
        let missing_backend = vec![DiscoveryProperty {
            key: PROP_CAPABILITIES.to_string(),
            value: "code".to_string(),
        }];
        let backend_error = decode_runtime_backend_properties(missing_backend.as_slice())
            .expect_err("backend id required");
        assert!(backend_error.contains("backendId"));

        let missing_capabilities = vec![DiscoveryProperty {
            key: PROP_BACKEND_ID.to_string(),
            value: "backend-a".to_string(),
        }];
        let capabilities_error = decode_runtime_backend_properties(missing_capabilities.as_slice())
            .expect_err("capabilities required");
        assert!(capabilities_error.contains("capabilities"));
    }

    #[test]
    fn dedupe_services_keeps_unique_fullnames() {
        let original = vec![
            DiscoveredService {
                fullname: "a".to_string(),
                host: "h1".to_string(),
                port: 1,
                addresses: vec!["127.0.0.1".to_string()],
                properties: Vec::new(),
            },
            DiscoveredService {
                fullname: "a".to_string(),
                host: "h2".to_string(),
                port: 2,
                addresses: vec!["127.0.0.2".to_string()],
                properties: Vec::new(),
            },
            DiscoveredService {
                fullname: "b".to_string(),
                host: "h3".to_string(),
                port: 3,
                addresses: vec!["127.0.0.3".to_string()],
                properties: Vec::new(),
            },
        ];
        let deduped = dedupe_discovered_services(original);
        assert_eq!(deduped.len(), 2);
        assert_eq!(deduped[0].fullname, "a");
        assert_eq!(deduped[1].fullname, "b");
    }
}
