import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";
import { Card, SectionHeader, StatusBadge, ToolCallChip } from "../../../design-system";
import * as fixtureStyles from "../../design-system/components/execution/ExecutionDetailVisualFixture.css";
import "./WorkspaceHomeAgentControl.styles.css";
import { WorkspaceHomeAgentRuntimeRunItem } from "./WorkspaceHomeAgentRuntimeRunItem";

const sampleTask = {
  taskId: "fixture-subagent-observability",
  workspaceId: "fixture-workspace",
  threadId: null,
  requestId: null,
  title: "Redesign sub-agent observability",
  status: "running",
  accessMode: "on-request",
  distributedStatus: null,
  currentStep: 3,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_180_000,
  startedAt: 1_700_000_000_000,
  completedAt: null,
  errorCode: null,
  errorMessage: null,
  pendingApprovalId: null,
} as RuntimeAgentTaskSummary;

const sampleRun: HugeCodeRunSummary = {
  id: "fixture-subagent-observability",
  taskId: "fixture-subagent-observability",
  workspaceId: "fixture-workspace",
  state: "running",
  title: "Redesign sub-agent observability",
  summary: "Runtime is coordinating implementation and review delegates.",
  startedAt: 1_700_000_000_000,
  finishedAt: null,
  updatedAt: 1_700_000_180_000,
  currentStepIndex: 3,
  warnings: [],
  validations: [],
  artifacts: [],
  changedPaths: [
    "apps/code/src/features/workspaces/components/WorkspaceHomeAgentRuntimeRunItem.tsx",
  ],
  executionProfile: {
    id: "balanced-delegate",
    name: "Balanced Delegate",
    description: "Delegates bounded work and pauses on human review.",
    executionMode: "remote_sandbox",
    autonomy: "bounded_delegate",
    supervisionLabel: "Review before merge",
    accessMode: "on-request",
    routingStrategy: "workspace_default",
    toolPosture: "workspace_safe",
    approvalSensitivity: "standard",
    identitySource: "runtime",
    validationPresetId: "validate-fast",
    networkPolicy: "default",
  },
  routing: {
    provider: "openai",
    providerLabel: "OpenAI",
    pool: "default",
    routeLabel: "Workspace default route",
    routeHint: "Remote delegate capacity is healthy.",
    health: "ready",
    backendId: "backend-primary",
    enabledAccountCount: 1,
    readyAccountCount: 1,
    enabledPoolCount: 1,
  },
  approval: {
    status: "pending_decision",
    approvalId: "approval-review-1",
    label: "Approval required",
    summary: "The reviewer delegate is waiting on operator approval before continuing.",
  },
  nextAction: {
    label: "Approve delegated reviewer",
    action: "resume",
    detail: "The reviewer can continue once approval is granted.",
  },
  placement: {
    resolvedBackendId: "backend-primary",
    requestedBackendIds: ["backend-primary"],
    resolutionSource: "workspace_default",
    lifecycleState: "confirmed",
    readiness: "ready",
    healthSummary: "placement_ready",
    attentionReasons: [],
    summary: "Placement is confirmed on backend-primary.",
    rationale: "Workspace default route remains healthy and low-latency.",
  },
  operatorSnapshot: {
    summary: "Two delegated sessions are active under this mission run.",
    runtimeLabel: "Codex runtime",
    provider: "openai",
    modelId: "gpt-5.4",
    reasoningEffort: "medium",
    backendId: "backend-primary",
    machineId: "machine-1",
    machineSummary: "Primary remote backend",
    workspaceRoot: "/workspace",
    currentActivity:
      "Implementation delegate is preparing a patch while review waits for approval.",
    blocker: "Reviewer delegate is awaiting approval.",
    recentEvents: [
      {
        kind: "tool_start",
        label: "Planner delegated implementation",
        detail: "Spawned implementation and reviewer delegates.",
        at: 1_700_000_000_000,
      },
      {
        kind: "approval_wait",
        label: "Reviewer requested approval",
        detail: "Approval is required before the reviewer can continue.",
        at: 1_700_000_120_000,
      },
      {
        kind: "status_transition",
        label: "Implementation still running",
        detail: "Implementation delegate is updating the mission-control surface.",
        at: 1_700_000_180_000,
      },
    ],
  },
  subAgents: [
    {
      sessionId: "session-implementation",
      status: "running",
      scopeProfile: "implementation",
      summary: "Implementation delegate is applying the redesigned cockpit.",
      checkpointState: {
        state: "active",
        lifecycleState: "requested",
        checkpointId: "checkpoint-impl-1",
        traceId: "trace-impl-1",
        recovered: false,
        updatedAt: 1_700_000_180_000,
        resumeReady: false,
        summary: "Checkpoint checkpoint-impl-1 is current.",
      },
    },
    {
      sessionId: "session-review",
      status: "awaiting_approval",
      scopeProfile: "review",
      summary: "Reviewer delegate is paused for approval.",
      approvalState: {
        status: "pending",
        approvalId: "approval-review-1",
        reason: "Approve reviewer escalation to continue.",
        at: 1_700_000_120_000,
      },
      checkpointState: {
        state: "active",
        lifecycleState: "requested",
        checkpointId: "checkpoint-review-1",
        traceId: "trace-review-1",
        recovered: false,
        updatedAt: 1_700_000_120_000,
        resumeReady: true,
        summary: "Checkpoint checkpoint-review-1 is ready for resume.",
      },
      takeoverBundle: {
        state: "ready",
        pathKind: "resume",
        primaryAction: "resume",
        summary: "Resume is ready once approval is granted.",
        recommendedAction: "Resume reviewer delegate",
      },
    },
  ],
  executionGraph: {
    graphId: "fixture-subagent-observability",
    nodes: [
      {
        id: "plan-root",
        kind: "plan",
        status: "running",
        executorKind: "sub_agent",
        executorSessionId: "session-implementation",
        resolvedBackendId: "backend-primary",
        placementLifecycleState: "confirmed",
        placementResolutionSource: "workspace_default",
      },
      {
        id: "plan-review",
        kind: "plan",
        status: "awaiting_approval",
        executorKind: "sub_agent",
        executorSessionId: "session-review",
        resolvedBackendId: "backend-primary",
        placementLifecycleState: "confirmed",
        placementResolutionSource: "workspace_default",
      },
    ],
    edges: [{ fromNodeId: "plan-root", toNodeId: "plan-review", kind: "depends_on" }],
  },
};

export function WorkspaceHomeSubAgentObservabilityFixture() {
  return (
    <main className={fixtureStyles.shell} data-visual-fixture="runtime-subagent-observability">
      <div className={fixtureStyles.frame}>
        <section className={fixtureStyles.hero}>
          <span className={fixtureStyles.eyebrow}>Runtime Fixture</span>
          <div className={fixtureStyles.titleRow}>
            <h1 className={fixtureStyles.title}>Sub-agent observability</h1>
            <div className={fixtureStyles.chipRow}>
              <ToolCallChip tone="neutral">workspace runtime</ToolCallChip>
              <StatusBadge tone="progress">delegation active</StatusBadge>
              <StatusBadge tone="warning">Approval required</StatusBadge>
            </div>
          </div>
          <p className={fixtureStyles.subtitle}>
            Acceptance surface for delegated-session observability inside the mission-control run
            list.
          </p>
        </section>

        <Card padding="lg" variant="translucent">
          <SectionHeader
            titleAs="h2"
            title="Run list"
            meta={
              <>
                <ToolCallChip tone="neutral">Visible 1</ToolCallChip>
                <ToolCallChip tone="neutral">Filter running</ToolCallChip>
              </>
            }
          />
          <div className="workspace-home-code-runtime-create">
            <WorkspaceHomeAgentRuntimeRunItem
              task={sampleTask}
              run={sampleRun}
              continuityItem={null}
              runtimeLoading={false}
              onRefresh={() => undefined}
              onInterrupt={() => undefined}
              onResume={() => undefined}
              onPrepareLauncher={() => undefined}
              onApproval={() => undefined}
            />
          </div>
        </Card>
      </div>
    </main>
  );
}
