import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../types";
import {
  getAppSettings,
  syncRuntimeGatewayProfileFromAppSettings,
  updateAppSettings,
} from "./tauriAppSettings";

vi.mock("../../../services/tauriRuntimeAppSettingsBridge", () => ({
  getRuntimeAppSettings: vi.fn(),
  updateRuntimeAppSettings: vi.fn(),
}));

vi.mock("../../../services/runtimeWebGatewayConfig", () => ({
  clearConfiguredWebRuntimeGatewayProfile: vi.fn(),
  setConfiguredWebRuntimeGatewayProfile: vi.fn(),
}));

import {
  getRuntimeAppSettings as getRuntimeAppSettingsMock,
  updateRuntimeAppSettings as updateRuntimeAppSettingsMock,
} from "../../../services/tauriRuntimeAppSettingsBridge";
import {
  clearConfiguredWebRuntimeGatewayProfile,
  setConfiguredWebRuntimeGatewayProfile,
} from "../../../services/runtimeWebGatewayConfig";

const mockedGetRuntimeAppSettings = vi.mocked(getRuntimeAppSettingsMock);
const mockedUpdateRuntimeAppSettings = vi.mocked(updateRuntimeAppSettingsMock);
const mockedClearGatewayProfile = vi.mocked(clearConfiguredWebRuntimeGatewayProfile);
const mockedSetGatewayProfile = vi.mocked(setConfiguredWebRuntimeGatewayProfile);

function buildSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    remoteBackendProfiles: [],
    defaultRemoteBackendProfileId: null,
    ...overrides,
  } as AppSettings;
}

describe("tauriAppSettings port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates getAppSettings to canonical runtime app settings rpc", async () => {
    const payload = buildSettings({ theme: "dark" as AppSettings["theme"] });
    mockedGetRuntimeAppSettings.mockResolvedValue(payload);

    await expect(getAppSettings()).resolves.toBe(payload);
  });

  it("delegates updateAppSettings to canonical runtime app settings rpc", async () => {
    const payload = buildSettings({ theme: "dark" as AppSettings["theme"] });
    mockedUpdateRuntimeAppSettings.mockResolvedValue(payload);

    await expect(updateAppSettings(payload)).resolves.toBe(payload);
    expect(mockedUpdateRuntimeAppSettings).toHaveBeenCalledWith(payload);
  });

  it("clears gateway profile when no default profile has enabled gateway config", () => {
    syncRuntimeGatewayProfileFromAppSettings(
      buildSettings({
        remoteBackendProfiles: [
          {
            id: "runtime-west",
            label: "Runtime West",
            provider: "tcp",
            gatewayConfig: {
              enabled: false,
              httpBaseUrl: "https://runtime.example.com/rpc",
              wsBaseUrl: null,
              authMode: "none",
              tokenRef: null,
              healthcheckPath: null,
            },
          },
        ],
      })
    );

    expect(mockedClearGatewayProfile).toHaveBeenCalledTimes(1);
    expect(mockedSetGatewayProfile).not.toHaveBeenCalled();
  });

  it("derives and normalizes gateway profile from selected default backend profile", () => {
    syncRuntimeGatewayProfileFromAppSettings(
      buildSettings({
        defaultRemoteBackendProfileId: "runtime-east",
        remoteBackendProfiles: [
          {
            id: "runtime-west",
            label: "Runtime West",
            provider: "tcp",
            token: " west-token ",
            gatewayConfig: {
              enabled: true,
              httpBaseUrl: "https://west.example.com/rpc/",
              wsBaseUrl: "wss://west.example.com/ws/",
              authMode: "token",
              tokenRef: "west-token-ref",
              healthcheckPath: "/ready",
            },
          },
          {
            id: "runtime-east",
            label: "Runtime East",
            provider: "tcp",
            token: " east-token ",
            gatewayConfig: {
              enabled: true,
              httpBaseUrl: "https://east.example.com/rpc/",
              wsBaseUrl: "wss://east.example.com/ws/",
              authMode: "token",
              tokenRef: "east-token-ref",
              healthcheckPath: "/ready",
            },
          },
        ],
      })
    );

    expect(mockedSetGatewayProfile).toHaveBeenCalledWith({
      httpBaseUrl: "https://east.example.com/rpc",
      wsBaseUrl: "wss://east.example.com/ws",
      authToken: "east-token",
      enabled: true,
    });
    expect(mockedClearGatewayProfile).not.toHaveBeenCalled();
  });
});
