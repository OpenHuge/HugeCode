// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeCachedState } from "./workspaceHomeAgentControlState";

vi.mock("../../../application/runtime/ports/webMcpBridge", () => ({
  supportsWebMcp: vi.fn(() => true),
  syncWebMcpAgentControl: vi.fn(async () => ({
    supported: true,
    enabled: true,
    mode: "provideContext",
    registeredTools: 4,
    registeredResources: 2,
    registeredPrompts: 1,
    capabilities: {
      modelContext: true,
      supported: true,
      missingRequired: [],
    },
    error: null,
  })),
  teardownWebMcpAgentControl: vi.fn(async () => undefined),
}));

vi.mock("../../../application/runtime/ports/runtimeAgentControl", () => ({
  useWorkspaceRuntimeAgentControl: vi.fn(() => null),
}));

vi.mock("./WorkspaceHomeAgentIntentSection", () => ({
  WorkspaceHomeAgentIntentSection: () => <div data-testid="intent-section-stub" />,
}));

vi.mock("./WorkspaceHomeAgentRuntimeOrchestration", () => ({
  WorkspaceHomeAgentRuntimeOrchestration: () => <div data-testid="runtime-section-stub" />,
}));

vi.mock("./WorkspaceHomeAgentWebMcpConsoleSection", () => ({
  WorkspaceHomeAgentWebMcpConsoleSection: () => <div data-testid="webmcp-console-stub" />,
}));

vi.mock("./useWorkspaceAgentControlPreferences", () => ({
  useWorkspaceAgentControlPreferences: vi.fn(() => ({
    controls: {
      readOnlyMode: false,
      requireUserApproval: true,
      webMcpAutoExecuteCalls: true,
    },
    status: "ready",
    error: null,
    applyPatch: vi.fn(async (patch: unknown) => patch),
  })),
}));

import { WorkspaceHomeAgentControl } from "./WorkspaceHomeAgentControlCore";
import { useWorkspaceAgentControlPreferences } from "./useWorkspaceAgentControlPreferences";

const workspace = {
  id: "workspace-agent-control",
  name: "Workspace Agent Control",
};

const storageKey = `workspace-home-agent-control:${workspace.id}`;

describe("WorkspaceHomeAgentControl", () => {
  beforeEach(() => {
    writeCachedState(workspace.id, {
      version: 7,
      intent: {
        objective: "Coordinate agent tasks",
        constraints: "",
        successCriteria: "",
        deadline: null,
        priority: "medium",
        managerNotes: "",
      },
      webMcpEnabled: true,
      webMcpConsoleMode: "basic",
      lastKnownPersistedControls: {
        readOnlyMode: false,
        requireUserApproval: true,
        webMcpAutoExecuteCalls: true,
      },
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(storageKey);
    vi.clearAllMocks();
  });

  it("focuses the command center on intent, runtime orchestration, and WebMCP controls", async () => {
    render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText("Agent Command Center")).toBeTruthy();
    });

    expect(screen.getByTestId("intent-section-stub")).toBeTruthy();
    expect(screen.getByTestId("runtime-section-stub")).toBeTruthy();
    expect(screen.getByTestId("webmcp-console-stub")).toBeTruthy();
    expect(screen.queryByText("Coordination")).toBeNull();
    expect(screen.queryByText("Execution Board")).toBeNull();
    expect(screen.queryByText("Governance")).toBeNull();
    expect(screen.queryByText("Supervision")).toBeNull();

    const rootElement = screen.getByTestId("workspace-home-agent-control");

    expect(within(rootElement).getByLabelText("Enable WebMCP bridge")).toBeTruthy();
    expect(within(rootElement).getByLabelText("Read-only tools only")).toBeTruthy();
    expect(within(rootElement).getByLabelText("Require approval for write tools")).toBeTruthy();
  });

  it("locks control toggles when persisted controls failed to load", async () => {
    vi.mocked(useWorkspaceAgentControlPreferences).mockReturnValue({
      controls: {
        readOnlyMode: false,
        requireUserApproval: true,
        webMcpAutoExecuteCalls: true,
      },
      status: "error",
      error: "runtime settings unavailable",
      applyPatch: vi.fn(async (patch: unknown) => patch),
    });

    render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Local cache stays read-only/i)).toBeTruthy();
    });

    const root = screen.getByTestId("workspace-home-agent-control");
    expect(within(root).getByLabelText("Enable WebMCP bridge")).toHaveProperty("disabled", true);
    expect(within(root).getByLabelText("Read-only tools only")).toHaveProperty("disabled", true);
    expect(within(root).getByLabelText("Require approval for write tools")).toHaveProperty(
      "disabled",
      true
    );
  });
});
