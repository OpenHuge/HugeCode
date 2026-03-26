#![allow(dead_code)]

use crate::models::{TurnAck, TurnSendRequest};

use super::common_utils::{derive_thread_title, unix_timestamp_seconds};
use super::state_utils::{
    extract_collaboration_mode_id, sync_resolver_circuits_to_state, touch_thread_activity,
};
use super::turn_contract::{
    build_route_failure_message, fallback_error_message, infer_provider_from_model_id,
    invalid_turn_ack, is_supported_turn_provider, normalize_model_id, normalize_provider_hint,
};
use super::RuntimeBackend;
use crate::models::{ResolvedRoute, RouteReason};

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn normalize_access_mode(value: &str) -> Option<&'static str> {
    match value.trim() {
        "read-only" => Some("read-only"),
        "on-request" => Some("on-request"),
        "full-access" => Some("full-access"),
        _ => None,
    }
}

fn normalize_reason_effort(value: Option<&str>) -> Option<&'static str> {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        None => Some("high"),
        Some("low") => Some("low"),
        Some("medium") => Some("medium"),
        Some("high") => Some("high"),
        Some("xhigh") => Some("xhigh"),
        Some(_) => None,
    }
}

fn normalize_execution_mode(value: Option<&str>) -> Option<&'static str> {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        None => Some("runtime"),
        Some("runtime") => Some("runtime"),
        Some("hybrid") => Some("hybrid"),
        Some("local-cli") => Some("local-cli"),
        Some(_) => None,
    }
}

fn collect_codex_args(value: Option<&[String]>) -> Vec<String> {
    value
        .unwrap_or_default()
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect()
}

fn collect_unsupported_collaboration_settings(
    collaboration_mode: Option<&serde_json::Value>,
) -> Result<Vec<&'static str>, String> {
    let Some(mode) = collaboration_mode else {
        return Ok(Vec::new());
    };
    let Some(mode_object) = mode.as_object() else {
        return Err(
            "INVALID_PARAMS: collaborationMode must be an object when provided.".to_string(),
        );
    };
    let Some(settings_value) = mode_object.get("settings") else {
        return Ok(Vec::new());
    };
    if settings_value.is_null() {
        return Ok(Vec::new());
    }
    let Some(settings) = settings_value.as_object() else {
        return Err(
            "INVALID_PARAMS: collaborationMode.settings must be an object when provided."
                .to_string(),
        );
    };

    let mut unsupported = Vec::new();
    for field in ["developer_instructions", "model", "reasoning_effort"] {
        if settings.get(field).is_some_and(|value| !value.is_null()) {
            unsupported.push(field);
        }
    }
    Ok(unsupported)
}

impl RuntimeBackend {
    pub fn send_turn(&self, payload: TurnSendRequest) -> TurnAck {
        let workspace_id = payload.workspace_id.trim();
        if workspace_id.is_empty() {
            return invalid_turn_ack(
                payload.thread_id.clone(),
                payload.provider.clone(),
                payload.model_id.clone(),
                "INVALID_PARAMS: workspaceId is required.".to_string(),
            );
        }
        let workspace_id = workspace_id.to_string();
        let request_id = normalize_optional_text(payload.request_id.as_deref());
        let request_suffix = request_id
            .as_deref()
            .map_or(String::new(), |id| format!(", request: {id}"));
        let context_prefix = normalize_optional_text(payload.context_prefix.as_deref());
        if context_prefix.is_some() {
            return invalid_turn_ack(
                payload.thread_id.clone(),
                payload.provider.clone(),
                payload.model_id.clone(),
                format!(
                    "INVALID_PARAMS: contextPrefix is not supported by the desktop tauri runtime backend yet.{request_suffix}"
                ),
            );
        }

        let access_mode = match normalize_access_mode(&payload.access_mode) {
            Some(access_mode) => access_mode,
            None => {
                return invalid_turn_ack(
                    payload.thread_id.clone(),
                    payload.provider.clone(),
                    payload.model_id.clone(),
                    format!(
                        "INVALID_PARAMS: unsupported accessMode '{}'. Allowed: read-only, on-request, full-access.{request_suffix}",
                        payload.access_mode.trim()
                    ),
                );
            }
        };

        let resolved_reason_effort = match normalize_reason_effort(payload.reason_effort.as_deref())
        {
            Some(reason_effort) => reason_effort,
            None => {
                return invalid_turn_ack(
                    payload.thread_id.clone(),
                    payload.provider.clone(),
                    payload.model_id.clone(),
                    format!(
                        "INVALID_PARAMS: unsupported reasonEffort '{}'. Allowed: low, medium, high, xhigh.{request_suffix}",
                        payload.reason_effort.as_deref().unwrap_or_default().trim()
                    ),
                );
            }
        };

        let execution_mode = match normalize_execution_mode(payload.execution_mode.as_deref()) {
            Some("local-cli") => {
                return invalid_turn_ack(
                    payload.thread_id.clone(),
                    payload.provider.clone(),
                    payload.model_id.clone(),
                    format!(
                        "INVALID_PARAMS: executionMode 'local-cli' is not supported by the desktop tauri runtime backend. Allowed: runtime, hybrid.{request_suffix}"
                    ),
                );
            }
            Some(mode) => mode,
            None => {
                return invalid_turn_ack(
                    payload.thread_id.clone(),
                    payload.provider.clone(),
                    payload.model_id.clone(),
                    format!(
                        "INVALID_PARAMS: unsupported executionMode '{}'. Allowed: runtime, hybrid.{request_suffix}",
                        payload.execution_mode.as_deref().unwrap_or_default().trim()
                    ),
                );
            }
        };

        let codex_bin = normalize_optional_text(payload.codex_bin.as_deref());
        let codex_args = collect_codex_args(payload.codex_args.as_deref());
        if codex_bin.is_some() || !codex_args.is_empty() {
            return invalid_turn_ack(
                payload.thread_id.clone(),
                payload.provider.clone(),
                payload.model_id.clone(),
                format!(
                    "INVALID_PARAMS: codexBin/codexArgs overrides are not supported by the desktop tauri runtime backend yet.{request_suffix}"
                ),
            );
        }

        let unsupported_collaboration_settings =
            match collect_unsupported_collaboration_settings(payload.collaboration_mode.as_ref()) {
                Ok(settings) => settings,
                Err(message) => {
                    return invalid_turn_ack(
                        payload.thread_id.clone(),
                        payload.provider.clone(),
                        payload.model_id.clone(),
                        format!("{message}{request_suffix}"),
                    );
                }
            };
        if !unsupported_collaboration_settings.is_empty() {
            return invalid_turn_ack(
                payload.thread_id.clone(),
                payload.provider.clone(),
                payload.model_id.clone(),
                format!(
                    "INVALID_PARAMS: collaborationMode.settings fields are not supported by the desktop tauri runtime backend yet ({}).{request_suffix}",
                    unsupported_collaboration_settings.join(", ")
                ),
            );
        }

        let requested_provider = payload
            .provider
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let explicit_provider = normalize_provider_hint(requested_provider);
        if requested_provider.is_some() && explicit_provider.is_none() {
            return invalid_turn_ack(
                payload.thread_id.clone(),
                payload.provider.clone(),
                payload.model_id.clone(),
                format!(
                    "INVALID_PARAMS: unsupported provider '{}'. Allowed: openai, anthropic, claude_code_local, google.",
                    requested_provider.unwrap_or_default()
                ),
            );
        }
        if let Some(provider) = explicit_provider.as_deref() {
            if !is_supported_turn_provider(provider) {
                return invalid_turn_ack(
                    payload.thread_id.clone(),
                    payload.provider.clone(),
                    payload.model_id.clone(),
                    format!(
                        "INVALID_PARAMS: unsupported provider '{}'. Allowed: openai, anthropic, claude_code_local, google.",
                        provider
                    ),
                );
            }
        }

        let explicit_model_id = normalize_model_id(payload.model_id.as_deref());
        let requested_thread_id = payload
            .thread_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        if let (Some(provider), Some(model_id)) =
            (explicit_provider.as_deref(), explicit_model_id.as_deref())
        {
            if let Some(inferred_provider) = infer_provider_from_model_id(model_id) {
                let local_claude_match =
                    provider == "claude_code_local" && inferred_provider == "anthropic";
                if inferred_provider != provider && !local_claude_match {
                    return invalid_turn_ack(
                        payload.thread_id.clone(),
                        payload.provider.clone(),
                        payload.model_id.clone(),
                        format!(
                            "INVALID_PARAMS: provider/model mismatch ('{}' vs '{}').",
                            provider, model_id
                        ),
                    );
                }
            }
        }

        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while sending turn");

        state.ensure_workspace(&workspace_id, self.resolver.default_model_id().as_deref());

        if let Some(requested_thread_id) = requested_thread_id.as_deref() {
            if let Some(existing_thread) = state.threads.get(requested_thread_id) {
                if existing_thread.workspace_id != workspace_id {
                    return invalid_turn_ack(
                        Some(requested_thread_id.to_string()),
                        payload.provider.clone(),
                        payload.model_id.clone(),
                        format!(
                            "INVALID_PARAMS: thread/workspace mismatch ('{}' belongs to '{}', got '{}').",
                            requested_thread_id, existing_thread.workspace_id, workspace_id
                        ),
                    );
                }

                if existing_thread.running && !payload.queue {
                    return TurnAck {
                        accepted: false,
                        turn_id: None,
                        thread_id: Some(requested_thread_id.to_string()),
                        routed_provider: None,
                        routed_model_id: None,
                        routed_pool: None,
                        routed_source: None,
                        message: format!(
                            "SESSION_BUSY: thread '{}' already has an active turn; retry with queue=true or wait for completion.",
                            requested_thread_id
                        ),
                    };
                }
            }
        }

        let active_turn_lanes = state.active_turn_lane_count();
        if !payload.queue && active_turn_lanes >= self.max_active_turn_lanes {
            return TurnAck {
                accepted: false,
                turn_id: None,
                thread_id: requested_thread_id.clone(),
                routed_provider: None,
                routed_model_id: None,
                routed_pool: None,
                routed_source: None,
                message: format!(
                    "GLOBAL_BUSY: active turn lanes at capacity ({}/{}); retry with queue=true or wait for completion.",
                    active_turn_lanes, self.max_active_turn_lanes
                ),
            };
        }

        let workspace_default_model_id = state
            .workspaces
            .get(&workspace_id)
            .and_then(|workspace| workspace.default_model_id.clone());

        let provider_hint_model_id = explicit_provider.as_deref().and_then(|normalized| {
            self.resolver
                .model_pool()
                .into_iter()
                .find(|entry| entry.available && entry.provider.eq_ignore_ascii_case(normalized))
                .map(|entry| entry.id)
        });

        let requested_model_id = explicit_model_id.or(provider_hint_model_id);
        let explicit_local_claude_route = explicit_provider
            .as_deref()
            .filter(|provider| *provider == "claude_code_local")
            .map(|provider| ResolvedRoute {
                model_id: requested_model_id
                    .clone()
                    .unwrap_or_else(|| "claude-sonnet-4-5".to_string()),
                provider: provider.to_string(),
                pool: "claude_code_local".to_string(),
                source: "workspace-default".to_string(),
                reason: if payload.model_id.is_some() {
                    RouteReason::ExplicitModel
                } else {
                    RouteReason::WorkspaceDefault
                },
            });
        let candidate_routes = explicit_local_claude_route
            .map(|route| vec![route])
            .unwrap_or_else(|| {
                self.resolver.resolve_turn_candidates(
                    requested_model_id.as_deref(),
                    workspace_default_model_id.as_deref(),
                )
            });
        if candidate_routes.is_empty() {
            sync_resolver_circuits_to_state(&self.resolver, &mut state);
            self.persist_locked_state(&state);
            return TurnAck {
                accepted: false,
                turn_id: None,
                thread_id: None,
                routed_provider: None,
                routed_model_id: None,
                routed_pool: None,
                routed_source: None,
                message: "No available model route found for this turn.".to_string(),
            };
        }

        let mut route_failures = Vec::new();
        let mut selected_route = None;
        for candidate in candidate_routes {
            let provider = candidate.provider.to_ascii_lowercase();
            let mut route_error = None;

            if provider != "claude_code_local"
                && !self.resolver.route_metadata_matches_catalog(&candidate)
            {
                route_error = Some(format!(
                    "route/provider mismatch for {}",
                    candidate.model_id
                ));
            } else if self.should_simulate_provider_failure(&provider) {
                route_error = Some(format!(
                    "provider {} failed while routing {}",
                    candidate.provider, candidate.model_id
                ));
            }

            if let Some(error_message) = route_error {
                self.resolver.report_provider_failure(&candidate.provider);
                route_failures.push(format!(
                    "{}:{}:{}:{} => {}",
                    candidate.provider,
                    candidate.source,
                    candidate.pool,
                    candidate.model_id,
                    fallback_error_message(&error_message)
                ));
                continue;
            }
            self.resolver.report_provider_success(&candidate.provider);
            selected_route = Some(candidate);
            break;
        }
        let route = match selected_route {
            Some(route) => route,
            None => {
                sync_resolver_circuits_to_state(&self.resolver, &mut state);
                self.persist_locked_state(&state);
                return TurnAck {
                    accepted: false,
                    turn_id: None,
                    thread_id: None,
                    routed_provider: None,
                    routed_model_id: None,
                    routed_pool: None,
                    routed_source: None,
                    message: build_route_failure_message(
                        requested_model_id.as_deref(),
                        &route_failures,
                    ),
                };
            }
        };
        let now = unix_timestamp_seconds();
        let attachment_count = payload.attachments.len();
        let attachment_total_size: u64 = payload
            .attachments
            .iter()
            .map(|attachment| attachment.size)
            .sum();
        let attachment_manifest = payload
            .attachments
            .iter()
            .map(|attachment| {
                format!(
                    "{}:{}:{}",
                    attachment.id, attachment.name, attachment.mime_type
                )
            })
            .collect::<Vec<_>>()
            .join(",");
        let collaboration_mode_suffix =
            extract_collaboration_mode_id(payload.collaboration_mode.as_ref())
                .map_or(String::new(), |id| format!(", collaboration mode: {id}"));
        let attachment_execution_suffix = if attachment_count > 0 {
            ", attachment handling: metadata-only"
        } else {
            ""
        };
        let thread_id = state.ensure_thread(
            &workspace_id,
            requested_thread_id,
            derive_thread_title(&payload.content),
            now,
        );
        if let Some(thread) = state.threads.get_mut(&thread_id) {
            touch_thread_activity(thread, now);
            if !payload.queue {
                thread.running = true;
                thread.status = Some("active".to_string());
            } else {
                thread.status = Some("idle".to_string());
            }
            thread.unread = false;
            thread.provider = route.provider.clone();
            thread.model_id = Some(route.model_id.clone());
            if thread.title == "New thread" {
                thread.title = derive_thread_title(&payload.content);
            }
        }

        let turn_id = state.next_turn_id();
        if !payload.queue {
            state.clear_active_turns_for_thread(&thread_id);
            state
                .active_turns
                .insert(turn_id.clone(), thread_id.clone());
        }
        sync_resolver_circuits_to_state(&self.resolver, &mut state);
        self.persist_locked_state(&state);

        TurnAck {
            accepted: true,
            turn_id: Some(turn_id),
            thread_id: Some(thread_id),
            routed_provider: Some(route.provider.clone()),
            routed_model_id: Some(route.model_id.clone()),
            routed_pool: if route.provider == "claude_code_local" {
                None
            } else {
                Some(route.pool.clone())
            },
            routed_source: Some(route.source.clone()),
            message: format!(
                "Turn accepted via {} (execution: {}, reason: {}, source: {}, effort: {}, access: {}, attachments: {} [{}], bytes: {}{}{}{}).",
                route.model_id,
                execution_mode,
                route.reason.as_str(),
                route.source,
                resolved_reason_effort,
                access_mode,
                attachment_count,
                attachment_manifest,
                attachment_total_size,
                collaboration_mode_suffix,
                attachment_execution_suffix,
                request_suffix
            ),
        }
    }

    pub fn apply_runtime_turn_ack(&self, payload: &TurnSendRequest, ack: &TurnAck) {
        if !ack.accepted {
            return;
        }
        let workspace_id = payload.workspace_id.trim();
        let Some(thread_id) = ack
            .thread_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
        else {
            return;
        };

        let now = unix_timestamp_seconds();
        let requested_thread_id = payload
            .thread_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let mut state = self
            .state
            .lock()
            .expect("runtime state lock poisoned while mirroring runtime turn ack");

        state.ensure_workspace(workspace_id, self.resolver.default_model_id().as_deref());
        let ensured_thread_id = state.ensure_thread(
            workspace_id,
            Some(thread_id.clone()),
            derive_thread_title(&payload.content),
            now,
        );
        let final_thread_id = if ensured_thread_id.is_empty() {
            requested_thread_id.unwrap_or(thread_id)
        } else {
            ensured_thread_id
        };

        if let Some(thread) = state.threads.get_mut(&final_thread_id) {
            touch_thread_activity(thread, now);
            thread.unread = false;
            thread.provider = ack
                .routed_provider
                .clone()
                .unwrap_or_else(|| thread.provider.clone());
            if ack.routed_model_id.is_some() {
                thread.model_id = ack.routed_model_id.clone();
            }
            if !payload.queue {
                thread.running = true;
                thread.status = Some("active".to_string());
            } else if thread.status.is_none() {
                thread.status = Some("idle".to_string());
            }
            if thread.title == "New thread" {
                thread.title = derive_thread_title(&payload.content);
            }
        }

        if !payload.queue {
            state.clear_active_turns_for_thread(&final_thread_id);
            if let Some(turn_id) = ack
                .turn_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                state
                    .active_turns
                    .insert(turn_id.to_string(), final_thread_id.clone());
            }
        }
        sync_resolver_circuits_to_state(&self.resolver, &mut state);
        self.persist_locked_state(&state);
    }
}
