import { useState } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import FolderCode from "lucide-react/dist/esm/icons/folder-code";
import GitFork from "lucide-react/dist/esm/icons/git-fork";
import PanelLeft from "lucide-react/dist/esm/icons/panel-left";
import Settings from "lucide-react/dist/esm/icons/settings";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import User from "lucide-react/dist/esm/icons/user";
import {
  PopoverMenuItem,
  PopoverSurface,
  ShellFrame,
  ShellSection,
  ShellToolbar,
  SplitPanel,
  Text,
  WorkspaceChromePill,
  WorkspaceHeaderAction,
  WorkspaceMenuSection,
  WorkspaceSupportMeta,
} from "../../../design-system";
import { ComposerWorkspaceFooter } from "../../composer/components/ComposerShell";
import * as styles from "./MainShellClosureFixture.css";

export function MainShellClosureFixture() {
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);

  return (
    <main className={styles.page} data-visual-fixture="main-shell-closure">
      <ShellFrame className={styles.shell} tone="elevated" padding="lg">
        <ShellToolbar
          leading={<Text tone="muted">Main Shell Closure</Text>}
          trailing={<WorkspaceSupportMeta label="adapter-driven chrome" tone="success" />}
        >
          <Text weight="semibold">Home, Header, Sidebar, Composer</Text>
        </ShellToolbar>

        <ShellSection
          title="Topbar chrome"
          meta="Workspace pills + header actions"
          actions={<WorkspaceSupportMeta label="shared shell grammar" />}
        >
          <div className={styles.topbar}>
            <div className={styles.topbarLeading}>
              <WorkspaceChromePill
                aria-label="Workspace branch"
                className="workspace-branch-pill"
                label="main"
                leading={<GitFork size={14} aria-hidden />}
                trailing={
                  <span className="workspace-branch-caret" aria-hidden>
                    ›
                  </span>
                }
              />
              <WorkspaceChromePill
                aria-label="Recent threads"
                className="workspace-thread-summary-pill"
                label="Fix runtime startup"
                meta="+2"
              />
              <WorkspaceSupportMeta label="Live" tone="success" />
            </div>
            <div className={styles.topbarActions}>
              <WorkspaceHeaderAction aria-label="Open in editor" segment="leading">
                <span className="open-app-label">
                  <FolderCode size={14} aria-hidden />
                  VS Code
                </span>
              </WorkspaceHeaderAction>
              <WorkspaceHeaderAction aria-label="Select editor" active segment="trailing">
                <ChevronDown size={14} aria-hidden />
              </WorkspaceHeaderAction>
              <WorkspaceHeaderAction aria-label="Toggle terminal" segment="icon">
                <Terminal size={16} aria-hidden />
              </WorkspaceHeaderAction>
            </div>
          </div>
        </ShellSection>

        <SplitPanel
          className={styles.split}
          leading={
            <ShellSection
              title="Sidebar account menu"
              meta="Menu section + support meta"
              actions={<WorkspaceSupportMeta label="sidebar" tone="progress" />}
            >
              <div className={styles.sidebarCard}>
                <WorkspaceHeaderAction
                  aria-label="Open user menu"
                  active={sidebarMenuOpen}
                  onClick={() => setSidebarMenuOpen((current) => !current)}
                >
                  <User size={16} aria-hidden />
                  <span>user@example.com</span>
                </WorkspaceHeaderAction>
                {sidebarMenuOpen ? (
                  <PopoverSurface aria-label="Sidebar user menu preview" role="menu">
                    <WorkspaceMenuSection label="Rate limits used">
                      <div className={styles.accountCard}>
                        <div className={styles.accountRow}>
                          <Text weight="semibold">user@example.com</Text>
                          <WorkspaceSupportMeta label="Plan Pro" />
                        </div>
                        <span className={styles.accountMeta}>
                          This is the Codex account currently routed into the active project
                          workspace.
                        </span>
                        <div className={styles.accountRow}>
                          <WorkspaceSupportMeta label="Current project route" tone="progress" />
                          <WorkspaceSupportMeta label="Default" />
                        </div>
                      </div>
                    </WorkspaceMenuSection>
                    <WorkspaceMenuSection
                      label="Actions"
                      description="Settings and billing stay in the same shared section rhythm."
                    >
                      <PopoverMenuItem icon={<CreditCard size={14} aria-hidden />}>
                        Manage Accounts & Billing
                      </PopoverMenuItem>
                      <PopoverMenuItem icon={<Settings size={14} aria-hidden />}>
                        Settings
                      </PopoverMenuItem>
                    </WorkspaceMenuSection>
                  </PopoverSurface>
                ) : null}
              </div>
            </ShellSection>
          }
          trailing={
            <div className={styles.cluster}>
              <ShellSection
                title="Home controls"
                meta="Header-action adapters"
                actions={<WorkspaceSupportMeta label="home" />}
              >
                <div className={styles.homeControls}>
                  <WorkspaceHeaderAction aria-label="Show sidebar" segment="icon">
                    <PanelLeft size={16} aria-hidden />
                  </WorkspaceHeaderAction>
                  <WorkspaceChromePill
                    aria-label="Select workspace"
                    label="All workspaces"
                    trailing={<ChevronDown size={14} aria-hidden />}
                  />
                  <WorkspaceHeaderAction aria-label="Open settings" segment="icon">
                    <Settings size={16} aria-hidden />
                  </WorkspaceHeaderAction>
                </div>
              </ShellSection>

              <ShellSection
                title="Composer footer"
                meta="Branch dropdown + compact support metadata"
                actions={<WorkspaceSupportMeta label="composer" tone="success" />}
              >
                <div className={styles.composerDock}>
                  <ComposerWorkspaceFooter
                    leading={
                      <WorkspaceChromePill
                        aria-label="Branch and worktree"
                        active={composerMenuOpen}
                        label="feature/main-shell"
                        leading={<GitFork size={14} aria-hidden />}
                        trailing={<ChevronDown size={14} aria-hidden />}
                        onClick={() => setComposerMenuOpen((current) => !current)}
                      />
                    }
                    trailing={<WorkspaceSupportMeta label="Full access" tone="warning" />}
                  />
                  {composerMenuOpen ? (
                    <PopoverSurface aria-label="Composer branch menu preview" role="menu">
                      <WorkspaceMenuSection
                        label="Branch & worktree"
                        description="Composer menus follow the same section contract as the sidebar."
                      >
                        <div className={styles.composerMenu}>
                          <PopoverMenuItem active>feature/main-shell</PopoverMenuItem>
                          <PopoverMenuItem>release/next</PopoverMenuItem>
                          <PopoverMenuItem>#142 pull request</PopoverMenuItem>
                        </div>
                      </WorkspaceMenuSection>
                    </PopoverSurface>
                  ) : null}
                </div>
              </ShellSection>
            </div>
          }
        />
      </ShellFrame>
    </main>
  );
}
