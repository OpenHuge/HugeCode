// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeCachedState } from "./workspaceHomeAgentControlState";
import type { WorkspaceAgentControlPersistedControls } from "./workspaceHomeAgentControlState";
import { syncWebMcpAgentControl } from "../../../application/runtime/ports/webMcpBridge";
import { useRuntimeWebMcpContextPolicy } from "../../../application/runtime/facades/runtimeWebMcpContextPolicy";

vi.mock("../../../application/runtime/ports/webMcpBridge", () => ({
  supportsWebMcp: vi.fn(() => true),
  syncWebMcpAgentControl: vi.fn(async () => ({
    supported: true,
    enabled: true,
    mode: "provideContext",
    registeredTools: 4,
    registeredResources: 2,
    registeredPrompts: 1,
    toolExposureMode: "slim",
    toolExposureReasonCodes: ["runtime-prefers-slim-tool-catalog"],
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

vi.mock("../../../application/runtime/facades/runtimeWebMcpContextPolicy", () => ({
  useRuntimeWebMcpContextPolicy: vi.fn(() => ({
    selectionPolicy: {
      strategy: "balanced",
      tokenBudgetTarget: 1400,
      toolExposureProfile: "slim",
      preferColdFetch: true,
    },
    contextFingerprint: "ctx-123",
    loading: false,
    error: null,
    truthSourceLabel: "Runtime kernel v2 prepare",
  })),
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
    applyPatch: vi.fn(async (patch: Partial<WorkspaceAgentControlPersistedControls>) =>
      buildPersistedControls(patch)
    ),
  })),
}));

import { WorkspaceHomeAgentControl } from "./WorkspaceHomeAgentControlCore";
import { useWorkspaceAgentControlPreferences } from "./useWorkspaceAgentControlPreferences";

const workspace = {
  id: "workspace-agent-control",
  name: "Workspace Agent Control",
};

const storageKey = `workspace-home-agent-control:${workspace.id}`;

function buildPersistedControls(
  patch: Partial<WorkspaceAgentControlPersistedControls> = {}
): WorkspaceAgentControlPersistedControls {
  return {
    readOnlyMode: false,
    requireUserApproval: true,
    webMcpAutoExecuteCalls: true,
    ...patch,
  };
}

function createApplyPatchMock() {
  return vi.fn(async (patch: Partial<WorkspaceAgentControlPersistedControls>) =>
    buildPersistedControls(patch)
  );
}

describe("WorkspaceHomeAgentControl", () => {
  beforeEach(() => {
    vi.mocked(useWorkspaceAgentControlPreferences).mockReturnValue({
      controls: {
        readOnlyMode: false,
        requireUserApproval: true,
        webMcpAutoExecuteCalls: true,
      },
      status: "ready",
      error: null,
      applyPatch: createApplyPatchMock(),
    });
    vi.mocked(useRuntimeWebMcpContextPolicy).mockReturnValue({
      selectionPolicy: {
        strategy: "balanced",
        tokenBudgetTarget: 1400,
        toolExposureProfile: "slim",
        preferColdFetch: true,
      },
      contextFingerprint: "ctx-123",
      loading: false,
      error: null,
      truthSourceLabel: "Runtime kernel v2 prepare",
    });
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
      <WorkspaceHomeAgentControl
        workspace={workspace}
        activeModelContext={{
          provider: "openai",
          modelId: "gpt-5.4",
        }}
        approvals={[]}
        userInputRequests={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Agent Command Center")).toBeTruthy();
    });

    expect(screen.getByTestId("intent-section-stub")).toBeTruthy();
    expect(screen.queryByTestId("runtime-section-stub")).toBeNull();
    expect(screen.queryByTestId("webmcp-console-stub")).toBeNull();
    expect(screen.queryByText("Coordination")).toBeNull();
    expect(screen.queryByText("Execution Board")).toBeNull();
    expect(screen.queryByText("Governance")).toBeNull();
    expect(screen.queryByText("Supervision")).toBeNull();

    const rootElement = screen.getByTestId("workspace-home-agent-control");

    expect(within(rootElement).getByLabelText("Enable WebMCP bridge")).toBeTruthy();
    expect(within(rootElement).getByLabelText("Read-only tools only")).toBeTruthy();
    expect(within(rootElement).getByLabelText("Require approval for write tools")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Mission Control/i }));
    await waitFor(() => {
      expect(screen.getByTestId("runtime-section-stub")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /WebMCP Console/i }));
    await waitFor(() => {
      expect(screen.getByTestId("webmcp-console-stub")).toBeTruthy();
    });

    expect(vi.mocked(syncWebMcpAgentControl)).toHaveBeenCalledWith(
      expect.objectContaining({
        toolExposureProfile: "slim",
      })
    );
    expect(vi.mocked(useRuntimeWebMcpContextPolicy)).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        activeModelContext: {
          provider: "openai",
          modelId: "gpt-5.4",
        },
      })
    );
    expect(screen.getByText(/4 tools synced \(provideContext, slim catalog\)/i)).toBeTruthy();
    expect(screen.getByText(/Runtime kernel v2 prepare: balanced\/slim/i)).toBeTruthy();
    expect(
      screen.getByText(/Catalog reasoning: Runtime policy slimmed runtime-only tools/i)
    ).toBeTruthy();
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
      applyPatch: createApplyPatchMock(),
    });

    render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Local cache stays read-only/i)).toBeTruthy();
    });

    expect(vi.mocked(useRuntimeWebMcpContextPolicy)).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );

    const root = screen.getByTestId("workspace-home-agent-control");
    expect(within(root).getByLabelText("Enable WebMCP bridge")).toHaveProperty("disabled", true);
    expect(within(root).getByLabelText("Read-only tools only")).toHaveProperty("disabled", true);
    expect(within(root).getByLabelText("Require approval for write tools")).toHaveProperty(
      "disabled",
      true
    );
  });

  it("falls back to provider heuristics when runtime context policy is unavailable", async () => {
    vi.mocked(useRuntimeWebMcpContextPolicy).mockReturnValue({
      selectionPolicy: null,
      contextFingerprint: null,
      loading: false,
      error: "runtime prepare unavailable",
      truthSourceLabel: null,
    });

    render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(vi.mocked(syncWebMcpAgentControl)).toHaveBeenCalledWith(
        expect.objectContaining({
          toolExposureProfile: null,
        })
      );
    });

    expect(screen.getByText(/Using provider heuristics/i)).toBeTruthy();
    expect(screen.getByText(/Runtime WebMCP context policy is unavailable/i)).toBeTruthy();
  });
});
