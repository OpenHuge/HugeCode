import { WorkspaceHeaderAction } from "../../../design-system";
import type { ReactNode } from "react";
import { useRef } from "react";
import { PopoverSurface } from "../../../design-system";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";

type LaunchScriptPopoverShellProps = {
  editorOpen: boolean;
  buttonAriaLabel: string;
  buttonTitle: string;
  buttonIcon: ReactNode;
  buttonLabel?: string;
  onRun: () => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  children: ReactNode;
};

export function LaunchScriptPopoverShell({
  editorOpen,
  buttonAriaLabel,
  buttonTitle,
  buttonIcon,
  buttonLabel,
  onRun,
  onOpenEditor,
  onCloseEditor,
  children,
}: LaunchScriptPopoverShellProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useDismissibleMenu({
    isOpen: editorOpen,
    containerRef: popoverRef,
    onClose: onCloseEditor,
  });

  return (
    <div className="launch-script-menu" ref={popoverRef}>
      <div className="launch-script-buttons">
        <WorkspaceHeaderAction
          onClick={onRun}
          onContextMenu={(event) => {
            event.preventDefault();
            onOpenEditor();
          }}
          data-desktop-drag-region="false"
          aria-label={buttonAriaLabel}
          title={buttonTitle}
          icon={buttonIcon}
          segment={buttonLabel ? "single" : "icon"}
        >
          {buttonLabel ? <span className="launch-script-button-label">{buttonLabel}</span> : null}
        </WorkspaceHeaderAction>
      </div>
      {editorOpen ? (
        <PopoverSurface className="launch-script-popover" role="dialog">
          {children}
        </PopoverSurface>
      ) : null}
    </div>
  );
}
