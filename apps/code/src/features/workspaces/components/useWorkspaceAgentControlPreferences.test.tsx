// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../types";
import { createDefaultRemoteServerProfile } from "../../../application/runtime/facades/runtimeRemoteServerProfilesFacade";
import { writeCachedState } from "./workspaceHomeAgentControlState";

const {
  getAppSettingsMock,
  updateAppSettingsMock,
  runtimeUpdatedListeners,
  subscribeScopedRuntimeUpdatedEventsMock,
} = vi.hoisted(() => ({
  getAppSettingsMock: vi.fn(),
  updateAppSettingsMock: vi.fn(),
  runtimeUpdatedListeners: new Set<(event: unknown) => void>(),
  subscribeScopedRuntimeUpdatedEventsMock: vi.fn((_options, listener) => {
    runtimeUpdatedListeners.add(listener);
    return () => runtimeUpdatedListeners.delete(listener);
  }),
}));

vi.mock("../../../application/runtime/ports/tauriAppSettings", () => ({
  getAppSettings: getAppSettingsMock,
  updateAppSettings: updateAppSettingsMock,
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: subscribeScopedRuntimeUpdatedEventsMock,
}));

import { useWorkspaceAgentControlPreferences } from "./useWorkspaceAgentControlPreferences";

const workspaceId = "workspace-agent-control";

function createAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
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
    lastComposerExecutionMode: null,
    uiScale: 1,
    theme: "system",
    usageShowRemaining: false,
    showMessageFilePath: true,
    showInternalRuntimeDiagnostics: false,
    threadTitleAutogenerationEnabled: true,
    uiFontFamily: null,
    codeFontFamily: null,
    codeFontSize: 14,
    notificationSoundsEnabled: true,
    systemNotificationsEnabled: true,
    splitChatDiffView: false,
    preloadGitDiffs: true,
    gitDiffIgnoreWhitespaceChanges: false,
    commitMessagePrompt: "commit",
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
    selectedOpenAppId: null,
    lastActiveWorkspaceId: null,
    workspaceAgentControlByWorkspaceId: {},
    ...overrides,
  };
}

describe("useWorkspaceAgentControlPreferences", () => {
  beforeEach(() => {
    writeCachedState(workspaceId, {
      version: 7,
      intent: {
        objective: "cached",
        constraints: "",
        successCriteria: "",
        deadline: null,
        priority: "medium",
        managerNotes: "",
      },
      webMcpEnabled: true,
      webMcpConsoleMode: "advanced",
      lastKnownPersistedControls: {
        readOnlyMode: true,
        requireUserApproval: false,
        webMcpAutoExecuteCalls: false,
      },
    });
    getAppSettingsMock.mockReset();
    updateAppSettingsMock.mockReset();
    subscribeScopedRuntimeUpdatedEventsMock.mockClear();
    runtimeUpdatedListeners.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("prefers runtime-backed app settings over a stale local cache snapshot", async () => {
    getAppSettingsMock.mockResolvedValue(
      createAppSettings({
        workspaceAgentControlByWorkspaceId: {
          [workspaceId]: {
            readOnlyMode: false,
            requireUserApproval: true,
            webMcpAutoExecuteCalls: true,
          },
        },
      })
    );

    const { result } = renderHook(() => useWorkspaceAgentControlPreferences(workspaceId));

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.controls).toEqual({
      readOnlyMode: false,
      requireUserApproval: true,
      webMcpAutoExecuteCalls: true,
    });
    expect(subscribeScopedRuntimeUpdatedEventsMock).toHaveBeenCalled();
  });

  it("persists patches into the runtime-backed workspace settings slice", async () => {
    getAppSettingsMock.mockResolvedValue(
      createAppSettings({
        workspaceAgentControlByWorkspaceId: {
          [workspaceId]: {
            readOnlyMode: false,
            requireUserApproval: true,
            webMcpAutoExecuteCalls: true,
          },
        },
      })
    );
    updateAppSettingsMock.mockResolvedValue(
      createAppSettings({
        workspaceAgentControlByWorkspaceId: {
          [workspaceId]: {
            readOnlyMode: true,
            requireUserApproval: true,
            webMcpAutoExecuteCalls: true,
          },
        },
      })
    );

    const { result } = renderHook(() => useWorkspaceAgentControlPreferences(workspaceId));

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    await act(async () => {
      await result.current.applyPatch({ readOnlyMode: true });
    });

    expect(updateAppSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceAgentControlByWorkspaceId: {
          [workspaceId]: {
            readOnlyMode: true,
            requireUserApproval: true,
            webMcpAutoExecuteCalls: true,
          },
        },
      })
    );
    expect(result.current.controls.readOnlyMode).toBe(true);
  });

  it("refreshes authoritative controls after a runtime reconnect event", async () => {
    getAppSettingsMock
      .mockResolvedValueOnce(
        createAppSettings({
          workspaceAgentControlByWorkspaceId: {
            [workspaceId]: {
              readOnlyMode: false,
              requireUserApproval: true,
              webMcpAutoExecuteCalls: true,
            },
          },
        })
      )
      .mockResolvedValueOnce(
        createAppSettings({
          workspaceAgentControlByWorkspaceId: {
            [workspaceId]: {
              readOnlyMode: true,
              requireUserApproval: false,
              webMcpAutoExecuteCalls: false,
            },
          },
        })
      );

    const { result } = renderHook(() => useWorkspaceAgentControlPreferences(workspaceId));

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    act(() => {
      for (const listener of runtimeUpdatedListeners) {
        listener({
          scope: ["workspaces"],
          params: { reason: "stream_reconnected" },
        });
      }
    });

    await waitFor(() => {
      expect(result.current.controls).toEqual({
        readOnlyMode: true,
        requireUserApproval: false,
        webMcpAutoExecuteCalls: false,
      });
    });
  });

  it("keeps the last authoritative state when persistence fails", async () => {
    getAppSettingsMock.mockResolvedValue(
      createAppSettings({
        workspaceAgentControlByWorkspaceId: {
          [workspaceId]: {
            readOnlyMode: false,
            requireUserApproval: true,
            webMcpAutoExecuteCalls: true,
          },
        },
      })
    );
    updateAppSettingsMock.mockRejectedValue(new Error("save failed"));

    const { result } = renderHook(() => useWorkspaceAgentControlPreferences(workspaceId));

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    await act(async () => {
      await expect(result.current.applyPatch({ requireUserApproval: false })).rejects.toThrow(
        "save failed"
      );
    });

    expect(result.current.controls).toEqual({
      readOnlyMode: false,
      requireUserApproval: true,
      webMcpAutoExecuteCalls: true,
    });
    await waitFor(() => {
      expect(result.current.error).toContain("save failed");
    });
  });
});
