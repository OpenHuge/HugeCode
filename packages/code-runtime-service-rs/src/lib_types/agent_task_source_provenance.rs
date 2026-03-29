#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskSourceEvent {
    #[serde(default, alias = "delivery_id")]
    delivery_id: Option<String>,
    event_name: String,
    #[serde(default)]
    action: Option<String>,
    #[serde(default, alias = "received_at")]
    received_at: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskSourceRequester {
    #[serde(default)]
    login: Option<String>,
    #[serde(default)]
    id: Option<u64>,
    #[serde(default)]
    r#type: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskSourceGitHubRef {
    label: String,
    #[serde(default, alias = "issue_number")]
    issue_number: Option<u64>,
    #[serde(default, alias = "pull_request_number")]
    pull_request_number: Option<u64>,
    #[serde(default, alias = "head_sha")]
    head_sha: Option<String>,
    #[serde(default, alias = "trigger_mode")]
    trigger_mode: Option<String>,
    #[serde(default, alias = "command_kind")]
    command_kind: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskSourceGitHubComment {
    #[serde(default, alias = "comment_id")]
    comment_id: Option<u64>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    author: Option<AgentTaskSourceRequester>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskSourceGitHubLaunchHandshake {
    state: String,
    summary: String,
    #[serde(default)]
    disposition: Option<String>,
    #[serde(default, alias = "prepared_plan_version")]
    prepared_plan_version: Option<String>,
    #[serde(default, alias = "approved_plan_version")]
    approved_plan_version: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTaskSourceGitHubProvenance {
    #[serde(alias = "source_record_id")]
    source_record_id: String,
    repo: AgentTaskSourceRepoContext,
    event: AgentTaskSourceEvent,
    #[serde(rename = "ref")]
    r#ref: AgentTaskSourceGitHubRef,
    #[serde(default)]
    comment: Option<AgentTaskSourceGitHubComment>,
    #[serde(alias = "launch_handshake")]
    launch_handshake: AgentTaskSourceGitHubLaunchHandshake,
}
