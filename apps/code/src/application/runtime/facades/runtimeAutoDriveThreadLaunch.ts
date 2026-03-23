import type { AgentTaskAutoDriveState } from "@ku0/code-runtime-host-contract";
import { sendUserMessage } from "../ports/tauriThreads";
import type { AccessMode } from "../../../types";

type LaunchAutoDriveThreadInput = {
  workspaceId: string;
  threadId: string;
  instruction: string;
  modelId: string | null;
  reasonEffort: "low" | "medium" | "high" | "xhigh" | null;
  accessMode: AccessMode;
  preferredBackendIds?: string[] | null;
  autoDrive: AgentTaskAutoDriveState;
};

export async function launchAutoDriveThread(params: LaunchAutoDriveThreadInput) {
  return sendUserMessage(params.workspaceId, params.threadId, params.instruction, {
    model: params.modelId,
    effort: params.reasonEffort,
    accessMode: params.accessMode,
    executionMode: "runtime",
    missionMode: "delegate",
    preferredBackendIds: params.preferredBackendIds ?? null,
    autoDrive: params.autoDrive,
  });
}
