// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopWorkspaceMissionDomain } from "./useDesktopWorkspaceMissionDomain";
import { useGitCommitController } from "../hooks/useGitCommitController";
import { useGitHubRuntimeTaskLaunchers } from "../hooks/useGitHubRuntimeTaskLaunchers";
import { useMainAppMissionControlState } from "../hooks/useMainAppMissionControlState";

vi.mock("../hooks/useGitHubRuntimeTaskLaunchers", () => ({
  useGitHubRuntimeTaskLaunchers: vi.fn(),
}));

vi.mock("../hooks/useMainAppMissionControlState", () => ({
  useMainAppMissionControlState: vi.fn(),
}));

vi.mock("../hooks/useGitCommitController", () => ({
  useGitCommitController: vi.fn(),
}));

const onThreadNotificationSent = vi.fn();
const onReviewPackControllerReady = vi.fn();
const handleStartTaskFromGitHubIssue = vi.fn();
const handleStartTaskFromGitHubPullRequest = vi.fn();
const gitCommitState = { isCommitting: false };

function createInput() {
  const recordPendingThreadLinkRef = {
    current: vi.fn(),
  };

  return {
    workspaceState: {
      activeWorkspace: { id: "ws-1", connected: true },
      activeWorkspaceId: "ws-1",
      hasLoaded: true,
      refreshWorkspaces: vi.fn(),
      connectWorkspace: vi.fn(),
      setActiveWorkspaceId: vi.fn(),
    },
    gitPanelState: {
      setCenterMode: vi.fn(),
      setSelectedDiffPath: vi.fn(),
      activeWorkspaceIdRef: { current: "ws-1" },
      gitStatus: null,
      refreshGitStatus: vi.fn(),
      refreshGitLog: vi.fn(),
    },
    gitRemoteUrl: "https://github.com/example/repo",
    appSettings: {
      systemNotificationsEnabled: true,
    },
    debugState: {
      addDebugEntry: vi.fn(),
    },
    workspacesById: new Map(),
    getWorkspaceName: vi.fn(() => "Workspace"),
    setActiveTab: vi.fn(),
    threadCodexState: {
      accessMode: "on-request",
      executionMode: "remote_sandbox",
      selectedRemoteBackendId: "backend-a",
      selectedModelId: "gpt-5",
      selectedEffort: "medium",
      preferredBackendIds: ["backend-a"],
    },
    threadCodexParamsVersion: 2,
    getThreadCodexParams: vi.fn(() => null),
    patchThreadCodexParams: vi.fn(),
    threadDomain: {
      activeThreadId: "thread-1",
      threadsState: {
        setActiveThreadId: vi.fn(),
      },
    },
    conversationState: {
      homeState: {
        refreshMissionControl: vi.fn(),
        missionControlProjection: { runs: [] },
      },
    },
    recordPendingThreadLinkRef,
  } as Parameters<typeof useDesktopWorkspaceMissionDomain>[0];
}

describe("useDesktopWorkspaceMissionDomain", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("wires mission, launch, and commit surfaces through the domain contract", () => {
    vi.mocked(useGitHubRuntimeTaskLaunchers).mockReturnValue({
      handleStartTaskFromGitHubIssue,
      handleStartTaskFromGitHubPullRequest,
    });
    vi.mocked(useMainAppMissionControlState).mockReturnValue({
      autoDriveState: {},
      onReviewPackControllerReady,
      onThreadNotificationSent,
    });
    vi.mocked(useGitCommitController).mockReturnValue(
      gitCommitState as ReturnType<typeof useGitCommitController>
    );

    const input = createInput();
    const { result, unmount } = renderHook(() => useDesktopWorkspaceMissionDomain(input));

    expect(useGitHubRuntimeTaskLaunchers).toHaveBeenCalledWith(
      expect.objectContaining({
        activeWorkspaceId: "ws-1",
        gitRemoteUrl: "https://github.com/example/repo",
        refreshMissionControl: input.conversationState.homeState.refreshMissionControl,
      })
    );
    expect(useMainAppMissionControlState).toHaveBeenCalledWith(
      expect.objectContaining({
        activeThreadId: "thread-1",
        missionControlProjection: input.conversationState.homeState.missionControlProjection,
        setActiveThreadId: input.threadDomain.threadsState.setActiveThreadId,
      })
    );
    expect(input.recordPendingThreadLinkRef.current).toBe(onThreadNotificationSent);
    expect(result.current).toEqual({
      missionControlState: {
        autoDriveState: {},
        onReviewPackControllerReady,
        onThreadNotificationSent,
      },
      gitCommitState,
      handleStartTaskFromGitHubIssue,
      handleStartTaskFromGitHubPullRequest,
    });

    unmount();
    expect(input.recordPendingThreadLinkRef.current).not.toBe(onThreadNotificationSent);
  });
});
