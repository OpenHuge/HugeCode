import { ChevronLeft } from "lucide-react";
import { SplitPanel, Surface } from "@ku0/design-system";
import type { ReactNode } from "react";
import { SettingsNav } from "./SettingsNav";
import * as styles from "./SettingsScaffold.css";
import type { CodexSection } from "./settingsShellTypes";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type SettingsScaffoldProps = {
  useMobileMasterDetail: boolean;
  showMobileDetail: boolean;
  sidebar: ReactNode | null;
  content: ReactNode | null;
};

export type SettingsSidebarNavProps = {
  activeSection: CodexSection;
  onSelectSection: (section: CodexSection) => void;
  showDisclosure: boolean;
};

export type SettingsContentFrameProps = {
  activeSectionLabel: string;
  showMobileHeader: boolean;
  onBackToSections: () => void;
  children: ReactNode;
};

export function SettingsScaffold({
  content,
  showMobileDetail,
  sidebar,
  useMobileMasterDetail,
}: SettingsScaffoldProps) {
  return (
    <div
      className={cx(
        styles.scaffold,
        useMobileMasterDetail && styles.mobileMasterDetail,
        showMobileDetail && styles.detailVisible
      )}
      data-settings-scaffold="true"
      data-mobile-master-detail={String(useMobileMasterDetail)}
      data-detail-visible={String(showMobileDetail)}
    >
      <SplitPanel
        className={styles.splitPanel}
        leading={<div className={styles.sidebarSlot}>{sidebar}</div>}
        trailing={<div className={styles.detailSlot}>{content}</div>}
      />
    </div>
  );
}

export function SettingsSidebarNav({
  activeSection,
  onSelectSection,
  showDisclosure,
}: SettingsSidebarNavProps) {
  return (
    <div className={styles.sidebarNav} data-settings-sidebar-nav="true">
      <Surface className={styles.sidebarSurface} tone="subtle" padding="md">
        <div className={styles.sidebarSummaryLabel}>Workspace defaults</div>
        <div className={styles.sidebarSummaryTitle}>
          Keep the app calm, predictable, and ready before you start a run.
        </div>
      </Surface>
      <SettingsNav
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        showDisclosure={showDisclosure}
      />
      <Surface
        className={cx(styles.sidebarSurface, styles.sidebarFooter)}
        tone="subtle"
        padding="md"
      >
        <div className={styles.sidebarSummaryLabel}>Applies instantly</div>
        <div className={styles.sidebarFooterCopy}>
          Changes stay local to this app unless a section says otherwise.
        </div>
      </Surface>
    </div>
  );
}

export function SettingsContentFrame({
  activeSectionLabel,
  children,
  onBackToSections,
  showMobileHeader,
}: SettingsContentFrameProps) {
  return (
    <Surface className={styles.contentSurface} padding="none" data-settings-content-frame="true">
      {showMobileHeader ? (
        <div className={styles.mobileDetailHeader} data-settings-mobile-detail-header="true">
          <button
            type="button"
            className={styles.mobileBack}
            onClick={onBackToSections}
            aria-label="Back to settings sections"
          >
            <ChevronLeft aria-hidden className={styles.mobileBackIcon} />
            Sections
          </button>
          <div className={styles.mobileDetailTitle}>{activeSectionLabel}</div>
        </div>
      ) : null}
      <div className={styles.contentScroll}>
        <div className={styles.contentInner}>{children}</div>
      </div>
    </Surface>
  );
}
