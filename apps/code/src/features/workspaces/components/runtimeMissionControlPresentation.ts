import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import {
  buildMissionControlLoopItems,
  buildMissionRunSummary,
  type MissionControlLoopItem,
} from "@ku0/code-application/runtimeMissionControlLoop";
import { projectAgentTaskStatusToRunState } from "@ku0/code-application/runtimeMissionControlTaskStatus";
import { formatHugeCodeRunStateLabel } from "../../../application/runtime/facades/runtimeMissionControlRunState";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";

export { projectAgentTaskStatusToRunState };
export { buildMissionControlLoopItems, buildMissionRunSummary };
export type { MissionControlLoopItem };

export function formatMissionRunStateLabel(
  state: ReturnType<typeof projectAgentTaskStatusToRunState>
): string {
  return formatHugeCodeRunStateLabel(state);
}

export function buildMissionRunSupervisionSignals(
  task: RuntimeAgentTaskSummary,
  run?: Pick<HugeCodeRunSummary, "placement"> | null
): string[] {
  const details: string[] = [];
  const runState = projectAgentTaskStatusToRunState(task.status);
  const lifecycleState = run?.placement?.lifecycleState ?? null;
  const backendId = run?.placement?.resolvedBackendId ?? null;

  if (runState === "review_ready") {
    details.push("Review Pack is ready for control-device review.");
  } else if (runState === "needs_input") {
    details.push("Approval or clarification is blocking this run.");
  }

  switch (lifecycleState) {
    case "confirmed":
      if (backendId) {
        details.push(`Runtime confirmed placement on ${backendId}.`);
      }
      break;
    case "fallback":
      if (backendId) {
        details.push(`Runtime confirmed fallback placement on ${backendId}.`);
      }
      break;
    case "resolved":
      if (backendId) {
        details.push(
          `Backend ${backendId} is resolved, but confirmation details are still pending.`
        );
      }
      break;
    case "requested":
      details.push("Routing intent is recorded, but runtime has not confirmed placement yet.");
      break;
    default:
      if (!run?.placement) {
        details.push("Runtime has not published placement confirmation yet.");
      }
      break;
  }

  if (task.checkpointId?.trim()) {
    details.push(`Checkpoint ${task.checkpointId} is ready for resume or handoff.`);
  } else if (task.traceId?.trim()) {
    details.push(`Trace ${task.traceId} is available for remote supervision.`);
  }

  if (task.recovered === true) {
    details.push("Recovered after a runtime restart and ready for supervised resume.");
  }

  if (task.taskSource?.label) {
    details.push(`Source-linked launch: ${task.taskSource.label}.`);
  }

  return details;
}
