import type {
  OpenAppTarget,
  OrbitConnectTestResult,
  OrbitDeviceCodeStart,
  OrbitRunnerStatus,
  OrbitSignInPollResult,
  OrbitSignOutResult,
} from "../../../types";
export type { CodexSection } from "@ku0/code-workspace-client/settings-shell";

export type SettingsSection =
  | "projects"
  | "environments"
  | "display"
  | "composer"
  | "shortcuts"
  | "open-apps"
  | "git"
  | "server";

export type ShortcutSettingKey =
  | "composerModelShortcut"
  | "composerAccessShortcut"
  | "composerReasoningShortcut"
  | "composerCollaborationShortcut"
  | "interruptShortcut"
  | "newAgentShortcut"
  | "newWorktreeAgentShortcut"
  | "newCloneAgentShortcut"
  | "archiveThreadShortcut"
  | "toggleProjectsSidebarShortcut"
  | "toggleGitSidebarShortcut"
  | "branchSwitcherShortcut"
  | "toggleDebugPanelShortcut"
  | "toggleTerminalShortcut"
  | "cycleAgentNextShortcut"
  | "cycleAgentPrevShortcut"
  | "cycleWorkspaceNextShortcut"
  | "cycleWorkspacePrevShortcut";

export type ShortcutDraftKey =
  | "model"
  | "access"
  | "reasoning"
  | "collaboration"
  | "interrupt"
  | "newAgent"
  | "newWorktreeAgent"
  | "newCloneAgent"
  | "archiveThread"
  | "projectsSidebar"
  | "contextRail"
  | "branchSwitcher"
  | "debugPanel"
  | "terminal"
  | "cycleAgentNext"
  | "cycleAgentPrev"
  | "cycleWorkspaceNext"
  | "cycleWorkspacePrev";

export type ShortcutDrafts = Record<ShortcutDraftKey, string>;

export type OpenAppDraft = OpenAppTarget & { argsText: string };

export type OrbitServiceClient = {
  orbitConnectTest: () => Promise<OrbitConnectTestResult>;
  orbitSignInStart: () => Promise<OrbitDeviceCodeStart>;
  orbitSignInPoll: (deviceCode: string) => Promise<OrbitSignInPollResult>;
  orbitSignOut: () => Promise<OrbitSignOutResult>;
  orbitRunnerStart: () => Promise<OrbitRunnerStatus>;
  orbitRunnerStop: () => Promise<OrbitRunnerStatus>;
  orbitRunnerStatus: () => Promise<OrbitRunnerStatus>;
};
