// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../types";
import type { SettingsAutomationScheduleDraft } from "@ku0/code-workspace-client/settings-shell";
import { useSettingsServerState } from "./useSettingsServerState";

const pushErrorToastMock = vi.hoisted(() => vi.fn());
const useRuntimeAutomationSchedulesFacadeMock = vi.hoisted(() => vi.fn());
const useRuntimeBackendPoolFacadeMock = vi.hoisted(() => vi.fn());
const useRuntimeOverlayConnectivityFacadeMock = vi.hoisted(() => vi.fn());
const readRemoteServerProfilesStateMock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/facades/runtimeAutomationSchedulesFacade", () => ({
  useRuntimeAutomationSchedulesFacade: (...args: unknown[]) =>
    useRuntimeAutomationSchedulesFacadeMock(...args),
}));

vi.mock("../../../application/runtime/facades/runtimeBackendPoolFacade", () => ({
  useRuntimeBackendPoolFacade: (...args: unknown[]) => useRuntimeBackendPoolFacadeMock(...args),
}));

vi.mock("../../../application/runtime/facades/runtimeOverlayConnectivityFacade", () => ({
  useRuntimeOverlayConnectivityFacade: (...args: unknown[]) =>
    useRuntimeOverlayConnectivityFacadeMock(...args),
}));

vi.mock("../../../application/runtime/facades/runtimeRemoteServerProfilesFacade", () => ({
  createRemoteServerProfileDraft: vi.fn((overrides?: Record<string, unknown>) => ({
    id: "profile-1",
    label: "Runtime backend",
    provider: "tcp",
    host: "runtime.example.test",
    ...overrides,
  })),
  readRemoteServerProfilesState: (...args: unknown[]) => readRemoteServerProfilesStateMock(...args),
  removeRemoteServerProfile: vi.fn((settings: AppSettings) => settings),
  setDefaultRemoteExecutionBackend: vi.fn((settings: AppSettings) => settings),
  setDefaultRemoteServerProfile: vi.fn((settings: AppSettings) => settings),
  upsertRemoteServerProfile: vi.fn((settings: AppSettings) => settings),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => pushErrorToastMock(...args),
}));

vi.mock("../../../utils/platformPaths", () => ({
  isMobilePlatform: () => false,
}));

function createAutomationFacade(overrides: Record<string, unknown> = {}) {
  return {
    automationSchedulesCapabilityEnabled: true,
    automationSchedulesSnapshot: [
      {
        id: "schedule-1",
        enabled: true,
        name: "Nightly review",
        status: "idle",
        workspaceId: "workspace-1",
        prompt: "Review the queue.",
        cadenceLabel: "Every day at 23:00",
        preferredBackendId: "backend-primary",
      },
    ],
    automationSchedulesLoading: false,
    automationSchedulesError: null,
    automationSchedulesUnavailableReason: null,
    automationSchedulesReadOnlyReason: null,
    automationSchedulesCreateEnabled: true,
    automationSchedulesUpdateEnabled: true,
    automationSchedulesDeleteEnabled: true,
    automationSchedulesRunNowEnabled: true,
    automationSchedulesCancelRunEnabled: true,
    refreshAutomationSchedules: vi.fn(),
    createAutomationSchedule: vi.fn(),
    updateAutomationSchedule: vi.fn(),
    deleteAutomationSchedule: vi.fn(),
    runAutomationScheduleNow: vi.fn(),
    cancelAutomationScheduleRun: vi.fn(),
    ...overrides,
  };
}

function createBackendPoolFacade(overrides: Record<string, unknown> = {}) {
  return {
    backendPoolCapabilityEnabled: true,
    backendPoolSnapshot: {
      backends: [
        {
          backendId: "backend-primary",
          label: "Primary backend",
        },
      ],
    },
    backendPoolLoading: false,
    backendPoolError: null,
    backendPoolSectionReadOnlyReason: null,
    backendPoolStateActionsEnabled: true,
    backendPoolRemoveEnabled: true,
    backendPoolUpsertEnabled: true,
    backendPoolProbeEnabled: true,
    acpIntegrationsSnapshot: [],
    backendPoolBootstrapPreview: null,
    backendPoolBootstrapPreviewError: null,
    backendPoolDiagnostics: null,
    backendPoolDiagnosticsError: null,
    refreshBackendPool: vi.fn(),
    handleBackendPoolAction: vi.fn(),
    upsertRuntimeBackend: vi.fn(),
    upsertAcpBackend: vi.fn(),
    handleAcpBackendProbe: vi.fn(),
    ...overrides,
  };
}

function createOverlayFacade(overrides: Record<string, unknown> = {}) {
  return {
    orbitStatusText: null,
    orbitAuthCode: null,
    orbitVerificationUrl: null,
    orbitBusyAction: null,
    tailscaleStatus: null,
    tailscaleStatusBusy: false,
    tailscaleStatusError: null,
    tailscaleCommandPreview: null,
    tailscaleCommandBusy: false,
    tailscaleCommandError: null,
    netbirdStatus: null,
    netbirdStatusBusy: false,
    netbirdStatusError: null,
    netbirdCommandPreview: null,
    netbirdCommandBusy: false,
    netbirdCommandError: null,
    tcpDaemonStatus: null,
    tcpDaemonBusyAction: null,
    mobileConnectBusy: false,
    mobileConnectStatusText: null,
    mobileConnectStatusError: null,
    handleRefreshTailscaleStatus: vi.fn(),
    handleRefreshTailscaleCommandPreview: vi.fn(),
    handleRefreshNetbirdStatus: vi.fn(),
    handleRefreshNetbirdCommandPreview: vi.fn(),
    handleTcpDaemonStart: vi.fn(),
    handleTcpDaemonStop: vi.fn(),
    handleTcpDaemonStatus: vi.fn(),
    handleOrbitConnectTest: vi.fn(),
    handleOrbitSignIn: vi.fn(),
    handleOrbitSignOut: vi.fn(),
    handleOrbitRunnerStart: vi.fn(),
    handleOrbitRunnerStop: vi.fn(),
    handleOrbitRunnerStatus: vi.fn(),
    handleMobileConnectTest: vi.fn(),
    ...overrides,
  };
}

const baseAppSettings = {} as AppSettings;
const baseDraft: SettingsAutomationScheduleDraft = {
  name: "Nightly review",
  prompt: "Review the queue.",
  workspaceId: "workspace-1",
  cadence: "Every day at 23:00",
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
};

describe("useSettingsServerState schedule handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readRemoteServerProfilesStateMock.mockReturnValue({
      profiles: [
        {
          id: "profile-1",
          label: "Runtime backend",
          provider: "tcp",
          host: "runtime.example.test",
        },
      ],
      selectedProfileId: "profile-1",
      defaultProfileId: "profile-1",
      defaultExecutionBackendId: "backend-primary",
    });
    useRuntimeAutomationSchedulesFacadeMock.mockReturnValue(createAutomationFacade());
    useRuntimeBackendPoolFacadeMock.mockReturnValue(createBackendPoolFacade());
    useRuntimeOverlayConnectivityFacadeMock.mockReturnValue(createOverlayFacade());
  });

  it("shows a clear toast when saving a schedule update fails", async () => {
    const updateAutomationSchedule = vi.fn(async () => {
      throw new Error("Runtime schedule update is unavailable in current runtime.");
    });
    useRuntimeAutomationSchedulesFacadeMock.mockReturnValue(
      createAutomationFacade({
        updateAutomationSchedule,
      })
    );

    const { result } = renderHook(() =>
      useSettingsServerState({
        activeSection: "server",
        appSettings: baseAppSettings,
        onUpdateAppSettings: vi.fn(async () => undefined),
        orbitServiceClient: {} as never,
      })
    );

    await act(async () => {
      await result.current.handleUpdateAutomationSchedule("schedule-1", baseDraft);
    });

    expect(pushErrorToastMock).toHaveBeenCalledWith({
      title: "Schedule update failed",
      message: "Runtime schedule update is unavailable in current runtime.",
    });
  });

  it("shows a clear toast when run-now fails", async () => {
    const runAutomationScheduleNow = vi.fn(async () => {
      throw new Error("Runtime schedule run-now is unavailable in current runtime.");
    });
    useRuntimeAutomationSchedulesFacadeMock.mockReturnValue(
      createAutomationFacade({
        runAutomationScheduleNow,
      })
    );

    const { result } = renderHook(() =>
      useSettingsServerState({
        activeSection: "server",
        appSettings: baseAppSettings,
        onUpdateAppSettings: vi.fn(async () => undefined),
        orbitServiceClient: {} as never,
      })
    );

    await act(async () => {
      await result.current.handleAutomationScheduleAction({
        scheduleId: "schedule-1",
        action: "run-now",
      });
    });

    expect(pushErrorToastMock).toHaveBeenCalledWith({
      title: "Schedule action failed",
      message: "Runtime schedule run-now is unavailable in current runtime.",
    });
  });

  it("shows a clear toast when cancel-run fails", async () => {
    const cancelAutomationScheduleRun = vi.fn(async () => {
      throw new Error("Runtime schedule cancel-run is unavailable in current runtime.");
    });
    useRuntimeAutomationSchedulesFacadeMock.mockReturnValue(
      createAutomationFacade({
        cancelAutomationScheduleRun,
      })
    );

    const { result } = renderHook(() =>
      useSettingsServerState({
        activeSection: "server",
        appSettings: baseAppSettings,
        onUpdateAppSettings: vi.fn(async () => undefined),
        orbitServiceClient: {} as never,
      })
    );

    await act(async () => {
      await result.current.handleAutomationScheduleAction({
        scheduleId: "schedule-1",
        action: "cancel-run",
      });
    });

    expect(pushErrorToastMock).toHaveBeenCalledWith({
      title: "Schedule action failed",
      message: "Runtime schedule cancel-run is unavailable in current runtime.",
    });
  });

  it("exposes a unified operability contract for server sections", () => {
    useRuntimeAutomationSchedulesFacadeMock.mockReturnValue(
      createAutomationFacade({
        automationSchedulesCapabilityEnabled: false,
        automationSchedulesUnavailableReason:
          "Runtime schedule control is unavailable in current runtime.",
        automationSchedulesReadOnlyReason: null,
      })
    );

    const { result } = renderHook(() =>
      useSettingsServerState({
        activeSection: "server",
        appSettings: baseAppSettings,
        onUpdateAppSettings: vi.fn(async () => undefined),
        orbitServiceClient: {} as never,
      })
    );

    expect(result.current.serverOperability.remoteProfiles).toMatchObject({
      capabilityEnabled: true,
      loading: false,
      error: null,
      readOnlyReason: null,
      unavailableReason: null,
    });
    expect(result.current.serverOperability.transportMode).toMatchObject({
      capabilityEnabled: true,
      loading: false,
      error: null,
      readOnlyReason: null,
      unavailableReason: null,
    });
    expect(result.current.serverOperability.gateway).toMatchObject({
      capabilityEnabled: true,
      loading: false,
      error: null,
      readOnlyReason: null,
      unavailableReason: null,
    });
    expect(result.current.serverOperability.tcpTransport).toMatchObject({
      capabilityEnabled: true,
      loading: false,
      error: null,
      readOnlyReason: null,
      unavailableReason: null,
    });
    expect(result.current.serverOperability.orbitTransport).toMatchObject({
      capabilityEnabled: true,
      loading: false,
      error: null,
      readOnlyReason: null,
      unavailableReason: null,
    });
    expect(result.current.serverOperability.automationSchedules).toMatchObject({
      capabilityEnabled: false,
      loading: false,
      error: null,
      readOnlyReason: null,
      unavailableReason: "Runtime schedule control is unavailable in current runtime.",
    });
  });

  it("does not invent gateway unavailability when no remote profile is selected", () => {
    readRemoteServerProfilesStateMock.mockReturnValue({
      profiles: [],
      selectedProfileId: null,
      defaultProfileId: null,
      defaultExecutionBackendId: null,
    });

    const { result } = renderHook(() =>
      useSettingsServerState({
        activeSection: "server",
        appSettings: baseAppSettings,
        onUpdateAppSettings: vi.fn(async () => undefined),
        orbitServiceClient: {} as never,
      })
    );

    expect(result.current.serverOperability.gateway).toMatchObject({
      capabilityEnabled: true,
      loading: false,
      error: null,
      readOnlyReason: null,
      unavailableReason: null,
    });
  });
});
