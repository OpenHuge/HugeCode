import { useEffect, useMemo, useState } from "react";
import { useWorkspaceRuntimeMissionControlController } from "../../../application/runtime/facades/runtimeMissionControlController";
import { primeRuntimeRunTruth } from "../../../application/runtime/facades/runtimeRunTruthStore";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import { ToolCallChip } from "../../../design-system";
import {
  MissionControlRunListSection,
  MissionControlSectionCard,
} from "./WorkspaceHomeMissionControlSections";
import {
  DEFAULT_RUNTIME_BATCH_PREVIEW_CONFIG,
  formatRuntimeTimestamp,
  parseRuntimeBatchPreviewState,
} from "./WorkspaceHomeAgentRuntimeOrchestration.helpers";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentRuntimeOrchestrationProps = {
  workspaceId: string;
};

function formatPolicyValue(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatPolicyList(values: string[] | undefined, fallback: string): string {
  if (!values || values.length === 0) {
    return fallback;
  }
  return values.join(", ");
}

export function WorkspaceHomeAgentRuntimeOrchestration({
  workspaceId,
}: WorkspaceHomeAgentRuntimeOrchestrationProps) {
  const [runtimeDraftBatchConfig, setRuntimeDraftBatchConfig] = useState(
    DEFAULT_RUNTIME_BATCH_PREVIEW_CONFIG
  );
  const {
    executionProfiles,
    missionControlProjection,
    pollSeconds,
    prepareRunLauncher,
    providerRouteOptions,
    refreshRuntimeTasks,
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryLaunchDefaults,
    resumeRecoverableTasks,
    runtimeLaunchPreparation,
    runtimeLaunchPreparationError,
    runtimeLaunchPreparationLoading,
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
  const launchReadiness = missionControlProjection.launchReadiness;
  const activeRuntimeCount = missionControlProjection.runList.activeRuntimeCount;
  const visibleRuntimeRuns = missionControlProjection.runList.visibleRuntimeRuns;
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
  const repositoryPolicyLabel = formatPolicyValue(
    repositoryExecutionContract?.metadata?.label,
    "Repository policy defaults"
  );
  const repositoryPolicyDescription = repositoryExecutionContract?.metadata?.description ?? null;
  const launchExecutionProfileId =
    formatPolicyValue(runtimeSourceDraft?.profileId, "") || selectedExecutionProfile.id;
  const launchAccessMode =
    runtimeSourceDraft?.accessMode ??
    repositoryLaunchDefaults.accessMode ??
    selectedExecutionProfile.accessMode;
  const launchValidationPresetLabel = formatPolicyValue(
    runtimeSourceDraft?.validationPresetId ??
      repositoryLaunchDefaults.validationPresetLabel ??
      repositoryLaunchDefaults.validationPresetId ??
      selectedExecutionProfile.validationPresetId,
    "runtime default"
  );
  const launchReviewProfileLabel = repositoryLaunchDefaults.reviewProfile
    ? `${repositoryLaunchDefaults.reviewProfile.label} (${repositoryLaunchDefaults.reviewProfile.id})`
    : formatPolicyValue(repositoryLaunchDefaults.reviewProfileId, "none");
  const launchBackendPreferenceLabel = formatPolicyList(
    runtimeSourceDraft?.preferredBackendIds ?? repositoryLaunchDefaults.preferredBackendIds,
    "app/runtime fallback"
  );
  const repositoryReviewProfileLabel = repositoryLaunchDefaults.reviewProfile
    ? `${repositoryLaunchDefaults.reviewProfile.label} (${repositoryLaunchDefaults.reviewProfile.id})`
    : formatPolicyValue(repositoryLaunchDefaults.reviewProfileId, "none declared");
  const launcherOverridesRepositoryProfile =
    runtimeDraftProfileTouched &&
    Boolean(repositoryLaunchDefaults.executionProfileId) &&
    repositoryLaunchDefaults.executionProfileId !== runtimeDraftProfileId;

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
        statusLabel={launchReadiness.launchAllowed ? "Ready" : "Blocked"}
        statusTone={launchReadiness.launchAllowed ? "success" : "danger"}
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
              <strong>Runtime launch plan</strong>
              {runtimeLaunchPreparationLoading ? (
                <span>Preparing runtime-owned launch plan...</span>
              ) : runtimeLaunchPreparation ? (
                <>
                  {runtimeLaunchPreparationTruthSourceLabel ? (
                    <span>Truth source: {runtimeLaunchPreparationTruthSourceLabel}</span>
                  ) : null}
                  <span>{runtimeLaunchPreparation.runIntent.summary}</span>
                  <span>
                    Clarified: {runtimeLaunchPreparation.runIntent.clarified ? "yes" : "needs work"}
                  </span>
                  <span>Risk: {runtimeLaunchPreparation.runIntent.riskLevel}</span>
                  <span>{runtimeLaunchPreparation.contextWorkingSet.summary}</span>
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
              ) : (
                <span>Runtime launch plan unavailable.</span>
              )}
            </div>
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
            {runtimeLaunchPreparation?.executionGraph.nodes.length ? (
              <div className={controlStyles.sectionMeta}>
                {runtimeLaunchPreparation.executionGraph.nodes
                  .map((node) => `${node.label} [${node.kind}]`)
                  .join(" -> ")}
              </div>
            ) : null}
            {runtimeLaunchPreparationError ? (
              <div className={controlStyles.warning}>{runtimeLaunchPreparationError}</div>
            ) : null}
          </div>
        ) : null}
        <label>
          <span>Batch config (preview only)</span>
          <textarea
            value={runtimeDraftBatchConfig}
            onChange={(event) => setRuntimeDraftBatchConfig(event.target.value)}
            rows={8}
            spellCheck={false}
          />
        </label>
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>Batch DAG preview</strong>
            <span>Read-only preview for taskKey/dependsOn/maxRetries/onFailure/maxParallel.</span>
            <span>Max parallel: {runtimeBatchPreview.maxParallel}</span>
            <span>Missions: {runtimeBatchPreview.tasks.length}</span>
          </div>
          {runtimeBatchPreview.parseError ? (
            <div className={controlStyles.warning}>{runtimeBatchPreview.parseError}</div>
          ) : (
            <>
              {runtimeBatchPreview.duplicateTaskKeyHints.map((hint) => (
                <div key={hint} className={controlStyles.warning}>
                  {hint}
                </div>
              ))}
              {runtimeBatchPreview.dependencyHints.map((hint) => (
                <div key={hint} className={controlStyles.warning}>
                  {hint}
                </div>
              ))}
              {runtimeBatchPreview.cycleHint ? (
                <div className={controlStyles.warning}>
                  Cycle hint: {runtimeBatchPreview.cycleHint}.
                </div>
              ) : null}
              <div className="workspace-home-code-runtime-list">
                {runtimeBatchPreview.tasks.map((task) => (
                  <div key={task.taskKey} className="workspace-home-code-runtime-item">
                    <div className="workspace-home-code-runtime-item-main">
                      <strong>{task.taskKey}</strong>
                      <span>
                        dependsOn: {task.dependsOn.length > 0 ? task.dependsOn.join(", ") : "root"}
                      </span>
                      <span>retries: {task.maxRetries}</span>
                      <span>onFailure: {task.onFailure}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="workspace-home-code-runtime-item-actions">
                {runtimeBatchPreviewEdges.length > 0 ? (
                  runtimeBatchPreviewEdges.map((edge) => <span key={edge}>{edge}</span>)
                ) : (
                  <span>No dependency edges.</span>
                )}
              </div>
              <div className={controlStyles.sectionMeta}>
                Outcome labels: success = completed task; failed = retries exhausted; skipped =
                blocked by dependencies or failure policy; retried = task rerun up to maxRetries.
              </div>
            </>
          )}
        </div>
        {runtimeSourceDraft ? (
          <div className="workspace-home-code-runtime-item">
            <div className="workspace-home-code-runtime-item-main">
              <strong>
                Intervention draft from {runtimeSourceDraft.title || runtimeSourceDraft.taskId}
              </strong>
              <span>Intent: {runtimeSourceDraft.intent.replaceAll("_", " ")}</span>
              {runtimeSourceDraft.sourceMappingKind ? (
                <span>Repo source mapping: {runtimeSourceDraft.sourceMappingKind}</span>
              ) : null}
              {runtimeSourceDraft.validationPresetId ? (
                <span>Validation preset: {runtimeSourceDraft.validationPresetId}</span>
              ) : null}
              {runtimeSourceDraft.accessMode ? (
                <span>Access mode: {runtimeSourceDraft.accessMode}</span>
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
            onClick={() => void startRuntimeManagedTask()}
            disabled={
              runtimeLoading ||
              runtimeDraftInstruction.trim().length === 0 ||
              selectedProviderRoute?.ready === false ||
              !launchReadiness.launchAllowed
            }
          >
            Start mission run
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
            <span>Launch execution profile: {launchExecutionProfileId}</span>
            <span>Launch access mode: {launchAccessMode ?? "runtime fallback"}</span>
            <span>Launch backend preference: {launchBackendPreferenceLabel}</span>
            <span>Launch review profile: {launchReviewProfileLabel}</span>
            <span>Launch validation preset: {launchValidationPresetLabel}</span>
          </div>
          <div className={controlStyles.sectionMeta}>
            {selectedProviderRoute?.detail ?? "Routing details unavailable."}
          </div>
        </div>
        {repositoryExecutionContract ? (
          <div className="workspace-home-code-runtime-item">
            <div className="workspace-home-code-runtime-item-main">
              <strong>{repositoryPolicyLabel}</strong>
              <span>
                {repositoryPolicyDescription ??
                  "Repository-scoped launch policy is merged into runtime preparation before the run starts."}
              </span>
              <span>
                Repo source mapping: {repositoryLaunchDefaults.sourceMappingKind ?? "defaults"}
              </span>
              <span>
                Repo profile default:{" "}
                {formatPolicyValue(
                  repositoryLaunchDefaults.executionProfileId,
                  "runtime/profile fallback"
                )}
              </span>
              <span>
                Repo access mode:{" "}
                {formatPolicyValue(
                  repositoryLaunchDefaults.accessMode,
                  "selected profile fallback"
                )}
              </span>
              <span>
                Repo backend preference:{" "}
                {formatPolicyList(
                  repositoryLaunchDefaults.preferredBackendIds,
                  "app/runtime fallback"
                )}
              </span>
              <span>Repo review profile: {repositoryReviewProfileLabel}</span>
              {repositoryLaunchDefaults.reviewProfile ? (
                <span>
                  Review posture: autofix {repositoryLaunchDefaults.reviewProfile.autofixPolicy} |
                  GitHub mirror {repositoryLaunchDefaults.reviewProfile.githubMirrorPolicy}
                </span>
              ) : null}
              <span>
                Repo validation preset:{" "}
                {formatPolicyValue(
                  repositoryLaunchDefaults.validationPresetLabel ??
                    repositoryLaunchDefaults.validationPresetId,
                  "selected profile fallback"
                )}
              </span>
              <span>
                Validation commands:{" "}
                {formatPolicyList(
                  repositoryLaunchDefaults.validationCommands,
                  "No repository validation commands declared."
                )}
              </span>
              {launcherOverridesRepositoryProfile ? (
                <span>
                  Launcher profile override: {runtimeDraftProfileId} replaces repo default{" "}
                  {repositoryLaunchDefaults.executionProfileId}.
                </span>
              ) : (
                <span>Launcher profile is aligned with repository policy defaults.</span>
              )}
            </div>
            {launcherOverridesRepositoryProfile ? (
              <div className={controlStyles.sectionMeta}>
                Repository policy still controls access mode, backend preference, review profile,
                and validation preset unless a source-linked relaunch draft overrides them.
              </div>
            ) : null}
          </div>
        ) : null}
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
        prepareRunLauncher={prepareRunLauncher}
        decideRuntimeApproval={decideRuntimeApproval}
      />
    </div>
  );
}
