import type { RuntimeCompositionProfile } from "@ku0/code-runtime-host-contract";
import {
  mergeRuntimeCompositionProfiles,
  type RuntimeCompositionProfileLaunchOverride,
} from "./runtimeCompositionProfiles";

export type RuntimeConfigHookStage =
  | "composition.profile"
  | "composition.explainability"
  | "backend.preference";

export type RuntimeConfigHookContext = {
  workspaceId?: string | null;
  activeProfileId?: string | null;
};

export type RuntimeConfigHookRunInput<TValue> = {
  stage: RuntimeConfigHookStage;
  value: TValue;
  context: RuntimeConfigHookContext;
};

export type RuntimeConfigHook<TValue = unknown> = {
  name: string;
  run: (input: RuntimeConfigHookRunInput<TValue>) => TValue;
};

export type RuntimeConfigHookResult<TValue> = {
  value: TValue;
  appliedHooks: string[];
};

export function applyRuntimeConfigHooks<TValue>(input: {
  stage: RuntimeConfigHookStage;
  value: TValue;
  context?: RuntimeConfigHookContext;
  hooks?: readonly RuntimeConfigHook<TValue>[] | null;
}): RuntimeConfigHookResult<TValue> {
  const appliedHooks: string[] = [];
  let current = input.value;
  for (const hook of input.hooks ?? []) {
    current = hook.run({
      stage: input.stage,
      value: current,
      context: input.context ?? {},
    });
    appliedHooks.push(hook.name);
  }
  return {
    value: current,
    appliedHooks,
  };
}

export function resolveRuntimeCompositionProfile(input: {
  profiles: RuntimeCompositionProfile[];
  activeProfileId: string;
  launchOverride?: RuntimeCompositionProfileLaunchOverride | null;
  hooks?: readonly RuntimeConfigHook<RuntimeCompositionProfile>[] | null;
  context?: RuntimeConfigHookContext;
}): {
  profile: RuntimeCompositionProfile;
  appliedHooks: string[];
} {
  const result = applyRuntimeConfigHooks({
    stage: "composition.profile",
    value: mergeRuntimeCompositionProfiles(
      input.profiles,
      input.activeProfileId,
      input.launchOverride ?? null
    ),
    hooks: input.hooks,
    context: {
      activeProfileId: input.activeProfileId,
      ...(input.context ?? {}),
    },
  });
  return {
    profile: result.value,
    appliedHooks: result.appliedHooks,
  };
}
