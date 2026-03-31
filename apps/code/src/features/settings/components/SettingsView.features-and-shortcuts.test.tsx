// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  acpIntegrationProbeMock,
  acpIntegrationsListMock,
  acpIntegrationRemoveMock,
  acpIntegrationSetStateMock,
  acpIntegrationUpsertMock,
  baseSettings,
  chooseSelectOption,
  createDoctorResult,
  getRuntimeCapabilitiesSummaryMock,
  renderComposerSection,
  renderFeaturesSection,
  renderSettled,
  renderServerSection,
  runtimeBackendRemoveMock,
  runtimeBackendSetStateMock,
  runtimeBackendsListMock,
  runtimeBackendUpsertMock,
  SharedSettingsView,
} from "./SettingsView.test.shared";

function createBackendList(
  backends: Array<{
    backendId: string;
    label: string;
    state: string;
    capabilities?: string[];
    maxConcurrency?: number;
    costTier?: string;
    latencyClass?: string;
    rolloutState?: "current" | "ramping" | "draining" | "drained";
    provider?: string;
    backendKind?: "native" | "acp";
    integrationId?: string;
    transport?: "stdio" | "http";
    origin?: "runtime-native" | "acp-projection";
  }>
) {
  const now = Date.now();
  return backends.map((backend) => ({
    backendId: backend.backendId,
    displayName: backend.label,
    capabilities: backend.capabilities ?? [],
    maxConcurrency: backend.maxConcurrency ?? 1,
    costTier: backend.costTier ?? "standard",
    latencyClass: backend.latencyClass ?? "regional",
    rolloutState: backend.rolloutState ?? "current",
    status:
      backend.state === "enabled"
        ? ("active" as const)
        : backend.state === "disabled"
          ? ("disabled" as const)
          : ("draining" as const),
    healthy: true,
    healthScore: 1,
    failures: 0,
    queueDepth: 0,
    runningTasks: 0,
    createdAt: now,
    updatedAt: now,
    lastHeartbeatAt: now,
    provider: backend.provider ?? "openai",
    backendKind: backend.backendKind ?? "native",
    integrationId: backend.integrationId ?? null,
    transport: backend.transport ?? null,
    origin: backend.origin ?? "runtime-native",
  }));
}

function createAcpIntegrationList(
  integrations: Array<{
    integrationId: string;
    backendId: string;
    displayName: string;
    state: "active" | "draining" | "disabled" | "degraded";
    transport: "stdio" | "http";
    healthy: boolean;
    command?: string;
    args?: string[];
    cwd?: string | null;
    env?: Record<string, string>;
    endpoint?: string;
    experimental?: boolean;
    headers?: Record<string, string>;
    lastError?: string | null;
    lastProbeAt?: number | null;
  }>
) {
  const now = Date.now();
  return integrations.map((integration) => ({
    integrationId: integration.integrationId,
    backendId: integration.backendId,
    displayName: integration.displayName,
    state: integration.state,
    transport: integration.transport,
    transportConfig:
      integration.transport === "stdio"
        ? {
            transport: "stdio" as const,
            command: integration.command ?? "codex",
            args: integration.args ?? [],
            cwd: integration.cwd ?? undefined,
            env: integration.env ?? {},
          }
        : {
            transport: "http" as const,
            endpoint: integration.endpoint ?? "http://127.0.0.1:8788",
            experimental: integration.experimental ?? true,
            headers: integration.headers ?? {},
          },
    healthy: integration.healthy,
    lastError: integration.lastError ?? null,
    lastProbeAt: integration.lastProbeAt === undefined ? now : integration.lastProbeAt,
    capabilities: ["general"],
    maxConcurrency: 1,
    costTier: "standard" as const,
    latencyClass: "standard" as const,
    createdAt: now,
    updatedAt: now,
  }));
}

function getBackendPoolSection(): HTMLElement {
  return screen.getByTestId("settings-backend-pool");
}

function getBackendPoolRow(label: string): HTMLElement {
  const rows = Array.from(
    getBackendPoolSection().querySelectorAll<HTMLElement>(".settings-backend-pool-row")
  );
  const row = rows.find((candidate) => within(candidate).queryByText(label) !== null);
  if (!row) {
    throw new Error(`Expected backend pool row "${label}"`);
  }
  return row;
}

async function waitForBackendPoolRow(label: string): Promise<HTMLElement> {
  await waitFor(
    () => {
      expect(getBackendPoolRow(label)).toBeTruthy();
    },
    { timeout: 5_000 }
  );
  return getBackendPoolRow(label);
}
describe("SettingsView Features", () => {
  it("keeps advanced sections out of the primary nav until expanded", async () => {
    cleanup();
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Features" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dictation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Environments" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    expect(screen.getByRole("button", { name: "Open in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Environments" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Features" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Internal tools" }));

    expect(screen.getByRole("button", { name: "Features" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Dictation" })).toBeNull();
  }, 10_000);

  it("auto-expands advanced nav when opened into an advanced section", async () => {
    cleanup();
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="features"
      />
    );

    expect(screen.getByRole("button", { name: "Advanced" }).getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(
      screen.getByRole("button", { name: "Internal tools" }).getAttribute("aria-expanded")
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Features" })).toBeTruthy();
    expect(document.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      await screen.findByText("Stable Features", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
  }, 60_000);

  it("updates personality selection", async () => {
    await renderFeaturesSection();

    expect(screen.getByRole("button", { name: "Personality" })).toBeTruthy();
    expect(
      screen.getByText("Stable Features", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
  });

  it("toggles steer mode in stable features", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { steerEnabled: true },
    });

    const steerTitle = screen.getByText("Steer mode");
    const steerRow = steerTitle.closest('[data-settings-field-row="toggle"]');
    expect(steerRow).not.toBeNull();

    const toggle = within(steerRow as HTMLElement).getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ steerEnabled: false })
      );
    });
  });

  it("renders the server section through the shared grammar and keeps remote transport controls working", async () => {
    await renderServerSection();

    expect(document.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Desktop and mobile transport details (Advanced)", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();

    const daemonTitle = screen.getByText("Keep daemon running after app closes");
    const daemonRow = daemonTitle.closest('[data-settings-field-row="toggle"]');
    expect(daemonRow).not.toBeNull();
    expect(
      within(daemonRow as HTMLElement).getByLabelText("Toggle keep daemon running after app closes")
    ).toBeTruthy();
    expect(screen.getByLabelText("TCP overlay")).toBeTruthy();
  }, 60_000);

  it("toggles background terminal in stable features", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderFeaturesSection({
      onUpdateAppSettings,
      appSettings: { unifiedExecEnabled: true },
    });

    const terminalTitle = screen.getByText("Background terminal");
    const terminalRow = terminalTitle.closest('[data-settings-field-row="toggle"]');
    expect(terminalRow).not.toBeNull();

    const toggle = within(terminalRow as HTMLElement).getByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ unifiedExecEnabled: false })
      );
    });
  });
});

describe("SettingsView Composer", () => {
  it("renders composer through the shared settings grammar and applies presets/toggles", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderComposerSection({ onUpdateAppSettings });

    expect(document.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Code fences", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();

    await chooseSelectOption(screen, "Preset", "Helpful");

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          composerEditorPreset: "helpful",
          composerFenceExpandOnSpace: true,
          composerFenceLanguageTags: true,
        })
      );
    });

    const row = screen
      .getByText("Continue lists on Shift+Enter")
      .closest('[data-settings-field-row="toggle"]') as HTMLElement | null;
    if (!row) {
      throw new Error("Expected composer lists row");
    }

    fireEvent.click(
      within(row).getByRole("switch", { name: "Toggle list continuation on Shift+Enter" })
    );

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ composerListContinuation: true })
      );
    });
  });
});

describe("SettingsView mobile layout", () => {
  it("uses a master/detail flow on narrow mobile widths", async () => {
    cleanup();
    const originalMatchMedia = window.matchMedia;
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "platform"
    );
    const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "userAgent"
    );
    const originalTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "maxTouchPoints"
    );

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width: 720px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "iPhone",
    });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    });
    Object.defineProperty(window.navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });

    try {
      await renderSettled(
        <SharedSettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          onTestSystemNotification={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
        />
      );

      expect(screen.queryByText("Sections")).toBeNull();
      expect(screen.getByRole("button", { name: "Display & Sound" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Display & Sound" }));

      await waitFor(() => {
        const mobileHeader = document.body.querySelector(
          '[data-settings-mobile-detail-header="true"]'
        ) as HTMLElement | null;
        expect(screen.getByRole("button", { name: "Back to settings sections" })).toBeTruthy();
        expect(mobileHeader).toBeTruthy();
        expect(within(mobileHeader as HTMLElement).getByText("Display & Sound")).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: "Back to settings sections" }));

      await waitFor(() => {
        expect(screen.queryByText("Sections")).toBeNull();
      });
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, "matchMedia", {
          configurable: true,
          writable: true,
          value: originalMatchMedia,
        });
      } else {
        Reflect.deleteProperty(window, "matchMedia");
      }
      if (originalPlatformDescriptor) {
        Object.defineProperty(window.navigator, "platform", originalPlatformDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "platform");
      }
      if (originalUserAgentDescriptor) {
        Object.defineProperty(window.navigator, "userAgent", originalUserAgentDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "userAgent");
      }
      if (originalTouchPointsDescriptor) {
        Object.defineProperty(window.navigator, "maxTouchPoints", originalTouchPointsDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "maxTouchPoints");
      }
    }
  }, 20_000);
});

describe("SettingsView Backend Pool", () => {
  it("keeps routing defaults ahead of transport-specific server controls", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([{ backendId: "backend-a", label: "Backend A", state: "enabled" }])
    );

    await renderServerSection();

    const executionRoutingHeading = await screen.findByText("Execution routing defaults");
    const backendPoolHeading = screen.getByText("Backend pool state");
    const profilesHeading = screen.getByText("Remote backend profiles");
    const gatewayHeading = screen.getByText("Web runtime gateway");
    const transportHeading = screen.getByText("Desktop and mobile transport details (Advanced)");
    const defaultExecutionBackend = screen.getByLabelText("Default execution backend");
    const remoteProvider = screen.getByLabelText("Remote provider");

    expect(
      executionRoutingHeading.compareDocumentPosition(backendPoolHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(
      backendPoolHeading.compareDocumentPosition(profilesHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(
      profilesHeading.compareDocumentPosition(gatewayHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(
      gatewayHeading.compareDocumentPosition(transportHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(
      defaultExecutionBackend.compareDocumentPosition(remoteProvider) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
  });

  it("hides backend pool section when capability is missing", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });

    await renderServerSection();

    await waitFor(() => {
      expect(getRuntimeCapabilitiesSummaryMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("settings-backend-pool")).toBeNull();
  });

  it("shows backend pool section in read-only mode when rpc is unavailable", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(null);

    await renderServerSection();

    await waitFor(() => {
      expect(screen.getByTestId("settings-backend-pool")).toBeTruthy();
    });
    expect(
      screen.getByText(/Read-only mode: Runtime backend pool RPC is unavailable./)
    ).toBeTruthy();
  });

  it("renders backend rows when capability and payload are available", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        { backendId: "backend-a", label: "Backend A", state: "enabled", provider: "openai" },
      ])
    );

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("Backend A")).toBeTruthy();
    });
  });

  it("keeps backend actions disabled when set-state method is unavailable", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([{ backendId: "backend-a", label: "Backend A", state: "enabled" }])
    );

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("Backend A")).toBeTruthy();
    });
    expect(
      within(getBackendPoolRow("Backend A"))
        .getByRole("button", { name: "Drain" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen.getByText(
        /Read-only mode: Runtime backend actions are unavailable in current runtime./
      )
    ).toBeTruthy();
  }, 10_000);

  it("submits backend set-state actions when runtime method is available", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_set_state"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce(
        createBackendList([{ backendId: "backend-a", label: "Backend A", state: "enabled" }])
      )
      .mockResolvedValueOnce(
        createBackendList([{ backendId: "backend-a", label: "Backend A", state: "draining" }])
      );

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("Backend A")).toBeTruthy();
    });

    fireEvent.click(within(getBackendPoolRow("Backend A")).getByRole("button", { name: "Drain" }));

    await waitFor(() => {
      expect(runtimeBackendSetStateMock).toHaveBeenCalledWith({
        backendId: "backend-a",
        state: "draining",
        reason: "ui:drain",
      });
    });
    expect(runtimeBackendsListMock).toHaveBeenCalledTimes(2);
  });

  it("submits backend remove actions when runtime method is available", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [
        "code_runtime_backends_list",
        "code_runtime_backend_set_state",
        "code_runtime_backend_remove",
      ],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce(
        createBackendList([{ backendId: "backend-a", label: "Backend A", state: "enabled" }])
      )
      .mockResolvedValueOnce([]);

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("Backend A")).toBeTruthy();
    });

    fireEvent.click(within(getBackendPoolRow("Backend A")).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(runtimeBackendRemoveMock).toHaveBeenCalledWith({ backendId: "backend-a" });
    });
    expect(runtimeBackendsListMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("opens the native backend dialog and submits backend upsert actions when runtime method is available", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        createBackendList([{ backendId: "backend-z", label: "Backend Z", state: "enabled" }])
      );

    await renderServerSection();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add backend" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add backend" }));
    const dialog = await screen.findByRole("dialog", { name: "Add backend" });

    expect(dialog.querySelector('[data-settings-footer-bar="true"]')).toBeTruthy();
    expect(dialog.querySelector(".settings-field-actions")).toBeNull();
    expect(dialog.querySelector(".settings-field-label")).toBeNull();
    expect(dialog.querySelector(".settings-field-row")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Backend ID"), {
      target: { value: "backend-z" },
    });
    fireEvent.change(within(dialog).getByLabelText("Display name"), {
      target: { value: "Backend Z" },
    });
    fireEvent.change(within(dialog).getByLabelText("Capabilities"), {
      target: { value: "general\nreview" },
    });
    fireEvent.change(within(dialog).getByLabelText("Max concurrency"), {
      target: { value: "3" },
    });
    fireEvent.change(within(dialog).getByLabelText("Latency class"), {
      target: { value: "regional" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add backend" }));

    await waitFor(() => {
      expect(runtimeBackendUpsertMock).toHaveBeenCalledWith({
        backendId: "backend-z",
        displayName: "Backend Z",
        capabilities: ["general", "review"],
        maxConcurrency: 3,
        costTier: "standard",
        latencyClass: "regional",
        backendClass: "primary",
        specializations: [],
        rolloutState: "current",
        status: "active",
        policy: {
          trustTier: "standard",
          dataSensitivity: "internal",
          approvalPolicy: "checkpoint-required",
          allowedToolClasses: ["read", "write"],
        },
      });
    });
  }, 15_000);

  it("keeps the native backend dialog open and shows an error when add fails", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue([]);
    runtimeBackendUpsertMock.mockRejectedValueOnce(new Error("native add rejected"));

    await renderServerSection();

    fireEvent.click(await screen.findByRole("button", { name: "Add backend" }));
    const dialog = await screen.findByRole("dialog", { name: "Add backend" });

    fireEvent.change(within(dialog).getByLabelText("Backend ID"), {
      target: { value: "backend-z" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add backend" }));

    await waitFor(() => {
      expect(within(dialog).getByText("native add rejected")).toBeTruthy();
    });
    expect(screen.getByRole("dialog", { name: "Add backend" })).toBeTruthy();
  }, 15_000);

  it("prefills the native backend edit dialog and submits runtime backend updates", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "backend-edit",
            label: "Backend Edit",
            state: "disabled",
            capabilities: ["general", "review"],
            maxConcurrency: 4,
            costTier: "premium",
            latencyClass: "global",
            rolloutState: "ramping",
          },
        ])
      )
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "backend-edit",
            label: "Backend Updated",
            state: "enabled",
            capabilities: ["general", "delegate"],
            maxConcurrency: 8,
            costTier: "premium",
            latencyClass: "global",
            rolloutState: "current",
          },
        ])
      );

    await renderServerSection();

    await screen.findByText("Backend Edit");
    fireEvent.click(
      within(await waitForBackendPoolRow("Backend Edit")).getByRole("button", { name: "Edit" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit backend" });

    expect(within(dialog).getByText("backend-edit")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("Backend Edit")).toBeTruthy();
    expect((within(dialog).getByLabelText("Capabilities") as HTMLTextAreaElement).value).toBe(
      "general\nreview"
    );
    expect(within(dialog).getByDisplayValue("4")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("premium")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("global")).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Rollout state" }).textContent ?? ""
    ).toContain("Ramping");
    expect(within(dialog).getByRole("button", { name: "Status" }).textContent ?? "").toContain(
      "Disabled"
    );

    fireEvent.change(within(dialog).getByLabelText("Display name"), {
      target: { value: "Backend Updated" },
    });
    fireEvent.change(within(dialog).getByLabelText("Capabilities"), {
      target: { value: "general\ndelegate" },
    });
    fireEvent.change(within(dialog).getByLabelText("Max concurrency"), {
      target: { value: "8" },
    });
    await chooseSelectOption(within(dialog), "Rollout state", "Current");
    await chooseSelectOption(within(dialog), "Status", "Active");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save backend" }));

    await waitFor(() => {
      expect(runtimeBackendUpsertMock).toHaveBeenCalledWith({
        backendId: "backend-edit",
        displayName: "Backend Updated",
        capabilities: ["general", "delegate"],
        maxConcurrency: 8,
        costTier: "premium",
        latencyClass: "global",
        backendClass: "primary",
        specializations: [],
        rolloutState: "current",
        status: "active",
        policy: {
          trustTier: "standard",
          dataSensitivity: "internal",
          approvalPolicy: "checkpoint-required",
          allowedToolClasses: ["read", "write"],
        },
      });
    });
    await waitFor(() => {
      expect(getBackendPoolRow("Backend Updated")).toBeTruthy();
    });
  }, 15_000);

  it("keeps the native backend edit dialog open and shows an error when save fails", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "backend-edit",
          label: "Backend Edit",
          state: "enabled",
          capabilities: ["general"],
        },
      ])
    );
    runtimeBackendUpsertMock.mockRejectedValueOnce(new Error("native edit rejected"));

    await renderServerSection();

    fireEvent.click(
      within(await waitForBackendPoolRow("Backend Edit")).getByRole("button", { name: "Edit" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit backend" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save backend" }));

    await waitFor(() => {
      expect(within(dialog).getByText("native edit rejected")).toBeTruthy();
    });
    expect(screen.getByRole("dialog", { name: "Edit backend" })).toBeTruthy();
  }, 15_000);

  it("routes ACP backend state changes through ACP integration RPCs", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_set_state"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "acp:agent-a",
            label: "ACP Agent A",
            state: "enabled",
            provider: "acp",
            backendKind: "acp",
            integrationId: "agent-a",
            transport: "stdio",
            origin: "acp-projection",
          },
        ])
      )
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "acp:agent-a",
            label: "ACP Agent A",
            state: "disabled",
            provider: "acp",
            backendKind: "acp",
            integrationId: "agent-a",
            transport: "stdio",
            origin: "acp-projection",
          },
        ])
      );

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("ACP Agent A")).toBeTruthy();
    });

    fireEvent.click(
      within(getBackendPoolRow("ACP Agent A")).getByRole("button", { name: "Disable" })
    );

    await waitFor(() => {
      expect(acpIntegrationSetStateMock).toHaveBeenCalledWith({
        integrationId: "agent-a",
        state: "disabled",
        reason: "ui:disable",
      });
    });
    expect(runtimeBackendSetStateMock).not.toHaveBeenCalled();
  });

  it("shows ACP probe telemetry and routes ACP probe actions through ACP integration RPCs", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [
        "code_runtime_backends_list",
        "code_runtime_backend_set_state",
        "code_acp_integration_probe",
      ],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "acp:agent-a",
            label: "ACP Agent A",
            state: "enabled",
            provider: "acp",
            backendKind: "acp",
            integrationId: "agent-a",
            transport: "stdio",
            origin: "acp-projection",
          },
        ])
      )
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "acp:agent-a",
            label: "ACP Agent A",
            state: "enabled",
            provider: "acp",
            backendKind: "acp",
            integrationId: "agent-a",
            transport: "stdio",
            origin: "acp-projection",
          },
        ])
      );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-a",
          backendId: "acp:agent-a",
          displayName: "ACP Agent A",
          state: "degraded",
          transport: "stdio",
          healthy: false,
          lastError: "ACP stdio command `codex` was not found.",
        },
      ])
    );

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("ACP Agent A")).toBeTruthy();
    });
    expect(within(getBackendPoolRow("ACP Agent A")).getByText(/Probe: unhealthy\./)).toBeTruthy();
    expect(
      within(getBackendPoolRow("ACP Agent A")).getByText("ACP stdio command `codex` was not found.")
    ).toBeTruthy();

    fireEvent.click(
      within(getBackendPoolRow("ACP Agent A")).getByRole("button", { name: "Probe" })
    );

    await waitFor(() => {
      expect(acpIntegrationProbeMock).toHaveBeenCalledWith({
        integrationId: "agent-a",
        force: true,
      });
    });
  });

  it("prefills ACP edit dialog from the current integration state", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [
        "code_runtime_backends_list",
        "code_runtime_backend_upsert",
        "code_acp_integration_probe",
      ],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "acp:agent-http",
          label: "ACP HTTP Agent",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-http",
          transport: "http",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-http",
          backendId: "acp:agent-http",
          displayName: "ACP HTTP Agent",
          state: "active",
          transport: "http",
          healthy: false,
          endpoint: "http://127.0.0.1:9000",
          experimental: false,
          headers: { Authorization: "Bearer token" },
          lastError: "Probe timed out.",
          lastProbeAt: 1_710_000_000_000,
        },
      ])
    );

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("ACP HTTP Agent")).toBeTruthy();
    });
    expect(within(getBackendPoolRow("ACP HTTP Agent")).getByText("Experimental Off")).toBeTruthy();

    fireEvent.click(
      within(getBackendPoolRow("ACP HTTP Agent")).getByRole("button", { name: "Edit" })
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });
    expect(within(dialog).getByDisplayValue("ACP HTTP Agent")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("acp:agent-http")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("http://127.0.0.1:9000")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("Authorization")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("Bearer token")).toBeTruthy();
    expect(
      (within(dialog).getByLabelText("Experimental HTTP transport enabled") as HTMLInputElement)
        .checked
    ).toBe(false);
    expect(within(dialog).getByText("Probe timed out.")).toBeTruthy();
  });

  it("shows an empty probe state in the ACP edit dialog when no probe has run yet", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "acp:agent-empty",
          label: "ACP Empty Agent",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-empty",
          transport: "stdio",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-empty",
          backendId: "acp:agent-empty",
          displayName: "ACP Empty Agent",
          state: "active",
          transport: "stdio",
          healthy: true,
          lastError: null,
          lastProbeAt: null,
        },
      ])
    );

    await renderServerSection();

    fireEvent.click(
      within(getBackendPoolRow("ACP Empty Agent")).getByRole("button", { name: "Edit" })
    );

    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });
    expect(within(dialog).getByText("No ACP probe has completed yet.")).toBeTruthy();
  });

  it("submits edited ACP transport config without clearing unchanged fields", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "custom-backend",
          label: "ACP STDIO Agent",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-stdio",
          transport: "stdio",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-stdio",
          backendId: "custom-backend",
          displayName: "ACP STDIO Agent",
          state: "active",
          transport: "stdio",
          healthy: true,
          command: "codex",
          args: ["--stdio"],
          cwd: "/tmp/acp",
          env: { ACP_MODE: "strict" },
        },
      ])
    );

    await renderServerSection();

    fireEvent.click(
      within(getBackendPoolRow("ACP STDIO Agent")).getByRole("button", { name: "Edit" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });

    expect(within(dialog).getByDisplayValue("ACP_MODE")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("strict")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Command"), {
      target: { value: "codex-next" },
    });
    fireEvent.change(within(dialog).getByLabelText("Args"), {
      target: { value: "--stdio\n--json" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save ACP backend" }));

    await waitFor(() => {
      expect(acpIntegrationUpsertMock).toHaveBeenCalledWith({
        integrationId: "agent-stdio",
        displayName: "ACP STDIO Agent",
        backendId: "custom-backend",
        state: "active",
        backendClass: "primary",
        specializations: [],
        transportConfig: {
          transport: "stdio",
          command: "codex-next",
          args: ["--stdio", "--json"],
          cwd: "/tmp/acp",
          env: {
            ACP_MODE: "strict",
          },
        },
        capabilities: ["general"],
        maxConcurrency: 1,
        costTier: "standard",
        latencyClass: "standard",
      });
    });
  }, 60_000);

  it("submits structured ACP header edits through the existing upsert RPC", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "acp:agent-http",
          label: "ACP HTTP Agent",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-http",
          transport: "http",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-http",
          backendId: "acp:agent-http",
          displayName: "ACP HTTP Agent",
          state: "active",
          transport: "http",
          healthy: true,
          endpoint: "http://127.0.0.1:9000",
          experimental: true,
          headers: {
            Authorization: "Bearer token",
          },
        },
      ])
    );

    await renderServerSection();

    fireEvent.click(
      within(getBackendPoolRow("ACP HTTP Agent")).getByRole("button", { name: "Edit" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });

    fireEvent.change(within(dialog).getByLabelText("HTTP header value 1"), {
      target: { value: "Bearer next-token" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add header" }));
    fireEvent.change(within(dialog).getByLabelText("HTTP header name 2"), {
      target: { value: "X-Trace-Id" },
    });
    fireEvent.change(within(dialog).getByLabelText("HTTP header value 2"), {
      target: { value: "trace-123" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save ACP backend" }));

    await waitFor(() => {
      expect(acpIntegrationUpsertMock).toHaveBeenCalledWith({
        integrationId: "agent-http",
        displayName: "ACP HTTP Agent",
        backendId: "acp:agent-http",
        state: "active",
        backendClass: "primary",
        specializations: [],
        transportConfig: {
          transport: "http",
          endpoint: "http://127.0.0.1:9000",
          experimental: true,
          headers: {
            Authorization: "Bearer next-token",
            "X-Trace-Id": "trace-123",
          },
        },
        capabilities: ["general"],
        maxConcurrency: 1,
        costTier: "standard",
        latencyClass: "standard",
      });
    });
  }, 60_000);

  it("shows duplicate header validation before submit and blocks ACP save", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "acp:agent-http",
          label: "ACP HTTP Agent",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-http",
          transport: "http",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-http",
          backendId: "acp:agent-http",
          displayName: "ACP HTTP Agent",
          state: "active",
          transport: "http",
          healthy: true,
          endpoint: "http://127.0.0.1:9000",
          experimental: true,
          headers: {
            Authorization: "Bearer token",
          },
        },
      ])
    );

    await renderServerSection();

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Add header" }));
    fireEvent.change(within(dialog).getByLabelText("HTTP header name 2"), {
      target: { value: "Authorization" },
    });
    fireEvent.change(within(dialog).getByLabelText("HTTP header value 2"), {
      target: { value: "Bearer duplicate" },
    });

    expect(
      within(dialog).getAllByText('Duplicate header name "Authorization".').length
    ).toBeGreaterThanOrEqual(2);
    expect(
      (within(dialog).getByRole("button", { name: "Save ACP backend" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    fireEvent.click(within(dialog).getByRole("button", { name: "Save ACP backend" }));
    expect(acpIntegrationUpsertMock).not.toHaveBeenCalled();
  }, 60_000);

  it("shows incomplete environment validation only for the active transport", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "acp:agent-stdio",
          label: "ACP STDIO Agent",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-stdio",
          transport: "stdio",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-stdio",
          backendId: "acp:agent-stdio",
          displayName: "ACP STDIO Agent",
          state: "active",
          transport: "stdio",
          healthy: true,
          command: "codex",
          args: ["--stdio"],
          env: { ACP_MODE: "strict" },
        },
      ])
    );

    await renderServerSection();

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Add environment variable" }));
    fireEvent.change(within(dialog).getByLabelText("Environment key 2"), {
      target: { value: "ACP_TOKEN" },
    });

    expect(
      within(dialog).getAllByText('Environment key "ACP_TOKEN" is missing a value.').length
    ).toBeGreaterThanOrEqual(1);
    expect(
      (within(dialog).getByRole("button", { name: "Save ACP backend" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    await chooseSelectOption(within(dialog), "Transport", "HTTP");

    await waitFor(() => {
      expect(
        within(dialog).queryAllByText('Environment key "ACP_TOKEN" is missing a value.')
      ).toHaveLength(0);
    });
    expect(
      (within(dialog).getByRole("button", { name: "Save ACP backend" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Save ACP backend" }));

    await waitFor(() => {
      expect(acpIntegrationUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId: "agent-stdio",
          transportConfig: expect.objectContaining({
            transport: "http",
          }),
        })
      );
    });
  }, 60_000);

  it("updates the backend list after editing the experimental HTTP flag", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "acp:agent-http",
            label: "ACP HTTP Agent",
            state: "enabled",
            provider: "acp",
            backendKind: "acp",
            integrationId: "agent-http",
            transport: "http",
            origin: "acp-projection",
          },
        ])
      )
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "acp:agent-http",
            label: "ACP HTTP Agent",
            state: "enabled",
            provider: "acp",
            backendKind: "acp",
            integrationId: "agent-http",
            transport: "http",
            origin: "acp-projection",
          },
        ])
      );
    acpIntegrationsListMock
      .mockResolvedValueOnce(
        createAcpIntegrationList([
          {
            integrationId: "agent-http",
            backendId: "acp:agent-http",
            displayName: "ACP HTTP Agent",
            state: "active",
            transport: "http",
            healthy: true,
            experimental: false,
          },
        ])
      )
      .mockResolvedValueOnce(
        createAcpIntegrationList([
          {
            integrationId: "agent-http",
            backendId: "acp:agent-http",
            displayName: "ACP HTTP Agent",
            state: "active",
            transport: "http",
            healthy: true,
            experimental: true,
          },
        ])
      );

    await renderServerSection();

    const acpHttpRow = getBackendPoolRow("ACP HTTP Agent");
    expect(within(acpHttpRow).getByText("Experimental Off")).toBeTruthy();
    fireEvent.click(within(acpHttpRow).getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });
    fireEvent.click(within(dialog).getByLabelText("Experimental HTTP transport enabled"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save ACP backend" }));

    await waitFor(() => {
      expect(acpIntegrationUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId: "agent-http",
          transportConfig: expect.objectContaining({
            transport: "http",
            experimental: true,
          }),
        })
      );
    });
    await waitFor(() => {
      expect(within(getBackendPoolRow("ACP HTTP Agent")).getByText("Experimental On")).toBeTruthy();
    });
  }, 60_000);

  it("keeps the ACP edit dialog open and shows an error when save fails", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "acp:agent-a",
          label: "ACP Agent A",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-a",
          transport: "stdio",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock.mockResolvedValue(
      createAcpIntegrationList([
        {
          integrationId: "agent-a",
          backendId: "acp:agent-a",
          displayName: "ACP Agent A",
          state: "active",
          transport: "stdio",
          healthy: true,
        },
      ])
    );
    acpIntegrationUpsertMock.mockRejectedValueOnce(new Error("save rejected"));

    await renderServerSection();

    fireEvent.click(within(getBackendPoolRow("ACP Agent A")).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save ACP backend" }));

    await waitFor(() => {
      expect(within(dialog).getByText("save rejected")).toBeTruthy();
    });
    expect(screen.getByRole("dialog", { name: "Edit ACP backend" })).toBeTruthy();
  }, 60_000);

  it("updates probe status while the ACP edit dialog stays open", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [
        "code_runtime_backends_list",
        "code_runtime_backend_upsert",
        "code_acp_integration_probe",
      ],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValue(
      createBackendList([
        {
          backendId: "acp:agent-a",
          label: "ACP Agent A",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-a",
          transport: "stdio",
          origin: "acp-projection",
        },
      ])
    );
    acpIntegrationsListMock
      .mockResolvedValueOnce(
        createAcpIntegrationList([
          {
            integrationId: "agent-a",
            backendId: "acp:agent-a",
            displayName: "ACP Agent A",
            state: "degraded",
            transport: "stdio",
            healthy: false,
            lastError: "Probe failed.",
          },
        ])
      )
      .mockResolvedValueOnce(
        createAcpIntegrationList([
          {
            integrationId: "agent-a",
            backendId: "acp:agent-a",
            displayName: "ACP Agent A",
            state: "active",
            transport: "stdio",
            healthy: true,
            lastError: null,
            lastProbeAt: 1_710_000_000_111,
          },
        ])
      );

    await renderServerSection();

    fireEvent.click(within(getBackendPoolRow("ACP Agent A")).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit ACP backend" });

    expect(dialog.querySelector('[data-settings-footer-bar="true"]')).toBeTruthy();
    expect(dialog.querySelector(".settings-field-label")).toBeNull();
    expect(dialog.querySelector(".settings-field-row")).toBeNull();
    expect(within(dialog).getByText("Probe failed.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Probe now" }));

    await waitFor(() => {
      expect(acpIntegrationProbeMock).toHaveBeenCalledWith({
        integrationId: "agent-a",
        force: true,
      });
    });
    await waitFor(() => {
      expect(within(dialog).queryByText("Probe failed.")).toBeNull();
      expect(within(dialog).getByText(/Probe: healthy\./)).toBeTruthy();
    });
  });

  it("routes ACP backend removals through ACP integration RPCs", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: [
        "code_runtime_backends_list",
        "code_runtime_backend_set_state",
        "code_runtime_backend_remove",
      ],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock
      .mockResolvedValueOnce(
        createBackendList([
          {
            backendId: "acp:agent-a",
            label: "ACP Agent A",
            state: "enabled",
            provider: "acp",
            backendKind: "acp",
            integrationId: "agent-a",
            transport: "http",
            origin: "acp-projection",
          },
        ])
      )
      .mockResolvedValueOnce([]);

    await renderServerSection();

    await waitFor(() => {
      expect(getBackendPoolRow("ACP Agent A")).toBeTruthy();
    });

    fireEvent.click(
      within(getBackendPoolRow("ACP Agent A")).getByRole("button", { name: "Remove" })
    );

    await waitFor(() => {
      expect(acpIntegrationRemoveMock).toHaveBeenCalledWith({ integrationId: "agent-a" });
    });
    expect(runtimeBackendRemoveMock).not.toHaveBeenCalled();
  });

  it("submits ACP backend upserts when the ACP shortcut is used", async () => {
    getRuntimeCapabilitiesSummaryMock.mockResolvedValue({
      mode: "desktop-compat",
      methods: ["code_runtime_backends_list", "code_runtime_backend_upsert"],
      features: ["multi_backend_pool_v1"],
      wsEndpointPath: null,
      error: null,
    });
    runtimeBackendsListMock.mockResolvedValueOnce([]).mockResolvedValueOnce(
      createBackendList([
        {
          backendId: "acp:agent-z",
          label: "ACP Agent Z",
          state: "enabled",
          provider: "acp",
          backendKind: "acp",
          integrationId: "agent-z",
          transport: "stdio",
          origin: "acp-projection",
        },
      ])
    );

    await renderServerSection();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add ACP backend" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add ACP backend" }));
    const dialog = await screen.findByRole("dialog", { name: "Add ACP backend" });

    expect(dialog.querySelector('[data-settings-footer-bar="true"]')).toBeTruthy();
    expect(dialog.querySelector(".settings-field-label")).toBeNull();
    expect(dialog.querySelector(".settings-field-row")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Integration ID"), {
      target: { value: "agent-z" },
    });
    fireEvent.change(within(dialog).getByLabelText("Display name"), {
      target: { value: "ACP Agent Z" },
    });
    fireEvent.change(within(dialog).getByLabelText("Args"), {
      target: { value: "--stdio" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add ACP backend" }));

    await waitFor(() => {
      expect(acpIntegrationUpsertMock).toHaveBeenCalledWith({
        integrationId: "agent-z",
        displayName: "ACP Agent Z",
        backendId: undefined,
        state: "active",
        backendClass: "primary",
        specializations: [],
        transportConfig: {
          transport: "stdio",
          command: "codex",
          args: ["--stdio"],
          cwd: undefined,
          env: {},
        },
        capabilities: ["general"],
        maxConcurrency: 1,
        costTier: "standard",
        latencyClass: "standard",
      });
    });
  }, 15_000);
});

describe("SettingsView Shortcuts", () => {
  it("renders shortcuts through the shared settings grammar", async () => {
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={vi.fn()}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
        initialSection="shortcuts"
      />
    );

    await waitFor(
      () => {
        expect(document.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
        expect(
          screen.getByText("Panels", { selector: '[data-settings-field-group-title="true"]' })
        ).toBeTruthy();
      },
      { timeout: 3_000 }
    );
  });

  it("closes on Cmd+W", async () => {
    const onClose = vi.fn();
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={onClose}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />
    );

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "w", metaKey: true, bubbles: true })
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={onClose}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes when clicking the modal backdrop", async () => {
    cleanup();
    const onClose = vi.fn();
    await renderSettled(
      <SharedSettingsView
        workspaceGroups={[]}
        groupedWorkspaces={[]}
        ungroupedLabel="Ungrouped"
        onClose={onClose}
        onMoveWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
        reduceTransparency={false}
        onToggleTransparency={vi.fn()}
        appSettings={baseSettings}
        openAppIconById={{}}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
        onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
        onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
        scaleShortcutTitle="Scale shortcut"
        scaleShortcutText="Use Command +/-"
        onTestNotificationSound={vi.fn()}
        onTestSystemNotification={vi.fn()}
        dictationModelStatus={null}
        onDownloadDictationModel={vi.fn()}
        onCancelDictationDownload={vi.fn()}
        onRemoveDictationModel={vi.fn()}
      />
    );

    const backdrop = screen.getByRole("button", { name: "Close dialog" });
    expect(backdrop).toBeTruthy();

    await act(async () => {
      fireEvent.click(backdrop);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
