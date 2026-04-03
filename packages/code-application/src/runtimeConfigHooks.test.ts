import { describe, expect, it } from "vitest";
import { buildDefaultRuntimeCompositionProfiles } from "./runtimeCompositionProfiles";
import {
  applyRuntimeConfigHooks,
  resolveRuntimeCompositionProfile,
  type RuntimeConfigHook,
} from "./runtimeConfigHooks";

describe("runtimeConfigHooks", () => {
  it("applies hook pipelines in order and preserves provenance", () => {
    const calls: string[] = [];

    const result = applyRuntimeConfigHooks({
      stage: "composition.profile",
      value: {
        label: "initial",
      },
      context: {
        workspaceId: "workspace-alpha",
        activeProfileId: "workspace-default",
      },
      hooks: [
        {
          name: "label-a",
          run: ({ value, context }) => {
            calls.push(`${context.workspaceId}:${context.activeProfileId}:a`);
            return {
              ...value,
              label: `${value.label}-a`,
            };
          },
        },
        {
          name: "label-b",
          run: ({ value }) => {
            calls.push("b");
            return {
              ...value,
              label: `${value.label}-b`,
            };
          },
        },
      ],
    });

    expect(calls).toEqual(["workspace-alpha:workspace-default:a", "b"]);
    expect(result.value).toEqual({
      label: "initial-a-b",
    });
    expect(result.appliedHooks).toEqual(["label-a", "label-b"]);
  });

  it("resolves runtime composition profiles through hook-aware composition", () => {
    const profiles = buildDefaultRuntimeCompositionProfiles();
    const hook: RuntimeConfigHook = {
      name: "override-backend",
      run: ({ value }) => ({
        ...value,
        backendPolicy: {
          ...value.backendPolicy,
          preferredBackendIds: ["backend-hooked"],
        },
      }),
    };

    const result = resolveRuntimeCompositionProfile({
      profiles,
      activeProfileId: "workspace-default",
      hooks: [hook],
      context: {
        workspaceId: "workspace-alpha",
      },
    });

    expect(result.profile.backendPolicy.preferredBackendIds).toEqual(["backend-hooked"]);
    expect(result.appliedHooks).toEqual(["override-backend"]);
  });
});
