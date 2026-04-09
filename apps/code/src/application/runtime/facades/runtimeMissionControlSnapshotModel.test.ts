import { describe, expect, it } from "vitest";
import type { RuntimeProviderCatalogEntry } from "@ku0/code-runtime-host-contract";
import { AGENT_TASK_DURABILITY_DEGRADED_REASON } from "../../../utils/runtimeUpdatedDurability";
import {
  buildRuntimeAdvisorySnapshotState,
  reduceRuntimeDurabilityEventWarning,
} from "./runtimeMissionControlSnapshotModel";

describe("runtimeMissionControlSnapshotModel", () => {
  it("normalizes advisory snapshot state and preserves previous diagnostics fallbacks", () => {
    const state = buildRuntimeAdvisorySnapshotState({
      nextProviders: [
        {
          providerId: "openai",
          displayName: "",
          pool: "codex",
          oauthProviderId: null,
          aliases: ["", "chatgpt"],
          defaultModelId: "",
          available: true,
          supportsNative: true,
          supportsOpenaiCompat: false,
          readinessKind: "ready",
          readinessMessage: "",
          executionKind: "cloud",
          registryVersion: null,
          capabilityMatrix: null,
        } as RuntimeProviderCatalogEntry,
      ],
      nextAccounts: [],
      nextPools: [],
      kernelProjectionEnabled: false,
      capabilitiesProjectionSlice: null,
      capabilitiesResult: {
        status: "rejected",
        reason: { message: "capabilities unavailable", code: "CAPS_DOWN" },
      },
      healthResult: {
        status: "rejected",
        reason: new Error("health unavailable"),
      },
      metricsResult: {
        status: "rejected",
        reason: new Error("metrics unavailable"),
      },
      guardrailsResult: {
        status: "rejected",
        reason: new Error("guardrails unavailable"),
      },
      policyResult: {
        status: "fulfilled",
        value: null,
      },
      previousToolMetrics: { previous: "metrics" },
      previousToolGuardrails: { previous: "guardrails" },
    });

    expect(state.providers[0]).toMatchObject({
      providerId: "openai",
      displayName: "openai",
      aliases: ["chatgpt"],
      defaultModelId: null,
    });
    expect(state.capabilities).toMatchObject({
      mode: "unavailable",
      error: "capabilities unavailable (CAPS_DOWN)",
    });
    expect(state.health).toBeNull();
    expect(state.healthError).toBe("health unavailable");
    expect(state.toolMetrics).toEqual({ previous: "metrics" });
    expect(state.toolGuardrails).toEqual({ previous: "guardrails" });
    expect(state.policy).toBeNull();
    expect(state.policyError).toBeNull();
  });

  it("reduces matching durability events into warnings and ignores unrelated workspaces", () => {
    const unrelated = reduceRuntimeDurabilityEventWarning({
      previous: null,
      workspaceId: "ws-1",
      eventWorkspaceId: "ws-2",
      paramsWorkspaceId: "ws-2",
      now: 100,
      diagnostics: {
        reason: AGENT_TASK_DURABILITY_DEGRADED_REASON,
        updatedAt: 99,
      },
    });
    expect(unrelated).toBeNull();

    const related = reduceRuntimeDurabilityEventWarning({
      previous: null,
      workspaceId: "ws-1",
      eventWorkspaceId: "ws-1",
      paramsWorkspaceId: "ws-1",
      now: 100,
      diagnostics: {
        reason: AGENT_TASK_DURABILITY_DEGRADED_REASON,
        mode: "degraded",
        degraded: true,
        updatedAt: 99,
      },
    });

    expect(related).toMatchObject({
      reason: AGENT_TASK_DURABILITY_DEGRADED_REASON,
      revision: `ws-1:${AGENT_TASK_DURABILITY_DEGRADED_REASON}:99`,
      repeatCount: 1,
      mode: "degraded",
      degraded: true,
    });
  });
});
