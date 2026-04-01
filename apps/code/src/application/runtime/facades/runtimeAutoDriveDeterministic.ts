import { createAutoDriveLedger } from "./runtimeAutoDriveLedger";
import type {
  AgentTaskSummary,
  AgentTaskStepSummary,
  LiveSkillExecutionResult,
  SubAgentInterruptAck,
  SubAgentSendResult,
  SubAgentWaitResult,
} from "@ku0/code-runtime-host-contract";
import type {
  AutoDriveControllerDeps,
  AutoDriveLedger,
  AutoDriveRunRecord,
} from "../types/autoDrive";
import { logger } from "../logger";

type ArtifactListener = (artifacts: Array<{ path: string; content: string }>) => void;

function notifyArtifactListener(
  listener: ArtifactListener,
  artifacts: Array<{ path: string; content: string }>,
  source: "emit" | "initial"
): void {
  try {
    listener(artifacts);
  } catch (error) {
    logger.error(
      `[createDeterministicAutoDriveHarness] artifact listener failed during ${source}`,
      error
    );
  }
}

type DeterministicAutoDriveScenario = "budget-stop" | "goal-reached" | "reroute-stop";

type DeterministicAutoDriveHarnessOptions = {
  scenario?: DeterministicAutoDriveScenario;
  stepDelayMs?: number;
  persistence?: {
    load: () => string | null;
    save: (value: string) => void;
    clear: () => void;
  };
};

type DeterministicAutoDriveHarness = {
  deps: AutoDriveControllerDeps;
  createLedger: (workspaceId: string) => AutoDriveLedger;
  loadLatestRun: (params: {
    workspaceId: string;
    threadId?: string | null;
  }) => Promise<AutoDriveRunRecord | null>;
  listArtifacts: () => Array<{ path: string; content: string }>;
  clearArtifacts: () => void;
  subscribe: (listener: ArtifactListener) => () => void;
};

const FIXTURE_WORKSPACE_FILES = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
  "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
];

const BASELINE_OUTPUT = [
  "Outcome: established the initial route baseline and wired the first waypoint context.",
  "Changed Files: apps/code/src/features/composer/components/ComposerMetaBar.tsx",
  "Validation: pnpm validate:fast passed",
  "Blockers: none",
  "Waypoint Status: arrived",
  "Arrival Criteria Met: summarize the current state | name the next implementation milestone",
  "Arrival Criteria Missed: none",
  "Progress: 1 waypoint complete, route still in transit.",
  "Off Route: no",
  "Reroute Reason: none",
  "Human Checkpoint: no",
  "Goal reached: no",
].join("\n");

const SCENARIO_OUTPUTS: Record<DeterministicAutoDriveScenario, string[]> = {
  "budget-stop": [
    BASELINE_OUTPUT,
    [
      "Outcome: completed the second waypoint and left the route ready to stop on the hard iteration cap.",
      "Changed Files: apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
      "Validation: pnpm validate:fast passed",
      "Blockers: none",
      "Waypoint Status: arrived",
      "Arrival Criteria Met: advance the current milestone | leave behind a clear progress signal",
      "Arrival Criteria Missed: none",
      "Progress: 2 waypoints complete, one milestone remains.",
      "Off Route: no",
      "Reroute Reason: none",
      "Human Checkpoint: no",
      "Goal reached: no",
    ].join("\n"),
  ],
  "goal-reached": [
    BASELINE_OUTPUT,
    [
      "Outcome: completed the closing waypoint and satisfied the destination arrival checks.",
      "Changed Files: apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
      "Validation: pnpm validate:fast passed",
      "Blockers: none",
      "Waypoint Status: arrived",
      "Arrival Criteria Met: advance the current milestone | leave behind a clear progress signal | satisfy the destination arrival checks",
      "Arrival Criteria Missed: none",
      "Progress: 3 waypoints complete, destination reached.",
      "Off Route: no",
      "Reroute Reason: none",
      "Human Checkpoint: no",
      "Goal reached: yes",
    ].join("\n"),
  ],
  "reroute-stop": [
    [
      "Outcome: the route drifted away from the planned surface and requested a reroute before the waypoint could arrive.",
      "Changed Files: apps/code/src/features/composer/components/ComposerMetaBar.tsx",
      "Validation: pnpm validate:fast passed",
      "Blockers: route divergence detected",
      "Waypoint Status: blocked",
      "Arrival Criteria Met: summarize the current state",
      "Arrival Criteria Missed: advance the current milestone | leave behind a clear progress signal",
      "Progress: the route diverged before the waypoint arrival checks were satisfied.",
      "Off Route: yes",
      "Reroute Reason: The current waypoint diverged from the planned route and needs a course correction.",
      "Human Checkpoint: no",
      "Goal reached: no",
    ].join("\n"),
  ],
};

function createSessionSummary() {
  return {
    sessionId: "autodrive-deterministic-session",
    workspaceId: "workspace-deterministic",
    threadId: "thread-deterministic",
    title: "AutoDrive",
    status: "idle" as const,
    accessMode: "on-request" as const,
    reasonEffort: "medium" as const,
    provider: null,
    modelId: "gpt-5",
    activeTaskId: null,
    lastTaskId: null,
    createdAt: 1,
    updatedAt: 1,
    closedAt: null,
    errorCode: null,
    errorMessage: null,
  };
}

function createTaskStep(output: string, index: number): AgentTaskStepSummary {
  return {
    index: 0,
    kind: "write",
    role: "coder",
    status: "completed",
    message: "Deterministic waypoint finished",
    runId: `deterministic-run-${index}`,
    output,
    metadata: {},
    startedAt: index,
    updatedAt: index + 1,
    completedAt: index + 1,
    errorCode: null,
    errorMessage: null,
    approvalId: null,
  };
}

function createTaskSummary(output: string, index: number): AgentTaskSummary {
  return {
    taskId: `task-${index}`,
    workspaceId: "workspace-deterministic",
    threadId: "thread-deterministic",
    requestId: `request-${index}`,
    title: `AutoDrive deterministic waypoint ${index}`,
    status: "completed",
    accessMode: "on-request",
    provider: null,
    modelId: "gpt-5",
    routedProvider: null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    currentStep: 1,
    createdAt: index,
    updatedAt: index + 1,
    startedAt: index,
    completedAt: index + 1,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    steps: [createTaskStep(output, index)],
  };
}

type SerializedDeterministicHarnessState = {
  artifacts: Array<[string, string]>;
  waitCallCount: number;
  interrupted: boolean;
};

function parseSerializedHarnessState(
  value: string | null | undefined
): SerializedDeterministicHarnessState | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as SerializedDeterministicHarnessState;
    if (!Array.isArray(parsed.artifacts) || typeof parsed.waitCallCount !== "number") {
      return null;
    }
    return {
      artifacts: parsed.artifacts.filter(
        (entry): entry is [string, string] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === "string" &&
          typeof entry[1] === "string"
      ),
      waitCallCount: Math.max(0, Math.round(parsed.waitCallCount)),
      interrupted: parsed.interrupted === true,
    };
  } catch {
    return null;
  }
}

export function createDeterministicAutoDriveHarness(
  options: DeterministicAutoDriveHarnessOptions = {}
): DeterministicAutoDriveHarness {
  const persistedState = parseSerializedHarnessState(options.persistence?.load());
  const artifacts = new Map<string, string>(persistedState?.artifacts ?? []);
  const listeners = new Set<ArtifactListener>();
  const scenario = options.scenario ?? "budget-stop";
  const stepDelayMs = Math.max(0, Math.round(options.stepDelayMs ?? 0));
  const iterationOutputs = SCENARIO_OUTPUTS[scenario];
  let waitCallCount = persistedState?.waitCallCount ?? 0;
  let interrupted = persistedState?.interrupted ?? false;

  const persistState = () => {
    options.persistence?.save(
      JSON.stringify({
        artifacts: [...artifacts.entries()],
        waitCallCount,
        interrupted,
      } satisfies SerializedDeterministicHarnessState)
    );
  };

  const emitArtifacts = () => {
    const next = [...artifacts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([path, content]) => ({ path, content }));
    for (const listener of listeners) {
      notifyArtifactListener(listener, next, "emit");
    }
  };

  const writeArtifact = async (path: string, content: string) => {
    artifacts.set(path, content);
    persistState();
    emitArtifacts();
  };

  const readArtifact = async (path: string) => artifacts.get(path) ?? null;

  const deps: AutoDriveControllerDeps = {
    getGitStatus: async () => ({
      branchName: "feat/autodrive-navigation",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
    }),
    getGitLog: async () => ({
      total: 2,
      ahead: 1,
      behind: 0,
      upstream: "origin/main",
      aheadEntries: [],
      behindEntries: [],
      entries: [
        {
          sha: "sha-1",
          summary: "upgrade autodrive navigation model",
          author: "fixture",
          timestamp: 1_700_000_001_000,
        },
        {
          sha: "sha-2",
          summary: "tighten route stop policy",
          author: "fixture",
          timestamp: 1_700_000_000_000,
        },
      ],
    }),
    getGitRemote: async () => "origin",
    getGitCommitDiff: async (_workspaceId, sha) =>
      sha === "sha-1"
        ? [
            {
              path: "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
              status: "M",
              diff: "",
            },
          ]
        : [
            {
              path: "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
              status: "M",
              diff: "",
            },
          ],
    listGitBranches: async () => ({
      currentBranch: "feat/autodrive-navigation",
      branches: [{ name: "feat/autodrive-navigation", lastUsedAt: 1_700_000_002_000 }],
    }),
    getWorkspaceFiles: async () => FIXTURE_WORKSPACE_FILES,
    readWorkspaceFile: async (_workspaceId, path) => {
      if (path === "AGENTS.md") {
        return {
          content:
            "Runtime Boundary Rules\n- apps/code/src/application/runtime/* is the only approved frontend boundary.\nValidation Gates\n- pnpm validate:fast\n",
          truncated: false,
        };
      }
      if (path === "README.md") {
        return {
          content: "# HugeCode\nAutoDrive should navigate from a start state to a destination.\n",
          truncated: false,
        };
      }
      if (path === "package.json") {
        return {
          content: JSON.stringify({
            packageManager: "pnpm@10.0.0",
            scripts: {
              "validate:fast": "pnpm validate:fast",
              validate: "pnpm validate",
            },
          }),
          truncated: false,
        };
      }
      return {
        content: `// fixture content for ${path}`,
        truncated: false,
      };
    },
    spawnSubAgentSession: async () => createSessionSummary(),
    sendSubAgentInstruction: async (request): Promise<SubAgentSendResult> => {
      interrupted = false;
      persistState();
      return {
        session: { ...createSessionSummary(), sessionId: request.sessionId },
        task: {
          taskId: `task-${waitCallCount + 1}`,
          workspaceId: "workspace-deterministic",
          threadId: "thread-deterministic",
          requestId: request.requestId ?? null,
          title: "AutoDrive deterministic waypoint",
          status: "running" as const,
          accessMode: "on-request" as const,
          provider: null,
          modelId: "gpt-5",
          routedProvider: null,
          routedModelId: null,
          routedPool: null,
          routedSource: null,
          currentStep: 0,
          createdAt: waitCallCount + 1,
          updatedAt: waitCallCount + 1,
          startedAt: waitCallCount + 1,
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [],
        },
      };
    },
    waitSubAgentSession: async (): Promise<SubAgentWaitResult> => {
      if (stepDelayMs > 0) {
        const delayStart = Date.now();
        while (!interrupted && Date.now() - delayStart < stepDelayMs) {
          await new Promise((resolve) => {
            setTimeout(resolve, Math.min(50, stepDelayMs));
          });
        }
      }
      const output = iterationOutputs[Math.min(waitCallCount, iterationOutputs.length - 1)];
      waitCallCount += 1;
      persistState();
      return {
        done: true,
        timedOut: false,
        session: {
          ...createSessionSummary(),
          lastTaskId: `task-${waitCallCount}`,
          updatedAt: waitCallCount + 1,
        },
        task: createTaskSummary(output, waitCallCount),
      };
    },
    getSubAgentSessionStatus: async () => createSessionSummary(),
    interruptSubAgentSession: async (): Promise<SubAgentInterruptAck> => {
      interrupted = true;
      persistState();
      return {
        accepted: true,
        sessionId: "autodrive-deterministic-session",
        taskId: null,
        status: "idle",
        message: "interrupted",
      };
    },
    closeSubAgentSession: async () => {
      interrupted = false;
      persistState();
      return {
        closed: true,
        sessionId: "autodrive-deterministic-session",
        status: "closed",
        message: "closed",
      };
    },
    runRuntimeExecutableSkill: async (): Promise<LiveSkillExecutionResult> => ({
      runId: "live-skill-run-deterministic",
      skillId: "core-bash",
      status: "completed",
      message: "Deterministic validation passed",
      output: "deterministic validation passed",
      metadata: { exitCode: 0 },
      artifacts: [],
      network: null,
    }),
    now: () => Date.now(),
    createRunId: () => "autodrive-e2e-run",
    delay: async () => undefined,
  };

  return {
    deps,
    createLedger: () =>
      createAutoDriveLedger({
        writeArtifact,
        readArtifact,
      }),
    loadLatestRun: async () => {
      const raw = await readArtifact(".hugecode/runs/autodrive-e2e-run/run.json");
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as AutoDriveRunRecord;
    },
    listArtifacts: () =>
      [...artifacts.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([path, content]) => ({ path, content })),
    clearArtifacts: () => {
      artifacts.clear();
      waitCallCount = 0;
      interrupted = false;
      options.persistence?.clear();
      emitArtifacts();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      notifyArtifactListener(
        listener,
        [...artifacts.entries()]
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([path, content]) => ({ path, content })),
        "initial"
      );
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
