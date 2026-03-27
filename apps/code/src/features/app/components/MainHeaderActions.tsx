import AlignLeft from "lucide-react/dist/esm/icons/align-left";
import Columns2 from "lucide-react/dist/esm/icons/columns-2";
import { memo } from "react";
import type { SidebarToggleProps } from "../../layout/components/SidebarToggleControls";

type MainHeaderActionsProps = {
  centerMode: "chat" | "diff";
  gitDiffViewStyle: "split" | "unified";
  onSelectDiffViewStyle: (style: "split" | "unified") => void;
  sidebarToggleProps: SidebarToggleProps;
};

export const MainHeaderActions = memo(function MainHeaderActions({
  centerMode,
  gitDiffViewStyle,
  onSelectDiffViewStyle,
  sidebarToggleProps: _sidebarToggleProps,
}: MainHeaderActionsProps) {
  if (centerMode !== "diff") {
    return null;
  }

  return (
    <div className="diff-view-toggle">
      <button
        type="button"
        className={`diff-view-toggle-button${gitDiffViewStyle === "split" ? " is-active" : ""}`}
        onClick={() => onSelectDiffViewStyle("split")}
        aria-pressed={gitDiffViewStyle === "split"}
        aria-label="Switch to dual-panel diff"
        title="Dual-panel diff"
        data-desktop-drag-region="false"
      >
        <Columns2 size={14} aria-hidden />
      </button>
      <button
        type="button"
        className={`diff-view-toggle-button${gitDiffViewStyle === "unified" ? " is-active" : ""}`}
        onClick={() => onSelectDiffViewStyle("unified")}
        aria-pressed={gitDiffViewStyle === "unified"}
        aria-label="Switch to single-column diff"
        title="Single-column diff"
        data-desktop-drag-region="false"
      >
        <AlignLeft size={14} aria-hidden />
      </button>
    </div>
  );
});
