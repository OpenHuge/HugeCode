import { describe, expect, it } from "vitest";
import { scoreAutoDriveOpportunityQueue } from "./runtimeAutoDriveOpportunityScoring";

function createBaseInput() {
  return {
    intent: {
      directionHypotheses: [
        {
          summary: "Advance the runtime AutoDrive surface first.",
          rationale: "Destination and current evidence both point at the runtime surface.",
          suggestedAreas: [
            "apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts",
            "apps/code/src/application/runtime/facades/runtimeAutoDriveContext.ts",
          ],
          confidence: "medium" as const,
          dominantSignalKinds: ["operator_intent", "collaborator_intent"] as const,
        },
      ],
    },
    collaboratorIntent: {
      conflictRisk: "medium" as const,
      confidence: "medium" as const,
    },
    momentum: {
      alignedSummaries: ["tighten runtime execution boundary"],
      topAreas: ["apps/code/src/application/runtime"],
      alignmentScore: 0.64,
      hasHighDivergence: false,
    },
    routeStagnation: {
      isStagnating: false,
      repeatedAreas: [],
      summary: null,
    },
    executionTuning: {
      validationCommandPreference: "fast" as const,
      publishPriority: "none" as const,
      reasons: [],
      cautionLevel: "normal" as const,
      effectiveMaxFilesPerIteration: 6,
      summary: "No adaptive feedback adjustments are active.",
    },
    externalResearch: [],
    repoBacklog: {
      openIssues: null,
      openPullRequests: null,
      highlights: [],
    },
    threadContext: null,
    blockers: [],
    changedPaths: [],
    previousSummary: null,
    historicalPublishCorridor: null,
    git: {
      behind: 0,
    },
    candidates: [
      {
        id: "advance_primary_surface",
        title: "Advance the primary AutoDrive surface",
        summary: "Move the strongest route hypothesis forward.",
        rationale: "Primary route evidence is strongest.",
        repoAreas: ["apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts"],
        baseScore: 72,
        confidence: "medium" as const,
        risk: "low" as const,
      },
      {
        id: "follow_recent_commit_momentum",
        title: "Follow recent commit momentum",
        summary: "Stay aligned with recent high-signal commits.",
        rationale: "Recent commits are aligned with the destination.",
        repoAreas: ["apps/code/src/application/runtime"],
        baseScore: 62,
        confidence: "high" as const,
        risk: "low" as const,
      },
      {
        id: "tighten_validation_loop",
        title: "Tighten the validation loop",
        summary: "Prefer validation before broader implementation.",
        rationale: "Validation pressure is elevated.",
        repoAreas: ["apps/code/src/application/runtime"],
        baseScore: 65,
        confidence: "medium" as const,
        risk: "low" as const,
      },
      {
        id: "break_route_stagnation",
        title: "Break route stagnation",
        summary: "Force a corrective reroute.",
        rationale: "Iteration history shows repeated drift.",
        repoAreas: ["apps/code/src/application/runtime"],
        baseScore: 68,
        confidence: "high" as const,
        risk: "medium" as const,
      },
      {
        id: "push_publish_candidate",
        title: "Push the publish candidate",
        summary: "Advance the isolated publish branch.",
        rationale: "The publish corridor looks stable.",
        repoAreas: [".hugecode/runs/run-1/publish"],
        baseScore: 70,
        confidence: "high" as const,
        risk: "low" as const,
      },
      {
        id: "use_fresh_research",
        title: "Apply fresh external guidance",
        summary: "Ground the route in fresh external guidance first.",
        rationale: "Fresh research is available.",
        repoAreas: ["apps/code/src/application/runtime"],
        baseScore: 60,
        confidence: "medium" as const,
        risk: "low" as const,
      },
    ],
  };
}

describe("scoreAutoDriveOpportunityQueue", () => {
  it("prefers validation-first recovery over momentum when validation failed under high conflict", () => {
    const queue = scoreAutoDriveOpportunityQueue({
      ...createBaseInput(),
      collaboratorIntent: {
        conflictRisk: "high",
        confidence: "medium",
      },
      previousSummary: {
        validation: {
          success: false,
          summary: "pnpm validate:fast failed on the previous attempt.",
        },
      },
      executionTuning: {
        ...createBaseInput().executionTuning,
        validationCommandPreference: "full",
      },
    });

    expect(queue.selectedCandidateId).toBe("tighten_validation_loop");
    expect(queue.selectionSummary).toContain("validation");
    const validationCandidate = queue.candidates.find(
      (candidate) => candidate.id === "tighten_validation_loop"
    );
    const momentumCandidate = queue.candidates.find(
      (candidate) => candidate.id === "follow_recent_commit_momentum"
    );
    expect(validationCandidate?.selectionTags).toContain("validation_recovery");
    expect(
      validationCandidate?.scoreBreakdown.some((entry) => entry.reasonCode === "validation_failed")
    ).toBe(true);
    expect(
      momentumCandidate?.scoreBreakdown.some(
        (entry) => entry.reasonCode === "collaborator_conflict_penalty"
      )
    ).toBe(true);
  });

  it("prefers a publish push when a stable corridor and successful validation history exist", () => {
    const queue = scoreAutoDriveOpportunityQueue({
      ...createBaseInput(),
      previousSummary: {
        validation: {
          success: true,
          summary: "Validation passed.",
        },
      },
      executionTuning: {
        ...createBaseInput().executionTuning,
        publishPriority: "push_candidate",
        reasons: ["historical_publish_corridor"],
      },
      historicalPublishCorridor: {
        runId: "run-prev",
        destinationTitle: "Advance runtime AutoDrive",
        summaryText: "Published the same corridor successfully.",
        changedFiles: ["apps/code/src/application/runtime/facades/runtimeAutoDriveContext.ts"],
        validationCommands: ["pnpm validate:fast"],
        validationSummary: "Validation passed before publish.",
        createdAt: 1,
        matchScore: 1,
      },
    });

    expect(queue.selectedCandidateId).toBe("push_publish_candidate");
    expect(queue.selectionSummary).toContain("publish");
    const candidate = queue.candidates.find((entry) => entry.id === "push_publish_candidate");
    expect(candidate?.selectionTags).toContain("publish_corridor");
    expect(
      candidate?.scoreBreakdown.some((entry) => entry.reasonCode === "historical_publish_corridor")
    ).toBe(true);
  });

  it("forces a reroute opportunity to the top when route stagnation is detected", () => {
    const queue = scoreAutoDriveOpportunityQueue({
      ...createBaseInput(),
      momentum: {
        ...createBaseInput().momentum,
        hasHighDivergence: true,
      },
      routeStagnation: {
        isStagnating: true,
        repeatedAreas: ["apps/code/src/application/runtime"],
        summary: "Recent iterations keep returning to the same runtime surfaces.",
      },
    });

    expect(queue.selectedCandidateId).toBe("break_route_stagnation");
    expect(queue.selectionSummary).toContain("stagnation");
    const stagnationCandidate = queue.candidates.find(
      (candidate) => candidate.id === "break_route_stagnation"
    );
    const momentumCandidate = queue.candidates.find(
      (candidate) => candidate.id === "follow_recent_commit_momentum"
    );
    expect(stagnationCandidate?.selectionTags).toContain("reroute");
    expect(
      stagnationCandidate?.scoreBreakdown.some((entry) => entry.reasonCode === "route_stagnation")
    ).toBe(true);
    expect(
      momentumCandidate?.scoreBreakdown.some(
        (entry) => entry.reasonCode === "momentum_divergence_penalty"
      )
    ).toBe(true);
  });

  it("biases toward fresh research when route evidence is sparse but current research exists", () => {
    const queue = scoreAutoDriveOpportunityQueue({
      ...createBaseInput(),
      intent: {
        directionHypotheses: [
          {
            ...createBaseInput().intent.directionHypotheses[0],
            confidence: "low",
            dominantSignalKinds: ["operator_intent"] as const,
          },
        ],
      },
      externalResearch: [
        {
          query: "latest agent evals harness patterns",
          summary: "Fresh official guidance recommends scenario-driven harness evals.",
          sources: ["https://platform.openai.com/docs/guides/agent-evals"],
        },
      ],
    });

    expect(queue.selectedCandidateId).toBe("use_fresh_research");
    expect(queue.selectionSummary).toContain("research");
    const candidate = queue.candidates.find((entry) => entry.id === "use_fresh_research");
    expect(candidate?.selectionTags).toContain("research_first");
    expect(candidate?.scoreBreakdown.some((entry) => entry.reasonCode === "fresh_research")).toBe(
      true
    );
    expect(
      candidate?.scoreBreakdown.some((entry) => entry.reasonCode === "sparse_route_evidence")
    ).toBe(true);
  });

  it("boosts validation recovery when a representative eval lane and held-out samples are available", () => {
    const queue = scoreAutoDriveOpportunityQueue({
      ...createBaseInput(),
      previousSummary: {
        validation: {
          success: false,
          summary: "pnpm validate:fast failed on the previous attempt.",
        },
      },
      repoEvaluation: {
        representativeCommands: ["pnpm test", "pnpm validate:fast"],
        componentCommands: ["pnpm test:component"],
        endToEndCommands: ["pnpm test:e2e:smoke"],
        samplePaths: [".codex/e2e-map.json", "fixtures/autodrive"],
        heldOutGuidance: ["Keep one held-out fixture untouched for drift detection."],
        sourceSignals: ["test_command", "e2e_map"],
        scenarioKeys: ["default", "smoke"],
      },
    } as never);

    const validationCandidate = queue.candidates.find(
      (candidate) => candidate.id === "tighten_validation_loop"
    );

    expect(validationCandidate?.selectionTags).toContain("eval_corpus");
    expect(
      validationCandidate?.scoreBreakdown.some(
        (entry) => entry.reasonCode === "representative_eval_lane"
      )
    ).toBe(true);
    expect(
      validationCandidate?.scoreBreakdown.some((entry) => entry.reasonCode === "held_out_samples")
    ).toBe(true);
  });
});
