use super::*;

const OSV_QUERY_ENDPOINT: &str = "https://api.osv.dev/v1/query";
const OSV_REQUEST_TIMEOUT_MS: u64 = 1_500;
const SECURITY_PREFLIGHT_PERMISSION_MEMORY_ENABLED_ENV: &str =
    "CODE_RUNTIME_SECURITY_PREFLIGHT_PERMISSION_MEMORY_ENABLED";
const SECURITY_PREFLIGHT_EXEC_POLICY_ENABLED_ENV: &str =
    "CODE_RUNTIME_CODEX_EXECPOLICY_PREFLIGHT_ENABLED";
const SECURITY_PREFLIGHT_PERMISSION_TTL_MS_ENV: &str =
    "CODE_RUNTIME_SECURITY_PREFLIGHT_PERMISSION_TTL_MS";
const DEFAULT_SECURITY_PREFLIGHT_PERMISSION_TTL_MS: u64 = 10 * 60 * 1000;
const MIN_SECURITY_PREFLIGHT_PERMISSION_TTL_MS: u64 = 30 * 1000;
const MAX_SECURITY_PREFLIGHT_PERMISSION_TTL_MS: u64 = 24 * 60 * 60 * 1000;
const PERMISSION_MEMORY_REASON_PREFIX: &str = "Permission memory matched an approved context.";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeSecurityPreflightAdvisoryPayload {
    package_manager: String,
    package_name: String,
    indicator: String,
    severity: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeSecurityPreflightDecisionPayload {
    pub(crate) action: String,
    pub(crate) reason: String,
    pub(crate) advisories: Vec<RuntimeSecurityPreflightAdvisoryPayload>,
    pub(crate) exec_policy_decision: Option<String>,
    pub(crate) exec_policy_matched_rules: Vec<RuntimeSecurityPreflightExecPolicyRuleMatchPayload>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeSecurityPreflightExecPolicyRuleMatchPayload {
    pub(crate) matched_prefix: Vec<String>,
    pub(crate) decision: String,
    pub(crate) justification: Option<String>,
}

#[derive(Clone, Debug)]
struct SecurityPreflightPermissionEntry {
    decision: RuntimeSecurityPreflightDecisionPayload,
    expires_at: u64,
}

#[derive(Default)]
pub(crate) struct SecurityPreflightPermissionStore {
    entries: HashMap<String, SecurityPreflightPermissionEntry>,
}

#[derive(Debug)]
struct OsvQueryPackage {
    package_manager: &'static str,
    ecosystem: &'static str,
    package_name: String,
}

fn security_preflight_permission_memory_enabled() -> bool {
    !matches!(
        std::env::var(SECURITY_PREFLIGHT_PERMISSION_MEMORY_ENABLED_ENV)
            .ok()
            .map(|value| value.trim().to_ascii_lowercase())
            .as_deref(),
        Some("0" | "false" | "no" | "off")
    )
}

pub(crate) fn security_preflight_exec_policy_enabled() -> bool {
    std::env::var(SECURITY_PREFLIGHT_EXEC_POLICY_ENABLED_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .is_some_and(|value| matches!(value.as_str(), "1" | "true" | "yes" | "on"))
}

fn resolve_security_preflight_permission_ttl_ms() -> u64 {
    std::env::var(SECURITY_PREFLIGHT_PERMISSION_TTL_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| {
            value.clamp(
                MIN_SECURITY_PREFLIGHT_PERMISSION_TTL_MS,
                MAX_SECURITY_PREFLIGHT_PERMISSION_TTL_MS,
            )
        })
        .unwrap_or(DEFAULT_SECURITY_PREFLIGHT_PERMISSION_TTL_MS)
}

fn normalize_command(command: Option<&str>) -> Option<String> {
    command
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.split_whitespace().collect::<Vec<_>>().join(" "))
}

fn normalize_scope_value(value: Option<&str>, default_value: &str) -> String {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .unwrap_or(default_value)
        .to_ascii_lowercase()
}

fn build_preflight_context_hash(
    workspace_id: Option<&str>,
    tool_name: Option<&str>,
    command: Option<&str>,
) -> Option<String> {
    let command = normalize_command(command)?;
    let workspace = normalize_scope_value(workspace_id, "_global");
    let tool = normalize_scope_value(tool_name, "_unknown");
    let payload = format!("workspace={workspace}\ntool={tool}\ncommand={command}");
    let digest = Sha256::digest(payload.as_bytes());
    let mut encoded = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = write!(&mut encoded, "{byte:02x}");
    }
    Some(encoded)
}

fn decorate_permission_memory_reason(reason: &str) -> String {
    let trimmed = reason.trim();
    if trimmed.starts_with(PERMISSION_MEMORY_REASON_PREFIX) {
        return trimmed.to_string();
    }
    if trimmed.is_empty() {
        return PERMISSION_MEMORY_REASON_PREFIX.to_string();
    }
    format!("{PERMISSION_MEMORY_REASON_PREFIX} {trimmed}")
}

pub(crate) fn is_permission_memory_decision(
    decision: &RuntimeSecurityPreflightDecisionPayload,
) -> bool {
    decision
        .reason
        .trim()
        .starts_with(PERMISSION_MEMORY_REASON_PREFIX)
}

impl SecurityPreflightPermissionStore {
    fn evict_expired(&mut self, now: u64) {
        self.entries.retain(|_, entry| entry.expires_at > now);
    }

    fn lookup(
        &mut self,
        context_hash: &str,
        now: u64,
    ) -> Option<RuntimeSecurityPreflightDecisionPayload> {
        self.evict_expired(now);
        let entry = self.entries.get(context_hash)?;
        let mut decision = entry.decision.clone();
        decision.reason = decorate_permission_memory_reason(decision.reason.as_str());
        Some(decision)
    }

    fn remember_decision(
        &mut self,
        context_hash: &str,
        mut decision: RuntimeSecurityPreflightDecisionPayload,
        ttl_ms: u64,
        now: u64,
    ) {
        if ttl_ms == 0 {
            return;
        }
        decision.reason = decision.reason.trim().to_string();
        let expires_at = now.saturating_add(ttl_ms);
        self.entries.insert(
            context_hash.to_string(),
            SecurityPreflightPermissionEntry {
                decision,
                expires_at,
            },
        );
    }
}

fn find_npx_or_uvx_package(command: &str) -> Option<OsvQueryPackage> {
    let mut tokens = command.split_whitespace();
    let first = tokens.next()?.to_ascii_lowercase();
    let package_token = tokens.next()?.trim();
    if package_token.is_empty() || package_token.starts_with('-') {
        return None;
    }

    let (package_manager, ecosystem) = match first.as_str() {
        "npx" => ("npx", "npm"),
        "uvx" => ("uvx", "PyPI"),
        _ => return None,
    };

    let package_name = if first == "npx" {
        if let Some(stripped) = package_token.strip_prefix('@') {
            if let Some(separator_index) = stripped.rfind('@') {
                format!("@{}", &stripped[..separator_index])
            } else {
                package_token.to_string()
            }
        } else {
            package_token
                .split_once('@')
                .map(|(name, _)| name)
                .unwrap_or(package_token)
                .to_string()
        }
    } else {
        package_token
            .split_once("==")
            .map(|(name, _)| name)
            .unwrap_or(package_token)
            .to_string()
    };

    let normalized = package_name.trim();
    if normalized.is_empty() {
        return None;
    }

    Some(OsvQueryPackage {
        package_manager,
        ecosystem,
        package_name: normalized.to_string(),
    })
}

fn command_matches_block_pattern(command: &str) -> bool {
    let normalized = command.to_ascii_lowercase();
    [
        "rm -rf /",
        "rm -fr /",
        "mkfs.",
        "dd if=/dev/zero",
        ":(){:|:&};:",
        "shutdown -h",
        "poweroff",
        "halt -f",
    ]
    .iter()
    .any(|pattern| normalized.contains(pattern))
}

fn command_matches_review_pattern(command: &str) -> bool {
    let normalized = command.to_ascii_lowercase();
    [
        "rm -rf", "chmod -r", "chown -r", "sudo ", "curl ", "wget ", "| sh", "| bash", ">/etc/",
        ">>/etc/",
    ]
    .iter()
    .any(|pattern| normalized.contains(pattern))
}

fn contains_write_side_effect_marker(command: &str) -> bool {
    [
        " >",
        " >>",
        "| sh",
        "| bash",
        "sudo ",
        " rm ",
        " chmod ",
        " chown ",
        " mv ",
        " cp ",
        " mkdir ",
        " rmdir ",
        " touch ",
        " sed -i",
        " tee ",
        " truncate ",
        " dd ",
        " mkfs",
        "shutdown",
        "poweroff",
        "halt",
        "reboot",
        "npm install",
        "pnpm add",
        "yarn add",
        "pip install",
        "uv pip install",
        "cargo add",
        "apt ",
        "yum ",
        "brew install",
    ]
    .iter()
    .any(|pattern| command.contains(pattern))
}

fn command_matches_read_only_pattern(command: &str) -> bool {
    let normalized = command.to_ascii_lowercase();
    let trimmed = normalized.trim();
    if trimmed.is_empty() {
        return false;
    }
    if contains_write_side_effect_marker(trimmed) {
        return false;
    }
    if [
        "ls",
        "pwd",
        "whoami",
        "date",
        "env",
        "uname",
        "git status",
        "git branch",
    ]
    .contains(&trimmed)
    {
        return true;
    }
    [
        "cat ",
        "head ",
        "tail ",
        "wc ",
        "grep ",
        "rg ",
        "find ",
        "stat ",
        "du ",
        "file ",
        "which ",
        "echo ",
        "git diff",
        "git log",
        "git show",
        "git rev-parse",
        "git ls-files",
    ]
    .iter()
    .any(|pattern| trimmed.starts_with(pattern))
}

async fn query_osv_advisories(
    client: &reqwest::Client,
    package: &OsvQueryPackage,
) -> Result<Vec<RuntimeSecurityPreflightAdvisoryPayload>, String> {
    let request_payload = json!({
        "package": {
            "name": package.package_name,
            "ecosystem": package.ecosystem,
        }
    });

    let response = tokio::time::timeout(
        Duration::from_millis(OSV_REQUEST_TIMEOUT_MS),
        client
            .post(OSV_QUERY_ENDPOINT)
            .json(&request_payload)
            .send(),
    )
    .await
    .map_err(|_| "security preflight advisory query timed out".to_string())
    .and_then(|result| {
        result.map_err(|error| format!("security preflight advisory query failed: {error}"))
    })?;

    if !response.status().is_success() {
        return Err(format!(
            "security preflight advisory query returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("security preflight advisory response decode failed: {error}"))?;

    let advisories = payload
        .get("vulns")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            let object = entry.as_object()?;
            let indicator = object
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())?
                .to_string();
            let severity = object
                .get("database_specific")
                .and_then(Value::as_object)
                .and_then(|database| database.get("severity"))
                .and_then(Value::as_str)
                .or_else(|| {
                    object
                        .get("severity")
                        .and_then(Value::as_array)
                        .and_then(|entries| entries.first())
                        .and_then(Value::as_object)
                        .and_then(|severity| severity.get("type"))
                        .and_then(Value::as_str)
                })
                .unwrap_or("unknown")
                .to_string();
            Some(RuntimeSecurityPreflightAdvisoryPayload {
                package_manager: package.package_manager.to_string(),
                package_name: package.package_name.clone(),
                indicator,
                severity,
            })
        })
        .collect::<Vec<_>>();

    Ok(advisories)
}

fn resolve_preflight_action(command: Option<&str>) -> (String, String) {
    let Some(command) = command else {
        return (
            "allow".to_string(),
            "No command provided; preflight passed.".to_string(),
        );
    };

    if command_matches_block_pattern(command) {
        return (
            "block".to_string(),
            "Command matched a destructive pattern and was blocked by security preflight."
                .to_string(),
        );
    }

    if command_matches_read_only_pattern(command) {
        return (
            "allow".to_string(),
            "Command matched read-only heuristics and was auto-allowed.".to_string(),
        );
    }

    if command_matches_review_pattern(command) {
        return (
            "review".to_string(),
            "Command matched a risky pattern and requires manual review.".to_string(),
        );
    }

    (
        "allow".to_string(),
        "Security preflight checks passed for the provided command.".to_string(),
    )
}

#[derive(Debug, Clone)]
struct ParsedExecPolicyRule {
    decision: String,
    prefix: Vec<String>,
}

fn normalize_exec_policy_decision(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "allow" => "allow".to_string(),
        "forbidden" | "deny" | "block" => "forbidden".to_string(),
        "prompt" | "review" => "prompt".to_string(),
        _ => "prompt".to_string(),
    }
}

fn parse_exec_policy_rule(rule: &str) -> Option<ParsedExecPolicyRule> {
    let trimmed = rule.trim();
    if trimmed.is_empty() {
        return None;
    }
    let (decision_raw, prefix_raw) = trimmed
        .split_once(':')
        .map(|(left, right)| (left.trim(), right.trim()))
        .unwrap_or(("prompt", trimmed));
    if prefix_raw.is_empty() {
        return None;
    }
    let prefix = prefix_raw
        .split_whitespace()
        .map(|entry| entry.trim().to_ascii_lowercase())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>();
    if prefix.is_empty() {
        return None;
    }
    Some(ParsedExecPolicyRule {
        decision: normalize_exec_policy_decision(decision_raw),
        prefix,
    })
}

fn exec_policy_rank(decision: &str) -> u8 {
    match decision {
        "forbidden" => 3,
        "prompt" => 2,
        _ => 1,
    }
}

fn evaluate_exec_policy_rules(
    command: &str,
    exec_policy_rules: Option<&[String]>,
) -> (
    Option<String>,
    Vec<RuntimeSecurityPreflightExecPolicyRuleMatchPayload>,
) {
    let Some(rules) = exec_policy_rules else {
        return (None, Vec::new());
    };
    let command_tokens = command
        .split_whitespace()
        .map(|entry| entry.to_ascii_lowercase())
        .collect::<Vec<_>>();
    if command_tokens.is_empty() {
        return (None, Vec::new());
    }

    let mut strictest: Option<String> = None;
    let mut matched_rules = Vec::new();
    for raw_rule in rules {
        let Some(parsed) = parse_exec_policy_rule(raw_rule) else {
            continue;
        };
        if command_tokens.starts_with(parsed.prefix.as_slice()) {
            let candidate = parsed.decision.clone();
            if strictest.as_ref().is_none_or(|current| {
                exec_policy_rank(candidate.as_str()) > exec_policy_rank(current.as_str())
            }) {
                strictest = Some(candidate.clone());
            }
            matched_rules.push(RuntimeSecurityPreflightExecPolicyRuleMatchPayload {
                matched_prefix: parsed.prefix,
                decision: candidate,
                justification: None,
            });
        }
    }

    (strictest, matched_rules)
}

async fn evaluate_security_preflight_uncached(
    client: &reqwest::Client,
    command: Option<&str>,
    check_package_advisory: bool,
    check_exec_policy: bool,
    exec_policy_rules: Option<&[String]>,
) -> RuntimeSecurityPreflightDecisionPayload {
    let command = normalize_command(command);
    let (mut action, mut reason) = resolve_preflight_action(command.as_deref());
    let mut advisories: Vec<RuntimeSecurityPreflightAdvisoryPayload> = Vec::new();
    let mut exec_policy_decision: Option<String> = None;
    let mut exec_policy_matched_rules: Vec<RuntimeSecurityPreflightExecPolicyRuleMatchPayload> =
        Vec::new();

    if check_package_advisory {
        if let Some(command) = command.as_deref() {
            if let Some(package_query) = find_npx_or_uvx_package(command) {
                match query_osv_advisories(client, &package_query).await {
                    Ok(results) => {
                        advisories = results;
                        let has_malware = advisories.iter().any(|advisory| {
                            advisory.indicator.to_ascii_uppercase().starts_with("MAL-")
                        });
                        if has_malware {
                            action = "block".to_string();
                            reason = format!(
                                "Package advisory reported malware indicator(s) for {}:{}.",
                                package_query.package_manager, package_query.package_name
                            );
                        } else if !advisories.is_empty() && action != "block" {
                            action = "review".to_string();
                            reason = format!(
                                "Package advisory reported potential risks for {}:{}.",
                                package_query.package_manager, package_query.package_name
                            );
                        }
                    }
                    Err(error) => {
                        if action != "block" {
                            action = "review".to_string();
                            reason =
                                format!("Package advisory check degraded to review mode: {error}.");
                        }
                    }
                }
            }
        }
    }

    if check_exec_policy {
        if let Some(command) = command.as_deref() {
            let (strictest_decision, matched_rules) =
                evaluate_exec_policy_rules(command, exec_policy_rules);
            exec_policy_decision = strictest_decision.clone();
            exec_policy_matched_rules = matched_rules;
            match strictest_decision.as_deref() {
                Some("forbidden") => {
                    action = "block".to_string();
                    reason = "Exec policy matched a forbidden rule and blocked command execution."
                        .to_string();
                }
                Some("prompt") if action != "block" => {
                    action = "review".to_string();
                    reason =
                        "Exec policy matched a prompt rule and requires manual review.".to_string();
                }
                Some("allow") => {}
                Some(_) | None => {}
            }
        }
    }

    RuntimeSecurityPreflightDecisionPayload {
        action,
        reason,
        advisories,
        exec_policy_decision,
        exec_policy_matched_rules,
    }
}

pub(crate) async fn evaluate_security_preflight(
    ctx: &AppContext,
    workspace_id: Option<&str>,
    tool_name: Option<&str>,
    command: Option<&str>,
    check_package_advisory: bool,
    check_exec_policy: bool,
    exec_policy_rules: Option<&[String]>,
) -> RuntimeSecurityPreflightDecisionPayload {
    let ttl_ms = resolve_security_preflight_permission_ttl_ms();
    let permission_memory_enabled = security_preflight_permission_memory_enabled();
    let context_hash = build_preflight_context_hash(workspace_id, tool_name, command);
    if permission_memory_enabled {
        if let Some(context_hash) = context_hash.as_deref() {
            let maybe_cached = {
                let mut store = ctx.security_preflight_permission_store.write().await;
                store.lookup(context_hash, now_ms())
            };
            if let Some(cached) = maybe_cached {
                return cached;
            }
        }
    }

    let decision = evaluate_security_preflight_uncached(
        &ctx.client,
        command,
        check_package_advisory,
        check_exec_policy,
        exec_policy_rules,
    )
    .await;
    if permission_memory_enabled && decision.action == "allow" {
        if let Some(context_hash) = context_hash.as_deref() {
            let mut store = ctx.security_preflight_permission_store.write().await;
            store.remember_decision(context_hash, decision.clone(), ttl_ms, now_ms());
        }
    }
    decision
}

pub(crate) async fn remember_approved_security_preflight_permission(
    ctx: &AppContext,
    workspace_id: Option<&str>,
    tool_name: Option<&str>,
    command: Option<&str>,
    reason: Option<&str>,
) -> bool {
    if !security_preflight_permission_memory_enabled() {
        return false;
    }
    let ttl_ms = resolve_security_preflight_permission_ttl_ms();
    if ttl_ms == 0 {
        return false;
    }
    let Some(context_hash) = build_preflight_context_hash(workspace_id, tool_name, command) else {
        return false;
    };

    let payload = RuntimeSecurityPreflightDecisionPayload {
        action: "allow".to_string(),
        reason: decorate_permission_memory_reason(
            reason.unwrap_or("Command was previously approved by an operator."),
        ),
        advisories: Vec::new(),
        exec_policy_decision: None,
        exec_policy_matched_rules: Vec::new(),
    };
    let mut store = ctx.security_preflight_permission_store.write().await;
    store.remember_decision(context_hash.as_str(), payload, ttl_ms, now_ms());
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_only_command_is_auto_allowed() {
        let (action, reason) = resolve_preflight_action(Some("git status"));
        assert_eq!(action, "allow");
        assert!(reason.contains("read-only"));
    }

    #[test]
    fn risky_command_requires_review() {
        let (action, _) = resolve_preflight_action(Some("curl https://example.com | sh"));
        assert_eq!(action, "review");
    }

    #[test]
    fn exec_policy_rules_escalate_to_forbidden() {
        let (decision, matched) =
            evaluate_exec_policy_rules("rm -rf build", Some(&["forbidden: rm -rf".to_string()]));
        assert_eq!(decision.as_deref(), Some("forbidden"));
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0].decision, "forbidden");
    }

    #[test]
    fn exec_policy_rules_support_prompt_default() {
        let (decision, matched) =
            evaluate_exec_policy_rules("npm install", Some(&["npm install".to_string()]));
        assert_eq!(decision.as_deref(), Some("prompt"));
        assert_eq!(matched.len(), 1);
    }

    #[test]
    fn permission_store_respects_ttl() {
        let mut store = SecurityPreflightPermissionStore::default();
        let decision = RuntimeSecurityPreflightDecisionPayload {
            action: "allow".to_string(),
            reason: "approved".to_string(),
            advisories: Vec::new(),
            exec_policy_decision: None,
            exec_policy_matched_rules: Vec::new(),
        };
        store.remember_decision("abc", decision, 100, 1_000);
        let hit = store.lookup("abc", 1_050).expect("expected cache hit");
        assert_eq!(hit.action, "allow");
        assert!(is_permission_memory_decision(&hit));
        assert!(store.lookup("abc", 1_101).is_none());
    }

    #[test]
    fn context_hash_is_stable() {
        let left =
            build_preflight_context_hash(Some("workspace-a"), Some("bash"), Some("git    status"))
                .expect("left hash");
        let right =
            build_preflight_context_hash(Some("workspace-a"), Some("bash"), Some("git status"))
                .expect("right hash");
        assert_eq!(left, right);
    }
}
