import { useLayoutEffect, useRef, type ReactNode } from "react";

type MissionCenterProps = {
  activeWorkspace: boolean;
  activeThreadId?: string | null;
  scrollMessagesToBottomOnThreadChange?: boolean;
  topbarLeftNode: ReactNode;
  missionOverviewNode?: ReactNode;
  messagesNode: ReactNode;
  composerNode: ReactNode;
  emptyNode: ReactNode;
  contentClassName?: string;
};

export function MissionCenter({
  activeWorkspace,
  activeThreadId = null,
  scrollMessagesToBottomOnThreadChange = false,
  topbarLeftNode,
  missionOverviewNode,
  messagesNode,
  composerNode,
  emptyNode,
  contentClassName,
}: MissionCenterProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousThreadIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const previousThreadId = previousThreadIdRef.current;
    previousThreadIdRef.current = activeThreadId;
    if (!activeThreadId || activeThreadId === previousThreadId) {
      return;
    }
    if (typeof contentRef.current?.scrollIntoView !== "function") {
      return;
    }
    contentRef.current.scrollIntoView({
      block: "start",
    });
    if (!scrollMessagesToBottomOnThreadChange) {
      return;
    }
    const scrollMessagesToBottom = () => {
      const messagesRoot =
        contentRef.current?.querySelector<HTMLElement>('[data-testid="messages-root"]') ?? null;
      if (!messagesRoot) {
        return;
      }
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(scrollMessagesToBottom);
      return;
    }
    scrollMessagesToBottom();
  }, [activeThreadId, scrollMessagesToBottomOnThreadChange]);

  if (!activeWorkspace) {
    return emptyNode;
  }

  return (
    <>
      {topbarLeftNode}
      {missionOverviewNode}
      <div ref={contentRef} className={contentClassName} data-testid="mission-center-content">
        {messagesNode}
      </div>
      {composerNode}
    </>
  );
}
