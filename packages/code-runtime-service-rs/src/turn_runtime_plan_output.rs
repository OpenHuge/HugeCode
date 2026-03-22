use super::{
    ProviderRuntimePlanResponse, ProviderRuntimeStepResult,
    PROVIDER_RUNTIME_FINAL_PROMPT_STEP_OUTPUT_MAX_BYTES, PROVIDER_RUNTIME_PLAN_MAX_STEPS,
    PROVIDER_RUNTIME_STEP_OUTPUT_PREVIEW_MAX_BYTES,
};
use serde_json::{json, Value};

pub(super) fn build_provider_runtime_plan_delta(
    plan: &ProviderRuntimePlanResponse,
) -> Option<String> {
    let items = if !plan.plan.is_empty() {
        plan.plan
            .iter()
            .take(PROVIDER_RUNTIME_PLAN_MAX_STEPS)
            .map(|entry| entry.trim())
            .filter(|entry| !entry.is_empty())
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>()
    } else {
        plan.steps
            .iter()
            .take(PROVIDER_RUNTIME_PLAN_MAX_STEPS)
            .map(|step| {
                format!(
                    "{} {}",
                    step.kind.as_str(),
                    step.path
                        .as_deref()
                        .or(step.command.as_deref())
                        .unwrap_or_default()
                        .trim()
                )
            })
            .collect::<Vec<_>>()
    };
    if items.is_empty() {
        return None;
    }
    let body = items
        .iter()
        .enumerate()
        .map(|(index, entry)| format!("{}. {}", index + 1, entry))
        .collect::<Vec<_>>()
        .join("\n");
    Some(format!("Runtime plan:\n{body}\n\n"))
}

fn build_provider_runtime_plan_review_items(plan: &ProviderRuntimePlanResponse) -> Vec<String> {
    if !plan.plan.is_empty() {
        return plan
            .plan
            .iter()
            .take(PROVIDER_RUNTIME_PLAN_MAX_STEPS)
            .map(|entry| entry.trim())
            .filter(|entry| !entry.is_empty())
            .map(ToOwned::to_owned)
            .collect();
    }

    plan.steps
        .iter()
        .take(PROVIDER_RUNTIME_PLAN_MAX_STEPS)
        .map(|step| {
            let target = step
                .path
                .as_deref()
                .or(step.command.as_deref())
                .or(step.input.as_deref())
                .unwrap_or_default()
                .trim();
            if target.is_empty() {
                step.kind.as_str().to_string()
            } else {
                format!("{} {}", step.kind.as_str(), target)
            }
        })
        .collect()
}

pub(super) fn build_provider_runtime_plan_review_body(
    plan: &ProviderRuntimePlanResponse,
) -> Option<String> {
    let items = build_provider_runtime_plan_review_items(plan);
    let final_message = plan
        .final_message
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty());

    if items.is_empty() {
        return final_message.map(ToOwned::to_owned);
    }

    let mut lines = vec!["Execution plan".to_string()];
    lines.extend(
        items
            .iter()
            .enumerate()
            .map(|(index, entry)| format!("{}. {}", index + 1, entry)),
    );
    if let Some(note) = final_message {
        lines.push(String::new());
        lines.push(format!("Note: {note}"));
    }
    Some(lines.join("\n"))
}

fn truncate_utf8_to_max_bytes(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_string();
    }
    let mut boundary = max_bytes;
    while boundary > 0 && !value.is_char_boundary(boundary) {
        boundary -= 1;
    }
    value[..boundary].to_string()
}

fn truncate_output_for_final_prompt(output: &str) -> String {
    let trimmed = output.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.len() <= PROVIDER_RUNTIME_FINAL_PROMPT_STEP_OUTPUT_MAX_BYTES {
        return trimmed.to_string();
    }
    let preview =
        truncate_utf8_to_max_bytes(trimmed, PROVIDER_RUNTIME_FINAL_PROMPT_STEP_OUTPUT_MAX_BYTES);
    format!(
        "Output trimmed for final response context budget ({}/{}) bytes preview retained.\n\n{}",
        preview.len(),
        trimmed.len(),
        preview
    )
}

pub(super) fn build_provider_runtime_final_results_json(
    results: &[ProviderRuntimeStepResult],
) -> String {
    let summarized = results
        .iter()
        .map(|result| {
            let output = result
                .output
                .as_deref()
                .map(truncate_output_for_final_prompt)
                .filter(|entry| !entry.is_empty());
            let execution_graph = json!({
                "taskKey": result.metadata.get("plannerStepKey"),
                "dependsOn": result.metadata.get("plannerDependsOn"),
                "waveIndex": result.metadata.get("plannerWaveIndex"),
                "parallelSafe": result.metadata.get("parallelSafe"),
            });
            json!({
                "index": result.index,
                "kind": result.kind,
                "ok": result.ok,
                "message": result.message,
                "errorCode": result.error_code,
                "output": output,
                "executionGraph": execution_graph,
            })
        })
        .collect::<Vec<_>>();
    serde_json::to_string_pretty(&summarized).unwrap_or_else(|_| "[]".to_string())
}

pub(super) fn compact_provider_runtime_step_output(
    tool_call_id: &str,
    output: &str,
) -> (Option<String>, Value) {
    let byte_count = output.len();
    if byte_count <= PROVIDER_RUNTIME_STEP_OUTPUT_PREVIEW_MAX_BYTES {
        let normalized = output
            .trim()
            .is_empty()
            .then(String::new)
            .unwrap_or_else(|| output.to_string());
        let output = if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        };
        return (
            output,
            json!({
                "compactionApplied": false,
                "outputByteCount": byte_count,
                "outputPreviewByteCount": byte_count,
            }),
        );
    }

    let preview =
        truncate_utf8_to_max_bytes(output, PROVIDER_RUNTIME_STEP_OUTPUT_PREVIEW_MAX_BYTES);
    let preview_byte_count = preview.len();
    let output_reference = format!("turn://{tool_call_id}/output");
    let output_summary = format!(
        "Output compacted for context budget ({preview_byte_count}/{byte_count} bytes preview retained)."
    );
    let compacted_output = format!("{output_summary}\nReference: {output_reference}\n\n{preview}");
    (
        Some(compacted_output),
        json!({
            "compactionApplied": true,
            "outputByteCount": byte_count,
            "outputPreviewByteCount": preview_byte_count,
            "outputCompactionSummary": output_summary,
            "outputCompactionReference": output_reference,
        }),
    )
}
