import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { WorkspaceInfo } from "../../../types";
import { useWorkspaceRuntimeMissionControlController } from "../../../application/runtime/facades/runtimeMissionControlController";
import { useWorkspacePersistentFlowState } from "../../../application/runtime/facades/runtimePersistentFlowState";
import { primeRuntimeRunTruth } from "../../../application/runtime/facades/runtimeRunTruthStore";
import type {
  AgentIntentState,
  RuntimeAgentTaskSummary,
} from "../../../application/runtime/types/webMcpBridge";
import { ToolCallChip } from "../../../design-system";
import {
  MissionControlSessionLogSection,
  MissionControlRunListSection,
  MissionControlSectionCard,
} from "./WorkspaceHomeMissionControlSections";
import { WorkspaceHomeAgentRuntimeBrowserSection } from "./WorkspaceHomeAgentRuntimeBrowserSection";
import { WorkspaceHomeAiWebLabSection } from "./WorkspaceHomeAiWebLabSection";
import { WorkspaceHomeAgentRuntimeMiniProgramSection } from "./WorkspaceHomeAgentRuntimeMiniProgramSection";
import {
  DEFAULT_RUNTIME_BATCH_PREVIEW_CONFIG,
  formatRuntimeTimestamp,
  parseRuntimeBatchPreviewState,
  readRuntimeParallelDispatchPlanLaunchError,
} from "./WorkspaceHomeAgentRuntimeOrchestration.helpers";
import { WorkspaceHomeAgentRuntimeParallelDispatchSection } from "./WorkspaceHomeAgentRuntimeParallelDispatchSection";
import { WorkspaceHomeRuntimePolicyIndicator } from "./WorkspaceHomeRuntimePolicyIndicator";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";
import { DEFAULT_INTENT } from "./workspaceHomeAgentControlState";

const WorkspaceHomeAgentRuntimePluginControlPlane = lazy(async () => {
  const module = await import("./WorkspaceHomeAgentRuntimePluginControlPlane");
  return {
    default: module.WorkspaceHomeAgentRuntimePluginControlPlane,
  };
});

const WorkspaceHomeAutonomousIssueDrive = lazy(async () => {
  const module = await import("./WorkspaceHomeAutonomousIssueDrive");
  return {
    default: module.WorkspaceHomeAutonomousIssueDrive,
  };
});

type WorkspaceHomeAgentRuntimeOrchestrationProps = {
  workspaceId: string;
  workspace?: WorkspaceInfo | null;
  intent?: AgentIntentState;
};

export function WorkspaceHomeAgentRuntimeOrchestration({
  workspaceId,
  workspace = null,
  intent = DEFAULT_INTENT,
}: WorkspaceHomeAgentRuntimeOrchestrationProps) {
  const [runtimeDraftBatchConfig, setRuntimeDraftBatchConfig] = useState(
    DEFAULT_RUNTIME_BATCH_PREVIEW_CONFIG
  );
  const {
    browserAssessment,
    browserExtraction,
    executionProfiles,
    missionControlProjection,
    parallelDispatch,
    pollSeconds,
    prepareRunLauncher,
    providerRouteOptions,
    refreshRuntimeTasks,
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryExecutionContractStatus,
    repositoryLaunchDefaults,
    resumeRecoverableTasks,
    runtimeLaunchPreparation,
    runtimeLaunchPreparationContextTruth,
    runtimeLaunchPreparationGuidanceStack,
    runtimeLaunchPreparationTriageSummary,
    runtimeLaunchPreparationDelegationContract,
    runtimeLaunchPreparationRepoGuidanceSummary,
    runtimeLaunchPreparationError,
    runtimeLaunchPreparationLoading,
    runtimeLaunchPlanApprovalRequired,
    runtimeLaunchPlanApproved,
    runtimeLaunchPlanVersion,
    approveRuntimeLaunchPlan,
    clearRuntimeLaunchPlanApproval,
    runtimeLaunchPreparationTruthSourceLabel,
    runtimeDraftInstruction,
    runtimeDraftProfileId,
    runtimeDraftProfileTouched,
    runtimeDraftProviderRoute,
    runtimeDraftTitle,
    runtimeDurabilityWarning,
    runtimeError,
    runtimeInfo,
    runtimeLoading,
    runtimePluginControlPlaneSurface,
    runtimeSourceDraft,
    runtimeStatusFilter,
    selectedExecutionProfile,
    selectedProviderRoute,
    setPollSeconds,
    setRuntimeDraftInstruction,
    selectRuntimeDraftProfile,
    setRuntimeDraftProviderRoute,
    setRuntimeDraftTitle,
    setRuntimeSourceDraft,
    setRuntimeStatusFilter,
    startRuntimeManagedTask,
    interruptAllActiveTasks,
    interruptRuntimeTaskById,
    interruptStalePendingApprovals,
    resumeRuntimeTaskById,
    interveneRuntimeTaskById,
    decideRuntimeApproval,
  } = useWorkspaceRuntimeMissionControlController(workspaceId);

  const runtimeSummary = missionControlProjection.runtimeSummary;
  const missionRunSummary = missionControlProjection.missionRunSummary;
  const missionControlLoopItems = missionControlProjection.missionControlLoopItems;
  const continuityReadiness = missionControlProjection.continuity.summary;
  const continuityItemsByTaskId = missionControlProjection.continuity.itemsByTaskId;
  const resumeReadyRuntimeTasks = missionControlProjection.continuity.resumeReadyTasks;
  const pendingApprovalTasks = missionControlProjection.approvalPressure.pendingTasks;
  const stalePendingApprovalTasks = missionControlProjection.approvalPressure.staleTasks;
  const oldestPendingApprovalTask = missionControlProjection.approvalPressure.oldestPendingTask;
  const oldestPendingApprovalId = oldestPendingApprovalTask?.pendingApprovalId ?? null;
  const policy = missionControlProjection.policy;
  const browserReadiness = missionControlProjection.browserReadiness;
  const browserReadinessStatusLabel =
    browserReadiness.state === "ready"
      ? "Ready"
      : browserReadiness.state === "blocked"
        ? "Blocked"
        : "Attention";
  const browserReadinessStatusTone =
    browserReadiness.state === "ready"
      ? "success"
      : browserReadiness.state === "blocked"
        ? "danger"
        : "warning";
  const pluginCatalog = missionControlProjection.pluginCatalog;
  const composition = missionControlProjection.composition;
  const readinessNeedsActionCount =
    pluginCatalog.readinessSections.find((section) => section.id === "needs_action")?.entries
      .length ?? 0;
  const readinessSelectedNowCount =
    pluginCatalog.readinessSections.find((section) => section.id === "selected_now")?.entries
      .length ?? 0;
  const pluginCatalogStatus = pluginCatalog.error
    ? {
        label: "Attention",
        tone: "warning" as const,
      }
    : pluginCatalog.blockedCount > 0
      ? {
          label: "Blocked",
          tone: "danger" as const,
        }
      : pluginCatalog.attentionCount > 0
        ? {
            label: "Attention",
            tone: "warning" as const,
          }
        : pluginCatalog.readyCount > 0
          ? {
              label: "Ready",
              tone: "success" as const,
            }
          : pluginCatalog.total > 0
            ? {
                label: "Cataloged",
                tone: "neutral" as const,
              }
            : {
                label: "Empty",
                tone: "neutral" as const,
              };
  const launchReadiness = missionControlProjection.launchReadiness;
  const launchReadinessStatusLabel =
    launchReadiness.state === "ready"
      ? "Ready"
      : launchReadiness.state === "blocked"
        ? "Blocked"
        : "Attention";
  const launchReadinessStatusTone =
    launchReadiness.state === "ready"
      ? "success"
      : launchReadiness.state === "blocked"
        ? "danger"
        : "warning";
  const activeRuntimeCount = missionControlProjection.runList.activeRuntimeCount;
  const visibleRuntimeRuns = missionControlProjection.runList.visibleRuntimeRuns;
  const persistentFlowRuns = useMemo(
    () =>
      visibleRuntimeRuns.map((entry) => {
        const run = entry.run ?? entry.task.runSummary ?? null;
        return {
          id: run?.id ?? entry.task.taskId,
          title: run?.title ?? entry.task.title ?? null,
          updatedAt: run?.updatedAt ?? entry.task.updatedAt,
          changedPaths: run?.changedPaths ?? null,
          validations: run?.validations ?? null,
          reviewPackId: run?.reviewPackId ?? entry.task.reviewPackId ?? null,
        };
      }),
    [visibleRuntimeRuns]
  );
  const checkpointFailureSummary =
    runtimeDurabilityWarning &&
    runtimeDurabilityWarning.checkpointWriteFailedTotal !== null &&
    runtimeDurabilityWarning.checkpointWriteTotal !== null
      ? `${runtimeDurabilityWarning.checkpointWriteFailedTotal}/${runtimeDurabilityWarning.checkpointWriteTotal}`
      : "n/a";
  const degradedLabel =
    runtimeDurabilityWarning?.degraded === null
      ? "unknown"
      : runtimeDurabilityWarning?.degraded
        ? "true"
        : "false";
  const revisionLabel = runtimeDurabilityWarning?.revision ?? "n/a";
  const repeatsLabel = runtimeDurabilityWarning ? `x${runtimeDurabilityWarning.repeatCount}` : "x0";
  const runtimeBatchPreview = useMemo(
    () => parseRuntimeBatchPreviewState(runtimeDraftBatchConfig),
    [runtimeDraftBatchConfig]
  );
  const runtimeBatchPreviewEdges = useMemo(() => {
    const taskKeys = new Set(runtimeBatchPreview.tasks.map((task) => task.taskKey));
    return runtimeBatchPreview.tasks.flatMap((task) =>
      task.dependsOn
        .filter((dependency) => taskKeys.has(dependency))
        .map((dependency) => `${dependency} -> ${task.taskKey}`)
    );
  }, [runtimeBatchPreview.tasks]);
  const runtimeBatchPreviewLaunchError = runtimeBatchPreview.enabled
    ? readRuntimeParallelDispatchPlanLaunchError(runtimeBatchPreview)
    : null;
  const runtimePlan = runtimeLaunchPreparation?.plan ?? null;
  const runtimePlanNeedsApproval =
    runtimeLaunchPlanApprovalRequired && runtimeLaunchPlanVersion !== null;

  useEffect(() => {
    for (const entry of visibleRuntimeRuns.slice(0, 8)) {
      const runId = entry.run?.id ?? entry.task.runSummary?.id ?? entry.task.taskId;
      if (!runId) {
        continue;
      }
      void primeRuntimeRunTruth({
        runId,
        workspaceId: entry.task.workspaceId ?? workspaceId,
      });
    }
  }, [visibleRuntimeRuns, workspaceId]);

  useWorkspacePersistentFlowState({
    workspaceId,
    intent,
    runs: persistentFlowRuns,
  });

  return (
    <div className={controlStyles.controlSection}>
      <div className={controlStyles.sectionTitle}>Mission Control</div>
      <div className="workspace-home-code-runtime-toolbar">
        <label>
          <span>Run state</span>
          <select
            value={runtimeStatusFilter}
            onChange={(event) =>
              setRuntimeStatusFilter(
                event.target.value as RuntimeAgentTaskSummary["status"] | "all"
              )
            }
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="awaiting_approval">Needs input</option>
            <option value="completed">Review ready</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="interrupted">Interrupted</option>
          </select>
        </label>
        <label>
          <span>Diagnostics Poll (sec)</span>
          <input
            type="number"
            min={15}
            step={1}
            value={pollSeconds}
            onChange={(event) => setPollSeconds(Math.max(15, Number(event.target.value) || 15))}
          />
        </label>
        <button
          type="button"
          onClick={() => void interruptAllActiveTasks()}
          disabled={runtimeLoading}
        >
          Interrupt active runs ({activeRuntimeCount})
        </button>
        <button
          type="button"
          onClick={() => void resumeRecoverableTasks()}
          disabled={runtimeLoading || resumeReadyRuntimeTasks.length === 0}
        >
          Resume recoverable runs ({resumeReadyRuntimeTasks.length})
        </button>
      </div>
      <div className="workspace-home-code-runtime-summary">
        <span>Runs: {runtimeSummary.total}</span>
        <span>Running: {missionRunSummary.running}</span>
        <span>Queued: {missionRunSummary.queued}</span>
        <span>Needs input: {missionRunSummary.needsInput}</span>
        <span>Review ready: {missionRunSummary.reviewReady}</span>
        <span>Recoverable: {continuityReadiness.recoverableRunCount}</span>
        <span>Handoff ready: {continuityReadiness.handoffReadyCount}</span>
        <span>Policy: {policy.statusLabel}</span>
        <span>Browser: {browserReadinessStatusLabel}</span>
        <span>Plugins: {pluginCatalog.total}</span>
        <span>Bound: {pluginCatalog.boundCount}</span>
        <span>
          Profile: {composition.activeProfileName ?? composition.activeProfileId ?? "none"}
        </span>
        <span>Finished: {runtimeSummary.finished}</span>
        <button type="button" onClick={() => void refreshRuntimeTasks()} disabled={runtimeLoading}>
          {runtimeLoading ? "Syncing..." : "Sync runs"}
        </button>
      </div>
      <div className={controlStyles.sectionMeta}>
        Control devices can observe runs started elsewhere, approve or intervene with low overhead,
        resume from checkpoints after handoff, and finish in Review Pack once runtime marks the run
        complete.
      </div>
      {workspace ? (
        <WorkspaceHomeAiWebLabSection
          workspace={workspace}
          onApplyArtifactToDraft={(artifact) => {
            setRuntimeDraftInstruction(artifact.content ?? "");
            if (runtimeDraftTitle.trim().length === 0) {
              setRuntimeDraftTitle(artifact.pageTitle?.trim() || `AI Web Lab - ${workspace.name}`);
            }
          }}
        />
      ) : null}
      <div className="workspace-home-code-runtime-item">
        <div className="workspace-home-code-runtime-item-main">
          <strong>Control-device loop</strong>
          {missionControlLoopItems.map((item) => (
            <span key={item.id}>
              {item.label}: {item.detail}
            </span>
          ))}
        </div>
      </div>
      <WorkspaceHomeRuntimePolicyIndicator policy={policy} />
      <WorkspaceHomeAgentRuntimeBrowserSection
        browserAssessment={browserAssessment}
        browserExtraction={browserExtraction}
        browserReadiness={browserReadiness}
        browserReadinessStatusLabel={browserReadinessStatusLabel}
        browserReadinessStatusTone={browserReadinessStatusTone}
      />
      <WorkspaceHomeAgentRuntimeMiniProgramSection workspaceId={workspaceId} />
      <Suspense
        fallback={
          <MissionControlSectionCard
            title="Autonomous Issue Drive"
            statusLabel="Loading"
            statusTone="neutral"
          >
            <div className={controlStyles.sectionMeta}>
              Preparing the GitHub issue ingestion controls.
            </div>
          </MissionControlSectionCard>
        }
      >
        <WorkspaceHomeAutonomousIssueDrive
          workspaceId={workspaceId}
          launchAllowed={launchReadiness.launchAllowed}
          runtimeLoading={runtimeLoading}
          repositoryExecutionContract={repositoryExecutionContract}
          repositoryExecutionContractError={repositoryExecutionContractError}
          repositoryExecutionContractStatus={repositoryExecutionContractStatus}
          preferredBackendIds={selectedProviderRoute?.preferredBackendIds ?? null}
          refreshRuntimeTasks={refreshRuntimeTasks}
        />
      </Suspense>
      <MissionControlSessionLogSection workspaceId={workspaceId} />
      <Suspense
        fallback={<div className={controlStyles.sectionMeta}>Loading plugin control plane...</div>}
      >
        <WorkspaceHomeAgentRuntimePluginControlPlane
          workspaceId={workspaceId}
          pluginControlPlaneSurface={runtimePluginControlPlaneSurface}
          refreshRuntimeTasks={refreshRuntimeTasks}
          runtimeLoading={runtimeLoading}
        />
      </Suspense>
      <MissionControlSectionCard
        title="Extension readiness"
        statusLabel={pluginCatalogStatus.label}
        statusTone={pluginCatalogStatus.tone}
        meta={
          <>
            <ToolCallChip
              tone={
                pluginCatalog.blockedCount > 0
                  ? "danger"
                  : pluginCatalog.attentionCount > 0
                    ? "warning"
                    : "success"
              }
            >
              Action required {readinessNeedsActionCount}
            </ToolCallChip>
            <ToolCallChip tone="success">Selected now {readinessSelectedNowCount}</ToolCallChip>
            <ToolCallChip tone="neutral">
              Verified/runtime-managed {pluginCatalog.verifiedPackageCount}
            </ToolCallChip>
          </>
        }
      >
        <div className="workspace-home-code-runtime-item" data-testid="workspace-runtime-plugins">
          <div className="workspace-home-code-runtime-item-main">
            <strong>
              {pluginCatalog.total > 0
                ? "Runtime-published extension readiness is available."
                : "No runtime-published plugins discovered for this workspace."}
            </strong>
            <span>
              Action required now: {pluginCatalog.blockedCount + pluginCatalog.attentionCount} |
              ready {pluginCatalog.readyCount}
            </span>
            <span>
              Source mix: runtime extensions {pluginCatalog.runtimeExtensionCount} | live skills{" "}
              {pluginCatalog.liveSkillCount} | repo manifests {pluginCatalog.repoManifestCount} |
              external packages {pluginCatalog.externalPackageCount}
            </span>
            <span>
              Trust posture: verified/runtime-managed {pluginCatalog.verifiedPackageCount} |
              trust-blocked {pluginCatalog.blockedPackageCount}
            </span>
            <span>
              Active selection: profile-selected {pluginCatalog.selectedInActiveProfileCount} |
              route candidates {composition.selectedRouteCount} | backend candidates{" "}
              {composition.selectedBackendCount}
            </span>
            <span>
              Runtime host truth:{" "}
              {pluginCatalog.unsupportedHostCount > 0 ? "published" : "not published"}
            </span>
            <span>
              Projection slice: {pluginCatalog.projectionBacked ? "connected" : "capability-only"}
            </span>
            <span>
              Control plane:{" "}
              {composition.activeProfileName ?? composition.activeProfileId ?? "none"} | verified{" "}
              {composition.verifiedPluginCount} | blocked {composition.blockedPluginCount} | routes{" "}
              {composition.selectedRouteCount} | backends {composition.selectedBackendCount}
            </span>
          </div>
          {pluginCatalog.error ? (
            <div className={controlStyles.warning}>{pluginCatalog.error}</div>
          ) : null}
        </div>
        {pluginCatalog.readinessSections
          .filter((section) => section.entries.length > 0)
          .map((section) => (
            <div key={section.id}>
              <div className="workspace-home-code-runtime-item">
                <div className="workspace-home-code-runtime-item-main">
                  <strong>{section.title}</strong>
                  <span>{section.description}</span>
                </div>
              </div>
              {section.entries.map((entry) => (
                <div key={entry.id} className="workspace-home-code-runtime-item">
                  <div className="workspace-home-code-runtime-item-main">
                    <strong>
                      {entry.name} ({entry.version})
                    </strong>
                    <span>
                      {entry.badges.map((badge) => (
                        <ToolCallChip key={`${entry.id}-${badge.label}`} tone={badge.tone}>
                          {badge.label}
                        </ToolCallChip>
                      ))}
                    </span>
                    <span>Source: {entry.sourceLabel}</span>
                    <span>Selection: {entry.selectionState.label}</span>
                    <span>Trust: {entry.trustState.label}</span>
                    <span>Capability support: {entry.capabilitySupport.summary}</span>
                    <span>Permission state: {entry.permissionState.label}</span>
                    <span>Readiness: {entry.readiness.label}</span>
                    <span>{entry.readiness.detail}</span>
                    <span>{entry.selectionState.detail}</span>
                    <span>{entry.trustState.detail}</span>
                    <span>Remediation: {entry.remediationSummary}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </MissionControlSectionCard>
      {runtimeDurabilityWarning ? (
        <div className={controlStyles.warning} data-testid="workspace-runtime-durability-warning">
          <strong>Runtime durability degraded</strong>
          <div className={controlStyles.sectionMeta}>
            Reason: {runtimeDurabilityWarning.reason} | Mode:{" "}
            {runtimeDurabilityWarning.mode ?? "n/a"} | Degraded: {degradedLabel} | Revision:{" "}
            {revisionLabel} | Repeats: {repeatsLabel} | Checkpoint failed:{" "}
            {checkpointFailureSummary} | Updated:{" "}
            {formatRuntimeTimestamp(runtimeDurabilityWarning.updatedAt)}
          </div>
        </div>
      ) : null}
      <MissionControlSectionCard
        title="Continuity readiness"
        statusLabel={
          continuityReadiness.blockingReason
            ? "Blocked"
            : continuityReadiness.recoverableRunCount > 0 ||
                continuityReadiness.handoffReadyCount > 0
              ? "Active"
              : "Ready"
        }
        statusTone={
          continuityReadiness.blockingReason
            ? "danger"
            : continuityReadiness.reviewBlockedCount > 0 || continuityReadiness.missingPathCount > 0
              ? "warning"
              : "success"
        }
        meta={
          <>
            <ToolCallChip tone="neutral">
              Resume ready {continuityReadiness.recoverableRunCount}
            </ToolCallChip>
            <ToolCallChip tone="neutral">
              Handoff ready {continuityReadiness.handoffReadyCount}
            </ToolCallChip>
          </>
        }
      >
        <div
          className="workspace-home-code-runtime-item"
          data-testid="workspace-runtime-continuity"
        >
          <div className="workspace-home-code-runtime-item-main">
            <strong>{continuityReadiness.headline}</strong>
            <span>{continuityReadiness.recommendedAction}</span>
            <span>Resume ready: {continuityReadiness.recoverableRunCount}</span>
            <span>Handoff ready: {continuityReadiness.handoffReadyCount}</span>
            <span>Missing continue path: {continuityReadiness.missingPathCount}</span>
            <span>Review blocked: {continuityReadiness.reviewBlockedCount}</span>
          </div>
          {continuityReadiness.blockingReason ? (
            <div className={controlStyles.warning}>{continuityReadiness.blockingReason}</div>
          ) : null}
        </div>
        {resumeReadyRuntimeTasks.length > 0 ? (
          <div className="workspace-home-code-runtime-item">
            <div className="workspace-home-code-runtime-item-main">
              <strong>Recovered runs awaiting resume: {resumeReadyRuntimeTasks.length}</strong>
              <span>
                These runs published canonical resume paths and can continue from runtime-owned
                checkpoint truth.
              </span>
            </div>
            <div className="workspace-home-code-runtime-item-actions">
              <button
                type="button"
                onClick={() => void resumeRecoverableTasks()}
                disabled={runtimeLoading}
              >
                Resume all recoverable runs ({resumeReadyRuntimeTasks.length})
              </button>
            </div>
          </div>
        ) : null}
      </MissionControlSectionCard>
      <MissionControlSectionCard
        title="Approval pressure"
        statusLabel={
          stalePendingApprovalTasks.length > 0
            ? "Attention"
            : pendingApprovalTasks.length > 0
              ? "Queued"
              : "Clear"
        }
        statusTone={
          stalePendingApprovalTasks.length > 0
            ? "warning"
            : pendingApprovalTasks.length > 0
              ? "running"
              : "success"
        }
        meta={
          <>
            <ToolCallChip tone="neutral">Pending {pendingApprovalTasks.length}</ToolCallChip>
            <ToolCallChip tone="neutral">Stale {stalePendingApprovalTasks.length}</ToolCallChip>
          </>
        }
      >
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>Approval queue ({pendingApprovalTasks.length})</strong>
            <span>Stale pending: {stalePendingApprovalTasks.length}</span>
            <span>SLA threshold: 10m</span>
            {oldestPendingApprovalId ? (
              <div className="workspace-home-code-runtime-item-actions">
                <button
                  type="button"
                  onClick={() => void decideRuntimeApproval(oldestPendingApprovalId, "approved")}
                  disabled={runtimeLoading}
                >
                  Approve oldest request
                </button>
                <button
                  type="button"
                  onClick={() => void decideRuntimeApproval(oldestPendingApprovalId, "rejected")}
                  disabled={runtimeLoading}
                >
                  Reject oldest request
                </button>
                <button
                  type="button"
                  onClick={() => void interruptStalePendingApprovals()}
                  disabled={runtimeLoading || stalePendingApprovalTasks.length === 0}
                >
                  Interrupt stale input ({stalePendingApprovalTasks.length})
                </button>
              </div>
            ) : null}
          </div>
          {oldestPendingApprovalTask ? (
            <div className={controlStyles.sectionMeta}>
              <span>
                Oldest pending:{" "}
                {oldestPendingApprovalTask.title?.trim().length
                  ? oldestPendingApprovalTask.title
                  : oldestPendingApprovalTask.taskId}
              </span>
              <span> | Updated: {formatRuntimeTimestamp(oldestPendingApprovalTask.updatedAt)}</span>
            </div>
          ) : (
            <div className={controlStyles.emptyState}>No pending input requests.</div>
          )}
        </div>
      </MissionControlSectionCard>
      {runtimeError && <div className={controlStyles.error}>{runtimeError}</div>}
      {runtimeInfo && <div className={controlStyles.sectionMeta}>{runtimeInfo}</div>}

      <MissionControlSectionCard
        title="Launch readiness"
        statusLabel={launchReadinessStatusLabel}
        statusTone={launchReadinessStatusTone}
        meta={
          <>
            <ToolCallChip tone="neutral">
              Route {selectedProviderRoute?.label ?? "Automatic workspace routing"}
            </ToolCallChip>
            <ToolCallChip tone="neutral">Review ready {missionRunSummary.reviewReady}</ToolCallChip>
          </>
        }
      >
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>{launchReadiness.headline}</strong>
            <span>{launchReadiness.recommendedAction}</span>
            <span>
              {launchReadiness.runtime.label}: {launchReadiness.runtime.detail}
            </span>
            <span>
              {launchReadiness.route.label}: {launchReadiness.route.detail}
            </span>
            {launchReadiness.route.provenanceLabel ? (
              <span>Selection source: {launchReadiness.route.provenanceLabel}</span>
            ) : null}
            {launchReadiness.route.fallbackDetail ? (
              <span>Fallback: {launchReadiness.route.fallbackDetail}</span>
            ) : null}
            {launchReadiness.route.blockingReason ? (
              <span>Route blocker: {launchReadiness.route.blockingReason}</span>
            ) : null}
            <span>
              {launchReadiness.approvalPressure.label}: {launchReadiness.approvalPressure.detail}
            </span>
            <span>
              {launchReadiness.executionReliability.label}:{" "}
              {launchReadiness.executionReliability.detail}
            </span>
          </div>
          {launchReadiness.blockingReason ? (
            <div className={controlStyles.warning}>{launchReadiness.blockingReason}</div>
          ) : null}
        </div>
        <input
          type="text"
          value={runtimeDraftTitle}
          onChange={(event) => setRuntimeDraftTitle(event.target.value)}
          placeholder="Mission title (optional)"
        />
        <textarea
          value={runtimeDraftInstruction}
          onChange={(event) => setRuntimeDraftInstruction(event.target.value)}
          rows={2}
          placeholder="Mission brief for agent"
        />
        {runtimeDraftInstruction.trim().length > 0 ? (
          <div className="workspace-home-code-runtime-item">
            <div className="workspace-home-code-runtime-item-main">
              <strong>Mission planning</strong>
              {runtimeLaunchPreparation ? (
                <>
                  {runtimeLaunchPreparationLoading ? (
                    <span>Refreshing runtime-owned launch plan...</span>
                  ) : null}
                  {runtimeLaunchPreparationTruthSourceLabel ? (
                    <span>Truth source: {runtimeLaunchPreparationTruthSourceLabel}</span>
                  ) : null}
                  {runtimePlan ? (
                    <>
                      <span>Plan version: {runtimePlan.planVersion}</span>
                      <span>
                        Plan approval: {runtimeLaunchPlanApproved ? "approved" : "pending"}
                      </span>
                      <span>{runtimePlan.summary}</span>
                      <span>
                        Milestones: {runtimePlan.milestones.length} | Validation lanes:{" "}
                        {runtimePlan.validationLanes.length} | Skill plan:{" "}
                        {runtimePlan.skillPlan.length}
                      </span>
                      <span>
                        Estimated worker runs:{" "}
                        {runtimePlan.estimatedWorkerRuns ?? "runtime did not estimate"}
                        {typeof runtimePlan.estimatedDurationMinutes === "number"
                          ? ` | Duration: ${runtimePlan.estimatedDurationMinutes} min`
                          : ""}
                      </span>
                      <span>Parallelism: {runtimePlan.parallelismHint}</span>
                      {runtimePlan.clarifyingQuestions.length > 0 ? (
                        <span>Clarify first: {runtimePlan.clarifyingQuestions.join(" | ")}</span>
                      ) : null}
                    </>
                  ) : null}
                  <span>{runtimeLaunchPreparation.runIntent.summary}</span>
                  <span>
                    Clarified: {runtimeLaunchPreparation.runIntent.clarified ? "yes" : "needs work"}
                  </span>
                  <span>Risk: {runtimeLaunchPreparation.runIntent.riskLevel}</span>
                  <span>{runtimeLaunchPreparation.contextWorkingSet.summary}</span>
                  {runtimeLaunchPreparationContextTruth ? (
                    <span>Context truth: {runtimeLaunchPreparationContextTruth.summary}</span>
                  ) : null}
                  {runtimeLaunchPreparationDelegationContract ? (
                    <span>
                      Delegation: {runtimeLaunchPreparationDelegationContract.summary} Next:{" "}
                      {runtimeLaunchPreparationDelegationContract.nextOperatorAction}
                    </span>
                  ) : null}
                  {runtimeLaunchPreparation.delegationPlan ? (
                    <span>
                      Delegation plan: {runtimeLaunchPreparation.delegationPlan.summary} | Child
                      count {runtimeLaunchPreparation.delegationPlan.childCount} | Batches{" "}
                      {runtimeLaunchPreparation.delegationPlan.batches.length}
                    </span>
                  ) : null}
                  {runtimeLaunchPreparation.auxiliaryExecutionPolicy ? (
                    <span>
                      Auxiliary execution:{" "}
                      {runtimeLaunchPreparation.auxiliaryExecutionPolicy.summary}
                    </span>
                  ) : null}
                  {runtimeLaunchPreparationGuidanceStack ? (
                    <span>Guidance: {runtimeLaunchPreparationGuidanceStack.summary}</span>
                  ) : null}
                  {runtimeLaunchPreparationRepoGuidanceSummary ? (
                    <span>{runtimeLaunchPreparationRepoGuidanceSummary}</span>
                  ) : null}
                  {runtimeLaunchPreparationTriageSummary ? (
                    <span>Triage: {runtimeLaunchPreparationTriageSummary.summary}</span>
                  ) : null}
                  <span>
                    Context strategy:{" "}
                    {runtimeLaunchPreparation.contextWorkingSet.selectionPolicy?.strategy ??
                      "balanced"}{" "}
                    | budget{" "}
                    {runtimeLaunchPreparation.contextWorkingSet.selectionPolicy
                      ?.tokenBudgetTarget ?? 1500}{" "}
                    | tools{" "}
                    {runtimeLaunchPreparation.contextWorkingSet.selectionPolicy
                      ?.toolExposureProfile ?? "slim"}
                  </span>
                  <span>{runtimeLaunchPreparation.executionGraph.summary}</span>
                  <span>
                    Approval batches:{" "}
                    {runtimeLaunchPreparation.approvalBatches.length > 0
                      ? runtimeLaunchPreparation.approvalBatches
                          .map((batch) => `${batch.summary} (${batch.actionCount})`)
                          .join(" | ")
                      : "none"}
                  </span>
                  <span>
                    Validation: {runtimeLaunchPreparation.validationPlan.summary}
                    {runtimeLaunchPreparation.validationPlan.commands.length > 0
                      ? ` | ${runtimeLaunchPreparation.validationPlan.commands.join(" | ")}`
                      : ""}
                  </span>
                  <span>
                    Review focus:{" "}
                    {runtimeLaunchPreparation.reviewFocus.length > 0
                      ? runtimeLaunchPreparation.reviewFocus.join(" | ")
                      : "runtime did not publish review focus"}
                  </span>
                  {runtimeLaunchPreparation.runIntent.missingContext.length > 0 ? (
                    <span>
                      Missing context:{" "}
                      {runtimeLaunchPreparation.runIntent.missingContext.join(" | ")}
                    </span>
                  ) : null}
                </>
              ) : runtimeLaunchPreparationLoading ? (
                <span>Preparing runtime-owned launch plan...</span>
              ) : (
                <span>Runtime launch plan unavailable.</span>
              )}
            </div>
            {runtimePlanNeedsApproval ? (
              <div className="workspace-home-code-runtime-item-actions">
                <button
                  type="button"
                  onClick={() => approveRuntimeLaunchPlan()}
                  disabled={runtimeLaunchPlanApproved}
                >
                  {runtimeLaunchPlanApproved ? "Plan approved" : "Approve current plan"}
                </button>
                <button
                  type="button"
                  onClick={() => clearRuntimeLaunchPlanApproval()}
                  disabled={!runtimeLaunchPlanApproved}
                >
                  Reset approval
                </button>
              </div>
            ) : null}
            {runtimeLaunchPreparation?.contextWorkingSet.layers.length ? (
              <div className={controlStyles.sectionMeta}>
                {runtimeLaunchPreparation.contextWorkingSet.layers
                  .map((layer) => {
                    const entries = layer.entries.map((entry) => entry.label).join(", ");
                    return `${layer.tier}: ${entries || layer.summary}`;
                  })
                  .join(" | ")}
              </div>
            ) : null}
            {runtimeLaunchPreparationContextTruth ? (
              <div className={controlStyles.sectionMeta}>
                {[
                  `intent: ${runtimeLaunchPreparationContextTruth.reviewIntent}`,
                  `owner: ${runtimeLaunchPreparationContextTruth.ownerSummary}`,
                  runtimeLaunchPreparationContextTruth.canonicalTaskSource
                    ? `source: ${runtimeLaunchPreparationContextTruth.canonicalTaskSource.label}`
                    : null,
                ]
                  .filter((value): value is string => Boolean(value))
                  .join(" | ")}
              </div>
            ) : null}
            {runtimeLaunchPreparationTriageSummary ? (
              <div className={controlStyles.sectionMeta}>
                {[
                  runtimeLaunchPreparationTriageSummary.owner
                    ? `triage owner: ${runtimeLaunchPreparationTriageSummary.owner}`
                    : "triage owner: unassigned",
                  runtimeLaunchPreparationTriageSummary.priority
                    ? `priority: ${runtimeLaunchPreparationTriageSummary.priority}`
                    : null,
                  runtimeLaunchPreparationTriageSummary.riskLevel
                    ? `risk: ${runtimeLaunchPreparationTriageSummary.riskLevel}`
                    : null,
                  runtimeLaunchPreparationTriageSummary.tags.length > 0
                    ? `tags: ${runtimeLaunchPreparationTriageSummary.tags.join(", ")}`
                    : null,
                ]
                  .filter((value): value is string => Boolean(value))
                  .join(" | ")}
              </div>
            ) : null}
            {runtimeLaunchPreparationGuidanceStack?.layers.length ? (
              <div className={controlStyles.sectionMeta}>
                {runtimeLaunchPreparationGuidanceStack.layers
                  .slice()
                  .sort((left, right) => right.priority - left.priority)
                  .map((layer) => `${layer.scope}: ${layer.summary}`)
                  .join(" | ")}
              </div>
            ) : null}
            {runtimeLaunchPreparation?.delegationPlan?.batches.length ? (
              <div className={controlStyles.sectionMeta}>
                {[
                  `delegation plan: ${runtimeLaunchPreparation.delegationPlan.summary}`,
                  `fan-out: ${runtimeLaunchPreparation.delegationPlan.childCount}`,
                  `review required: ${
                    runtimeLaunchPreparation.delegationPlan.reviewRequired ? "yes" : "no"
                  }`,
                  runtimeLaunchPreparation.delegationPlan.batches
                    .map(
                      (batch) =>
                        `${batch.id} ${batch.strategy}/${batch.mergeStrategy} -> ${batch.childRoles.join(", ")}`
                    )
                    .join(" | "),
                ]
                  .filter((value): value is string => Boolean(value))
                  .join(" | ")}
              </div>
            ) : null}
            {runtimeLaunchPreparation?.auxiliaryExecutionPolicy ? (
              <div className={controlStyles.sectionMeta}>
                {[
                  `auxiliary policy: ${runtimeLaunchPreparation.auxiliaryExecutionPolicy.summary}`,
                  runtimeLaunchPreparation.auxiliaryExecutionPolicy.enabled
                    ? "enabled"
                    : "disabled",
                  runtimeLaunchPreparation.auxiliaryExecutionPolicy.routes.length > 0
                    ? runtimeLaunchPreparation.auxiliaryExecutionPolicy.routes
                        .map((route) => `${route.task}:${route.mode}`)
                        .join(" | ")
                    : null,
                ]
                  .filter((value): value is string => Boolean(value))
                  .join(" | ")}
              </div>
            ) : null}
            {runtimeLaunchPreparation?.executionGraph.nodes.length ? (
              <div className={controlStyles.sectionMeta}>
                {runtimeLaunchPreparation.executionGraph.nodes
                  .map((node) => `${node.label} [${node.kind}]`)
                  .join(" -> ")}
              </div>
            ) : null}
            {runtimePlan?.milestones.length ? (
              <div className={controlStyles.sectionMeta}>
                {runtimePlan.milestones
                  .map((milestone) => {
                    const criteria =
                      milestone.acceptanceCriteria && milestone.acceptanceCriteria.length > 0
                        ? ` | ${milestone.acceptanceCriteria.join(" / ")}`
                        : "";
                    return `${milestone.label} [${milestone.status ?? "planned"}]${criteria}`;
                  })
                  .join(" | ")}
              </div>
            ) : null}
            {runtimePlan?.validationLanes.length ? (
              <div className={controlStyles.sectionMeta}>
                {runtimePlan.validationLanes
                  .map(
                    (lane) =>
                      `${lane.label} (${lane.trigger})${
                        lane.commands?.length ? `: ${lane.commands.join(", ")}` : ""
                      }`
                  )
                  .join(" | ")}
              </div>
            ) : null}
            {runtimePlan?.skillPlan.length ? (
              <div className={controlStyles.sectionMeta}>
                {runtimePlan.skillPlan
                  .map((skill) => `${skill.label} [${skill.state}]`)
                  .join(" | ")}
              </div>
            ) : null}
            {runtimeLaunchPreparationError ? (
              <div className={controlStyles.warning}>{runtimeLaunchPreparationError}</div>
            ) : null}
          </div>
        ) : null}
        <label>
          <span>Batch config (parallel dispatch)</span>
          <textarea
            value={runtimeDraftBatchConfig}
            onChange={(event) => setRuntimeDraftBatchConfig(event.target.value)}
            rows={8}
            spellCheck={false}
          />
        </label>
        <WorkspaceHomeAgentRuntimeParallelDispatchSection
          runtimeBatchPreview={runtimeBatchPreview}
          runtimeBatchPreviewEdges={runtimeBatchPreviewEdges}
          parallelDispatch={parallelDispatch}
        />
        {runtimeSourceDraft ? (
          <div className="workspace-home-code-runtime-item">
            <div className="workspace-home-code-runtime-item-main">
              <strong>
                Intervention draft from {runtimeSourceDraft.title || runtimeSourceDraft.taskId}
              </strong>
              <span>Intent: {runtimeSourceDraft.intent.replaceAll("_", " ")}</span>
              {runtimeSourceDraft.taskSource?.label ? (
                <span>Source-linked launch: {runtimeSourceDraft.taskSource.label}</span>
              ) : null}
              {runtimeSourceDraft.reviewProfileId ? (
                <span>Review profile: {runtimeSourceDraft.reviewProfileId}</span>
              ) : null}
              {runtimeSourceDraft.validationPresetId ? (
                <span>Validation preset: {runtimeSourceDraft.validationPresetId}</span>
              ) : null}
              {runtimeSourceDraft.preferredBackendIds?.length ? (
                <span>Preferred backends: {runtimeSourceDraft.preferredBackendIds.join(", ")}</span>
              ) : null}
              {runtimeSourceDraft.accessMode ? (
                <span>Access mode: {runtimeSourceDraft.accessMode}</span>
              ) : null}
              {runtimeSourceDraft.relaunchContext?.summary ? (
                <span>Relaunch context: {runtimeSourceDraft.relaunchContext.summary}</span>
              ) : null}
              <span>
                Profile source:{" "}
                {runtimeSourceDraft.fieldOrigins.executionProfileId.replaceAll("_", " ")}
              </span>
              <span>
                Backend source:{" "}
                {runtimeSourceDraft.fieldOrigins.preferredBackendIds.replaceAll("_", " ")}
              </span>
              <span>
                Review profile source:{" "}
                {runtimeSourceDraft.fieldOrigins.reviewProfileId.replaceAll("_", " ")}
              </span>
              <span>
                Validation source:{" "}
                {runtimeSourceDraft.fieldOrigins.validationPresetId.replaceAll("_", " ")}
              </span>
              <span>
                Access source: {runtimeSourceDraft.fieldOrigins.accessMode.replaceAll("_", " ")}
              </span>
              <span>Review the profile and route below, then relaunch.</span>
            </div>
            <div className="workspace-home-code-runtime-item-actions">
              <button type="button" onClick={() => setRuntimeSourceDraft(null)}>
                Clear intervention draft
              </button>
            </div>
          </div>
        ) : null}
        <div className="workspace-home-code-runtime-create-meta">
          <label>
            <span>Execution profile</span>
            <select
              value={runtimeDraftProfileId}
              onChange={(event) => selectRuntimeDraftProfile(event.target.value)}
            >
              {executionProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Identity route</span>
            <select
              value={runtimeDraftProviderRoute}
              onChange={(event) => setRuntimeDraftProviderRoute(event.target.value)}
            >
              {providerRouteOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void startRuntimeManagedTask(runtimeBatchPreview)}
            disabled={
              runtimeLoading ||
              runtimeDraftInstruction.trim().length === 0 ||
              selectedProviderRoute?.launchAllowed === false ||
              !launchReadiness.launchAllowed ||
              runtimeBatchPreviewLaunchError !== null ||
              (runtimePlanNeedsApproval && !runtimeLaunchPlanApproved)
            }
          >
            {runtimePlanNeedsApproval && !runtimeLaunchPlanApproved
              ? "Approve plan to start"
              : "Start mission run"}
          </button>
        </div>
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>{selectedExecutionProfile.name}</strong>
            <span>{selectedExecutionProfile.description}</span>
            <span>Autonomy: {selectedExecutionProfile.autonomy.replaceAll("_", " ")}</span>
            <span>Supervision: {selectedExecutionProfile.supervisionLabel}</span>
            <span>Routing: {selectedProviderRoute?.label ?? "Automatic workspace routing"}</span>
            <span>Approval posture: {selectedExecutionProfile.approvalSensitivity}</span>
            <span>
              Validation preset: {selectedExecutionProfile.validationPresetId ?? "runtime default"}
            </span>
            {repositoryExecutionContract ? (
              <>
                <span>
                  Repo source mapping: {repositoryLaunchDefaults.sourceMappingKind ?? "defaults"}
                </span>
                <span>
                  Repo profile default:{" "}
                  {repositoryLaunchDefaults.executionProfileId ?? "runtime fallback"}
                </span>
                <span>
                  Repo backend preference:{" "}
                  {repositoryLaunchDefaults.preferredBackendIds?.join(", ") ??
                    "app/runtime fallback"}
                </span>
                <span>
                  Repo validation preset:{" "}
                  {repositoryLaunchDefaults.validationPresetId ?? "runtime fallback"}
                </span>
                {runtimeDraftProfileTouched &&
                repositoryLaunchDefaults.executionProfileId &&
                repositoryLaunchDefaults.executionProfileId !== runtimeDraftProfileId ? (
                  <span>
                    Launcher profile overrides repo default{" "}
                    {repositoryLaunchDefaults.executionProfileId}.
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <div className={controlStyles.sectionMeta}>
            {selectedProviderRoute?.detail ?? "Routing details unavailable."}
          </div>
        </div>
        {repositoryExecutionContractError ? (
          <div className={controlStyles.warning}>{repositoryExecutionContractError}</div>
        ) : null}
      </MissionControlSectionCard>

      <MissionControlRunListSection
        activeRuntimeCount={activeRuntimeCount}
        runtimeTaskCount={runtimeSummary.total}
        runtimeStatusFilter={runtimeStatusFilter}
        visibleRuntimeRuns={visibleRuntimeRuns}
        continuityItemsByTaskId={continuityItemsByTaskId}
        runtimeLoading={runtimeLoading}
        refreshRuntimeTasks={refreshRuntimeTasks}
        interruptRuntimeTaskById={interruptRuntimeTaskById}
        resumeRuntimeTaskById={resumeRuntimeTaskById}
        interveneRuntimeTaskById={interveneRuntimeTaskById}
        prepareRunLauncher={prepareRunLauncher}
        decideRuntimeApproval={decideRuntimeApproval}
      />
    </div>
  );
}
