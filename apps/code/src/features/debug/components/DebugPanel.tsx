import type { MouseEvent as ReactMouseEvent } from "react";
import type { DebugEntry } from "../../../types";
import type { DebugPanelVariant } from "../hooks/useDebugPanelViewModel";
import { useDebugPanelViewModel } from "../hooks/useDebugPanelViewModel";
import { DebugPanelBody } from "./DebugPanelBody";
import { DebugPanelShell } from "./DebugPanelShell";

type DebugPanelProps = {
  entries: DebugEntry[];
  isOpen: boolean;
  workspaceId?: string | null;
  onClear: () => void;
  onCopy: () => void;
  onResizeStart?: (event: ReactMouseEvent) => void;
  variant?: DebugPanelVariant;
};

export function DebugPanel({
  entries,
  isOpen,
  workspaceId = null,
  onClear,
  onCopy,
  onResizeStart,
  variant = "dock",
}: DebugPanelProps) {
  const { isVisible, shellProps, bodyProps } = useDebugPanelViewModel({
    entries,
    isOpen,
    workspaceId,
    onClear,
    onCopy,
    onResizeStart,
    variant,
  });

  if (!isVisible) {
    return null;
  }

  return (
    <DebugPanelShell {...shellProps}>
      <DebugPanelBody {...bodyProps} />
    </DebugPanelShell>
  );
}
