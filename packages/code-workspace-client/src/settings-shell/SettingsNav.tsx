import {
  ArrowUpRightFromSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  GitBranch,
  Keyboard,
  Layers,
  LayoutGrid,
  ServerCog,
  SlidersHorizontal,
  TerminalSquare,
} from "lucide-react";
import { PanelNavItem, PanelNavList } from "@ku0/design-system";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import {
  ADVANCED_SETTINGS_SECTIONS,
  INTERNAL_SETTINGS_SECTIONS,
  PRIMARY_SETTINGS_SECTIONS,
  SETTINGS_SECTION_LABELS,
} from "./settingsShellConstants";
import type { CodexSection } from "./settingsShellTypes";

export type SettingsNavProps = {
  activeSection: CodexSection;
  onSelectSection: (section: CodexSection) => void;
  showDisclosure?: boolean;
  className?: string;
};

const SETTINGS_SECTION_ICONS: Record<CodexSection, ReactNode> = {
  projects: <LayoutGrid aria-hidden />,
  environments: <Layers aria-hidden />,
  display: <SlidersHorizontal aria-hidden />,
  composer: <FileText aria-hidden />,
  shortcuts: <Keyboard aria-hidden />,
  "open-apps": <ArrowUpRightFromSquare aria-hidden />,
  git: <GitBranch aria-hidden />,
  server: <ServerCog aria-hidden />,
  codex: <TerminalSquare aria-hidden />,
  features: <FlaskConical aria-hidden />,
};

const ADVANCED_SETTINGS_SECTION_SET = new Set<CodexSection>(ADVANCED_SETTINGS_SECTIONS);
const INTERNAL_SETTINGS_SECTION_SET = new Set<CodexSection>(INTERNAL_SETTINGS_SECTIONS);

export function SettingsNav({
  activeSection,
  className,
  onSelectSection,
  showDisclosure = false,
}: SettingsNavProps) {
  const advancedGroupId = useId();
  const activeAdvancedSection = ADVANCED_SETTINGS_SECTION_SET.has(activeSection);
  const [showAdvanced, setShowAdvanced] = useState(activeAdvancedSection);
  const internalGroupId = useId();
  const activeInternalSection = INTERNAL_SETTINGS_SECTION_SET.has(activeSection);
  const [showInternal, setShowInternal] = useState(activeInternalSection);

  useEffect(() => {
    if (activeAdvancedSection) {
      setShowAdvanced(true);
    }
  }, [activeAdvancedSection]);

  useEffect(() => {
    if (activeInternalSection) {
      setShowInternal(true);
    }
  }, [activeInternalSection]);

  return (
    <nav aria-label="Settings sections" className={className}>
      <PanelNavList className="settings-nav-list">
        <div className="settings-nav-section-label">Core workflow</div>
        {PRIMARY_SETTINGS_SECTIONS.map((section) => (
          <PanelNavItem
            key={section}
            className="settings-nav"
            icon={SETTINGS_SECTION_ICONS[section]}
            active={activeSection === section}
            showDisclosure={showDisclosure}
            onClick={() => onSelectSection(section)}
          >
            {SETTINGS_SECTION_LABELS[section]}
          </PanelNavItem>
        ))}
        <div className="settings-nav-group">
          <div className="settings-nav-section-label">Advanced setup</div>
          <PanelNavItem
            className="settings-nav settings-nav-advanced-toggle"
            icon={showAdvanced ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
            active={activeAdvancedSection}
            aria-controls={advancedGroupId}
            aria-expanded={showAdvanced}
            onClick={() => {
              if (activeAdvancedSection) {
                return;
              }
              setShowAdvanced((current) => !current);
            }}
          >
            Advanced
          </PanelNavItem>
          {showAdvanced ? (
            <div className="settings-nav-advanced-items" id={advancedGroupId}>
              {ADVANCED_SETTINGS_SECTIONS.map((section) => (
                <PanelNavItem
                  key={section}
                  className="settings-nav"
                  icon={SETTINGS_SECTION_ICONS[section]}
                  active={activeSection === section}
                  showDisclosure={showDisclosure}
                  onClick={() => onSelectSection(section)}
                >
                  {SETTINGS_SECTION_LABELS[section]}
                </PanelNavItem>
              ))}
            </div>
          ) : null}
        </div>
        <div className="settings-nav-group">
          <div className="settings-nav-section-label">Internal tools</div>
          <PanelNavItem
            className="settings-nav settings-nav-advanced-toggle"
            icon={showInternal ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
            active={activeInternalSection}
            aria-controls={internalGroupId}
            aria-expanded={showInternal}
            onClick={() => {
              if (activeInternalSection) {
                return;
              }
              setShowInternal((current) => !current);
            }}
          >
            Internal tools
          </PanelNavItem>
          {showInternal ? (
            <div className="settings-nav-advanced-items" id={internalGroupId}>
              {INTERNAL_SETTINGS_SECTIONS.map((section) => (
                <PanelNavItem
                  key={section}
                  className="settings-nav"
                  icon={SETTINGS_SECTION_ICONS[section]}
                  active={activeSection === section}
                  showDisclosure={showDisclosure}
                  onClick={() => onSelectSection(section)}
                >
                  {SETTINGS_SECTION_LABELS[section]}
                </PanelNavItem>
              ))}
            </div>
          ) : null}
        </div>
      </PanelNavList>
    </nav>
  );
}
