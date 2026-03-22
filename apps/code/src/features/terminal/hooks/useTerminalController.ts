import { useCallback, useEffect, useRef } from "react";
import { closeTerminalSession } from "../../../application/runtime/ports/tauriTerminal";
import type { DebugEntry, WorkspaceInfo } from "../../../types";
import { buildErrorDebugEntry } from "../../../utils/debugEntries";
import { shouldIgnoreTerminalCloseError } from "./terminalErrorClassifier";
import { useTerminalSession } from "./useTerminalSession";
import { useTerminalTabs } from "./useTerminalTabs";

type UseTerminalControllerOptions = {
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceInfo | null;
  terminalOpen: boolean;
  onCloseTerminalPanel?: () => void;
  onDebug: (entry: DebugEntry) => void;
};

export function useTerminalController({
  activeWorkspaceId,
  activeWorkspace,
  terminalOpen,
  onCloseTerminalPanel,
  onDebug,
}: UseTerminalControllerOptions) {
  const cleanupTerminalRef = useRef<((workspaceId: string, terminalId: string) => void) | null>(
    null
  );

  const handleTerminalClose = useCallback(
    async (workspaceId: string, terminalId: string) => {
      cleanupTerminalRef.current?.(workspaceId, terminalId);
      try {
        await closeTerminalSession(workspaceId, terminalId);
      } catch (error) {
        if (shouldIgnoreTerminalCloseError(error)) {
          return;
        }
        onDebug(buildErrorDebugEntry("terminal close error", error));
      }
    },
    [onDebug]
  );

  const {
    terminals: terminalTabs,
    activeTerminalId,
    createTerminal,
    ensureTerminalWithTitle,
    closeTerminal,
    setActiveTerminal,
    ensureTerminal,
  } = useTerminalTabs({
    activeWorkspaceId,
    onCloseTerminal: handleTerminalClose,
  });

  useEffect(() => {
    if (terminalOpen && activeWorkspaceId) {
      ensureTerminal(activeWorkspaceId);
    }
  }, [activeWorkspaceId, ensureTerminal, terminalOpen]);

  const handleSessionExit = useCallback(
    (workspaceId: string, terminalId: string) => {
      const shouldClosePanel =
        workspaceId === activeWorkspaceId &&
        terminalTabs.length === 1 &&
        terminalTabs[0]?.id === terminalId;
      closeTerminal(workspaceId, terminalId);
      if (shouldClosePanel) {
        onCloseTerminalPanel?.();
      }
    },
    [activeWorkspaceId, closeTerminal, onCloseTerminalPanel, terminalTabs]
  );

  const terminalState = useTerminalSession({
    activeWorkspace,
    activeTerminalId,
    isVisible: terminalOpen,
    onDebug,
    onSessionExit: handleSessionExit,
  });

  useEffect(() => {
    cleanupTerminalRef.current = terminalState.cleanupTerminalSession;
  }, [terminalState.cleanupTerminalSession]);

  const onSelectTerminal = useCallback(
    (terminalId: string) => {
      if (!activeWorkspaceId) {
        return;
      }
      setActiveTerminal(activeWorkspaceId, terminalId);
    },
    [activeWorkspaceId, setActiveTerminal]
  );

  const onNewTerminal = useCallback(() => {
    if (!activeWorkspaceId) {
      return;
    }
    createTerminal(activeWorkspaceId);
  }, [activeWorkspaceId, createTerminal]);

  const onCloseTerminal = useCallback(
    (terminalId: string) => {
      if (!activeWorkspaceId) {
        return;
      }
      const shouldClosePanel = terminalTabs.length === 1 && terminalTabs[0]?.id === terminalId;
      closeTerminal(activeWorkspaceId, terminalId);
      if (shouldClosePanel) {
        onCloseTerminalPanel?.();
      }
    },
    [activeWorkspaceId, closeTerminal, onCloseTerminalPanel, terminalTabs]
  );

  const restartTerminalSession = useCallback(
    async (workspaceId: string, terminalId: string) => {
      cleanupTerminalRef.current?.(workspaceId, terminalId);
      try {
        await closeTerminalSession(workspaceId, terminalId);
      } catch (error) {
        if (!shouldIgnoreTerminalCloseError(error)) {
          onDebug(buildErrorDebugEntry("terminal close error", error));
          throw error;
        }
      }
    },
    [onDebug]
  );

  return {
    terminalTabs,
    activeTerminalId,
    onSelectTerminal,
    onNewTerminal,
    onCloseTerminal,
    terminalState,
    ensureTerminalWithTitle,
    restartTerminalSession,
  };
}
