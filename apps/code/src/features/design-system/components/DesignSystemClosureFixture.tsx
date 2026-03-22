import { useState } from "react";
import PanelLeft from "lucide-react/dist/esm/icons/panel-left";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import {
  Button,
  IconButton,
  InlineActionRow,
  MetadataList,
  MetadataRow,
  PopoverMenuItem,
  PopoverSurface,
  SectionHeader,
  ShellFrame,
  ShellSection,
  ShellToolbar,
  SplitPanel,
  StatusBadge,
  Text,
  WorkspaceChromePill,
  WorkspaceHeaderAction,
  WorkspaceMenuSection,
  WorkspaceSupportMeta,
} from "../../../design-system";
import { InspectorSectionHeader } from "../../right-panel/RightPanelPrimitives";
import { SettingsCodexAccountsSectionHeader } from "../../settings/components/sections/settings-codex-accounts-card/SettingsCodexAccountsSectionHeader";
import * as styles from "./DesignSystemClosureFixture.css";

export function DesignSystemClosureFixture() {
  const [menuOverlayOpen, setMenuOverlayOpen] = useState(false);
  const [panelOverlayOpen, setPanelOverlayOpen] = useState(false);

  return (
    <main className={styles.page} data-visual-fixture="design-system-closure">
      <ShellFrame className={styles.stack} tone="elevated" padding="lg">
        <ShellToolbar
          leading={<Text tone="muted">Design-System Closure</Text>}
          trailing={
            <div className={styles.actionRow}>
              <StatusBadge tone="success">shared chrome</StatusBadge>
              <Button variant="secondary">Run guards</Button>
            </div>
          }
        >
          <Text weight="semibold">apps/code fixture host</Text>
        </ShellToolbar>

        <SplitPanel
          leading={
            <nav className={styles.nav} aria-label="Closure phases">
              <SectionHeader
                title="Closure phases"
                meta="Shell, row/meta, chip, overlay"
                actions={
                  <IconButton
                    aria-label="Open closure navigation options"
                    variant="ghost"
                    size="iconSm"
                    icon={<PanelLeft size={14} aria-hidden />}
                  />
                }
              />
              <Button variant="ghost">Shell</Button>
              <Button variant="ghost">Row / Meta</Button>
              <Button variant="ghost">Chip</Button>
              <Button variant="ghost">Overlay</Button>
            </nav>
          }
          trailing={
            <div className={styles.detail}>
              <ShellSection
                title="Shared grammar"
                meta="Root-barrel only"
                actions={<StatusBadge tone="default">fixture</StatusBadge>}
              >
                <div className={styles.metaGrid}>
                  <MetadataList aria-label="Closure metadata">
                    <MetadataRow label="Token source" value="packages/design-system" />
                    <MetadataRow label="Legacy bridge" value="apps/code dsAliases only" />
                    <MetadataRow label="Overlay contract" value="shared Popover / Dialog" />
                  </MetadataList>
                  <InlineActionRow
                    label="Execution chrome"
                    description="Mission Control, Review Pack, Sidebar, Home, Composer"
                    action={<Button variant="secondary">Inspect coverage</Button>}
                  />
                </div>
              </ShellSection>

              <ShellSection
                title="Overlay contract"
                meta="Enter motion + hit area"
                actions={<StatusBadge tone="success">WCAG-aware</StatusBadge>}
              >
                <div className={styles.actionRow}>
                  <Button
                    variant={menuOverlayOpen ? "primary" : "secondary"}
                    onClick={() => setMenuOverlayOpen((current) => !current)}
                  >
                    Preview menu overlay
                  </Button>
                  <Button
                    variant={panelOverlayOpen ? "primary" : "secondary"}
                    onClick={() => setPanelOverlayOpen((current) => !current)}
                  >
                    Preview panel overlay
                  </Button>
                </div>
                <div className={styles.overlayGrid}>
                  {menuOverlayOpen ? (
                    <PopoverSurface aria-label="Closure overlay preview" role="menu">
                      <WorkspaceMenuSection
                        label="Workspace menu section"
                        description="Shared overlay sections replace page-local label spacing."
                      >
                        <div className={styles.popoverStack}>
                          <PopoverMenuItem icon={<Sparkles size={14} />}>
                            Open fixture audit
                          </PopoverMenuItem>
                          <PopoverMenuItem active>Review DTCG artifacts</PopoverMenuItem>
                          <PopoverMenuItem>Check import boundaries</PopoverMenuItem>
                        </div>
                      </WorkspaceMenuSection>
                    </PopoverSurface>
                  ) : null}
                  {panelOverlayOpen ? (
                    <PopoverSurface aria-label="Closure panel preview" role="dialog">
                      <WorkspaceMenuSection
                        label="Panel overlay"
                        description="Non-modal panels keep focus paths stable without page-local chrome."
                      >
                        <div className={styles.panelPreview}>
                          <Text weight="semibold">Launch readiness</Text>
                          <Text size="fine" tone="muted">
                            Non-modal panel overlays keep focus legible without page-local chrome.
                          </Text>
                          <WorkspaceSupportMeta label="panel surface" tone="progress" />
                        </div>
                      </WorkspaceMenuSection>
                    </PopoverSurface>
                  ) : null}
                </div>
              </ShellSection>

              <ShellSection
                title="Workspace chrome sample"
                meta="Topbar pill contract"
                actions={<StatusBadge tone="success">pill family</StatusBadge>}
              >
                <div className={styles.workspaceChromeSample}>
                  <Text weight="semibold">Project Alpha</Text>
                  <div className={styles.workspaceChromeRow}>
                    <WorkspaceChromePill
                      className="workspace-branch-pill"
                      label={<span className="workspace-branch">main</span>}
                      trailing={
                        <span className="workspace-branch-caret" aria-hidden>
                          ›
                        </span>
                      }
                    />
                    <div className="workspace-thread-strip">
                      <WorkspaceChromePill
                        className="workspace-thread-summary-pill"
                        aria-label="Recent threads"
                        leading={
                          <span
                            className="workspace-thread-chip-status processing"
                            data-status-tone="progress"
                            aria-hidden
                          />
                        }
                        label={
                          <span className="workspace-thread-summary-label">
                            Fix runtime startup
                          </span>
                        }
                        meta={<span className="workspace-thread-summary-count">+2</span>}
                      />
                    </div>
                    <WorkspaceSupportMeta
                      className="workspace-thread-chip"
                      data-workspace-chrome="pill"
                      tone="success"
                      label="Live"
                    />
                  </div>
                  <div className={styles.workspaceChromeRow}>
                    <WorkspaceHeaderAction segment="leading">
                      <span className="open-app-label">VS Code</span>
                    </WorkspaceHeaderAction>
                    <WorkspaceHeaderAction segment="trailing" active aria-label="Select editor">
                      <span aria-hidden>⌄</span>
                    </WorkspaceHeaderAction>
                  </div>
                </div>
              </ShellSection>

              <ShellSection
                title="Consumer migration"
                meta="Inspector + Settings samples"
                actions={<StatusBadge tone="progress">in progress</StatusBadge>}
              >
                <div className={styles.consumerStack}>
                  <div className={styles.consumerSample}>
                    <Text weight="semibold">Settings section sample</Text>
                    <SettingsCodexAccountsSectionHeader
                      title="Codex accounts"
                      description="Review account health and default routing."
                      onRefresh={() => undefined}
                      refreshing={false}
                      onClose={() => undefined}
                    />
                  </div>
                  <div className={styles.consumerSample}>
                    <Text weight="semibold">Inspector section sample</Text>
                    <InspectorSectionHeader
                      title="Published evidence"
                      subtitle="Shared section-header grammar now anchors inspector detail."
                      actions={<StatusBadge tone="success">shared</StatusBadge>}
                    />
                  </div>
                </div>
              </ShellSection>
            </div>
          }
        />
      </ShellFrame>
    </main>
  );
}
