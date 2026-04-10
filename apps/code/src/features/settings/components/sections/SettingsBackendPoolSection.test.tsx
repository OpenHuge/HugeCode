// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsBackendPoolSection } from "@ku0/code-workspace-client/settings-shell";
import type { BackendPoolBootstrapPreview, BackendPoolDiagnostics } from "../../../../types";
import type { BackendPoolSnapshot } from "../../types/backendPool";

function createSnapshot(): BackendPoolSnapshot {
  return {
    backends: [
      {
        backendId: "backend-a",
        label: "Backend A",
        provider: "openai",
        state: "enabled",
        backendClass: "primary",
        specializations: ["cpu"],
        policy: {
          trustTier: "trusted",
          dataSensitivity: "restricted",
          approvalPolicy: "checkpoint-required",
          allowedToolClasses: ["read", "write"],
        },
        healthy: true,
        queueDepth: 2,
        connectivity: {
          overlay: "tailscale",
          reachability: "reachable",
          endpoint: "backend-a.tailnet:4732",
        },
        lease: {
          status: "active",
          holderId: "desktop-primary",
          expiresAt: 1_710_000_000_000,
        },
        diagnostics: {
          summary: "Backend A is available with 2 open slots.",
          reasons: [],
          degraded: false,
          availability: "available",
        },
        placementFailuresTotal: 0,
      },
      {
        backendId: "backend-b",
        label: "Backend B",
        provider: "anthropic",
        state: "draining",
        backendClass: "burst",
        healthy: true,
        queueDepth: 4,
        diagnostics: {
          summary: "Backend B is draining.",
          reasons: ["backend_draining"],
          degraded: true,
          availability: "draining",
        },
        placementFailuresTotal: 1,
      },
    ],
    backendsTotal: 2,
    backendsHealthy: 2,
    backendsDraining: 1,
    placementFailuresTotal: 1,
    queueDepth: 6,
    updatedAt: null,
  };
}

function createAcpSnapshot(): BackendPoolSnapshot {
  return {
    backends: [
      {
        backendId: "acp:agent-a",
        label: "ACP Agent A",
        provider: "acp",
        state: "enabled",
        backendKind: "acp",
        integrationId: "agent-a",
        transport: "stdio",
        httpExperimental: null,
        origin: "acp-projection",
        healthy: false,
        lastError: "ACP stdio command `codex` was not found.",
        lastProbeAt: 1_710_000_000_000,
        queueDepth: 0,
        placementFailuresTotal: 0,
      },
    ],
    backendsTotal: 1,
    backendsHealthy: 1,
    backendsDraining: 0,
    placementFailuresTotal: 0,
    queueDepth: 0,
    updatedAt: null,
  };
}

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
        args: ["backend", "start", "--register"],
        backendIdExample: "desktop-primary",
        registrationExample: { backendId: "desktop-primary" },
        notes: ["Run this on the machine that should accept delegated work."],
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
    defaultExecutionBackendId: "backend-a",
    tcpOverlay: "tailscale",
    registrySource: "native",
    reasons: [
      {
        code: "overlay_helper_missing",
        severity: "warning",
        summary: "No supported overlay helper is installed on this machine.",
        retryable: true,
      },
    ],
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
    warnings: [
      "Remote backend token is missing; self-host onboarding is incomplete.",
      "Desktop daemon is not running yet.",
    ],
  };
}

describe("SettingsBackendPoolSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders backend rows and state badges", () => {
    render(<SettingsBackendPoolSection backendPool={createSnapshot()} />);

    expect(screen.getByText("Backend A")).toBeTruthy();
    expect(screen.getByText("Backend B")).toBeTruthy();
    expect(screen.getByText("Primary")).toBeTruthy();
    expect(screen.getByText("Burst")).toBeTruthy();
    expect(screen.getByText("Enabled")).toBeTruthy();
    expect(screen.getAllByText("Draining").length).toBeGreaterThan(0);
  });

  it("renders backend diagnostics, connectivity, and lease details", () => {
    render(<SettingsBackendPoolSection backendPool={createSnapshot()} />);

    expect(screen.getByText(/Backend A is available with 2 open slots\./)).toBeTruthy();
    expect(
      screen.getByText(/Policy: trusted \/ restricted \/ checkpoint-required \/ read, write/)
    ).toBeTruthy();
    expect(screen.getByText(/Connectivity: reachable via backend-a\.tailnet:4732/)).toBeTruthy();
    expect(screen.getByText(/Lease: active by desktop-primary/)).toBeTruthy();
    expect(screen.getByText(/Diagnostics: backend_draining/)).toBeTruthy();
  });

  it("renders onboarding and diagnostics metadata when runtime operator payload is available", () => {
    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        bootstrapPreview={createBootstrapPreview()}
        diagnostics={createDiagnostics()}
      />
    );

    expect(screen.getByText("Backend onboarding")).toBeTruthy();
    expect(screen.getAllByText(/desktop\.tailnet\.ts\.net:4732/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Primary backend/)).toBeTruthy();
    expect(
      screen.getByText(/Run this on the machine that should accept delegated work\./)
    ).toBeTruthy();
    expect(screen.getByText("Backend diagnostics")).toBeTruthy();
    expect(screen.getByText(/Diagnostics source: native/)).toBeTruthy();
    expect(screen.getByText(/Default route: backend-a/)).toBeTruthy();
    expect(
      screen.getByText(/No supported overlay helper is installed on this machine\./)
    ).toBeTruthy();
    expect(screen.getByText(/Desktop daemon is not running yet\./)).toBeTruthy();
  });

  it("shows diagnostics loading errors without hiding backend pool state", () => {
    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        bootstrapPreviewError="Unable to build bootstrap preview."
        diagnosticsError="Unable to load backend pool diagnostics."
      />
    );

    expect(screen.getByText(/Unable to build bootstrap preview\./)).toBeTruthy();
    expect(screen.getByText(/Unable to load backend pool diagnostics\./)).toBeTruthy();
    expect(screen.getByText("Backend A")).toBeTruthy();
  });

  it("renders read-only reason when rpc is unavailable", () => {
    render(
      <SettingsBackendPoolSection
        backendPool={null}
        readOnlyReason="Backend pool RPC is unavailable in current runtime."
      />
    );

    expect(screen.getByText(/Read-only mode:/)).toBeTruthy();
  });

  it("provides aria-labels for icon-only controls", () => {
    render(<SettingsBackendPoolSection backendPool={createSnapshot()} />);

    expect(screen.getByLabelText("Open backend controls for Backend A")).toBeTruthy();
    expect(screen.getByLabelText("Open backend controls for Backend B")).toBeTruthy();
  });

  it("keeps actions disabled when controls are not enabled", () => {
    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        stateActionsEnabled={false}
        removeEnabled={false}
      />
    );

    const drainButtons = screen.getAllByRole("button", { name: "Drain" });
    expect(drainButtons[0]?.hasAttribute("disabled")).toBe(true);
  });

  it("invokes action callback when controls are enabled", async () => {
    const onBackendAction = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        stateActionsEnabled
        removeEnabled
        onBackendAction={onBackendAction}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Drain" })[0] as HTMLButtonElement);
    });

    expect(onBackendAction).toHaveBeenCalledWith({ backendId: "backend-a", action: "drain" });
  });

  it("invokes remove action callback when remove is enabled", async () => {
    const onBackendAction = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        stateActionsEnabled
        removeEnabled
        onBackendAction={onBackendAction}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0] as HTMLButtonElement);
    });

    expect(onBackendAction).toHaveBeenCalledWith({ backendId: "backend-a", action: "remove" });
  });

  it("invokes backend upsert callback when add button is pressed", () => {
    const onBackendUpsert = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        upsertEnabled
        onBackendUpsert={onBackendUpsert}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add backend" }));

    expect(onBackendUpsert).toHaveBeenCalledTimes(1);
  });

  it("renders ACP projection badges when ACP metadata is present", () => {
    render(<SettingsBackendPoolSection backendPool={createAcpSnapshot()} />);

    expect(screen.getByText("ACP")).toBeTruthy();
    expect(screen.getByText("STDIO")).toBeTruthy();
    expect(screen.getByText("Projected")).toBeTruthy();
    expect(screen.getByText(/Probe: unhealthy\./)).toBeTruthy();
    expect(screen.getByText("ACP stdio command `codex` was not found.")).toBeTruthy();
  });

  it("invokes ACP backend upsert callback when ACP add button is pressed", () => {
    const onAcpBackendUpsert = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        upsertEnabled
        onAcpBackendUpsert={onAcpBackendUpsert}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add ACP backend" }));

    expect(onAcpBackendUpsert).toHaveBeenCalledTimes(1);
  });

  it("invokes ACP edit callback when edit control is pressed", () => {
    const onAcpBackendEdit = vi.fn();

    render(
      <SettingsBackendPoolSection
        backendPool={createAcpSnapshot()}
        editEnabled
        onAcpBackendEdit={onAcpBackendEdit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onAcpBackendEdit).toHaveBeenCalledWith("acp:agent-a");
  });

  it("invokes native edit callback when edit control is pressed", () => {
    const onNativeBackendEdit = vi.fn();

    render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        editEnabled
        onNativeBackendEdit={onNativeBackendEdit}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0] as HTMLButtonElement);

    expect(onNativeBackendEdit).toHaveBeenCalledWith("backend-a");
  });

  it("invokes ACP probe callback when probe control is pressed", async () => {
    const onAcpBackendProbe = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsBackendPoolSection
        backendPool={createAcpSnapshot()}
        probeEnabled
        onAcpBackendProbe={onAcpBackendProbe}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Probe" }));
    });

    expect(onAcpBackendProbe).toHaveBeenCalledWith("acp:agent-a");
  });

  it("renders top-level actions through the shared footer bar without the legacy wrapper", () => {
    const onRefresh = vi.fn();

    const { container } = render(
      <SettingsBackendPoolSection
        backendPool={createSnapshot()}
        upsertEnabled
        onRefresh={onRefresh}
      />
    );

    const footerBar = container.querySelector(
      '[data-settings-footer-bar="true"]'
    ) as HTMLElement | null;

    expect(footerBar).toBeTruthy();
    expect(within(footerBar as HTMLElement).getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(
      within(footerBar as HTMLElement).getByRole("button", { name: "Add backend" })
    ).toBeTruthy();
    expect(
      within(footerBar as HTMLElement).getByRole("button", { name: "Add ACP backend" })
    ).toBeTruthy();
    expect(container.querySelector(".settings-field-actions")).toBeNull();
  });

  it("renders the backend pool heading through shared field-group grammar", () => {
    const { container } = render(<SettingsBackendPoolSection backendPool={createSnapshot()} />);

    expect(
      screen.getByText("Backend Pool", { selector: '[data-settings-field-group-title="true"]' })
    ).toBeTruthy();
    expect(container.querySelector(".settings-field-label--section")).toBeNull();
  });
});
