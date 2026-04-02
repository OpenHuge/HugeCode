import { describe, expect, it } from "vitest";
import type { RuntimeExtensionActivationSnapshot } from "@ku0/code-runtime-host-contract";
import {
  listRuntimeInvocationDescriptors,
  normalizeRuntimeInvocationCatalogSnapshot,
  resolveRuntimeInvocationDescriptor,
} from "./runtimeInvocationCatalog";

function createActivationSnapshot(
  overrides: Partial<RuntimeExtensionActivationSnapshot> = {}
): RuntimeExtensionActivationSnapshot {
  const { refreshMode = "full", ...restOverrides } = overrides;
  return {
    workspaceId: "ws-1",
    sessionId: null,
    refreshMode,
    refreshedAt: 123,
    records: [
      {
        activationId: "plugin:core-grep",
        sourceType: "runtime_plugin",
        sourceScope: "runtime",
        sourceRef: "core-grep",
        pluginId: "core-grep",
        packageRef: null,
        overlayId: null,
        sessionId: null,
        name: "Core Grep",
        version: "1.0.0",
        state: "active",
        readiness: {
          state: "ready",
          summary: "Plugin is active.",
          detail: "Live contributions are available now.",
        },
        diagnostics: [],
        contributions: [
          {
            id: "core-grep",
            kind: "skill",
            sourceId: "plugin:core-grep",
            title: "Core Grep",
            bindingStage: "runtime_binding",
            active: true,
            metadata: {
              aliases: ["grep", "search"],
              tags: ["search"],
              source: "builtin",
            },
          },
          {
            id: "core-grep:invoke",
            kind: "invocation",
            sourceId: "plugin:core-grep",
            title: "Core Grep invocation",
            bindingStage: "runtime_binding",
            active: true,
            metadata: {
              skillId: "core-grep",
            },
          },
          {
            id: "core-grep:resource",
            kind: "resource",
            sourceId: "plugin:core-grep",
            title: "Core Grep resource",
            bindingStage: "runtime_binding",
            active: true,
            metadata: null,
          },
        ],
        transitionHistory: [
          {
            state: "active",
            at: 123,
            reason: "Plugin is active.",
          },
        ],
        metadata: {
          source: "builtin",
        },
      },
      {
        activationId: "behavior:workspace:repo.skill",
        sourceType: "behavior_asset",
        sourceScope: "workspace",
        sourceRef: "repo.skill",
        pluginId: null,
        packageRef: null,
        overlayId: null,
        sessionId: null,
        name: "Repo Skill",
        version: "0.1.0",
        state: "deactivated",
        readiness: {
          state: "attention",
          summary: "Behavior asset is deactivated.",
          detail: "Enable it to restore live contributions.",
        },
        diagnostics: [
          {
            phase: "deactivate",
            severity: "info",
            code: "activation_deactivated",
            message: "Activation is currently disabled.",
            at: 123,
          },
        ],
        contributions: [
          {
            id: "repo.skill",
            kind: "skill",
            sourceId: "behavior:workspace:repo.skill",
            title: "Repo Skill",
            bindingStage: "compile_time_descriptor",
            active: false,
            metadata: {
              aliases: [],
            },
          },
        ],
        transitionHistory: [
          {
            state: "deactivated",
            at: 123,
            reason: "Behavior asset is deactivated.",
          },
        ],
        metadata: {
          kind: "skill",
          manifestPath: ".hugecode/skills/repo.skill.json",
        },
      },
    ],
    activeContributions: [
      {
        id: "core-grep",
        kind: "skill",
        sourceId: "plugin:core-grep",
        title: "Core Grep",
        bindingStage: "runtime_binding",
        active: true,
        metadata: {
          aliases: ["grep", "search"],
          tags: ["search"],
        },
      },
      {
        id: "core-grep:invoke",
        kind: "invocation",
        sourceId: "plugin:core-grep",
        title: "Core Grep invocation",
        bindingStage: "runtime_binding",
        active: true,
        metadata: {
          skillId: "core-grep",
        },
      },
    ],
    summary: {
      total: 2,
      active: 1,
      degraded: 0,
      failed: 0,
      deactivated: 1,
      refreshPending: 0,
      uninstalled: 0,
    },
    ...restOverrides,
  };
}

describe("runtimeInvocationCatalog", () => {
  it("normalizes invocable contributions from activation truth and preserves non-live explanations", () => {
    const snapshot = normalizeRuntimeInvocationCatalogSnapshot(createActivationSnapshot());

    expect(snapshot.activeEntries).toEqual([
      expect.objectContaining({
        id: "core-grep",
        kind: "skill",
        live: true,
        activationState: "active",
      }),
      expect.objectContaining({
        id: "core-grep:invoke",
        kind: "invocation",
        live: true,
      }),
    ]);
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "repo.skill",
          kind: "skill",
          live: false,
          activationState: "deactivated",
          readiness: expect.objectContaining({
            state: "attention",
          }),
          diagnostics: [
            expect.objectContaining({
              code: "activation_deactivated",
            }),
          ],
        }),
      ])
    );
    expect(snapshot.entries.some((entry) => entry.id === "core-grep:resource")).toBe(false);
  });

  it("filters and resolves invocation entries from the normalized snapshot", () => {
    const snapshot = normalizeRuntimeInvocationCatalogSnapshot(createActivationSnapshot());

    expect(
      listRuntimeInvocationDescriptors(snapshot, {
        activeOnly: true,
        kind: "skill",
      })
    ).toEqual([
      expect.objectContaining({
        id: "core-grep",
      }),
    ]);

    expect(
      resolveRuntimeInvocationDescriptor(snapshot, {
        invocationId: "repo.skill",
      })
    ).toEqual(
      expect.objectContaining({
        id: "repo.skill",
        activationState: "deactivated",
      })
    );
  });
});
