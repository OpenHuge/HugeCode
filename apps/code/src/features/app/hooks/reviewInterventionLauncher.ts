import type { MissionInterventionDraft } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import { resolvePreferredBackendIdsForRuntimeRunLaunch } from "../../../application/runtime/facades/runtimeRemoteExecutionFacade";
import type { RuntimeAgentControl } from "../../../application/runtime/types/webMcpBridge";
import { mapInterventionIntentToAction } from "./reviewInterventionMapping";

export async function launchReviewInterventionDraft(input: {
  draft: MissionInterventionDraft;
  runtimeControl: Pick<RuntimeAgentControl, "interveneTask">;
  onRefresh?: (() => void | Promise<void>) | null;
}) {
  const interveneTask = input.runtimeControl.interveneTask;
  if (typeof interveneTask !== "function") {
    throw new Error("Runtime does not support task interventions.");
  }

  const preferredBackendIds = await resolvePreferredBackendIdsForRuntimeRunLaunch(
    input.draft.preferredBackendIds
  );
  const ack = await interveneTask({
    taskId: input.draft.sourceTaskId,
    action: mapInterventionIntentToAction(input.draft.intent),
    reason: `review_follow_up:${input.draft.intent}`,
    instructionPatch: input.draft.instruction,
    executionProfileId: input.draft.profileId,
    preferredBackendIds: preferredBackendIds ?? null,
    relaunchContext: input.draft.relaunchContext ?? null,
  });

  if (!ack.accepted) {
    throw new Error(
      ack.outcome === "blocked"
        ? "Runtime blocked this intervention. Check run state and try again."
        : "Runtime did not accept the intervention request."
    );
  }

  await input.onRefresh?.();
  return ack;
}
