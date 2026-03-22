// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { WorkspaceInfo } from "../../../types";
import type { ReviewPromptState } from "../../threads/hooks/useReviewPrompt";
import { Home } from "./Home";

const { workspaceHomeAgentControlPropsSpy } = vi.hoisted(() => ({
  workspaceHomeAgentControlPropsSpy: vi.fn(),
}));

vi.mock("../../workspaces/components/WorkspaceHomeAgentControl", () => ({
  WorkspaceHomeAgentControl: (props: unknown) => {
    workspaceHomeAgentControlPropsSpy(props);
    return <div data-testid="workspace-home-agent-control-stub" />;
  },
}));

vi.mock("../../../application/runtime/ports/runtimeClientMode", () => ({
  detectRuntimeMode: vi.fn(() => "tauri"),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const baseProps = {
  onOpenProject: vi.fn(),
  onOpenSettings: vi.fn(),
  onConnectLocalRuntimePort: vi.fn(),
  latestAgentRuns: [],
  isLoadingLatestAgents: false,
  localUsageSnapshot: null,
  isLoadingLocalUsage: false,
  localUsageError: null,
  workspaceLoadError: null,
  onRefreshLocalUsage: vi.fn(),
  usageMetric: "tokens" as const,
  onUsageMetricChange: vi.fn(),
  usageWorkspaceId: null,
  usageWorkspaceOptions: [],
  onUsageWorkspaceChange: vi.fn(),
  onSelectThread: vi.fn(),
};

const HOME_INTERACTION_TIMEOUT_MS = 60_000;

function createReviewPromptState(): NonNullable<ReviewPromptState> {
  const workspace: WorkspaceInfo = {
    id: "workspace-1",
    name: "Workspace One",
    path: "/tmp/workspace-one",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };

  return {
    workspace,
    threadIdSnapshot: "thread-review",
    step: "preset",
    branches: [],
    commits: [],
    isLoadingBranches: false,
    isLoadingCommits: false,
    selectedBranch: "",
    selectedCommitSha: "",
    selectedCommitTitle: "",
    customInstructions: "",
    error: null,
    isSubmitting: false,
  };
}

describe("Home", () => {
  afterEach(() => {
    cleanup();
    workspaceHomeAgentControlPropsSpy.mockReset();
    vi.clearAllMocks();
  });

  it(
    "renders a simplified launchpad with mission signals",
    () => {
      const onSelectThread = vi.fn();
      const { container } = render(
        <Home
          {...baseProps}
          workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
          activeWorkspaceId="workspace-1"
          latestAgentRuns={[
            {
              message: "Ship the dashboard refresh",
              timestamp: Date.now(),
              projectName: "CodexMonitor",
              groupName: "Frontend",
              workspaceId: "workspace-1",
              threadId: "thread-1",
              runId: "run-1",
              taskId: "thread-1",
              statusLabel: "Running",
              statusKind: "active",
              source: "runtime_snapshot_v1",
              warningCount: 0,
            },
          ]}
          onSelectThread={onSelectThread}
        />
      );

      expect(screen.getByText("Start a mission")).toBeTruthy();
      expect(screen.getByText("Recent missions")).toBeTruthy();
      expect(screen.getByText("Running")).toBeTruthy();
      expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
      expect(screen.getByText("Routing")).toBeTruthy();
      expect(container.querySelector("[data-home-dashboard-widgets='true']")).toBeTruthy();
      expect(
        container.querySelector(
          '[data-home-dashboard-card-group="true"][data-status-tone="default"]'
        )
      ).toBeTruthy();
      expect(
        container.querySelector(
          '[data-home-dashboard-card-status="true"][data-status-tone="progress"]'
        )
      ).toBeTruthy();
      expect(
        container.querySelectorAll(
          "[data-home-dashboard-widgets='true'] > [data-shell-section='true']"
        ).length
      ).toBe(2);
      expect(
        container
          .querySelector('[data-testid="home-starter-section"]')
          ?.getAttribute("data-home-launchpad-layout")
      ).toBe("compact-grid");
      expect(container.querySelector('[data-testid="home-mission-launchpad"]')).toBeTruthy();
      expect(container.querySelector("[data-shell-slot='body']")).toBeTruthy();
      expect(container.querySelector('[data-home-frame="true"]')).toBeTruthy();
      expect(container.querySelector('[data-home-hero="true"]')).toBeNull();
      expect(
        container.querySelectorAll('[data-home-list-row="true"]').length
      ).toBeGreaterThanOrEqual(1);
      expect(container.querySelector('[data-home-dock="true"]')).toBeTruthy();
      expect(screen.queryByText("Suggested starts")).toBeNull();
      expect(screen.queryByTestId("home-scenario-bugfix")).toBeNull();
      expect(screen.queryByTestId("home-scenario-refactor")).toBeNull();
      expect(screen.queryByTestId("home-scenario-investigate")).toBeNull();

      fireEvent.click(screen.getByTestId("home-recent-mission-thread-1"));
      expect(onSelectThread).toHaveBeenCalledWith("workspace-1", "thread-1");
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("shows fast mode in the home composer menu when toggle support is available", () => {
    const onToggleFastMode = vi.fn();

    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        fastModeEnabled={false}
        onToggleFastMode={onToggleFastMode}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open composer menu" }));
    fireEvent.click(screen.getByRole("switch", { name: "Fast speed" }));

    expect(onToggleFastMode).toHaveBeenCalledTimes(1);
    expect(onToggleFastMode).toHaveBeenCalledWith(true);
  });

  it("renders the mission header as a clear status cluster with explicit actions", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        missionControlFreshness={{
          status: "loading",
          isStale: false,
          error: null,
          lastUpdatedAt: null,
        }}
        onRefreshMissionControl={vi.fn()}
      />
    );

    expect(screen.getByText("Mission control")).toBeTruthy();
    expect(screen.getByText("Syncing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Browse workspaces" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh mission control" })).toBeTruthy();
    expect(screen.queryByText("Syncing mission control")).toBeNull();
    expect(screen.queryByRole("button", { name: "Workspaces" })).toBeNull();
  });

  it("shows recent mission route detail from mission-control placement truth", () => {
    const missionControlProjection: HugeCodeMissionControlSnapshot = {
      source: "runtime_snapshot_v1",
      generatedAt: 1,
      workspaces: [],
      tasks: [],
      reviewPacks: [],
      runs: [
        {
          id: "run-1",
          taskId: "thread-1",
          workspaceId: "workspace-1",
          state: "running",
          title: "Ship the dashboard refresh",
          summary: "Ship the dashboard refresh",
          startedAt: null,
          finishedAt: null,
          updatedAt: 1,
          currentStepIndex: null,
          pendingIntervention: null,
          executionProfile: null,
          profileReadiness: null,
          routing: {
            backendId: "backend-remote-a",
            provider: "OpenAI",
            providerLabel: "OpenAI",
            pool: null,
            routeLabel: "Remote backend A",
            routeHint: null,
            health: "ready",
            enabledAccountCount: 0,
            readyAccountCount: 0,
            enabledPoolCount: 0,
          },
          approval: null,
          reviewDecision: null,
          intervention: null,
          operatorState: null,
          nextAction: null,
          warnings: [],
          validations: [],
          artifacts: [],
          changedPaths: [],
          autoDrive: null,
          completionReason: null,
          reviewPackId: null,
          lineage: null,
          ledger: null,
          governance: null,
          placement: {
            resolvedBackendId: "backend-remote-a",
            requestedBackendIds: ["backend-remote-a"],
            resolutionSource: "explicit_preference",
            lifecycleState: "confirmed",
            readiness: "ready",
            healthSummary: "placement_ready",
            attentionReasons: [],
            summary: "Runtime confirmed the requested backend backend-remote-a.",
            rationale:
              "Mission Control requested backend-remote-a and runtime confirmed that placement.",
            backendContract: null,
          },
          operatorSnapshot: null,
          workspaceEvidence: null,
          missionBrief: null,
          relaunchContext: null,
          subAgents: [],
          publishHandoff: null,
        },
      ],
    };

    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        latestAgentRuns={[
          {
            message: "Ship the dashboard refresh",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            groupName: "Frontend",
            workspaceId: "workspace-1",
            threadId: "thread-1",
            runId: "run-1",
            taskId: "thread-1",
            statusLabel: "Running",
            statusKind: "active",
            source: "runtime_snapshot_v1",
            warningCount: 0,
          },
        ]}
        missionControlProjection={missionControlProjection}
      />
    );

    expect(screen.getByText("Remote backend A · backend-remote-a")).toBeTruthy();
  });

  it("renders the simplified launchpad when there are no latest runs", () => {
    const { container } = render(<Home {...baseProps} />);

    expect(screen.queryByTestId("home-scenario-bugfix")).toBeNull();
    expect(screen.queryByTestId("home-scenario-refactor")).toBeNull();
    expect(screen.queryByTestId("home-scenario-investigate")).toBeNull();
    expect(screen.queryByText("Recent missions")).toBeNull();
    expect(screen.queryByText("No recent missions yet.")).toBeNull();
    expect(container.querySelector("[data-empty-surface='true']")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
  });

  it("passes remote backend controls through to the home composer", () => {
    const onSelectRemoteBackendId = vi.fn();

    render(
      <Home
        {...baseProps}
        models={[
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
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
        remoteBackendOptions={[
          { value: "backend-remote-a", label: "Remote A" },
          { value: "backend-remote-b", label: "Remote B" },
        ]}
        selectedRemoteBackendId="backend-remote-b"
        onSelectRemoteBackendId={onSelectRemoteBackendId}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remote backend" }));

    const menu = screen.getByRole("listbox", { name: "Remote backend" });
    fireEvent.click(within(menu).getByText("Remote A"));

    expect(onSelectRemoteBackendId).toHaveBeenCalledWith("backend-remote-a");
  });

  it("moves runtime placement into the workspace summary instead of the home composer meta rail", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          {
            id: "workspace-1",
            name: "Workspace One",
            path: "/tmp/workspace-one",
            connected: true,
          },
        ]}
        activeWorkspaceId="workspace-1"
        models={[
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
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
        remoteBackendOptions={[{ value: "backend-remote-a", label: "Remote A" }]}
        selectedRemoteBackendId="backend-remote-a"
        onSelectRemoteBackendId={vi.fn()}
        resolvedRemotePlacement={{
          summary: "Runtime confirmed backend backend-runtime-a.",
          detail: "Route: Remote A · Placement source: workspace_default",
          tone: "neutral",
        }}
      />
    );

    expect(screen.getByText("Runtime confirmed backend backend-runtime-a.")).toBeTruthy();
    expect(screen.getByText("Route: Remote A · Placement source: workspace_default")).toBeTruthy();
    expect(screen.queryByLabelText("Latest runtime placement")).toBeNull();
  });

  it("routes the mission signal settings action through the shared handler", () => {
    const onOpenSettings = vi.fn();

    render(
      <Home
        {...baseProps}
        onOpenSettings={onOpenSettings}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    fireEvent.click(screen.getByTestId("home-mission-signal-routing"));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("routes the awaiting-action mission signal through the operator action target", () => {
    const onOpenMissionTarget = vi.fn();
    const onSelectThread = vi.fn();

    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        latestAgentRuns={[
          {
            message: "Approval is blocking the write step.",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            workspaceId: "workspace-1",
            threadId: "runtime-task:task-9",
            runId: "run-9",
            taskId: "runtime-task:task-9",
            statusLabel: "Needs attention",
            statusKind: "attention",
            source: "runtime_snapshot_v1",
            warningCount: 0,
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-9",
              runId: "run-9",
              reviewPackId: null,
              threadId: null,
              limitation: "thread_unavailable",
            },
            operatorActionLabel: "Open approval",
            operatorActionDetail: "Review the blocking approval and decide whether to continue.",
            operatorActionTarget: {
              kind: "review",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-9",
              runId: "run-9",
              reviewPackId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
          },
        ]}
        onOpenMissionTarget={onOpenMissionTarget}
        onSelectThread={onSelectThread}
      />
    );

    fireEvent.click(screen.getByTestId("home-mission-signal-awaiting-action"));

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "runtime-task:task-9",
      runId: "run-9",
      reviewPackId: null,
      limitation: "thread_unavailable",
    });
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("routes runtime-managed recent missions into mission detail when no thread is available", () => {
    const onSelectThread = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const onOpenReviewMission = vi.fn();

    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One", connected: true }]}
        activeWorkspaceId="workspace-1"
        latestAgentRuns={[
          {
            message: "Runtime prepared a review pack without a thread destination.",
            timestamp: Date.now(),
            projectName: "CodexMonitor",
            workspaceId: "workspace-1",
            threadId: "runtime-task:task-7",
            runId: "task-7",
            taskId: "runtime-task:task-7",
            statusLabel: "Review ready",
            statusKind: "review_ready",
            source: "runtime_snapshot_v1",
            warningCount: 0,
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-7",
              runId: "task-7",
              reviewPackId: "review-pack:task-7",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
          },
        ]}
        onSelectThread={onSelectThread}
        onOpenMissionTarget={onOpenMissionTarget}
        onOpenReviewMission={onOpenReviewMission}
      />
    );

    fireEvent.click(screen.getByTestId("home-recent-mission-runtime-task:task-7"));

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "runtime-task:task-7",
      runId: "task-7",
      reviewPackId: "review-pack:task-7",
      threadId: null,
      limitation: "thread_unavailable",
    });
    expect(onSelectThread).not.toHaveBeenCalled();
    expect(onOpenReviewMission).not.toHaveBeenCalled();
  });

  it(
    "surfaces runtime-unavailable guidance when projects cannot load",
    async () => {
      const onOpenSettings = vi.fn();
      const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);
      render(
        <Home
          {...baseProps}
          onOpenSettings={onOpenSettings}
          onConnectLocalRuntimePort={onConnectLocalRuntimePort}
          workspaceLoadError="Code runtime is unavailable for list workspaces."
        />
      );

      const runtimeNotice = screen.getByTestId("home-runtime-notice");
      expect(runtimeNotice.getAttribute("data-state")).toBe("runtime");
      expect(screen.getByText("Runtime unavailable")).toBeTruthy();
      expect(screen.queryByText("Recent missions")).toBeNull();
      expect(screen.getByRole("textbox", { name: "Runtime target" })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Connect|Connecting\.\.\./ })).toBeTruthy();

      await waitFor(() =>
        expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 })
      );
      onConnectLocalRuntimePort.mockClear();

      fireEvent.click(screen.getByTestId("home-settings-trigger"));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Open runtime settings" })).toBeTruthy();

      fireEvent.change(screen.getByRole("textbox", { name: "Runtime target" }), {
        target: { value: "8899" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Connect|Connecting\.\.\./ }));

      await waitFor(() =>
        expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8899 })
      );
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("validates the manual local runtime port before connecting", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);
    render(
      <Home
        {...baseProps}
        onConnectLocalRuntimePort={onConnectLocalRuntimePort}
        workspaceLoadError="Code runtime is unavailable for list workspaces."
      />
    );

    await waitFor(() =>
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 })
    );
    onConnectLocalRuntimePort.mockClear();

    fireEvent.change(screen.getByRole("textbox", { name: "Runtime target" }), {
      target: { value: "70000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(onConnectLocalRuntimePort).not.toHaveBeenCalled();
    expect(await screen.findByText("Enter a valid runtime port between 1 and 65535.")).toBeTruthy();
  });

  it("shows the local runtime port entry on home even before runtime errors appear", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);
    render(<Home {...baseProps} onConnectLocalRuntimePort={onConnectLocalRuntimePort} />);

    expect(screen.getByRole("textbox", { name: "Runtime target" })).toBeTruthy();

    await waitFor(() =>
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 })
    );
    onConnectLocalRuntimePort.mockClear();

    fireEvent.change(screen.getByRole("textbox", { name: "Runtime target" }), {
      target: { value: "8789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8789 })
    );
  });

  it("connects to a remote runtime address when provided", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);
    render(<Home {...baseProps} onConnectLocalRuntimePort={onConnectLocalRuntimePort} />);

    await waitFor(() =>
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 })
    );
    onConnectLocalRuntimePort.mockClear();

    fireEvent.change(screen.getByRole("textbox", { name: "Runtime target" }), {
      target: { value: "https://runtime.example.com:8788/rpc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({
        host: "runtime.example.com",
        port: 8788,
      })
    );
  });

  it("validates the remote runtime address before connecting", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);
    render(<Home {...baseProps} onConnectLocalRuntimePort={onConnectLocalRuntimePort} />);

    await waitFor(() =>
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 })
    );
    onConnectLocalRuntimePort.mockClear();

    fireEvent.change(screen.getByRole("textbox", { name: "Runtime target" }), {
      target: { value: "ftp://runtime.example.com:8788" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(onConnectLocalRuntimePort).not.toHaveBeenCalled();
    expect(await screen.findByText("Use an http, https, ws, or wss runtime address.")).toBeTruthy();
  });

  it("auto-connects the default local runtime once on local home startup", async () => {
    const onConnectLocalRuntimePort = vi.fn().mockResolvedValue(undefined);

    render(<Home {...baseProps} onConnectLocalRuntimePort={onConnectLocalRuntimePort} />);

    await waitFor(() =>
      expect(onConnectLocalRuntimePort).toHaveBeenCalledWith({ host: null, port: 8788 })
    );
    expect(onConnectLocalRuntimePort).toHaveBeenCalledTimes(1);
  });

  it(
    "switches workspace from the top-left selector",
    () => {
      const onSelectWorkspace = vi.fn();
      render(
        <Home
          {...baseProps}
          workspaces={[
            { id: "workspace-1", name: "Workspace One" },
            { id: "workspace-2", name: "Workspace Two" },
          ]}
          activeWorkspaceId="workspace-1"
          sidebarCollapsed
          onSelectWorkspace={onSelectWorkspace}
        />
      );

      const workspaceTrigger = screen
        .getAllByRole("button", { name: "Select workspace" })
        .find((element) => !element.hasAttribute("disabled"));
      expect(workspaceTrigger).toBeTruthy();
      if (!workspaceTrigger) {
        throw new Error("Expected enabled workspace selector trigger");
      }
      fireEvent.click(workspaceTrigger);
      fireEvent.click(screen.getByRole("option", { name: "Workspace Two" }));
      expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-2");
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("shows the active workspace summary without duplicating routing controls", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          {
            id: "workspace-1",
            name: "Workspace One",
            path: "/Users/han/Documents/Code/Y/Y-keep-up",
          },
          { id: "workspace-2", name: "Demo Workspace" },
        ]}
        activeWorkspaceId="workspace-1"
      />
    );

    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getAllByText("Workspace One").length).toBeGreaterThan(0);
    expect(screen.getByText(/\/Users\/han\/Documents\/Code\/Y\/Y-keep-up/)).toBeTruthy();
    expect(
      screen.getByTestId("home-workspace-summary").getAttribute("data-workspace-summary-scope")
    ).toBe("active");
  });

  it("shows the connected workspace in the selector when home has no active workspace", () => {
    const { container } = render(
      <Home
        {...baseProps}
        workspaces={[
          { id: "workspace-1", name: "Workspace One", connected: false },
          { id: "workspace-2", name: "Workspace Two", connected: true },
        ]}
        activeWorkspaceId={null}
        sidebarCollapsed
      />
    );

    const scoped = within(container);
    expect(
      scoped.getAllByRole("button", { name: "Select workspace" }).at(-1)?.textContent ?? ""
    ).toContain("Workspace Two");
  });

  it("describes the default workspace honestly when home has not activated one yet", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          { id: "workspace-1", name: "Workspace One", path: "/tmp/workspace-web" },
          { id: "workspace-2", name: "Workspace Two", connected: true, path: "/tmp/workspace-two" },
        ]}
        activeWorkspaceId={null}
      />
    );

    const summary = screen.getByTestId("home-workspace-summary");
    expect(summary.getAttribute("data-workspace-summary-scope")).toBe("default");
    expect(within(summary).getByText("Default")).toBeTruthy();
    expect(within(summary).getByText("/tmp/workspace-two")).toBeTruthy();
    expect(within(summary).queryByText("Active")).toBeNull();
  });

  it(
    "opens and closes agent settings dialog from top toolbar",
    () => {
      const { container } = render(
        <Home
          {...baseProps}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId="workspace-1"
        />
      );

      const scoped = within(container);
      const settingsButton = scoped
        .getAllByRole("button", { name: "Open agent command center" })
        .at(-1);
      expect(settingsButton).toBeTruthy();
      if (!settingsButton) {
        throw new Error("Expected agent settings button");
      }
      fireEvent.click(settingsButton);

      expect(scoped.getByTestId("home-agent-settings-dialog")).toBeTruthy();

      fireEvent.click(scoped.getByRole("button", { name: "Close agent command center" }));
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("forwards approvals and user-input requests into workspace agent settings", () => {
    const approvals = [
      {
        workspace_id: "workspace-1",
        request_id: 9,
        method: "workspace/requestApproval/runCommand",
        params: { thread_id: "thread-1" },
      },
    ];
    const userInputRequests = [
      {
        workspace_id: "workspace-1",
        request_id: "input-1",
        params: {
          thread_id: "thread-1",
          turn_id: "turn-1",
          item_id: "item-1",
          questions: [{ id: "q1", header: "Repo", question: "Pick repo" }],
        },
      },
    ];

    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
        models={[
          {
            id: "claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            description: "Anthropic model",
            provider: "anthropic",
            pool: "claude",
            source: "workspace-default",
            available: true,
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ]}
        selectedModelId="claude-sonnet-4-5"
        approvals={approvals}
        userInputRequests={userInputRequests}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open agent command center" }));

    expect(screen.getByTestId("workspace-home-agent-control-stub")).toBeTruthy();
    expect(workspaceHomeAgentControlPropsSpy).toHaveBeenLastCalledWith({
      workspace: { id: "workspace-1", name: "Workspace One" },
      activeModelContext: {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
      },
      approvals,
      userInputRequests,
    });
  });

  it("closes agent settings dialog by backdrop and escape", () => {
    const { container } = render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    const scoped = within(container);
    const settingsButton = scoped
      .getAllByRole("button", { name: "Open agent command center" })
      .at(-1);
    expect(settingsButton).toBeTruthy();
    if (!settingsButton) {
      throw new Error("Expected agent settings button");
    }
    fireEvent.click(settingsButton);
    const backdrop = container.querySelector(".ds-modal-backdrop");
    expect(backdrop).toBeTruthy();
    if (!backdrop) {
      throw new Error("Expected dialog backdrop");
    }
    fireEvent.click(backdrop);
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    fireEvent.click(settingsButton);
    expect(scoped.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows agent settings button only when an active workspace exists", () => {
    const { container, rerender } = render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId={null}
      />
    );
    const scoped = within(container);

    expect(scoped.queryByRole("button", { name: "Open agent command center" })).toBeNull();

    rerender(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    expect(scoped.getByRole("button", { name: "Open agent command center" })).toBeTruthy();
  });

  it(
    "routes runtime-unavailable sends to settings instead of project setup",
    async () => {
      const onOpenProject = vi.fn();
      const onOpenSettings = vi.fn();

      render(
        <Home
          {...baseProps}
          onOpenProject={onOpenProject}
          onOpenSettings={onOpenSettings}
          workspaceLoadError="Code runtime is unavailable for list workspaces."
        />
      );

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      fireEvent.change(input, { target: { value: "help me debug the runtime" } });

      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onOpenSettings).toHaveBeenCalledTimes(1);
      });
      expect(onOpenProject).not.toHaveBeenCalled();
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("keeps home composer outside the scroll area", () => {
    const { container } = render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    expect(
      container.querySelector("[data-home-scroll-area='true'] [data-home-composer-dock='true']")
    ).toBeNull();
    expect(
      container.querySelector("[data-home-content='true'] > [data-home-composer-dock='true']")
    ).toBeTruthy();
    expect(
      container.querySelector(
        "[data-home-content='true'] > [data-home-composer-dock='true'].composer-surface--thread-lane.composer-surface--home"
      )
    ).toBeTruthy();
  });

  it(
    "sends launchpad input through the shared composer send flow",
    async () => {
      const onSend = vi.fn();
      render(
        <Home
          {...baseProps}
          onSend={onSend}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId="workspace-1"
        />
      );

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      fireEvent.change(input, { target: { value: "ship the fix" } });
      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith("ship the fix", [], undefined);
      });
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("injects a starter prompt into the home composer", async () => {
    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
      />
    );

    fireEvent.click(screen.getByTestId("home-launchpad-starter-audit-ui"));

    await waitFor(() => {
      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      expect((input as HTMLTextAreaElement | undefined)?.value).toBe(
        "Audit the current UI/UX of this project, identify the biggest friction points, and implement the highest-leverage improvements to make it feel like a top-tier product."
      );
    });
  });

  it("wires review prompt controls into the home composer", async () => {
    render(
      <Home
        {...baseProps}
        workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
        activeWorkspaceId="workspace-1"
        reviewPrompt={createReviewPromptState()}
        onReviewPromptClose={() => undefined}
        onReviewPromptShowPreset={() => undefined}
        onReviewPromptChoosePreset={() => undefined}
        highlightedPresetIndex={0}
        onReviewPromptHighlightPreset={() => undefined}
        highlightedBranchIndex={0}
        onReviewPromptHighlightBranch={() => undefined}
        highlightedCommitIndex={0}
        onReviewPromptHighlightCommit={() => undefined}
        onReviewPromptKeyDown={() => false}
        onReviewPromptSelectBranch={() => undefined}
        onReviewPromptSelectBranchAtIndex={() => undefined}
        onReviewPromptConfirmBranch={async () => undefined}
        onReviewPromptSelectCommit={() => undefined}
        onReviewPromptSelectCommitAtIndex={() => undefined}
        onReviewPromptConfirmCommit={async () => undefined}
        onReviewPromptUpdateCustomInstructions={() => undefined}
        onReviewPromptConfirmCustom={async () => undefined}
      />
    );

    expect(await screen.findByRole("dialog", { name: "Select a review preset" })).toBeTruthy();
  });

  it(
    "queues send until workspace becomes active when home has no active workspace",
    async () => {
      const onSend = vi.fn();
      const onSelectWorkspace = vi.fn();
      const view = render(
        <Home
          {...baseProps}
          onSend={onSend}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId={null}
        />
      );

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      fireEvent.change(input, { target: { value: "queue after select" } });
      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
      });
      expect(onSend).not.toHaveBeenCalled();

      view.rerender(
        <Home
          {...baseProps}
          onSend={onSend}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId="workspace-1"
        />
      );

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith("queue after select", [], undefined);
      });
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it(
    "routes first send through an explicit workspace handler when home has no active workspace",
    async () => {
      const onSend = vi.fn();
      const onSendToWorkspace = vi.fn();
      const onSelectWorkspace = vi.fn();
      render(
        <Home
          {...baseProps}
          onSend={onSend}
          onSendToWorkspace={onSendToWorkspace}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId={null}
        />
      );

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      fireEvent.change(input, { target: { value: "send directly from home" } });
      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
        expect(onSendToWorkspace).toHaveBeenCalledWith(
          "workspace-1",
          "send directly from home",
          [],
          undefined
        );
      });
      expect(onSend).not.toHaveBeenCalled();
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it(
    "blocks home /review routing in web mode and shows a desktop-only toast",
    async () => {
      vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
      const onSend = vi.fn();
      const onSendToWorkspace = vi.fn();
      const onSelectWorkspace = vi.fn();
      render(
        <Home
          {...baseProps}
          onSend={onSend}
          onSendToWorkspace={onSendToWorkspace}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId={null}
        />
      );

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      fireEvent.change(input, { target: { value: "/review" } });
      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(pushErrorToast).toHaveBeenCalledWith({
          title: "Desktop review only",
          message: "Review start is only available in the desktop app.",
        });
      });
      expect(onSelectWorkspace).not.toHaveBeenCalled();
      expect(onSendToWorkspace).not.toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it(
    "routes an immediate send to the newly selected workspace before activation catches up",
    async () => {
      const onSend = vi.fn();
      const onSendToWorkspace = vi.fn();
      const onSelectWorkspace = vi.fn();
      render(
        <Home
          {...baseProps}
          onSend={onSend}
          onSendToWorkspace={onSendToWorkspace}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[
            { id: "workspace-1", name: "Workspace One" },
            { id: "workspace-2", name: "Workspace Two" },
          ]}
          activeWorkspaceId="workspace-1"
          sidebarCollapsed
        />
      );

      const workspaceTrigger = screen
        .getAllByRole("button", { name: "Select workspace" })
        .find((element) => !element.hasAttribute("disabled"));
      expect(workspaceTrigger).toBeTruthy();
      if (!workspaceTrigger) {
        throw new Error("Expected enabled workspace selector trigger");
      }
      fireEvent.click(workspaceTrigger);
      fireEvent.click(screen.getByRole("option", { name: "Workspace Two" }));

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      fireEvent.change(input, { target: { value: "route immediately after workspace switch" } });
      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSelectWorkspace).toHaveBeenNthCalledWith(1, "workspace-2");
        expect(onSelectWorkspace).toHaveBeenNthCalledWith(2, "workspace-2");
        expect(onSendToWorkspace).toHaveBeenCalledWith(
          "workspace-2",
          "route immediately after workspace switch",
          [],
          undefined
        );
      });
      expect(onSend).not.toHaveBeenCalled();
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("hides the workspace selector while the sidebar is expanded on home", () => {
    render(
      <Home
        {...baseProps}
        workspaces={[
          { id: "workspace-1", name: "Workspace One", connected: true },
          { id: "workspace-2", name: "Workspace Two", connected: true },
        ]}
        activeWorkspaceId="workspace-1"
        sidebarCollapsed={false}
      />
    );

    expect(screen.queryByRole("button", { name: "Select workspace" })).toBeNull();
  });

  it(
    "prefers a connected workspace for first submit routing",
    async () => {
      const onSelectWorkspace = vi.fn();
      render(
        <Home
          {...baseProps}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[
            { id: "workspace-1", name: "Workspace One", connected: false },
            { id: "workspace-2", name: "Workspace Two", connected: true },
          ]}
          activeWorkspaceId={null}
        />
      );

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      fireEvent.change(input, { target: { value: "route to connected workspace" } });
      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-2");
      });
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it(
    "preserves submission order while waiting for workspace activation",
    async () => {
      const onSend = vi.fn();
      const onSelectWorkspace = vi.fn();
      const view = render(
        <Home
          {...baseProps}
          onSend={onSend}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId={null}
        />
      );

      const input = screen.getAllByRole("textbox").at(-1);
      expect(input).toBeTruthy();
      if (!input) {
        throw new Error("Expected composer textbox");
      }
      const sendButton = screen.getAllByRole("button", { name: "Send" }).at(-1);
      expect(sendButton).toBeTruthy();
      if (!sendButton) {
        throw new Error("Expected composer send button");
      }

      fireEvent.change(input, { target: { value: "first queued from home" } });
      fireEvent.click(sendButton);
      fireEvent.change(input, { target: { value: "second queued from home" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
      });

      view.rerender(
        <Home
          {...baseProps}
          onSend={onSend}
          onSelectWorkspace={onSelectWorkspace}
          workspaces={[{ id: "workspace-1", name: "Workspace One" }]}
          activeWorkspaceId="workspace-1"
        />
      );

      await waitFor(() => {
        expect(onSend).toHaveBeenNthCalledWith(1, "first queued from home", [], undefined);
        expect(onSend).toHaveBeenNthCalledWith(2, "second queued from home", [], undefined);
      });
    },
    HOME_INTERACTION_TIMEOUT_MS
  );

  it("keeps the launchpad composer available in time mode", () => {
    render(
      <Home
        {...baseProps}
        usageMetric="time"
        localUsageSnapshot={{
          updatedAt: Date.now(),
          days: [
            {
              day: "2026-01-20",
              inputTokens: 10,
              cachedInputTokens: 0,
              outputTokens: 5,
              totalTokens: 15,
              agentTimeMs: 120000,
              agentRuns: 2,
            },
          ],
          totals: {
            last7DaysTokens: 15,
            last30DaysTokens: 15,
            averageDailyTokens: 15,
            cacheHitRatePercent: 0,
            peakDay: "2026-01-20",
            peakDayTokens: 15,
          },
          topModels: [],
        }}
      />
    );

    expect(screen.queryByTestId("home-scenario-bugfix")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
  });

  it("keeps the launchpad composer available in loading state", () => {
    render(
      <Home {...baseProps} isLoadingLatestAgents isLoadingLocalUsage localUsageSnapshot={null} />
    );

    expect(screen.queryByTestId("home-scenario-bugfix")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
  });

  it("keeps the collapsed home workspace selector on the shared pill token language", () => {
    const controlsSource = readFileSync(
      resolve(import.meta.dirname, "HomeThreadControls.css.ts"),
      "utf8"
    );

    expect(controlsSource).toMatch(
      /"--ds-select-trigger-open-border":\s*"color-mix\(in srgb, var\(--ds-border-subtle\) 40%, transparent\)"/
    );
    expect(controlsSource).toContain('minWidth: "240px"');
    expect(controlsSource).toContain('"--ds-select-menu-max-width": "min(440px, 92vw)"');
    expect(controlsSource).not.toMatch(/"--ds-select-trigger-open-border":\s*"1px solid/);
  });
});
