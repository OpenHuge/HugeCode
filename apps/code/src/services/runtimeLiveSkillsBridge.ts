import {
  getRuntimeClient,
  type LiveSkillExecuteRequest,
  type LiveSkillSummary,
} from "./runtimeClient";

export async function listRuntimeLiveSkills(): Promise<LiveSkillSummary[]> {
  return getRuntimeClient().liveSkills();
}

// Raw runtime transport only. Canonical live/readiness truth now comes from
// activation-backed invocation and executable-skill facades.
export async function runRuntimeLiveSkill(request: LiveSkillExecuteRequest) {
  return getRuntimeClient().runLiveSkill(request);
}
