import type { SubAgentWaitResult } from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import { AutoDriveRunController } from "./runtimeAutoDriveController";
import type {
  AutoDriveContextSnapshot,
  AutoDriveControllerDeps,
  AutoDriveRouteProposal,
  AutoDriveRunRecord,
} from "../types/autoDrive";

function createRun(): AutoDriveRunRecord {
  return {
    schemaVersion: "autodrive-run/v2",
    runId: "run-123",
    workspaceId: "workspace-1",
    workspacePath: "/repo",
    threadId: "thread-1",
    status: "created",
    stage: "created",
    destination: {
      title: "Build AutoDrive navigation in two safe waypoints",
      desiredEndState: ["UI shows route progress", "Ledger shows route artifacts"],
      doneDefinition: {
        arrivalCriteria: ["Render route summary", "Write run journal entries"],
        requiredValidation: ["pnpm validate:fast"],
        waypointIndicators: ["Progress", "Waypoint Status"],
      },
      hardBoundaries: ["Do not break manual composer mode"],
      routePreference: "validation_first",
    },
    budget: {
      maxTokens: 10000,
      maxIterations: 2,
      maxDurationMs: 100000,
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
      allowChatgptDecisionLab: true,
      autoRunChatgptDecisionLab: true,
      allowValidationCommands: true,
      minimumConfidence: "medium",
      chatgptDecisionLabMinConfidence: "medium",
      chatgptDecisionLabMaxScoreGap: 8,
    },
    iteration: 0,
    totals: {
      consumedTokensEstimate: 0,
      elapsedMs: 0,
      validationFailureCount: 0,
      noProgressCount: 0,
      repeatedFailureCount: 0,
      rerouteCount: 0,
    },
    blockers: [],
    completedSubgoals: [],
    summaries: [],
    navigation: {
      destinationSummary: "Build AutoDrive navigation in two safe waypoints",
      startStateSummary: null,
      routeSummary: null,
      currentWaypointTitle: null,
      currentWaypointObjective: null,
      currentWaypointArrivalCriteria: [],
      remainingMilestones: [],
      currentMilestone: null,
      overallProgress: 0,
      waypointCompletion: 0,
      offRoute: false,
      rerouting: false,
      rerouteReason: null,
      remainingBlockers: [],
      arrivalConfidence: "medium",
      stopRisk: "low",
      remainingTokens: 10000,
      remainingIterations: 2,
      remainingDurationMs: 100000,
      lastDecision: null,
    },
    createdAt: 1,
    updatedAt: 1,
    startedAt: 1,
    completedAt: null,
    lastStopReason: null,
    sessionId: null,
    lastValidationSummary: null,
    currentBlocker: null,
    latestReroute: null,
  };
}

function createDeps(): AutoDriveControllerDeps {
  return {
    getGitStatus: vi.fn(),
    getGitLog: vi.fn(),
    getGitCommitDiff: vi.fn(),
    listGitBranches: vi.fn(),
    getWorkspaceFiles: vi.fn(),
    readWorkspaceFile: vi.fn(),
    spawnSubAgentSession: vi.fn().mockResolvedValue({
      sessionId: "session-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      title: "AutoDrive",
      status: "idle",
      accessMode: "on-request",
      reasonEffort: "medium",
      provider: null,
      modelId: "gpt-5",
      activeTaskId: null,
      lastTaskId: null,
      createdAt: 1,
      updatedAt: 1,
      closedAt: null,
      errorCode: null,
      errorMessage: null,
    }),
    sendSubAgentInstruction: vi.fn().mockResolvedValue({
      session: {
        sessionId: "session-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        title: "AutoDrive",
        status: "idle",
        accessMode: "on-request",
        reasonEffort: "medium",
        provider: null,
        modelId: "gpt-5",
        activeTaskId: null,
        lastTaskId: null,
        createdAt: 1,
        updatedAt: 1,
        closedAt: null,
        errorCode: null,
        errorMessage: null,
      },
      task: {
        taskId: "task-send",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        requestId: "req-send",
        title: "AutoDrive",
        status: "running",
        accessMode: "on-request",
        provider: null,
        modelId: "gpt-5",
        routedProvider: null,
        routedModelId: null,
        routedPool: null,
        routedSource: null,
        currentStep: 0,
        createdAt: 1,
        updatedAt: 1,
        startedAt: 1,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        steps: [],
      },
    }),
    waitSubAgentSession: vi
      .fn()
      .mockResolvedValueOnce({
        done: true,
        timedOut: false,
        session: {
          sessionId: "session-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          title: "AutoDrive",
          status: "idle",
          accessMode: "on-request",
          reasonEffort: "medium",
          provider: null,
          modelId: "gpt-5",
          activeTaskId: null,
          lastTaskId: "task-1",
          createdAt: 1,
          updatedAt: 2,
          closedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        task: {
          taskId: "task-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          requestId: "req-1",
          title: "Waypoint 1",
          status: "completed",
          accessMode: "on-request",
          provider: null,
          modelId: "gpt-5",
          routedProvider: null,
          routedModelId: null,
          routedPool: null,
          routedSource: null,
          currentStep: 1,
          createdAt: 1,
          updatedAt: 2,
          startedAt: 1,
          completedAt: 2,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [
            {
              index: 0,
              kind: "write",
              role: "coder",
              status: "completed",
              message: "Finished waypoint 1",
              runId: "run-1",
              output: "Outcome: waypoint 1 complete",
              metadata: {},
              startedAt: 1,
              updatedAt: 2,
              completedAt: 2,
              errorCode: null,
              errorMessage: null,
              approvalId: null,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        done: true,
        timedOut: false,
        session: {
          sessionId: "session-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          title: "AutoDrive",
          status: "idle",
          accessMode: "on-request",
          reasonEffort: "medium",
          provider: null,
          modelId: "gpt-5",
          activeTaskId: null,
          lastTaskId: "task-2",
          createdAt: 1,
          updatedAt: 3,
          closedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        task: {
          taskId: "task-2",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          requestId: "req-2",
          title: "Waypoint 2",
          status: "completed",
          accessMode: "on-request",
          provider: null,
          modelId: "gpt-5",
          routedProvider: null,
          routedModelId: null,
          routedPool: null,
          routedSource: null,
          currentStep: 1,
          createdAt: 2,
          updatedAt: 3,
          startedAt: 2,
          completedAt: 3,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [
            {
              index: 0,
              kind: "write",
              role: "coder",
              status: "completed",
              message: "Finished waypoint 2",
              runId: "run-2",
              output: "Outcome: waypoint 2 complete",
              metadata: {},
              startedAt: 2,
              updatedAt: 3,
              completedAt: 3,
              errorCode: null,
              errorMessage: null,
              approvalId: null,
            },
          ],
        },
      }),
    getSubAgentSessionStatus: vi.fn(),
    interruptSubAgentSession: vi.fn(),
    closeSubAgentSession: vi.fn().mockResolvedValue({
      closed: true,
      sessionId: "session-1",
      status: "closed",
      message: "closed",
    }),
    runRuntimeBrowserDebug: vi.fn().mockResolvedValue({
      workspaceId: "workspace-1",
      available: true,
      status: "completed",
      mode: "mcp-chrome-devtools",
      operation: "chatgpt_decision_lab",
      message: "ChatGPT decision lab completed.",
      toolCalls: [{ toolName: "evaluate_script", ok: true }],
      contentText: "decision lab raw response",
      structuredContent: null,
      artifacts: [],
      warnings: [],
      decisionLab: {
        recommendedOptionId: "stabilize_route",
        recommendedOption: "Stabilize the route before widening scope.",
        alternativeOptionIds: ["advance_primary_surface"],
        decisionMemo:
          "The lower-risk route keeps the runtime boundary intact while confidence is only medium.",
        confidence: "high",
        assumptions: ["The validation lane is still representative."],
        followUpQuestions: [],
      },
    }),
    runLiveSkill: vi.fn().mockResolvedValue({
      runId: "live-skill-run",
      skillId: "core-bash",
      status: "completed",
      message: "validation passed",
      output: "validation passed",
      metadata: { exitCode: 0 },
      artifacts: [],
      network: null,
    }),
    stageGitAll: vi.fn().mockResolvedValue(undefined),
    commitGit: vi.fn().mockResolvedValue(undefined),
    generateCommitMessage: vi.fn().mockResolvedValue("feat: autodrive branch-only candidate"),
    createGitBranch: vi.fn().mockResolvedValue(undefined),
    checkoutGitBranch: vi.fn().mockResolvedValue(undefined),
    pushGit: vi.fn().mockResolvedValue(undefined),
    now: vi.fn().mockReturnValue(1000),
    createRunId: () => "run-123",
    delay: async () => undefined,
  };
}

function createContext(iteration: number): AutoDriveContextSnapshot {
  return {
    schemaVersion: "autodrive-context/v2",
    runId: "run-123",
    iteration,
    destination: createRun().destination,
    startState: {
      summary: `Start state for iteration ${iteration}`,
      repo: {
        branch: "feat/autodrive",
        dirtyWorkingTree: false,
        recentCommits: ["tighten runtime boundaries"],
        touchedAreas: ["apps/code/src/features/composer"],
        changedPaths: [],
        unresolvedBlockers: [],
      },
      task: {
        completedSubgoals: [],
        pendingMilestones: ["Advance the current waypoint", "Validate the route"],
        confidence: "medium",
        risk: "low",
        currentBlocker: null,
      },
      system: {
        consumedTokensEstimate: 1000,
        remainingTokensEstimate: 9000,
        iterationsUsed: iteration - 1,
        remainingIterations: 2 - (iteration - 1),
        elapsedMs: 2000,
        remainingDurationMs: 98000,
        validationFailureCount: 0,
        noProgressCount: 0,
        repeatedFailureCount: 0,
        rerouteCount: 0,
        stopRisk: "low",
      },
      routeHealth: {
        offRoute: false,
        noProgressLoop: false,
        rerouteRecommended: false,
        rerouteReason: null,
        triggerSignals: [],
      },
    },
    repo: {
      packageManager: "pnpm",
      workspaceMarkers: ["pnpm-workspace.yaml"],
      scripts: { validateFast: "pnpm validate:fast" },
      ruleEvidence: [],
      relevantDocs: [],
      relevantFiles: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
    },
    git: {
      branch: "feat/autodrive",
      remote: "origin",
      upstream: "origin/main",
      ahead: 1,
      behind: 0,
      recentCommits: [],
      workingTree: {
        dirty: false,
        stagedCount: 0,
        unstagedCount: 0,
        changedPaths: [],
        totalAdditions: 0,
        totalDeletions: 0,
      },
    },
    collaboratorIntent: {
      recentDirection: "Tighten runtime boundaries.",
      touchedAreas: ["apps/code/src/features/composer"],
      boundarySignals: [],
      probableIntent: "Keep runtime orchestration centralized.",
      conflictRisk: "low",
      confidence: "medium",
    },
    intent: {
      summary:
        "Prioritize the AutoDrive destination while keeping runtime orchestration centralized.",
      signals: [
        {
          kind: "operator_intent",
          summary: "Operator destination focuses on AutoDrive.",
          source: "destination",
          confidence: "high",
        },
      ],
      directionHypotheses: [
        {
          summary: "Advance the composer-facing AutoDrive slice first.",
          rationale:
            "The current destination and runtime boundaries both point at the composer surface.",
          suggestedAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
          confidence: "medium",
          dominantSignalKinds: ["operator_intent"],
        },
      ],
    },
    opportunities: {
      selectedCandidateId: "advance_primary_surface",
      candidates: [
        {
          id: "advance_primary_surface",
          title: "Advance the primary AutoDrive surface",
          summary: "Use the strongest direction hypothesis to move the destination forward.",
          rationale:
            "The current destination and runtime boundaries both point at the composer surface.",
          repoAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
          score: 90,
          confidence: "medium",
          risk: "low",
        },
      ],
    },
    executionTuning: {
      summary: "No adaptive feedback adjustments are active.",
      reasons: [],
      effectiveMaxFilesPerIteration: 6,
      validationCommandPreference: "fast",
      publishPriority: "none",
      cautionLevel: "normal",
    },
    publishReadiness: {
      allowed: false,
      recommendedMode: "hold",
      summary: "Publish corridor is blocked until the route validates cleanly.",
      reasonCodes: ["validation_incomplete"],
    },
    repoBacklog: {
      openIssues: null,
      openPullRequests: null,
      highlights: [],
    },
    publishHistory: {
      bestCorridor: null,
      latestFailureSummary: null,
    },
    threadContext: null,
    previousSummary: null,
    blockers: [],
    completedSubgoals: [],
    externalResearch: [],
    synthesizedAt: iteration,
  };
}

function createProposal(iteration: number): AutoDriveRouteProposal {
  return {
    schemaVersion: "autodrive-route-proposal/v2",
    runId: "run-123",
    iteration,
    routeSummary: "baseline -> implement -> validate",
    routeSelectionReason: "Follow the validation-first route.",
    whyThisWaypointNow: "This is the shortest safe waypoint.",
    evidence: [],
    evidenceSummary: "Follow the runtime boundary.",
    collaboratorIntentSummary: "No conflicts detected.",
    milestones: [
      {
        id: "baseline",
        title: "Map the current start state and hard boundaries",
        description: "Baseline",
        status: iteration === 1 ? "active" : "completed",
        arrivalCriteria: ["Summarize the start state"],
        repoAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
      },
      {
        id: "implement",
        title: "Advance the current waypoint in the target surface",
        description: "Implement",
        status: iteration === 1 ? "remaining" : "active",
        arrivalCriteria: ["Advance the current waypoint"],
        repoAreas: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
      },
      {
        id: "validate",
        title: "Validate the route and decide whether to arrive or reroute",
        description: "Validate",
        status: "remaining",
        arrivalCriteria: ["pnpm validate:fast"],
        repoAreas: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
      },
    ],
    currentWaypoint: {
      id: `waypoint-${iteration}`,
      title: iteration === 1 ? "Establish the route baseline" : "Advance the current waypoint",
      objective: "Implement the next safe slice.",
      whyNow: "The previous step isolated the correct surface.",
      repoAreas: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
      commandsToRun: ["pnpm validate:fast"],
      validationPlan: ["pnpm validate:fast"],
      samplePaths: [],
      heldOutGuidance: [],
      scenarioKeys: [],
      arrivalCriteria: ["Leave behind a progress signal"],
      stopIf: ["A destructive change is required"],
      rerouteTriggers: ["Validation fails"],
      expectedOutput: ["Route-aware summary"],
      estimatedCost: {
        tokens: 600,
        iterations: 1,
        durationMs: 1000,
        risk: "low",
      },
      confidence: "medium",
    },
    remainingMilestones:
      iteration === 1
        ? ["Advance the current waypoint", "Validate the route"]
        : ["Validate the route"],
    routeConfidence: "medium",
    promptText: "Follow the route.",
  };
}

const expectedPublishBranchName =
  "autodrive/build-autodrive-navigation-in-tw-19700101000001-run-123";

describe("AutoDriveRunController", () => {
  it("auto-runs the ChatGPT decision lab and applies its recommendation before building the next proposal", async () => {
    const deps = createDeps();
    const ambiguousContext = createContext(1);
    ambiguousContext.opportunities = {
      selectedCandidateId: "advance_primary_surface",
      selectionSummary:
        "Advance the primary surface barely leads, but the route remains ambiguous.",
      candidates: [
        {
          id: "advance_primary_surface",
          title: "Advance the primary AutoDrive surface",
          summary: "Move the active waypoint immediately.",
          rationale: "Momentum points here.",
          repoAreas: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
          score: 61,
          confidence: "medium",
          risk: "medium",
        },
        {
          id: "stabilize_route",
          title: "Stabilize the route before widening scope",
          summary: "Tighten the route and validation loop first.",
          rationale: "Risk is lower and the score gap is small.",
          repoAreas: ["apps/code/src/application/runtime/facades/runtimeAutoDrivePolicy.ts"],
          score: 56,
          confidence: "medium",
          risk: "low",
        },
      ],
    };

    const buildProposal = vi.fn(({ context }: { context: AutoDriveContextSnapshot }) =>
      createProposal(context.iteration)
    );

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 1,
        },
      },
      synthesizeContext: async () => ambiguousContext,
      buildProposal,
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "medium",
        shouldReroute: false,
        rerouteReason: null,
      }),
    });

    await controller.start();

    expect(deps.runRuntimeBrowserDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        operation: "chatgpt_decision_lab",
        decisionLab: expect.objectContaining({
          question: expect.stringContaining("Which route should AutoDrive choose"),
          options: expect.arrayContaining([
            expect.objectContaining({ id: "advance_primary_surface" }),
            expect.objectContaining({ id: "stabilize_route" }),
          ]),
        }),
      })
    );
    expect(buildProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          opportunities: expect.objectContaining({
            selectedCandidateId: "stabilize_route",
            selectionSummary: expect.stringContaining("Candidate 2"),
          }),
        }),
      })
    );
  });

  it("skips the ChatGPT decision lab when automatic invocation is disabled", async () => {
    const deps = createDeps();
    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        riskPolicy: {
          ...createRun().riskPolicy,
          autoRunChatgptDecisionLab: false,
        },
        budget: {
          ...createRun().budget,
          maxIterations: 1,
        },
      },
      synthesizeContext: async ({ iteration }) => createContext(iteration),
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "medium",
        shouldReroute: false,
        rerouteReason: null,
      }),
    });

    await controller.start();

    expect(deps.runRuntimeBrowserDebug).not.toHaveBeenCalled();
  });

  it("continues notifying remaining subscribers when one listener throws", async () => {
    const controller = new AutoDriveRunController({
      deps: createDeps(),
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: createRun(),
    });
    const failingListener = vi.fn(() => {
      throw new Error("listener boom");
    });
    const healthyListener = vi.fn();

    controller.subscribe(failingListener);
    controller.subscribe(healthyListener);

    await expect(controller.pause()).resolves.toBeUndefined();
    expect(failingListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paused",
        lastStopReason: expect.objectContaining({ code: "missing_human_input" }),
      })
    );
  });
  it("advances through two waypoints and stops on the hard iteration cap", async () => {
    const deps = createDeps();
    const writeRun = vi.fn().mockResolvedValue(undefined);
    const writeContext = vi.fn().mockResolvedValue(undefined);
    const writeProposal = vi.fn().mockResolvedValue(undefined);
    const writeSummary = vi.fn().mockResolvedValue(undefined);
    const writeReroute = vi.fn().mockResolvedValue(undefined);
    const writeFinalReport = vi.fn().mockResolvedValue(undefined);

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun,
        writeContext,
        writeProposal,
        writeSummary,
        writeReroute,
        writeFinalReport,
      },
      run: createRun(),
      synthesizeContext: async ({ iteration }) => createContext(iteration),
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "medium",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle:
          iteration === 1 ? "Establish the route baseline" : "Advance the current waypoint",
        summaryText: `Iteration ${iteration} advanced the route.`,
        changedFiles:
          iteration === 1
            ? ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"]
            : ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: [`waypoint_${iteration}`],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone:
            iteration === 1
              ? "Map the current start state and hard boundaries"
              : "Advance the current waypoint in the target surface",
          currentWaypointTitle:
            iteration === 1 ? "Establish the route baseline" : "Advance the current waypoint",
          completedWaypoints: iteration,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: iteration === 1 ? 33 : 66,
          remainingMilestones:
            iteration === 1
              ? ["Advance the current waypoint", "Validate the route"]
              : ["Validate the route"],
          remainingBlockers: [],
          remainingDistance: iteration === 1 ? "Two milestones remain." : "One milestone remains.",
          arrivalConfidence: "medium",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: iteration === 1 ? "Establish the route baseline" : "Advance the current waypoint",
          status: "arrived",
          arrivalCriteriaMet: ["Left behind a progress signal"],
          arrivalCriteriaMissed: [],
        },
        goalReached: false,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: `Iteration ${iteration} complete`,
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
      buildFinalReport: ({ run }) => `# Final Report\n\nRun ${run.runId} completed.\n`,
    });

    const snapshot = await controller.start();

    expect(snapshot.status).toBe("stopped");
    expect(snapshot.stage).toBe("stopped");
    expect(snapshot.lastStopReason?.code).toBe("max_iterations_reached");
    expect(snapshot.iteration).toBe(2);
    expect(snapshot.navigation.overallProgress).toBe(66);
    expect(writeContext).toHaveBeenCalledTimes(2);
    expect(writeProposal).toHaveBeenCalledTimes(2);
    expect(writeSummary).toHaveBeenCalledTimes(2);
    expect(writeReroute).not.toHaveBeenCalled();
    expect(writeFinalReport).toHaveBeenCalledTimes(1);
  });

  it("raises session reasoning effort when execution tuning escalates caution", async () => {
    const deps = createDeps();
    const context = createContext(1);
    context.executionTuning = {
      summary: "Validation drift requires the stronger reasoning lane.",
      reasons: ["validation_failed"],
      effectiveMaxFilesPerIteration: 2,
      validationCommandPreference: "full",
      publishPriority: "none",
      cautionLevel: "high",
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        execution: {
          accessMode: "on-request",
          modelId: "gpt-5",
          reasoningEffort: "medium",
        },
        budget: {
          ...createRun().budget,
          maxIterations: 1,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "medium",
        shouldReroute: false,
        rerouteReason: null,
      }),
    });

    await controller.start();

    expect(deps.spawnSubAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonEffort: "high",
        modelId: "gpt-5",
      })
    );
  });

  it("upgrades validation execution to the full gate when execution tuning requires it", async () => {
    const deps = createDeps();
    const context = createContext(1);
    context.repo.scripts = {
      validateFast: "pnpm validate:fast",
      validate: "pnpm validate",
    };
    context.executionTuning = {
      summary: "Recent failures require the full validation gate.",
      reasons: ["validation_failed"],
      effectiveMaxFilesPerIteration: 2,
      validationCommandPreference: "full",
      publishPriority: "none",
      cautionLevel: "high",
    };
    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: createRun(),
    });

    const controllerWithInternals = controller as unknown as {
      defaultValidateIteration: (params: {
        deps: AutoDriveControllerDeps;
        iteration: number;
        run: AutoDriveRunRecord;
        context: AutoDriveContextSnapshot;
        proposal: AutoDriveRouteProposal;
        task: {
          taskId: string;
          status: "completed";
          title: string;
          steps: [];
          errorMessage: null;
        };
      }) => Promise<{
        ran: boolean;
        commands: string[];
        success: boolean | null;
        failures: string[];
        summary: string;
      }>;
    };

    const validation = await controllerWithInternals.defaultValidateIteration({
      deps,
      iteration: 1,
      run: createRun(),
      context,
      proposal: createProposal(1),
      task: {
        taskId: "task-validate",
        status: "completed",
        title: "Validate waypoint",
        steps: [],
        errorMessage: null,
      },
    });

    expect(deps.runLiveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "core-bash",
        input: "pnpm validate",
        options: expect.objectContaining({
          command: "pnpm validate",
        }),
      })
    );
    expect(validation.commands).toEqual(["pnpm validate"]);
  });

  it("restarts the session when execution tuning changes the desired reasoning effort", async () => {
    const deps = createDeps();
    vi.mocked(deps.spawnSubAgentSession)
      .mockResolvedValueOnce({
        sessionId: "session-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        title: "AutoDrive",
        status: "idle",
        accessMode: "on-request",
        reasonEffort: "medium",
        provider: null,
        modelId: "gpt-5",
        activeTaskId: null,
        lastTaskId: null,
        createdAt: 1,
        updatedAt: 1,
        closedAt: null,
        errorCode: null,
        errorMessage: null,
      })
      .mockResolvedValueOnce({
        sessionId: "session-2",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        title: "AutoDrive",
        status: "idle",
        accessMode: "on-request",
        reasonEffort: "high",
        provider: null,
        modelId: "gpt-5",
        activeTaskId: null,
        lastTaskId: null,
        createdAt: 2,
        updatedAt: 2,
        closedAt: null,
        errorCode: null,
        errorMessage: null,
      });
    vi.mocked(deps.waitSubAgentSession)
      .mockResolvedValueOnce({
        done: true,
        timedOut: false,
        session: {
          sessionId: "session-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          title: "AutoDrive",
          status: "idle",
          accessMode: "on-request",
          reasonEffort: "medium",
          provider: null,
          modelId: "gpt-5",
          activeTaskId: null,
          lastTaskId: "task-1",
          createdAt: 1,
          updatedAt: 2,
          closedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        task: {
          taskId: "task-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          requestId: "req-1",
          title: "Waypoint 1",
          status: "completed",
          accessMode: "on-request",
          provider: null,
          modelId: "gpt-5",
          routedProvider: null,
          routedModelId: null,
          routedPool: null,
          routedSource: null,
          currentStep: 1,
          createdAt: 1,
          updatedAt: 2,
          startedAt: 1,
          completedAt: 2,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [],
        },
      })
      .mockResolvedValueOnce({
        done: true,
        timedOut: false,
        session: {
          sessionId: "session-2",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          title: "AutoDrive",
          status: "idle",
          accessMode: "on-request",
          reasonEffort: "high",
          provider: null,
          modelId: "gpt-5",
          activeTaskId: null,
          lastTaskId: "task-2",
          createdAt: 2,
          updatedAt: 3,
          closedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        task: {
          taskId: "task-2",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          requestId: "req-2",
          title: "Waypoint 2",
          status: "completed",
          accessMode: "on-request",
          provider: null,
          modelId: "gpt-5",
          routedProvider: null,
          routedModelId: null,
          routedPool: null,
          routedSource: null,
          currentStep: 1,
          createdAt: 2,
          updatedAt: 3,
          startedAt: 2,
          completedAt: 3,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [],
        },
      });

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        execution: {
          accessMode: "on-request",
          modelId: "gpt-5",
          reasoningEffort: "medium",
        },
      },
      synthesizeContext: async ({ iteration }) => {
        const context = createContext(iteration);
        if (iteration === 2) {
          context.executionTuning = {
            summary: "Escalate reasoning after validation drift.",
            reasons: ["validation_failed"],
            effectiveMaxFilesPerIteration: 2,
            validationCommandPreference: "full",
            publishPriority: "none",
            cautionLevel: "high",
          };
        }
        return context;
      },
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "medium",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: `Waypoint ${iteration}`,
        summaryText: `Iteration ${iteration} advanced the route.`,
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: [`waypoint_${iteration}`],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: `Milestone ${iteration}`,
          currentWaypointTitle: `Waypoint ${iteration}`,
          completedWaypoints: iteration,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: iteration === 1 ? 50 : 100,
          remainingMilestones: iteration === 1 ? ["Validate the route"] : [],
          remainingBlockers: [],
          remainingDistance: iteration === 1 ? "One milestone remains." : "Destination reached.",
          arrivalConfidence: "medium",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: `Waypoint ${iteration}`,
          status: "arrived",
          arrivalCriteriaMet: ["Left behind a progress signal"],
          arrivalCriteriaMissed: [],
        },
        goalReached: iteration === 2,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: `Iteration ${iteration} complete`,
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async ({ iteration }) => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: iteration === 1 ? false : true,
        failures: iteration === 1 ? ["pnpm validate:fast"] : [],
        summary: iteration === 1 ? "validate:fast failed" : "validate:fast passed",
      }),
    });

    await controller.start();

    expect(deps.closeSubAgentSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sessionId: "session-1",
        reason: "execution_profile_refresh",
      })
    );
    expect(deps.spawnSubAgentSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reasonEffort: "high",
      })
    );
  });

  it("marks the run completed only when the destination is reached", async () => {
    const deps = createDeps();
    const writeRun = vi.fn().mockResolvedValue(undefined);
    const writeContext = vi.fn().mockResolvedValue(undefined);
    const writeProposal = vi.fn().mockResolvedValue(undefined);
    const writeSummary = vi.fn().mockResolvedValue(undefined);
    const writeReroute = vi.fn().mockResolvedValue(undefined);
    const writeFinalReport = vi.fn().mockResolvedValue(undefined);

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun,
        writeContext,
        writeProposal,
        writeSummary,
        writeReroute,
        writeFinalReport,
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 4,
          maxTokens: 12000,
        },
      },
      synthesizeContext: async ({ iteration }) => createContext(iteration),
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
      buildFinalReport: ({ run }) => `# Final Report\n\nRun ${run.runId} arrived.\n`,
    });

    const snapshot = await controller.start();

    expect(snapshot.status).toBe("completed");
    expect(snapshot.stage).toBe("completed");
    expect(snapshot.lastStopReason?.code).toBe("goal_reached");
    expect(snapshot.navigation.overallProgress).toBe(100);
    expect(writeContext).toHaveBeenCalledTimes(1);
    expect(writeProposal).toHaveBeenCalledTimes(1);
    expect(writeSummary).toHaveBeenCalledTimes(1);
    expect(writeFinalReport).toHaveBeenCalledTimes(1);
  });

  it("records a human-readable continuation reason before the final follow-up closes the run", async () => {
    const deps = createDeps();
    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async ({ iteration }) => createContext(iteration),
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: `Waypoint ${iteration}`,
        summaryText:
          iteration === 1
            ? "Goal reached, but validation has not run yet."
            : "Goal reached with verification complete.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: `Waypoint ${iteration}`,
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: iteration === 1 ? "medium" : "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: `Waypoint ${iteration}`,
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: iteration === 1 ? ["pnpm validate:fast"] : [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: iteration === 1 ? "Validation pending" : "Validation complete",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async ({ iteration }) => ({
        ran: iteration === 2,
        commands: ["pnpm validate:fast"],
        success: iteration === 2 ? true : null,
        failures: [],
        summary: iteration === 2 ? "validate:fast passed" : "Validation not run yet.",
      }),
    });

    const snapshot = await controller.start();

    expect(snapshot.status).toBe("completed");
    expect(snapshot.continuationState).toEqual(
      expect.objectContaining({
        automaticFollowUpCount: 1,
        status: "stopped",
        lastContinuationReason: "Validation is still pending for pnpm validate:fast.",
      })
    );
  });

  it("creates a branch-only commit candidate when the route reaches goal with publish-ready local changes", async () => {
    const deps = createDeps();
    const writeSummary = vi.fn().mockResolvedValue(undefined);
    const context = createContext(1);
    context.git.remote = null;
    context.git.upstream = null;
    context.publishReadiness = {
      allowed: false,
      recommendedMode: "branch_only",
      summary: "Ready for a local stage/commit milestone.",
      reasonCodes: ["dirty_working_tree"],
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary,
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(deps.stageGitAll).toHaveBeenCalledWith("workspace-1");
    expect(deps.commitGit).toHaveBeenCalledWith(
      "workspace-1",
      "feat: autodrive branch-only candidate"
    );
    expect(snapshot.latestPublishOutcome?.status).toBe("completed");
    expect(snapshot.latestPublishOutcome?.mode).toBe("branch_only");
    expect(snapshot.latestPublishOutcome?.branchName).toBeNull();
    expect(snapshot.latestPublishOutcome?.pushed).toBe(false);
    expect(deps.createGitBranch).not.toHaveBeenCalled();
    expect(deps.pushGit).not.toHaveBeenCalled();
    expect(writeSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: expect.objectContaining({
          status: "completed",
          commitMessage: "feat: autodrive branch-only candidate",
        }),
      })
    );
  });

  it("pushes a goal-reached publish candidate through an isolated branch and restores the original checkout", async () => {
    const deps = createDeps();
    const writeSummary = vi.fn().mockResolvedValue(undefined);
    const context = createContext(1);
    context.publishReadiness = {
      allowed: true,
      recommendedMode: "push_candidate",
      summary: "Validated changes can ship to an isolated branch.",
      reasonCodes: [],
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary,
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(deps.stageGitAll).not.toHaveBeenCalled();
    expect(deps.commitGit).not.toHaveBeenCalled();
    expect(deps.createGitBranch).toHaveBeenCalledWith("workspace-1", expectedPublishBranchName);
    expect(deps.checkoutGitBranch).toHaveBeenNthCalledWith(
      1,
      "workspace-1",
      expectedPublishBranchName
    );
    expect(deps.pushGit).toHaveBeenCalledWith("workspace-1");
    expect(deps.checkoutGitBranch).toHaveBeenNthCalledWith(2, "workspace-1", "feat/autodrive");
    expect(snapshot.latestPublishOutcome).toEqual(
      expect.objectContaining({
        mode: "push_candidate",
        status: "completed",
        pushed: true,
        commitMessage: null,
        branchName: expectedPublishBranchName,
      })
    );
    expect(writeSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: expect.objectContaining({
          mode: "push_candidate",
          branchName: expectedPublishBranchName,
          pushed: true,
        }),
      })
    );
  });

  it("falls back to a local branch-only candidate when publish history shows the corridor was remotely rejected", async () => {
    const deps = createDeps();
    const writeSummary = vi.fn().mockResolvedValue(undefined);
    const context = createContext(1);
    context.publishReadiness = {
      allowed: true,
      recommendedMode: "push_candidate",
      summary: "Validated changes can ship to an isolated branch.",
      reasonCodes: [],
    };
    context.publishHistory.latestFailureSummary =
      "Remote rejected the previous publish candidate because branch protection requires review.";

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary,
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(deps.stageGitAll).toHaveBeenCalledWith("workspace-1");
    expect(deps.commitGit).toHaveBeenCalledWith(
      "workspace-1",
      "feat: autodrive branch-only candidate"
    );
    expect(deps.createGitBranch).not.toHaveBeenCalled();
    expect(deps.checkoutGitBranch).not.toHaveBeenCalled();
    expect(deps.pushGit).not.toHaveBeenCalled();
    expect(snapshot.latestPublishOutcome).toEqual(
      expect.objectContaining({
        mode: "branch_only",
        status: "completed",
        pushed: false,
        branchName: null,
        commitMessage: "feat: autodrive branch-only candidate",
      })
    );
    expect(writeSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: expect.objectContaining({
          mode: "branch_only",
          pushed: false,
        }),
      })
    );
  });

  it("promotes a dirty-working-tree branch-only candidate into an isolated push after auto-commit", async () => {
    const deps = createDeps();
    const context = createContext(1);
    context.publishReadiness = {
      allowed: false,
      recommendedMode: "branch_only",
      summary: "Only the dirty working tree blocks an isolated publish candidate.",
      reasonCodes: ["dirty_working_tree"],
    };
    context.executionTuning = {
      ...context.executionTuning,
      summary: "The corridor is ready for an isolated push candidate.",
      reasons: ["branch_only_publish_ready", "publish_candidate_pushed"],
      publishPriority: "push_candidate",
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(deps.stageGitAll).toHaveBeenCalledWith("workspace-1");
    expect(deps.commitGit).toHaveBeenCalledWith(
      "workspace-1",
      "feat: autodrive branch-only candidate"
    );
    expect(deps.createGitBranch).toHaveBeenCalledWith("workspace-1", expectedPublishBranchName);
    expect(deps.pushGit).toHaveBeenCalledWith("workspace-1");
    expect(deps.checkoutGitBranch).toHaveBeenNthCalledWith(2, "workspace-1", "feat/autodrive");
    expect(snapshot.latestPublishOutcome).toEqual(
      expect.objectContaining({
        mode: "push_candidate",
        status: "completed",
        pushed: true,
        commitMessage: "feat: autodrive branch-only candidate",
        branchName: expectedPublishBranchName,
      })
    );
  });

  it("stops for review when a push candidate fails because the remote requires human intervention", async () => {
    const deps = createDeps();
    deps.pushGit = vi
      .fn()
      .mockRejectedValue(
        new Error("remote rejected: permission denied because review is required")
      );
    const writeFinalReport = vi.fn().mockResolvedValue(undefined);
    const context = createContext(1);
    context.publishReadiness = {
      allowed: true,
      recommendedMode: "push_candidate",
      summary: "Validated changes can ship to an isolated branch.",
      reasonCodes: [],
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport,
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(deps.createGitBranch).toHaveBeenCalledWith("workspace-1", expectedPublishBranchName);
    expect(deps.pushGit).toHaveBeenCalledWith("workspace-1");
    expect(snapshot.status).toBe("stopped");
    expect(snapshot.stage).toBe("stopped");
    expect(snapshot.lastStopReason).toEqual(
      expect.objectContaining({
        code: "unsafe_route_requires_review",
      })
    );
    expect(snapshot.latestPublishOutcome).toEqual(
      expect.objectContaining({
        mode: "push_candidate",
        status: "failed",
        pushed: false,
        branchName: expectedPublishBranchName,
        restoreBranch: "feat/autodrive",
        operatorActions: expect.arrayContaining([
          expect.stringContaining("branch policy"),
          expect.stringContaining(`git push origin ${expectedPublishBranchName}`),
        ]),
      })
    );
    expect(writeFinalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining("## Publish Recovery Actions"),
      })
    );
  });

  it("pauses for human input when a push candidate fails because credentials are missing", async () => {
    const deps = createDeps();
    deps.pushGit = vi
      .fn()
      .mockRejectedValue(new Error("authentication failed: missing credentials for remote"));
    const writeFinalReport = vi.fn().mockResolvedValue(undefined);
    const context = createContext(1);
    context.publishReadiness = {
      allowed: true,
      recommendedMode: "push_candidate",
      summary: "Validated changes can ship to an isolated branch.",
      reasonCodes: [],
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport,
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(deps.pushGit).toHaveBeenCalledWith("workspace-1");
    expect(snapshot.status).toBe("paused");
    expect(snapshot.stage).toBe("paused");
    expect(snapshot.lastStopReason).toEqual(
      expect.objectContaining({
        code: "missing_human_input",
      })
    );
    expect(snapshot.latestPublishOutcome).toEqual(
      expect.objectContaining({
        mode: "push_candidate",
        status: "failed",
        pushed: false,
        branchName: expectedPublishBranchName,
        restoreBranch: "feat/autodrive",
        operatorActions: expect.arrayContaining([
          expect.stringContaining("gh auth login"),
          expect.stringContaining(`git push origin ${expectedPublishBranchName}`),
        ]),
      })
    );
    expect(writeFinalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining("gh auth login"),
      })
    );
  });

  it("keeps goal-reached completion when a push candidate fails for a transient non-review error", async () => {
    const deps = createDeps();
    deps.pushGit = vi.fn().mockRejectedValue(new Error("network timeout"));
    const context = createContext(1);
    context.publishReadiness = {
      allowed: true,
      recommendedMode: "push_candidate",
      summary: "Validated changes can ship to an isolated branch.",
      reasonCodes: [],
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(snapshot.status).toBe("completed");
    expect(snapshot.stage).toBe("completed");
    expect(snapshot.lastStopReason).toEqual(
      expect.objectContaining({
        code: "goal_reached",
      })
    );
    expect(snapshot.latestPublishOutcome).toEqual(
      expect.objectContaining({
        mode: "push_candidate",
        status: "failed",
        pushed: false,
        branchName: expectedPublishBranchName,
        restoreBranch: "feat/autodrive",
        operatorActions: [],
      })
    );
  });

  it("keeps a branch-only publish candidate local while the publish corridor is still being prepared", async () => {
    const deps = createDeps();
    const context = createContext(1);
    context.publishReadiness = {
      allowed: false,
      recommendedMode: "branch_only",
      summary: "Only the dirty working tree blocks an isolated publish candidate.",
      reasonCodes: ["dirty_working_tree"],
    };
    context.executionTuning = {
      ...context.executionTuning,
      summary: "Prepare the publish corridor before attempting an isolated push.",
      reasons: ["branch_only_publish_ready"],
      publishPriority: "prepare_branch",
    };

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 3,
        },
      },
      synthesizeContext: async () => context,
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: "Validate and close the shortest safe route",
        summaryText: "Iteration 1 reached the requested destination.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: "Validate and close the shortest safe route",
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Destination reached.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Validate and close the shortest safe route",
          status: "arrived",
          arrivalCriteriaMet: ["Destination reached"],
          arrivalCriteriaMissed: [],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
    });

    const snapshot = await controller.start();

    expect(deps.stageGitAll).toHaveBeenCalledWith("workspace-1");
    expect(deps.commitGit).toHaveBeenCalledWith(
      "workspace-1",
      "feat: autodrive branch-only candidate"
    );
    expect(deps.createGitBranch).not.toHaveBeenCalled();
    expect(deps.pushGit).not.toHaveBeenCalled();
    expect(snapshot.latestPublishOutcome).toEqual(
      expect.objectContaining({
        mode: "branch_only",
        status: "completed",
        pushed: false,
        commitMessage: "feat: autodrive branch-only candidate",
        branchName: null,
      })
    );
  });

  it("honors an operator pause that lands during waypoint execution", async () => {
    const deps = createDeps();
    let waitResolverCaptured = false;
    let resolveWait: (value: SubAgentWaitResult) => void = () => {
      throw new Error("waitSubAgentSession resolver was not captured");
    };
    let executionStartedResolve: (() => void) | null = null;
    const executionStarted = new Promise<void>((resolve) => {
      executionStartedResolve = resolve;
    });
    deps.sendSubAgentInstruction = vi.fn().mockImplementation(async (request) => {
      executionStartedResolve?.();
      return {
        session: {
          sessionId: request.sessionId,
          workspaceId: "workspace-1",
          threadId: "thread-1",
          title: "AutoDrive",
          status: "idle",
          accessMode: "on-request",
          reasonEffort: "medium",
          provider: null,
          modelId: "gpt-5",
          activeTaskId: null,
          lastTaskId: null,
          createdAt: 1,
          updatedAt: 1,
          closedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        task: {
          taskId: "task-send",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          requestId: request.requestId ?? null,
          title: "AutoDrive",
          status: "running",
          accessMode: "on-request",
          provider: null,
          modelId: "gpt-5",
          routedProvider: null,
          routedModelId: null,
          routedPool: null,
          routedSource: null,
          currentStep: 0,
          createdAt: 1,
          updatedAt: 1,
          startedAt: 1,
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [],
        },
      };
    });
    deps.waitSubAgentSession = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          waitResolverCaptured = true;
          resolveWait = resolve;
        })
    );
    const writeRun = vi.fn().mockResolvedValue(undefined);
    const writeContext = vi.fn().mockResolvedValue(undefined);
    const writeProposal = vi.fn().mockResolvedValue(undefined);
    const writeSummary = vi.fn().mockResolvedValue(undefined);
    const writeReroute = vi.fn().mockResolvedValue(undefined);
    const writeFinalReport = vi.fn().mockResolvedValue(undefined);

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun,
        writeContext,
        writeProposal,
        writeSummary,
        writeReroute,
        writeFinalReport,
      },
      run: createRun(),
      synthesizeContext: async ({ iteration }) => createContext(iteration),
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "medium",
        shouldReroute: false,
        rerouteReason: null,
      }),
    });

    const startPromise = controller.start();
    await executionStarted;
    await controller.pause();
    if (!waitResolverCaptured) {
      throw new Error("Expected waitSubAgentSession resolver to be captured before pause");
    }
    resolveWait({
      done: true,
      timedOut: false,
      session: {
        sessionId: "session-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        title: "AutoDrive",
        status: "idle",
        accessMode: "on-request",
        reasonEffort: "medium",
        provider: null,
        modelId: "gpt-5",
        activeTaskId: null,
        lastTaskId: "task-1",
        createdAt: 1,
        updatedAt: 2,
        closedAt: null,
        errorCode: null,
        errorMessage: null,
      },
      task: {
        taskId: "task-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        requestId: "req-1",
        title: "Waypoint 1",
        status: "completed",
        accessMode: "on-request",
        provider: null,
        modelId: "gpt-5",
        routedProvider: null,
        routedModelId: null,
        routedPool: null,
        routedSource: null,
        currentStep: 1,
        createdAt: 1,
        updatedAt: 2,
        startedAt: 1,
        completedAt: 2,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        steps: [
          {
            index: 0,
            kind: "write",
            role: "coder",
            status: "completed",
            message: "Finished waypoint 1",
            runId: "run-1",
            output: "Outcome: waypoint 1 complete",
            metadata: {},
            startedAt: 1,
            updatedAt: 2,
            completedAt: 2,
            errorCode: null,
            errorMessage: null,
            approvalId: null,
          },
        ],
      },
    });

    const snapshot = await startPromise;

    expect(snapshot.status).toBe("paused");
    expect(snapshot.stage).toBe("paused");
    expect(snapshot.lastStopReason?.detail).toBe("AutoDrive was paused by the operator.");
    expect(writeSummary).not.toHaveBeenCalled();
    expect(deps.interruptSubAgentSession).toHaveBeenCalledTimes(1);
    expect(writeFinalReport).toHaveBeenCalledTimes(1);
  });

  it("honors a manual stop that lands during waypoint execution", async () => {
    const deps = createDeps();
    let waitResolverCaptured = false;
    let resolveWait: (value: SubAgentWaitResult) => void = () => {
      throw new Error("waitSubAgentSession resolver was not captured");
    };
    let executionStartedResolve: (() => void) | null = null;
    const executionStarted = new Promise<void>((resolve) => {
      executionStartedResolve = resolve;
    });
    deps.sendSubAgentInstruction = vi.fn().mockImplementation(async (request) => {
      executionStartedResolve?.();
      return {
        session: {
          sessionId: request.sessionId,
          workspaceId: "workspace-1",
          threadId: "thread-1",
          title: "AutoDrive",
          status: "idle",
          accessMode: "on-request",
          reasonEffort: "medium",
          provider: null,
          modelId: "gpt-5",
          activeTaskId: null,
          lastTaskId: null,
          createdAt: 1,
          updatedAt: 1,
          closedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        task: {
          taskId: "task-send",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          requestId: request.requestId ?? null,
          title: "AutoDrive",
          status: "running",
          accessMode: "on-request",
          provider: null,
          modelId: "gpt-5",
          routedProvider: null,
          routedModelId: null,
          routedPool: null,
          routedSource: null,
          currentStep: 0,
          createdAt: 1,
          updatedAt: 1,
          startedAt: 1,
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
          steps: [],
        },
      };
    });
    deps.waitSubAgentSession = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          waitResolverCaptured = true;
          resolveWait = resolve;
        })
    );
    const writeRun = vi.fn().mockResolvedValue(undefined);
    const writeContext = vi.fn().mockResolvedValue(undefined);
    const writeProposal = vi.fn().mockResolvedValue(undefined);
    const writeSummary = vi.fn().mockResolvedValue(undefined);
    const writeReroute = vi.fn().mockResolvedValue(undefined);
    const writeFinalReport = vi.fn().mockResolvedValue(undefined);

    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun,
        writeContext,
        writeProposal,
        writeSummary,
        writeReroute,
        writeFinalReport,
      },
      run: createRun(),
      synthesizeContext: async ({ iteration }) => createContext(iteration),
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "medium",
        shouldReroute: false,
        rerouteReason: null,
      }),
    });

    const startPromise = controller.start();
    await executionStarted;
    await controller.stop();
    if (!waitResolverCaptured) {
      throw new Error("Expected waitSubAgentSession resolver to be captured before stop");
    }
    resolveWait({
      done: true,
      timedOut: false,
      session: {
        sessionId: "session-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        title: "AutoDrive",
        status: "idle",
        accessMode: "on-request",
        reasonEffort: "medium",
        provider: null,
        modelId: "gpt-5",
        activeTaskId: null,
        lastTaskId: "task-1",
        createdAt: 1,
        updatedAt: 2,
        closedAt: null,
        errorCode: null,
        errorMessage: null,
      },
      task: {
        taskId: "task-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        requestId: "req-1",
        title: "Waypoint 1",
        status: "completed",
        accessMode: "on-request",
        provider: null,
        modelId: "gpt-5",
        routedProvider: null,
        routedModelId: null,
        routedPool: null,
        routedSource: null,
        currentStep: 1,
        createdAt: 1,
        updatedAt: 2,
        startedAt: 1,
        completedAt: 2,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        steps: [
          {
            index: 0,
            kind: "write",
            role: "coder",
            status: "completed",
            message: "Finished waypoint 1",
            runId: "run-1",
            output: "Outcome: waypoint 1 complete",
            metadata: {},
            startedAt: 1,
            updatedAt: 2,
            completedAt: 2,
            errorCode: null,
            errorMessage: null,
            approvalId: null,
          },
        ],
      },
    });

    const snapshot = await startPromise;

    expect(snapshot.status).toBe("stopped");
    expect(snapshot.stage).toBe("stopped");
    expect(snapshot.lastStopReason?.detail).toBe("The user stopped the AutoDrive run.");
    expect(writeSummary).not.toHaveBeenCalled();
    expect(deps.interruptSubAgentSession).toHaveBeenCalledTimes(1);
    expect(writeFinalReport).toHaveBeenCalledTimes(1);
  });

  it("prefers a browser-specific continuation reason when real-browser verification is still open", async () => {
    const deps = createDeps();
    const controller = new AutoDriveRunController({
      deps,
      ledger: {
        writeRun: vi.fn().mockResolvedValue(undefined),
        writeContext: vi.fn().mockResolvedValue(undefined),
        writeProposal: vi.fn().mockResolvedValue(undefined),
        writeSummary: vi.fn().mockResolvedValue(undefined),
        writeReroute: vi.fn().mockResolvedValue(undefined),
        writeFinalReport: vi.fn().mockResolvedValue(undefined),
      },
      run: {
        ...createRun(),
        budget: {
          ...createRun().budget,
          maxIterations: 2,
        },
        runtimeScenarioProfile: {
          authorityScope: "workspace_graph",
          authoritySources: ["repo_authority", "browser_runtime"],
          representativeCommands: [],
          componentCommands: [],
          endToEndCommands: [],
          samplePaths: [],
          heldOutGuidance: [],
          sourceSignals: ["browser_debug"],
          scenarioKeys: ["browser_repro_fix_verify"],
          safeBackground: false,
        },
      },
      synthesizeContext: async ({ iteration }) => createContext(iteration),
      buildProposal: ({ iteration }) => createProposal(iteration),
      reviewProposal: () => ({
        approved: true,
        issues: [],
        confidence: "high",
        shouldReroute: false,
        rerouteReason: null,
      }),
      summarizeIteration: async ({ iteration, task, validation }) => ({
        schemaVersion: "autodrive-summary/v2",
        runId: "run-123",
        iteration,
        status: "success",
        taskTitle: `Waypoint ${iteration}`,
        summaryText: "Validation is green, but browser evidence is still missing.",
        changedFiles: ["apps/code/src/features/review/components/ReviewPackSurface.tsx"],
        blockers: [],
        completedSubgoals: ["destination_reached"],
        unresolvedItems: [],
        suggestedNextAreas: [],
        validation,
        progress: {
          currentMilestone: "Validate the route and decide whether to arrive or reroute",
          currentWaypointTitle: `Waypoint ${iteration}`,
          completedWaypoints: 3,
          totalWaypoints: 3,
          waypointCompletion: 100,
          overallProgress: 100,
          remainingMilestones: [],
          remainingBlockers: [],
          remainingDistance: "Browser verification remains.",
          arrivalConfidence: "high",
          stopRisk: "low",
        },
        routeHealth: {
          offRoute: false,
          noProgressLoop: false,
          rerouteRecommended: false,
          rerouteReason: null,
          triggerSignals: [],
        },
        waypoint: {
          id: `waypoint-${iteration}`,
          title: "Verify browser evidence",
          status: "arrived",
          arrivalCriteriaMet: ["Validation passed"],
          arrivalCriteriaMissed: ["Confirm the target UI in the real browser."],
        },
        goalReached: true,
        task: {
          taskId: task.taskId,
          status: task.status,
          outputExcerpt: "Goal reached",
        },
        reroute: null,
        createdAt: iteration,
      }),
      validateIteration: async () => ({
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "validate:fast passed",
      }),
      decideNextStep: ({ run }) => ({
        action: (run.continuationState?.automaticFollowUpCount ?? 0) > 0 ? "stop" : "continue",
        reason: null,
        reroute: null,
      }),
      buildFinalReport: ({ run }) => `# Final Report\n\nRun ${run.runId} arrived.\n`,
    });

    const snapshot = await controller.start();

    expect(snapshot.continuationState?.lastContinuationReason).toBe(
      "Browser verification gap remains: Confirm the target UI in the real browser."
    );
  });
});
