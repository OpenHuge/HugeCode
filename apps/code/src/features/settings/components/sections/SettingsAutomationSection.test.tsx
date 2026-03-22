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

function createSummaries(): SettingsAutomationScheduleSummary[] {
  return [
    {
      id: "schedule-daily-review",
      name: "Daily review sweep",
      prompt: "Inspect the queue and summarize follow-up work.",
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
    },
    {
      id: "schedule-nightly-check",
      name: "Nightly health check",
      prompt: "Validate the runtime summary and report blockers.",
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
    defaultBackendId: "backend-primary",
    schedules: createSummaries(),
    loading: false,
    error: null,
    readOnlyReason: null,
    onRefreshSchedules: vi.fn(),
    onCreateSchedule: vi.fn(async (_draft: SettingsAutomationScheduleDraft) => undefined),
    onUpdateSchedule: vi.fn(
      async (_scheduleId: string, _draft: SettingsAutomationScheduleDraft) => undefined
    ),
    onScheduleAction: vi.fn(async () => undefined),
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
      <SettingsAutomationSection backendOptions={[]} defaultBackendId={null} schedules={[]} />
    );

    expect(
      screen.getByText("Scheduled automations", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(screen.getByText(/No runtime-confirmed schedules are available yet\./)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "New schedule" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Schedule name")).toBeTruthy();
  });

  it("switches between summaries and invokes run controls for the selected schedule", async () => {
    const onScheduleAction = vi.fn(async () => undefined);

    render(<SettingsAutomationSection {...createProps({ onScheduleAction })} />);

    expect(screen.getAllByText("Daily review sweep").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nightly health check").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Resume schedule" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1] as HTMLButtonElement);
    });

    expect(screen.getByRole("button", { name: "Pause schedule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel current run" })).toBeTruthy();

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
      cadence: "",
      backendId: "backend-primary",
      reviewProfileId: "",
      validationPresetId: "",
      enabled: true,
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
      cadence: "Every weekday at 09:00",
      backendId: "backend-primary",
      reviewProfileId: "issue-review",
      validationPresetId: "standard",
      enabled: false,
    });
  });
});
