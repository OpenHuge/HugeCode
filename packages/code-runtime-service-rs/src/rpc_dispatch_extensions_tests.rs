use super::*;

fn resolved_instruction_skill_fixture() -> instruction_skills::ResolvedInstructionSkill {
    instruction_skills::ResolvedInstructionSkill {
        id: "workspace.agents.review".to_string(),
        name: "review".to_string(),
        description: "Review the current changeset".to_string(),
        scope: "workspace".to_string(),
        source_family: "agents".to_string(),
        source_root: "/repo/.agents/skills".to_string(),
        entry_path: "/repo/.agents/skills/review/SKILL.md".to_string(),
        enabled: true,
        aliases: vec!["review".to_string(), "agents:review".to_string()],
        shadowed_by: None,
        frontmatter: json!({
            "name": "review",
            "description": "Review the current changeset",
        }),
        body: "Review carefully".to_string(),
        supporting_files: vec![instruction_skills::ResolvedInstructionSkillFile {
            path: "checklist.md".to_string(),
            content: "- item".to_string(),
        }],
    }
}

#[test]
fn instruction_skill_resource_payload_exposes_body_frontmatter_and_supporting_files() {
    let skill = resolved_instruction_skill_fixture();

    let body =
        instruction_skill_resource_payload(skill.id.as_str(), &skill, INSTRUCTION_SKILL_BODY_RESOURCE_ID)
            .expect("body resource");
    assert_eq!(body.content_type, "text/markdown");
    assert_eq!(body.content, "Review carefully");

    let frontmatter = instruction_skill_resource_payload(
        skill.id.as_str(),
        &skill,
        INSTRUCTION_SKILL_FRONTMATTER_RESOURCE_ID,
    )
    .expect("frontmatter resource");
    assert_eq!(frontmatter.content_type, "application/json");
    assert!(frontmatter.content.contains("\"name\":\"review\""));

    let supporting_files = instruction_skill_resource_payload(
        skill.id.as_str(),
        &skill,
        INSTRUCTION_SKILL_SUPPORTING_FILES_RESOURCE_ID,
    )
    .expect("supporting files resource");
    assert_eq!(supporting_files.content_type, "application/json");
    assert!(supporting_files.content.contains("checklist.md"));

    let supporting_file =
        instruction_skill_resource_payload(skill.id.as_str(), &skill, "supporting-file:checklist.md")
            .expect("supporting file resource");
    assert_eq!(supporting_file.content_type, "text/plain");
    assert_eq!(supporting_file.content, "- item");
}

#[test]
fn instruction_skill_resource_payload_rejects_unknown_resource_ids() {
    let skill = resolved_instruction_skill_fixture();
    let error = instruction_skill_resource_payload(skill.id.as_str(), &skill, "unknown")
        .expect_err("unknown resource should fail");
    assert_eq!(error.code_str(), "INVALID_PARAMS");
    assert!(
        error.message.contains("does not expose resource"),
        "unexpected error message: {}",
        error.message
    );
}

#[test]
fn request_targets_instruction_extension_prefers_existing_catalog_kind() {
    let params = serde_json::Map::new();
    let existing = extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id: "workspace.agents.review".to_string(),
        version: "1.0.0".to_string(),
        display_name: "review".to_string(),
        publisher: "agents".to_string(),
        summary: "Review the current changeset".to_string(),
        kind: "instruction".to_string(),
        distribution: "workspace".to_string(),
        name: "review".to_string(),
        transport: "repo-manifest".to_string(),
        lifecycle_state: "enabled".to_string(),
        enabled: true,
        workspace_id: Some("ws-1".to_string()),
        capabilities: vec!["instructions".to_string()],
        permissions: Vec::new(),
        ui_apps: Vec::new(),
        provenance: json!({
            "scope": "workspace",
            "sourceFamily": "agents",
        }),
        config: json!({}),
        installed_at: 1,
        updated_at: 1,
    };
    assert!(request_targets_instruction_extension(&params, Some(&existing)));
}

#[test]
fn build_instruction_skill_overlay_payload_uses_existing_catalog_defaults() {
    let params = serde_json::Map::new();
    let existing = extensions_runtime::RuntimeExtensionSpecPayload {
        extension_id: "workspace.agents.review".to_string(),
        version: "1.2.3".to_string(),
        display_name: "review".to_string(),
        publisher: "agents".to_string(),
        summary: "Review the current changeset".to_string(),
        kind: "instruction".to_string(),
        distribution: "workspace".to_string(),
        name: "review".to_string(),
        transport: "repo-manifest".to_string(),
        lifecycle_state: "enabled".to_string(),
        enabled: true,
        workspace_id: Some("ws-1".to_string()),
        capabilities: vec!["instructions".to_string()],
        permissions: Vec::new(),
        ui_apps: Vec::new(),
        provenance: json!({
            "scope": "workspace",
            "sourceFamily": "agents",
            "entryPath": "/repo/.agents/skills/review/SKILL.md",
            "sourceRoot": "/repo/.agents/skills",
            "aliases": ["review", "agents:review"],
            "shadowedBy": null,
        }),
        config: json!({}),
        installed_at: 1,
        updated_at: 1,
    };
    let payload =
        build_instruction_skill_overlay_payload(existing.extension_id.as_str(), &params, Some(&existing));
    assert_eq!(payload["id"], Value::String("workspace.agents.review".to_string()));
    assert_eq!(payload["name"], Value::String("review".to_string()));
    assert_eq!(payload["scope"], Value::String("workspace".to_string()));
    assert_eq!(payload["sourceFamily"], Value::String("agents".to_string()));
    assert_eq!(
        payload["aliases"],
        Value::Array(vec![
            Value::String("review".to_string()),
            Value::String("agents:review".to_string()),
        ])
    );
}
