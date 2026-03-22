import type {
  AgentTaskMissionBrief,
  AgentTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";

type GitHubSourceDelegationStartInput = {
  workspaceId: string;
  title: string;
  instruction: string;
  missionBrief?: AgentTaskMissionBrief | null;
  preferredBackendIds?: string[] | null;
  taskSource: AgentTaskSourceSummary;
};

type GitHubSourceDelegationRuntimeControl = {
  startTask: (input: {
    workspaceId: string;
    title: string;
    instruction: string;
    stepKind: "read";
    missionBrief?: AgentTaskMissionBrief | null;
    preferredBackendIds?: string[];
    taskSource: AgentTaskSourceSummary;
  }) => Promise<unknown>;
};

export async function launchGitHubSourceDelegation(input: {
  runtimeControl: GitHubSourceDelegationRuntimeControl;
  onRefresh?: (() => void | Promise<void>) | null;
  launch: GitHubSourceDelegationStartInput;
}) {
  const preferredBackendIds =
    input.launch.preferredBackendIds?.filter(
      (value) => typeof value === "string" && value.trim()
    ) ?? [];
  const ack = await input.runtimeControl.startTask({
    workspaceId: input.launch.workspaceId,
    title: input.launch.title,
    instruction: input.launch.instruction,
    stepKind: "read",
    ...(input.launch.missionBrief ? { missionBrief: input.launch.missionBrief } : {}),
    ...(preferredBackendIds.length > 0 ? { preferredBackendIds } : {}),
    taskSource: input.launch.taskSource,
  });

  await input.onRefresh?.();
  return ack;
}
