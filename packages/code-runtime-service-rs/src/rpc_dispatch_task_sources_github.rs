#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceGitHubRefRpc {
    label: String,
    issue_number: Option<u64>,
    pull_request_number: Option<u64>,
    head_sha: Option<String>,
    trigger_mode: Option<String>,
    command_kind: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceGitHubCommentRpc {
    comment_id: Option<u64>,
    url: Option<String>,
    author: Option<TaskSourceRequesterRpc>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceLaunchHandshakeRpc {
    state: String,
    summary: String,
    disposition: Option<String>,
    prepared_plan_version: Option<String>,
    approved_plan_version: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSourceGitHubProvenanceRpc {
    source_record_id: String,
    repo: TaskSourceRepoContextRpc,
    event: TaskSourceEventRpc,
    #[serde(rename = "ref")]
    r#ref: TaskSourceGitHubRefRpc,
    comment: Option<TaskSourceGitHubCommentRpc>,
    launch_handshake: TaskSourceLaunchHandshakeRpc,
}

fn build_task_source_github_provenance(
    source_record_id: &str,
    event: &TaskSourceEventRpc,
    payload: &TaskSourcePayloadRpc,
    handshake: &TaskSourceLaunchHandshakeRpc,
) -> TaskSourceGitHubProvenanceRpc {
    TaskSourceGitHubProvenanceRpc {
        source_record_id: source_record_id.to_string(),
        repo: payload.repo.clone(),
        event: event.clone(),
        r#ref: TaskSourceGitHubRefRpc {
            label: build_task_source_reference(payload).unwrap_or_else(|| "GitHub source".to_string()),
            issue_number: payload.issue_number,
            pull_request_number: payload.pull_request_number,
            head_sha: payload.head_sha.clone(),
            trigger_mode: Some(payload.trigger_mode.clone()),
            command_kind: payload.command_kind.clone(),
        },
        comment: if payload.comment_id.is_some()
            || payload.comment_url.is_some()
            || payload.comment_author.is_some()
        {
            Some(TaskSourceGitHubCommentRpc {
                comment_id: payload.comment_id,
                url: payload.comment_url.clone(),
                author: payload.comment_author.clone(),
            })
        } else {
            None
        },
        launch_handshake: handshake.clone(),
    }
}
