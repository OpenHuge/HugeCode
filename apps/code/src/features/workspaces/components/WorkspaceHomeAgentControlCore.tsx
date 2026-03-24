import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import {
  type AgentCommandCenterActions,
  type AgentCommandCenterSnapshot,
  type AgentGovernanceCycleReport,
  type AgentGovernanceCycleSource,
  type AgentGovernancePolicy,
  type AgentIntentState,
} from "../../../application/runtime/types/webMcpBridge";
import {
  supportsWebMcp,
  syncWebMcpAgentControl,
  teardownWebMcpAgentControl,
} from "../../../application/runtime/ports/webMcpBridge";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import type { ApprovalRequest, RequestUserInputRequest } from "../../../types";
import { WorkspaceHomeAgentIntentSection } from "./WorkspaceHomeAgentIntentSection";
import {
  DEFAULT_INTENT,
  readCachedState,
  writeCachedState,
} from "./workspaceHomeAgentControlState";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";
import { useWorkspaceAgentControlPreferences } from "./useWorkspaceAgentControlPreferences";
import { WorkspaceHomeAgentLazySection } from "./WorkspaceHomeAgentLazySection";

const LazyWorkspaceHomeAgentRuntimeOrchestration = lazy(async () => {
  const module = await import("./WorkspaceHomeAgentRuntimeOrchestration");
  return { default: module.WorkspaceHomeAgentRuntimeOrchestration };
});

const LazyWorkspaceHomeAgentWebMcpConsoleSection = lazy(async () => {
  const module = await import("./WorkspaceHomeAgentWebMcpConsoleSection");
  return { default: module.WorkspaceHomeAgentWebMcpConsoleSection };
});

type WorkspaceHomeAgentControlProps = {
  workspace: {
    id: string;
    name: string;
  };
  activeModelContext?: {
    provider?: string | null;
    modelId?: string | null;
  };
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
};

const EMPTY_GOVERNANCE_POLICY: AgentGovernancePolicy = {
  autoEnabled: false,
  intervalMinutes: 5,
  pauseBlockedInProgress: true,
  reassignUnowned: true,
  terminateOverdueDays: 5,
  ownerPool: [],
};

const EMPTY_GOVERNANCE_CYCLE: AgentGovernanceCycleReport = {
  source: "webmcp",
  runAt: 0,
  inspected: 0,
  pausedCount: 0,
  terminatedCount: 0,
  reassignedCount: 0,
  ownerPool: [],
  notes: [],
};

export function WorkspaceHomeAgentControl({
  workspace,
  activeModelContext,
  approvals,
  userInputRequests,
}: WorkspaceHomeAgentControlProps) {
  const [intent, setIntent] = useState<AgentIntentState>(DEFAULT_INTENT);
  const [webMcpEnabled, setWebMcpEnabled] = useState(true);
  const [webMcpConsoleMode, setWebMcpConsoleMode] = useState<"basic" | "advanced">("basic");
  const [runtimeSectionOpen, setRuntimeSectionOpen] = useState(false);
  const [webMcpConsoleOpen, setWebMcpConsoleOpen] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<string>("Checking WebMCP support...");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const controlPreferences = useWorkspaceAgentControlPreferences(workspace.id);
  const readOnlyMode = controlPreferences.controls.readOnlyMode;
  const requireUserApproval = controlPreferences.controls.requireUserApproval;
  const webMcpAutoExecuteCalls = controlPreferences.controls.webMcpAutoExecuteCalls;
  const controlPreferencesReady = controlPreferences.status === "ready";
  const controlPreferencesBusy =
    controlPreferences.status === "loading" || controlPreferences.status === "saving";

  useEffect(() => {
    const restored = readCachedState(workspace.id);
    if (!restored) {
      setIntent(DEFAULT_INTENT);
      setWebMcpEnabled(true);
      setWebMcpConsoleMode("basic");
      setRuntimeSectionOpen(false);
      setWebMcpConsoleOpen(false);
      return;
    }

    setIntent(restored.intent);
    setWebMcpEnabled(restored.webMcpEnabled);
    setWebMcpConsoleMode(restored.webMcpConsoleMode);
    setRuntimeSectionOpen(false);
    setWebMcpConsoleOpen(false);
  }, [workspace.id]);

  const setIntentPatch = useCallback((patch: Partial<AgentIntentState>) => {
    let nextIntent = DEFAULT_INTENT;
    setIntent((current) => {
      nextIntent = { ...current, ...patch };
      return nextIntent;
    });
    return nextIntent;
  }, []);

  const actions = useMemo<AgentCommandCenterActions>(
    () => ({
      setIntentPatch,
      setGovernancePolicyPatch: () => EMPTY_GOVERNANCE_POLICY,
      runGovernanceCycle: (_source?: AgentGovernanceCycleSource) => EMPTY_GOVERNANCE_CYCLE,
      upsertTask: () => {
        throw new Error(
          "Local project-task management has been removed from Agent Command Center."
        );
      },
      moveTask: () => null,
      pauseTask: () => null,
      resumeTask: () => null,
      terminateTask: () => null,
      rebalanceTasks: () => ({ updatedCount: 0, owners: [] }),
      assignTask: () => null,
      removeTask: () => false,
      clearCompleted: () => 0,
    }),
    [setIntentPatch]
  );

  useEffect(() => {
    const cachedState = readCachedState(workspace.id);
    const lastKnownPersistedControls =
      controlPreferences.status === "error" || controlPreferences.status === "loading"
        ? (cachedState?.lastKnownPersistedControls ?? controlPreferences.controls)
        : controlPreferences.controls;
    writeCachedState(workspace.id, {
      version: 7,
      intent,
      webMcpEnabled,
      webMcpConsoleMode,
      lastKnownPersistedControls,
    });
  }, [
    controlPreferences.controls,
    controlPreferences.status,
    intent,
    webMcpConsoleMode,
    webMcpEnabled,
    workspace.id,
  ]);

  const snapshot = useMemo<AgentCommandCenterSnapshot>(
    () => ({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      intent,
      tasks: [],
      auditLog: [],
      governance: {
        policy: EMPTY_GOVERNANCE_POLICY,
        lastCycle: null,
      },
      updatedAt: Date.now(),
    }),
    [intent, workspace.id, workspace.name]
  );

  const runtimeControl = useWorkspaceRuntimeAgentControl(workspace.id);
  const responseRequiredState = useMemo(
    () => ({ approvals, userInputRequests }),
    [approvals, userInputRequests]
  );

  useEffect(() => {
    let disposed = false;

    if (!controlPreferencesReady) {
      setBridgeStatus(
        controlPreferences.status === "saving"
          ? "Saving persisted agent controls..."
          : controlPreferences.status === "loading"
            ? "Loading persisted agent controls..."
            : "Persisted agent controls unavailable"
      );
      setBridgeError(controlPreferences.status === "error" ? controlPreferences.error : null);
      void teardownWebMcpAgentControl();
      return () => {
        disposed = true;
      };
    }

    void syncWebMcpAgentControl({
      enabled: webMcpEnabled,
      readOnlyMode,
      requireUserApproval,
      snapshot,
      actions,
      activeModelContext,
      runtimeControl,
      responseRequiredState,
      onApprovalRequest: async (message) => {
        if (typeof window === "undefined") {
          return false;
        }
        return window.confirm(message);
      },
    }).then((result) => {
      if (disposed) {
        return;
      }
      if (!result.supported) {
        if (!result.capabilities.modelContext) {
          setBridgeStatus("WebMCP browser API unavailable");
          setBridgeError(null);
          return;
        }
        setBridgeStatus("WebMCP capability incomplete");
        setBridgeError(result.error);
        return;
      }
      setBridgeError(result.error);
      if (!result.enabled) {
        setBridgeStatus("WebMCP disabled");
        return;
      }
      setBridgeStatus(
        `${result.registeredTools} tool${result.registeredTools === 1 ? "" : "s"} synced (${result.mode})`
      );
    });

    return () => {
      disposed = true;
    };
  }, [
    actions,
    activeModelContext,
    controlPreferences.error,
    controlPreferences.status,
    controlPreferencesReady,
    readOnlyMode,
    requireUserApproval,
    responseRequiredState,
    runtimeControl,
    snapshot,
    webMcpEnabled,
  ]);

  useEffect(
    () => () => {
      void teardownWebMcpAgentControl();
    },
    []
  );

  const webMcpSupported = supportsWebMcp();
  const controlPreferencesLocked = controlPreferencesBusy || controlPreferences.status === "error";

  const handleReadOnlyModeChange = useCallback(
    (nextValue: boolean) => {
      void controlPreferences.applyPatch({ readOnlyMode: nextValue }).catch(() => undefined);
    },
    [controlPreferences]
  );

  const handleRequireUserApprovalChange = useCallback(
    (nextValue: boolean) => {
      void controlPreferences.applyPatch({ requireUserApproval: nextValue }).catch(() => undefined);
    },
    [controlPreferences]
  );

  const handleAutoExecuteCallsChange = useCallback(
    (nextValue: boolean) => {
      void controlPreferences
        .applyPatch({ webMcpAutoExecuteCalls: nextValue })
        .catch(() => undefined);
    },
    [controlPreferences]
  );

  return (
    <div className={controlStyles.control} data-testid="workspace-home-agent-control">
      <div className={controlStyles.sectionHeader}>
        <div className={controlStyles.sectionTitle}>Agent Command Center</div>
        <div className={controlStyles.sectionMeta}>
          {webMcpSupported ? "WebMCP" : "Web runtime"}
        </div>
      </div>

      <div className={controlStyles.controlToggles}>
        <label className={controlStyles.controlToggle}>
          <input
            className={controlStyles.toggleInput}
            type="checkbox"
            checked={webMcpEnabled}
            disabled={controlPreferencesLocked}
            onChange={(event) => setWebMcpEnabled(event.target.checked)}
          />
          Enable WebMCP bridge
        </label>
        <label className={controlStyles.controlToggle}>
          <input
            className={controlStyles.toggleInput}
            type="checkbox"
            checked={readOnlyMode}
            disabled={controlPreferencesLocked}
            onChange={(event) => handleReadOnlyModeChange(event.target.checked)}
          />
          Read-only tools only
        </label>
        <label className={controlStyles.controlToggle}>
          <input
            className={controlStyles.toggleInput}
            type="checkbox"
            checked={requireUserApproval}
            disabled={readOnlyMode || controlPreferencesLocked}
            onChange={(event) => handleRequireUserApprovalChange(event.target.checked)}
          />
          Require approval for write tools
        </label>
      </div>

      <div className={controlStyles.controlStatusRow}>
        <span className={controlStyles.controlStatusLabel}>
          {webMcpSupported ? "Browser capability detected" : "Browser capability unavailable"}
        </span>
        <span className={controlStyles.controlStatusValue}>{bridgeStatus}</span>
      </div>
      {bridgeError && <div className={controlStyles.error}>{bridgeError}</div>}
      {controlPreferences.error && controlPreferences.status !== "error" ? (
        <div className={controlStyles.error}>
          Persisted workspace agent controls did not save. The last confirmed runtime state remains
          active until a retry succeeds. {controlPreferences.error}
        </div>
      ) : null}
      {controlPreferences.status === "error" ? (
        <div className={controlStyles.warning}>
          Persisted workspace agent controls could not be loaded. Local cache stays read-only as a
          last-known snapshot until runtime settings recover.
        </div>
      ) : null}
      {!webMcpSupported ? (
        <div className={controlStyles.warning}>
          WebMCP browser APIs are not available in this runtime. WebMCP console actions remain
          disabled, but runtime orchestration stays available.
        </div>
      ) : null}

      <WorkspaceHomeAgentIntentSection intent={intent} onIntentPatch={actions.setIntentPatch} />
      <WorkspaceHomeAgentLazySection
        title="Mission Control"
        summary="Open runtime orchestration only when you need live run control, approval pressure, and checkpoint recovery details."
        surface="agent_runtime_orchestration"
        open={runtimeSectionOpen}
        onToggle={() => setRuntimeSectionOpen((current) => !current)}
        testId="workspace-home-agent-runtime-section"
      >
        <Suspense fallback={null}>
          <LazyWorkspaceHomeAgentRuntimeOrchestration workspaceId={workspace.id} />
        </Suspense>
      </WorkspaceHomeAgentLazySection>
      <WorkspaceHomeAgentLazySection
        title="WebMCP Console"
        summary="Load tool catalog, browser bridge diagnostics, and manual tool execution controls on demand."
        surface="agent_webmcp_console"
        open={webMcpConsoleOpen}
        onToggle={() => setWebMcpConsoleOpen((current) => !current)}
        disabled={!webMcpSupported && controlPreferencesLocked}
        testId="workspace-home-agent-webmcp-section"
      >
        <Suspense fallback={null}>
          <LazyWorkspaceHomeAgentWebMcpConsoleSection
            webMcpSupported={webMcpSupported}
            webMcpEnabled={webMcpEnabled}
            autoExecuteCalls={webMcpAutoExecuteCalls}
            onSetAutoExecuteCalls={handleAutoExecuteCallsChange}
            mode={webMcpConsoleMode}
            onSetMode={setWebMcpConsoleMode}
            controlsLocked={controlPreferencesLocked}
          />
        </Suspense>
      </WorkspaceHomeAgentLazySection>
    </div>
  );
}
