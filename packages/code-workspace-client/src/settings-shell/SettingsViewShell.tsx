import { X } from "lucide-react";
import { Button, StatusBadge } from "@ku0/design-system";
import type { ReactNode } from "react";
import { useMaybeWorkspaceClientBindings } from "../workspace/WorkspaceClientBindingsProvider";
import { SettingsContentFrame, SettingsScaffold, SettingsSidebarNav } from "./SettingsScaffold";
import { SettingsShellModal } from "./SettingsShellModal";
import "./SettingsModalChrome.global.css";
import { SETTINGS_SECTION_LABELS } from "./settingsShellConstants";
import type { CodexSection, SettingsShellFraming } from "./settingsShellTypes";

export type SettingsViewShellProps = {
  activeSection: CodexSection;
  framing: SettingsShellFraming;
  useMobileMasterDetail: boolean;
  showMobileDetail: boolean;
  onClose: () => void;
  onSelectSection: (section: CodexSection) => void;
  onBackToSections: () => void;
  children: ReactNode;
};

export function SettingsViewShell({
  activeSection,
  framing,
  useMobileMasterDetail,
  showMobileDetail,
  onClose,
  onSelectSection,
  onBackToSections,
  children,
}: SettingsViewShellProps) {
  const bindings = useMaybeWorkspaceClientBindings();
  const activeSectionLabel = SETTINGS_SECTION_LABELS[activeSection];
  const resolvedFraming = bindings?.platformUi.settingsShellFraming ?? framing;

  return (
    <SettingsShellModal
      className="settings-overlay settings-overlay--chatgpt"
      cardClassName="settings-window settings-window--chatgpt"
      onBackdropClick={onClose}
      ariaLabelledBy="settings-modal-title"
    >
      <div className="settings-titlebar">
        <div className="settings-header-copy">
          <div className="settings-kicker-row">
            <StatusBadge className="settings-kicker">{resolvedFraming.kickerLabel}</StatusBadge>
            <StatusBadge className="settings-context-chip">
              {resolvedFraming.contextLabel}
            </StatusBadge>
          </div>
          <div className="settings-title" id="settings-modal-title">
            {resolvedFraming.title}
          </div>
          <div className="settings-subtitle">{resolvedFraming.subtitle}</div>
        </div>
        <div className="settings-header-actions">
          {!useMobileMasterDetail ? (
            <StatusBadge className="settings-active-pill" tone="progress">
              {activeSectionLabel}
            </StatusBadge>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <SettingsScaffold
        useMobileMasterDetail={useMobileMasterDetail}
        showMobileDetail={showMobileDetail}
        sidebar={
          !useMobileMasterDetail || !showMobileDetail ? (
            <SettingsSidebarNav
              activeSection={activeSection}
              onSelectSection={onSelectSection}
              showDisclosure={useMobileMasterDetail}
            />
          ) : null
        }
        content={
          !useMobileMasterDetail || showMobileDetail ? (
            <SettingsContentFrame
              activeSectionLabel={activeSectionLabel}
              showMobileHeader={useMobileMasterDetail}
              onBackToSections={onBackToSections}
            >
              {children}
            </SettingsContentFrame>
          ) : null
        }
      />
    </SettingsShellModal>
  );
}
