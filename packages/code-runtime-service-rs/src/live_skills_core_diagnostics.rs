async fn execute_core_diagnostics_skill(
    resolved_scope: Result<&WorkspaceScope, &String>,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };

    let query = crate::workspace_diagnostics::WorkspaceDiagnosticsQuery {
        paths: options.paths.clone().unwrap_or_default(),
        severities: options
            .severities
            .as_deref()
            .map(|values| {
                values
                    .iter()
                    .filter_map(|value| {
                        crate::workspace_diagnostics::WorkspaceDiagnosticSeverity::from_level(
                            value.as_str(),
                        )
                    })
                    .collect()
            })
            .unwrap_or_default(),
        max_items: options.max_items.and_then(|value| usize::try_from(value).ok()),
        include_provider_details: options.include_provider_details.unwrap_or(false),
    };
    let diagnostics =
        crate::workspace_diagnostics::collect_workspace_diagnostics(scope.workspace_path.as_path(), &query)
            .await;
    let output = serde_json::to_string_pretty(&diagnostics)
        .unwrap_or_else(|_| "{}".to_string());
    let message = if diagnostics.available {
        format!(
            "Workspace diagnostics collected ({} item(s)).",
            diagnostics.summary.total
        )
    } else {
        diagnostics
            .reason
            .clone()
            .unwrap_or_else(|| "Workspace diagnostics are unavailable.".to_string())
    };

    LiveSkillExecutionResult {
        run_id: new_id("live-skill-run"),
        skill_id: skill_id.to_string(),
        status: "completed".to_string(),
        message,
        output,
        network: None,
        artifacts: vec![],
        metadata: json!({
            "workspaceId": scope.workspace_id,
            "available": diagnostics.available,
            "summary": diagnostics.summary,
            "providers": diagnostics.providers,
            "generatedAtMs": diagnostics.generated_at_ms,
            "reason": diagnostics.reason,
        }),
    }
}
