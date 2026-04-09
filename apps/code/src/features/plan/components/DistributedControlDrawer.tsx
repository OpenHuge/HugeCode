import X from "lucide-react/dist/esm/icons/x";
import { useState } from "react";
import type { DistributedTaskGraphNode } from "../../../application/runtime/types/distributedTaskGraph";
import { Button, StatusBadge } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import { KeyValueRow, PropertyGrid } from "../../right-panel/RightPanelPrimitives";
import * as styles from "./DistributedTaskGraphPanel.css";
import { getDistributedTaskGraphStatusTone } from "./distributedTaskGraphStatus";

type DistributedControlDrawerProps = {
  node: DistributedTaskGraphNode | null;
  isOpen: boolean;
  actionsEnabled?: boolean;
  disabledReason?: string | null;
  onClose: () => void;
  onRetryNode?: (nodeId: string) => Promise<void>;
  onInterruptNode?: (nodeId: string) => Promise<void>;
  onInterruptSubtree?: (nodeId: string) => Promise<void>;
  onForceReroute?: (nodeId: string) => Promise<void>;
};

type ControlAction = "retry" | "interrupt" | "interruptSubtree" | "forceReroute";

function actionLabel(action: ControlAction): string {
  if (action === "retry") {
    return "Retry";
  }
  if (action === "interrupt") {
    return "Interrupt";
  }
  if (action === "interruptSubtree") {
    return "Interrupt Subtree";
  }
  return "Force Reroute";
}

function actionConfirmation(action: ControlAction, label: string): string {
  if (action === "retry") {
    return `Retry node '${label}' now?`;
  }
  if (action === "interrupt") {
    return `Interrupt node '${label}' now?`;
  }
  if (action === "interruptSubtree") {
    return `Interrupt subtree rooted at '${label}' now?`;
  }
  return `Force reroute for '${label}' now?`;
}

export function DistributedControlDrawer({
  node,
  isOpen,
  actionsEnabled = false,
  disabledReason = null,
  onClose,
  onRetryNode,
  onInterruptNode,
  onInterruptSubtree,
  onForceReroute,
}: DistributedControlDrawerProps) {
  const [pendingAction, setPendingAction] = useState<ControlAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !node) {
    return null;
  }

  const handleAction = async (action: ControlAction): Promise<void> => {
    if (!actionsEnabled) {
      return;
    }

    const confirmed = globalThis.confirm?.(actionConfirmation(action, node.title));
    if (confirmed === false) {
      return;
    }

    setActionError(null);
    setPendingAction(action);

    try {
      if (action === "retry") {
        await onRetryNode?.(node.id);
      } else if (action === "interruptSubtree") {
        await onInterruptSubtree?.(node.id);
      } else if (action === "forceReroute") {
        await onForceReroute?.(node.id);
      } else {
        await onInterruptNode?.(node.id);
      }
    } catch {
      // Roll back optimistic pending state when runtime action fails.
      setActionError(`Failed to ${action} node '${node.title}'.`);
    } finally {
      setPendingAction(null);
    }
  };

  const controlsDisabled = !actionsEnabled || pendingAction !== null;
  const disabledMessage =
    disabledReason ?? "Control actions are disabled until Track B runtime integration.";
  const actionHandlers: Record<ControlAction, ((nodeId: string) => Promise<void>) | undefined> = {
    retry: onRetryNode,
    interrupt: onInterruptNode,
    interruptSubtree: onInterruptSubtree,
    forceReroute: onForceReroute,
  };

  return (
    <aside className={styles.drawer} data-testid="distributed-control-drawer">
      <div className={styles.drawerHeader}>
        <div className={styles.drawerHeaderCopy}>
          <div className={styles.drawerEyebrow}>Node controls</div>
          <div className={styles.drawerTitle}>{node.title}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={styles.nodeControl}
          aria-label="Close distributed control drawer"
          onClick={onClose}
        >
          <X size={14} aria-hidden />
        </Button>
      </div>

      <StatusBadge tone={getDistributedTaskGraphStatusTone(node.status)}>{node.status}</StatusBadge>

      <PropertyGrid>
        <KeyValueRow label="Backend" value={node.backendLabel ?? node.backendId ?? "unassigned"} />
        <KeyValueRow label="Queue" value={node.queueDepth ?? "-"} />
      </PropertyGrid>

      <div className={styles.drawerActions}>
        {(["retry", "interrupt", "interruptSubtree", "forceReroute"] as ControlAction[]).map(
          (action) => {
            const actionDisabled = controlsDisabled || !actionHandlers[action];
            return (
              <Button
                key={action}
                variant="secondary"
                size="sm"
                className={styles.actionButton}
                disabled={actionDisabled}
                title={actionDisabled ? disabledMessage : undefined}
                onClick={() => {
                  void handleAction(action);
                }}
              >
                {pendingAction === action ? `${actionLabel(action)}...` : actionLabel(action)}
              </Button>
            );
          }
        )}
      </div>

      {disabledReason ? <div className={styles.helperText}>{disabledReason}</div> : null}
      {actionError ? (
        <div className={joinClassNames(styles.helperText, styles.helperTextError)}>
          {actionError}
        </div>
      ) : null}
    </aside>
  );
}
