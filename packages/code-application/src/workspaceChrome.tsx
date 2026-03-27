import { type ReactNode, useLayoutEffect, useRef } from "react";

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export type WorkspaceChromeHeaderProps = {
  leadingNode?: ReactNode;
  identityNode?: ReactNode;
  actionsNode?: ReactNode;
  className?: string;
};

function syncMainHeaderHeight(header: HTMLElement) {
  const chromeScope =
    header.closest<HTMLElement>(".main") ??
    header.closest<HTMLElement>('[data-home-page="true"]') ??
    header.closest<HTMLElement>(".compact-panel");

  if (!chromeScope) {
    return;
  }

  const updateHeight = () => {
    const nextHeight = Math.round(header.getBoundingClientRect().height);
    if (nextHeight > 0) {
      chromeScope.style.setProperty("--main-topbar-height", `${nextHeight}px`);
    }
  };

  updateHeight();
  const observer = new ResizeObserver(updateHeight);
  observer.observe(header);
  window.addEventListener("resize", updateHeight);

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", updateHeight);
    chromeScope.style.removeProperty("--main-topbar-height");
  };
}

export function WorkspaceChromeHeader({
  leadingNode,
  identityNode,
  actionsNode,
  className,
}: WorkspaceChromeHeaderProps) {
  const headerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    return syncMainHeaderHeight(header);
  }, []);

  return (
    <header
      ref={headerRef}
      className={joinClassNames("main-header", className)}
      data-main-header-surface="kanna-toolbar"
      data-workspace-chrome-header="true"
      data-desktop-drag-region
    >
      {leadingNode ? (
        <div className="main-header-leading" data-main-header-leading="true">
          {leadingNode}
        </div>
      ) : null}
      <div className="workspace-header" data-main-header-identity="true">
        {identityNode}
      </div>
      {actionsNode ? (
        <div className="main-header-actions" data-main-header-actions="true">
          {actionsNode}
        </div>
      ) : null}
    </header>
  );
}

export type WorkspaceChromeLayoutProps = {
  sidebarNode: ReactNode;
  sidebarResizeHandleNode?: ReactNode;
  topbarNode?: ReactNode;
  shellOverlaysNode?: ReactNode;
  toastNodes?: ReactNode;
  homeNode?: ReactNode;
  showHome?: boolean;
  showWorkspace?: boolean;
  timelineNode?: ReactNode;
  rightRailResizeHandleNode?: ReactNode;
  rightRailNode?: ReactNode;
  composerNode?: ReactNode;
  terminalDockNode?: ReactNode;
  debugPanelNode?: ReactNode;
  desktopShellClassName?: string;
  sidebarPaneClassName?: string;
  mainPaneClassName?: string;
  mainShellClassName?: string;
};

export function WorkspaceChromeLayout({
  sidebarNode,
  sidebarResizeHandleNode = null,
  topbarNode = null,
  shellOverlaysNode = null,
  toastNodes = null,
  homeNode = null,
  showHome = false,
  showWorkspace = false,
  timelineNode = null,
  rightRailResizeHandleNode = null,
  rightRailNode = null,
  composerNode = null,
  terminalDockNode = null,
  debugPanelNode = null,
  desktopShellClassName,
  sidebarPaneClassName,
  mainPaneClassName,
  mainShellClassName,
}: WorkspaceChromeLayoutProps) {
  return (
    <div
      className={desktopShellClassName}
      data-desktop-shell="kanna-frame"
      data-workspace-chrome-shell="true"
    >
      <div className={sidebarPaneClassName} data-desktop-sidebar-pane="true">
        {sidebarNode}
      </div>
      {sidebarResizeHandleNode}
      <div className={mainPaneClassName} data-desktop-main-pane="true">
        <section className={joinClassNames("main", mainShellClassName)}>
          {toastNodes}
          {showHome ? homeNode : null}
          {showWorkspace ? (
            <>
              {shellOverlaysNode}
              {topbarNode}
              {timelineNode}
              {rightRailResizeHandleNode}
              {rightRailNode}
              {composerNode}
            </>
          ) : null}
          {terminalDockNode}
          {debugPanelNode}
        </section>
      </div>
    </div>
  );
}
