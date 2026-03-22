import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../../types";
import {
  createDefaultRemoteServerProfile,
  createRemoteServerProfileDraft,
  readRemoteServerProfilesState,
  removeRemoteServerProfile,
  setDefaultRemoteServerProfile,
  upsertRemoteServerProfile,
} from "./runtimeRemoteServerProfilesFacade";

function createBaseSettings(): AppSettings {
  return {
    codexBin: null,
    codexArgs: null,
    backendMode: "remote",
    remoteBackendProfiles: [createDefaultRemoteServerProfile({ token: "primary-token" })],
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
    lastComposerExecutionMode: null,
    uiScale: 1,
    theme: "system",
    usageShowRemaining: false,
    showMessageFilePath: true,
    showInternalRuntimeDiagnostics: false,
    threadTitleAutogenerationEnabled: true,
    uiFontFamily: "system-ui",
    codeFontFamily: "ui-monospace",
    codeFontSize: 14,
    notificationSoundsEnabled: true,
    systemNotificationsEnabled: true,
    splitChatDiffView: false,
    preloadGitDiffs: true,
    gitDiffIgnoreWhitespaceChanges: false,
    commitMessagePrompt: "prompt",
    experimentalCollabEnabled: false,
    collaborationModesEnabled: true,
    steerEnabled: true,
    unifiedExecEnabled: true,
    personality: "friendly",
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
    openAppTargets: [],
    selectedOpenAppId: "default-open-app",
    lastActiveWorkspaceId: null,
  };
}

describe("runtimeRemoteServerProfilesFacade", () => {
  it("keeps a profile-first default selection", () => {
    const state = readRemoteServerProfilesState(createBaseSettings());

    expect(state.profiles).toHaveLength(1);
    expect(state.defaultProfileId).toBe(state.profiles[0]?.id);
    expect(state.selectedProfileId).toBe(state.profiles[0]?.id);
    expect(state.profiles[0]).toMatchObject({
      provider: "tcp",
      tcpOverlay: "tailscale",
      host: "127.0.0.1:4732",
      token: "primary-token",
    });
  });

  it("switches the selected default profile without fan-out to legacy fields", () => {
    const base = createBaseSettings();
    const secondProfile = createRemoteServerProfileDraft({
      id: "orbit-profile",
      label: "Orbit East",
      provider: "orbit",
      orbitWsUrl: "wss://orbit.example/ws",
      token: "orbit-token",
    });

    const next = setDefaultRemoteServerProfile(
      {
        ...base,
        remoteBackendProfiles: [
          createRemoteServerProfileDraft({
            id: "tcp-profile",
            label: "TCP West",
            provider: "tcp",
            host: "10.0.0.2:4732",
            token: "tcp-token",
          }),
          secondProfile,
        ],
        defaultRemoteBackendProfileId: "tcp-profile",
      },
      "orbit-profile"
    );

    expect(next.defaultRemoteBackendProfileId).toBe("orbit-profile");
    expect(next.remoteBackendProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "orbit-profile",
          provider: "orbit",
          orbitWsUrl: "wss://orbit.example/ws",
          token: "orbit-token",
        }),
      ])
    );
  });

  it("promotes a surviving profile when removing the default profile", () => {
    const base = createBaseSettings();
    const next = removeRemoteServerProfile(
      {
        ...base,
        remoteBackendProfiles: [
          createRemoteServerProfileDraft({
            id: "tcp-a",
            label: "TCP A",
            provider: "tcp",
            host: "10.0.0.1:4732",
            token: "token-a",
          }),
          createRemoteServerProfileDraft({
            id: "tcp-b",
            label: "TCP B",
            provider: "tcp",
            host: "10.0.0.2:4732",
            token: "token-b",
          }),
        ],
        defaultRemoteBackendProfileId: "tcp-a",
      },
      "tcp-a"
    );

    expect(next.defaultRemoteBackendProfileId).toBe("tcp-b");
    expect(next.remoteBackendProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tcp-b",
          host: "10.0.0.2:4732",
          token: "token-b",
        }),
      ])
    );
  });

  it("persists typed gateway config on remote backend profiles", () => {
    const base = createBaseSettings();
    const next = upsertRemoteServerProfile(
      base,
      createRemoteServerProfileDraft({
        id: "web-gateway",
        label: "Web Gateway",
        provider: "tcp",
        host: "10.0.0.8:4732",
        token: "token-web",
        gatewayConfig: {
          httpBaseUrl: "https://runtime.example.dev/rpc",
          wsBaseUrl: "wss://runtime.example.dev/ws",
          authMode: "token",
          tokenRef: "runtime_gateway_token",
          healthcheckPath: "/health",
          enabled: true,
        },
      })
    );

    const savedProfile = next.remoteBackendProfiles?.find(
      (profile) => profile.id === "web-gateway"
    );
    expect(savedProfile?.gatewayConfig).toEqual({
      httpBaseUrl: "https://runtime.example.dev/rpc",
      wsBaseUrl: "wss://runtime.example.dev/ws",
      authMode: "token",
      tokenRef: "runtime_gateway_token",
      healthcheckPath: "/health",
      enabled: true,
    });
  });

  it("persists tcp overlay selection on tcp remote backend profiles", () => {
    const base = createBaseSettings();
    const next = upsertRemoteServerProfile(
      base,
      createRemoteServerProfileDraft({
        id: "netbird-west",
        label: "NetBird West",
        provider: "tcp",
        tcpOverlay: "netbird",
        host: "netbird-west:4732",
        token: "token-netbird",
      })
    );

    const savedProfile = next.remoteBackendProfiles?.find(
      (profile) => profile.id === "netbird-west"
    );
    expect(savedProfile?.tcpOverlay).toBe("netbird");
  });
});
