type CompactCodexUiStateOptions = {
  hasActiveWorkspace: boolean;
  isCompact: boolean;
  isPhone: boolean;
  activeTab: string;
  isActiveWorkspaceConnected: boolean;
  threadLiveConnectionState: string;
  hasActiveThread: boolean;
  isProcessing: boolean;
};

export function resolveCompactCodexUiState({
  hasActiveWorkspace,
  isCompact,
  isPhone,
  activeTab,
  isActiveWorkspaceConnected,
  threadLiveConnectionState,
  hasActiveThread,
  isProcessing,
}: CompactCodexUiStateOptions) {
  const showCompactCodexThreadActions =
    hasActiveWorkspace && isCompact && isPhone && activeTab === "missions";

  return {
    showCompactCodexThreadActions,
    showMobilePollingFetchStatus:
      showCompactCodexThreadActions &&
      isActiveWorkspaceConnected &&
      threadLiveConnectionState === "fallback" &&
      hasActiveThread &&
      !isProcessing,
  };
}
