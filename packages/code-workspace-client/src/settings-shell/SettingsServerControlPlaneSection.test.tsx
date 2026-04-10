// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockRuntimeComposition = {
  profiles: [{ id: "profile-1", name: "Workspace Default", scope: "workspace" }],
  settings: {
    selection: {
      profileId: "profile-1",
      preferredBackendIds: ["backend-1"],
    },
    persistence: {
      publisherSessionId: "publisher-session-1",
      lastAcceptedAuthorityRevision: 9,
      lastPublishAttemptAt: 1_710_000_000_000,
      lastPublishedAt: 1_710_000_100_000,
    },
  },
  resolution: {
    selectedPlugins: [{ id: "plugin-1" }],
    blockedPlugins: [],
    selectedRouteCandidates: [{ routeId: "route-1" }],
    selectedBackendCandidates: [{ backendId: "backend-1" }],
    provenance: {
      appliedLayerOrder: ["built_in", "workspace"],
      selectorDecisions: {
        profile: "workspace-default",
      },
    },
  },
  snapshot: {
    authorityState: "published",
    freshnessState: "current",
  },
  activeProfile: {
    id: "profile-1",
    name: "Workspace Default",
  },
  previewProfileId: null,
  previewResolution: null,
  previewSnapshot: null,
  isLoading: false,
  isMutating: false,
  error: null,
  previewProfile: vi.fn(async (profileId: string) => {
    mockRuntimeComposition.previewProfileId = profileId;
    mockRuntimeComposition.previewResolution = {
      selectedPlugins: [{ id: "plugin-preview" }],
      blockedPlugins: [],
      selectedRouteCandidates: [{ routeId: "route-preview" }],
      selectedBackendCandidates: [{ backendId: "backend-2" }],
      provenance: {
        appliedLayerOrder: ["built_in", "user", "workspace"],
        selectorDecisions: {
          profile: profileId,
        },
      },
    };
    mockRuntimeComposition.previewSnapshot = {
      activeProfile: {
        id: profileId,
        name: "Workspace Default",
      },
      authorityState: "stale",
      freshnessState: "pending_publish",
    };
    return mockRuntimeComposition.previewSnapshot;
  }),
  applyProfile: vi.fn(async () => undefined),
  saveSettings: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined),
  publishActiveResolution: vi.fn(async () => undefined),
  clearPreview: vi.fn(() => {
    mockRuntimeComposition.previewProfileId = null;
    mockRuntimeComposition.previewResolution = null;
    mockRuntimeComposition.previewSnapshot = null;
  }),
};

vi.mock("@ku0/design-system", () => ({
  Button: ({
    ariaLabel,
    children,
    className,
    disabled,
    onClick,
    title,
    type = "button",
  }: {
    ariaLabel?: string;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    title?: string;
    type?: "button" | "submit" | "reset";
  }) => (
    <button
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type={type}
    >
      {children}
    </button>
  ),
  Input: ({
    id,
    value,
    onValueChange,
    placeholder,
  }: {
    id?: string;
    value: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onValueChange?.(event.target.value)}
    />
  ),
  Select: ({
    ariaLabel,
    disabled,
    onValueChange,
    options,
    value,
  }: {
    ariaLabel: string;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    value: string;
  }) => (
    <label>
      <span>{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  ShellSection: ({
    children,
    className,
    title,
    meta,
  }: {
    children: ReactNode;
    className?: string;
    title?: ReactNode;
    meta?: ReactNode;
  }) => (
    <section className={className}>
      <div>{title}</div>
      <div>{meta}</div>
      {children}
    </section>
  ),
  StatusBadge: ({ children, tone }: { children: ReactNode; tone?: string }) => (
    <span data-tone={tone ?? "default"}>{children}</span>
  ),
  Switch: ({
    "aria-label": ariaLabel,
    checked,
    onCheckedChange,
  }: {
    "aria-label": string;
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      aria-label={ariaLabel}
      checked={checked}
      type="checkbox"
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
  Textarea: ({
    id,
    onChange,
    placeholder,
    value,
  }: {
    id?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    value: string;
  }) => (
    <textarea
      id={id}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    />
  ),
}));

vi.mock("../workspace/WorkspaceClientBindingsProvider", () => ({
  useMaybeWorkspaceClientBindings: () => ({
    navigation: {
      readRouteSelection: () => ({
        kind: "workspace",
        workspaceId: "workspace-1",
      }),
    },
  }),
}));

vi.mock("../settings-state", () => ({
  useSharedRuntimeCompositionState: () => mockRuntimeComposition,
}));

import { SettingsServerControlPlaneSection, createSettingsServerOperabilityState } from "./index";

describe("SettingsServerControlPlaneSection", () => {
  it("routes server control-plane interactions through the shared section contract", async () => {
    const onSetDefaultExecutionBackend = vi.fn(async () => undefined);
    const onRefreshBackendPool = vi.fn();
    const onRefreshAutomationSchedules = vi.fn();
    const onOpenMissionTarget = vi.fn();

    render(
      <SettingsServerControlPlaneSection
        remoteExecutionBackendOptions={[
          { id: "backend-1", label: "Backend One" },
          { id: "backend-2", label: "Backend Two" },
        ]}
        defaultRemoteExecutionBackendId="backend-1"
        onSetDefaultExecutionBackend={onSetDefaultExecutionBackend}
        workspaceOptions={[{ id: "workspace-1", label: "Workspace One" }]}
        backendPoolVisible
        backendPool={{
          backends: [],
          backendsTotal: 0,
          backendsHealthy: 0,
          backendsDraining: 0,
          queueDepth: 0,
        }}
        onRefreshBackendPool={onRefreshBackendPool}
        automationSchedules={[
          {
            id: "schedule-1",
            name: "Nightly review",
            prompt: "Inspect open PRs.",
            workspaceId: "workspace-1",
            cadenceLabel: "Every weekday at 09:00",
            status: "active",
            nextRunAtMs: 1_710_000_000_000,
            lastRunAtMs: 1_709_000_000_000,
            lastOutcomeLabel: "Passed",
            backendId: "backend-2",
            backendLabel: "Backend Two",
            reviewProfileId: "issue-review",
            reviewProfileLabel: "Issue Review",
            validationPresetId: "standard",
            validationPresetLabel: "Standard",
            triggerSourceLabel: "schedule",
            blockingReason: null,
            safeFollowUp: true,
            autonomyProfile: "night_operator",
            sourceScope: "workspace_graph",
            wakePolicy: "auto_queue",
            researchPolicy: "repository_only",
            queueBudget: 2,
            currentTaskId: "task-1",
            currentTaskStatus: "running",
            currentRunId: "run-1",
            lastTriggeredTaskId: null,
            lastTriggeredTaskStatus: null,
            lastTriggeredRunId: null,
            reviewPackId: "review-1",
            reviewActionabilityState: "ready",
          },
        ]}
        automationSchedulesOperability={createSettingsServerOperabilityState()}
        onRefreshAutomationSchedules={onRefreshAutomationSchedules}
        onOpenMissionTarget={onOpenMissionTarget}
      />
    );

    fireEvent.change(screen.getByLabelText("Default execution backend"), {
      target: { value: "backend-2" },
    });
    expect(onSetDefaultExecutionBackend).toHaveBeenCalledWith("backend-2");

    fireEvent.click(screen.getByRole("button", { name: "Refresh composition" }));
    await waitFor(() => {
      expect(mockRuntimeComposition.refresh).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish authority snapshot" }));
    await waitFor(() => {
      expect(mockRuntimeComposition.publishActiveResolution).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText("Preview profile"), {
      target: { value: "profile-1" },
    });
    await waitFor(() => {
      expect(mockRuntimeComposition.previewProfile).toHaveBeenCalledWith("profile-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefreshBackendPool).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Refresh summaries" }));
    expect(onRefreshAutomationSchedules).toHaveBeenCalled();

    expect(screen.getAllByText("Nightly review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Backend: Backend Two").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Open review" })[0]!);
    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "review",
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-1",
      limitation: "thread_unavailable",
    });

    expect(screen.getByText(/Publisher session: publisher-session-1/)).toBeTruthy();
    expect(screen.getByText(/Selector decisions: profile: workspace-default/)).toBeTruthy();
    expect(screen.getByText(/Preview authority: stale \/ pending_publish/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear preview" }));
    expect(mockRuntimeComposition.clearPreview).toHaveBeenCalled();
  });
});
