use super::*;

fn persist_runtime_workspaces(
    ctx: &AppContext,
    workspaces: &[WorkspaceSummary],
) -> Result<(), RpcError> {
    let encoded = serde_json::to_value(workspaces)
        .map_err(|error| RpcError::internal(format!("encode runtime workspaces failed: {error}")))?;
    ctx.native_state_store
        .upsert_setting_value_blocking(
            native_state_store::TABLE_NATIVE_RUNTIME_STATE_KV,
            RUNTIME_WORKSPACES_STATE_KEY,
            encoded,
        )
        .map_err(RpcError::internal)?;
    Ok(())
}

pub(super) async fn handle_workspace_prompt_rpc(
    ctx: &AppContext,
    method: &str,
    params: &Value,
) -> Result<Option<Value>, RpcError> {
    let result = match method {
        "code_workspaces_list" => {
            let state = ctx.state.read().await;
            Ok(json!(state.workspaces))
        }
        "code_workspace_pick_directory" => handle_workspace_pick_directory().await,
        "code_workspace_create" => {
            let params = as_object(params)?;
            let path = read_required_string(params, "path")?;
            let display_name = read_optional_string(params, "displayName")
                .or_else(|| path.split('/').last().map(ToOwned::to_owned))
                .unwrap_or_else(|| "Workspace".to_string());
            let mut state = ctx.state.write().await;
            let normalized_path = normalize_workspace_identity_path(path);
            if let Some(existing) = state.workspaces.iter().find(|workspace| {
                normalize_workspace_identity_path(workspace.path.as_str()) == normalized_path
            }) {
                return Ok(Some(json!(existing.clone())));
            }
            let workspace = WorkspaceSummary {
                id: new_id("workspace"),
                path: path.to_string(),
                display_name,
                connected: true,
                default_model_id: Some(ctx.config.default_model_id.clone()),
            };
            let mut next_workspaces = state.workspaces.clone();
            next_workspaces.push(workspace.clone());
            persist_runtime_workspaces(ctx, &next_workspaces)?;
            state.workspaces = next_workspaces;
            Ok(json!(workspace))
        }
        "code_workspace_rename" => {
            let params = as_object(params)?;
            let workspace_id = read_required_string(params, "workspaceId")?;
            let display_name = read_required_string(params, "displayName")?;
            let mut state = ctx.state.write().await;
            let mut next_workspaces = state.workspaces.clone();
            let Some(workspace) = next_workspaces
                .iter_mut()
                .find(|entry| entry.id == workspace_id)
            else {
                return Ok(Some(Value::Null));
            };
            workspace.display_name = display_name.to_string();
            let renamed_workspace = workspace.clone();
            persist_runtime_workspaces(ctx, &next_workspaces)?;
            state.workspaces = next_workspaces;
            Ok(json!(renamed_workspace))
        }
        "code_workspace_remove" => {
            let params = as_object(params)?;
            let workspace_id = read_required_string(params, "workspaceId")?;
            let mut state = ctx.state.write().await;
            let before = state.workspaces.len();
            let mut next_workspaces = state.workspaces.clone();
            next_workspaces.retain(|entry| entry.id != workspace_id);
            let removed = before != next_workspaces.len();
            if removed {
                persist_runtime_workspaces(ctx, &next_workspaces)?;
                state.workspaces = next_workspaces;
                state.workspace_threads.remove(workspace_id);
            }
            drop(state);
            if removed {
                detach_thread_live_subscriptions_for_workspace(
                    ctx,
                    workspace_id,
                    "code_workspace_remove",
                )
                .await;
            }
            Ok(json!(removed))
        }
        "code_workspace_files_list" => handle_workspace_files_list(ctx, params).await,
        "code_workspace_file_read" => handle_workspace_file_read(ctx, params).await,
        "code_workspace_diagnostics_list_v1" => {
            handle_workspace_diagnostics_list_v1(ctx, params).await
        }
        "code_workspace_patch_apply_v1" => handle_workspace_patch_apply_v1(ctx, params).await,
        "code_git_changes_list" => handle_git_changes_list(ctx, params).await,
        "code_git_log" => handle_git_log(ctx, params).await,
        "code_git_diff_read" => handle_git_diff_read(ctx, params).await,
        "code_browser_debug_status_v1" => handle_browser_debug_status_v1(ctx, params).await,
        "code_browser_debug_run_v1" => handle_browser_debug_run_v1(ctx, params).await,
        "code_mini_program_status_v1" => handle_mini_program_status_v1(ctx, params).await,
        "code_mini_program_run_v1" => handle_mini_program_run_v1(ctx, params).await,
        "code_git_branches_list" => handle_git_branches_list(ctx, params).await,
        "code_git_branch_create" => handle_git_branch_create(ctx, params).await,
        "code_git_branch_checkout" => handle_git_branch_checkout(ctx, params).await,
        "code_git_stage_change" => handle_git_stage_change(ctx, params).await,
        "code_git_stage_all" => handle_git_stage_all(ctx, params).await,
        "code_git_unstage_change" => handle_git_unstage_change(ctx, params).await,
        "code_git_revert_change" => handle_git_revert_change(ctx, params).await,
        "code_git_commit" => handle_git_commit(ctx, params).await,
        "code_prompt_library_list" => {
            let params = as_object(params)?;
            let workspace_id = read_optional_string(params, "workspaceId");
            let state = ctx.state.read().await;
            Ok(json!(list_prompt_library_entries(
                &state,
                workspace_id.as_deref(),
            )))
        }
        "code_prompt_library_create" => {
            let params = as_object(params)?;
            let scope = read_required_prompt_scope(params, "scope")?;
            let title = read_required_string(params, "title")?.trim().to_string();
            if title.is_empty() {
                return Err(RpcError::invalid_params("prompt title is required"));
            }
            let description = read_optional_string(params, "description").unwrap_or_default();
            let content = read_optional_string(params, "content").unwrap_or_default();
            let mut state = ctx.state.write().await;
            let record = RuntimePromptLibraryRecord {
                id: new_id("prompt"),
                title,
                description,
                content,
            };
            let entry = match scope {
                RuntimePromptScope::Global => {
                    state.prompt_library_global.push(record.clone());
                    build_prompt_library_entry(&record, RuntimePromptScope::Global)
                }
                RuntimePromptScope::Workspace => {
                    let workspace_id = read_required_string(params, "workspaceId")?;
                    ensure_workspace(&mut state, workspace_id, &ctx.config.default_model_id);
                    state
                        .prompt_library_workspace
                        .entry(workspace_id.to_string())
                        .or_default()
                        .push(record.clone());
                    build_prompt_library_entry(&record, RuntimePromptScope::Workspace)
                }
            };
            Ok(json!(entry))
        }
        "code_prompt_library_update" => {
            let params = as_object(params)?;
            let prompt_id = read_required_string(params, "promptId")?;
            let title = read_required_string(params, "title")?.trim().to_string();
            if title.is_empty() {
                return Err(RpcError::invalid_params("prompt title is required"));
            }
            let description = read_optional_string(params, "description").unwrap_or_default();
            let content = read_optional_string(params, "content").unwrap_or_default();
            let mut state = ctx.state.write().await;
            if let Some(record) = state
                .prompt_library_global
                .iter_mut()
                .find(|entry| entry.id == prompt_id)
            {
                record.title = title;
                record.description = description;
                record.content = content;
                return Ok(Some(json!(build_prompt_library_entry(
                    record,
                    RuntimePromptScope::Global,
                ))));
            }
            for records in state.prompt_library_workspace.values_mut() {
                if let Some(record) = records.iter_mut().find(|entry| entry.id == prompt_id) {
                    record.title = title;
                    record.description = description;
                    record.content = content;
                    return Ok(Some(json!(build_prompt_library_entry(
                        record,
                        RuntimePromptScope::Workspace,
                    ))));
                }
            }
            Err(RpcError::invalid_params("prompt id not found"))
        }
        "code_prompt_library_delete" => {
            let params = as_object(params)?;
            let prompt_id = read_required_string(params, "promptId")?;
            let mut state = ctx.state.write().await;
            if let Some(index) = state
                .prompt_library_global
                .iter()
                .position(|entry| entry.id == prompt_id)
            {
                state.prompt_library_global.remove(index);
                return Ok(Some(json!(true)));
            }
            if remove_prompt_from_workspace_store(&mut state, prompt_id).is_some() {
                return Ok(Some(json!(true)));
            }
            Ok(json!(false))
        }
        "code_prompt_library_move" => {
            let params = as_object(params)?;
            let prompt_id = read_required_string(params, "promptId")?;
            let target_scope = read_required_prompt_scope(params, "targetScope")?;
            let mut state = ctx.state.write().await;
            if let Some(index) = state
                .prompt_library_global
                .iter()
                .position(|entry| entry.id == prompt_id)
            {
                let record = state.prompt_library_global[index].clone();
                return Ok(Some(match target_scope {
                    RuntimePromptScope::Global => Ok(json!(build_prompt_library_entry(
                        &record,
                        RuntimePromptScope::Global
                    ))),
                    RuntimePromptScope::Workspace => {
                        let workspace_id = read_required_string(params, "workspaceId")?;
                        ensure_workspace(&mut state, workspace_id, &ctx.config.default_model_id);
                        let moved = state.prompt_library_global.remove(index);
                        state
                            .prompt_library_workspace
                            .entry(workspace_id.to_string())
                            .or_default()
                            .push(moved.clone());
                        Ok(json!(build_prompt_library_entry(
                            &moved,
                            RuntimePromptScope::Workspace,
                        )))
                    }
                }?));
            }
            let Some((source_workspace_id, record)) =
                remove_prompt_from_workspace_store(&mut state, prompt_id)
            else {
                return Err(RpcError::invalid_params("prompt id not found"));
            };
            match target_scope {
                RuntimePromptScope::Global => {
                    state.prompt_library_global.push(record.clone());
                    Ok(json!(build_prompt_library_entry(
                        &record,
                        RuntimePromptScope::Global,
                    )))
                }
                RuntimePromptScope::Workspace => {
                    let workspace_id = read_required_string(params, "workspaceId")?;
                    if source_workspace_id == workspace_id {
                        state
                            .prompt_library_workspace
                            .entry(workspace_id.to_string())
                            .or_default()
                            .push(record.clone());
                        return Ok(Some(json!(build_prompt_library_entry(
                            &record,
                            RuntimePromptScope::Workspace,
                        ))));
                    }

                    ensure_workspace(&mut state, workspace_id, &ctx.config.default_model_id);
                    state
                        .prompt_library_workspace
                        .entry(workspace_id.to_string())
                        .or_default()
                        .push(record.clone());
                    Ok(json!(build_prompt_library_entry(
                        &record,
                        RuntimePromptScope::Workspace,
                    )))
                }
            }
        }
        _ => return Ok(None),
    };

    Ok(Some(result?))
}
