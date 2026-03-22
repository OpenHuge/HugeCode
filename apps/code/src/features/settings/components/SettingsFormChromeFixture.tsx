import { useState } from "react";
import {
  SettingsViewShell,
  type CodexSection,
  SETTINGS_SECTION_LABELS,
} from "@ku0/code-workspace-client/settings-shell";
import { Text } from "../../../design-system";
import type { AppSettings } from "../../../types";
import { DEFAULT_COMMIT_MESSAGE_PROMPT } from "../../../utils/commitMessagePrompt";
import { DEFAULT_CODE_FONT_FAMILY, DEFAULT_UI_FONT_FAMILY } from "../../../utils/fonts";
import { createDefaultRemoteServerProfile } from "../../../application/runtime/facades/runtimeRemoteServerProfilesFacade";
import { desktopSettingsShellFraming } from "./desktopSettingsShellFraming";
import { SettingsFieldGroup, SettingsSectionFrame } from "./SettingsSectionGrammar";
import { SettingsDisplaySection } from "./sections/SettingsDisplaySection";
import * as styles from "./SettingsFormChromeFixture.css";

const fixtureAppSettings: AppSettings = {
  codexBin: null,
  codexArgs: null,
  backendMode: "local",
  remoteBackendProfiles: [createDefaultRemoteServerProfile()],
  defaultRemoteBackendProfileId: "remote-backend-primary",
  defaultRemoteExecutionBackendId: null,
  orbitAutoStartRunner: false,
  keepDaemonRunningAfterAppClose: false,
  defaultAccessMode: "full-access",
  reviewDeliveryMode: "inline",
  composerModelShortcut: null,
  composerAccessShortcut: null,
  composerReasoningShortcut: null,
  composerCollaborationShortcut: null,
  interruptShortcut: null,
  newAgentShortcut: null,
  newWorktreeAgentShortcut: null,
  newCloneAgentShortcut: null,
  archiveThreadShortcut: null,
  toggleProjectsSidebarShortcut: null,
  toggleGitSidebarShortcut: null,
  branchSwitcherShortcut: null,
  toggleDebugPanelShortcut: null,
  toggleTerminalShortcut: null,
  cycleAgentNextShortcut: null,
  cycleAgentPrevShortcut: null,
  cycleWorkspaceNextShortcut: null,
  cycleWorkspacePrevShortcut: null,
  lastComposerModelId: null,
  lastComposerReasoningEffort: null,
  uiScale: 1,
  theme: "system",
  usageShowRemaining: true,
  showMessageFilePath: true,
  showInternalRuntimeDiagnostics: false,
  threadTitleAutogenerationEnabled: true,
  uiFontFamily: DEFAULT_UI_FONT_FAMILY,
  codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
  codeFontSize: 12,
  notificationSoundsEnabled: true,
  systemNotificationsEnabled: true,
  splitChatDiffView: true,
  preloadGitDiffs: true,
  gitDiffIgnoreWhitespaceChanges: false,
  commitMessagePrompt: DEFAULT_COMMIT_MESSAGE_PROMPT,
  experimentalCollabEnabled: false,
  collaborationModesEnabled: true,
  steerEnabled: true,
  unifiedExecEnabled: true,
  personality: "pragmatic",
  composerEditorPreset: "default",
  composerFenceExpandOnSpace: false,
  composerFenceExpandOnEnter: false,
  composerFenceLanguageTags: false,
  composerFenceWrapSelection: false,
  composerFenceAutoWrapPasteMultiline: false,
  composerFenceAutoWrapPasteCodeLike: false,
  composerListContinuation: false,
  composerCodeBlockCopyUseModifier: false,
  workspaceGroups: [],
  openAppTargets: [
    {
      id: "vscode",
      label: "VS Code",
      kind: "app",
      appName: "Visual Studio Code",
      command: null,
      args: [],
    },
  ],
  selectedOpenAppId: "vscode",
};

function PlaceholderSection({ section }: { section: CodexSection }) {
  return (
    <SettingsSectionFrame
      title={SETTINGS_SECTION_LABELS[section]}
      subtitle="Fixture navigation remains interactive, but Phase 5 focuses enforcement on the shared display/form chrome."
    >
      <SettingsFieldGroup
        title="Fixture placeholder"
        subtitle="Use Display & Sound to inspect select, toggle, input, and footer grammar."
      >
        <Text tone="muted">
          This section stays intentionally lightweight so the governance fixture remains
          deterministic.
        </Text>
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}

export function SettingsFormChromeFixture() {
  const [activeSection, setActiveSection] = useState<CodexSection>("display");
  const [appSettings, setAppSettings] = useState<AppSettings>(fixtureAppSettings);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [scaleDraft, setScaleDraft] = useState(String(fixtureAppSettings.uiScale));
  const [uiFontDraft, setUiFontDraft] = useState(fixtureAppSettings.uiFontFamily);
  const [codeFontDraft, setCodeFontDraft] = useState(fixtureAppSettings.codeFontFamily);
  const [codeFontSizeDraft, setCodeFontSizeDraft] = useState(fixtureAppSettings.codeFontSize);

  const renderSection =
    activeSection === "display" ? (
      <SettingsDisplaySection
        appSettings={appSettings}
        reduceTransparency={reduceTransparency}
        scaleShortcutTitle="Use the app-level zoom shortcut to adjust scale."
        scaleShortcutText="Applies instantly to this fixture shell."
        scaleDraft={scaleDraft}
        uiFontDraft={uiFontDraft}
        codeFontDraft={codeFontDraft}
        codeFontSizeDraft={codeFontSizeDraft}
        onUpdateAppSettings={async (next) => {
          setAppSettings(next);
        }}
        onToggleTransparency={(value) => {
          setReduceTransparency(value);
        }}
        onSetScaleDraft={setScaleDraft}
        onCommitScale={async () => {
          const parsed = Number(scaleDraft);
          const nextScale =
            Number.isFinite(parsed) && parsed > 0 ? parsed : fixtureAppSettings.uiScale;
          setScaleDraft(String(nextScale));
          setAppSettings((current) => ({
            ...current,
            uiScale: nextScale,
          }));
        }}
        onResetScale={async () => {
          setScaleDraft(String(fixtureAppSettings.uiScale));
          setAppSettings((current) => ({
            ...current,
            uiScale: fixtureAppSettings.uiScale,
          }));
        }}
        onSetUiFontDraft={setUiFontDraft}
        onCommitUiFont={async () => {
          setAppSettings((current) => ({
            ...current,
            uiFontFamily: uiFontDraft,
          }));
        }}
        onSetCodeFontDraft={setCodeFontDraft}
        onCommitCodeFont={async () => {
          setAppSettings((current) => ({
            ...current,
            codeFontFamily: codeFontDraft,
          }));
        }}
        onSetCodeFontSizeDraft={setCodeFontSizeDraft}
        onCommitCodeFontSize={async (nextSize) => {
          setCodeFontSizeDraft(nextSize);
          setAppSettings((current) => ({
            ...current,
            codeFontSize: nextSize,
          }));
        }}
        onTestNotificationSound={() => undefined}
        onTestSystemNotification={() => undefined}
      />
    ) : (
      <PlaceholderSection section={activeSection} />
    );

  return (
    <main className={styles.page} data-visual-fixture="settings-form-chrome">
      <SettingsViewShell
        activeSection={activeSection}
        framing={desktopSettingsShellFraming}
        useMobileMasterDetail={false}
        showMobileDetail
        onClose={() => undefined}
        onSelectSection={setActiveSection}
        onBackToSections={() => undefined}
      >
        {renderSection}
      </SettingsViewShell>
    </main>
  );
}
