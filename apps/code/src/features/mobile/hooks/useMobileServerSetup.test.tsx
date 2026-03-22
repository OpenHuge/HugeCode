// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../types";
import { createDefaultRemoteServerProfile } from "../../../application/runtime/facades/runtimeRemoteServerProfilesFacade";
import { useMobileServerSetup } from "./useMobileServerSetup";

vi.mock("../../../utils/platformPaths", () => ({
  isMobilePlatform: vi.fn(() => true),
}));

vi.mock("../../../application/runtime/ports/tauriRemoteServers", () => ({
  runBackendPoolOnboardingPreflight: vi.fn(),
}));
vi.mock("../../../application/runtime/ports/tauriWorkspaceCatalog", () => ({
  listWorkspaces: vi.fn(),
}));

import { runBackendPoolOnboardingPreflight } from "../../../application/runtime/ports/tauriRemoteServers";
import { listWorkspaces } from "../../../application/runtime/ports/tauriWorkspaceCatalog";

const listWorkspacesMock = vi.mocked(listWorkspaces);
const runBackendPoolOnboardingPreflightMock = vi.mocked(runBackendPoolOnboardingPreflight);

function createAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    backendMode: "remote",
    remoteBackendProfiles: [
      createDefaultRemoteServerProfile({
        host: "",
      }),
    ],
    defaultRemoteBackendProfileId: "remote-backend-primary",
    defaultRemoteExecutionBackendId: null,
    ...overrides,
  } as AppSettings;
}

describe("useMobileServerSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkspacesMock.mockResolvedValue([{ id: "workspace-1" }] as never);
  });

  it("does not persist settings when onboarding preflight fails", async () => {
    runBackendPoolOnboardingPreflightMock.mockResolvedValue({
      generatedAtMs: 1,
      ok: false,
      safeToPersist: false,
      state: "retryable_failure",
      checks: [],
      warnings: [],
      errors: [
        {
          code: "auth_invalid",
          severity: "error",
          summary: "Remote backend rejected the supplied token.",
          retryable: false,
        },
      ],
      profilePatch: null,
      applyContract: null,
      operatorActions: [],
    } as never);
    const queueSaveSettings = vi.fn().mockResolvedValue(createAppSettings());
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: createAppSettings(),
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      })
    );

    await act(async () => {
      result.current.mobileSetupWizardProps.onRemoteHostChange("remote.example:4732");
      result.current.mobileSetupWizardProps.onRemoteTokenChange("bad-token");
    });

    await act(async () => {
      await result.current.mobileSetupWizardProps.onConnectTest();
    });

    expect(runBackendPoolOnboardingPreflightMock).toHaveBeenCalledWith({
      provider: "tcp",
      remoteHost: "remote.example:4732",
      remoteToken: "bad-token",
      orbitWsUrl: null,
      backendClass: "primary",
      overlay: "tailscale",
    });
    expect(queueSaveSettings).not.toHaveBeenCalled();
    expect(result.current.mobileSetupWizardProps.canSaveValidatedConnection).toBe(false);
    expect(result.current.mobileSetupWizardProps.statusError).toBe(true);
  });

  it("prepares a validated draft without persisting it", async () => {
    runBackendPoolOnboardingPreflightMock.mockResolvedValue({
      generatedAtMs: 1,
      ok: true,
      safeToPersist: true,
      state: "validated",
      checks: [],
      warnings: [],
      errors: [],
      profilePatch: {
        provider: "tcp",
        host: "remote.example:4732",
        token: "good-token",
        orbitWsUrl: null,
        tcpOverlay: "tailscale",
      },
      applyContract: null,
      operatorActions: [],
    } as never);
    const queueSaveSettings = vi.fn().mockResolvedValue(createAppSettings());
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: createAppSettings(),
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      })
    );

    await act(async () => {
      result.current.mobileSetupWizardProps.onRemoteHostChange("remote.example:4732");
      result.current.mobileSetupWizardProps.onRemoteTokenChange("good-token");
    });

    await act(async () => {
      await result.current.mobileSetupWizardProps.onConnectTest();
    });

    expect(queueSaveSettings).not.toHaveBeenCalled();
    expect(listWorkspacesMock).not.toHaveBeenCalled();
    expect(result.current.mobileSetupWizardProps.canSaveValidatedConnection).toBe(true);
    expect(result.current.mobileSetupWizardProps.statusError).toBe(false);
    expect(result.current.mobileSetupWizardProps.statusMessage).toMatch(/Validated\./);
  });

  it("persists normalized settings only after save is confirmed", async () => {
    runBackendPoolOnboardingPreflightMock.mockResolvedValue({
      generatedAtMs: 1,
      ok: true,
      safeToPersist: true,
      state: "validated",
      checks: [],
      warnings: [],
      errors: [],
      profilePatch: {
        provider: "tcp",
        host: "remote.example:4732",
        token: "good-token",
        orbitWsUrl: null,
        tcpOverlay: "tailscale",
      },
      applyContract: null,
      operatorActions: [],
    } as never);
    const queueSaveSettings = vi.fn().mockResolvedValue(createAppSettings());
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: createAppSettings(),
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      })
    );

    await act(async () => {
      result.current.mobileSetupWizardProps.onRemoteHostChange("remote.example:4732");
      result.current.mobileSetupWizardProps.onRemoteTokenChange("good-token");
    });

    await act(async () => {
      await result.current.mobileSetupWizardProps.onConnectTest();
    });

    await act(async () => {
      await result.current.mobileSetupWizardProps.onSaveConnection();
    });

    expect(queueSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        backendMode: "remote",
        remoteBackendProfiles: expect.arrayContaining([
          expect.objectContaining({
            provider: "tcp",
            host: "remote.example:4732",
            token: "good-token",
          }),
        ]),
      })
    );
    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
    expect(result.current.showMobileSetupWizard).toBe(false);
  });
});
