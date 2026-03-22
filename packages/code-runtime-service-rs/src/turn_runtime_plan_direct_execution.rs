use super::{
    build_provider_runtime_plan_prompt, enforce_provider_runtime_plan_step_constraints,
    is_full_access_mode, parse_provider_runtime_plan_response,
    parse_provider_runtime_plan_tool_arguments, query_provider, AppContext,
    ProviderRuntimePlanResponse, TurnProviderRoute,
};
use crate::provider_query::query_provider_runtime_tool_call;

fn extract_runtime_user_request(message: &str) -> &str {
    if let Some(index) = message.rfind("[/ATLAS_CONTEXT]") {
        return message[(index + "[/ATLAS_CONTEXT]".len())..].trim();
    }
    message.trim()
}

pub(super) fn request_requires_direct_runtime_execution(message: &str) -> bool {
    let request = extract_runtime_user_request(message);
    if request.is_empty() {
        return false;
    }

    let lowered = request.to_ascii_lowercase();
    let normalized = request.replace(char::is_whitespace, "");

    let asks_for_instructions = lowered.contains("how to")
        || lowered.contains("what command")
        || lowered.contains("which command")
        || lowered.contains("command for")
        || lowered.contains("show me the command")
        || lowered.contains("give me the command")
        || lowered.contains("tell me the command")
        || lowered.contains("explain how")
        || lowered.contains("example")
        || lowered.contains("examples")
        || lowered.contains("sample")
        || lowered.contains('?')
        || request.contains('？')
        || normalized.contains("如何")
        || normalized.contains("怎么")
        || normalized.contains("怎样")
        || normalized.contains("什么命令")
        || normalized.contains("哪个命令")
        || normalized.contains("给我命令")
        || normalized.contains("给我一个")
        || normalized.contains("告诉我怎么")
        || normalized.contains("解释一下")
        || normalized.contains("解释如何")
        || normalized.contains("的命令")
        || normalized.contains("示例")
        || normalized.contains("例子");
    if asks_for_instructions {
        return false;
    }

    if lowered.lines().map(str::trim_start).any(|line| {
        [
            "npm ", "pnpm ", "yarn ", "bun ", "npx ", "cargo ", "git ", "python ", "python3 ",
            "node ", "./",
        ]
        .iter()
        .any(|prefix| line.starts_with(prefix))
    }) {
        return true;
    }

    [
        "create ",
        "scaffold",
        "set up",
        "setup",
        "initialize",
        "initialise",
        "init ",
        "generate",
        "install",
        "read ",
        "open ",
        "list ",
        "inspect ",
        "check ",
        "verify ",
        "run ",
        "execute",
        "fix ",
        "patch",
        "implement",
        "update",
        "modify",
        "edit ",
        "write ",
        "add ",
        "remove ",
        "delete ",
        "rename",
        "migrate",
        "build ",
        "start ",
        "launch",
    ]
    .iter()
    .any(|keyword| lowered.contains(keyword))
        || [
            "创建",
            "新建",
            "搭建",
            "生成",
            "安装",
            "读取",
            "查看",
            "列出",
            "检查",
            "验证",
            "运行",
            "执行",
            "修复",
            "实现",
            "更新",
            "修改",
            "编辑",
            "写入",
            "添加",
            "删除",
            "重命名",
            "迁移",
            "构建",
            "启动",
        ]
        .iter()
        .any(|keyword| normalized.contains(keyword))
}

pub(super) fn should_emit_provider_runtime_plan_delta(
    user_content: &str,
    access_mode: &str,
    suppress_plan_delta: bool,
) -> bool {
    !suppress_plan_delta
        && !(is_full_access_mode(access_mode)
            && request_requires_direct_runtime_execution(user_content))
}

pub(super) fn should_retry_planner_for_direct_execution(
    user_content: &str,
    access_mode: &str,
    plan: &ProviderRuntimePlanResponse,
) -> bool {
    is_full_access_mode(access_mode)
        && request_requires_direct_runtime_execution(user_content)
        && plan.steps.is_empty()
}

fn build_provider_runtime_plan_retry_prompt(
    user_content: &str,
    workspace_path: &str,
    previous_final_message: Option<&str>,
) -> String {
    let previous_final_message = previous_final_message
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .unwrap_or("none");
    format!(
        "{}\n\nPrevious planner attempt returned no executable steps for a direct execution request.\n\
This is invalid unless execution is concretely blocked.\n\
Previous finalMessage: {previous_final_message}\n\
Replan now. Return executable runtime steps, or use finalMessage only to report a specific blocker you cannot resolve automatically.",
        build_provider_runtime_plan_prompt(user_content, workspace_path)
    )
}

pub(super) async fn maybe_retry_direct_execution_tool_plan(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    access_mode: &str,
    workspace_path: &str,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    plan: ProviderRuntimePlanResponse,
) -> ProviderRuntimePlanResponse {
    if !should_retry_planner_for_direct_execution(content, access_mode, &plan) {
        return plan;
    }

    let retry_prompt = build_provider_runtime_plan_retry_prompt(
        content,
        workspace_path,
        plan.final_message.as_deref(),
    );
    let Ok(retry_selection) = query_provider_runtime_tool_call(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        retry_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await
    else {
        return plan;
    };

    let Some(retry_arguments) = retry_selection.tool_arguments.as_deref() else {
        return plan;
    };
    let Some(retry_plan) = parse_provider_runtime_plan_tool_arguments(retry_arguments) else {
        return plan;
    };
    enforce_provider_runtime_plan_step_constraints(content, retry_plan)
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn maybe_retry_direct_execution_legacy_plan(
    ctx: &AppContext,
    provider_route: &TurnProviderRoute,
    access_mode: &str,
    workspace_path: &str,
    content: &str,
    model_id: &str,
    reason_effort: Option<&str>,
    service_tier: Option<&str>,
    compat_base_url_override: Option<&str>,
    api_key_override: Option<&str>,
    fallback_api_key_override: Option<&str>,
    local_codex_id_token_override: Option<&str>,
    local_codex_refresh_token_override: Option<&str>,
    persist_local_codex_auth_updates: bool,
    oauth_credential_source_override: Option<&str>,
    oauth_auth_mode_override: Option<&str>,
    oauth_external_account_id_override: Option<&str>,
    plan: ProviderRuntimePlanResponse,
) -> ProviderRuntimePlanResponse {
    if !should_retry_planner_for_direct_execution(content, access_mode, &plan) {
        return plan;
    }

    let retry_prompt = build_provider_runtime_plan_retry_prompt(
        content,
        workspace_path,
        plan.final_message.as_deref(),
    );
    let Ok(retry_response) = query_provider(
        &ctx.client,
        &ctx.config,
        provider_route,
        compat_base_url_override,
        api_key_override,
        fallback_api_key_override,
        local_codex_id_token_override,
        local_codex_refresh_token_override,
        persist_local_codex_auth_updates,
        oauth_credential_source_override,
        oauth_auth_mode_override,
        oauth_external_account_id_override,
        retry_prompt.as_str(),
        model_id,
        reason_effort,
        service_tier,
    )
    .await
    else {
        return plan;
    };

    let Some(retry_plan) = parse_provider_runtime_plan_response(retry_response.as_str()) else {
        return plan;
    };
    enforce_provider_runtime_plan_step_constraints(content, retry_plan)
}

#[cfg(test)]
mod tests {
    use super::{
        request_requires_direct_runtime_execution, should_emit_provider_runtime_plan_delta,
        should_retry_planner_for_direct_execution, ProviderRuntimePlanResponse,
    };

    #[test]
    fn direct_runtime_execution_detection_rejects_instruction_queries() {
        assert!(request_requires_direct_runtime_execution(
            "创建现代化 vite+react+oxc Starter 项目"
        ));
        assert!(request_requires_direct_runtime_execution(
            "Read the file chain-check.txt and reply with exactly OK."
        ));
        assert!(request_requires_direct_runtime_execution(
            "列出当前工作区根目录的两个顶级目录名称，不要修改文件。"
        ));
        assert!(!request_requires_direct_runtime_execution(
            "给我一个创建现代化 vite+react+oxc Starter 项目的命令"
        ));
        assert!(!request_requires_direct_runtime_execution(
            "How do I create a modern vite react oxc starter project?"
        ));
    }

    #[test]
    fn runtime_plan_delta_is_suppressed_for_direct_execution_requests() {
        assert!(!should_emit_provider_runtime_plan_delta(
            "创建现代化 vite+react+oxc Starter 项目",
            "full-access",
            false
        ));
        assert!(!should_emit_provider_runtime_plan_delta(
            "Read the file chain-check.txt and reply with exactly OK.",
            "full-access",
            false
        ));
        assert!(!should_emit_provider_runtime_plan_delta(
            "列出当前工作区根目录的两个顶级目录名称，不要修改文件。",
            "full-access",
            false
        ));
        assert!(should_emit_provider_runtime_plan_delta(
            "How do I create a modern vite react oxc starter project?",
            "full-access",
            false
        ));
        assert!(!should_emit_provider_runtime_plan_delta(
            "How do I create a modern vite react oxc starter project?",
            "full-access",
            true
        ));
    }

    #[test]
    fn direct_execution_requests_retry_when_planner_only_returns_advice() {
        let plan = ProviderRuntimePlanResponse {
            plan: vec![],
            steps: vec![],
            final_message: Some(
                "If you want JavaScript instead of TypeScript, use react-oxc.".to_string(),
            ),
        };

        assert!(should_retry_planner_for_direct_execution(
            "创建现代化 vite+react+oxc Starter 项目",
            "full-access",
            &plan
        ));
        assert!(!should_retry_planner_for_direct_execution(
            "How do I create a modern vite react oxc starter project?",
            "full-access",
            &plan
        ));
    }
}
