import { invoke } from "../application/runtime/ports/tauriCore";
import type {
  BackendPoolBootstrapPreview,
  BackendPoolDiagnostics,
  BackendPoolOnboardingPreflight,
  BackendPoolOnboardingPreflightInput,
  CodexDoctorResult,
  CodexUpdateResult,
  NetbirdDaemonCommandPreview,
  NetbirdStatus,
  OrbitConnectTestResult,
  OrbitDeviceCodeStart,
  OrbitRunnerStatus,
  OrbitSignInPollResult,
  OrbitSignOutResult,
  TailscaleDaemonCommandPreview,
  TailscaleStatus,
  TcpDaemonStatus,
} from "../types";
import { splitCommandLine } from "../utils/approvalRules";
import { getRuntimeClient } from "./runtimeClient";
import { runCodexDoctorWithFallback, runCodexUpdateWithFallback } from "./runtimeClientCodex";

function parseCodexArgs(value: string | null): string[] | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = splitCommandLine(value);
  return parsed.length > 0 ? parsed : null;
}

export async function isMobileRuntime(): Promise<boolean> {
  return invoke<boolean>("is_mobile_runtime");
}

export async function orbitConnectTest(): Promise<OrbitConnectTestResult> {
  return invoke<OrbitConnectTestResult>("orbit_connect_test");
}

export async function orbitSignInStart(): Promise<OrbitDeviceCodeStart> {
  return invoke<OrbitDeviceCodeStart>("orbit_sign_in_start");
}

export async function orbitSignInPoll(deviceCode: string): Promise<OrbitSignInPollResult> {
  return invoke<OrbitSignInPollResult>("orbit_sign_in_poll", { deviceCode });
}

export async function orbitSignOut(): Promise<OrbitSignOutResult> {
  return invoke<OrbitSignOutResult>("orbit_sign_out");
}

export async function orbitRunnerStart(): Promise<OrbitRunnerStatus> {
  return invoke<OrbitRunnerStatus>("orbit_runner_start");
}

export async function orbitRunnerStop(): Promise<OrbitRunnerStatus> {
  return invoke<OrbitRunnerStatus>("orbit_runner_stop");
}

export async function orbitRunnerStatus(): Promise<OrbitRunnerStatus> {
  return invoke<OrbitRunnerStatus>("orbit_runner_status");
}

export async function tailscaleStatus(): Promise<TailscaleStatus> {
  return invoke<TailscaleStatus>("tailscale_status");
}

export async function tailscaleDaemonCommandPreview(): Promise<TailscaleDaemonCommandPreview> {
  return invoke<TailscaleDaemonCommandPreview>("tailscale_daemon_command_preview");
}

export async function tailscaleDaemonStart(): Promise<TcpDaemonStatus> {
  return invoke<TcpDaemonStatus>("tailscale_daemon_start");
}

export async function tailscaleDaemonStop(): Promise<TcpDaemonStatus> {
  return invoke<TcpDaemonStatus>("tailscale_daemon_stop");
}

export async function tailscaleDaemonStatus(): Promise<TcpDaemonStatus> {
  return invoke<TcpDaemonStatus>("tailscale_daemon_status");
}

export async function netbirdStatus(): Promise<NetbirdStatus> {
  return invoke<NetbirdStatus>("netbird_status");
}

export async function netbirdDaemonCommandPreview(): Promise<NetbirdDaemonCommandPreview> {
  return invoke<NetbirdDaemonCommandPreview>("netbird_daemon_command_preview");
}

export async function getBackendPoolBootstrapPreview(): Promise<BackendPoolBootstrapPreview> {
  return invoke<BackendPoolBootstrapPreview>("backend_pool_bootstrap_preview");
}

export async function runBackendPoolOnboardingPreflight(
  input: BackendPoolOnboardingPreflightInput
): Promise<BackendPoolOnboardingPreflight> {
  return invoke<BackendPoolOnboardingPreflight>("backend_pool_onboarding_preflight", { input });
}

export async function getBackendPoolDiagnostics(): Promise<BackendPoolDiagnostics> {
  return invoke<BackendPoolDiagnostics>("backend_pool_diagnostics");
}

export async function runCodexDoctor(
  codexBin: string | null,
  codexArgs: string | null
): Promise<CodexDoctorResult> {
  return runRuntimeCodexDoctor({
    codexBin,
    codexArgs: parseCodexArgs(codexArgs),
  });
}

export async function runCodexUpdate(
  codexBin: string | null,
  codexArgs: string | null
): Promise<CodexUpdateResult> {
  return runRuntimeCodexUpdate({
    codexBin,
    codexArgs: parseCodexArgs(codexArgs),
  });
}

export async function runRuntimeCodexDoctor(input?: {
  codexBin?: string | null;
  codexArgs?: string[] | null;
}): Promise<CodexDoctorResult> {
  return runCodexDoctorWithFallback(getRuntimeClient(), {
    codexBin: input?.codexBin ?? null,
    codexArgs: input?.codexArgs ?? null,
  });
}

export async function runRuntimeCodexUpdate(input?: {
  codexBin?: string | null;
  codexArgs?: string[] | null;
}): Promise<CodexUpdateResult> {
  return runCodexUpdateWithFallback(getRuntimeClient(), {
    codexBin: input?.codexBin ?? null,
    codexArgs: input?.codexArgs ?? null,
  });
}
