import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { resolveHugeCodeOperatorAction } from "@ku0/code-runtime-host-contract/hugeCodeOperatorLoop";
import { Card, ShellFrame, ShellToolbar, StatusBadge, Text } from "../../../../design-system";
import {
  MissionOverviewPanel,
  type MissionOverviewItem,
} from "../../../missions/components/MissionOverviewPanel";
import {
  buildMissionOverviewCountsFromProjection,
  buildMissionOverviewItemsFromProjection,
  buildMissionReviewEntriesFromProjection,
  type MissionReviewEntry,
} from "../../../missions/utils/missionControlPresentation";
import {
  buildReviewPackDetailModel,
  resolveReviewPackSelection,
  type ReviewPackDetailModel,
} from "../../utils/reviewPackSurfaceModel";
import { ReviewQueuePanel } from "../ReviewQueuePanel";
import {
  InspectorSection,
  InspectorSectionBody,
  InspectorSectionHeader,
  RightPanelBody,
  RightPanelHeader,
  RightPanelShell,
} from "../../../right-panel/RightPanelPrimitives";
import { ReviewEvidenceList, ReviewLoopSection } from "./ReviewLoopAdapters";
import * as styles from "./ReviewLoopClosureFixture.css";

const WORKSPACE_ID = "workspace-1";

function createProjection(): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 1_710_000_000_000,
    workspaces: [
      {
        id: WORKSPACE_ID,
        name: "Workspace One",
        rootPath: "/tmp/workspace-one",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: [
      {
        id: "task-resume",
        workspaceId: WORKSPACE_ID,
        title: "Interrupted run resume",
        objective: "Recover the interrupted run from takeover truth.",
        origin: {
          kind: "run",
          runId: "run-resume",
          threadId: null,
          requestId: null,
        },
        taskSource: null,
        mode: "delegate",
        modeSource: "execution_profile",
        status: "paused",
        createdAt: 1,
        updatedAt: 8,
        currentRunId: "run-resume",
        latestRunId: "run-resume",
        latestRunState: "paused",
      },
      {
        id: "task-review",
        workspaceId: WORKSPACE_ID,
        title: "Review-ready takeover",
        objective: "Open the canonical review surface.",
        origin: {
          kind: "thread",
          threadId: "thread-review",
          runId: "run-review",
          requestId: null,
        },
        taskSource: null,
        mode: "pair",
        modeSource: "execution_profile",
        status: "review_ready",
        createdAt: 2,
        updatedAt: 9,
        currentRunId: null,
        latestRunId: "run-review",
        latestRunState: "review_ready",
      },
      {
        id: "task-blocked",
        workspaceId: WORKSPACE_ID,
        title: "Blocked follow-up recovery",
        objective: "Repair validation evidence before follow-up continues.",
        origin: {
          kind: "thread",
          threadId: "thread-blocked",
          runId: "run-blocked",
          requestId: null,
        },
        taskSource: null,
        mode: "pair",
        modeSource: "execution_profile",
        status: "review_ready",
        createdAt: 3,
        updatedAt: 10,
        currentRunId: null,
        latestRunId: "run-blocked",
        latestRunState: "review_ready",
      },
      {
        id: "task-handoff",
        workspaceId: WORKSPACE_ID,
        title: "Cross-device takeover",
        objective: "Continue from the published handoff target.",
        origin: {
          kind: "thread",
          threadId: "thread-handoff",
          runId: "run-handoff",
          requestId: null,
        },
        taskSource: null,
        mode: "delegate",
        modeSource: "execution_profile",
        status: "ready",
        createdAt: 4,
        updatedAt: 11,
        currentRunId: null,
        latestRunId: "run-handoff",
        latestRunState: "paused",
      },
    ],
    runs: [
      {
        id: "run-resume",
        taskId: "task-resume",
        workspaceId: WORKSPACE_ID,
        state: "paused",
        title: "Interrupted run resume",
        summary: "Runtime takeover bundle published a resumable checkpoint.",
        startedAt: 1,
        finishedAt: null,
        updatedAt: 8,
        currentStepIndex: 1,
        warnings: [],
        validations: [],
        artifacts: [],
        checkpoint: {
          state: "persisted",
          lifecycleState: "persisted",
          checkpointId: "checkpoint-resume",
          traceId: "trace-resume",
          recovered: true,
          updatedAt: 8,
          resumeReady: true,
          summary: "Resume from checkpoint-resume.",
        },
        takeoverBundle: {
          state: "ready",
          pathKind: "resume",
          primaryAction: "resume",
          summary: "Resume the interrupted run from takeover truth.",
          recommendedAction: "Resume this run from the runtime takeover bundle.",
          checkpointId: "checkpoint-resume",
          traceId: "trace-resume",
          target: {
            kind: "run",
            workspaceId: WORKSPACE_ID,
            taskId: "task-resume",
            runId: "run-resume",
            checkpointId: "checkpoint-resume",
            traceId: "trace-resume",
          },
        },
      },
      {
        id: "run-review",
        taskId: "task-review",
        workspaceId: WORKSPACE_ID,
        state: "review_ready",
        title: "Review-ready takeover",
        summary: "Review Pack is ready from takeover truth.",
        startedAt: 2,
        finishedAt: 7,
        updatedAt: 9,
        currentStepIndex: 2,
        warnings: [],
        validations: [],
        artifacts: [],
        reviewPackId: "review-pack:review",
        missionLinkage: {
          workspaceId: WORKSPACE_ID,
          taskId: "task-review",
          runId: "run-review",
          reviewPackId: "review-pack:review",
          checkpointId: null,
          traceId: "trace-review",
          threadId: "thread-review",
          requestId: null,
          missionTaskId: "task-review",
          taskEntityKind: "run",
          recoveryPath: "run",
          navigationTarget: {
            kind: "run",
            workspaceId: WORKSPACE_ID,
            taskId: "task-review",
            runId: "run-review",
            reviewPackId: "review-pack:review",
          },
          summary: "Open the published Review Pack.",
        },
        takeoverBundle: {
          state: "ready",
          pathKind: "review",
          primaryAction: "open_review_pack",
          summary: "Continue from Review Pack.",
          recommendedAction: "Open Review Pack",
          reviewPackId: "review-pack:review",
          traceId: "trace-review",
          target: {
            kind: "review_pack",
            workspaceId: WORKSPACE_ID,
            taskId: "task-review",
            runId: "run-review",
            reviewPackId: "review-pack:review",
          },
        },
      },
      {
        id: "run-blocked",
        taskId: "task-blocked",
        workspaceId: WORKSPACE_ID,
        state: "review_ready",
        title: "Blocked follow-up recovery",
        summary: "Review Pack is ready, but runtime blocked follow-up.",
        startedAt: 3,
        finishedAt: 8,
        updatedAt: 10,
        currentStepIndex: 3,
        warnings: [],
        validations: [],
        artifacts: [],
        reviewPackId: "review-pack:blocked",
        missionLinkage: {
          workspaceId: WORKSPACE_ID,
          taskId: "task-blocked",
          runId: "run-blocked",
          reviewPackId: "review-pack:blocked",
          checkpointId: null,
          traceId: "trace-blocked",
          threadId: "thread-blocked",
          requestId: null,
          missionTaskId: "task-blocked",
          taskEntityKind: "run",
          recoveryPath: "run",
          navigationTarget: {
            kind: "run",
            workspaceId: WORKSPACE_ID,
            taskId: "task-blocked",
            runId: "run-blocked",
            reviewPackId: "review-pack:blocked",
          },
          summary: "Resolve the blocked follow-up from mission detail.",
        },
        actionability: {
          state: "blocked",
          summary: "Runtime blocked follow-up until validation evidence is repaired.",
          degradedReasons: ["validation_outcome_unknown"],
          actions: [
            {
              action: "retry",
              enabled: true,
              supported: true,
              reason: null,
            },
          ],
        },
      },
      {
        id: "run-handoff",
        taskId: "task-handoff",
        workspaceId: WORKSPACE_ID,
        state: "paused",
        title: "Cross-device takeover",
        summary: "Publish handoff is ready for another operator.",
        startedAt: 4,
        finishedAt: 11,
        updatedAt: 11,
        currentStepIndex: 4,
        warnings: [],
        validations: [],
        artifacts: [],
        missionLinkage: {
          workspaceId: WORKSPACE_ID,
          taskId: "task-handoff",
          runId: "run-handoff",
          reviewPackId: null,
          checkpointId: null,
          traceId: "trace-handoff",
          threadId: "thread-handoff",
          requestId: null,
          missionTaskId: "task-handoff",
          taskEntityKind: "thread",
          recoveryPath: "thread",
          navigationTarget: {
            kind: "thread",
            workspaceId: WORKSPACE_ID,
            threadId: "thread-handoff",
          },
          summary: "Open thread-handoff on the receiving device.",
        },
        publishHandoff: {
          jsonPath: ".hugecode/runs/task-handoff/publish/handoff.json",
          markdownPath: ".hugecode/runs/task-handoff/publish/handoff.md",
          summary: "Publish handoff is ready.",
        },
        takeoverBundle: {
          state: "ready",
          pathKind: "handoff",
          primaryAction: "open_handoff",
          summary: "Take over the mission thread on another control device.",
          recommendedAction: "Use the runtime-published handoff target.",
          traceId: "trace-handoff",
          target: {
            kind: "thread",
            workspaceId: WORKSPACE_ID,
            threadId: "thread-handoff",
          },
        },
      },
    ],
    reviewPacks: [
      {
        id: "review-pack:review",
        runId: "run-review",
        taskId: "task-review",
        workspaceId: WORKSPACE_ID,
        summary: "Review Pack is ready from takeover truth.",
        reviewStatus: "ready",
        evidenceState: "confirmed",
        validationOutcome: "passed",
        warningCount: 0,
        warnings: [],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: "Legacy review fallback should not win.",
        createdAt: 9,
      },
      {
        id: "review-pack:blocked",
        runId: "run-blocked",
        taskId: "task-blocked",
        workspaceId: WORKSPACE_ID,
        summary: "Review Pack is ready, but follow-up is blocked.",
        reviewStatus: "ready",
        evidenceState: "confirmed",
        validationOutcome: "warning",
        warningCount: 1,
        warnings: ["Validation evidence is missing."],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: "Legacy blocked fallback should not win.",
        createdAt: 10,
      },
    ],
  };
}

function requireReviewDetail(
  projection: HugeCodeMissionControlSnapshot,
  reviewPackId: string
): ReviewPackDetailModel {
  const detail = buildReviewPackDetailModel({
    projection,
    selection: resolveReviewPackSelection({
      projection,
      workspaceId: WORKSPACE_ID,
      request: {
        workspaceId: WORKSPACE_ID,
        reviewPackId,
        source: "review_surface",
      },
    }),
  });

  if (!detail || detail.kind !== "review_pack") {
    throw new Error(`Expected review pack detail for ${reviewPackId}`);
  }

  return detail;
}

function requireReviewEntry(
  entries: MissionReviewEntry[],
  reviewPackId: string
): MissionReviewEntry {
  const entry = entries.find((candidate) => candidate.reviewPackId === reviewPackId);
  if (!entry) {
    throw new Error(`Expected review entry for ${reviewPackId}`);
  }
  return entry;
}

function formatTarget(target: unknown): string {
  if (!target || typeof target !== "object") {
    return "No target";
  }

  const candidate = target as {
    kind?: string;
    threadId?: string;
    runId?: string;
    reviewPackId?: string;
  };

  if (candidate.kind === "thread" && candidate.threadId) {
    return `thread:${candidate.threadId}`;
  }
  if (candidate.kind === "review_pack" && candidate.reviewPackId) {
    return `review:${candidate.reviewPackId}`;
  }
  if ((candidate.kind === "review" || candidate.kind === "mission") && candidate.reviewPackId) {
    return `review:${candidate.reviewPackId}`;
  }
  if (candidate.kind === "run" && candidate.runId) {
    return `run:${candidate.runId}`;
  }
  if ((candidate.kind === "review" || candidate.kind === "mission") && candidate.runId) {
    return `run:${candidate.runId}`;
  }

  return candidate.kind ?? "Unknown target";
}

const projection = createProjection();
const missionItems = buildMissionOverviewItemsFromProjection(projection, {
  workspaceId: WORKSPACE_ID,
  activeThreadId: "thread-review",
}) as MissionOverviewItem[];
const missionCounts = buildMissionOverviewCountsFromProjection(projection, WORKSPACE_ID);
const reviewEntries = buildMissionReviewEntriesFromProjection(projection, {
  workspaceId: WORKSPACE_ID,
}) as MissionReviewEntry[];
const blockedEntry = requireReviewEntry(reviewEntries, "review-pack:blocked");
const reviewEntry = requireReviewEntry(reviewEntries, "review-pack:review");

const blockedDetail = requireReviewDetail(projection, "review-pack:blocked");
const reviewDetail = requireReviewDetail(projection, "review-pack:review");
const resumeRun = projection.runs.find((run) => run.id === "run-resume");
const handoffRun = projection.runs.find((run) => run.id === "run-handoff");

if (!resumeRun || !handoffRun) {
  throw new Error("Expected resume and handoff runs for operator-loop fixture.");
}

const resumeAction = resolveHugeCodeOperatorAction({
  runState: resumeRun.state,
  checkpoint: resumeRun.checkpoint ?? null,
  takeoverBundle: resumeRun.takeoverBundle ?? null,
  missionLinkage: resumeRun.missionLinkage ?? null,
  publishHandoff: resumeRun.publishHandoff ?? null,
});
const handoffAction = resolveHugeCodeOperatorAction({
  runState: handoffRun.state,
  takeoverBundle: handoffRun.takeoverBundle ?? null,
  missionLinkage: handoffRun.missionLinkage ?? null,
  publishHandoff: handoffRun.publishHandoff ?? null,
});

const operatorLoopRows = [
  {
    id: "resume",
    title: "Interrupted run resume",
    stateTone: "progress" as const,
    labels: [
      `Continuation facade: ${resumeAction.label}`,
      `Recommended step: ${resumeAction.recommendedAction}`,
      `Target: ${formatTarget(resumeAction.target)}`,
    ],
    truthSource: resumeAction.truthSource,
  },
  {
    id: "takeover",
    title: "Cross-device takeover",
    stateTone: "success" as const,
    labels: [
      `Continuation facade: ${handoffAction.label}`,
      `Recommended step: ${handoffAction.recommendedAction}`,
      `Target: ${formatTarget(handoffAction.target)}`,
    ],
    truthSource: handoffAction.truthSource,
  },
  {
    id: "review",
    title: "Review-ready takeover",
    stateTone: "success" as const,
    labels: [
      `Mission Control next step: ${reviewEntry.recommendedNextAction}`,
      `Review Pack next step: ${reviewDetail.recommendedNextAction}`,
      `Target: ${formatTarget(reviewEntry.operatorActionTarget)}`,
    ],
    truthSource: reviewDetail.continuity?.truthSourceLabel ?? "Runtime takeover bundle",
  },
  {
    id: "follow-up",
    title: "Blocked follow-up recovery",
    stateTone: "warning" as const,
    labels: [
      `Mission Control next step: ${blockedEntry.recommendedNextAction}`,
      `Review Pack next step: ${blockedDetail.recommendedNextAction}`,
      `Target: ${formatTarget(blockedEntry.operatorActionTarget)}`,
    ],
    truthSource: blockedDetail.continuity?.truthSourceLabel ?? "Runtime review actionability",
  },
];

export function ReviewLoopClosureFixture() {
  return (
    <main className={styles.page} data-visual-fixture="review-loop-closure">
      <div className={styles.stack}>
        <ShellFrame tone="elevated" padding="lg">
          <ShellToolbar
            leading={<Text tone="muted">Review Loop Closure</Text>}
            trailing={<StatusBadge tone="progress">Canonical operator loop</StatusBadge>}
          >
            <Text weight="semibold">
              Mission Control, Review Pack, and continuation facade share one operator truth.
            </Text>
          </ShellToolbar>
        </ShellFrame>

        <div className={styles.split}>
          <div className={styles.cluster}>
            <MissionOverviewPanel
              workspaceName="Mission triage"
              counts={missionCounts}
              items={missionItems}
              onSelectMission={() => undefined}
              onOpenMissionTarget={() => undefined}
            />

            <ReviewQueuePanel
              workspaceName="Workspace One"
              items={reviewEntries}
              selectedReviewPackId="review-pack:blocked"
            />
          </div>

          <div className={styles.rail}>
            <ReviewLoopSection
              title="Shared operator loop"
              description="Resume, takeover, review, and blocked follow-up all resolve through the same shared facade."
              actions={<StatusBadge tone="progress">Canonical truth</StatusBadge>}
            >
              <div className={styles.parityGrid}>
                {operatorLoopRows.map((row) => (
                  <Card
                    key={row.id}
                    className={styles.parityCard}
                    data-testid={`operator-loop-row-${row.id}`}
                    padding="lg"
                    variant="subtle"
                  >
                    <div className={styles.parityHeader}>
                      <Text weight="semibold">{row.title}</Text>
                      <StatusBadge tone={row.stateTone}>Aligned</StatusBadge>
                    </div>
                    <div className={styles.parityDetails}>
                      {row.labels.map((label) => (
                        <Text key={`${row.id}-${label}`} tone="muted">
                          {label}
                        </Text>
                      ))}
                      <Text tone="muted">Truth source: {row.truthSource}</Text>
                    </div>
                  </Card>
                ))}
              </div>
            </ReviewLoopSection>

            <ReviewLoopSection
              title="Blocked review detail"
              description="The blocked review path points Mission Control and Review Pack at the same next action and target."
              actions={<StatusBadge tone="warning">Follow-up blocked</StatusBadge>}
            >
              <ReviewEvidenceList
                items={[
                  {
                    id: "blocked-mission",
                    label: "Mission Control",
                    detail: blockedEntry.recommendedNextAction ?? "No next step",
                  },
                  {
                    id: "blocked-review",
                    label: "Review Pack",
                    detail: blockedDetail.recommendedNextAction ?? "No next step",
                  },
                  {
                    id: "blocked-continuity",
                    label: "Continuation facade",
                    detail:
                      blockedDetail.continuity?.recommendedAction ?? "No continuity recommendation",
                  },
                  {
                    id: "blocked-target",
                    label: "Navigation target",
                    detail: formatTarget(blockedDetail.navigationTarget),
                  },
                ]}
              />
            </ReviewLoopSection>

            <ReviewLoopSection
              title="Takeover review detail"
              description="Takeover-ready review runs now treat takeoverBundle as the primary source for next-step guidance."
              actions={<StatusBadge tone="success">Review open</StatusBadge>}
            >
              <ReviewEvidenceList
                items={[
                  {
                    id: "review-mission",
                    label: "Mission Control",
                    detail: reviewEntry.recommendedNextAction ?? "No next step",
                  },
                  {
                    id: "review-pack",
                    label: "Review Pack",
                    detail: reviewDetail.recommendedNextAction ?? "No next step",
                  },
                  {
                    id: "review-continuity",
                    label: "Continuation facade",
                    detail:
                      reviewDetail.continuity?.recommendedAction ?? "No continuity recommendation",
                  },
                  {
                    id: "review-target",
                    label: "Navigation target",
                    detail: formatTarget(reviewDetail.navigationTarget),
                  },
                ]}
              />
            </ReviewLoopSection>

            <RightPanelShell>
              <RightPanelHeader
                eyebrow="Migration notes"
                title="Page fallbacks reduced"
                subtitle="One controlled fallback remains only for legacy follow-up action arrays when reviewActionability actions are absent."
              />
              <RightPanelBody>
                <InspectorSection>
                  <InspectorSectionHeader
                    title="Fallback boundary"
                    subtitle="Mission Control, Review Pack, and shared workspace summaries all read the same takeover-first continuation truth."
                    actions={<StatusBadge tone="progress">Shared facade</StatusBadge>}
                  />
                  <InspectorSectionBody>
                    <ReviewEvidenceList
                      items={[
                        {
                          id: "bundle-priority",
                          label: "takeoverBundle",
                          detail: "Primary source for continuation and takeover routing.",
                        },
                        {
                          id: "review-actionability",
                          label: "reviewActionability",
                          detail: "Canonical next-step summary when takeoverBundle is absent.",
                        },
                        {
                          id: "legacy-fallback",
                          label: "Legacy fallback",
                          detail:
                            "Only used for follow-up action availability when runtime omits action entries.",
                        },
                      ]}
                    />
                  </InspectorSectionBody>
                </InspectorSection>
              </RightPanelBody>
            </RightPanelShell>
          </div>
        </div>
      </div>
    </main>
  );
}
