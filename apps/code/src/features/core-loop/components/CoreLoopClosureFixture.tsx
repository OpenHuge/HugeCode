import type { ConversationItem } from "../../../types";
import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import {
  CoreLoopStatePanel,
  ShellFrame,
  ShellSection,
  ShellToolbar,
  SplitPanel,
  Text,
  WorkspaceSupportMeta,
} from "../../../design-system";
import { Messages } from "../../messages/components/Messages";
import { ComposerMetaBar } from "../../composer/components/ComposerMetaBar";
import { MissionControlRunListSection } from "../../workspaces/components/WorkspaceHomeMissionControlSections";
import * as styles from "./CoreLoopClosureFixture.css";

const noop = () => undefined;

const activeThreadItems: ConversationItem[] = [
  {
    id: "thread-message-user",
    kind: "message",
    role: "user",
    text: "Audit the runtime continuity surface and tighten the supporting metadata hierarchy.",
  },
  {
    id: "thread-message-assistant",
    kind: "message",
    role: "assistant",
    text: "I’m reviewing the current runtime continuity UI and will propose the highest-leverage adjustments.",
  },
];

const runtimeTask: RuntimeAgentTaskSummary = {
  taskId: "runtime-core-loop-1",
  workspaceId: "workspace-1",
  threadId: null,
  title: "Blocked runtime continuity review",
  status: "awaiting_approval",
  accessMode: "on-request",
  distributedStatus: null,
  currentStep: 2,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_060_000,
  startedAt: 1_700_000_000_000,
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  pendingApprovalId: "approval-runtime-core-loop-1",
};

const runtimeRun = {
  id: "runtime-core-loop-1",
  taskId: "runtime-core-loop-1",
  workspaceId: "workspace-1",
  state: "awaiting_approval",
  title: "Blocked runtime continuity review",
  summary: "Runtime is coordinating a blocked review-ready handoff.",
  startedAt: 1_700_000_000_000,
  finishedAt: null,
  updatedAt: 1_700_000_060_000,
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
        approvalId: "approval-runtime-core-loop-1",
        reason: "Approve the delegated review before runtime publishes the handoff.",
        at: 1_700_000_080_000,
      },
      checkpointState: {
        checkpointId: "checkpoint-runtime-core-loop-1",
        summary: "Resume ready from checkpoint-runtime-core-loop-1",
        resumeReady: true,
      },
    },
  ],
  operatorSnapshot: {
    summary: "One delegated reviewer is blocked on approval.",
    currentActivity: "Collecting the final runtime continuity evidence.",
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
  executionGraph: {
    graphId: "graph-runtime-core-loop-1",
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

const autoDriveFixture = {
  source: "runtime_snapshot_v1",
  enabled: true,
  destination: {
    title: "Ship core loop closure",
    endState: "Timeline, composer, and runtime list share one grammar.",
    doneDefinition: "Core loop fixture and guards stay green.",
    avoid: "Do not regress shell density.",
    routePreference: "stability_first" as const,
  },
  budget: {
    maxTokens: 8_000,
    maxIterations: 4,
    maxDurationMinutes: 30,
    maxFilesPerIteration: 6,
    maxNoProgressIterations: 2,
    maxValidationFailures: 2,
    maxReroutes: 2,
  },
  riskPolicy: {
    pauseOnDestructiveChange: true,
    pauseOnDependencyChange: true,
    pauseOnLowConfidence: true,
    pauseOnHumanCheckpoint: true,
    allowNetworkAnalysis: false,
    allowValidationCommands: true,
    minimumConfidence: "medium" as const,
  },
  preset: {
    active: "safe_default" as const,
    apply: noop,
  },
  controls: {
    canStart: false,
    canPause: true,
    canResume: false,
    canStop: true,
    busyAction: null,
    onStart: noop,
    onPause: noop,
    onResume: noop,
    onStop: noop,
  },
  recovering: false,
  activity: [
    {
      id: "activity-1",
      kind: "stage" as const,
      title: "Executing",
      detail: "AutoDrive advanced to the next waypoint.",
      iteration: 2,
      timestamp: 1,
    },
  ],
  readiness: {
    readyToLaunch: true,
    issues: [],
    warnings: [],
    checklist: [
      { label: "Destination title set", complete: true },
      { label: "Desired end state mapped", complete: true },
      { label: "Done definition captured", complete: true },
    ],
    setupProgress: 100,
  },
  run: {
    status: "running" as const,
    stage: "executing_task",
    iteration: 2,
    consumedTokensEstimate: 2100,
    maxTokens: 8000,
    maxIterations: 4,
    startStateSummary: "Branch feat/core-loop with remaining budget.",
    destinationSummary: "Ship core loop closure",
    routeSummary: "timeline -> composer -> runtime list",
    currentMilestone: "Refine the composer meta rail",
    currentWaypointTitle: "Refine the composer meta rail",
    currentWaypointObjective: "Keep the composer compact.",
    currentWaypointArrivalCriteria: ["Meta rail stays compact", "Context remains legible"],
    remainingMilestones: ["Verify the run list"],
    offRoute: false,
    rerouting: false,
    rerouteReason: null,
    overallProgress: 66,
    waypointCompletion: 50,
    stopRisk: "medium" as const,
    arrivalConfidence: "medium" as const,
    remainingTokens: 5900,
    remainingIterations: 2,
    remainingDurationMs: 900000,
    remainingBlockers: [],
    lastValidationSummary: "validate:fast pending",
    stopReason: null,
    stopReasonCode: null,
    lastDecision: "continue",
    waypointStatus: "active" as const,
    latestReroute: null,
  },
  onToggleEnabled: noop,
  onChangeDestination: noop,
  onChangeBudget: noop,
  onChangeRiskPolicy: noop,
};

export function CoreLoopClosureFixture() {
  return (
    <main className={styles.page} data-visual-fixture="core-loop-closure">
      <ShellFrame className={styles.shell} tone="elevated" padding="lg">
        <ShellToolbar
          leading={<Text tone="muted">Core Loop Closure</Text>}
          trailing={<WorkspaceSupportMeta label="calm dense grammar" tone="success" />}
        >
          <Text weight="semibold">Timeline, Composer, Runtime list</Text>
        </ShellToolbar>

        <SplitPanel
          leading={
            <div className={styles.sectionStack}>
              <ShellSection
                title="Thread states"
                meta="new thread, restoring history, loading thread"
                actions={<WorkspaceSupportMeta label="messages" tone="progress" />}
              >
                <div className={styles.stateGrid}>
                  <div className={styles.timelineHost}>
                    <Messages
                      items={[]}
                      threadId={null}
                      workspaceId="workspace-1"
                      isThinking={false}
                      openTargets={[]}
                      selectedOpenAppId=""
                    />
                  </div>
                  <div className={styles.timelineHost}>
                    <Messages
                      items={[]}
                      threadId="thread-restoring"
                      workspaceId="workspace-1"
                      isThinking={false}
                      isRestoringThreadHistory
                      openTargets={[]}
                      selectedOpenAppId=""
                    />
                  </div>
                  <div className={styles.timelineHost}>
                    <Messages
                      items={[]}
                      threadId="thread-loading"
                      workspaceId="workspace-1"
                      isThinking={false}
                      isLoadingMessages
                      openTargets={[]}
                      selectedOpenAppId=""
                    />
                  </div>
                </div>
              </ShellSection>

              <ShellSection
                title="Active thread"
                meta="supporting metadata and timeline rhythm"
                actions={<WorkspaceSupportMeta label="thread live" />}
              >
                <div className={styles.activeTimelineHost}>
                  <Messages
                    items={activeThreadItems}
                    threadId="thread-active"
                    workspaceId="workspace-1"
                    isThinking={false}
                    openTargets={[]}
                    selectedOpenAppId=""
                  />
                </div>
              </ShellSection>
            </div>
          }
          trailing={
            <div className={styles.sectionStack}>
              <ShellSection
                title="Composer meta rail"
                meta="model, mode, placement, context, autodrive"
                actions={<WorkspaceSupportMeta label="composer" tone="success" />}
              >
                <div className={styles.composerHost}>
                  <ComposerMetaBar
                    disabled={false}
                    collaborationModes={[
                      {
                        id: "default",
                        label: "Default",
                        mode: "default",
                        model: "gpt-5.4",
                        reasoningEffort: "low",
                        developerInstructions: null,
                        value: {},
                      },
                      {
                        id: "plan",
                        label: "Plan",
                        mode: "plan",
                        model: "gpt-5.4",
                        reasoningEffort: "medium",
                        developerInstructions: null,
                        value: {},
                      },
                    ]}
                    selectedCollaborationModeId="default"
                    onSelectCollaborationMode={noop}
                    modelSelectionMode="manual"
                    models={[
                      {
                        id: "gpt-5.4",
                        model: "gpt-5.4",
                        displayName: "GPT-5.4",
                        available: true,
                      },
                    ]}
                    selectedProviderId="codex"
                    onSelectProvider={noop}
                    onSelectModelSelectionMode={noop}
                    selectedModelId="gpt-5.4"
                    onSelectModel={noop}
                    reasoningOptions={["low", "medium"]}
                    selectedEffort="low"
                    onSelectEffort={noop}
                    reasoningSupported={true}
                    accessMode="full-access"
                    onSelectAccessMode={noop}
                    executionOptions={[{ value: "runtime", label: "Runtime" }]}
                    selectedExecutionMode="runtime"
                    onSelectExecutionMode={noop}
                    remoteBackendOptions={[
                      { value: "backend-local", label: "Local desktop runtime" },
                      { value: "backend-cloud", label: "Cloud burst backend" },
                    ]}
                    selectedRemoteBackendId="backend-local"
                    onSelectRemoteBackendId={noop}
                    autoDrive={autoDriveFixture}
                  />
                </div>
              </ShellSection>

              <ShellSection
                title="Runtime run list"
                meta="blocked runtime run + review-ready continuity"
                actions={<WorkspaceSupportMeta label="runtime" tone="warning" />}
              >
                <MissionControlRunListSection
                  activeRuntimeCount={1}
                  runtimeTaskCount={1}
                  runtimeStatusFilter="all"
                  visibleRuntimeRuns={[{ task: runtimeTask, run: runtimeRun }]}
                  continuityItemsByTaskId={
                    new Map([
                      [
                        runtimeTask.taskId,
                        {
                          runId: runtimeRun.id,
                          taskId: runtimeTask.taskId,
                          state: "ready",
                          pathKind: "review",
                          detail: "Review Pack can continue from the runtime-published handoff.",
                          recommendedAction:
                            "Open Review Pack and continue from the runtime-published follow-up actions.",
                          truthSource: "review_actionability",
                          truthSourceLabel: "Runtime review actionability",
                        },
                      ],
                    ])
                  }
                  runtimeLoading={false}
                  refreshRuntimeTasks={async () => undefined}
                  interruptRuntimeTaskById={async () => undefined}
                  interruptRuntimeSubAgentSessionById={async () => undefined}
                  closeRuntimeSubAgentSessionById={async () => undefined}
                  resumeRuntimeTaskById={async () => undefined}
                  interveneRuntimeTaskById={async () => undefined}
                  prepareRunLauncher={noop}
                  decideRuntimeApproval={async () => undefined}
                />
              </ShellSection>

              <CoreLoopStatePanel
                tone="success"
                eyebrow="Review-ready continuity"
                title="Runtime published a handoff that can continue safely."
                description="When review-ready evidence is available, the core loop should stay calm and explicit about the next recommended action."
                checklistTitle="Continuation path"
                steps={[
                  { id: "open-review-pack", label: "Open Review Pack" },
                  {
                    id: "inspect-evidence",
                    label: "Inspect the runtime-published evidence",
                  },
                  {
                    id: "continue-follow-up",
                    label: "Continue from the canonical follow-up action",
                  },
                ]}
              />
            </div>
          }
        />
      </ShellFrame>
    </main>
  );
}
