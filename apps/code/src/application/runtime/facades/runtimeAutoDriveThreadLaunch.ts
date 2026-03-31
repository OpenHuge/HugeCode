import type {
  AgentTaskAutoDriveState,
  RuntimeAutonomyRequestV2,
} from "@ku0/code-runtime-host-contract";
import type { AccessMode } from "../../../types";
import { createRuntimeSessionCommandFacade } from "./runtimeSessionCommandFacade";

type LaunchAutoDriveThreadInput = {
  workspaceId: string;
  threadId: string;
  instruction: string;
  modelId: string | null;
  reasonEffort: "low" | "medium" | "high" | "xhigh" | null;
  accessMode: AccessMode;
  preferredBackendIds?: string[] | null;
  autoDrive: AgentTaskAutoDriveState;
  autonomyRequest?: RuntimeAutonomyRequestV2 | null;
};

export async function launchAutoDriveThread(params: LaunchAutoDriveThreadInput) {
  return createRuntimeSessionCommandFacade(params.workspaceId).sendMessage({
    threadId: params.threadId,
    text: params.instruction,
    options: {
      model: params.modelId,
      effort: params.reasonEffort,
      accessMode: params.accessMode,
      executionMode: "runtime",
      missionMode: "delegate",
      preferredBackendIds: params.preferredBackendIds ?? null,
      autoDrive: params.autoDrive,
      autonomyRequest: params.autonomyRequest ?? null,
      telemetrySource: "runtime_autodrive_thread_launch",
    },
  });
}
