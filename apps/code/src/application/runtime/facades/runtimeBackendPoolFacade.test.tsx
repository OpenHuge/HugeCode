// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeBackendPoolFacade } from "./runtimeBackendPoolFacade";

vi.mock("../ports/remoteServers", () => ({
  acpIntegrationProbe: vi.fn(),
  acpIntegrationsList: vi.fn(),
  acpIntegrationRemove: vi.fn(),
  acpIntegrationSetState: vi.fn(),
  acpIntegrationUpsert: vi.fn(),
  getBackendPoolBootstrapPreview: vi.fn(),
  getBackendPoolDiagnostics: vi.fn(),
  getRuntimeCapabilitiesSummary: vi.fn(),
  runtimeBackendRemove: vi.fn(),
  runtimeBackendSetState: vi.fn(),
  runtimeBackendsList: vi.fn(),
  runtimeBackendUpsert: vi.fn(),
}));

vi.mock("../ports/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

import {
  acpIntegrationSetState,
  acpIntegrationsList,
  getBackendPoolBootstrapPreview,
  getBackendPoolDiagnostics,
  getRuntimeCapabilitiesSummary,
  runtimeBackendSetState,
  runtimeBackendsList,
} from "../ports/remoteServers";

const getRuntimeCapabilitiesSummaryMock = vi.mocked(getRuntimeCapabilitiesSummary);
const runtimeBackendsListMock = vi.mocked(runtimeBackendsList);
const acpIntegrationsListMock = vi.mocked(acpIntegrationsList);
const acpIntegrationSetStateMock = vi.mocked(acpIntegrationSetState);
const runtimeBackendSetStateMock = vi.mocked(runtimeBackendSetState);
const getBackendPoolBootstrapPreviewMock = vi.mocked(getBackendPoolBootstrapPreview);
const getBackendPoolDiagnosticsMock = vi.mocked(getBackendPoolDiagnostics);

describe("useRuntimeBackendPoolFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-host",
      features: ["multi_backend_pool_v1"],
      methods: [
        "code_runtime_backends_list",
        "code_runtime_backend_set_state",
        "code_runtime_backend_remove",
        "code_runtime_backend_upsert",
        "code_acp_integration_probe",
      ],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue([
      {
        backendId: "acp-backend-1",
        displayName: "ACP Backend",
        capabilities: ["code"],
        maxConcurrency: 2,
        costTier: "standard",
        latencyClass: "interactive",
        rolloutState: "current",
        status: "active",
        healthy: true,
        healthScore: 1,
        failures: 0,
        queueDepth: 0,
        runningTasks: 0,
        createdAt: 1,
        updatedAt: 1,
        lastHeartbeatAt: 1,
        backendKind: "acp",
        integrationId: "integration-1",
        transport: "http",
        origin: "acp-projection",
      },
      {
        backendId: "native-backend-1",
        displayName: "Native Backend",
        capabilities: ["code"],
        maxConcurrency: 4,
        costTier: "standard",
        latencyClass: "interactive",
        rolloutState: "current",
        status: "active",
        healthy: true,
        healthScore: 1,
        failures: 0,
        queueDepth: 0,
        runningTasks: 0,
        createdAt: 1,
        updatedAt: 1,
        lastHeartbeatAt: 1,
        backendKind: "native",
        integrationId: null,
        transport: null,
        origin: "runtime-native",
      },
    ]);
    acpIntegrationsListMock.mockResolvedValue([
      {
        integrationId: "integration-1",
        backendId: "acp-backend-1",
        healthy: true,
        lastError: null,
        lastProbeAt: 100,
        transportConfig: {
          transport: "http",
          experimental: true,
        },
      },
    ] as never);
    acpIntegrationSetStateMock.mockResolvedValue({ ok: true } as never);
    runtimeBackendSetStateMock.mockResolvedValue({ ok: true } as never);
    getBackendPoolBootstrapPreviewMock.mockResolvedValue({
      generatedAtMs: 1,
      runtimeServiceBin: "/usr/local/bin/code-runtime-service-rs",
      remoteHost: "example.test:4732",
      remoteTokenConfigured: true,
      workspacePath: "/workspace",
      templates: [],
    } as never);
    getBackendPoolDiagnosticsMock.mockResolvedValue({
      generatedAtMs: 1,
      runtimeServiceBin: "/usr/local/bin/code-runtime-service-rs",
      workspacePath: "/workspace",
      remoteHost: "example.test:4732",
      remoteTokenConfigured: true,
      defaultExecutionBackendId: null,
      tcpOverlay: "tailscale",
      registrySource: "native",
      reasons: [],
      backends: [],
      operatorActions: [],
      tailscale: null,
      netbird: null,
      tcpDaemon: null,
      warnings: [],
    } as never);
  });

  it("loads backend pool state and routes ACP actions through ACP operations", async () => {
    const { result } = renderHook(() =>
      useRuntimeBackendPoolFacade({
        activeSection: "server",
        remoteProvider: "tcp",
      })
    );

    await waitFor(() => {
      expect(result.current.backendPoolSnapshot?.backends).toHaveLength(2);
    });

    await act(async () => {
      await result.current.handleBackendPoolAction({
        backendId: "acp-backend-1",
        action: "disable",
      });
    });

    expect(acpIntegrationSetStateMock).toHaveBeenCalledWith({
      integrationId: "integration-1",
      state: "disabled",
      reason: "ui:disable",
    });
    expect(runtimeBackendSetStateMock).not.toHaveBeenCalled();
  });
});
