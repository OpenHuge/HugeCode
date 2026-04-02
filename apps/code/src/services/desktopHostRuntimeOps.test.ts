import { invokeDesktopCommand } from "../application/runtime/ports/desktopHostCore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeClient } from "./runtimeClient";
import { runCodexDoctorWithFallback, runCodexUpdateWithFallback } from "./runtimeClientCodex";
import {
  getBackendPoolBootstrapPreview,
  getBackendPoolDiagnostics,
  isMobileRuntime,
  orbitConnectTest,
  orbitRunnerStart,
  orbitRunnerStatus,
  orbitRunnerStop,
  orbitSignInPoll,
  orbitSignInStart,
  orbitSignOut,
  netbirdDaemonCommandPreview,
  netbirdStatus,
  runBackendPoolOnboardingPreflight,
  runCodexDoctor,
  runCodexUpdate,
  runRuntimeCodexDoctor,
  runRuntimeCodexUpdate,
  tailscaleDaemonCommandPreview,
  tailscaleDaemonStart,
  tailscaleDaemonStatus,
  tailscaleDaemonStop,
  tailscaleStatus,
} from "./desktopHostRuntimeOps";

vi.mock("../application/runtime/ports/desktopHostCore", () => ({
  invokeDesktopCommand: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  getRuntimeClient: vi.fn(),
}));

vi.mock("./runtimeClientCodex", () => ({
  runCodexDoctorWithFallback: vi.fn(),
  runCodexUpdateWithFallback: vi.fn(),
}));

const invokeMock = vi.mocked(invokeDesktopCommand);
const getRuntimeClientMock = vi.mocked(getRuntimeClient);
const runCodexDoctorWithFallbackMock = vi.mocked(runCodexDoctorWithFallback);
const runCodexUpdateWithFallbackMock = vi.mocked(runCodexUpdateWithFallback);
const runtimeClientMockInstance = {} as ReturnType<typeof getRuntimeClient>;

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeClientMock.mockReturnValue(runtimeClientMockInstance);
});

describe("desktopHostRuntimeOps", () => {
  it("maps runtime environment wrappers", async () => {
    invokeMock.mockResolvedValueOnce(false);

    await expect(isMobileRuntime()).resolves.toBe(false);

    expect(invokeMock).toHaveBeenCalledWith("is_mobile_runtime");
  });

  it("maps orbit wrappers", async () => {
    invokeMock.mockResolvedValue(undefined);

    await orbitConnectTest();
    await orbitSignInStart();
    await orbitSignInPoll("device-code");
    await orbitSignOut();
    await orbitRunnerStart();
    await orbitRunnerStop();
    await orbitRunnerStatus();

    expect(invokeMock).toHaveBeenCalledWith("orbit_connect_test");
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_in_start");
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_in_poll", {
      deviceCode: "device-code",
    });
    expect(invokeMock).toHaveBeenCalledWith("orbit_sign_out");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_start");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_stop");
    expect(invokeMock).toHaveBeenCalledWith("orbit_runner_status");
  });

  it("maps tailscale wrappers", async () => {
    invokeMock.mockResolvedValue(undefined);

    await tailscaleStatus();
    await tailscaleDaemonCommandPreview();
    await tailscaleDaemonStart();
    await tailscaleDaemonStop();
    await tailscaleDaemonStatus();

    expect(invokeMock).toHaveBeenCalledWith("tailscale_status");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_command_preview");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_start");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_stop");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_status");
  });

  it("maps netbird wrappers", async () => {
    invokeMock.mockResolvedValue(undefined);

    await netbirdStatus();
    await netbirdDaemonCommandPreview();

    expect(invokeMock).toHaveBeenCalledWith("netbird_status");
    expect(invokeMock).toHaveBeenCalledWith("netbird_daemon_command_preview");
  });

  it("maps backend pool bootstrap and diagnostics wrappers", async () => {
    invokeMock.mockResolvedValue(undefined);

    await getBackendPoolBootstrapPreview();
    await runBackendPoolOnboardingPreflight({ provider: "tcp", remoteHost: "remote.example:4732" });
    await getBackendPoolDiagnostics();

    expect(invokeMock).toHaveBeenCalledWith("backend_pool_bootstrap_preview");
    expect(invokeMock).toHaveBeenCalledWith("backend_pool_onboarding_preflight", {
      input: { provider: "tcp", remoteHost: "remote.example:4732" },
    });
    expect(invokeMock).toHaveBeenCalledWith("backend_pool_diagnostics");
  });

  it("routes codex ops wrappers through runtime client", async () => {
    runCodexDoctorWithFallbackMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.0.0",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    runCodexUpdateWithFallbackMock.mockResolvedValue({
      ok: true,
      method: "unknown",
      package: "codex",
      beforeVersion: "1.0.0",
      afterVersion: "1.0.1",
      upgraded: true,
      output: null,
      details: null,
    });

    await runCodexDoctor("codex", "--help");
    await runCodexUpdate("codex", "--yes");

    expect(runCodexDoctorWithFallbackMock).toHaveBeenCalledWith(runtimeClientMockInstance, {
      codexBin: "codex",
      codexArgs: ["--help"],
    });
    expect(runCodexUpdateWithFallbackMock).toHaveBeenCalledWith(runtimeClientMockInstance, {
      codexBin: "codex",
      codexArgs: ["--yes"],
    });
  });

  it("preserves quoted string args for codex maintenance wrappers", async () => {
    runCodexDoctorWithFallbackMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.0.0",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    runCodexUpdateWithFallbackMock.mockResolvedValue({
      ok: true,
      method: "unknown",
      package: "codex",
      beforeVersion: "1.0.0",
      afterVersion: "1.0.1",
      upgraded: true,
      output: null,
      details: null,
    });

    await runCodexDoctor("codex", '--profile "workspace default"');
    await runCodexUpdate("codex", '--channel "stable beta"');

    expect(runCodexDoctorWithFallbackMock).toHaveBeenCalledWith(runtimeClientMockInstance, {
      codexBin: "codex",
      codexArgs: ["--profile", "workspace default"],
    });
    expect(runCodexUpdateWithFallbackMock).toHaveBeenCalledWith(runtimeClientMockInstance, {
      codexBin: "codex",
      codexArgs: ["--channel", "stable beta"],
    });
  });

  it("preserves array-native codex runtime args for maintenance wrappers", async () => {
    runCodexDoctorWithFallbackMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.0.0",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    runCodexUpdateWithFallbackMock.mockResolvedValue({
      ok: true,
      method: "npm",
      package: "codex",
      beforeVersion: "1.0.0",
      afterVersion: "1.0.1",
      upgraded: true,
      output: null,
      details: null,
    });

    await runRuntimeCodexDoctor({
      codexBin: "codex",
      codexArgs: ["--profile", "workspace default"],
    });
    await runRuntimeCodexUpdate({
      codexBin: "codex",
      codexArgs: ["--channel", "stable beta"],
    });

    expect(runCodexDoctorWithFallbackMock).toHaveBeenLastCalledWith(runtimeClientMockInstance, {
      codexBin: "codex",
      codexArgs: ["--profile", "workspace default"],
    });
    expect(runCodexUpdateWithFallbackMock).toHaveBeenLastCalledWith(runtimeClientMockInstance, {
      codexBin: "codex",
      codexArgs: ["--channel", "stable beta"],
    });
  });
});
