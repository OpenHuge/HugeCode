export type SettingsServerCompactSelectProps = {
  className: string;
  triggerClassName: string;
  menuClassName: string;
  optionClassName: string;
  triggerDensity: "compact";
};

export type SettingsServerOperabilityState = {
  capabilityEnabled: boolean;
  loading: boolean;
  error: string | null;
  readOnlyReason: string | null;
  unavailableReason: string | null;
};

export function createSettingsServerOperabilityState(
  overrides: Partial<SettingsServerOperabilityState> = {}
): SettingsServerOperabilityState {
  return {
    capabilityEnabled: true,
    loading: false,
    error: null,
    readOnlyReason: null,
    unavailableReason: null,
    ...overrides,
  };
}

export function resolveSettingsServerOperabilityNotice(
  state: SettingsServerOperabilityState
): { tone: "default" | "error"; text: string } | null {
  if (state.error) {
    return {
      tone: "error",
      text: `Error: ${state.error}`,
    };
  }
  if (state.unavailableReason) {
    return {
      tone: "default",
      text: `Unavailable: ${state.unavailableReason}`,
    };
  }
  if (state.readOnlyReason) {
    return {
      tone: "default",
      text: `Read-only: ${state.readOnlyReason}`,
    };
  }
  if (state.loading) {
    return {
      tone: "default",
      text: "Loading runtime state...",
    };
  }
  return null;
}

export function resolveSettingsServerOperabilityBlockedReason(
  state: SettingsServerOperabilityState
): string | null {
  return state.unavailableReason ?? state.readOnlyReason ?? state.error;
}
