import type {
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  LiveSkillSummary,
} from "@ku0/code-runtime-host-contract";
import type {
  RuntimeExecutableSkillCatalog,
  RuntimeExecutableSkillResolution,
  RuntimeInvocationDescriptor,
  RuntimeSkillIdResolution,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import {
  RuntimeSkillExecutionGateError,
  readRuntimeExecutableSkillCatalog,
  resolveRuntimeExecutableSkill,
  runRuntimeExecutableSkill,
} from "./runtimeExecutableSkillCatalog";

export type RuntimeExecutableSkillAvailability = NonNullable<
  RuntimeSkillIdResolution["availability"]
>;

type CreateRuntimeExecutableSkillFacadeInput = {
  listRuntimeInvocations?:
    | ((input?: {
        sessionId?: string | null;
        activeOnly?: boolean | null;
        kind?: RuntimeInvocationDescriptor["kind"] | null;
      }) => Promise<RuntimeInvocationDescriptor[]>)
    | null;
  listLiveSkills?: (() => Promise<LiveSkillSummary[]>) | null;
  runLiveSkill: (request: LiveSkillExecuteRequest) => Promise<LiveSkillExecutionResult>;
};

export type RuntimeExecutableSkillFacade = {
  readCatalog: (input?: { sessionId?: string | null }) => Promise<RuntimeExecutableSkillCatalog>;
  resolveSkill: (input: {
    skillId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeExecutableSkillResolution>;
  runSkill: (input: {
    request: LiveSkillExecuteRequest;
    sessionId?: string | null;
  }) => Promise<LiveSkillExecutionResult>;
};

export { RuntimeSkillExecutionGateError } from "./runtimeExecutableSkillCatalog";

export function createRuntimeExecutableSkillFacade(
  input: CreateRuntimeExecutableSkillFacadeInput
): RuntimeExecutableSkillFacade {
  return {
    readCatalog: async (options) =>
      readRuntimeExecutableSkillCatalog({
        sessionId: options?.sessionId ?? null,
        listRuntimeInvocations: input.listRuntimeInvocations,
        listLiveSkills: input.listLiveSkills,
      }),
    resolveSkill: async (options) => {
      if (!input.listRuntimeInvocations && !input.listLiveSkills) {
        throw new RuntimeSkillExecutionGateError({
          code: "catalog_unavailable",
          requestedSkillId: options.skillId,
          message:
            "Runtime executable skill catalog is unavailable because neither activation-backed invocation readers nor legacy live-skill listing are exposed.",
        });
      }
      return resolveRuntimeExecutableSkill(
        await readRuntimeExecutableSkillCatalog({
          sessionId: options.sessionId ?? null,
          listRuntimeInvocations: input.listRuntimeInvocations,
          listLiveSkills: input.listLiveSkills,
        }),
        {
          skillId: options.skillId,
        }
      );
    },
    runSkill: async (options) => {
      if (!input.listRuntimeInvocations && !input.listLiveSkills) {
        throw new RuntimeSkillExecutionGateError({
          code: "catalog_unavailable",
          requestedSkillId: options.request.skillId,
          message:
            "Runtime executable skill catalog is unavailable because neither activation-backed invocation readers nor legacy live-skill listing are exposed.",
        });
      }
      return runRuntimeExecutableSkill({
        catalog: await readRuntimeExecutableSkillCatalog({
          sessionId: options.sessionId ?? null,
          listRuntimeInvocations: input.listRuntimeInvocations,
          listLiveSkills: input.listLiveSkills,
        }),
        request: options.request,
        runLiveSkill: input.runLiveSkill,
      });
    },
  };
}
