use super::*;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RunRecordRequest {
    run_id: String,
}

pub(super) fn parse_run_id(params: &Value) -> Result<String, RpcError> {
    let request: RunRecordRequest = serde_json::from_value(params.clone())
        .map_err(|error| RpcError::invalid_params(format!("Invalid run record request: {error}")))?;
    let run_id = request.run_id.trim().to_string();
    if run_id.is_empty() {
        return Err(RpcError::invalid_params("runId is required."));
    }
    Ok(run_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_run_id_accepts_canonical_request() {
        let run_id = parse_run_id(&json!({ "runId": "run-42" })).expect("canonical run id");
        assert_eq!(run_id, "run-42");
    }

    #[test]
    fn parse_run_id_rejects_snake_case_request() {
        let error =
            parse_run_id(&json!({ "run_id": "run-42" })).expect_err("snake_case must fail");
        assert_eq!(error.code.as_str(), "INVALID_PARAMS");
        assert!(
            error.message.contains("Invalid run record request"),
            "unexpected message: {}",
            error.message
        );
    }
}
