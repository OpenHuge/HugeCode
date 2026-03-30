// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  SettingsAutomationScheduleDraft,
  SettingsAutomationScheduleSummary,
  SettingsAutomationSectionProps,
} from "./SettingsAutomationSection";
import { SettingsAutomationSection } from "./SettingsAutomationSection";

function createOperability(
  overrides: Partial<NonNullable<SettingsAutomationSectionProps["operability"]>> = {}
) {
  return {
    capabilityEnabled: true,
    loading: false,
    error: null,
    readOnlyReason: null,
    unavailableReason: null,
    ...overrides,
  };
}

function createSummaries(): SettingsAutomationScheduleSummary[] {
  return [
    {
      id: "schedule-daily-review",
      name: "Daily review sweep",
      prompt: "Inspect the queue and summarize follow-up work.",
      workspaceId: "workspace-alpha",
      cadenceLabel: "Every weekday at 09:00",
      status: "paused",
      nextRunAtMs: null,
      lastRunAtMs: 1_710_000_000_000,
      lastOutcomeLabel: "Paused after review",
      backendId: "backend-primary",
      backendLabel: "Primary backend",
      reviewProfileId: "issue-review",
      reviewProfileLabel: "Issue review",
      validationPresetId: "standard",
      validationPresetLabel: "Standard validation",
      triggerSourceLabel: "schedule",
      blockingReason: null,
      safeFollowUp: true,
      autonomyProfile: "night_operator",
      sourceScope: "workspace_graph",
      wakePolicy: "auto_queue",
      researchPolicy: "repository_only",
      queueBudget: 2,
      currentTaskId: null,
      currentTaskStatus: null,
      currentRunId: null,
      lastTriggeredTaskId: "task-daily-review",
      lastTriggeredTaskStatus: "completed",
      lastTriggeredRunId: "run-daily-review",
      reviewPackId: "review-pack:task-daily-review",
      reviewActionabilityState: "ready",
    },
    {
      id: "schedule-nightly-check",
      name: "Nightly health check",
      prompt: "Validate the runtime summary and report blockers.",
      workspaceId: "workspace-beta",
      cadenceLabel: "Every day at 23:00",
      status: "running",
      nextRunAtMs: 1_710_086_400_000,
      lastRunAtMs: 1_710_082_800_000,
      lastOutcomeLabel: "Running",
      backendId: "backend-secondary",
      backendLabel: "Secondary backend",
      reviewProfileId: "health-review",
      reviewProfileLabel: "Health review",
      validationPresetId: "strict",
      validationPresetLabel: "Strict validation",
      triggerSourceLabel: "schedule",
      blockingReason: "Waiting for validation results.",
      safeFollowUp: false,
      autonomyProfile: "night_operator",
      sourceScope: "workspace_graph_and_public_web",
      wakePolicy: "review_queue",
      researchPolicy: "staged",
      queueBudget: 3,
      currentTaskId: "task-nightly-check",
      currentTaskStatus: "running",
      currentRunId: "run-nightly-check",
      lastTriggeredTaskId: "task-nightly-check",
      lastTriggeredTaskStatus: "running",
      lastTriggeredRunId: "run-nightly-check",
      reviewPackId: null,
      reviewActionabilityState: "pending",
    },
  ];
}

function createProps(
  overrides: Partial<SettingsAutomationSectionProps> = {}
): SettingsAutomationSectionProps {
  return {
    backendOptions: [
      { id: "backend-primary", label: "Primary backend" },
      { id: "backend-secondary", label: "Secondary backend" },
    ],
    workspaceOptions: [
      { id: "workspace-alpha", label: "Workspace Alpha" },
      { id: "workspace-beta", label: "Workspace Beta" },
    ],
    defaultBackendId: "backend-primary",
    schedules: createSummaries(),
    operability: createOperability(),
    actionAvailability: {
      createEnabled: true,
      updateEnabled: true,
      runNowEnabled: true,
      cancelRunEnabled: true,
    },
    onRefreshSchedules: vi.fn(),
    onCreateSchedule: vi.fn(async (_draft: SettingsAutomationScheduleDraft) => undefined),
    onUpdateSchedule: vi.fn(
      async (_scheduleId: string, _draft: SettingsAutomationScheduleDraft) => undefined
    ),
    onScheduleAction: vi.fn(async () => undefined),
    onOpenMissionTarget: vi.fn(async () => undefined),
    ...overrides,
  };
}

function clickButtonByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent?.trim() === text && !element.disabled
  );
  expect(button).toBeTruthy();
  fireEvent.click(button as HTMLButtonElement);
}

describe("SettingsAutomationSection", () => {
  it("renders an empty state when no runtime summaries are available yet", () => {
    render(
      <SettingsAutomationSection
        {...createProps({
          backendOptions: [],
          workspaceOptions: [],
          defaultBackendId: null,
          schedules: [],
        })}
      />
    );

    expect(
      screen.getByText("Scheduled automations", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      screen.getByText(/No runtime-confirmed schedules are currently published by the runtime\./)
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "New schedule" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Schedule name")).toBeTruthy();
  });

  it("stays read-only when runtime schedule control is unavailable", () => {
    const { container } = render(
      <SettingsAutomationSection
        {...createProps({
          schedules: [],
          operability: createOperability({
            capabilityEnabled: false,
            unavailableReason: "Runtime schedule summaries are unavailable in current runtime.",
          }),
          actionAvailability: {
            createEnabled: false,
            updateEnabled: false,
            runNowEnabled: false,
            cancelRunEnabled: false,
          },
        })}
      />
    );

    const newScheduleButton = screen.getByRole("button", { name: "New schedule" });
    expect(newScheduleButton).toBeTruthy();
    expect((newScheduleButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(
        "Unavailable: Runtime schedule summaries are unavailable in current runtime."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /No runtime-confirmed schedules are available because this surface is unavailable\./
      )
    ).toBeTruthy();

    const saveButton = within(container).getByRole("button", { name: "Create schedule" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a unified read-only message when summaries are available but actions are downgraded", () => {
    const { container } = render(
      <SettingsAutomationSection
        {...createProps({
          operability: createOperability({
            readOnlyReason: "Some runtime schedule actions are unavailable in current runtime.",
          }),
          actionAvailability: {
            createEnabled: false,
            updateEnabled: false,
            runNowEnabled: true,
            cancelRunEnabled: true,
          },
        })}
      />
    );

    expect(
      screen.getByText(
        "Read-only: Some runtime schedule actions are unavailable in current runtime."
      )
    ).toBeTruthy();
    const saveButton = within(container).getByRole("button", { name: "Save changes" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect((saveButton as HTMLButtonElement).getAttribute("title")).toBe(
      "Some runtime schedule actions are unavailable in current runtime."
    );
  });

  it("switches between summaries and invokes run controls for the selected schedule", async () => {
    const onScheduleAction = vi.fn(async () => undefined);

    const { container } = render(
      <SettingsAutomationSection {...createProps({ onScheduleAction })} />
    );

    expect(screen.getAllByText("Daily review sweep").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nightly health check").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Resume schedule" })).toBeTruthy();
    expect(screen.getAllByText("Review ready").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review pending").length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1] as HTMLButtonElement);
    });

    expect(screen.getByRole("button", { name: "Pause schedule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel current run" })).toBeTruthy();
    expect(within(container).getAllByText("Workspace: Workspace Beta").length).toBeGreaterThan(0);
    expect(within(container).getByText("Active task: task-nightly-check (running)")).toBeTruthy();
    expect(within(container).getByText("Active run: run-nightly-check")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run now" }));
    });

    expect(onScheduleAction).toHaveBeenCalledWith({
      scheduleId: "schedule-nightly-check",
      action: "run-now",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pause schedule" }));
    });

    expect(onScheduleAction).toHaveBeenCalledWith({
      scheduleId: "schedule-nightly-check",
      action: "pause",
    });
  });

  it("opens the review surface from the schedule summary when a review pack is available", async () => {
    const onOpenMissionTarget = vi.fn(async () => undefined);

    const { container } = render(
      <SettingsAutomationSection {...createProps({ onOpenMissionTarget })} />
    );

    await act(async () => {
      fireEvent.click(
        within(container).getAllByRole("button", {
          name: "Open review for Daily review sweep",
        })[0] as HTMLButtonElement
      );
    });

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "review",
      workspaceId: "workspace-alpha",
      taskId: "task-daily-review",
      runId: "run-daily-review",
      reviewPackId: "review-pack:task-daily-review",
      limitation: "thread_unavailable",
    });
  });

  it("opens the mission surface when the selected schedule only has task/run linkage", async () => {
    const onOpenMissionTarget = vi.fn(async () => undefined);

    const { container } = render(
      <SettingsAutomationSection
        {...createProps({
          onOpenMissionTarget,
          schedules: [createSummaries()[1] as SettingsAutomationScheduleSummary],
        })}
      />
    );

    expect(within(container).getByText("Active task: task-nightly-check (running)")).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        within(container).getAllByRole("button", {
          name: "Open mission for Nightly health check",
        })[0] as HTMLButtonElement
      );
    });

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "mission",
      workspaceId: "workspace-beta",
      taskId: "task-nightly-check",
      runId: "run-nightly-check",
      reviewPackId: null,
      threadId: null,
      limitation: "thread_unavailable",
    });
  });

  it("creates a draft schedule through the runtime-facing callback", async () => {
    const onCreateSchedule = vi.fn(async () => undefined);

    const { container } = render(
      <SettingsAutomationSection
        {...createProps({
          onCreateSchedule,
          schedules: [],
        })}
      />
    );

    await act(async () => {
      clickButtonByText(container, "Create schedule");
    });

    expect(onCreateSchedule).toHaveBeenCalledWith({
      name: "",
      prompt: "",
      workspaceId: "",
      cadence: "",
      backendId: "backend-primary",
      reviewProfileId: "",
      validationPresetId: "",
      enabled: true,
      autonomyProfile: "night_operator",
      sourceScope: "workspace_graph",
      wakePolicy: "auto_queue",
      researchPolicy: "repository_only",
      queueBudget: "2",
      safeFollowUp: true,
    });
    expect(within(container).getByText("Selected runtime summary")).toBeTruthy();
  });

  it("updates an existing schedule through the runtime-facing callback", async () => {
    const onUpdateSchedule = vi.fn(async () => undefined);

    const { container } = render(
      <SettingsAutomationSection
        {...createProps({
          onUpdateSchedule,
        })}
      />
    );

    await act(async () => {
      clickButtonByText(container, "Save changes");
    });

    expect(onUpdateSchedule).toHaveBeenCalledWith("schedule-daily-review", {
      name: "Daily review sweep",
      prompt: "Inspect the queue and summarize follow-up work.",
      workspaceId: "workspace-alpha",
      cadence: "Every weekday at 09:00",
      backendId: "backend-primary",
      reviewProfileId: "issue-review",
      validationPresetId: "standard",
      enabled: false,
      autonomyProfile: "night_operator",
      sourceScope: "workspace_graph",
      wakePolicy: "auto_queue",
      researchPolicy: "repository_only",
      queueBudget: "2",
      safeFollowUp: true,
    });
  });

  it("disables run-now when the selected schedule has no workspace context", async () => {
    const { container } = render(
      <SettingsAutomationSection
        {...createProps({
          schedules: [
            {
              ...createSummaries()[0],
              id: "schedule-missing-workspace",
              workspaceId: null,
              status: "paused",
            },
          ],
        })}
      />
    );

    const runNowButton = within(container).getAllByRole("button", { name: "Run now" }).at(-1);
    expect(runNowButton).toBeTruthy();
    expect((runNowButton as HTMLButtonElement).disabled).toBe(true);
    expect((runNowButton as HTMLButtonElement).getAttribute("title")).toBe(
      "Select a workspace and prompt before launching."
    );
  });
});
