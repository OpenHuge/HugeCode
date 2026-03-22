// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLayoutNodesOptions,
  type LayoutNodesFieldRegistry,
  type LayoutNodesOptions,
} from "./types";

const PRIMARY_CHROME_LAZY_BOUNDARY_TIMEOUT_MS = 60_000;

function createPrimaryChromeOptions(
  overrides: Partial<LayoutNodesFieldRegistry> = {}
): LayoutNodesOptions {
  return createLayoutNodesOptions({
    threadsByWorkspace: {},
    threadStatusById: {},
    approvals: [],
    userInputRequests: [],
    toolCallRequests: [],
    itemsByThread: {},
    activeWorkspace: null,
    activeWorkspaceId: null,
    activeThreadId: null,
    workspaces: [],
    handleApprovalDecision: vi.fn(),
    handleApprovalRemember: vi.fn(),
    onOpenThreadLink: vi.fn(),
    updaterState: null,
    onUpdate: vi.fn(),
    onDismissUpdate: vi.fn(),
    postUpdateNotice: null,
    onDismissPostUpdateNotice: vi.fn(),
    errorToasts: [],
    onDismissErrorToast: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenSettings: vi.fn(),
    onConnectLocalRuntimePort: vi.fn(),
    latestAgentRuns: [],
    missionControlProjection: null,
    missionControlFreshness: null,
    isLoadingLatestAgents: false,
    localUsageSnapshot: null,
    isLoadingLocalUsage: false,
    localUsageError: null,
    onRefreshLocalUsage: vi.fn(),
    onRefreshMissionControl: vi.fn(),
    usageMetric: "tokens",
    onUsageMetricChange: vi.fn(),
    usageWorkspaceId: null,
    usageWorkspaceOptions: [],
    onUsageWorkspaceChange: vi.fn(),
    onSelectHomeThread: vi.fn(),
    onOpenReviewPack: vi.fn(),
    onSelectWorkspace: vi.fn(),
    onSelectTab: vi.fn(),
    onSend: vi.fn(),
    onQueue: vi.fn(),
    onSendToWorkspace: vi.fn(),
    onQueueToWorkspace: vi.fn(),
    steerEnabled: false,
    collaborationModes: [],
    selectedCollaborationModeId: null,
    onSelectCollaborationMode: vi.fn(),
    models: [],
    selectedModelId: null,
    onSelectModel: vi.fn(),
    reasoningOptions: [],
    selectedEffort: null,
    onSelectEffort: vi.fn(),
    reasoningSupported: false,
    accessMode: "workspace-write",
    onSelectAccessMode: vi.fn(),
    executionOptions: [],
    selectedExecutionMode: "default",
    onSelectExecutionMode: vi.fn(),
    autoDrive: null,
    skills: [],
    prompts: [],
    files: [],
    activeItems: [],
    activeParentWorkspace: null,
    isWorktreeWorkspace: false,
    openAppTargets: [],
    openAppIconById: {},
    selectedOpenAppId: "",
    onSelectOpenAppId: vi.fn(),
    gitStatus: { error: null },
    onRefreshGitStatus: vi.fn(),
    onCopyThread: vi.fn(),
    onToggleTerminal: vi.fn(),
    terminalOpen: false,
    showTerminalButton: false,
    showWorkspaceTools: false,
    sidebarCollapsed: false,
    onExpandSidebar: vi.fn(),
    branchName: null,
    ...overrides,
  } as unknown as LayoutNodesFieldRegistry);
}

async function importBuildPrimaryChromeNodes() {
  vi.resetModules();
  const { buildPrimaryChromeNodes } = await import("./buildPrimaryNodes");
  return buildPrimaryChromeNodes;
}

describe("buildPrimaryChromeNodes home lazy boundaries", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.doUnmock("../../../missions/components/MissionOverviewPanel");
  });

  it(
    "returns the home node without forcing the home chunk to render",
    async () => {
      const buildPrimaryChromeNodes = await importBuildPrimaryChromeNodes();
      const nodes = buildPrimaryChromeNodes(createPrimaryChromeOptions());

      expect(nodes.homeNode).toBeTruthy();
    },
    PRIMARY_CHROME_LAZY_BOUNDARY_TIMEOUT_MS
  );

  it(
    "does not require the mission overview chunk when no workspace is active",
    async () => {
      const buildPrimaryChromeNodes = await importBuildPrimaryChromeNodes();
      const nodes = buildPrimaryChromeNodes(createPrimaryChromeOptions());

      expect(nodes.missionOverviewNode).toBeNull();
    },
    PRIMARY_CHROME_LAZY_BOUNDARY_TIMEOUT_MS
  );

  it(
    "loads the mission overview chunk when the missions node is rendered",
    async () => {
      vi.doMock("../../../missions/components/MissionOverviewPanel", () => ({
        MissionOverviewPanel: () => <div data-testid="mission-overview-panel" />,
      }));

      const buildPrimaryChromeNodes = await importBuildPrimaryChromeNodes();
      const nodes = buildPrimaryChromeNodes(
        createPrimaryChromeOptions({
          activeWorkspace: {
            id: "workspace-1",
            name: "Workspace 1",
            path: "/tmp/workspace-1",
            connected: true,
            settings: {
              sidebarCollapsed: false,
            },
          },
          activeWorkspaceId: "workspace-1",
          workspaces: [
            {
              id: "workspace-1",
              name: "Workspace 1",
              path: "/tmp/workspace-1",
              connected: true,
              settings: {
                sidebarCollapsed: false,
              },
            },
          ],
          threadsByWorkspace: {
            "workspace-1": [],
          },
        })
      );

      render(<div data-testid="mission-root">{nodes.missionOverviewNode}</div>);

      expect(await screen.findByTestId("mission-overview-panel")).toBeTruthy();
    },
    PRIMARY_CHROME_LAZY_BOUNDARY_TIMEOUT_MS
  );

  it(
    "passes remote backend controls through to the lazy home surface",
    async () => {
      const onSelectRemoteBackendId = vi.fn();
      const buildPrimaryChromeNodes = await importBuildPrimaryChromeNodes();
      const nodes = buildPrimaryChromeNodes(
        createPrimaryChromeOptions({
          models: [
            {
              id: "gpt-5",
              model: "gpt-5",
              displayName: "GPT-5",
              description: "GPT-5",
              supportedReasoningEfforts: [
                { reasoningEffort: "medium", description: "Medium reasoning" },
              ],
              defaultReasoningEffort: "medium",
              isDefault: true,
              available: true,
            },
          ],
          selectedModelId: "gpt-5",
          onSelectModel: vi.fn(),
          reasoningOptions: ["medium"],
          selectedEffort: "medium",
          onSelectEffort: vi.fn(),
          reasoningSupported: true,
          accessMode: "on-request",
          onSelectAccessMode: vi.fn(),
          executionOptions: [{ value: "runtime", label: "Runtime" }],
          selectedExecutionMode: "runtime",
          onSelectExecutionMode: vi.fn(),
          remoteBackendOptions: [{ value: "backend-remote-a", label: "Remote A" }],
          selectedRemoteBackendId: "backend-remote-a",
          onSelectRemoteBackendId,
        })
      );

      render(<div data-testid="home-root">{nodes.homeNode}</div>);

      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "Remote backend" },
          { timeout: PRIMARY_CHROME_LAZY_BOUNDARY_TIMEOUT_MS }
        )
      );

      const menu = screen.getByRole("listbox", { name: "Remote backend" });
      fireEvent.click(within(menu).getByText("Remote A"));

      expect(onSelectRemoteBackendId).toHaveBeenCalledWith("backend-remote-a");
    },
    PRIMARY_CHROME_LAZY_BOUNDARY_TIMEOUT_MS
  );

  it("routes approval toasts into the shared review detail when mission control has a matching run", async () => {
    const onOpenReviewPack = vi.fn();
    const onSelectWorkspace = vi.fn();
    const onSelectTab = vi.fn();
    const buildPrimaryChromeNodes = await importBuildPrimaryChromeNodes();
    const nodes = buildPrimaryChromeNodes(
      createPrimaryChromeOptions({
        workspaces: [
          {
            id: "workspace-1",
            name: "Workspace 1",
            path: "/tmp/workspace-1",
            connected: true,
            settings: {
              sidebarCollapsed: false,
            },
          },
        ],
        approvals: [
          {
            workspace_id: "workspace-1",
            request_id: 7,
            method: "runtime/requestApproval/shell",
            params: {
              command: "echo approval",
              thread_id: "thread-approval",
            },
          },
        ],
        missionControlProjection: {
          source: "runtime_snapshot_v1",
          generatedAt: 10,
          workspaces: [
            {
              id: "workspace-1",
              name: "Workspace 1",
              rootPath: "/tmp/workspace-1",
              connected: true,
              defaultProfileId: null,
            },
          ],
          tasks: [
            {
              id: "task-approval",
              workspaceId: "workspace-1",
              title: "Approval gated mission",
              objective: "Approval gated mission",
              origin: {
                kind: "thread",
                threadId: "thread-approval",
                runId: "run-approval",
                requestId: null,
              },
              mode: "delegate",
              modeSource: "execution_profile",
              status: "needs_input",
              createdAt: 1,
              updatedAt: 10,
              currentRunId: "run-approval",
              latestRunId: "run-approval",
              latestRunState: "needs_input",
              nextAction: null,
            },
          ],
          runs: [
            {
              id: "run-approval",
              taskId: "task-approval",
              workspaceId: "workspace-1",
              state: "needs_input",
              title: "Approval gated mission",
              summary: "Waiting on approval.",
              startedAt: 2,
              finishedAt: null,
              updatedAt: 10,
              currentStepIndex: 0,
              warnings: [],
              validations: [],
              artifacts: [],
              approval: {
                status: "pending_decision",
                approvalId: "approval-7",
                label: "Approval pending",
                summary: "Operator approval is required before this mission can continue.",
              },
              reviewPackId: null,
            },
          ],
          reviewPacks: [],
        } as LayoutNodesFieldRegistry["missionControlProjection"],
        onOpenReviewPack,
        onSelectWorkspace,
        onSelectTab,
      })
    );

    render(<div>{nodes.approvalToastsNode}</div>);

    fireEvent.click(screen.getByRole("button", { name: "Open action center" }));

    expect(onOpenReviewPack).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      taskId: "task-approval",
      runId: "run-approval",
      reviewPackId: null,
      source: "approval_toast",
    });
    expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(onSelectTab).toHaveBeenCalledWith("review");
  });
});
