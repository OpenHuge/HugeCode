import type { MouseEvent as ReactMouseEvent } from "react";
import type { DebugEntry } from "../../../types";
import type { DebugPanelBodyProps } from "../components/DebugPanelBody";
import type { DebugPanelShellProps } from "../components/DebugPanelShell";

export type DebugPanelVariant = "dock" | "full";

export type DebugPanelViewModelParams = {
  entries: DebugEntry[];
  isOpen: boolean;
  workspaceId: string | null;
  onClear: () => void;
  onCopy: () => void;
  onResizeStart?: (event: ReactMouseEvent) => void;
  variant: DebugPanelVariant;
};

export type DebugPanelShellViewModelProps = Omit<DebugPanelShellProps, "children">;

export type DebugPanelViewModel = {
  isVisible: boolean;
  shellProps: DebugPanelShellViewModelProps;
  bodyProps: DebugPanelBodyProps;
};
