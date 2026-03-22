import {
  getAppSettings,
  isMobileRuntime,
  orbitConnectTest,
  orbitRunnerStart,
  orbitRunnerStatus,
  orbitRunnerStop,
  orbitSignInPoll,
  orbitSignInStart,
  orbitSignOut,
  tailscaleDaemonCommandPreview,
  tailscaleDaemonStart,
  tailscaleDaemonStatus,
  tailscaleDaemonStop,
  tailscaleStatus,
  updateAppSettings,
} from "../../../services/tauriDesktopRuntimeOps";

export type DesktopHostAdapter = {
  getAppSettings: typeof getAppSettings;
  isMobileRuntime: typeof isMobileRuntime;
  updateAppSettings: typeof updateAppSettings;
  orbitConnectTest: typeof orbitConnectTest;
  orbitSignInStart: typeof orbitSignInStart;
  orbitSignInPoll: typeof orbitSignInPoll;
  orbitSignOut: typeof orbitSignOut;
  orbitRunnerStart: typeof orbitRunnerStart;
  orbitRunnerStop: typeof orbitRunnerStop;
  orbitRunnerStatus: typeof orbitRunnerStatus;
  tailscaleStatus: typeof tailscaleStatus;
  tailscaleDaemonCommandPreview: typeof tailscaleDaemonCommandPreview;
  tailscaleDaemonStart: typeof tailscaleDaemonStart;
  tailscaleDaemonStop: typeof tailscaleDaemonStop;
  tailscaleDaemonStatus: typeof tailscaleDaemonStatus;
};

export function createDesktopHostAdapter(): DesktopHostAdapter {
  return {
    getAppSettings,
    isMobileRuntime,
    updateAppSettings,
    orbitConnectTest,
    orbitSignInStart,
    orbitSignInPoll,
    orbitSignOut,
    orbitRunnerStart,
    orbitRunnerStop,
    orbitRunnerStatus,
    tailscaleStatus,
    tailscaleDaemonCommandPreview,
    tailscaleDaemonStart,
    tailscaleDaemonStop,
    tailscaleDaemonStatus,
  };
}
