use super::mission_control_dispatch::{
    build_runtime_execution_evidence_summary_for_review_pack,
    build_runtime_execution_evidence_summary_for_run,
    build_runtime_execution_lifecycle_summary_for_review_pack,
    build_runtime_execution_lifecycle_summary_for_run,
    MissionReviewPackProjection,
    MissionRunProjection,
};
use super::*;

pub(super) fn inject_runtime_execution_summaries(
    mission_run_value: &mut Value,
    mission_run: &MissionRunProjection,
    review_pack_value: &mut Option<Value>,
    review_pack: Option<&MissionReviewPackProjection>,
) {
    if let Some(object) = mission_run_value.as_object_mut() {
        object.insert(
            "lifecycleSummary".to_string(),
            build_runtime_execution_lifecycle_summary_for_run(mission_run),
        );
        object.insert(
            "evidenceSummary".to_string(),
            build_runtime_execution_evidence_summary_for_run(mission_run),
        );
    }

    if let (Some(review_pack_value), Some(review_pack)) = (review_pack_value.as_mut(), review_pack) {
        if let Some(object) = review_pack_value.as_object_mut() {
            object.insert(
                "lifecycleSummary".to_string(),
                build_runtime_execution_lifecycle_summary_for_review_pack(
                    review_pack,
                    Some(mission_run),
                ),
            );
            object.insert(
                "evidenceSummary".to_string(),
                build_runtime_execution_evidence_summary_for_review_pack(review_pack),
            );
        }
    }
}

pub(super) fn serialize_review_pack_with_runtime_summaries(
    review_pack: &MissionReviewPackProjection,
    mission_run: Option<&MissionRunProjection>,
) -> Result<Value, RpcError> {
    let mut value = serde_json::to_value(review_pack)
        .map_err(|error| RpcError::internal(format!("failed to serialize review pack: {error}")))?;
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "lifecycleSummary".to_string(),
            build_runtime_execution_lifecycle_summary_for_review_pack(review_pack, mission_run),
        );
        object.insert(
            "evidenceSummary".to_string(),
            build_runtime_execution_evidence_summary_for_review_pack(review_pack),
        );
    }
    Ok(value)
}
