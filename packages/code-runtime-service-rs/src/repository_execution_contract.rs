use super::*;
use crate::agent_policy::canonicalize_access_mode;

const REPOSITORY_EXECUTION_CONTRACT_PATH: &str = ".hugecode/repository-execution-contract.json";

#[derive(Clone, Debug, Default)]
pub(crate) struct RepositoryExecutionExplicitLaunchInput {
    pub(crate) execution_profile_id: Option<String>,
    pub(crate) review_profile_id: Option<String>,
    pub(crate) validation_preset_id: Option<String>,
    pub(crate) access_mode: Option<String>,
    pub(crate) preferred_backend_ids: Vec<String>,
    pub(crate) default_backend_id: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub(crate) struct RepositoryExecutionResolvedReviewProfile {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) allowed_skill_ids: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub(crate) struct RepositoryExecutionResolvedDefaults {
    #[allow(dead_code)]
    pub(crate) source_mapping_kind: Option<String>,
    pub(crate) execution_profile_id: Option<String>,
    pub(crate) review_profile_id: Option<String>,
    pub(crate) validation_preset_id: Option<String>,
    pub(crate) access_mode: Option<String>,
    pub(crate) preferred_backend_ids: Vec<String>,
    pub(crate) default_backend_id: Option<String>,
    pub(crate) repo_instructions: Vec<String>,
    pub(crate) repo_skill_ids: Vec<String>,
    pub(crate) source_instructions: Vec<String>,
    pub(crate) source_skill_ids: Vec<String>,
    pub(crate) review_profile: Option<RepositoryExecutionResolvedReviewProfile>,
    pub(crate) triage_owner: Option<String>,
    pub(crate) triage_priority: Option<String>,
    pub(crate) triage_risk_level: Option<String>,
    pub(crate) triage_tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryExecutionContract {
    version: u8,
    #[serde(default)]
    defaults: RepositoryExecutionPolicy,
    #[serde(default)]
    default_review_profile_id: Option<String>,
    #[serde(default)]
    source_mappings: HashMap<String, RepositoryExecutionPolicy>,
    #[serde(default)]
    validation_presets: Vec<RepositoryExecutionValidationPreset>,
    #[serde(default)]
    review_profiles: Vec<RepositoryExecutionReviewProfile>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryExecutionPolicy {
    #[serde(default)]
    execution_profile_id: Option<String>,
    #[serde(default)]
    preferred_backend_ids: Option<Vec<String>>,
    #[serde(default)]
    access_mode: Option<String>,
    #[serde(default)]
    review_profile_id: Option<String>,
    #[serde(default)]
    validation_preset_id: Option<String>,
    #[serde(default)]
    guidance: RepositoryExecutionGuidance,
    #[serde(default)]
    triage: RepositoryExecutionTriagePolicy,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryExecutionGuidance {
    #[serde(default)]
    instructions: Vec<String>,
    #[serde(default)]
    skill_ids: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryExecutionTriagePolicy {
    #[serde(default)]
    owner: Option<String>,
    #[serde(default)]
    priority: Option<String>,
    #[serde(default)]
    risk_level: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryExecutionValidationPreset {
    id: String,
    #[allow(dead_code)]
    #[serde(default)]
    label: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryExecutionReviewProfile {
    id: String,
    #[allow(dead_code)]
    label: String,
    #[allow(dead_code)]
    #[serde(default)]
    description: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    allowed_skill_ids: Vec<String>,
    #[serde(default)]
    validation_preset_id: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    autofix_policy: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    github_mirror_policy: Option<String>,
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|entry| {
        let trimmed = entry.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_text_list(value: Option<Vec<String>>) -> Vec<String> {
    let mut seen = HashSet::new();
    value
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .filter(|entry| seen.insert(entry.clone()))
        .collect()
}

fn normalize_policy(policy: RepositoryExecutionPolicy) -> RepositoryExecutionPolicy {
    RepositoryExecutionPolicy {
        execution_profile_id: normalize_optional_text(policy.execution_profile_id),
        preferred_backend_ids: {
            let ids = normalize_text_list(policy.preferred_backend_ids);
            (!ids.is_empty()).then_some(ids)
        },
        access_mode: normalize_optional_text(policy.access_mode),
        review_profile_id: normalize_optional_text(policy.review_profile_id),
        validation_preset_id: normalize_optional_text(policy.validation_preset_id),
        guidance: RepositoryExecutionGuidance {
            instructions: normalize_text_list(Some(policy.guidance.instructions)),
            skill_ids: normalize_text_list(Some(policy.guidance.skill_ids)),
        },
        triage: RepositoryExecutionTriagePolicy {
            owner: normalize_optional_text(policy.triage.owner),
            priority: normalize_optional_text(policy.triage.priority),
            risk_level: normalize_optional_text(policy.triage.risk_level),
            tags: normalize_text_list(Some(policy.triage.tags)),
        },
    }
}

fn normalize_triage_priority(value: Option<String>) -> Result<Option<String>, String> {
    match normalize_optional_text(value) {
        None => Ok(None),
        Some(normalized) if matches!(normalized.as_str(), "low" | "medium" | "high" | "urgent") => {
            Ok(Some(normalized))
        }
        Some(_) => Err("triage priority must be low, medium, high, or urgent".to_string()),
    }
}

fn normalize_risk_level(value: Option<String>) -> Result<Option<String>, String> {
    match normalize_optional_text(value) {
        None => Ok(None),
        Some(normalized) if matches!(normalized.as_str(), "low" | "medium" | "high") => {
            Ok(Some(normalized))
        }
        Some(_) => Err("triage riskLevel must be low, medium, or high".to_string()),
    }
}

fn normalize_review_profile_autofix_policy(value: Option<String>) -> Result<String, String> {
    let normalized = normalize_optional_text(value).unwrap_or_else(|| "manual".to_string());
    if matches!(normalized.as_str(), "disabled" | "bounded" | "manual") {
        Ok(normalized)
    } else {
        Err("review profile autofixPolicy must be disabled, bounded, or manual".to_string())
    }
}

fn normalize_review_profile_github_mirror_policy(value: Option<String>) -> Result<String, String> {
    let normalized = normalize_optional_text(value).unwrap_or_else(|| "disabled".to_string());
    if matches!(normalized.as_str(), "disabled" | "summary" | "check_output") {
        Ok(normalized)
    } else {
        Err(
            "review profile githubMirrorPolicy must be disabled, summary, or check_output"
                .to_string(),
        )
    }
}

fn parse_repository_execution_contract(raw: &str) -> Result<RepositoryExecutionContract, String> {
    let parsed = serde_json::from_str::<RepositoryExecutionContract>(raw)
        .map_err(|error| format!("invalid repository execution contract json: {error}"))?;
    if parsed.version != 1 {
        return Err(format!(
            "unsupported repository execution contract version `{}`",
            parsed.version
        ));
    }

    let validation_preset_ids = parsed
        .validation_presets
        .iter()
        .filter_map(|preset| normalize_optional_text(Some(preset.id.clone())))
        .collect::<HashSet<_>>();
    let review_profile_ids = parsed
        .review_profiles
        .iter()
        .filter_map(|profile| normalize_optional_text(Some(profile.id.clone())))
        .collect::<HashSet<_>>();

    let validate_policy =
        |context: &str, policy: &RepositoryExecutionPolicy| -> Result<(), String> {
            if let Some(access_mode) = policy.access_mode.as_deref() {
                canonicalize_access_mode(Some(access_mode)).ok_or_else(|| {
                    format!("{context}.accessMode must be read-only, on-request, or full-access")
                })?;
            }
            if let Some(review_profile_id) = policy.review_profile_id.as_deref() {
                if !review_profile_ids.contains(review_profile_id) {
                    return Err(format!(
                        "{context}.reviewProfileId must reference a declared review profile"
                    ));
                }
            }
            if let Some(validation_preset_id) = policy.validation_preset_id.as_deref() {
                if !validation_preset_ids.contains(validation_preset_id) {
                    return Err(format!(
                        "{context}.validationPresetId must reference a declared validation preset"
                    ));
                }
            }
            normalize_triage_priority(policy.triage.priority.clone())
                .map_err(|error| format!("{context}.{error}"))?;
            normalize_risk_level(policy.triage.risk_level.clone())
                .map_err(|error| format!("{context}.{error}"))?;
            Ok(())
        };

    let normalized_defaults = normalize_policy(parsed.defaults);
    validate_policy("defaults", &normalized_defaults)?;

    let mut normalized_source_mappings = HashMap::new();
    for (kind, policy) in parsed.source_mappings {
        if !matches!(
            kind.as_str(),
            "manual"
                | "github_issue"
                | "github_pr_followup"
                | "github_discussion"
                | "note"
                | "customer_feedback"
                | "doc"
                | "call_summary"
                | "external_ref"
                | "schedule"
        ) {
            return Err(format!(
                "sourceMappings supports only manual, github_issue, github_pr_followup, github_discussion, note, customer_feedback, doc, call_summary, external_ref, or schedule kinds"
            ));
        }
        let normalized_policy = normalize_policy(policy);
        validate_policy(
            format!("sourceMappings.{kind}").as_str(),
            &normalized_policy,
        )?;
        normalized_source_mappings.insert(kind, normalized_policy);
    }

    let mut normalized_review_profiles = Vec::new();
    for profile in parsed.review_profiles {
        let id = normalize_optional_text(Some(profile.id))
            .ok_or_else(|| "review profile id is required".to_string())?;
        let validation_preset_id = normalize_optional_text(profile.validation_preset_id);
        if let Some(validation_preset_id) = validation_preset_id.as_deref() {
            if !validation_preset_ids.contains(validation_preset_id) {
                return Err(format!(
                    "reviewProfiles.{id}.validationPresetId must reference a declared validation preset"
                ));
            }
        }
        let allowed_skill_ids = normalize_text_list(Some(profile.allowed_skill_ids));
        let autofix_policy = normalize_review_profile_autofix_policy(profile.autofix_policy)
            .map_err(|error| format!("reviewProfiles.{id}.{error}"))?;
        let github_mirror_policy =
            normalize_review_profile_github_mirror_policy(profile.github_mirror_policy)
                .map_err(|error| format!("reviewProfiles.{id}.{error}"))?;
        normalized_review_profiles.push(RepositoryExecutionReviewProfile {
            id,
            label: profile.label.trim().to_string(),
            description: normalize_optional_text(profile.description),
            allowed_skill_ids,
            validation_preset_id,
            autofix_policy: Some(autofix_policy),
            github_mirror_policy: Some(github_mirror_policy),
        });
    }

    Ok(RepositoryExecutionContract {
        version: 1,
        defaults: normalized_defaults,
        default_review_profile_id: normalize_optional_text(parsed.default_review_profile_id),
        source_mappings: normalized_source_mappings,
        validation_presets: parsed.validation_presets,
        review_profiles: normalized_review_profiles,
    })
}

fn resolve_task_source_mapping_kind(
    task_source: Option<&AgentTaskSourceSummary>,
) -> Option<String> {
    let kind = task_source?.kind.trim();
    match kind {
        "manual" | "manual_thread" => Some("manual".to_string()),
        "github_issue" => Some("github_issue".to_string()),
        "github_pr_followup" => Some("github_pr_followup".to_string()),
        "github_discussion" => Some("github_discussion".to_string()),
        "note" => Some("note".to_string()),
        "customer_feedback" => Some("customer_feedback".to_string()),
        "doc" => Some("doc".to_string()),
        "call_summary" => Some("call_summary".to_string()),
        "external_ref" => Some("external_ref".to_string()),
        "schedule" => Some("schedule".to_string()),
        _ => None,
    }
}

pub(crate) fn profile_execution_mode(profile_id: Option<&str>) -> Option<&'static str> {
    match profile_id {
        Some("autonomous-delegate") => Some("distributed"),
        Some("operator-review" | "balanced-delegate") => Some("single"),
        _ => None,
    }
}

pub(crate) fn profile_access_mode(profile_id: Option<&str>) -> Option<&'static str> {
    match profile_id {
        Some("operator-review") => Some("read-only"),
        Some("balanced-delegate") => Some("on-request"),
        Some("autonomous-delegate") => Some("full-access"),
        _ => None,
    }
}

pub(crate) fn profile_validation_preset_id(profile_id: Option<&str>) -> Option<&'static str> {
    match profile_id {
        Some("operator-review") => Some("review-first"),
        Some("balanced-delegate") => Some("standard"),
        Some("autonomous-delegate") => Some("fast-lane"),
        _ => None,
    }
}

fn resolve_repository_execution_defaults_from_contract(
    contract: &RepositoryExecutionContract,
    task_source: Option<&AgentTaskSourceSummary>,
    explicit: &RepositoryExecutionExplicitLaunchInput,
) -> RepositoryExecutionResolvedDefaults {
    let source_mapping_kind = resolve_task_source_mapping_kind(task_source);
    let source_mapping = source_mapping_kind
        .as_ref()
        .and_then(|kind| contract.source_mappings.get(kind));

    let execution_profile_id = explicit
        .execution_profile_id
        .clone()
        .or_else(|| source_mapping.and_then(|policy| policy.execution_profile_id.clone()))
        .or_else(|| contract.defaults.execution_profile_id.clone());
    let review_profile_id = explicit
        .review_profile_id
        .clone()
        .or_else(|| source_mapping.and_then(|policy| policy.review_profile_id.clone()))
        .or_else(|| contract.defaults.review_profile_id.clone())
        .or_else(|| contract.default_review_profile_id.clone());
    let review_profile = review_profile_id.as_deref().and_then(|review_profile_id| {
        contract
            .review_profiles
            .iter()
            .find(|profile| profile.id == review_profile_id)
            .map(|profile| RepositoryExecutionResolvedReviewProfile {
                id: profile.id.clone(),
                label: profile.label.clone(),
                allowed_skill_ids: profile.allowed_skill_ids.clone(),
            })
    });
    let review_profile_validation_preset =
        review_profile_id.as_deref().and_then(|review_profile_id| {
            contract
                .review_profiles
                .iter()
                .find(|profile| profile.id == review_profile_id)
                .and_then(|profile| profile.validation_preset_id.clone())
        });
    let validation_preset_id = explicit
        .validation_preset_id
        .clone()
        .or_else(|| source_mapping.and_then(|policy| policy.validation_preset_id.clone()))
        .or_else(|| contract.defaults.validation_preset_id.clone())
        .or(review_profile_validation_preset)
        .or_else(|| {
            profile_validation_preset_id(execution_profile_id.as_deref()).map(str::to_string)
        });
    let access_mode = explicit
        .access_mode
        .clone()
        .or_else(|| source_mapping.and_then(|policy| policy.access_mode.clone()))
        .or_else(|| contract.defaults.access_mode.clone())
        .or_else(|| profile_access_mode(execution_profile_id.as_deref()).map(str::to_string));
    let preferred_backend_ids = if explicit.preferred_backend_ids.is_empty() {
        source_mapping
            .and_then(|policy| policy.preferred_backend_ids.clone())
            .or_else(|| contract.defaults.preferred_backend_ids.clone())
            .unwrap_or_default()
    } else {
        explicit.preferred_backend_ids.clone()
    };

    RepositoryExecutionResolvedDefaults {
        source_mapping_kind,
        execution_profile_id,
        review_profile_id,
        validation_preset_id,
        access_mode,
        preferred_backend_ids,
        default_backend_id: explicit.default_backend_id.clone(),
        repo_instructions: contract.defaults.guidance.instructions.clone(),
        repo_skill_ids: contract.defaults.guidance.skill_ids.clone(),
        source_instructions: source_mapping
            .map(|policy| policy.guidance.instructions.clone())
            .unwrap_or_default(),
        source_skill_ids: source_mapping
            .map(|policy| policy.guidance.skill_ids.clone())
            .unwrap_or_default(),
        review_profile,
        triage_owner: source_mapping
            .and_then(|policy| policy.triage.owner.clone())
            .or_else(|| contract.defaults.triage.owner.clone()),
        triage_priority: source_mapping
            .and_then(|policy| policy.triage.priority.clone())
            .or_else(|| contract.defaults.triage.priority.clone()),
        triage_risk_level: source_mapping
            .and_then(|policy| policy.triage.risk_level.clone())
            .or_else(|| contract.defaults.triage.risk_level.clone()),
        triage_tags: source_mapping
            .map(|policy| policy.triage.tags.clone())
            .filter(|tags| !tags.is_empty())
            .unwrap_or_else(|| contract.defaults.triage.tags.clone()),
    }
}

pub(crate) async fn resolve_workspace_repository_execution_defaults(
    ctx: &AppContext,
    workspace_id: &str,
    task_source: Option<&AgentTaskSourceSummary>,
    explicit: &RepositoryExecutionExplicitLaunchInput,
) -> Option<RepositoryExecutionResolvedDefaults> {
    let workspace_root = {
        let state = ctx.state.read().await;
        state
            .workspaces
            .iter()
            .find(|workspace| workspace.id == workspace_id)
            .map(|workspace| workspace.path.clone())
    }?;
    let contract_path = Path::new(workspace_root.as_str()).join(REPOSITORY_EXECUTION_CONTRACT_PATH);
    let raw = match fs::read_to_string(&contract_path) {
        Ok(raw) => raw,
        Err(_) => return None,
    };
    match parse_repository_execution_contract(raw.as_str()) {
        Ok(contract) => Some(resolve_repository_execution_defaults_from_contract(
            &contract,
            task_source,
            explicit,
        )),
        Err(error) => {
            warn!(
                workspace_id,
                path = contract_path.to_string_lossy().as_ref(),
                error = error.as_str(),
                "ignoring invalid repository execution contract"
            );
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_contract(raw: &str) -> RepositoryExecutionContract {
        parse_repository_execution_contract(raw).expect("contract should parse")
    }

    #[test]
    fn repository_execution_contract_prefers_source_mapping_and_review_profile_defaults() {
        let contract = parse_contract(
            json!({
                "version": 1,
                "defaults": {
                    "executionProfileId": "balanced-delegate",
                    "reviewProfileId": "default-review",
                    "validationPresetId": "standard",
                    "guidance": {
                        "instructions": ["Use repo-owned context truth."],
                        "skillIds": ["repo-baseline"]
                    },
                    "triage": {
                        "owner": "Platform Runtime",
                        "priority": "medium",
                        "riskLevel": "medium",
                        "tags": ["runtime"]
                    }
                },
                "defaultReviewProfileId": "default-review",
                "sourceMappings": {
                    "github_issue": {
                        "executionProfileId": "autonomous-delegate",
                        "reviewProfileId": "issue-review",
                        "preferredBackendIds": ["backend-issue"],
                        "guidance": {
                            "instructions": ["Treat GitHub issues as triage-first intake."],
                            "skillIds": ["issue-triage"]
                        },
                        "triage": {
                            "owner": "Issue Desk",
                            "priority": "high",
                            "riskLevel": "high",
                            "tags": ["customer-facing"]
                        }
                    },
                    "schedule": {
                        "executionProfileId": "balanced-delegate",
                        "reviewProfileId": "schedule-review",
                        "validationPresetId": "review-first",
                        "preferredBackendIds": ["backend-schedule"],
                        "accessMode": "on-request"
                    }
                },
                "validationPresets": [
                    { "id": "standard", "label": "Standard" },
                    { "id": "review-first", "label": "Review first" },
                    { "id": "fast-lane", "label": "Fast lane" }
                ],
                "reviewProfiles": [
                    {
                        "id": "default-review",
                        "label": "Default review",
                        "allowedSkillIds": ["review-agent"],
                        "validationPresetId": "standard",
                        "autofixPolicy": "bounded",
                        "githubMirrorPolicy": "summary"
                    },
                    {
                        "id": "issue-review",
                        "label": "Issue review",
                        "allowedSkillIds": ["review-agent", "repo-policy-check"],
                        "validationPresetId": "review-first",
                        "autofixPolicy": "manual",
                        "githubMirrorPolicy": "check_output"
                    },
                    {
                        "id": "schedule-review",
                        "label": "Schedule review",
                        "allowedSkillIds": ["review-agent"],
                        "validationPresetId": "standard",
                        "autofixPolicy": "bounded",
                        "githubMirrorPolicy": "summary"
                    }
                ]
            })
            .to_string()
            .as_str(),
        );

        let resolved = resolve_repository_execution_defaults_from_contract(
            &contract,
            Some(&AgentTaskSourceSummary {
                kind: "github_issue".to_string(),
                label: None,
                short_label: None,
                title: Some("Fix native run summary".to_string()),
                reference: None,
                url: None,
                issue_number: Some(42),
                pull_request_number: None,
                repo: None,
                workspace_id: Some("ws-1".to_string()),
                workspace_root: None,
                external_id: None,
                canonical_url: None,
                thread_id: None,
                request_id: None,
                source_task_id: None,
                source_run_id: None,
            }),
            &RepositoryExecutionExplicitLaunchInput::default(),
        );

        assert_eq!(
            resolved.source_mapping_kind.as_deref(),
            Some("github_issue")
        );
        assert_eq!(
            resolved.execution_profile_id.as_deref(),
            Some("autonomous-delegate")
        );
        assert_eq!(resolved.review_profile_id.as_deref(), Some("issue-review"));
        assert_eq!(
            resolved
                .review_profile
                .as_ref()
                .map(|profile| profile.allowed_skill_ids.clone()),
            Some(vec![
                "review-agent".to_string(),
                "repo-policy-check".to_string()
            ])
        );
        assert_eq!(resolved.validation_preset_id.as_deref(), Some("standard"));
        assert_eq!(resolved.access_mode.as_deref(), Some("full-access"));
        assert_eq!(
            resolved.preferred_backend_ids,
            vec!["backend-issue".to_string()]
        );
        assert_eq!(
            resolved.repo_instructions,
            vec!["Use repo-owned context truth.".to_string()]
        );
        assert_eq!(
            resolved.source_instructions,
            vec!["Treat GitHub issues as triage-first intake.".to_string()]
        );
        assert_eq!(resolved.triage_owner.as_deref(), Some("Issue Desk"));
        assert_eq!(resolved.triage_priority.as_deref(), Some("high"));
        assert_eq!(resolved.triage_risk_level.as_deref(), Some("high"));
        assert_eq!(resolved.triage_tags, vec!["customer-facing".to_string()]);
        assert_eq!(
            contract.review_profiles[1].allowed_skill_ids,
            vec!["review-agent".to_string(), "repo-policy-check".to_string()]
        );
        assert_eq!(
            contract.review_profiles[1].autofix_policy.as_deref(),
            Some("manual")
        );
    }

    #[test]
    fn repository_execution_contract_uses_schedule_source_mapping_defaults() {
        let contract = parse_contract(
            json!({
                "version": 1,
                "defaults": {
                    "executionProfileId": "balanced-delegate",
                    "reviewProfileId": "default-review",
                    "validationPresetId": "standard"
                },
                "defaultReviewProfileId": "default-review",
                "sourceMappings": {
                    "schedule": {
                        "executionProfileId": "autonomous-delegate",
                        "reviewProfileId": "schedule-review",
                        "validationPresetId": "review-first",
                        "preferredBackendIds": ["backend-schedule"],
                        "accessMode": "on-request"
                    }
                },
                "validationPresets": [
                    { "id": "standard", "label": "Standard" },
                    { "id": "review-first", "label": "Review first" }
                ],
                "reviewProfiles": [
                    {
                        "id": "default-review",
                        "label": "Default review",
                        "allowedSkillIds": ["review-agent"],
                        "validationPresetId": "standard",
                        "autofixPolicy": "bounded",
                        "githubMirrorPolicy": "summary"
                    },
                    {
                        "id": "schedule-review",
                        "label": "Schedule review",
                        "allowedSkillIds": ["review-agent"],
                        "validationPresetId": "review-first",
                        "autofixPolicy": "manual",
                        "githubMirrorPolicy": "check_output"
                    }
                ]
            })
            .to_string()
            .as_str(),
        );

        let resolved = resolve_repository_execution_defaults_from_contract(
            &contract,
            Some(&AgentTaskSourceSummary {
                kind: "schedule".to_string(),
                label: None,
                short_label: None,
                title: Some("Nightly validation".to_string()),
                reference: None,
                url: None,
                issue_number: None,
                pull_request_number: None,
                repo: None,
                workspace_id: Some("ws-1".to_string()),
                workspace_root: None,
                external_id: None,
                canonical_url: None,
                thread_id: None,
                request_id: None,
                source_task_id: None,
                source_run_id: None,
            }),
            &RepositoryExecutionExplicitLaunchInput::default(),
        );

        assert_eq!(resolved.source_mapping_kind.as_deref(), Some("schedule"));
        assert_eq!(
            resolved.execution_profile_id.as_deref(),
            Some("autonomous-delegate")
        );
        assert_eq!(
            resolved.review_profile_id.as_deref(),
            Some("schedule-review")
        );
        assert_eq!(
            resolved
                .review_profile
                .as_ref()
                .map(|profile| profile.label.as_str()),
            Some("Schedule review")
        );
        assert_eq!(
            resolved.validation_preset_id.as_deref(),
            Some("review-first")
        );
        assert_eq!(resolved.access_mode.as_deref(), Some("on-request"));
        assert_eq!(
            resolved.preferred_backend_ids,
            vec!["backend-schedule".to_string()]
        );
    }

    #[test]
    fn repository_execution_contract_accepts_context_driven_source_kinds() {
        let contract = parse_contract(
            json!({
                "version": 1,
                "defaults": {
                    "executionProfileId": "balanced-delegate",
                    "validationPresetId": "standard"
                },
                "sourceMappings": {
                    "github_discussion": {
                        "executionProfileId": "balanced-delegate"
                    },
                    "customer_feedback": {
                        "executionProfileId": "balanced-delegate",
                        "validationPresetId": "standard"
                    }
                },
                "validationPresets": [{ "id": "standard", "label": "Standard" }]
            })
            .to_string()
            .as_str(),
        );

        let discussion = resolve_repository_execution_defaults_from_contract(
            &contract,
            Some(&AgentTaskSourceSummary {
                kind: "github_discussion".to_string(),
                label: None,
                short_label: None,
                title: Some("Clarify delegation contract".to_string()),
                reference: Some("#12".to_string()),
                url: None,
                issue_number: None,
                pull_request_number: None,
                repo: None,
                workspace_id: Some("ws-1".to_string()),
                workspace_root: None,
                external_id: None,
                canonical_url: None,
                thread_id: None,
                request_id: None,
                source_task_id: None,
                source_run_id: None,
            }),
            &RepositoryExecutionExplicitLaunchInput::default(),
        );
        let feedback = resolve_repository_execution_defaults_from_contract(
            &contract,
            Some(&AgentTaskSourceSummary {
                kind: "customer_feedback".to_string(),
                label: None,
                short_label: None,
                title: Some("Review is too expensive".to_string()),
                reference: None,
                url: None,
                issue_number: None,
                pull_request_number: None,
                repo: None,
                workspace_id: Some("ws-1".to_string()),
                workspace_root: None,
                external_id: None,
                canonical_url: None,
                thread_id: None,
                request_id: None,
                source_task_id: None,
                source_run_id: None,
            }),
            &RepositoryExecutionExplicitLaunchInput::default(),
        );

        assert_eq!(
            discussion.source_mapping_kind.as_deref(),
            Some("github_discussion")
        );
        assert_eq!(
            feedback.source_mapping_kind.as_deref(),
            Some("customer_feedback")
        );
    }

    #[test]
    fn repository_execution_contract_rejects_invalid_review_profile_policies() {
        let error = parse_repository_execution_contract(
            json!({
                "version": 1,
                "validationPresets": [{ "id": "standard" }],
                "reviewProfiles": [{
                    "id": "default-review",
                    "label": "Default review",
                    "autofixPolicy": "always"
                }]
            })
            .to_string()
            .as_str(),
        )
        .expect_err("invalid review profile policy should fail");

        assert!(error.contains("autofixPolicy"), "unexpected error: {error}");
    }

    #[test]
    fn repository_execution_contract_rejects_unknown_review_profile_references() {
        let error = parse_repository_execution_contract(
            json!({
                "version": 1,
                "defaults": {
                    "reviewProfileId": "missing-review"
                },
                "validationPresets": [{ "id": "standard" }],
                "reviewProfiles": [{ "id": "default-review", "label": "Default review" }]
            })
            .to_string()
            .as_str(),
        )
        .expect_err("invalid review profile reference should fail");

        assert!(
            error.contains("reviewProfileId"),
            "unexpected error: {error}"
        );
    }
}
