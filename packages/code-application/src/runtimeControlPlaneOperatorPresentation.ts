import type { RuntimeControlPlaneOperatorAction } from "./runtimeControlPlaneOperatorModel";

export type RuntimeControlPlaneOperatorActionPresentation = {
  busy: boolean;
  disabled: boolean;
  label: string;
  title: string | undefined;
};

export function resolveRuntimeControlPlaneOperatorActionPresentation(input: {
  action: RuntimeControlPlaneOperatorAction;
  busyActionId: string | null;
  runtimeLoading: boolean;
}): RuntimeControlPlaneOperatorActionPresentation {
  const busy = input.busyActionId === input.action.id;
  return {
    busy,
    disabled:
      input.runtimeLoading || input.busyActionId !== null || input.action.disabledReason !== null,
    label: busy ? "Working..." : input.action.label,
    title: input.action.disabledReason ?? input.action.detail ?? undefined,
  };
}
