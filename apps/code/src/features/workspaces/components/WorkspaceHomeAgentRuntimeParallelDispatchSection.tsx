import { ListRow } from "@ku0/ui";
import { StatusBadge } from "../../../design-system";
import type {
  RuntimeParallelDispatchPlan,
  RuntimeParallelDispatchWorkspaceSnapshot,
} from "../../../application/runtime/facades/runtimeParallelDispatchManager";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type WorkspaceHomeAgentRuntimeParallelDispatchSectionProps = {
  runtimeBatchPreview: RuntimeParallelDispatchPlan;
  runtimeBatchPreviewEdges: string[];
  parallelDispatch: RuntimeParallelDispatchWorkspaceSnapshot;
};

function formatParallelDispatchStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function resolveParallelDispatchTone(status: string) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed":
    case "blocked":
      return "error" as const;
    case "running":
    case "launching":
      return "progress" as const;
    case "skipped":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

export function WorkspaceHomeAgentRuntimeParallelDispatchSection({
  runtimeBatchPreview,
  runtimeBatchPreviewEdges,
  parallelDispatch,
}: WorkspaceHomeAgentRuntimeParallelDispatchSectionProps) {
  return (
    <div
      className="workspace-home-code-runtime-item"
      data-testid="workspace-runtime-parallel-dispatch"
    >
      <div className="workspace-home-code-runtime-item-main">
        <strong>Parallel dispatch</strong>
        <span>
          Enable this plan to split the current mission into runtime-launched child runs with
          explicit backend preferences and dependency gates.
        </span>
        <span>Dispatch enabled: {runtimeBatchPreview.enabled ? "yes" : "no"}</span>
        <span>Max parallel: {runtimeBatchPreview.maxParallel}</span>
        <span>Missions: {runtimeBatchPreview.tasks.length}</span>
        <span>Active sessions: {parallelDispatch.activeSessionCount}</span>
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
              <ListRow
                key={task.taskKey}
                title={task.title}
                description={[
                  task.preferredBackendIds?.length
                    ? `preferred backends: ${task.preferredBackendIds.join(", ")}`
                    : "preferred backends: runtime fallback",
                  `dependsOn: ${task.dependsOn.length > 0 ? task.dependsOn.join(", ") : "root"}`,
                  `retries: ${task.maxRetries}`,
                  `onFailure: ${task.onFailure}`,
                ].join(" | ")}
                trailing={
                  <StatusBadge tone={runtimeBatchPreview.enabled ? "progress" : "default"}>
                    {runtimeBatchPreview.enabled ? "Armed" : "Preview"}
                  </StatusBadge>
                }
              />
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
            Outcome labels: success = completed task; failed = retries exhausted; skipped = blocked
            by dependencies or failure policy; retried = task rerun up to maxRetries.
          </div>
          {parallelDispatch.sessions.map((session) => (
            <div key={session.sessionId} className={controlStyles.controlSection}>
              <ListRow
                title={session.objective}
                description={`state: ${session.state} | completed: ${session.counts.completed}/${session.counts.total} | max parallel: ${session.maxParallel}`}
                trailing={
                  <StatusBadge tone={resolveParallelDispatchTone(session.state)}>
                    {formatParallelDispatchStatus(session.state)}
                  </StatusBadge>
                }
              />
              {session.tasks.map((task) => (
                <ListRow
                  key={`${session.sessionId}-${task.taskKey}`}
                  title={task.title}
                  description={[
                    task.resolvedBackendId ??
                      (task.preferredBackendIds?.length
                        ? task.preferredBackendIds.join(", ")
                        : "runtime fallback"),
                    task.dependsOn.length > 0
                      ? `depends on ${task.dependsOn.join(", ")}`
                      : "root chunk",
                    `attempt ${task.attemptCount}`,
                  ].join(" | ")}
                  trailing={
                    <StatusBadge tone={resolveParallelDispatchTone(task.status)}>
                      {formatParallelDispatchStatus(task.status)}
                    </StatusBadge>
                  }
                />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
