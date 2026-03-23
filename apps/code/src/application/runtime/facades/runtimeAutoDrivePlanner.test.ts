import { describe, expect, it } from "vitest";
import { buildNextTaskProposal, reviewNextTaskProposal } from "./runtimeAutoDrivePlanner";
import type {
  AutoDriveContextSnapshot,
  AutoDriveIterationSummary,
  AutoDriveRunRecord,
} from "../types/autoDrive";

function createRun(): AutoDriveRunRecord {
  return {
    schemaVersion: "autodrive-run/v2",
    runId: "run-1",
    workspaceId: "workspace-1",
    workspacePath: "/repo",
    threadId: "thread-1",
    status: "running",
    stage: "planning_next_task",
    destination: {
      title: "Implement AutoDrive navigation in HugeCode",
      desiredEndState: ["UI shows route state", "Ledger records reroutes"],
      doneDefinition: {
        arrivalCriteria: [
          "Render route summary",
          "Show current waypoint",
          "Write ledger artifacts",
        ],
        requiredValidation: ["pnpm validate:fast"],
        waypointIndicators: ["Progress", "Waypoint Status"],
      },
      hardBoundaries: ["Keep the manual workflow intact"],
      routePreference: "validation_first",
    },
    budget: {
      maxTokens: 15000,
      maxIterations: 5,
      maxDurationMs: 900000,
      maxFilesPerIteration: 8,
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
      minimumConfidence: "medium",
    },
    iteration: 1,
    totals: {
      consumedTokensEstimate: 2100,
      elapsedMs: 20000,
      validationFailureCount: 0,
      noProgressCount: 0,
      repeatedFailureCount: 0,
      rerouteCount: 0,
    },
    blockers: [],
    completedSubgoals: ["context_baseline"],
    summaries: [],
    navigation: {
      destinationSummary: "Implement AutoDrive navigation in HugeCode",
      startStateSummary: "On branch feat/autodrive with a clean tree.",
      routeSummary: null,
      currentWaypointTitle: null,
      currentWaypointObjective: null,
      currentWaypointArrivalCriteria: [],
      remainingMilestones: [],
      currentMilestone: null,
      overallProgress: 20,
      waypointCompletion: 0,
      offRoute: false,
      rerouting: false,
      rerouteReason: null,
      remainingBlockers: [],
      arrivalConfidence: "medium",
      stopRisk: "low",
      remainingTokens: 12900,
      remainingIterations: 4,
      remainingDurationMs: 880000,
      lastDecision: null,
    },
    createdAt: 1,
    updatedAt: 1,
    startedAt: 1,
    completedAt: null,
    lastStopReason: null,
    sessionId: "session-1",
    lastValidationSummary: null,
    currentBlocker: null,
    latestReroute: null,
  };
}

function createPreviousSummary(
  overrides: Partial<AutoDriveIterationSummary> = {}
): AutoDriveIterationSummary {
  return {
    schemaVersion: "autodrive-summary/v2",
    runId: "run-1",
    iteration: 1,
    status: "success",
    taskTitle: "Map the route baseline",
    summaryText: "Mapped the initial route and identified the next waypoint.",
    changedFiles: [],
    blockers: [],
    completedSubgoals: ["context_baseline"],
    unresolvedItems: ["Implement the first UI slice"],
    suggestedNextAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
    validation: {
      ran: false,
      commands: [],
      success: null,
      failures: [],
      summary: "No validation yet.",
    },
    progress: {
      currentMilestone: "Map the current start state and hard boundaries",
      currentWaypointTitle: "Establish the route baseline",
      completedWaypoints: 1,
      totalWaypoints: 3,
      waypointCompletion: 100,
      overallProgress: 33,
      remainingMilestones: ["Advance the current waypoint", "Validate the route"],
      remainingBlockers: [],
      remainingDistance: "Two milestones remain before arrival.",
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
      id: "waypoint-1",
      title: "Establish the route baseline",
      status: "arrived",
      arrivalCriteriaMet: ["Summarized start state"],
      arrivalCriteriaMissed: [],
    },
    goalReached: false,
    task: {
      taskId: "task-1",
      status: "completed",
      outputExcerpt: "Mapped the route.",
    },
    reroute: null,
    createdAt: 2,
    ...overrides,
  };
}

function createContext(previousSummary: AutoDriveIterationSummary): AutoDriveContextSnapshot {
  return {
    schemaVersion: "autodrive-context/v2",
    runId: "run-1",
    iteration: 2,
    destination: createRun().destination,
    startState: {
      summary: "Branch feat/autodrive with room for one implementation waypoint before validation.",
      repo: {
        branch: "feat/autodrive",
        dirtyWorkingTree: false,
        recentCommits: ["tighten runtime boundary rules"],
        touchedAreas: ["apps/code/src/features/composer", "apps/code/src/application/runtime"],
        changedPaths: [],
        unresolvedBlockers: [],
      },
      task: {
        completedSubgoals: ["context_baseline"],
        pendingMilestones: ["Advance the current waypoint", "Validate the route"],
        confidence: "medium",
        risk: "low",
        currentBlocker: null,
      },
      system: {
        consumedTokensEstimate: 2100,
        remainingTokensEstimate: 12900,
        iterationsUsed: 1,
        remainingIterations: 4,
        elapsedMs: 20000,
        remainingDurationMs: 880000,
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
      workspaceMarkers: ["pnpm-workspace.yaml", "turbo.json"],
      scripts: {
        validateFast: "pnpm validate:fast",
        validate: "pnpm validate",
      },
      ruleEvidence: [
        {
          path: "AGENTS.md",
          summary: "Runtime boundary changes must go through apps/code/src/application/runtime/*.",
        },
      ],
      relevantDocs: [
        {
          path: "docs/development/README.md",
          summary: "Use canonical validation entrypoints.",
        },
      ],
      relevantFiles: [
        "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
        "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
      ],
    },
    git: {
      branch: "feat/autodrive",
      remote: "origin",
      upstream: "origin/main",
      ahead: 1,
      behind: 0,
      recentCommits: [
        {
          sha: "sha-1",
          summary: "tighten runtime boundary rules",
          author: "han",
          timestamp: 1,
          touchedPaths: ["AGENTS.md"],
        },
      ],
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
      recentDirection: "Tighten runtime boundaries while refining composer-facing surfaces.",
      touchedAreas: ["apps/code/src/features/composer", "apps/code/src/application/runtime"],
      boundarySignals: [
        {
          path: "AGENTS.md",
          summary: "Do not add new wide runtime ports.",
        },
      ],
      probableIntent:
        "Current mainline work is converging on narrower runtime facades and clearer composer controls.",
      conflictRisk: "medium",
      confidence: "medium",
    },
    intent: {
      summary:
        "Prioritize the AutoDrive navigation slice while staying aligned with runtime-boundary work.",
      signals: [
        {
          kind: "operator_intent",
          summary: "Operator wants AutoDrive navigation implemented in HugeCode.",
          source: "destination",
          confidence: "high",
        },
        {
          kind: "collaborator_intent",
          summary:
            "Current mainline work is converging on narrower runtime facades and clearer composer controls.",
          source: null,
          confidence: "medium",
        },
      ],
      directionHypotheses: [
        {
          summary: "Advance the composer AutoDrive navigation slice first.",
          rationale:
            "Destination scope and collaborator signals both center on composer navigation with runtime-boundary discipline.",
          suggestedAreas: [
            "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
            "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
          ],
          confidence: "medium",
          dominantSignalKinds: ["operator_intent", "collaborator_intent"],
        },
      ],
    },
    opportunities: {
      selectedCandidateId: "advance_primary_surface",
      candidates: [
        {
          id: "advance_primary_surface",
          title: "Advance the primary AutoDrive surface",
          summary:
            "Use the strongest direction hypothesis to advance the composer navigation slice.",
          rationale:
            "Destination scope and collaborator signals both point at the composer AutoDrive entrypoint.",
          repoAreas: [
            "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
            "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
          ],
          score: 90,
          confidence: "medium",
          risk: "low",
        },
      ],
    },
    executionTuning: {
      summary: "No adaptive feedback adjustments are active.",
      reasons: [],
      effectiveMaxFilesPerIteration: 8,
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
    publishHistory: {
      bestCorridor: null,
      latestFailureSummary: null,
    },
    repoBacklog: {
      openIssues: null,
      openPullRequests: null,
      highlights: [],
    },
    threadContext: null,
    previousSummary,
    blockers: [],
    completedSubgoals: ["context_baseline"],
    externalResearch: [],
    synthesizedAt: 3,
  };
}

describe("runtimeAutoDrivePlanner", () => {
  it("builds a route proposal with milestones and a current waypoint", () => {
    const previousSummary = createPreviousSummary();
    const context = createContext(previousSummary);
    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });

    expect(proposal.routeSummary).toContain("Navigate toward");
    expect(proposal.currentWaypoint.title).toContain("Advance");
    expect(proposal.currentWaypoint.validationPlan).toContain("pnpm validate:fast");
    expect(proposal.remainingMilestones.length).toBeGreaterThan(0);
    expect(proposal.promptText).toContain("Destination:");
    expect(proposal.promptText).toContain("Intent summary:");
    expect(proposal.promptText).toContain("Direction hypothesis:");
    expect(proposal.promptText).toContain("Selected opportunity:");
    expect(proposal.promptText).toContain("Opportunity decision:");
    expect(proposal.promptText).toContain("Opportunity score breakdown:");
    expect(proposal.promptText).toContain("Publish readiness:");
    expect(proposal.currentWaypoint.repoAreas[0]).toBe(
      "apps/code/src/features/composer/components/ComposerMetaBar.tsx"
    );
    expect(proposal.routeSelectionReason).toContain("Selected opportunity:");
  });

  it("flags the route for reroute when start-state health says the run is off-route", () => {
    const previousSummary = createPreviousSummary({
      routeHealth: {
        offRoute: true,
        noProgressLoop: true,
        rerouteRecommended: true,
        rerouteReason: "Validation drifted from the planned waypoint.",
        triggerSignals: ["Validation failed"],
      },
    });
    const context = createContext(previousSummary);
    context.startState.routeHealth = previousSummary.routeHealth;
    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });
    const review = reviewNextTaskProposal({
      proposal,
      context,
      run: createRun(),
    });

    expect(proposal.currentWaypoint.title).toContain("Reroute");
    expect(review.shouldReroute).toBe(false);
    expect(review.confidence).toBe("low");
  });

  it("shrinks the waypoint and upgrades validation when adaptive tuning detects validation failure", () => {
    const previousSummary = createPreviousSummary({
      status: "failed",
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: false,
        failures: ["pnpm validate:fast"],
        summary: "Validation failed on the previous waypoint.",
      },
    });
    const context = createContext(previousSummary);
    context.executionTuning = {
      summary: "Recent validation failed; narrow scope and use the stronger validation gate.",
      reasons: ["validation_failed"],
      effectiveMaxFilesPerIteration: 2,
      validationCommandPreference: "full",
      publishPriority: "none",
      cautionLevel: "high",
    };
    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });

    expect(proposal.currentWaypoint.repoAreas.length).toBeLessThanOrEqual(2);
    expect(proposal.currentWaypoint.validationPlan).toContain("pnpm validate");
    expect(proposal.promptText).toContain("Execution tuning:");
  });

  it("builds a focused continuation waypoint when the previous summary reached the goal but left verification gaps", () => {
    const previousSummary = createPreviousSummary({
      goalReached: true,
      validation: {
        ran: false,
        commands: ["pnpm validate:fast"],
        success: null,
        failures: [],
        summary: "Validation not run yet.",
      },
      blockers: ["Need to confirm the final validation lane."],
      unresolvedItems: ["Re-run the narrow validation lane before shipping."],
      waypoint: {
        id: "waypoint-1",
        title: "Validate the current route",
        status: "arrived",
        arrivalCriteriaMet: ["Implemented the target slice"],
        arrivalCriteriaMissed: ["pnpm validate:fast"],
      },
    });
    const context = createContext(previousSummary);
    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });

    expect(proposal.currentWaypoint.title).toContain("verification gap");
    expect(proposal.currentWaypoint.arrivalCriteria).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Run the required validation lane"),
        expect.stringContaining("Satisfy the missed arrival criterion"),
        expect.stringContaining("Resolve the active blocker"),
      ])
    );
    expect(proposal.promptText).toContain("Continuation focus:");
    expect(proposal.promptText).toContain("Latest verification gap:");
    expect(proposal.promptText).toContain("Execution rule:");
  });

  it("switches to a browser verification loop when the runtime scenario requires real-browser evidence", () => {
    const previousSummary = createPreviousSummary({
      goalReached: true,
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "Validation passed but browser verification still needs evidence.",
      },
      waypoint: {
        id: "waypoint-browser",
        title: "Verify the browser path",
        status: "arrived",
        arrivalCriteriaMet: ["Target code path updated"],
        arrivalCriteriaMissed: ["Confirm the target UI in the real browser."],
      },
    });
    const context = createContext(previousSummary);
    context.repo.evaluation = {
      representativeCommands: context.repo.evaluation?.representativeCommands ?? [
        "pnpm validate:fast",
      ],
      componentCommands: context.repo.evaluation?.componentCommands ?? [],
      endToEndCommands: context.repo.evaluation?.endToEndCommands ?? [],
      samplePaths: context.repo.evaluation?.samplePaths ?? [],
      heldOutGuidance: context.repo.evaluation?.heldOutGuidance ?? [],
      sourceSignals: context.repo.evaluation?.sourceSignals ?? [],
      scenarioKeys: ["browser_repro_fix_verify"],
    };
    const proposal = buildNextTaskProposal({
      run: {
        ...createRun(),
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
      context,
      previousSummary,
    });

    expect(proposal.currentWaypoint.title).toContain("browser verification gap");
    expect(proposal.currentWaypoint.arrivalCriteria).toEqual(
      expect.arrayContaining([
        expect.stringContaining("real browser"),
        expect.stringContaining("browser evidence"),
      ])
    );
    expect(proposal.promptText).toContain("Browser scenario: browser_repro_fix_verify");
    expect(proposal.promptText).toContain("Browser execution rule:");
  });

  it("biases route selection toward publish preparation when adaptive tuning requests it", () => {
    const previousSummary = createPreviousSummary();
    const context = createContext(previousSummary);
    context.opportunities = {
      selectedCandidateId: "prepare_publish_corridor",
      candidates: [
        {
          id: "prepare_publish_corridor",
          title: "Prepare the publish corridor",
          summary: "Stabilize the working tree and handoff artifacts for the next push candidate.",
          rationale: "A branch-only publish candidate already exists and should be advanced.",
          repoAreas: [
            ".hugecode/runs/run-1/publish",
            "apps/code/src/application/runtime/facades/runtimeAutoDriveLedger.ts",
          ],
          score: 91,
          confidence: "medium",
          risk: "low",
        },
      ],
    };
    context.executionTuning = {
      summary: "A branch-only publish candidate exists; favor corridor preparation over new scope.",
      reasons: ["branch_only_publish_ready"],
      effectiveMaxFilesPerIteration: 3,
      validationCommandPreference: "fast",
      publishPriority: "prepare_branch",
      cautionLevel: "elevated",
    };
    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });

    expect(proposal.routeSelectionReason).toContain("prepare_publish_corridor");
    expect(proposal.currentWaypoint.repoAreas[0]).toContain(".hugecode/runs/run-1/publish");
    expect(proposal.promptText).toContain("prepare_branch");
  });

  it("reuses historical publish corridor files and validation when pushing a publish candidate", () => {
    const previousSummary = createPreviousSummary();
    const context = createContext(previousSummary);
    context.opportunities = {
      selectedCandidateId: "push_publish_candidate",
      candidates: [
        {
          id: "push_publish_candidate",
          title: "Push the publish candidate",
          summary:
            "The publish corridor looks stable enough to advance the isolated candidate branch.",
          rationale: "Reuse the historical publish corridor.",
          repoAreas: [".hugecode/runs/run-1/publish"],
          score: 95,
          confidence: "high",
          risk: "low",
        },
      ],
    };
    context.executionTuning = {
      summary: "A matching historical publish corridor is ready for reuse.",
      reasons: ["historical_publish_corridor"],
      effectiveMaxFilesPerIteration: 4,
      validationCommandPreference: "fast",
      publishPriority: "push_candidate",
      cautionLevel: "elevated",
    };
    context.publishHistory = {
      bestCorridor: {
        runId: "run-prev",
        destinationTitle: "Implement AutoDrive navigation in HugeCode",
        summaryText: "Published the runtime AutoDrive corridor successfully.",
        changedFiles: [
          "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
          "apps/code/src/application/runtime/facades/runtimeAutoDriveContext.ts",
        ],
        validationCommands: ["pnpm validate"],
        validationSummary: "Validation passed before publish.",
        createdAt: 5,
        matchScore: 1,
      },
      latestFailureSummary: null,
    };

    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });

    expect(proposal.currentWaypoint.repoAreas).toContain(
      "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"
    );
    expect(proposal.currentWaypoint.validationPlan).toEqual(["pnpm validate:fast"]);
    expect(proposal.routeSelectionReason).toContain("Historical publish corridor:");
  });

  it("surfaces historical publish caution in the generated prompt", () => {
    const previousSummary = createPreviousSummary();
    const context = createContext(previousSummary);
    context.publishHistory = {
      bestCorridor: null,
      latestFailureSummary: "Push candidate failed: branch protection rejected the publish lane.",
    };

    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });

    expect(proposal.routeSelectionReason).toContain("Historical publish caution:");
  });

  it("uses representative evaluation lanes and held-out guidance when the repo advertises them", () => {
    const previousSummary = createPreviousSummary({
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: false,
        failures: ["pnpm validate:fast"],
        summary: "Validation drifted on the previous waypoint.",
      },
    });
    const context = createContext(previousSummary);
    (
      context.repo as {
        evaluation?: Record<string, unknown>;
      }
    ).evaluation = {
      representativeCommands: ["pnpm test", "pnpm validate:fast"],
      componentCommands: ["pnpm test:component"],
      endToEndCommands: ["pnpm test:e2e:smoke"],
      samplePaths: [".codex/e2e-map.json", "fixtures/autodrive"],
      heldOutGuidance: ["Keep one held-out AutoDrive fixture unchanged for drift detection."],
      sourceSignals: ["test_command", "e2e_map"],
      scenarioKeys: ["default", "smoke"],
    };

    const proposal = buildNextTaskProposal({
      run: createRun(),
      context,
      previousSummary,
    });

    expect(proposal.currentWaypoint.validationPlan).toEqual(["pnpm test", "pnpm validate:fast"]);
    expect(
      (
        proposal.currentWaypoint as {
          heldOutGuidance?: string[];
        }
      ).heldOutGuidance
    ).toContain("Keep one held-out AutoDrive fixture unchanged for drift detection.");
    expect(proposal.promptText).toContain("Evaluation strategy:");
    expect(proposal.promptText).toContain(".codex/e2e-map.json");
    expect(proposal.promptText).toContain("held-out AutoDrive fixture");
  });
});
