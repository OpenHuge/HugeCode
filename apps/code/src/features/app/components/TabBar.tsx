import FolderKanban from "lucide-react/dist/esm/icons/folder-kanban";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import House from "lucide-react/dist/esm/icons/house";
import Lock from "lucide-react/dist/esm/icons/lock";
import MessagesSquare from "lucide-react/dist/esm/icons/messages-square";
import Settings from "lucide-react/dist/esm/icons/settings";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { getPhoneTabDisabledReason, getPhoneTabSelection } from "../../shell/state/shellSelectors";
import { SHELL_TAB_LABELS, type AppTab } from "../../shell/types/shellRoute";

type TabKey = AppTab;

type TabBarProps = {
  activeTab: TabKey;
  hasActiveWorkspace?: boolean;
  onSelect: (tab: TabKey) => void;
};

const tabs: { id: TabKey; label: string; icon: ReactNode }[] = [
  { id: "home", label: SHELL_TAB_LABELS.home, icon: <House className="tabbar-icon" /> },
  {
    id: "workspaces",
    label: SHELL_TAB_LABELS.workspaces,
    icon: <FolderKanban className="tabbar-icon" />,
  },
  {
    id: "missions",
    label: SHELL_TAB_LABELS.missions,
    icon: <MessagesSquare className="tabbar-icon" />,
  },
  { id: "review", label: SHELL_TAB_LABELS.review, icon: <GitBranch className="tabbar-icon" /> },
  {
    id: "settings",
    label: SHELL_TAB_LABELS.settings,
    icon: <Settings className="tabbar-icon" />,
  },
];

const GATED_HINT_DURATION_MS = 2500;

export function TabBar({ activeTab, hasActiveWorkspace = true, onSelect }: TabBarProps) {
  const [gatedHint, setGatedHint] = useState<string | null>(null);
  const gatedHintTimerRef = useRef<number | null>(null);

  const clearGatedHintTimer = useCallback(() => {
    const timerId = gatedHintTimerRef.current;
    if (timerId !== null) {
      window.clearTimeout(timerId);
      gatedHintTimerRef.current = null;
    }
  }, []);

  const showGatedHint = useCallback(
    (reason: string | null) => {
      clearGatedHintTimer();
      if (!reason) {
        setGatedHint(null);
        return;
      }
      setGatedHint(reason);
      gatedHintTimerRef.current = window.setTimeout(() => {
        gatedHintTimerRef.current = null;
        setGatedHint(null);
      }, GATED_HINT_DURATION_MS);
    },
    [clearGatedHintTimer]
  );

  useEffect(() => () => clearGatedHintTimer(), [clearGatedHintTimer]);

  useEffect(() => {
    if (hasActiveWorkspace) {
      clearGatedHintTimer();
      setGatedHint(null);
    }
  }, [clearGatedHintTimer, hasActiveWorkspace]);

  return (
    <nav className="tabbar" aria-label="Primary">
      {tabs.map((tab) => {
        const gatedReason = getPhoneTabDisabledReason(tab.id, hasActiveWorkspace);
        const gated = gatedReason !== null;
        const nextTab = getPhoneTabSelection(tab.id, hasActiveWorkspace);
        return (
          <button
            key={tab.id}
            type="button"
            className={`tabbar-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => {
              onSelect(nextTab);
              showGatedHint(gatedReason);
            }}
            aria-current={activeTab === tab.id ? "page" : undefined}
            title={gatedReason ?? undefined}
            data-gated={gated ? "true" : undefined}
          >
            <span className="tabbar-icon-wrap">
              {tab.icon}
              {gated ? <Lock size={10} className="tabbar-lock" aria-hidden /> : null}
            </span>
            <span className="tabbar-label">{tab.label}</span>
          </button>
        );
      })}
      {gatedHint ? (
        <output className="tabbar-hint tabbar-label" aria-live="polite">
          {gatedHint}
        </output>
      ) : null}
    </nav>
  );
}
