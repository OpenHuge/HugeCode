import { useCallback, useDeferredValue, useState, useTransition } from "react";
import type { GitHubIssue } from "../../../types";
import type { GovernedGitHubFollowUpPreview } from "../../../application/runtime/facades/githubSourceLaunchPreview";
import type { RepositoryExecutionContract } from "../../../application/runtime/facades/runtimeRepositoryExecutionContract";
import { MissionControlSectionCard } from "./WorkspaceHomeMissionControlSections";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";

type AutonomousIssueDriveResult = {
  issue: Pick<GitHubIssue, "number" | "title" | "url" | "updatedAt">;
  preview: GovernedGitHubFollowUpPreview;
};

type WorkspaceHomeAutonomousIssueDriveProps = {
  workspaceId?: string;
  launchAllowed: boolean;
  runtimeLoading: boolean;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  preferredBackendIds?: string[] | null;
  refreshRuntimeTasks?: (() => Promise<void>) | null;
  driveIssue?: ((issueUri: string) => Promise<AutonomousIssueDriveResult>) | null;
};

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function WorkspaceHomeAutonomousIssueDrive({
  workspaceId,
  launchAllowed,
  runtimeLoading,
  repositoryExecutionContract = null,
  preferredBackendIds = null,
  refreshRuntimeTasks = null,
  driveIssue,
}: WorkspaceHomeAutonomousIssueDriveProps) {
  const [issueUri, setIssueUri] = useState("");
  const [result, setResult] = useState<AutonomousIssueDriveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredResult = useDeferredValue(result);
  const deferredIssueUri = useDeferredValue(issueUri);
  const trimmedIssueUri = issueUri.trim();

  const runAutonomousIssueDrive = useCallback(
    async (nextIssueUri: string) => {
      if (driveIssue) {
        return driveIssue(nextIssueUri);
      }
      if (!workspaceId) {
        throw new Error("Mission Control needs an active workspace before starting issue drive.");
      }
      const [{ launchGovernedGitHubRun }, { resolveGitHubIssueUriTaskIntent }] = await Promise.all([
        import("../../../application/runtime/facades/githubSourceGovernedLaunch"),
        import("../../../application/runtime/facades/githubIssueUriTaskIntent"),
      ]);
      const intent = await resolveGitHubIssueUriTaskIntent({
        workspaceId,
        issueUri: nextIssueUri,
        repositoryExecutionContract,
        preferredBackendIds,
      });
      await launchGovernedGitHubRun({
        launch: intent.launch,
        request: intent.request,
        onRefresh: refreshRuntimeTasks,
      });
      return {
        issue: intent.issue,
        preview: intent.preview,
      };
    },
    [driveIssue, preferredBackendIds, refreshRuntimeTasks, repositoryExecutionContract, workspaceId]
  );

  async function handleDriveIssue() {
    if (!trimmedIssueUri) {
      return;
    }
    setError(null);
    try {
      const nextResult = await runAutonomousIssueDrive(trimmedIssueUri);
      startTransition(() => {
        setResult(nextResult);
      });
    } catch (nextError) {
      startTransition(() => {
        setResult(null);
        setError(readErrorMessage(nextError));
      });
    }
  }

  return (
    <MissionControlSectionCard
      title="Autonomous Issue Drive"
      statusLabel={isPending ? "Preparing" : deferredResult ? "Ready" : "Idle"}
      statusTone={isPending ? "running" : deferredResult ? "success" : "neutral"}
    >
      <div className={controlStyles.sectionMeta}>
        Ingest a GitHub issue URI, synthesize the governed runtime task locally, and hand the run to
        the operator path without leaving Mission Control.
      </div>
      <label className={controlStyles.field}>
        <span>GitHub issue URI</span>
        <input
          className={controlStyles.fieldControl}
          type="url"
          value={issueUri}
          onChange={(event) => setIssueUri(event.target.value)}
          placeholder="https://github.com/acme/hugecode/issues/42"
        />
      </label>
      <div className={controlStyles.actions}>
        <button
          className={controlStyles.actionButton}
          type="button"
          onClick={() => void handleDriveIssue()}
          disabled={runtimeLoading || isPending || !launchAllowed || trimmedIssueUri.length === 0}
        >
          {isPending ? "Driving issue..." : "Drive issue"}
        </button>
      </div>
      {!launchAllowed ? (
        <div className={controlStyles.warning}>
          Launch readiness is currently blocking new governed runtime runs.
        </div>
      ) : null}
      {error ? <div className={controlStyles.error}>{error}</div> : null}
      {deferredIssueUri && trimmedIssueUri !== deferredIssueUri.trim() ? (
        <div className={controlStyles.sectionMeta}>Syncing URI preview…</div>
      ) : null}
      {deferredResult ? (
        <div className="workspace-home-code-runtime-item">
          <div className="workspace-home-code-runtime-item-main">
            <strong>{deferredResult.preview.title}</strong>
            <span>{deferredResult.preview.summary}</span>
            <span>
              Issue #{deferredResult.issue.number}: {deferredResult.issue.title}
            </span>
            {deferredResult.preview.fields.map((field) => (
              <span key={field.id}>
                {field.label}: {field.value}
                {field.detail ? ` · ${field.detail}` : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </MissionControlSectionCard>
  );
}
