import type {
  AgentTaskAutoDriveState,
  HugeCodeTaskMode,
  RuntimeAutonomyRequestV2,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeSessionCommandFacade } from "../../../application/runtime/facades/runtimeSessionCommandFacade";
import type { AccessMode, ComposerExecutionMode } from "../../../types";

export async function invokeSteerTurnRequest(
  runtimeSessionCommands: RuntimeSessionCommandFacade,
  params: {
    threadId: string;
    activeTurnId: string;
    text: string;
    images: string[];
    contextPrefix: string | null;
    provider: string | null | undefined;
    model: string | null | undefined;
    effort: string | null | undefined;
    fastMode: boolean;
    collaborationMode: Record<string, unknown> | null;
    accessMode: AccessMode | undefined;
    executionMode: ComposerExecutionMode;
    missionMode: HugeCodeTaskMode | null;
    executionProfileId: string | null;
    preferredBackendIds: string[] | null;
    codexBin: string | null;
    codexArgs: string[] | null;
    autoDrive?: AgentTaskAutoDriveState | null;
    autonomyRequest?: RuntimeAutonomyRequestV2 | null;
  }
): Promise<Record<string, unknown>> {
  const serviceTier = params.fastMode ? "fast" : null;
  const steerOptions = {
    provider: params.provider,
    model: params.model,
    effort: params.effort,
    serviceTier,
    collaborationMode: params.collaborationMode,
    accessMode: params.accessMode,
    executionMode: params.executionMode,
    missionMode: params.missionMode,
    executionProfileId: params.executionProfileId,
    preferredBackendIds: params.preferredBackendIds,
    codexBin: params.codexBin,
    codexArgs: params.codexArgs,
    telemetrySource: "thread_messaging",
    ...(params.autoDrive ? { autoDrive: params.autoDrive } : {}),
    ...(params.autonomyRequest ? { autonomyRequest: params.autonomyRequest } : {}),
  };
  const steerInput = {
    threadId: params.threadId,
    turnId: params.activeTurnId,
    text: params.text,
    images: params.images,
    options: steerOptions,
    ...(params.contextPrefix ? { contextPrefix: params.contextPrefix } : {}),
  };
  return (await runtimeSessionCommands.steerTurn({
    ...steerInput,
  })) as Record<string, unknown>;
}
