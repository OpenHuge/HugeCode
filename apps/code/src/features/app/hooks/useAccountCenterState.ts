import {
  type SharedAccountCenterState,
  useSharedAccountCenterState,
} from "@ku0/code-workspace-client";

export type {
  AccountCenterCodexAccountSummary,
  AccountCenterProviderSummary,
} from "@ku0/code-workspace-client";

export type AccountCenterState = Omit<SharedAccountCenterState, "refresh">;

export function useAccountCenterState(): AccountCenterState {
  const accountCenter = useSharedAccountCenterState();

  const { refresh: _refresh, ...state } = accountCenter;
  return state;
}
