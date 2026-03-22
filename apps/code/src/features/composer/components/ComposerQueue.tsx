import { Button, Icon } from "../../../design-system";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PopoverMenuItem, PopoverSurface } from "../../../design-system";
import { isTauri } from "../../../application/runtime/ports/tauriCore";
import { LogicalPosition } from "../../../application/runtime/ports/tauriDpi";
import { Menu, MenuItem } from "../../../application/runtime/ports/tauriMenu";
import { getCurrentWindow } from "../../../application/runtime/ports/tauriWindow";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { QueuedMessage } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { useDismissibleMenu } from "../../app/hooks/useDismissibleMenu";
import { ComposerQueuePanel } from "./ComposerShell";
import * as styles from "./ComposerQueue.styles.css";

type ComposerQueueProps = {
  queuedMessages: QueuedMessage[];
  queuePausedReason?: string | null;
  onEditQueued?: (item: QueuedMessage) => void;
  onDeleteQueued?: (id: string) => void;
};

const QUEUE_MENU_WIDTH = 180;
const QUEUE_MENU_ITEM_HEIGHT = 32;
const QUEUE_MENU_PADDING = 8;

type QueueMenuAction = {
  label: string;
  run: () => void | Promise<void>;
};

type QueueContextMenuState = {
  actions: QueueMenuAction[];
  top: number;
  left: number;
};

export function ComposerQueue({
  queuedMessages,
  queuePausedReason = null,
  onEditQueued,
  onDeleteQueued,
}: ComposerQueueProps) {
  const [contextMenu, setContextMenu] = useState<QueueContextMenuState | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useDismissibleMenu({
    isOpen: Boolean(contextMenu),
    containerRef: contextMenuRef,
    onClose: () => setContextMenu(null),
  });

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    if (contextMenuRef.current) {
      contextMenuRef.current.style.setProperty("--composer-queue-menu-top", `${contextMenu.top}px`);
      contextMenuRef.current.style.setProperty(
        "--composer-queue-menu-left",
        `${contextMenu.left}px`
      );
    }
    function handleScroll() {
      setContextMenu(null);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  const runContextMenuAction = useCallback(async (action: QueueMenuAction) => {
    setContextMenu(null);
    try {
      await action.run();
    } catch (error) {
      pushErrorToast({
        title: "Couldn’t run queue action",
        message: error instanceof Error ? error.message : "Unable to run queue action.",
      });
    }
  }, []);

  const handleQueueMenu = useCallback(
    async (event: React.MouseEvent, item: QueuedMessage) => {
      event.preventDefault();
      event.stopPropagation();
      const actions: QueueMenuAction[] = [
        {
          label: "Edit",
          run: () => onEditQueued?.(item),
        },
        {
          label: "Delete",
          run: () => onDeleteQueued?.(item.id),
        },
      ];
      if (!isTauri()) {
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const rawX = event.clientX > 0 ? event.clientX : rect.right;
        const rawY = event.clientY > 0 ? event.clientY : rect.bottom;
        const menuHeight =
          QUEUE_MENU_PADDING * 2 + Math.max(actions.length, 1) * QUEUE_MENU_ITEM_HEIGHT;
        const left = Math.min(
          Math.max(rawX, 8),
          Math.max(8, window.innerWidth - QUEUE_MENU_WIDTH - 8)
        );
        const top = Math.min(Math.max(rawY, 8), Math.max(8, window.innerHeight - menuHeight - 8));
        setContextMenu({ actions, left, top });
        return;
      }
      try {
        const { clientX, clientY } = event;
        const items = await Promise.all(
          actions.map((action) =>
            MenuItem.new({
              text: action.label,
              action: () => void action.run(),
            })
          )
        );
        const menu = await Menu.new({ items });
        const window = getCurrentWindow();
        const position = new LogicalPosition(clientX, clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn’t open queue menu",
          message: error instanceof Error ? error.message : "Unable to open queue actions.",
        });
      }
    },
    [onDeleteQueued, onEditQueued]
  );

  if (queuedMessages.length === 0) {
    return null;
  }

  return (
    <>
      <ComposerQueuePanel className={joinClassNames(styles.queue, "composer-queue")}>
        <div className={joinClassNames(styles.queueHeader, "composer-queue-header")}>
          <div className={joinClassNames(styles.queueTitleWrap, "composer-queue-title-wrap")}>
            <span className={joinClassNames(styles.queueTitle, "composer-queue-title")}>
              Queued
            </span>
            <span
              className={joinClassNames(styles.queueCount, "composer-queue-count")}
              title={`${queuedMessages.length} queued`}
            >
              {queuedMessages.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={joinClassNames(
              styles.queueToggle,
              "composer-queue-toggle",
              isExpanded && "is-expanded"
            )}
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse queued messages" : "Expand queued messages"}
            title={isExpanded ? "Collapse queued messages" : "Expand queued messages"}
          >
            <Icon className={styles.queueToggleIcon} icon={ChevronDown} size={13} />
          </Button>
        </div>
        {queuePausedReason ? (
          <div className="composer-queue-paused">{queuePausedReason}</div>
        ) : null}
        {isExpanded && (
          <div className={joinClassNames(styles.queueList, "composer-queue-list")}>
            {queuedMessages.map((item) => (
              <div
                key={item.id}
                className={joinClassNames(styles.queueItem, "composer-queue-item")}
              >
                <span
                  className={joinClassNames(styles.queueLeading, "composer-queue-leading")}
                  aria-hidden
                >
                  <Icon icon={Clock3} size={12} />
                </span>
                <span className={joinClassNames(styles.queueText, "composer-queue-text")}>
                  {item.text ||
                    (item.images?.length
                      ? item.images.length === 1
                        ? "Attachment"
                        : "Attachments"
                      : "")}
                  {item.images?.length
                    ? ` · ${item.images.length} attachment${item.images.length === 1 ? "" : "s"}`
                    : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={joinClassNames(styles.queueMenu, "composer-queue-menu")}
                  onClick={(event) => handleQueueMenu(event, item)}
                  aria-label="Queue item menu"
                >
                  ...
                </Button>
              </div>
            ))}
          </div>
        )}
      </ComposerQueuePanel>
      {contextMenu &&
        createPortal(
          <PopoverSurface
            ref={contextMenuRef}
            className={joinClassNames(styles.queueContextMenu, "composer-queue-context-menu")}
            role="menu"
            aria-label="Queue item actions"
            onContextMenu={(event) => event.preventDefault()}
          >
            {contextMenu.actions.map((action, index) => (
              <PopoverMenuItem
                key={`${action.label}-${index}`}
                className={joinClassNames(
                  styles.queueContextOption,
                  "composer-queue-context-option"
                )}
                onClick={() => void runContextMenuAction(action)}
              >
                {action.label}
              </PopoverMenuItem>
            ))}
          </PopoverSurface>,
          document.body
        )}
    </>
  );
}
