import { describe, expect, it, vi } from "vitest";
import { synthesizeAutoDriveContext } from "./runtimeAutoDriveContext";
import type {
  AutoDriveControllerDeps,
  AutoDriveIterationSummary,
  AutoDriveRunRecord,
} from "../types/autoDrive";

function createDeps(): AutoDriveControllerDeps {
  return {
    getGitStatus: vi.fn().mockResolvedValue({
      branchName: "feat/autodrive",
      files: [{ path: "apps/code/src/features/composer/components/ComposerMetaBar.tsx" }],
      stagedFiles: [],
      unstagedFiles: [{ path: "apps/code/src/features/composer/components/ComposerMetaBar.tsx" }],
      totalAdditions: 120,
      totalDeletions: 8,
    }),
    getGitLog: vi.fn().mockResolvedValue({
      total: 2,
      ahead: 1,
      behind: 0,
      upstream: "origin/main",
      aheadEntries: [],
      behindEntries: [],
      entries: [
        {
          sha: "sha-1",
          summary: "tighten runtime boundary rules",
          author: "han",
          timestamp: 1_700_000_001_000,
        },
        {
          sha: "sha-2",
          summary: "refine composer meta layout",
          author: "teammate",
          timestamp: 1_700_000_000_000,
        },
      ],
    }),
    getGitRemote: vi.fn().mockResolvedValue("origin"),
    getGitCommitDiff: vi
      .fn()
      .mockResolvedValueOnce([
        { path: "AGENTS.md", status: "M", diff: "" },
        {
          path: "apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts",
          status: "M",
          diff: "",
        },
      ])
      .mockResolvedValueOnce([
        {
          path: "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
          status: "M",
          diff: "",
        },
      ]),
    listGitBranches: vi.fn().mockResolvedValue({
      currentBranch: "feat/autodrive",
      branches: [{ name: "feat/autodrive", lastUsedAt: 1_700_000_002_000 }],
    }),
    readPersistedThreadSnapshots: vi.fn().mockResolvedValue({}),
    readThreadAtlasMemoryDigests: vi.fn().mockResolvedValue({}),
    getWorkspaceFiles: vi
      .fn()
      .mockResolvedValue([
        "AGENTS.md",
        "README.md",
        "package.json",
        ".codex/e2e-map.json",
        "tests/runtime/autodrive-context.test.ts",
        "fixtures/autodrive/mission.json",
        "docs/development/README.md",
        "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
        "apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts",
      ]),
    readWorkspaceFile: vi.fn().mockImplementation(async (_workspaceId: string, path: string) => {
      if (path === "AGENTS.md") {
        return {
          content:
            "Runtime Boundary Rules\n- apps/code/src/application/runtime/* is the only approved frontend boundary.\nValidation Gates\n- pnpm validate:fast\n",
          truncated: false,
        };
      }
      if (path === "README.md") {
        return {
          content: "# HugeCode\nUse pnpm dev and pnpm validate.\n",
          truncated: false,
        };
      }
      if (path === "docs/development/README.md") {
        return {
          content: "Canonical entrypoints include pnpm preflight:codex and validate scripts.\n",
          truncated: false,
        };
      }
      if (path === "package.json") {
        return {
          content: JSON.stringify({
            packageManager: "pnpm@10.0.0",
            scripts: {
              test: "pnpm test",
              "test:component": "pnpm test:component",
              "test:e2e:smoke": "pnpm test:e2e:smoke",
              dev: "pnpm turbo dev",
              validate: "pnpm lint && pnpm test",
              "validate:fast": "pnpm lint",
              "preflight:codex": "pnpm validate:fast",
            },
          }),
          truncated: false,
        };
      }
      if (path === ".codex/e2e-map.json") {
        return {
          content: JSON.stringify({
            default: "test:e2e:smoke",
            smoke: "test:e2e:smoke",
          }),
          truncated: false,
        };
      }
      return { content: "", truncated: false };
    }),
    spawnSubAgentSession: vi.fn(),
    sendSubAgentInstruction: vi.fn(),
    waitSubAgentSession: vi.fn(),
    getSubAgentSessionStatus: vi.fn(),
    interruptSubAgentSession: vi.fn(),
    closeSubAgentSession: vi.fn(),
    runRuntimeExecutableSkill: vi.fn(),
    now: () => 1_700_000_003_000,
    createRunId: () => "run-test",
    delay: async () => undefined,
  };
}

function createRun(): AutoDriveRunRecord {
  return {
    schemaVersion: "autodrive-run/v2",
    runId: "run-test",
    workspaceId: "workspace-1",
    workspacePath: "/repo",
    threadId: "thread-1",
    status: "running",
    stage: "preparing_context",
    destination: {
      title: "Implement AutoDrive in the composer meta area",
      desiredEndState: ["UI shows route state", "Ledger shows route artifacts"],
      doneDefinition: {
        arrivalCriteria: ["Render route summary", "Write run journal entries"],
        requiredValidation: ["pnpm validate:fast"],
        waypointIndicators: ["Progress", "Waypoint Status"],
      },
      hardBoundaries: ["Do not break the manual composer flow"],
      routePreference: "stability_first",
    },
    budget: {
      maxTokens: 12000,
      maxIterations: 4,
      maxDurationMs: 600000,
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
      minimumConfidence: "medium",
    },
    iteration: 1,
    totals: {
      consumedTokensEstimate: 3200,
      elapsedMs: 120000,
      validationFailureCount: 0,
      noProgressCount: 0,
      repeatedFailureCount: 0,
      rerouteCount: 0,
    },
    blockers: [],
    completedSubgoals: ["context_baseline"],
    summaries: [],
    navigation: {
      destinationSummary: "Implement AutoDrive in the composer meta area",
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
      remainingTokens: 8800,
      remainingIterations: 3,
      remainingDurationMs: 480000,
      lastDecision: null,
    },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    startedAt: 1_700_000_000_000,
    completedAt: null,
    lastStopReason: null,
    sessionId: null,
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
    runId: "run-test",
    iteration: 1,
    status: "success",
    taskTitle: "Advance the active route",
    summaryText: "Implemented the requested AutoDrive slice and validated it.",
    changedFiles: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
    blockers: [],
    completedSubgoals: ["context_baseline"],
    unresolvedItems: [],
    suggestedNextAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
    validation: {
      ran: true,
      commands: ["pnpm validate:fast"],
      success: true,
      failures: [],
      summary: "Validation passed.",
    },
    progress: {
      currentMilestone: "Validate the route",
      currentWaypointTitle: "Validate the current slice",
      completedWaypoints: 1,
      totalWaypoints: 3,
      waypointCompletion: 100,
      overallProgress: 70,
      remainingMilestones: ["Prepare publish corridor"],
      remainingBlockers: [],
      remainingDistance: "One publish step remains.",
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
      title: "Validate the current slice",
      status: "arrived",
      arrivalCriteriaMet: ["pnpm validate:fast"],
      arrivalCriteriaMissed: [],
    },
    goalReached: false,
    task: {
      taskId: "task-1",
      status: "completed",
      outputExcerpt: "Validated the slice.",
    },
    reroute: null,
    createdAt: 1_700_000_002_500,
    ...overrides,
  };
}

describe("synthesizeAutoDriveContext", () => {
  it("builds a route-ready start state and destination snapshot", async () => {
    const deps = createDeps();
    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: null,
    });

    expect(context.destination.title).toContain("AutoDrive");
    expect(context.startState.repo.branch).toBe("feat/autodrive");
    expect(context.git.remote).toBe("origin");
    expect(context.startState.system.remainingIterations).toBe(3);
    expect(context.startState.system.remainingTokensEstimate).toBe(8800);
    expect(context.startState.summary).toContain("Route preference");
    expect(context.repo.scripts.validateFast).toBe("pnpm lint");
    expect((context.repo as { evaluation?: Record<string, unknown> }).evaluation).toEqual(
      expect.objectContaining({
        representativeCommands: ["pnpm test", "pnpm lint"],
        componentCommands: ["pnpm test:component"],
        endToEndCommands: ["pnpm test:e2e:smoke"],
      })
    );
    expect(
      (
        (context.repo as { evaluation?: { samplePaths?: string[] } }).evaluation?.samplePaths ?? []
      ).some((entry) => entry.includes(".codex/e2e-map.json"))
    ).toBe(true);
    expect(
      (
        (context.repo as { evaluation?: { samplePaths?: string[] } }).evaluation?.samplePaths ?? []
      ).some((entry) => entry.includes("fixtures"))
    ).toBe(true);
    expect(
      (
        (context.repo as { evaluation?: { scenarioKeys?: string[] } }).evaluation?.scenarioKeys ??
        []
      ).includes("default")
    ).toBe(true);
    expect(context.repo.ruleEvidence.some((entry) => entry.path === "AGENTS.md")).toBe(true);
    expect(context.collaboratorIntent.touchedAreas).toContain("apps/code/src/features/composer");
    expect(context.intent.summary).toContain("AutoDrive");
    expect(context.intent.signals.some((signal) => signal.kind === "operator_intent")).toBe(true);
    expect(context.intent.signals.some((signal) => signal.source === "git_log")).toBe(true);
    expect(context.intent.directionHypotheses[0]?.suggestedAreas).toContain(
      "apps/code/src/features/composer/components/ComposerMetaBar.tsx"
    );
    expect(context.opportunities.candidates[0]?.id).toBe("advance_primary_surface");
    expect(context.opportunities.selectedCandidateId).toBe("advance_primary_surface");
    expect(context.opportunities.selectionSummary).toContain("leads because");
    expect(context.opportunities.candidates[0]?.scoreBreakdown?.length).toBeGreaterThan(0);
    expect(context.opportunities.candidates[0]?.selectionTags).toContain("primary_route");
    expect(
      context.opportunities.candidates.some(
        (candidate) => candidate.id === "follow_recent_commit_momentum"
      )
    ).toBe(true);
    expect(context.publishReadiness.allowed).toBe(false);
    expect(context.publishReadiness.reasonCodes).toContain("dirty_working_tree");
  });

  it("does not run external research when network analysis is disabled", async () => {
    const deps = createDeps();
    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: null,
    });

    expect(deps.runRuntimeExecutableSkill).not.toHaveBeenCalled();
    expect(context.externalResearch).toEqual([]);
    expect(context.researchPolicy?.enabled).toBe(false);
    expect(context.researchPolicy?.reasonCodes).toContain("network-disabled-by-risk-policy");
  });

  it("uses provider-aware search-only research when external freshness signals exist", async () => {
    const deps = createDeps();
    vi.mocked(deps.runRuntimeExecutableSkill).mockResolvedValue({
      runId: "research-run-1",
      skillId: "network-analysis",
      status: "completed",
      message: "ok",
      output: "Latest SDK guidance gathered.",
      network: {
        query: "query",
        provider: "network-analysis",
        fetchedAt: 1_700_000_003_100,
        items: [{ title: "doc", url: "https://example.com/sdk", snippet: "", content: null }],
      },
      artifacts: [],
      metadata: {},
    });
    const run = {
      ...createRun(),
      riskPolicy: {
        ...createRun().riskPolicy,
        allowNetworkAnalysis: true,
      },
      destination: {
        ...createRun().destination,
        title: "Update SDK integration to latest upstream guidance",
        doneDefinition: {
          ...createRun().destination.doneDefinition,
          arrivalCriteria: ["Confirm latest API docs before changing behavior"],
        },
      },
      execution: {
        accessMode: "on-request" as const,
        modelId: "claude-3-7-sonnet",
        reasoningEffort: "medium",
      },
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 2,
      previousSummary: null,
    });

    expect(deps.runRuntimeExecutableSkill).toHaveBeenCalledWith({
      request: {
        skillId: "network-analysis",
        input:
          "Update SDK integration to latest upstream guidance relevant framework or API guidance",
        context: {
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
        },
        options: {
          workspaceId: "workspace-1",
          allowNetwork: true,
          fetchPageContent: false,
          recencyDays: 30,
        },
      },
    });
    expect(context.externalResearch[0]?.summary).toContain("Latest SDK guidance");
    expect(context.researchPolicy?.enabled).toBe(true);
    expect(context.researchPolicy?.strategy).toBe("search-only");
    expect(context.researchPolicy?.reasonCodes).toContain("research-search-only");
    expect(context.intent.signals.some((signal) => signal.kind === "external_research")).toBe(true);
    expect(context.intent.directionHypotheses[0]?.rationale).toContain("Latest SDK guidance");
    expect(
      context.opportunities.candidates.some((candidate) => candidate.id === "use_fresh_research")
    ).toBe(true);
  });

  it("degrades external research to empty results when executable skill availability blocks execution", async () => {
    const deps = createDeps();
    vi.mocked(deps.runRuntimeExecutableSkill).mockRejectedValue(
      new Error("network-analysis is refresh_pending: Skill refresh is pending.")
    );
    const run = {
      ...createRun(),
      riskPolicy: {
        ...createRun().riskPolicy,
        allowNetworkAnalysis: true,
      },
      destination: {
        ...createRun().destination,
        title: "Check latest upstream guidance before editing the API integration",
      },
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 2,
      previousSummary: null,
    });

    expect(deps.runRuntimeExecutableSkill).toHaveBeenCalledTimes(1);
    expect(context.externalResearch).toEqual([]);
    expect(context.researchPolicy?.enabled).toBe(true);
  });

  it("derives tighter execution tuning after validation failure", async () => {
    const deps = createDeps();
    const previousSummary = createPreviousSummary({
      status: "failed",
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: false,
        failures: ["pnpm validate:fast"],
        summary: "Validation failed.",
      },
    });

    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary,
    });

    expect(context.executionTuning.validationCommandPreference).toBe("full");
    expect(context.executionTuning.effectiveMaxFilesPerIteration).toBeLessThanOrEqual(2);
    expect(context.executionTuning.summary).toContain("validation");
  });

  it("records external backlog signals when GitHub issues and PRs are available", async () => {
    const deps = createDeps();
    deps.getGitHubIssues = vi.fn().mockResolvedValue({
      total: 2,
      issues: [
        {
          number: 101,
          title: "Stabilize AutoDrive reroute drift",
          url: "https://example.com/issues/101",
          updatedAt: "2026-03-14T00:00:00Z",
        },
      ],
    });
    deps.getGitHubPullRequests = vi.fn().mockResolvedValue({
      total: 1,
      pullRequests: [
        {
          number: 55,
          title: "Refine runtime policy diagnostics",
          url: "https://example.com/pulls/55",
          updatedAt: "2026-03-14T00:00:00Z",
          createdAt: "2026-03-13T00:00:00Z",
          body: "",
          headRefName: "feat/runtime-policy",
          baseRefName: "fastcode",
          isDraft: false,
          author: { login: "han" },
        },
      ],
    });

    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: null,
    });

    expect(context.repoBacklog.openIssues).toBe(2);
    expect(context.repoBacklog.openPullRequests).toBe(1);
    expect(context.repoBacklog.highlights[0]).toContain("Stabilize AutoDrive reroute drift");
    expect(context.intent.signals.some((signal) => signal.kind === "repo_backlog")).toBe(true);
    expect(
      context.opportunities.candidates.some(
        (candidate) => candidate.id === "triage_external_backlog"
      )
    ).toBe(true);
  });

  it("records recent thread prompts when a persisted thread snapshot exists", async () => {
    const deps = createDeps();
    deps.readPersistedThreadSnapshots = vi.fn().mockResolvedValue({
      "workspace-1:thread-1": {
        workspaceId: "workspace-1",
        threadId: "thread-1",
        name: "AutoDrive direction",
        updatedAt: 1_700_000_003_200,
        items: [
          {
            id: "m-1",
            kind: "message",
            role: "user",
            text: "Tighten AutoDrive route quality before pushing.",
          },
          {
            id: "m-2",
            kind: "message",
            role: "assistant",
            text: "I will prioritize route quality and validation evidence.",
          },
          {
            id: "m-3",
            kind: "message",
            role: "user",
            text: "Keep the next step grounded in the active thread history.",
          },
        ],
      },
    });

    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: null,
    });

    expect(context.threadContext?.threadId).toBe("thread-1");
    expect(context.threadContext?.recentUserPrompts).toEqual([
      "Tighten AutoDrive route quality before pushing.",
      "Keep the next step grounded in the active thread history.",
    ]);
    expect(context.intent.signals.some((signal) => signal.kind === "thread_history")).toBe(true);
    expect(
      context.opportunities.candidates.some(
        (candidate) => candidate.id === "align_with_thread_history"
      )
    ).toBe(true);
  });

  it("records long-term thread memory when an atlas digest exists", async () => {
    const deps = createDeps();
    deps.readThreadAtlasMemoryDigests = vi.fn().mockResolvedValue({
      "workspace-1:thread-1": {
        summary: "The operator prefers safe incremental milestones with explicit validation.",
        updatedAt: 1_700_000_003_300,
      },
    });

    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: null,
    });

    expect(context.threadContext?.longTermMemorySummary).toContain("safe incremental milestones");
    expect(context.intent.signals.some((signal) => signal.kind === "thread_memory")).toBe(true);
    expect(context.intent.directionHypotheses[0]?.rationale).toContain(
      "The operator prefers safe incremental milestones with explicit validation."
    );
  });

  it("raises collaborator conflict risk when recent commit momentum diverges from destination intent", async () => {
    const deps = createDeps();
    vi.mocked(deps.getGitLog).mockResolvedValue({
      total: 6,
      ahead: 1,
      behind: 0,
      upstream: "origin/main",
      aheadEntries: [],
      behindEntries: [],
      entries: [
        {
          sha: "sha-a",
          summary: "refresh docs index and glossary terms",
          author: "teammate",
          timestamp: 1_700_000_006_000,
        },
        {
          sha: "sha-b",
          summary: "update release changelog notes",
          author: "teammate",
          timestamp: 1_700_000_005_000,
        },
        {
          sha: "sha-c",
          summary: "revise workflow playbook examples",
          author: "teammate",
          timestamp: 1_700_000_004_000,
        },
        {
          sha: "sha-d",
          summary: "docs copy edits for onboarding",
          author: "teammate",
          timestamp: 1_700_000_003_000,
        },
        {
          sha: "sha-e",
          summary: "clarify release process wording",
          author: "teammate",
          timestamp: 1_700_000_002_000,
        },
        {
          sha: "sha-f",
          summary: "normalize docs heading punctuation",
          author: "teammate",
          timestamp: 1_700_000_001_000,
        },
      ],
    });
    deps.getGitCommitDiff = vi.fn().mockResolvedValue([
      { path: "docs/guide.md", status: "M", diff: "" },
      { path: "docs/glossary.md", status: "M", diff: "" },
    ]);

    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: null,
    });

    expect(context.collaboratorIntent.conflictRisk).toBe("high");
    expect(context.collaboratorIntent.recentDirection).toContain("destination alignment");
  });

  it("prioritizes a corrective opportunity when iteration history shows route stagnation", async () => {
    const deps = createDeps();
    const summaryOne = createPreviousSummary({
      iteration: 1,
      blockers: ["Need provider policy confirmation."],
      suggestedNextAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
      progress: {
        ...createPreviousSummary().progress,
        overallProgress: 62,
      },
      createdAt: 1_700_000_001_000,
    });
    const summaryTwo = createPreviousSummary({
      iteration: 2,
      blockers: ["Need provider policy confirmation."],
      suggestedNextAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
      progress: {
        ...createPreviousSummary().progress,
        overallProgress: 61,
      },
      createdAt: 1_700_000_002_000,
    });
    const summaryThree = createPreviousSummary({
      iteration: 3,
      blockers: ["Need provider policy confirmation."],
      suggestedNextAreas: ["apps/code/src/features/composer/components/ComposerMetaBar.tsx"],
      progress: {
        ...createPreviousSummary().progress,
        overallProgress: 61,
      },
      createdAt: 1_700_000_003_000,
    });
    const run = {
      ...createRun(),
      summaries: [summaryOne, summaryTwo, summaryThree],
      blockers: ["Need provider policy confirmation."],
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 4,
      previousSummary: summaryThree,
    });

    expect(context.opportunities.selectedCandidateId).toBe("break_route_stagnation");
    expect(
      context.opportunities.candidates.some(
        (candidate) => candidate.id === "break_route_stagnation"
      )
    ).toBe(true);
    expect(
      context.intent.signals.some((signal) => signal.summary.includes("Route stagnation detected"))
    ).toBe(true);
  });

  it("marks publish readiness as branch-only when validation is done but local changes still need commit", async () => {
    const deps = createDeps();
    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: createPreviousSummary(),
    });

    expect(context.publishReadiness.allowed).toBe(false);
    expect(context.publishReadiness.recommendedMode).toBe("branch_only");
    expect(context.publishReadiness.reasonCodes).toEqual(["dirty_working_tree"]);
  });

  it("raises publish preparation priority after a branch-only publish outcome", async () => {
    const deps = createDeps();
    const run = {
      ...createRun(),
      latestPublishOutcome: {
        mode: "branch_only" as const,
        status: "completed" as const,
        summary: "Created a branch-only publish candidate.",
        commitMessage: "feat(autodrive): prepare branch-only publish candidate",
        branchName: null,
        pushed: false,
        createdAt: 1_700_000_003_100,
      },
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 2,
      previousSummary: createPreviousSummary(),
    });

    expect(context.executionTuning.publishPriority).toBe("prepare_branch");
    expect(
      context.opportunities.candidates.some(
        (candidate) => candidate.id === "prepare_publish_corridor"
      )
    ).toBe(true);
  });

  it("promotes the publish corridor to push_candidate after repeated stable validations", async () => {
    const deps = createDeps();
    const summaryOne = createPreviousSummary({
      iteration: 1,
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "Validation passed.",
      },
      blockers: [],
      routeHealth: {
        ...createPreviousSummary().routeHealth,
        offRoute: false,
        rerouteRecommended: false,
      },
    });
    const summaryTwo = createPreviousSummary({
      iteration: 2,
      summaryText: "Kept the publish corridor stable and validation green.",
      validation: {
        ran: true,
        commands: ["pnpm validate:fast"],
        success: true,
        failures: [],
        summary: "Validation passed again.",
      },
      blockers: [],
      routeHealth: {
        ...createPreviousSummary().routeHealth,
        offRoute: false,
        rerouteRecommended: false,
      },
    });
    const run = {
      ...createRun(),
      summaries: [summaryOne],
      latestPublishOutcome: {
        mode: "branch_only" as const,
        status: "completed" as const,
        summary: "Created a branch-only publish candidate.",
        commitMessage: "feat(autodrive): prepare branch-only publish candidate",
        branchName: null,
        pushed: false,
        createdAt: 1_700_000_003_100,
      },
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 3,
      previousSummary: summaryTwo,
    });

    expect(context.executionTuning.publishPriority).toBe("push_candidate");
    expect(context.executionTuning.reasons).toContain("publish_corridor_stable");
    expect(
      context.opportunities.candidates.some(
        (candidate) => candidate.id === "push_publish_candidate"
      )
    ).toBe(true);
  });

  it("inherits publish corridor confidence from prior successful AutoDrive runs", async () => {
    const deps = createDeps();
    vi.mocked(deps.getWorkspaceFiles).mockResolvedValue([
      "AGENTS.md",
      "README.md",
      "package.json",
      "docs/development/README.md",
      "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
      "apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts",
      ".hugecode/runs/run-prev/run.json",
    ]);
    vi.mocked(deps.readWorkspaceFile).mockImplementation(
      async (_workspaceId: string, path: string) => {
        if (path === ".hugecode/runs/run-prev/run.json") {
          return {
            content: JSON.stringify({
              ...createRun(),
              runId: "run-prev",
              latestPublishOutcome: {
                mode: "push_candidate",
                status: "completed",
                summary: "Pushed the isolated publish candidate branch.",
                commitMessage: "feat(autodrive): publish stable corridor",
                branchName: "autodrive/publish-stable-corridor",
                pushed: true,
                createdAt: 1_699_999_999_000,
              },
              destination: {
                ...createRun().destination,
                title: "Implement AutoDrive in the composer meta area",
              },
            }),
            truncated: false,
          };
        }
        if (path === "AGENTS.md") {
          return {
            content:
              "Runtime Boundary Rules\n- apps/code/src/application/runtime/* is the only approved frontend boundary.\nValidation Gates\n- pnpm validate:fast\n",
            truncated: false,
          };
        }
        if (path === "README.md") {
          return {
            content: "# HugeCode\nUse pnpm dev and pnpm validate.\n",
            truncated: false,
          };
        }
        if (path === "docs/development/README.md") {
          return {
            content: "Canonical entrypoints include pnpm preflight:codex and validate scripts.\n",
            truncated: false,
          };
        }
        if (path === "package.json") {
          return {
            content: JSON.stringify({
              packageManager: "pnpm@10.0.0",
              scripts: {
                dev: "pnpm turbo dev",
                validate: "pnpm lint && pnpm test",
                "validate:fast": "pnpm lint",
                "preflight:codex": "pnpm validate:fast",
              },
            }),
            truncated: false,
          };
        }
        return { content: "", truncated: false };
      }
    );
    const run = {
      ...createRun(),
      latestPublishOutcome: {
        mode: "branch_only" as const,
        status: "completed" as const,
        summary: "Created a branch-only publish candidate.",
        commitMessage: "feat(autodrive): prepare branch-only publish candidate",
        branchName: null,
        pushed: false,
        createdAt: 1_700_000_003_100,
      },
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 2,
      previousSummary: createPreviousSummary(),
    });

    expect(context.executionTuning.publishPriority).toBe("push_candidate");
    expect(context.executionTuning.reasons).toContain("historical_publish_corridor");
    expect(
      context.opportunities.candidates.some(
        (candidate) => candidate.id === "push_publish_candidate"
      )
    ).toBe(true);
  });

  it("reuses historical publish handoff evidence as the next push corridor", async () => {
    const deps = createDeps();
    vi.mocked(deps.getWorkspaceFiles).mockResolvedValue([
      "AGENTS.md",
      "README.md",
      "package.json",
      "docs/development/README.md",
      "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
      ".hugecode/runs/run-prev/run.json",
      ".hugecode/runs/run-prev/publish/handoff.json",
    ]);
    vi.mocked(deps.readWorkspaceFile).mockImplementation(
      async (_workspaceId: string, path: string) => {
        if (path === ".hugecode/runs/run-prev/run.json") {
          return {
            content: JSON.stringify({
              ...createRun(),
              runId: "run-prev",
              latestPublishOutcome: {
                mode: "push_candidate",
                status: "completed",
                summary: "Pushed the isolated publish candidate branch.",
                commitMessage: "feat(autodrive): publish stable corridor",
                branchName: "autodrive/publish-stable-corridor",
                pushed: true,
                createdAt: 1_699_999_999_000,
              },
              destination: {
                ...createRun().destination,
                title: "Implement AutoDrive in the composer meta area",
              },
            }),
            truncated: false,
          };
        }
        if (path === ".hugecode/runs/run-prev/publish/handoff.json") {
          return {
            content: JSON.stringify({
              schemaVersion: "autodrive-publish-handoff/v1",
              runId: "run-prev",
              workspaceId: "workspace-1",
              threadId: "thread-1",
              createdAt: 1_699_999_999_000,
              publish: {
                branchName: "autodrive/publish-stable-corridor",
                commitMessage: "feat(autodrive): publish stable corridor",
                summary: "Pushed the isolated publish candidate branch.",
              },
              destination: {
                title: "Implement AutoDrive in the composer meta area",
                desiredEndState: ["UI shows route state", "Ledger shows route artifacts"],
              },
              validation: {
                commands: ["pnpm validate:fast"],
                success: true,
                summary: "Validation passed before publish.",
              },
              evidence: {
                summaryText: "Published the composer runtime corridor successfully.",
                changedFiles: [
                  "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
                  "apps/code/src/application/runtime/facades/runtimeAutoDriveContext.ts",
                ],
                blockers: [],
              },
              reviewDraft: {
                title: "feat(autodrive): Implement AutoDrive in the composer meta area",
                body: "body",
                checklist: ["check"],
              },
              operatorCommands: ["gh pr create"],
            }),
            truncated: false,
          };
        }
        if (path === "AGENTS.md") {
          return {
            content:
              "Runtime Boundary Rules\n- apps/code/src/application/runtime/* is the only approved frontend boundary.\nValidation Gates\n- pnpm validate:fast\n",
            truncated: false,
          };
        }
        if (path === "README.md") {
          return {
            content: "# HugeCode\nUse pnpm dev and pnpm validate.\n",
            truncated: false,
          };
        }
        if (path === "docs/development/README.md") {
          return {
            content: "Canonical entrypoints include pnpm preflight:codex and validate scripts.\n",
            truncated: false,
          };
        }
        if (path === "package.json") {
          return {
            content: JSON.stringify({
              packageManager: "pnpm@10.0.0",
              scripts: {
                dev: "pnpm turbo dev",
                validate: "pnpm lint && pnpm test",
                "validate:fast": "pnpm lint",
              },
            }),
            truncated: false,
          };
        }
        return { content: "", truncated: false };
      }
    );
    const run = {
      ...createRun(),
      latestPublishOutcome: {
        mode: "branch_only" as const,
        status: "completed" as const,
        summary: "Created a branch-only publish candidate.",
        commitMessage: "feat(autodrive): prepare branch-only publish candidate",
        branchName: null,
        pushed: false,
        createdAt: 1_700_000_003_100,
      },
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 2,
      previousSummary: createPreviousSummary(),
    });
    const pushCandidate = context.opportunities.candidates.find(
      (candidate) => candidate.id === "push_publish_candidate"
    );

    expect(pushCandidate?.repoAreas).toContain(
      "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"
    );
    expect(pushCandidate?.rationale).toContain(
      "Published the composer runtime corridor successfully"
    );
    expect(pushCandidate?.score).toBeGreaterThanOrEqual(97);
    expect(context.opportunities.selectedCandidateId).toBe("push_publish_candidate");
  });

  it("keeps publish caution elevated when matching historical publish attempts failed", async () => {
    const deps = createDeps();
    vi.mocked(deps.getWorkspaceFiles).mockResolvedValue([
      "AGENTS.md",
      "README.md",
      "package.json",
      "docs/development/README.md",
      "apps/code/src/features/composer/components/ComposerMetaBar.tsx",
      ".hugecode/runs/run-failed/run.json",
    ]);
    vi.mocked(deps.readWorkspaceFile).mockImplementation(
      async (_workspaceId: string, path: string) => {
        if (path === ".hugecode/runs/run-failed/run.json") {
          return {
            content: JSON.stringify({
              ...createRun(),
              runId: "run-failed",
              latestPublishOutcome: {
                mode: "push_candidate",
                status: "failed",
                summary:
                  "Push candidate failed: remote rejected the branch protection requirements.",
                commitMessage: "feat(autodrive): publish stable corridor",
                branchName: "autodrive/publish-stable-corridor",
                pushed: false,
                createdAt: 1_699_999_999_000,
              },
              destination: {
                ...createRun().destination,
                title: "Implement AutoDrive in the composer meta area",
              },
            }),
            truncated: false,
          };
        }
        if (path === "AGENTS.md") {
          return {
            content:
              "Runtime Boundary Rules\n- apps/code/src/application/runtime/* is the only approved frontend boundary.\nValidation Gates\n- pnpm validate:fast\n",
            truncated: false,
          };
        }
        if (path === "README.md") {
          return {
            content: "# HugeCode\nUse pnpm dev and pnpm validate.\n",
            truncated: false,
          };
        }
        if (path === "docs/development/README.md") {
          return {
            content: "Canonical entrypoints include pnpm preflight:codex and validate scripts.\n",
            truncated: false,
          };
        }
        if (path === "package.json") {
          return {
            content: JSON.stringify({
              packageManager: "pnpm@10.0.0",
              scripts: {
                dev: "pnpm turbo dev",
                validate: "pnpm lint && pnpm test",
                "validate:fast": "pnpm lint",
              },
            }),
            truncated: false,
          };
        }
        return { content: "", truncated: false };
      }
    );
    const run = {
      ...createRun(),
      latestPublishOutcome: {
        mode: "branch_only" as const,
        status: "completed" as const,
        summary: "Created a branch-only publish candidate.",
        commitMessage: "feat(autodrive): prepare branch-only publish candidate",
        branchName: null,
        pushed: false,
        createdAt: 1_700_000_003_100,
      },
    };

    const context = await synthesizeAutoDriveContext({
      deps,
      run,
      iteration: 2,
      previousSummary: createPreviousSummary(),
    });

    expect(context.executionTuning.publishPriority).toBe("prepare_branch");
    expect(context.executionTuning.reasons).toContain("historical_publish_failure");
    expect(context.executionTuning.summary).toContain("branch protection requirements");
    expect(context.opportunities.selectedCandidateId).toBe("prepare_publish_corridor");
  });

  it("keeps push readiness open when the repo has a remote even if the current branch has no upstream", async () => {
    const deps = createDeps();
    vi.mocked(deps.getGitStatus).mockResolvedValue({
      branchName: "feat/autodrive",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
    });
    vi.mocked(deps.getGitLog).mockResolvedValue({
      total: 2,
      ahead: 1,
      behind: 0,
      upstream: null,
      aheadEntries: [],
      behindEntries: [],
      entries: [
        {
          sha: "sha-1",
          summary: "tighten runtime boundary rules",
          author: "han",
          timestamp: 1_700_000_001_000,
        },
      ],
    });
    vi.mocked(deps.getGitRemote).mockResolvedValue("origin");

    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: createPreviousSummary(),
    });

    expect(context.git.remote).toBe("origin");
    expect(context.git.upstream).toBeNull();
    expect(context.publishReadiness.allowed).toBe(true);
    expect(context.publishReadiness.recommendedMode).toBe("push_candidate");
    expect(context.publishReadiness.reasonCodes).toEqual([]);
  });

  it("blocks publish readiness when the workspace has no pushable remote", async () => {
    const deps = createDeps();
    vi.mocked(deps.getGitStatus).mockResolvedValue({
      branchName: "feat/autodrive",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
    });
    vi.mocked(deps.getGitLog).mockResolvedValue({
      total: 2,
      ahead: 1,
      behind: 0,
      upstream: null,
      aheadEntries: [],
      behindEntries: [],
      entries: [
        {
          sha: "sha-1",
          summary: "tighten runtime boundary rules",
          author: "han",
          timestamp: 1_700_000_001_000,
        },
      ],
    });
    vi.mocked(deps.getGitRemote).mockResolvedValue(null);

    const context = await synthesizeAutoDriveContext({
      deps,
      run: createRun(),
      iteration: 2,
      previousSummary: createPreviousSummary(),
    });

    expect(context.git.remote).toBeNull();
    expect(context.publishReadiness.allowed).toBe(false);
    expect(context.publishReadiness.recommendedMode).toBe("hold");
    expect(context.publishReadiness.reasonCodes).toContain("missing_remote");
  });
});
