import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PopoverMenuItem, PopoverSurface, WorkspaceChromePill } from "../../../design-system";
import type { ThreadSummary } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { resolveThreadStatusTone } from "../../threads/utils/threadExecutionState";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";
import * as styles from "./RecentThreadStrip.css";

export type RecentThreadStatus =
  | "ready"
  | "processing"
  | "awaitingApproval"
  | "awaitingInput"
  | "planReady"
  | "completed"
  | "reviewing"
  | "unread";

export type RecentThreadItem = {
  thread: ThreadSummary;
  status: RecentThreadStatus;
  isActive: boolean;
};

type RecentThreadStripProps = {
  threads: RecentThreadItem[];
  onSelectThread?: (threadId: string) => void;
};

export function RecentThreadStrip({ threads, onSelectThread }: RecentThreadStripProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeThread = useMemo(
    () => threads.find((item) => item.isActive) ?? threads[0] ?? null,
    [threads]
  );
  const overflowCount = Math.max(threads.length - 1, 0);

  const openMenu = useCallback((focusIndex: number | null = null) => {
    setMenuOpen(true);
    setPendingFocusIndex(focusIndex);
  }, []);

  const closeMenu = useCallback((focusToggle = false) => {
    setMenuOpen(false);
    setPendingFocusIndex(null);
    if (!focusToggle || typeof window === "undefined") {
      return;
    }
    window.requestAnimationFrame(() => {
      toggleRef.current?.focus();
    });
  }, []);

  useDismissibleMenu({
    isOpen: menuOpen,
    containerRef: menuRef,
    onClose: () => closeMenu(false),
  });

  useEffect(() => {
    if (
      !menuOpen ||
      pendingFocusIndex === null ||
      threads.length === 0 ||
      typeof window === "undefined"
    ) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(pendingFocusIndex, threads.length - 1));
    const handle = window.requestAnimationFrame(() => {
      optionRefs.current[nextIndex]?.focus();
      setPendingFocusIndex(null);
    });
    return () => {
      window.cancelAnimationFrame(handle);
    };
  }, [menuOpen, pendingFocusIndex, threads.length]);

  const selectThread = useCallback(
    (threadId: string) => {
      onSelectThread?.(threadId);
      closeMenu(false);
    },
    [closeMenu, onSelectThread]
  );

  const handleToggleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openMenu(0);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        openMenu(Math.max(threads.length - 1, 0));
        return;
      }
      if (event.key === "Escape" && menuOpen) {
        event.preventDefault();
        closeMenu(true);
      }
    },
    [closeMenu, menuOpen, openMenu, threads.length]
  );

  if (threads.length <= 1 || !activeThread) {
    return null;
  }

  return (
    <div className="workspace-thread-strip" ref={menuRef}>
      <WorkspaceChromePill
        ref={toggleRef}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Recent threads"
        onClick={() => (menuOpen ? closeMenu(false) : openMenu(null))}
        onKeyDown={handleToggleKeyDown}
        title={activeThread.thread.name}
        className="workspace-thread-summary-pill"
        leading={
          <span
            className={joinClassNames(
              "workspace-thread-chip-status",
              activeThread.status,
              styles.statusIndicator
            )}
            data-status-tone={resolveThreadStatusTone(activeThread.status)}
            data-thread-strip-status={activeThread.status}
            aria-hidden
          />
        }
        label={<span className="workspace-thread-summary-label">{activeThread.thread.name}</span>}
        meta={<span className="workspace-thread-summary-count">+{overflowCount}</span>}
      />
      {menuOpen ? (
        <PopoverSurface className="workspace-thread-overflow-popover" role="menu">
          {threads.map(({ thread, status, isActive }, index) => (
            <PopoverMenuItem
              key={thread.id}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="menuitem"
              active={isActive}
              className="workspace-thread-overflow-option"
              aria-current={isActive ? "true" : undefined}
              title={thread.name}
              onClick={() => selectThread(thread.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  optionRefs.current[(index + 1) % threads.length]?.focus();
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  optionRefs.current[(index - 1 + threads.length) % threads.length]?.focus();
                  return;
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  optionRefs.current[0]?.focus();
                  return;
                }
                if (event.key === "End") {
                  event.preventDefault();
                  optionRefs.current[threads.length - 1]?.focus();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeMenu(true);
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectThread(thread.id);
                }
              }}
              icon={
                <span
                  className={joinClassNames(
                    "workspace-thread-chip-status",
                    status,
                    styles.statusIndicator
                  )}
                  data-status-tone={resolveThreadStatusTone(status)}
                  data-thread-strip-status={status}
                />
              }
            >
              <span className="workspace-thread-overflow-label">{thread.name}</span>
            </PopoverMenuItem>
          ))}
        </PopoverSurface>
      ) : null}
    </div>
  );
}
