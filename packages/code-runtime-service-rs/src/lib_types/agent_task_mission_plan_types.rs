#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionPlanMilestone {
    id: String,
    label: String,
    summary: String,
    #[serde(default)]
    status: Option<String>,
    #[serde(default, alias = "node_ids")]
    node_ids: Option<Vec<String>>,
    #[serde(default, alias = "validation_lane_ids")]
    validation_lane_ids: Option<Vec<String>>,
    #[serde(default, alias = "acceptance_criteria")]
    acceptance_criteria: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionValidationLane {
    id: String,
    label: String,
    summary: String,
    trigger: String,
    #[serde(default)]
    commands: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionSkillPlanItem {
    #[serde(alias = "skill_id")]
    skill_id: String,
    label: String,
    state: String,
    #[serde(default)]
    summary: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionPlanMilestoneRecord {
    id: String,
    label: String,
    summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    node_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    validation_lane_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    acceptance_criteria: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionValidationLaneRecord {
    id: String,
    label: String,
    summary: String,
    trigger: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    commands: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskMissionSkillPlanItemRecord {
    skill_id: String,
    label: String,
    state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<String>,
}
