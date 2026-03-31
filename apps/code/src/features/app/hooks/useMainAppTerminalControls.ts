import { useCallback, useMemo } from "react";
import {
  interruptTerminalSession,
  writeTerminalSession,
} from "../../../application/runtime/ports/terminal";

type DebugEntry = {
  id: string;
  timestamp: number;
  source: "error";
  label: string;
  payload: string;
};

type UseMainAppTerminalControlsParams = {
  activeWorkspaceId: string | null;
  activeTerminalId: string | null;
  terminalHasSession: boolean;
  terminalReadyKey: string | null;
  restartTerminalSession: (workspaceId: string, terminalId: string) => Promise<void>;
  addDebugEntry: (entry: DebugEntry) => void;
};

export function useMainAppTerminalControls({
  activeWorkspaceId,
  activeTerminalId,
  terminalHasSession,
  terminalReadyKey,
  restartTerminalSession,
  addDebugEntry,
}: UseMainAppTerminalControlsParams) {
  const activeTerminalSessionKey = useMemo(() => {
    if (!activeWorkspaceId || !activeTerminalId) {
      return null;
    }
    return `${activeWorkspaceId}:${activeTerminalId}`;
  }, [activeTerminalId, activeWorkspaceId]);

  const canControlActiveTerminal = Boolean(
    activeTerminalSessionKey && terminalHasSession && terminalReadyKey === activeTerminalSessionKey
  );

  const logTerminalActionError = useCallback(
    (label: string, error: unknown) => {
      addDebugEntry({
        id: `${Date.now()}-${label.replace(/\s+/g, "-")}`,
        timestamp: Date.now(),
        source: "error",
        label,
        payload: error instanceof Error ? error.message : String(error),
      });
    },
    [addDebugEntry]
  );

  const handleClearActiveTerminal = useCallback(() => {
    if (!activeWorkspaceId || !activeTerminalId || !canControlActiveTerminal) {
      return;
    }
    void writeTerminalSession(activeWorkspaceId, activeTerminalId, "\u000c").catch((error) => {
      logTerminalActionError("terminal clear error", error);
    });
  }, [activeTerminalId, activeWorkspaceId, canControlActiveTerminal, logTerminalActionError]);

  const handleRestartActiveTerminal = useCallback(() => {
    if (!activeWorkspaceId || !activeTerminalId || !canControlActiveTerminal) {
      return;
    }
    void restartTerminalSession(activeWorkspaceId, activeTerminalId).catch((error) => {
      logTerminalActionError("terminal restart error", error);
    });
  }, [
    activeTerminalId,
    activeWorkspaceId,
    canControlActiveTerminal,
    logTerminalActionError,
    restartTerminalSession,
  ]);

  const handleInterruptActiveTerminal = useCallback(() => {
    if (!activeWorkspaceId || !activeTerminalId || !canControlActiveTerminal) {
      return;
    }
    void interruptTerminalSession(activeWorkspaceId, activeTerminalId).catch((error) => {
      logTerminalActionError("terminal interrupt error", error);
    });
  }, [activeTerminalId, activeWorkspaceId, canControlActiveTerminal, logTerminalActionError]);

  return {
    canControlActiveTerminal,
    handleClearActiveTerminal,
    handleRestartActiveTerminal,
    handleInterruptActiveTerminal,
  };
}
