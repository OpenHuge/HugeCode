import Folder from "lucide-react/dist/esm/icons/folder";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import { type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "../../../design-system";

export type PanelTabId = "git" | "files" | "atlas" | "prompts";

type PanelTab = {
  id: PanelTabId;
  label: string;
  icon: ReactNode;
};

type PanelTabsProps = {
  active: PanelTabId;
  onSelect: (id: PanelTabId) => void;
  tabs?: PanelTab[];
};

const defaultTabs: PanelTab[] = [
  { id: "git", label: "Git", icon: <GitBranch aria-hidden /> },
  { id: "files", label: "Files", icon: <Folder aria-hidden /> },
  { id: "prompts", label: "Prompts", icon: <ScrollText aria-hidden /> },
];

export function PanelTabs({ active, onSelect, tabs = defaultTabs }: PanelTabsProps) {
  const activeTab = tabs.some((tab) => tab.id === active) ? active : (tabs[0]?.id ?? active);

  const handleValueChange = (value: string) => {
    const nextTab = tabs.find((tab) => tab.id === value);
    if (nextTab) {
      onSelect(nextTab.id);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleValueChange}>
      <TabsList
        className="panel-tabs"
        aria-label="Panel"
        aria-orientation="horizontal"
        data-orientation="horizontal"
        data-activation-mode="automatic"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={`panel-tab${isActive ? " is-active" : ""}`}
              aria-label={tab.label}
              title={tab.label}
            >
              <span className="panel-tab-icon" aria-hidden>
                {tab.icon}
              </span>
              <span className="panel-tab-label" aria-hidden>
                {tab.label}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
