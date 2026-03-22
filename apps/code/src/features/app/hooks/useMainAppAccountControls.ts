import { useAccountCenterState } from "./useAccountCenterState";
import { useAccountSwitching } from "./useAccountSwitching";

type UseMainAppAccountControlsArgs = {
  activeWorkspaceId: string | null;
  fallbackWorkspaceId?: string | null;
  accountByWorkspace: Parameters<typeof useAccountSwitching>[0]["accountByWorkspace"];
  refreshAccountInfo: Parameters<typeof useAccountSwitching>[0]["refreshAccountInfo"];
  refreshAccountRateLimits: Parameters<typeof useAccountSwitching>[0]["refreshAccountRateLimits"];
  alertError: Parameters<typeof useAccountSwitching>[0]["alertError"];
};

export function useMainAppAccountControls({
  activeWorkspaceId,
  fallbackWorkspaceId = null,
  accountByWorkspace,
  refreshAccountInfo,
  refreshAccountRateLimits,
  alertError,
}: UseMainAppAccountControlsArgs) {
  const switching = useAccountSwitching({
    activeWorkspaceId,
    fallbackWorkspaceId,
    accountByWorkspace,
    refreshAccountInfo,
    refreshAccountRateLimits,
    alertError,
  });
  const accountCenter = useAccountCenterState();

  return {
    ...switching,
    accountCenter,
  };
}
