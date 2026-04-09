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
import { useRuntimeWebMcpContextPolicy } from "../../../application/runtime/facades/runtimeWebMcpContextPolicy";
import { useWorkspacePersistentFlowState } from "../../../application/runtime/facades/runtimePersistentFlowState";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import type { ApprovalRequest, RequestUserInputRequest, WorkspaceInfo } from "../../../types";
import { useRuntimeWebMcpCatalogRevision } from "../../app/hooks/useRuntimeWebMcpCatalogRevision";
import { WorkspaceHomeAgentIntentSection } from "./WorkspaceHomeAgentIntentSection";
import {
  DEFAULT_INTENT,
  readCachedState,
  readCachedStateWithStatus,
  writeCachedState,
} from "./workspaceHomeAgentControlState";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";
import { useWorkspaceAgentControlPreferences } from "./useWorkspaceAgentControlPreferences";
import { WorkspaceHomeAgentLazySection } from "./WorkspaceHomeAgentLazySection";
import { WorkspaceHomePersistentFlowIndicator } from "./WorkspaceHomePersistentFlowIndicator";

const LazyWorkspaceHomeAgentRuntimeOrchestration = lazy(async () => {
  const module = await import("./WorkspaceHomeAgentRuntimeOrchestration");
  return { default: module.WorkspaceHomeAgentRuntimeOrchestration };
});

const LazyWorkspaceHomeAgentWebMcpConsoleSection = lazy(async () => {
  const module = await import("./WorkspaceHomeAgentWebMcpConsoleSection");
  return { default: module.WorkspaceHomeAgentWebMcpConsoleSection };
});

type WorkspaceHomeAgentControlProps = {
  workspace: Pick<WorkspaceInfo, "id" | "name"> & Partial<Omit<WorkspaceInfo, "id" | "name">>;
  activeModelContext?: {
    provider?: string | null;
    modelId?: string | null;
  };
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
};

function readRuntimeWorkspace(
  workspace: WorkspaceHomeAgentControlProps["workspace"]
): WorkspaceInfo | null {
  if (typeof workspace.path !== "string" || typeof workspace.connected !== "boolean") {
    return null;
  }
  if (!workspace.settings) {
    return null;
  }
  return {
    ...workspace,
    settings: workspace.settings,
    path: workspace.path,
    connected: workspace.connected,
  };
}

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

function formatToolExposureReasonCode(reasonCode: string): string {
  switch (reasonCode) {
    case "runtime-prefers-minimal-tool-catalog":
      return "Runtime policy requested the smallest safe tool catalog";
    case "runtime-prefers-slim-tool-catalog":
      return "Runtime policy slimmed runtime-only tools";
    case "runtime-keeps-full-tool-catalog":
      return "Runtime policy kept the full runtime catalog";
    case "provider-prefers-slim-tool-catalog":
      return "Provider heuristics slimmed runtime-only tools";
    case "provider-keeps-full-tool-catalog":
      return "Provider heuristics kept the full runtime catalog";
    default:
      return reasonCode;
  }
}

function buildRuntimePolicyFreshnessSummary(input: {
  resolutionKind: "cache" | "runtime" | null;
  contextFingerprint: string | null;
  expiresAt: number | null;
}): string | null {
  if (!input.resolutionKind && !input.contextFingerprint) {
    return null;
  }

  const parts: string[] = [];
  if (input.resolutionKind === "runtime") {
    parts.push("Source: live runtime truth");
  } else if (input.resolutionKind === "cache") {
    parts.push("Source: cached runtime truth");
  }
  if (input.contextFingerprint) {
    parts.push(`Context fingerprint: ${input.contextFingerprint}`);
  }
  if (input.resolutionKind === "cache" && input.expiresAt !== null) {
    const refreshInSeconds = Math.max(1, Math.ceil((input.expiresAt - Date.now()) / 1000));
    parts.push(`Auto-refresh in about ${refreshInSeconds}s`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}

function hasMeaningfulIntent(intent: AgentIntentState): boolean {
  return Boolean(
    intent.objective.trim() ||
    intent.constraints.trim() ||
    intent.successCriteria.trim() ||
    intent.managerNotes.trim() ||
    intent.deadline
  );
}

export function WorkspaceHomeAgentControl({
  workspace,
  activeModelContext,
  approvals,
  userInputRequests,
  onOpenMissionTarget,
}: WorkspaceHomeAgentControlProps) {
  const runtimeWorkspace = useMemo(() => readRuntimeWorkspace(workspace), [workspace]);
  const [intent, setIntent] = useState<AgentIntentState>(DEFAULT_INTENT);
  const [webMcpEnabled, setWebMcpEnabled] = useState(true);
  const [webMcpConsoleMode, setWebMcpConsoleMode] = useState<"basic" | "advanced">("basic");
  const [runtimeSectionOpen, setRuntimeSectionOpen] = useState(false);
  const [webMcpConsoleOpen, setWebMcpConsoleOpen] = useState(false);
  const [hydratedWorkspaceControlStateId, setHydratedWorkspaceControlStateId] = useState<
    string | null
  >(null);
  const [bridgeStatus, setBridgeStatus] = useState<string>("Checking WebMCP support...");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [bridgeToolExposureReasonCodes, setBridgeToolExposureReasonCodes] = useState<string[]>([]);
  const controlPreferences = useWorkspaceAgentControlPreferences(workspace.id);
  const readOnlyMode = controlPreferences.controls.readOnlyMode;
  const requireUserApproval = controlPreferences.controls.requireUserApproval;
  const webMcpAutoExecuteCalls = controlPreferences.controls.webMcpAutoExecuteCalls;
  const controlPreferencesReady = controlPreferences.status === "ready";
  const controlPreferencesBusy =
    controlPreferences.status === "loading" || controlPreferences.status === "saving";

  useEffect(() => {
    const restored = readCachedStateWithStatus(workspace.id);
    if (!restored.state) {
      setIntent(DEFAULT_INTENT);
      setWebMcpEnabled(true);
      setWebMcpConsoleMode("basic");
      setRuntimeSectionOpen(false);
      setWebMcpConsoleOpen(false);
      setHydratedWorkspaceControlStateId(workspace.id);
      return;
    }

    setIntent(restored.state.intent);
    setWebMcpEnabled(restored.state.webMcpEnabled);
    setWebMcpConsoleMode(restored.state.webMcpConsoleMode);
    setRuntimeSectionOpen(false);
    setWebMcpConsoleOpen(false);
    setHydratedWorkspaceControlStateId(workspace.id);
  }, [workspace.id]);

  const workspaceControlStateHydrated = hydratedWorkspaceControlStateId === workspace.id;

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
  const persistentFlowState = useWorkspacePersistentFlowState({
    workspaceId: workspace.id,
    intent,
    runs: [],
  });
  const runtimeWebMcpContextPolicy = useRuntimeWebMcpContextPolicy({
    workspaceId: workspace.id,
    enabled: webMcpEnabled && controlPreferencesReady,
    activeModelContext,
    intent,
  });
  const runtimeWebMcpCatalogRevision = useRuntimeWebMcpCatalogRevision({
    workspaceId: workspace.id,
    enabled: webMcpEnabled && controlPreferencesReady,
  });
  const responseRequiredState = useMemo(
    () => ({ approvals, userInputRequests }),
    [approvals, userInputRequests]
  );
  const runtimePolicyStatus = useMemo(() => {
    if (!webMcpEnabled) {
      return "Disabled";
    }
    if (!controlPreferencesReady) {
      return "Waiting for persisted controls";
    }
    if (!intent.objective.trim()) {
      return "Waiting for objective";
    }
    if (runtimeWebMcpContextPolicy.loading) {
      return "Resolving in runtime kernel...";
    }
    if (runtimeWebMcpContextPolicy.selectionPolicy) {
      const toolProfile =
        runtimeWebMcpContextPolicy.selectionPolicy.toolExposureProfile ?? "default";
      return `${runtimeWebMcpContextPolicy.truthSourceLabel ?? "Runtime policy"}: ${runtimeWebMcpContextPolicy.selectionPolicy.strategy}/${toolProfile}`;
    }
    if (runtimeWebMcpContextPolicy.error) {
      return "Using provider heuristics";
    }
    return "Waiting for runtime policy";
  }, [
    controlPreferencesReady,
    intent.objective,
    runtimeWebMcpContextPolicy.error,
    runtimeWebMcpContextPolicy.loading,
    runtimeWebMcpContextPolicy.selectionPolicy,
    runtimeWebMcpContextPolicy.truthSourceLabel,
    webMcpEnabled,
  ]);
  const toolExposureReasonSummary = useMemo(() => {
    if (bridgeToolExposureReasonCodes.length === 0) {
      return null;
    }
    return bridgeToolExposureReasonCodes.map(formatToolExposureReasonCode).join(" | ");
  }, [bridgeToolExposureReasonCodes]);
  const runtimePolicyFreshnessSummary = useMemo(
    () =>
      buildRuntimePolicyFreshnessSummary({
        resolutionKind: runtimeWebMcpContextPolicy.resolutionKind,
        contextFingerprint: runtimeWebMcpContextPolicy.contextFingerprint,
        expiresAt: runtimeWebMcpContextPolicy.expiresAt,
      }),
    [
      runtimeWebMcpContextPolicy.contextFingerprint,
      runtimeWebMcpContextPolicy.expiresAt,
      runtimeWebMcpContextPolicy.resolutionKind,
    ]
  );

  const hydratedPersistentIntent = persistentFlowState.hydratedIntent;

  useEffect(() => {
    if (persistentFlowState.loadState !== "ready" || !hydratedPersistentIntent) {
      return;
    }

    setIntent((currentIntent) =>
      hasMeaningfulIntent(currentIntent) ? currentIntent : hydratedPersistentIntent
    );
  }, [hydratedPersistentIntent, persistentFlowState.loadState, workspace.id]);

  useEffect(() => {
    let disposed = false;

    if (!workspaceControlStateHydrated) {
      setBridgeStatus("Loading workspace bridge state...");
      setBridgeError(null);
      setBridgeToolExposureReasonCodes([]);
      return () => {
        disposed = true;
      };
    }

    if (!controlPreferencesReady) {
      setBridgeStatus(
        controlPreferences.status === "saving"
          ? "Saving persisted agent controls..."
          : controlPreferences.status === "loading"
            ? "Loading persisted agent controls..."
            : "Persisted agent controls unavailable"
      );
      setBridgeError(controlPreferences.status === "error" ? controlPreferences.error : null);
      setBridgeToolExposureReasonCodes([]);
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
      toolExposureProfile: runtimeWebMcpContextPolicy.selectionPolicy?.toolExposureProfile ?? null,
      runtimeControl,
      responseRequiredState,
      onApprovalRequest: async (message) => {
        if (typeof window === "undefined") {
          return false;
        }
        return window.confirm(message);
      },
    })
      .then((result) => {
        if (disposed) {
          return;
        }
        if (!result.supported) {
          setBridgeToolExposureReasonCodes([]);
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
          setBridgeToolExposureReasonCodes([]);
          setBridgeStatus("WebMCP disabled");
          return;
        }
        setBridgeToolExposureReasonCodes(result.toolExposureReasonCodes ?? []);
        const exposureLabel = result.toolExposureMode ? `, ${result.toolExposureMode} catalog` : "";
        setBridgeStatus(
          `${result.registeredTools} tool${result.registeredTools === 1 ? "" : "s"} synced (${result.mode}${exposureLabel})`
        );
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        setBridgeError(error instanceof Error ? error.message : String(error));
        setBridgeStatus("WebMCP sync failed");
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
    runtimeWebMcpCatalogRevision,
    runtimeWebMcpContextPolicy.selectionPolicy?.toolExposureProfile,
    runtimeControl,
    snapshot,
    webMcpEnabled,
    workspace.id,
    workspaceControlStateHydrated,
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
      <div className={controlStyles.controlStatusRow}>
        <span className={controlStyles.controlStatusLabel}>Context policy</span>
        <span className={controlStyles.controlStatusValue}>{runtimePolicyStatus}</span>
      </div>
      {runtimePolicyFreshnessSummary ? (
        <div className={controlStyles.sectionMeta}>{runtimePolicyFreshnessSummary}</div>
      ) : null}
      {toolExposureReasonSummary ? (
        <div className={controlStyles.sectionMeta}>
          Catalog reasoning: {toolExposureReasonSummary}
        </div>
      ) : null}
      {bridgeError && <div className={controlStyles.error}>{bridgeError}</div>}
      {runtimeWebMcpContextPolicy.error && webMcpEnabled && controlPreferencesReady ? (
        <div className={controlStyles.warning}>
          Runtime WebMCP context policy is unavailable. Falling back to provider heuristics until
          runtime prepare recovers. {runtimeWebMcpContextPolicy.error}
        </div>
      ) : null}
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
      <WorkspaceHomePersistentFlowIndicator
        indicator={persistentFlowState.indicator}
        context={persistentFlowState.context}
      />
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
        testId="workspace-home-runtime-section"
      >
        <Suspense fallback={null}>
          <LazyWorkspaceHomeAgentRuntimeOrchestration
            workspaceId={workspace.id}
            workspace={runtimeWorkspace}
            intent={intent}
            onOpenMissionTarget={onOpenMissionTarget}
          />
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
            catalogRevision={runtimeWebMcpCatalogRevision}
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
