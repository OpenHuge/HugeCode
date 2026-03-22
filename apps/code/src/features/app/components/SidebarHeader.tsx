import { Button, Icon } from "../../../design-system";
import CalendarClock from "lucide-react/dist/esm/icons/calendar-clock";
import Clock from "lucide-react/dist/esm/icons/clock";
import FolderPlus from "lucide-react/dist/esm/icons/folder-plus";
import House from "lucide-react/dist/esm/icons/house";
import ListFilter from "lucide-react/dist/esm/icons/list-filter";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Search from "lucide-react/dist/esm/icons/search";
import { memo, type ReactNode, useRef, useState } from "react";
import { PopoverMenuItem, PopoverSurface } from "../../../design-system";
import type { ThreadListSortKey } from "../../../types";
import { PanelSplitToggleIcon } from "../../layout/components/PanelSplitToggleIcon";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";
import { SidebarHeaderFrame } from "./SidebarScaffold";

type SidebarHeaderProps = {
  onSelectHome: () => void;
  onPrimaryAction: () => void;
  onCollapseSidebar?: (() => void) | undefined;
  onToggleSearch: () => void;
  isSearchOpen: boolean;
  threadListSortKey: ThreadListSortKey;
  onSetThreadListSortKey: (sortKey: ThreadListSortKey) => void;
  onRefreshAllThreads: () => void;
  refreshDisabled: boolean;
  refreshInProgress: boolean;
  primaryActionLabel?: string;
  primaryActionTitle?: string;
  primaryActionIcon?: ReactNode;
};

export const SidebarHeader = memo(function SidebarHeader({
  onSelectHome,
  onPrimaryAction,
  onCollapseSidebar,
  onToggleSearch,
  isSearchOpen,
  threadListSortKey,
  onSetThreadListSortKey,
  onRefreshAllThreads,
  refreshDisabled,
  refreshInProgress,
  primaryActionLabel = "New project",
  primaryActionTitle = "New project",
  primaryActionIcon = <Icon icon={FolderPlus} size={16} />,
}: SidebarHeaderProps) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  useDismissibleMenu({
    isOpen: filterMenuOpen,
    containerRef: filterMenuRef,
    additionalRefs: [filterButtonRef],
    onClose: () => setFilterMenuOpen(false),
  });

  return (
    <SidebarHeaderFrame
      className="sidebar-header"
      data-tauri-drag-region="true"
      data-sidebar-header-surface="kanna-card"
    >
      <div className="sidebar-header-start">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSelectHome}
          title="Home"
          className="sidebar-action sidebar-home-action"
          aria-label="Go to Home"
          data-testid="sidebar-home-toggle"
        >
          <Icon icon={House} size={15} />
        </Button>
      </div>
      <div className="sidebar-header-actions">
        {onCollapseSidebar ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapseSidebar}
            title="Hide sidebar"
            className="sidebar-action"
            aria-label="Hide sidebar"
            data-testid="sidebar-collapse-toggle"
          >
            <PanelSplitToggleIcon side="left" active title="Hide sidebar" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrimaryAction}
          title={primaryActionTitle}
          className="sidebar-action"
          aria-label={primaryActionLabel}
          data-testid="sidebar-primary-action"
        >
          {primaryActionIcon}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSearch}
          title="Search projects (Cmd+K)"
          aria-label="Toggle search"
          data-testid="sidebar-search-toggle"
          className={`sidebar-action${isSearchOpen ? " is-active" : ""}`}
        >
          <Icon icon={Search} size={15} />
        </Button>
        <div className="sidebar-action-wrapper">
          <Button
            ref={filterButtonRef}
            variant="ghost"
            size="icon"
            onClick={() => setFilterMenuOpen((prev) => !prev)}
            title="Sort threads"
            className={`sidebar-action${filterMenuOpen ? " is-active" : ""}`}
            aria-label="Sort threads"
            aria-expanded={filterMenuOpen}
            data-testid="sidebar-sort-toggle"
          >
            <Icon icon={ListFilter} size={15} />
          </Button>
          {filterMenuOpen && (
            <PopoverSurface
              ref={filterMenuRef}
              className="sidebar-filter-menu"
              role="menu"
              aria-label="Organize threads"
              data-testid="sidebar-sort-menu"
            >
              <div className="sidebar-filter-menu-label">Sort by</div>
              <PopoverMenuItem
                icon={<Icon icon={Clock} size={14} />}
                onClick={() => {
                  onSetThreadListSortKey("created_at");
                  setFilterMenuOpen(false);
                }}
                role="menuitemradio"
                aria-checked={threadListSortKey === "created_at"}
                aria-label="Created"
                data-testid="sidebar-sort-created-at"
              >
                Created
              </PopoverMenuItem>
              <PopoverMenuItem
                icon={<Icon icon={CalendarClock} size={14} />}
                onClick={() => {
                  onSetThreadListSortKey("updated_at");
                  setFilterMenuOpen(false);
                }}
                role="menuitemradio"
                aria-checked={threadListSortKey === "updated_at"}
                aria-label="Updated"
                data-testid="sidebar-sort-updated-at"
              >
                Updated
              </PopoverMenuItem>
              <div className="sidebar-filter-menu-divider" aria-hidden />
              <PopoverMenuItem
                icon={
                  <Icon
                    icon={RefreshCw}
                    size={14}
                    className={refreshInProgress ? "ds-animate-spin spinning" : ""}
                  />
                }
                onClick={() => {
                  onRefreshAllThreads();
                  if (!refreshDisabled && !refreshInProgress) {
                    setFilterMenuOpen(false);
                  }
                }}
                disabled={refreshDisabled || refreshInProgress}
                aria-label="Refresh all workspace threads"
                data-testid="sidebar-refresh-all"
              >
                Refresh threads
              </PopoverMenuItem>
            </PopoverSurface>
          )}
        </div>
      </div>
    </SidebarHeaderFrame>
  );
});
