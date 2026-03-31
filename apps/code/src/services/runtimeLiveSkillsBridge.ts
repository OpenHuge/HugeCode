import {
  getRuntimeClient,
  type LiveSkillExecuteRequest,
  type LiveSkillSummary,
} from "./runtimeClient";

export async function listRuntimeLiveSkills(): Promise<LiveSkillSummary[]> {
  return getRuntimeClient().liveSkills();
}

export async function runRuntimeLiveSkill(request: LiveSkillExecuteRequest) {
  return getRuntimeClient().runLiveSkill(request);
}
