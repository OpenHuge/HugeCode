import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { joinClassNames } from "../../../utils/classNames";

export type MainHeaderShellProps = {
  leadingNode?: ReactNode;
  identityNode?: ReactNode;
  actionsNode?: ReactNode;
  className?: string;
};

export function MainHeaderShell({
  leadingNode,
  identityNode,
  actionsNode,
  className,
}: MainHeaderShellProps) {
  const headerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const chromeScope =
      header.closest<HTMLElement>(".main") ??
      header.closest<HTMLElement>('[data-home-page="true"]') ??
      header.closest<HTMLElement>(".compact-panel");

    if (!chromeScope) {
      return;
    }

    const syncHeaderHeight = () => {
      const nextHeight = Math.round(header.getBoundingClientRect().height);
      if (nextHeight > 0) {
        chromeScope.style.setProperty("--main-topbar-height", `${nextHeight}px`);
      }
    };

    syncHeaderHeight();
    const observer = new ResizeObserver(syncHeaderHeight);
    observer.observe(header);
    window.addEventListener("resize", syncHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeaderHeight);
      chromeScope.style.removeProperty("--main-topbar-height");
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className={joinClassNames("main-header", className)}
      data-tauri-drag-region
      data-main-header-surface="kanna-toolbar"
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
