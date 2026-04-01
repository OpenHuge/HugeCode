// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceAgentControlPersistedControls } from "./workspaceHomeAgentControlState";
import { writeCachedState } from "./workspaceHomeAgentControlState";
import { syncWebMcpAgentControl } from "../../../application/runtime/ports/webMcpBridge";
import { useRuntimeWebMcpContextPolicy } from "../../../application/runtime/facades/runtimeWebMcpContextPolicy";
import { useWorkspacePersistentFlowState } from "../../../application/runtime/facades/runtimePersistentFlowState";
import { useRuntimeWebMcpCatalogRevision } from "../../app/hooks/useRuntimeWebMcpCatalogRevision";

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
    resolutionKind: "runtime",
    resolvedAt: 1_711_238_400_000,
    expiresAt: 1_711_238_430_000,
    loading: false,
    error: null,
    truthSourceLabel: "Runtime kernel v2 prepare",
  })),
}));

vi.mock("../../../application/runtime/facades/runtimePersistentFlowState", () => ({
  useWorkspacePersistentFlowState: vi.fn(() => ({
    context: {
      schemaVersion: "active-intent-context/v1",
      intent: {
        objective: "Recovered flow",
        constraints: "",
        successCriteria: "",
        deadline: null,
        priority: "medium",
        managerNotes: "",
      },
      focusedFiles: [{ path: "apps/code/src/types.ts", reason: "recent_change" }],
      unresolvedErrors: [],
      history: {
        latestRunId: "run-1",
        latestRunTitle: "Persist flow state",
        latestReviewPackId: null,
        lastUpdatedAt: 1,
        recentChangedPaths: ["apps/code/src/types.ts"],
        validationSummaries: [],
      },
    },
    hydratedIntent: null,
    source: "derived",
    loadState: "ready",
    saveError: null,
    indicator: {
      tone: "neutral",
      label: "Persistent flow state",
      detail:
        "Host-backed persistent flow state is tracking current intent and workspace evidence.",
      recovered: false,
    },
  })),
}));

vi.mock("../../app/hooks/useRuntimeWebMcpCatalogRevision", () => ({
  useRuntimeWebMcpCatalogRevision: vi.fn(() => 0),
}));

vi.mock("./WorkspaceHomeAgentIntentSection", () => ({
  WorkspaceHomeAgentIntentSection: ({ intent }: { intent: { objective: string } }) => (
    <div data-testid="intent-section-stub">{intent.objective}</div>
  ),
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
      resolutionKind: "runtime",
      resolvedAt: 1_711_238_400_000,
      expiresAt: 1_711_238_430_000,
      loading: false,
      error: null,
      truthSourceLabel: "Runtime kernel v2 prepare",
    });
    vi.mocked(useWorkspacePersistentFlowState).mockReturnValue({
      context: {
        schemaVersion: "active-intent-context/v1",
        intent: {
          objective: "Recovered flow",
          constraints: "",
          successCriteria: "",
          deadline: null,
          priority: "medium",
          managerNotes: "",
        },
        focusedFiles: [{ path: "apps/code/src/types.ts", reason: "recent_change" }],
        unresolvedErrors: [],
        history: {
          latestRunId: "run-1",
          latestRunTitle: "Persist flow state",
          latestReviewPackId: null,
          lastUpdatedAt: 1,
          recentChangedPaths: ["apps/code/src/types.ts"],
          validationSummaries: [],
        },
      },
      hydratedIntent: null,
      source: "derived",
      loadState: "ready",
      saveError: null,
      indicator: {
        tone: "neutral",
        label: "Persistent flow state",
        detail:
          "Host-backed persistent flow state is tracking current intent and workspace evidence.",
        recovered: false,
      },
    });
    vi.mocked(useRuntimeWebMcpCatalogRevision).mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
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
    expect(screen.getByText("Persistent flow state")).toBeTruthy();
    expect(screen.getByText("Latest run Persist flow state")).toBeTruthy();
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
    expect(screen.getByText(/Context policy/i)).toBeTruthy();
    expect(screen.getByText(/Waiting for objective/i)).toBeTruthy();
    expect(
      screen.getByText(/Source: live runtime truth \| Context fingerprint: ctx-123/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Catalog reasoning: Runtime policy slimmed runtime-only tools/i)
    ).toBeTruthy();
  });

  it("restores a cached draft intent before host-backed hydration catches up", async () => {
    writeCachedState(workspace.id, {
      version: 7,
      intent: {
        objective: "Recover cached objective",
        constraints: "Keep local draft until host persistence lands",
        successCriteria: "Show draft after reload",
        deadline: null,
        priority: "high",
        managerNotes: "cached",
      },
      webMcpEnabled: true,
      webMcpConsoleMode: "basic",
      lastKnownPersistedControls: buildPersistedControls(),
    });

    render(
      <WorkspaceHomeAgentControl
        workspace={workspace}
        activeModelContext={undefined}
        approvals={[]}
        userInputRequests={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("intent-section-stub").textContent).toContain(
        "Recover cached objective"
      );
    });
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
      resolutionKind: null,
      resolvedAt: null,
      expiresAt: null,
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

    expect(screen.getByText(/Waiting for objective/i)).toBeTruthy();
    expect(screen.getByText(/Runtime WebMCP context policy is unavailable/i)).toBeTruthy();
  });

  it("hydrates the intent from recovered host-backed flow state when local intent is empty", async () => {
    vi.mocked(useWorkspacePersistentFlowState).mockReturnValue({
      context: {
        schemaVersion: "active-intent-context/v1",
        intent: {
          objective: "Recovered host-backed objective",
          constraints: "",
          successCriteria: "",
          deadline: null,
          priority: "high",
          managerNotes: "",
        },
        focusedFiles: [],
        unresolvedErrors: [],
        history: {
          latestRunId: "run-1",
          latestRunTitle: "Persist flow state",
          latestReviewPackId: null,
          lastUpdatedAt: 1,
          recentChangedPaths: [],
          validationSummaries: [],
        },
      },
      hydratedIntent: {
        objective: "Recovered host-backed objective",
        constraints: "",
        successCriteria: "",
        deadline: null,
        priority: "high",
        managerNotes: "",
      },
      source: "host",
      loadState: "ready",
      saveError: null,
      indicator: {
        tone: "success",
        label: "Recovered flow state",
        detail: "Recovered host-backed intent, file focus, and unresolved diagnostics.",
        recovered: true,
      },
    });

    render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText("Recovered host-backed objective")).toBeTruthy();
    });

    expect(screen.getByText("Recovered flow state")).toBeTruthy();
  });

  it("re-syncs WebMCP when the runtime catalog revision changes", async () => {
    let runtimeCatalogRevision = 0;
    vi.mocked(useRuntimeWebMcpCatalogRevision).mockImplementation(() => runtimeCatalogRevision);
    vi.mocked(syncWebMcpAgentControl).mockImplementation(async () => ({
      supported: true,
      enabled: true,
      mode: "provideContext",
      registeredTools: runtimeCatalogRevision === 0 ? 4 : 5,
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
    }));

    const { rerender } = render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText(/4 tools synced \(provideContext, slim catalog\)/i)).toBeTruthy();
    });
    const initialCallCount = vi.mocked(syncWebMcpAgentControl).mock.calls.length;

    runtimeCatalogRevision = 1;
    rerender(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(vi.mocked(syncWebMcpAgentControl).mock.calls.length).toBeGreaterThan(initialCallCount);
      expect(screen.getByText(/5 tools synced \(provideContext, slim catalog\)/i)).toBeTruthy();
    });
  });

  it("surfaces sync errors without tearing the bridge down", async () => {
    let runtimeCatalogRevision = 0;
    vi.mocked(useRuntimeWebMcpCatalogRevision).mockImplementation(() => runtimeCatalogRevision);
    vi.mocked(syncWebMcpAgentControl).mockImplementation(async () => {
      if (runtimeCatalogRevision > 0) {
        throw new Error("runtime catalog read failed");
      }
      return {
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
      };
    });

    const { rerender } = render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText(/4 tools synced \(provideContext, slim catalog\)/i)).toBeTruthy();
    });

    runtimeCatalogRevision = 1;
    rerender(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(screen.getByText("WebMCP sync failed")).toBeTruthy();
      expect(screen.getByText(/runtime catalog read failed/i)).toBeTruthy();
    });
  });

  it("hydrates cached workspace bridge state before the first sync", async () => {
    writeCachedState(workspace.id, {
      version: 7,
      intent: {
        objective: "Hydrated bridge state",
        constraints: "",
        successCriteria: "",
        deadline: null,
        priority: "medium",
        managerNotes: "",
      },
      webMcpEnabled: false,
      webMcpConsoleMode: "basic",
      lastKnownPersistedControls: {
        readOnlyMode: false,
        requireUserApproval: true,
        webMcpAutoExecuteCalls: true,
      },
    });
    vi.mocked(syncWebMcpAgentControl).mockImplementation(async ({ enabled }) => ({
      supported: true,
      enabled,
      mode: "provideContext",
      registeredTools: enabled ? 4 : 0,
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
    }));

    render(
      <WorkspaceHomeAgentControl workspace={workspace} approvals={[]} userInputRequests={[]} />
    );

    await waitFor(() => {
      expect(vi.mocked(syncWebMcpAgentControl)).toHaveBeenCalledTimes(1);
      expect(screen.getByText("WebMCP disabled")).toBeTruthy();
    });

    expect(vi.mocked(syncWebMcpAgentControl)).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });
});
