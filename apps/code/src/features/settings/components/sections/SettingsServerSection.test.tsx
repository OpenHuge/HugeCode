// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  AppSettings,
  BackendPoolBootstrapPreview,
  BackendPoolDiagnostics,
  RemoteBackendProfile,
} from "../../../../types";
import { SettingsServerSection } from "./SettingsServerSection";

function createBootstrapPreview(): BackendPoolBootstrapPreview {
  return {
    generatedAtMs: 1_710_000_000_000,
    runtimeServiceBin: "/usr/local/bin/hugecode-runtime",
    remoteHost: "desktop.tailnet.ts.net:4732",
    remoteTokenConfigured: true,
    workspacePath: "/Users/han/project",
    templates: [
      {
        backendClass: "primary",
        title: "Primary backend",
        command: "/usr/local/bin/hugecode-runtime",
        args: ["backend", "start"],
        backendIdExample: "desktop-primary",
        registrationExample: { backendId: "desktop-primary" },
        notes: ["Desktop helper command."],
      },
    ],
  };
}

function createDiagnostics(): BackendPoolDiagnostics {
  return {
    generatedAtMs: 1_710_000_000_000,
    runtimeServiceBin: "/usr/local/bin/hugecode-runtime",
    workspacePath: "/Users/han/project",
    remoteHost: "desktop.tailnet.ts.net:4732",
    remoteTokenConfigured: false,
    defaultExecutionBackendId: "backend-primary",
    tcpOverlay: "tailscale",
    registrySource: "native",
    reasons: [],
    backends: [],
    operatorActions: [],
    tailscale: {
      installed: true,
      running: true,
      version: "1.76.0",
      dnsName: "desktop.tailnet.ts.net",
      hostName: "desktop",
      tailnetName: "team.tailnet.ts.net",
      ipv4: ["100.64.0.8"],
      ipv6: [],
      suggestedRemoteHost: "desktop.tailnet.ts.net:4732",
      message: "Backend ready.",
    },
    netbird: {
      installed: true,
      running: false,
      version: "0.33.0",
      dnsName: null,
      hostName: "desktop",
      managementUrl: "https://netbird.example",
      ipv4: [],
      suggestedRemoteHost: null,
      message: "NetBird disconnected.",
    },
    tcpDaemon: {
      state: "stopped",
      pid: null,
      startedAtMs: null,
      lastError: "Daemon not started.",
      listenAddr: "0.0.0.0:4732",
    },
    warnings: ["Remote backend token is missing."],
  };
}

function createProps(
  overrides: Partial<ComponentProps<typeof SettingsServerSection>> = {}
): ComponentProps<typeof SettingsServerSection> {
  const remoteProfiles: RemoteBackendProfile[] = [
    {
      id: "profile-default",
      label: "Default route",
      provider: "orbit",
      host: null,
      token: null,
      gatewayConfig: null,
      orbitWsUrl: null,
      orbitAuthUrl: null,
      orbitRunnerName: null,
      orbitAccessClientId: null,
      orbitAccessClientSecretRef: null,
      orbitUseAccess: false,
    },
    {
      id: "profile-secondary",
      label: "Secondary route",
      provider: "orbit",
      host: null,
      token: null,
      gatewayConfig: null,
      orbitWsUrl: null,
      orbitAuthUrl: null,
      orbitRunnerName: null,
      orbitAccessClientId: null,
      orbitAccessClientSecretRef: null,
      orbitUseAccess: false,
    },
  ];

  return {
    appSettings: {} as AppSettings,
    onUpdateAppSettings: vi.fn(async () => undefined),
    remoteProfiles,
    selectedRemoteProfileId: "profile-default",
    defaultRemoteProfileId: "profile-default",
    defaultRemoteExecutionBackendId: null,
    remoteExecutionBackendOptions: [],
    remoteProfileLabelDraft: "Default route",
    activeRemoteProvider: "orbit",
    activeTcpOverlay: "tailscale",
    activeOrbitUseAccess: false,
    isMobilePlatform: false,
    mobileConnectBusy: false,
    mobileConnectStatusText: null,
    mobileConnectStatusError: false,
    remoteHostDraft: "",
    remoteTokenDraft: "",
    gatewayHttpBaseUrlDraft: "",
    gatewayWsBaseUrlDraft: "",
    gatewayTokenRefDraft: "",
    gatewayHealthcheckPathDraft: "",
    activeGatewayAuthMode: "none",
    gatewayEnabled: false,
    orbitWsUrlDraft: "",
    orbitAuthUrlDraft: "",
    orbitRunnerNameDraft: "",
    orbitAccessClientIdDraft: "",
    orbitAccessClientSecretRefDraft: "",
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
    onSetRemoteProfileLabelDraft: vi.fn(),
    onSetRemoteHostDraft: vi.fn(),
    onSetRemoteTokenDraft: vi.fn(),
    onSetGatewayHttpBaseUrlDraft: vi.fn(),
    onSetGatewayWsBaseUrlDraft: vi.fn(),
    onSetGatewayTokenRefDraft: vi.fn(),
    onSetGatewayHealthcheckPathDraft: vi.fn(),
    onSetOrbitWsUrlDraft: vi.fn(),
    onSetOrbitAuthUrlDraft: vi.fn(),
    onSetOrbitRunnerNameDraft: vi.fn(),
    onSetOrbitAccessClientIdDraft: vi.fn(),
    onSetOrbitAccessClientSecretRefDraft: vi.fn(),
    onCommitRemoteProfileLabel: vi.fn(async () => undefined),
    onCommitRemoteHost: vi.fn(async () => undefined),
    onCommitRemoteToken: vi.fn(async () => undefined),
    onCommitGatewayHttpBaseUrl: vi.fn(async () => undefined),
    onCommitGatewayWsBaseUrl: vi.fn(async () => undefined),
    onCommitGatewayTokenRef: vi.fn(async () => undefined),
    onCommitGatewayHealthcheckPath: vi.fn(async () => undefined),
    onSetGatewayAuthMode: vi.fn(async () => undefined),
    onToggleGatewayEnabled: vi.fn(async () => undefined),
    onChangeRemoteProvider: vi.fn(async () => undefined),
    onChangeTcpOverlay: vi.fn(async () => undefined),
    onSelectRemoteProfile: vi.fn(),
    onAddRemoteProfile: vi.fn(async () => undefined),
    onRemoveRemoteProfile: vi.fn(async () => undefined),
    onSetDefaultRemoteProfile: vi.fn(async () => undefined),
    onSetDefaultExecutionBackend: vi.fn(async () => undefined),
    onRefreshTailscaleStatus: vi.fn(),
    onRefreshTailscaleCommandPreview: vi.fn(),
    onUseSuggestedTailscaleHost: vi.fn(async () => undefined),
    onRefreshNetbirdStatus: vi.fn(),
    onRefreshNetbirdCommandPreview: vi.fn(),
    onUseSuggestedNetbirdHost: vi.fn(async () => undefined),
    onTcpDaemonStart: vi.fn(async () => undefined),
    onTcpDaemonStop: vi.fn(async () => undefined),
    onTcpDaemonStatus: vi.fn(async () => undefined),
    onCommitOrbitWsUrl: vi.fn(async () => undefined),
    onCommitOrbitAuthUrl: vi.fn(async () => undefined),
    onCommitOrbitRunnerName: vi.fn(async () => undefined),
    onCommitOrbitAccessClientId: vi.fn(async () => undefined),
    onCommitOrbitAccessClientSecretRef: vi.fn(async () => undefined),
    onToggleOrbitUseAccess: vi.fn(async () => undefined),
    onOrbitConnectTest: vi.fn(),
    onOrbitSignIn: vi.fn(),
    onOrbitSignOut: vi.fn(),
    onOrbitRunnerStart: vi.fn(),
    onOrbitRunnerStop: vi.fn(),
    onOrbitRunnerStatus: vi.fn(),
    onMobileConnectTest: vi.fn(),
    backendPoolVisible: true,
    backendPool: null,
    backendPoolLoading: false,
    backendPoolError: null,
    backendPoolReadOnlyReason: null,
    backendPoolStateActionsEnabled: false,
    backendPoolRemoveEnabled: false,
    backendPoolUpsertEnabled: false,
    backendPoolProbeEnabled: false,
    backendPoolEditEnabled: false,
    backendPoolBootstrapPreview: null,
    backendPoolBootstrapPreviewError: null,
    backendPoolDiagnostics: null,
    backendPoolDiagnosticsError: null,
    onRefreshBackendPool: vi.fn(),
    onBackendPoolAction: vi.fn(async () => undefined),
    onBackendPoolUpsert: vi.fn(async () => undefined),
    onNativeBackendEdit: vi.fn(),
    onAcpBackendUpsert: vi.fn(async () => undefined),
    onAcpBackendEdit: vi.fn(),
    onAcpBackendProbe: vi.fn(async () => undefined),
    workspaceOptions: [{ id: "workspace-1", label: "Workspace 1" }],
    ...overrides,
  };
}

describe("SettingsServerSection", () => {
  it("renders desktop server settings through the shared section grammar", () => {
    const { container } = render(<SettingsServerSection {...createProps()} />);

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      screen.getByText("Execution routing defaults", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Remote backend profiles", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Scheduled automations", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Web runtime gateway", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Desktop and mobile transport details (Advanced)", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();

    const daemonTitle = screen.getByText("Keep daemon running after app closes");
    expect(daemonTitle.closest('[data-settings-field-row="toggle"]')).toBeTruthy();
  });

  it("renders backend pool state as its own operator-facing group", () => {
    const { container } = render(
      <SettingsServerSection
        {...createProps({
          remoteExecutionBackendOptions: [{ id: "backend-primary", label: "Primary backend" }],
          backendPool: null,
          backendPoolReadOnlyReason: "Runtime backend pool RPC is unavailable.",
          backendPoolBootstrapPreview: createBootstrapPreview(),
          backendPoolDiagnostics: createDiagnostics(),
        })}
      />
    );

    const routingGroupTitle = within(container).getByText("Execution routing defaults", {
      selector: '[data-settings-field-group-title="true"]',
    });
    const routingGroup = routingGroupTitle.closest('[data-settings-field-group="true"]');
    expect(routingGroup).not.toBeNull();
    expect(within(routingGroup as HTMLElement).queryByTestId("settings-backend-pool")).toBeNull();

    const backendPoolGroupTitle = within(container).getByText("Backend pool state", {
      selector: '[data-settings-field-group-title="true"]',
    });
    const backendPoolGroup = backendPoolGroupTitle.closest('[data-settings-field-group="true"]');
    expect(backendPoolGroup).not.toBeNull();
    expect(
      within(backendPoolGroup as HTMLElement).getByTestId("settings-backend-pool")
    ).toBeTruthy();
    expect(within(backendPoolGroup as HTMLElement).getByText("Backend onboarding")).toBeTruthy();
    expect(within(backendPoolGroup as HTMLElement).getByText("Backend diagnostics")).toBeTruthy();
  });

  it("does not reintroduce legacy section shell, toggle, or action wrappers", () => {
    const { container } = render(<SettingsServerSection {...createProps()} />);

    expect(container.querySelector(".settings-section")).toBeNull();
    expect(container.querySelector(".settings-section-title")).toBeNull();
    expect(container.querySelector(".settings-section-subtitle")).toBeNull();
    expect(container.querySelector(".settings-toggle-row")).toBeNull();
    expect(container.querySelector(".settings-field-actions")).toBeNull();
  });

  it("renders remote backend profile options without falling back to a local chip family", () => {
    const onSelectRemoteProfile = vi.fn();
    const { container } = render(
      <SettingsServerSection
        {...createProps({
          selectedRemoteProfileId: "profile-secondary",
          defaultRemoteProfileId: "profile-default",
          onSelectRemoteProfile,
        })}
      />
    );

    const profileList = within(container).getByRole("list", {
      name: "Remote backend profiles",
    });
    const secondaryRouteButton = within(profileList)
      .getAllByText("Secondary route", {
        selector: '.settings-profile-badge[data-status-tone="default"][data-shape="chip"]',
      })[0]
      ?.closest("button");
    expect(secondaryRouteButton).toBeTruthy();

    fireEvent.click(secondaryRouteButton as HTMLElement);
    expect(onSelectRemoteProfile).toHaveBeenCalledWith("profile-secondary");
    expect(
      container.querySelectorAll(
        '.settings-profile-badge[data-status-tone="default"][data-shape="chip"]'
      ).length
    ).toBe(2);
    expect(
      container.querySelector(
        '.settings-profile-default-badge[data-status-tone="progress"][data-shape="chip"]'
      )
    ).toBeTruthy();
    expect(container.querySelector(".settings-chip")).toBeNull();
  });

  it("renders a tcp overlay selector and netbird helper copy for tcp profiles", () => {
    const onChangeTcpOverlay = vi.fn(async () => undefined);
    const { container } = render(
      <SettingsServerSection
        {...createProps({
          appSettings: {} as AppSettings,
          remoteProfiles: [
            {
              id: "profile-default",
              label: "Default route",
              provider: "tcp",
              tcpOverlay: "netbird",
              host: "builder.netbird.cloud:4732",
              token: "secret-token",
            },
          ],
          selectedRemoteProfileId: "profile-default",
          defaultRemoteProfileId: "profile-default",
          activeRemoteProvider: "tcp",
          activeTcpOverlay: "netbird",
          onChangeTcpOverlay: onChangeTcpOverlay,
          netbirdStatus: {
            installed: true,
            running: true,
            version: "0.33.0",
            dnsName: "builder.netbird.cloud",
            hostName: "builder",
            managementUrl: "https://api.netbird.io",
            ipv4: ["100.77.0.4"],
            suggestedRemoteHost: "builder.netbird.cloud:4732",
            message: "NetBird connected.",
          },
        })}
      />
    );

    expect(within(container).getByLabelText("TCP overlay")).toBeTruthy();
    expect(within(container).getByText("NetBird helper")).toBeTruthy();
    expect(within(container).getByText(/builder\.netbird\.cloud:4732/i)).toBeTruthy();

    fireEvent.click(within(container).getByRole("button", { name: "TCP overlay" }));
    fireEvent.click(screen.getByText("Tailscale"));

    expect(onChangeTcpOverlay).toHaveBeenCalledWith("tailscale");
  }, 15_000);

  it("separates execution routing copy from transport and daemon operations", () => {
    render(
      <SettingsServerSection
        {...createProps({
          remoteExecutionBackendOptions: [{ id: "backend-primary", label: "Primary backend" }],
        })}
      />
    );

    expect(screen.getAllByText("Execution routing & transport").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /Mission Control and Review Pack stay bound to runtime-confirmed placement/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/backend pool health only explains routing capacity and degraded state/i)
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Backend pool state").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Execution routing defaults").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/backend pool status remains observability rather than execution truth/i)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Desktop and mobile transport details (Advanced)").length
    ).toBeGreaterThan(0);
  });

  it("renders mobile server settings through the shared section grammar while preserving connect test", () => {
    const onMobileConnectTest = vi.fn();
    const { container } = render(
      <SettingsServerSection
        {...createProps({
          isMobilePlatform: true,
          activeRemoteProvider: "tcp",
          appSettings: {} as AppSettings,
          onMobileConnectTest,
        })}
      />
    );

    expect(container.querySelector('[data-settings-section-frame="true"]')).toBeTruthy();
    expect(
      within(container).getByText("TCP overlay", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();
    expect(
      within(container).getByText("Connection test", {
        selector: '[data-settings-field-group-title="true"]',
      })
    ).toBeTruthy();

    const connectTestButton = within(container).getByRole("button", { name: /Connect & test/i });

    fireEvent.click(connectTestButton);
    expect(onMobileConnectTest).toHaveBeenCalled();
  });
});
