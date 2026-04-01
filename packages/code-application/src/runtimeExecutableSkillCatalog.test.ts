import type {
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  LiveSkillSummary,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeInvocationDescriptor } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import {
  RuntimeSkillExecutionGateError,
  readRuntimeExecutableSkillCatalog,
  resolveRuntimeExecutableSkill,
  runRuntimeExecutableSkill,
} from "./runtimeExecutableSkillCatalog";

function createSkillInvocation(
  overrides: Partial<RuntimeInvocationDescriptor> = {}
): RuntimeInvocationDescriptor {
  return {
    id: "session.review",
    title: "Session Review",
    version: "1.0.0",
    kind: "skill",
    bindingStage: "runtime_binding",
    live: true,
    activationState: "active",
    readiness: {
      state: "ready",
      summary: "Skill is active.",
      detail: "Skill is executable.",
    },
    diagnostics: [],
    transitionHistory: [],
    source: {
      activationId: "plugin:session.review",
      sourceType: "runtime_plugin",
      sourceScope: "runtime",
      sourceRef: "session.review",
      pluginId: "session.review",
      packageRef: null,
      overlayId: null,
      sessionId: null,
    },
    metadata: {
      runtimeSkillId: "session.review",
      aliases: ["review-skill"],
    },
    ...overrides,
  };
}

function createLiveSkillSummary(overrides: Partial<LiveSkillSummary> = {}): LiveSkillSummary {
  return {
    id: "session.review",
    name: "Session Review",
    description: "Review the current session state.",
    kind: "file_search",
    source: "builtin",
    version: "1.0.0",
    enabled: true,
    supportsNetwork: false,
    permissions: [],
    tags: ["review"],
    aliases: ["review-skill"],
    ...overrides,
  };
}

function createLiveSkillExecutionResult(
  overrides: Partial<LiveSkillExecutionResult> = {}
): LiveSkillExecutionResult {
  return {
    runId: "run-1",
    skillId: "session.review",
    status: "completed",
    message: "ok",
    output: "done",
    network: null,
    artifacts: [],
    metadata: {},
    ...overrides,
  };
}

describe("runtimeExecutableSkillCatalog", () => {
  it("prefers activation-backed invocation catalog over legacy live skills", async () => {
    const listInvocations = vi.fn(async () => [
      createSkillInvocation({
        id: "session.review",
        metadata: {
          runtimeSkillId: "session.review",
          aliases: ["review-skill"],
        },
      }),
    ]);
    const listLiveSkills = vi.fn(async () => [
      createLiveSkillSummary({
        id: "legacy-review",
        aliases: ["review-skill"],
      }),
    ]);

    const catalog = await readRuntimeExecutableSkillCatalog({
      sessionId: "session-1",
      listRuntimeInvocations: listInvocations,
      listLiveSkills,
    });

    expect(listInvocations).toHaveBeenCalledWith({
      sessionId: "session-1",
      kind: "skill",
    });
    expect(listLiveSkills).not.toHaveBeenCalled();
    expect(catalog.catalogSessionId).toBe("session-1");
    expect(catalog.entries).toEqual([
      expect.objectContaining({
        canonicalSkillId: "session.review",
        runtimeSkillId: "session.review",
        availability: expect.objectContaining({
          invocationId: "session.review",
          activationState: "active",
          live: true,
        }),
      }),
    ]);
  });

  it("falls back to legacy live skill transport when invocation catalog readers are unavailable", async () => {
    const listLiveSkills = vi.fn(async () => [
      createLiveSkillSummary({
        id: "core-grep",
        aliases: ["grep", "search"],
      }),
    ]);

    const catalog = await readRuntimeExecutableSkillCatalog({
      sessionId: "session-ignored",
      listLiveSkills,
    });

    expect(catalog.catalogSessionId).toBeNull();
    expect(catalog.fallbackToLegacyTransport).toBe(true);
    expect(catalog.entries[0]).toMatchObject({
      canonicalSkillId: "core-grep",
      runtimeSkillId: "core-grep",
      availability: {
        invocationId: null,
        activationState: "active",
        live: true,
      },
    });
  });

  it("resolves aliases and preserves degraded but live availability", async () => {
    const catalog = await readRuntimeExecutableSkillCatalog({
      listRuntimeInvocations: vi.fn(async () => [
        createSkillInvocation({
          live: true,
          activationState: "degraded",
          readiness: {
            state: "attention",
            summary: "Skill is active with reduced readiness.",
            detail: "Secondary binder is missing.",
          },
        }),
      ]),
    });

    const resolution = resolveRuntimeExecutableSkill(catalog, {
      skillId: "review-skill",
    });

    expect(resolution).toMatchObject({
      requestedSkillId: "review-skill",
      resolvedSkillId: "session.review",
      aliasApplied: true,
      availability: {
        invocationId: "session.review",
        live: true,
        activationState: "degraded",
      },
    });
  });

  it("rejects non-live activation-backed skills with stateful gate errors", async () => {
    const catalog = await readRuntimeExecutableSkillCatalog({
      listRuntimeInvocations: vi.fn(async () => [
        createSkillInvocation({
          live: false,
          activationState: "refresh_pending",
          readiness: {
            state: "attention",
            summary: "Skill refresh is pending.",
            detail: "Overlay rebuild is still in progress.",
          },
        }),
      ]),
    });

    await expect(
      runRuntimeExecutableSkill({
        catalog,
        request: {
          skillId: "session.review",
          input: "test",
        },
        runLiveSkill: vi.fn(),
      })
    ).rejects.toMatchObject({
      code: "refresh_pending",
      activationState: "refresh_pending",
      readiness: expect.objectContaining({
        summary: "Skill refresh is pending.",
      }),
    });
  });

  it("reports unknown skills through a dedicated gate error", async () => {
    const catalog = await readRuntimeExecutableSkillCatalog({
      listRuntimeInvocations: vi.fn(async (): Promise<RuntimeInvocationDescriptor[]> => []),
    });

    const promise = runRuntimeExecutableSkill({
      catalog,
      request: {
        skillId: "missing-skill",
        input: "test",
      },
      runLiveSkill: vi.fn(),
    });

    await expect(promise).rejects.toBeInstanceOf(RuntimeSkillExecutionGateError);
    await expect(promise).rejects.toMatchObject({
      code: "unknown_skill",
      requestedSkillId: "missing-skill",
    });
  });

  it("passes the resolved canonical skill id to the legacy execution transport", async () => {
    const runLiveSkill = vi.fn(
      async (request: LiveSkillExecuteRequest): Promise<LiveSkillExecutionResult> =>
        createLiveSkillExecutionResult({
          skillId: request.skillId,
        })
    );
    const catalog = await readRuntimeExecutableSkillCatalog({
      listRuntimeInvocations: vi.fn(async () => [
        createSkillInvocation({
          id: "session.review",
          metadata: {
            runtimeSkillId: "runtime.review",
            aliases: ["review-skill"],
          },
        }),
      ]),
    });

    await runRuntimeExecutableSkill({
      catalog,
      request: {
        skillId: "review-skill",
        input: "test",
      },
      runLiveSkill,
    });

    expect(runLiveSkill).toHaveBeenCalledWith({
      skillId: "runtime.review",
      input: "test",
    });
  });
});
