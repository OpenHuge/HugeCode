import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { StatusBadge } from "../../../design-system";
import type { TerminalStatus } from "../../../types";
import type { TerminalTab } from "../hooks/useTerminalTabs";

type TerminalDockProps = {
  isOpen: boolean;
  terminals: TerminalTab[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (terminalId: string) => void;
  onClearActiveTerminal?: () => void;
  onRestartActiveTerminal?: () => void;
  onInterruptActiveTerminal?: () => void;
  canClearActiveTerminal?: boolean;
  canRestartActiveTerminal?: boolean;
  canInterruptActiveTerminal?: boolean;
  sessionStatus?: TerminalStatus | null;
  onResizeStart?: (event: ReactMouseEvent) => void;
  terminalNode: ReactNode;
};

export function TerminalDock({
  isOpen,
  terminals,
  activeTerminalId,
  onSelectTerminal,
  onNewTerminal,
  onCloseTerminal,
  onClearActiveTerminal,
  onRestartActiveTerminal,
  onInterruptActiveTerminal,
  canClearActiveTerminal = false,
  canRestartActiveTerminal = false,
  canInterruptActiveTerminal = false,
  sessionStatus = null,
  onResizeStart,
  terminalNode,
}: TerminalDockProps) {
  if (!isOpen) {
    return null;
  }

  const resolvedStatus = sessionStatus ?? "idle";
  const statusLabel =
    resolvedStatus === "ready"
      ? "Ready"
      : resolvedStatus === "connecting"
        ? "Connecting"
        : resolvedStatus === "error"
          ? "Error"
          : "Idle";
  const statusTone =
    resolvedStatus === "ready"
      ? "success"
      : resolvedStatus === "connecting"
        ? "warning"
        : resolvedStatus === "error"
          ? "error"
          : "default";

  return (
    <section className="terminal-panel">
      {onResizeStart && (
        <hr
          className="terminal-panel-resizer"
          aria-label="Resize terminal panel"
          onMouseDown={onResizeStart}
        />
      )}
      <div className="terminal-header">
        <div className="terminal-tabs" role="tablist" aria-label="Terminal tabs">
          {terminals.map((tab) => (
            <div
              key={tab.id}
              className={`terminal-tab${tab.id === activeTerminalId ? " active" : ""}`}
              role="presentation"
            >
              <button
                className="terminal-tab-select"
                type="button"
                role="tab"
                aria-selected={tab.id === activeTerminalId}
                onClick={() => onSelectTerminal(tab.id)}
              >
                <span className="terminal-tab-label">{tab.title}</span>
              </button>
              <button
                type="button"
                className="terminal-tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTerminal(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="terminal-tab-add"
            type="button"
            onClick={onNewTerminal}
            aria-label="New terminal"
            title="New terminal"
          >
            +
          </button>
        </div>
        <div className="terminal-header-actions">
          <StatusBadge className="terminal-status-badge" tone={statusTone}>
            {statusLabel}
          </StatusBadge>
          {onClearActiveTerminal && (
            <button
              type="button"
              className="terminal-header-action"
              onClick={onClearActiveTerminal}
              disabled={!canClearActiveTerminal}
              aria-label="Clear terminal output"
              title="Clear terminal output"
            >
              Clear
            </button>
          )}
          {onRestartActiveTerminal && (
            <button
              type="button"
              className="terminal-header-action"
              onClick={onRestartActiveTerminal}
              disabled={!canRestartActiveTerminal}
              aria-label="Restart terminal session"
              title="Restart terminal session"
            >
              Restart
            </button>
          )}
          {onInterruptActiveTerminal && (
            <button
              type="button"
              className="terminal-header-action"
              onClick={onInterruptActiveTerminal}
              disabled={!canInterruptActiveTerminal}
              aria-label="Interrupt terminal session"
              title="Interrupt terminal session"
            >
              Interrupt
            </button>
          )}
        </div>
      </div>
      <div className="terminal-body">{terminalNode}</div>
    </section>
  );
}
