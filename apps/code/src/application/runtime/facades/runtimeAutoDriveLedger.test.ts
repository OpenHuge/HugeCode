import { describe, expect, it, vi } from "vitest";
import { createAutoDriveLedger } from "./runtimeAutoDriveLedger";
import type {
  AutoDriveContextSnapshot,
  AutoDriveIterationSummary,
  AutoDriveRouteProposal,
  AutoDriveRunRecord,
} from "../types/autoDrive";

describe("runtimeAutoDriveLedger", () => {
  it("writes run, context, proposal, summary, reroute and final report artifacts into the run journal", async () => {
    const writeArtifact = vi.fn().mockResolvedValue(undefined);
    const ledger = createAutoDriveLedger({
      writeArtifact,
      readArtifact: vi.fn(),
    });

    const run: AutoDriveRunRecord = {
      schemaVersion: "autodrive-run/v2",
      runId: "run-123",
      workspaceId: "workspace-1",
      workspacePath: "/repo",
      threadId: "thread-1",
      status: "completed",
      stage: "completed",
      destination: {
        title: "Ship AutoDrive navigation",
        desiredEndState: ["UI shows route state"],
        doneDefinition: {
          arrivalCriteria: ["Render route summary"],
          requiredValidation: ["pnpm validate:fast"],
          waypointIndicators: ["Progress"],
        },
        hardBoundaries: [],
        routePreference: "validation_first",
      },
      budget: {
        maxTokens: 10000,
        maxIterations: 4,
        maxDurationMs: 100000,
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
      iteration: 2,
      totals: {
        consumedTokensEstimate: 3000,
        elapsedMs: 12345,
        validationFailureCount: 0,
        noProgressCount: 0,
        repeatedFailureCount: 0,
        rerouteCount: 1,
      },
      blockers: [],
      completedSubgoals: ["context_baseline", "ui_slice"],
      summaries: [],
      navigation: {
        destinationSummary: "Ship AutoDrive navigation",
        startStateSummary: "Branch feat/autodrive",
        routeSummary: "baseline -> implement -> validate",
        currentWaypointTitle: "Validate the route",
        currentWaypointObjective: "Validate the current route.",
        currentWaypointArrivalCriteria: [],
        remainingMilestones: [],
        currentMilestone: "Validate the route",
        overallProgress: 100,
        waypointCompletion: 100,
        offRoute: false,
        rerouting: false,
        rerouteReason: null,
        remainingBlockers: [],
        arrivalConfidence: "high",
        stopRisk: "low",
        remainingTokens: 7000,
        remainingIterations: 0,
        remainingDurationMs: 0,
        lastDecision: "goal_reached",
      },
      createdAt: 1,
      updatedAt: 2,
      startedAt: 1,
      completedAt: 2,
      lastStopReason: { code: "goal_reached", detail: "Completed requested scope." },
      sessionId: "session-1",
      lastValidationSummary: "All checks passed.",
      currentBlocker: null,
      latestReroute: {
        iteration: 2,
        mode: "soft",
        reason: "Validation drifted.",
        trigger: "Validation failed",
        previousRouteSummary: "baseline -> implement -> validate",
        nextRouteSummary: "repair -> validate",
        createdAt: 2,
      },
      latestPublishOutcome: {
        mode: "push_candidate",
        status: "completed",
        summary:
          "Pushed isolated publish candidate branch autodrive/ship-route-202603150930-run123.",
        commitMessage: "feat(autodrive): ship route",
        branchName: "autodrive/ship-route-202603150930-run123",
        pushed: true,
        createdAt: 2,
      },
    };
    const context: AutoDriveContextSnapshot = {
      schemaVersion: "autodrive-context/v2",
      runId: "run-123",
      iteration: 2,
      destination: run.destination,
      startState: {
        summary: "Branch feat/autodrive",
        repo: {
          branch: "feat/autodrive",
          dirtyWorkingTree: false,
          recentCommits: [],
          touchedAreas: [],
          changedPaths: [],
          unresolvedBlockers: [],
        },
        task: {
          completedSubgoals: [],
          pendingMilestones: [],
          confidence: "medium",
          risk: "low",
          currentBlocker: null,
        },
        system: {
          consumedTokensEstimate: 3000,
          remainingTokensEstimate: 7000,
          iterationsUsed: 2,
          remainingIterations: 0,
          elapsedMs: 12345,
          remainingDurationMs: 0,
          validationFailureCount: 0,
          noProgressCount: 0,
          repeatedFailureCount: 0,
          rerouteCount: 1,
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
        relevantFiles: [],
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
        recentDirection: "Build AutoDrive",
        touchedAreas: [],
        boundarySignals: [],
        probableIntent: "Keep runtime boundaries explicit.",
        conflictRisk: "low",
        confidence: "low",
      },
      intent: {
        summary: "Prioritize the requested AutoDrive validation slice.",
        signals: [
          {
            kind: "operator_intent",
            summary: "Operator wants the AutoDrive validation slice completed.",
            source: "destination",
            confidence: "high",
          },
        ],
        directionHypotheses: [
          {
            summary: "Validate the current AutoDrive slice before broadening scope.",
            rationale: "The run is already at the validation milestone with no blocker signal.",
            suggestedAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
            confidence: "medium",
            dominantSignalKinds: ["operator_intent"],
          },
        ],
      },
      opportunities: {
        selectedCandidateId: "tighten_validation_loop",
        candidates: [
          {
            id: "tighten_validation_loop",
            title: "Tighten the validation loop",
            summary: "Favor validation before any broader implementation expansion.",
            rationale: "The run is already at the validation milestone with no blocker signal.",
            repoAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
            score: 88,
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
      threadContext: null,
      previousSummary: null,
      blockers: [],
      completedSubgoals: [],
      externalResearch: [],
      synthesizedAt: 2,
    };
    const proposal: AutoDriveRouteProposal = {
      schemaVersion: "autodrive-route-proposal/v2",
      runId: "run-123",
      iteration: 2,
      routeSummary: "baseline -> implement -> validate",
      routeSelectionReason: "Implementation is complete.",
      whyThisWaypointNow: "Implementation is complete.",
      evidence: [],
      evidenceSummary: "Need to validate the current slice.",
      collaboratorIntentSummary: "No conflict signs detected.",
      milestones: [],
      currentWaypoint: {
        id: "waypoint-2",
        title: "Validate AutoDrive",
        objective: "Run the smallest validation slice.",
        whyNow: "Implementation is complete.",
        repoAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
        commandsToRun: ["pnpm validate:fast"],
        validationPlan: ["pnpm validate:fast"],
        samplePaths: [],
        heldOutGuidance: [],
        scenarioKeys: [],
        arrivalCriteria: ["pnpm validate:fast"],
        stopIf: ["validation fails"],
        rerouteTriggers: ["validation fails"],
        expectedOutput: ["Updated validation summary"],
        estimatedCost: {
          tokens: 400,
          iterations: 1,
          durationMs: 1000,
          risk: "low",
        },
        confidence: "medium",
      },
      remainingMilestones: [],
      routeConfidence: "medium",
      promptText: "Validate the current slice and report results.",
    };
    const summary: AutoDriveIterationSummary = {
      schemaVersion: "autodrive-summary/v2",
      runId: "run-123",
      iteration: 2,
      status: "success",
      taskTitle: "Validate AutoDrive",
      summaryText: "Validation passed.",
      changedFiles: [],
      blockers: [],
      completedSubgoals: ["validation_passed"],
      unresolvedItems: [],
      suggestedNextAreas: [],
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "All checks passed.",
      },
      progress: {
        currentMilestone: "Validate the route",
        currentWaypointTitle: "Validate AutoDrive",
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
        id: "waypoint-2",
        title: "Validate AutoDrive",
        status: "arrived",
        arrivalCriteriaMet: ["pnpm validate:fast"],
        arrivalCriteriaMissed: [],
      },
      goalReached: true,
      task: {
        taskId: "task-2",
        status: "completed",
        outputExcerpt: "Validation passed.",
      },
      reroute: run.latestReroute,
      createdAt: 2,
    };

    await ledger.writeRun(run);
    await ledger.writeContext(context);
    await ledger.writeProposal(proposal);
    await ledger.writeSummary(summary);
    await ledger.writeReroute({
      runId: run.runId,
      iteration: 2,
      reroute: run.latestReroute!,
    });
    await ledger.writeFinalReport({
      run,
      latestSummary: summary,
      markdown: "# AutoDrive Report\n\nCompleted successfully.\n",
    });

    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/run.json",
      expect.any(String)
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/context/2.json",
      expect.any(String)
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/next-task/2.json",
      expect.any(String)
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/summary/2.json",
      expect.any(String)
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/reroute/2.json",
      expect.any(String)
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/final-report.md",
      expect.stringContaining("## Publish Handoff")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/final-report.md",
      expect.stringContaining("autodrive/ship-route-202603150930-run123")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/publish/handoff.json",
      expect.any(String)
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/publish/handoff.md",
      expect.stringContaining("# AutoDrive Publish Handoff")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/publish/pr-body.md",
      expect.stringContaining("## Summary")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-123/publish/pr-create.sh",
      expect.stringContaining("gh pr create")
    );
  });

  it("keeps the final report unchanged when no successful push handoff exists", async () => {
    const writeArtifact = vi.fn().mockResolvedValue(undefined);
    const ledger = createAutoDriveLedger({
      writeArtifact,
      readArtifact: vi.fn(),
    });

    const run = {
      schemaVersion: "autodrive-run/v2",
      runId: "run-456",
      workspaceId: "workspace-1",
      workspacePath: "/repo",
      threadId: "thread-1",
      status: "completed",
      stage: "completed",
      destination: {
        title: "Local candidate only",
        desiredEndState: [],
        doneDefinition: {
          arrivalCriteria: [],
          requiredValidation: [],
          waypointIndicators: [],
        },
        hardBoundaries: [],
        routePreference: "validation_first",
      },
      budget: {
        maxTokens: 1000,
        maxIterations: 1,
        maxDurationMs: null,
        maxFilesPerIteration: null,
        maxNoProgressIterations: 1,
        maxValidationFailures: 1,
        maxReroutes: 1,
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
        consumedTokensEstimate: 100,
        elapsedMs: 10,
        validationFailureCount: 0,
        noProgressCount: 0,
        repeatedFailureCount: 0,
        rerouteCount: 0,
      },
      blockers: [],
      completedSubgoals: [],
      summaries: [],
      navigation: {
        destinationSummary: "Local candidate only",
        startStateSummary: null,
        routeSummary: null,
        currentWaypointTitle: null,
        currentWaypointObjective: null,
        currentWaypointArrivalCriteria: [],
        remainingMilestones: [],
        currentMilestone: null,
        overallProgress: 100,
        waypointCompletion: 100,
        offRoute: false,
        rerouting: false,
        rerouteReason: null,
        remainingBlockers: [],
        arrivalConfidence: "high",
        stopRisk: "low",
        remainingTokens: 900,
        remainingIterations: 0,
        remainingDurationMs: null,
        lastDecision: "goal_reached",
      },
      createdAt: 1,
      updatedAt: 2,
      startedAt: 1,
      completedAt: 2,
      lastStopReason: { code: "goal_reached", detail: "done" },
      sessionId: null,
      latestPublishOutcome: {
        mode: "branch_only",
        status: "completed",
        summary: "Created local commit candidate.",
        commitMessage: "feat(autodrive): local candidate",
        branchName: null,
        pushed: false,
        createdAt: 2,
      },
    } satisfies AutoDriveRunRecord;

    const summary = {
      schemaVersion: "autodrive-summary/v2",
      runId: "run-456",
      iteration: 1,
      status: "success",
      taskTitle: "Complete local candidate",
      summaryText: "done",
      changedFiles: [],
      blockers: [],
      completedSubgoals: [],
      unresolvedItems: [],
      suggestedNextAreas: [],
      validation: {
        ran: true,
        commands: [],
        success: true,
        failures: [],
        summary: "ok",
      },
      progress: {
        currentMilestone: "done",
        currentWaypointTitle: "done",
        completedWaypoints: 1,
        totalWaypoints: 1,
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
        id: "done",
        title: "done",
        status: "arrived",
        arrivalCriteriaMet: [],
        arrivalCriteriaMissed: [],
      },
      goalReached: true,
      task: {
        taskId: "task-1",
        status: "completed",
        outputExcerpt: "done",
      },
      reroute: null,
      createdAt: 2,
    } satisfies AutoDriveIterationSummary;

    await ledger.writeFinalReport({
      run,
      latestSummary: summary,
      markdown: "# AutoDrive Report\n\nCompleted successfully.\n",
    });

    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-456/final-report.md",
      "# AutoDrive Report\n\nCompleted successfully.\n"
    );
    expect(writeArtifact).not.toHaveBeenCalledWith(
      ".hugecode/runs/run-456/publish/handoff.json",
      expect.any(String)
    );
    expect(writeArtifact).not.toHaveBeenCalledWith(
      ".hugecode/runs/run-456/publish/pr-create.sh",
      expect.any(String)
    );
  });

  it("writes publish recovery artifacts when a failed push candidate includes operator actions", async () => {
    const writeArtifact = vi.fn().mockResolvedValue(undefined);
    const ledger = createAutoDriveLedger({
      writeArtifact,
      readArtifact: vi.fn(),
    });

    const run = {
      schemaVersion: "autodrive-run/v2",
      runId: "run-789",
      workspaceId: "workspace-1",
      workspacePath: "/repo",
      threadId: "thread-1",
      status: "paused",
      stage: "paused",
      destination: {
        title: "Recover failed publish candidate",
        desiredEndState: ["Operator receives concrete recovery steps"],
        doneDefinition: {
          arrivalCriteria: ["Recovery guidance is written"],
          requiredValidation: ["pnpm validate:fast"],
          waypointIndicators: ["publish recovery artifact"],
        },
        hardBoundaries: [],
        routePreference: "validation_first",
      },
      budget: {
        maxTokens: 1000,
        maxIterations: 1,
        maxDurationMs: null,
        maxFilesPerIteration: null,
        maxNoProgressIterations: 1,
        maxValidationFailures: 1,
        maxReroutes: 1,
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
        consumedTokensEstimate: 100,
        elapsedMs: 10,
        validationFailureCount: 0,
        noProgressCount: 0,
        repeatedFailureCount: 0,
        rerouteCount: 0,
      },
      blockers: [],
      completedSubgoals: [],
      summaries: [],
      navigation: {
        destinationSummary: "Recover failed publish candidate",
        startStateSummary: null,
        routeSummary: null,
        currentWaypointTitle: null,
        currentWaypointObjective: null,
        currentWaypointArrivalCriteria: [],
        remainingMilestones: [],
        currentMilestone: null,
        overallProgress: 100,
        waypointCompletion: 100,
        offRoute: false,
        rerouting: false,
        rerouteReason: null,
        remainingBlockers: [],
        arrivalConfidence: "high",
        stopRisk: "medium",
        remainingTokens: 900,
        remainingIterations: 0,
        remainingDurationMs: null,
        lastDecision: "missing_human_input",
      },
      createdAt: 1,
      updatedAt: 2,
      startedAt: 1,
      completedAt: null,
      lastStopReason: {
        code: "missing_human_input",
        detail: "Publish retry needs credentials.",
      },
      sessionId: null,
      latestPublishOutcome: {
        mode: "push_candidate",
        status: "failed",
        summary: "Push candidate failed: authentication failed: missing credentials for remote",
        commitMessage: null,
        branchName: "autodrive/recover-credentials-run789",
        restoreBranch: "feat/autodrive",
        pushed: false,
        operatorActions: [
          "Run `gh auth login` or refresh the repository credentials before retrying the publish candidate.",
          "Checkout `autodrive/recover-credentials-run789` and retry `git push origin autodrive/recover-credentials-run789` after credentials are fixed.",
        ],
        createdAt: 2,
      },
    } satisfies AutoDriveRunRecord;

    const summary = {
      schemaVersion: "autodrive-summary/v2",
      runId: "run-789",
      iteration: 1,
      status: "success",
      taskTitle: "Recover failed publish candidate",
      summaryText: "Publish candidate creation succeeded, but remote authentication failed.",
      changedFiles: [],
      blockers: [],
      completedSubgoals: [],
      unresolvedItems: [],
      suggestedNextAreas: [],
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "All checks passed.",
      },
      progress: {
        currentMilestone: "recover",
        currentWaypointTitle: "Recover failed publish candidate",
        completedWaypoints: 1,
        totalWaypoints: 1,
        waypointCompletion: 100,
        overallProgress: 100,
        remainingMilestones: [],
        remainingBlockers: [],
        remainingDistance: "Destination reached.",
        arrivalConfidence: "high",
        stopRisk: "medium",
      },
      routeHealth: {
        offRoute: false,
        noProgressLoop: false,
        rerouteRecommended: false,
        rerouteReason: null,
        triggerSignals: [],
      },
      waypoint: {
        id: "recover",
        title: "Recover failed publish candidate",
        status: "arrived",
        arrivalCriteriaMet: ["Recovery steps captured"],
        arrivalCriteriaMissed: [],
      },
      goalReached: true,
      task: {
        taskId: "task-1",
        status: "completed",
        outputExcerpt: "Recovery steps captured.",
      },
      reroute: null,
      createdAt: 2,
    } satisfies AutoDriveIterationSummary;

    await ledger.writeFinalReport({
      run,
      latestSummary: summary,
      markdown: "# AutoDrive Report\n\nPaused for credentials.\n",
    });

    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/final-report.md",
      expect.stringContaining("## Publish Recovery")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/final-report.md",
      expect.stringContaining(".hugecode/runs/run-789/publish/recovery.md")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/publish/recovery.md",
      expect.stringContaining("# AutoDrive Publish Recovery")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/publish/recovery.md",
      expect.stringContaining("gh auth login")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/publish/retry.sh",
      expect.stringContaining("gh auth login")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/publish/retry.sh",
      expect.stringContaining("git checkout autodrive/recover-credentials-run789")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/publish/retry.sh",
      expect.stringContaining("git push origin autodrive/recover-credentials-run789")
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      ".hugecode/runs/run-789/publish/retry.sh",
      expect.stringContaining("git checkout feat/autodrive")
    );
    expect(writeArtifact).not.toHaveBeenCalledWith(
      ".hugecode/runs/run-789/publish/handoff.json",
      expect.any(String)
    );
  });
});
