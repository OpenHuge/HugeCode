import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../../application/runtime/types/webMcpBridge";
import { Button, ShellFrame, ShellToolbar, StatusBadge, Text } from "../../../../design-system";
import {
  MissionOverviewPanel,
  type MissionOverviewItem,
} from "../../../missions/components/MissionOverviewPanel";
import type { MissionReviewEntry } from "../../../missions/utils/missionControlPresentation";
import {
  InspectorSection,
  InspectorSectionBody,
  InspectorSectionHeader,
  RightPanelBody,
  RightPanelHeader,
  RightPanelShell,
} from "../../../right-panel/RightPanelPrimitives";
import { ReviewQueuePanel } from "../ReviewQueuePanel";
import { WorkspaceHomeAgentRuntimeRunItem } from "../../../workspaces/components/WorkspaceHomeAgentRuntimeRunItem";
import { ReviewActionRail, ReviewEvidenceList, ReviewLoopSection } from "./ReviewLoopAdapters";
import * as styles from "./ReviewLoopClosureFixture.css";

const missionItems: MissionOverviewItem[] = [
  {
    threadId: "runtime-task:review-1",
    title: "Review runtime routing fallback",
    summary: "Fallback route was used and operator review is required before publish.",
    operatorSignal: "Fallback route needs operator sign-off",
    attentionSignals: ["Fallback route", "Evidence incomplete"],
    updatedAt: Date.now() - 90_000,
    state: "needsAction",
    isActive: true,
    navigationTarget: {
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "runtime-task:review-1",
      runId: "run-review-1",
      reviewPackId: "review-pack:review-1",
      threadId: null,
      limitation: "thread_unavailable",
    },
    secondaryLabel: "Runtime-managed mission",
  },
  {
    threadId: "thread-review-2",
    title: "Approve review-ready refactor",
    summary: "Validation passed and the runtime published a review pack.",
    operatorSignal: "Review-ready evidence published",
    attentionSignals: ["Review ready"],
    updatedAt: Date.now() - 180_000,
    state: "reviewReady",
    isActive: false,
    navigationTarget: {
      kind: "thread",
      workspaceId: "workspace-1",
      threadId: "thread-review-2",
    },
    secondaryLabel: null,
  },
];

const reviewQueueItems: MissionReviewEntry[] = [
  {
    id: "review-pack:review-1",
    kind: "review_pack" as const,
    taskId: "runtime-task:review-1",
    runId: "run-review-1",
    reviewPackId: "review-pack:review-1",
    workspaceId: "workspace-1",
    title: "Fallback routing review",
    summary: "Runtime attached degraded continuity and incomplete evidence.",
    createdAt: Date.now() - 60_000,
    state: "needsAction" as const,
    validationOutcome: "warning" as const,
    warningCount: 2,
    recommendedNextAction: "Inspect continuity, review evidence, then choose relaunch or accept.",
    accountabilityLifecycle: "in_review" as const,
    queueEnteredAt: Date.now() - 55_000,
    filterTags: ["needs_attention", "fallback_routing", "sub_agent_blocked"],
    navigationTarget: {
      kind: "mission" as const,
      workspaceId: "workspace-1",
      taskId: "runtime-task:review-1",
      runId: "run-review-1",
      reviewPackId: "review-pack:review-1",
      threadId: null,
      limitation: "thread_unavailable" as const,
    },
    secondaryLabel: "Runtime-managed mission",
    evidenceLabel: "Evidence incomplete",
    operatorSignal: "Approval pending before review can continue",
    attentionSignals: ["Approval pending", "Fallback route"],
    failureClassLabel: "Runtime failure",
    subAgentSignal: "Sub-agent blocked",
    publishHandoffLabel: "Publish handoff ready",
    relaunchLabel: "Relaunch available",
    continuationState: "blocked" as const,
    continuationLabel: "Blocked continuity",
    reviewGateLabel: "Review gate blocked",
    reviewGateState: "blocked" as const,
    autofixAvailable: true,
    operatorActionLabel: "Open action center",
    operatorActionTarget: {
      kind: "mission" as const,
      workspaceId: "workspace-1",
      taskId: "runtime-task:review-1",
      runId: "run-review-1",
      reviewPackId: "review-pack:review-1",
      threadId: null,
      limitation: "thread_unavailable" as const,
    },
  },
];

const runtimeTask: RuntimeAgentTaskSummary = {
  taskId: "runtime-task-1",
  workspaceId: "workspace-1",
  threadId: null,
  title: "Blocking sub-agent observability",
  status: "awaiting_approval",
  accessMode: "on-request",
  distributedStatus: null,
  currentStep: 2,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_050_000,
  startedAt: 1_700_000_000_000,
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  pendingApprovalId: "approval-review-1",
};

const runtimeRun = {
  id: "runtime-task-1",
  taskId: "runtime-task-1",
  workspaceId: "workspace-1",
  state: "awaiting_approval",
  title: "Blocking sub-agent observability",
  summary: "Runtime is coordinating delegated work.",
  startedAt: 1_700_000_000_000,
  finishedAt: null,
  updatedAt: 1_700_000_050_000,
  currentStepIndex: 1,
  warnings: [],
  validations: [],
  artifacts: [],
  changedPaths: [],
  subAgents: [
    {
      sessionId: "session-review",
      status: "awaiting_approval",
      summary: "Reviewer session is paused for approval.",
      approvalState: {
        status: "pending",
        approvalId: "approval-review-1",
        reason: "Approve reviewer escalation to continue.",
        at: 1_700_000_100_000,
      },
      checkpointState: {
        summary: "Resume ready from checkpoint-runtime-1",
        checkpointId: "checkpoint-runtime-1",
        resumeReady: true,
      },
    },
  ],
  operatorSnapshot: {
    summary: "One delegated reviewer is blocked on approval.",
    currentActivity: "Collecting follow-up evidence for runtime fallback.",
    blocker: "Approval is required before the delegated reviewer can continue.",
    recentEvents: [
      {
        kind: "approval_requested",
        label: "Approval requested",
        detail: "Reviewer escalation is waiting for operator confirmation.",
        at: 1_700_000_090_000,
      },
    ],
  },
  approval: {
    state: "pending_decision",
    label: "Approval required",
    summary: "Runtime is waiting for approval before continuing.",
    blocking: true,
  },
  nextAction: {
    label: "Approve delegated review",
    detail: "A delegated reviewer is waiting for approval before continuing.",
  },
  governance: {
    label: "Blocking",
    blocking: true,
    summary: "Operator approval is required before the review can continue.",
  },
  placement: {
    summary: "Runtime confirmed fallback routing on backend-review-a.",
  },
  executionGraph: {
    graphId: "graph-runtime-task-1",
    nodes: [
      {
        id: "node-review",
        kind: "review",
        status: "awaiting_approval",
        executorKind: "sub_agent",
        executorSessionId: "session-review",
        resolvedBackendId: "backend-review-a",
        placementLifecycleState: "confirmed",
        placementResolutionSource: "workspace_default",
      },
    ],
    edges: [],
  },
} as unknown as HugeCodeRunSummary;

export function ReviewLoopClosureFixture() {
  return (
    <main className={styles.page} data-visual-fixture="review-loop-closure">
      <div className={styles.stack}>
        <ShellFrame tone="elevated" padding="lg">
          <ShellToolbar
            leading={<Text tone="muted">Review Loop Closure</Text>}
            trailing={<StatusBadge tone="progress">Observe - Review - Decide</StatusBadge>}
          >
            <Text weight="semibold">Unified detail grammar for triage, runtime, and review</Text>
          </ShellToolbar>
        </ShellFrame>

        <div className={styles.split}>
          <div className={styles.cluster}>
            <MissionOverviewPanel
              workspaceName="Mission triage"
              counts={{ active: 1, needsAction: 1, reviewReady: 1, ready: 2 }}
              items={missionItems}
              onSelectMission={() => undefined}
            />

            <ReviewQueuePanel
              workspaceName="Workspace One"
              items={reviewQueueItems}
              selectedReviewPackId="review-pack:review-1"
            />

            <WorkspaceHomeAgentRuntimeRunItem
              task={runtimeTask}
              run={runtimeRun}
              continuityItem={{
                runId: "runtime-task-1",
                taskId: "runtime-task-1",
                state: "attention",
                pathKind: "resume",
                detail: "Runtime published a continuity resume path.",
                recommendedAction: "Resume from the runtime-published checkpoint.",
                truthSource: "checkpoint",
                truthSourceLabel: "Runtime checkpoint",
              }}
              runtimeLoading={false}
              onRefresh={() => undefined}
              onInterrupt={() => undefined}
              onResume={() => undefined}
              onPrepareLauncher={() => undefined}
              onApproval={() => undefined}
            />
          </div>

          <div className={styles.rail}>
            <ReviewLoopSection
              title="Review decision rail"
              description="Normal review-ready, fallback routing, degraded continuity, and relaunch/autofix states stay visible in one operator surface."
              actions={<StatusBadge tone="warning">Fallback routing</StatusBadge>}
            >
              <ReviewActionRail>
                <Button type="button" size="sm">
                  Accept result
                </Button>
                <Button type="button" size="sm" variant="secondary">
                  Reject result
                </Button>
                <Button type="button" size="sm" variant="ghost">
                  Prepare retry draft
                </Button>
              </ReviewActionRail>
              <ReviewEvidenceList
                items={[
                  {
                    id: "evidence",
                    label: "Evidence",
                    detail: "Incomplete evidence published from runtime snapshot",
                  },
                  {
                    id: "autofix",
                    label: "Autofix",
                    detail: "Bounded autofix available for the published findings",
                  },
                  {
                    id: "relaunch",
                    label: "Relaunch",
                    detail: "Profile-preserving retry path is available from Review Pack",
                  },
                ]}
              />
            </ReviewLoopSection>

            <ReviewLoopSection
              title="Runtime continuity and handoff"
              description="Checkpoint, trace, placement, and publish-handoff facts stay grouped as operator handoff material."
              actions={<StatusBadge tone="success">Resume ready</StatusBadge>}
            >
              <ReviewEvidenceList
                items={[
                  { id: "checkpoint", label: "Checkpoint", detail: "checkpoint-runtime-1" },
                  { id: "trace", label: "Trace", detail: "trace-runtime-1" },
                  { id: "publish", label: "Publish handoff", detail: "Draft PR body is ready" },
                ]}
              />
            </ReviewLoopSection>

            <RightPanelShell>
              <RightPanelHeader
                eyebrow="Inspector compatibility"
                title="Blocking runtime detail"
                subtitle="Right-panel surfaces reuse the same review-loop section grammar."
              />
              <RightPanelBody>
                <InspectorSection>
                  <InspectorSectionHeader
                    title="Selection continuity"
                    subtitle="Sticky detail shell keeps focus and context visible."
                    actions={<StatusBadge tone="progress">Active</StatusBadge>}
                  />
                  <InspectorSectionBody>
                    <ReviewEvidenceList
                      items={[
                        {
                          id: "selection",
                          label: "Selected review pack",
                          detail: "review-pack:review-1",
                        },
                        {
                          id: "next",
                          label: "Next action",
                          detail: "Approve delegated review or relaunch with findings",
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
