import {
  orbitConnectTest,
  orbitRunnerStart,
  orbitRunnerStatus,
  orbitRunnerStop,
  orbitSignInPoll,
  orbitSignInStart,
  orbitSignOut,
} from "../../../application/runtime/ports/remoteServers";
import type { AppSettings } from "../../../types";
import type { OrbitServiceClient, ShortcutDraftKey, ShortcutSettingKey } from "./settingsTypes";

type ComposerPreset = AppSettings["composerEditorPreset"];

type ComposerPresetSettings = Pick<
  AppSettings,
  | "composerFenceExpandOnSpace"
  | "composerFenceExpandOnEnter"
  | "composerFenceLanguageTags"
  | "composerFenceWrapSelection"
  | "composerFenceAutoWrapPasteMultiline"
  | "composerFenceAutoWrapPasteCodeLike"
  | "composerListContinuation"
  | "composerCodeBlockCopyUseModifier"
>;

export const COMPOSER_PRESET_LABELS: Record<ComposerPreset, string> = {
  default: "Default (no helpers)",
  helpful: "Helpful",
  smart: "Smart",
};

export const COMPOSER_PRESET_CONFIGS: Record<ComposerPreset, ComposerPresetSettings> = {
  default: {
    composerFenceExpandOnSpace: false,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: false,
    composerFenceWrapSelection: false,
    composerFenceAutoWrapPasteMultiline: false,
    composerFenceAutoWrapPasteCodeLike: false,
    composerListContinuation: false,
    composerCodeBlockCopyUseModifier: false,
  },
  helpful: {
    composerFenceExpandOnSpace: true,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: true,
    composerFenceWrapSelection: true,
    composerFenceAutoWrapPasteMultiline: true,
    composerFenceAutoWrapPasteCodeLike: false,
    composerListContinuation: true,
    composerCodeBlockCopyUseModifier: false,
  },
  smart: {
    composerFenceExpandOnSpace: true,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: true,
    composerFenceWrapSelection: true,
    composerFenceAutoWrapPasteMultiline: true,
    composerFenceAutoWrapPasteCodeLike: true,
    composerListContinuation: true,
    composerCodeBlockCopyUseModifier: false,
  },
};

export const ORBIT_SERVICES: OrbitServiceClient = {
  orbitConnectTest,
  orbitSignInStart,
  orbitSignInPoll,
  orbitSignOut,
  orbitRunnerStart,
  orbitRunnerStop,
  orbitRunnerStatus,
};

export const ORBIT_DEFAULT_POLL_INTERVAL_SECONDS = 5;
export const ORBIT_MAX_INLINE_POLL_SECONDS = 180;
export const SETTINGS_MOBILE_BREAKPOINT_PX = 720;
export const DEFAULT_REMOTE_HOST = "127.0.0.1:4732";

export const SHORTCUT_DRAFT_KEY_BY_SETTING: Record<ShortcutSettingKey, ShortcutDraftKey> = {
  composerModelShortcut: "model",
  composerAccessShortcut: "access",
  composerReasoningShortcut: "reasoning",
  composerCollaborationShortcut: "collaboration",
  interruptShortcut: "interrupt",
  newAgentShortcut: "newAgent",
  newWorktreeAgentShortcut: "newWorktreeAgent",
  newCloneAgentShortcut: "newCloneAgent",
  archiveThreadShortcut: "archiveThread",
  toggleProjectsSidebarShortcut: "projectsSidebar",
  toggleGitSidebarShortcut: "contextRail",
  branchSwitcherShortcut: "branchSwitcher",
  toggleDebugPanelShortcut: "debugPanel",
  toggleTerminalShortcut: "terminal",
  cycleAgentNextShortcut: "cycleAgentNext",
  cycleAgentPrevShortcut: "cycleAgentPrev",
  cycleWorkspaceNextShortcut: "cycleWorkspaceNext",
  cycleWorkspacePrevShortcut: "cycleWorkspacePrev",
};
