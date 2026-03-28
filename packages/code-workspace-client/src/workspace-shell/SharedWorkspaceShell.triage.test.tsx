// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { WorkspaceShellApp } from "./WorkspaceShellApp";
import type { MissionControlSnapshot } from "./sharedWorkspaceShellTestHarness";
import { createBindings } from "./sharedWorkspaceShellTestHarness";

describe("WorkspaceShellApp triage", () => {
  it("renders mission and review sections from shared runtime truth", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByRole("button", { name: "Missions" });
    fireEvent.click(screen.getByRole("button", { name: "Missions" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Mission activity" })).toBeTruthy();
    expect(screen.getByText("Approval pending")).toBeTruthy();
    expect(screen.getByText("Ready to resume")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Review queue" })).toBeTruthy();
    expect(screen.getAllByText("Ready for review").length).toBeGreaterThan(0);
    expect(screen.getByText("Passed")).toBeTruthy();
  });

  it("uses the highest-priority mission and review items in the home overview cards", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          readMissionControlSnapshot: async () =>
            ({
              source: "runtime_snapshot_v1",
              generatedAt: 0,
              workspaces: [
                {
                  id: "workspace-1",
                  name: "Alpha",
                  rootPath: "/alpha",
                  connected: true,
                  defaultProfileId: null,
                },
              ],
              tasks: [
                {
                  id: "task-blocked",
                  workspaceId: "workspace-1",
                  title: "Blocked route",
                  objective: null,
                  origin: {
                    kind: "run",
                    threadId: null,
                    runId: "run-blocked",
                    requestId: null,
                  },
                  taskSource: null,
                  mode: null,
                  modeSource: "missing",
                  status: "running",
                  createdAt: 0,
                  updatedAt: 0,
                  currentRunId: "run-blocked",
                  latestRunId: "run-blocked",
                  latestRunState: "running",
                },
              ],
              runs: [
                {
                  id: "run-blocked",
                  workspaceId: "workspace-1",
                  taskId: "task-blocked",
                  state: "running",
                  title: "Blocked route",
                  summary: "Blocked by routing readiness.",
                  taskSource: null,
                  startedAt: 0,
                  finishedAt: null,
                  updatedAt: 0,
                  currentStepIndex: null,
                  placement: {
                    resolvedBackendId: null,
                    requestedBackendIds: [],
                    resolutionSource: "unresolved",
                    lifecycleState: "requested",
                    readiness: "blocked",
                    healthSummary: "blocked",
                    attentionReasons: [],
                    summary: "Blocked by routing readiness.",
                    rationale: null,
                  },
                },
              ],
              reviewPacks: [
                {
                  id: "review-failed",
                  runId: "run-blocked",
                  taskId: "task-blocked",
                  workspaceId: "workspace-1",
                  summary: "Failed review",
                  reviewStatus: "ready",
                  evidenceState: "confirmed",
                  validationOutcome: "failed",
                  warningCount: 0,
                  warnings: [],
                  validations: [],
                  artifacts: [],
                  checksPerformed: [],
                  recommendedNextAction: "Fix the failing validation.",
                  createdAt: 0,
                },
              ],
            }) as unknown as MissionControlSnapshot,
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByText("Routing blocked: Blocked route");
    expect(screen.getByText("Validation failed: Failed review")).toBeTruthy();
  });

  it("preserves item focus when home overview cards route into missions and review", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    const missionsOverviewDetail = await screen.findByText("Approval pending: Launch");
    const missionsOverviewCard = missionsOverviewDetail.closest("button");

    expect(missionsOverviewCard).toBeTruthy();

    fireEvent.click(missionsOverviewCard as HTMLElement);

    expect(await screen.findByRole("heading", { level: 1, name: "Missions" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getByText("Launch")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    const reviewOverviewDetail = await screen.findByText("Ready: Ready for review");
    const reviewOverviewCard = reviewOverviewDetail.closest("button");

    expect(reviewOverviewCard).toBeTruthy();

    fireEvent.click(reviewOverviewCard as HTMLElement);

    expect(await screen.findByRole("heading", { level: 1, name: "Review" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getAllByText("Ready for review").length).toBeGreaterThan(0);
  });

  it("renders an operator triage queue on home and focuses the selected mission entry", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          readMissionControlSnapshot: async () =>
            ({
              source: "runtime_snapshot_v1",
              generatedAt: 0,
              workspaces: [
                {
                  id: "workspace-1",
                  name: "Alpha",
                  rootPath: "/alpha",
                  connected: true,
                  defaultProfileId: null,
                },
              ],
              tasks: [
                {
                  id: "task-approval",
                  workspaceId: "workspace-1",
                  title: "Await approval",
                  objective: null,
                  origin: {
                    kind: "run",
                    threadId: null,
                    runId: "run-approval",
                    requestId: null,
                  },
                  taskSource: null,
                  mode: null,
                  modeSource: "missing",
                  status: "running",
                  createdAt: 0,
                  updatedAt: 0,
                  currentRunId: "run-approval",
                  latestRunId: "run-approval",
                  latestRunState: "running",
                },
              ],
              runs: [
                {
                  id: "run-approval",
                  workspaceId: "workspace-1",
                  taskId: "task-approval",
                  state: "running",
                  title: "Await approval",
                  summary: "Waiting for approval.",
                  taskSource: null,
                  startedAt: 0,
                  finishedAt: null,
                  updatedAt: 0,
                  currentStepIndex: null,
                  approval: {
                    status: "pending_decision",
                    approvalId: "approval-1",
                    label: "Approval pending",
                    summary: "Waiting for operator approval.",
                  },
                },
              ],
              reviewPacks: [],
            }) as unknown as MissionControlSnapshot,
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    const triageHeading = await screen.findByRole("heading", { level: 3, name: "Operator triage" });
    const triageSection = triageHeading.closest("section");

    expect(triageSection).toBeTruthy();

    const triageEntry = await within(triageSection as HTMLElement).findByRole("button", {
      name: /Await approval/i,
    });

    expect(triageEntry).toBeTruthy();

    fireEvent.click(triageEntry);

    expect(await screen.findByRole("heading", { level: 1, name: "Missions" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getByText("Await approval")).toBeTruthy();
  });

  it("prioritizes blocked review items ahead of lower-severity mission activity in the home triage queue", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings({
          readMissionControlSnapshot: async () =>
            ({
              source: "runtime_snapshot_v1",
              generatedAt: 0,
              workspaces: [
                {
                  id: "workspace-1",
                  name: "Alpha",
                  rootPath: "/alpha",
                  connected: true,
                  defaultProfileId: null,
                },
              ],
              tasks: [
                {
                  id: "task-active",
                  workspaceId: "workspace-1",
                  title: "Long compile",
                  objective: null,
                  origin: {
                    kind: "run",
                    threadId: null,
                    runId: "run-active",
                    requestId: null,
                  },
                  taskSource: null,
                  mode: null,
                  modeSource: "missing",
                  status: "running",
                  createdAt: 0,
                  updatedAt: 0,
                  currentRunId: "run-active",
                  latestRunId: "run-active",
                  latestRunState: "running",
                },
              ],
              runs: [
                {
                  id: "run-active",
                  workspaceId: "workspace-1",
                  taskId: "task-active",
                  state: "running",
                  title: "Long compile",
                  summary: "Still compiling.",
                  taskSource: null,
                  startedAt: 0,
                  finishedAt: null,
                  updatedAt: 0,
                  currentStepIndex: null,
                },
              ],
              reviewPacks: [
                {
                  id: "review-failed",
                  runId: "run-active",
                  taskId: "task-active",
                  workspaceId: "workspace-1",
                  summary: "Lint failure",
                  reviewStatus: "ready",
                  evidenceState: "complete",
                  validationOutcome: "failed",
                  warningCount: 0,
                  warnings: [],
                  validations: [],
                  artifacts: [],
                  checksPerformed: [],
                  recommendedNextAction: "Fix the failing lint validation.",
                  createdAt: 0,
                },
              ],
            }) as unknown as MissionControlSnapshot,
        })}
      >
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    const triageHeading = await screen.findByRole("heading", {
      level: 3,
      name: "Operator triage",
    });
    const triageSection = triageHeading.closest("section");

    expect(triageSection).toBeTruthy();

    await within(triageSection as HTMLElement).findByRole("button", { name: /Lint failure/i });

    const triageButtons = within(triageSection as HTMLElement).getAllByRole("button");

    expect(triageButtons[0]?.textContent).toContain("Lint failure");
    expect(triageButtons[1]?.textContent).toContain("Long compile");

    fireEvent.click(triageButtons[0] as HTMLElement);

    expect(await screen.findByRole("heading", { level: 1, name: "Review" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getByText("Lint failure")).toBeTruthy();
  });

  it("routes the operator-next card into the relevant shared section and focuses the top item", async () => {
    window.history.pushState({}, "", "/app");

    render(
      <WorkspaceClientBindingsProvider bindings={createBindings()}>
        <WorkspaceShellApp />
      </WorkspaceClientBindingsProvider>
    );

    await screen.findByRole("button", { name: "Open missions" });
    fireEvent.click(screen.getByRole("button", { name: "Open missions" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Missions" })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 2, name: "Mission activity" })).toBeTruthy();
    expect(screen.getByText("Operator focus")).toBeTruthy();
    expect(screen.getByText("Launch")).toBeTruthy();
  }, 15_000);
});
