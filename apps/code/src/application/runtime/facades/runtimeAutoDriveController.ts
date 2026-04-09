import type { AgentTaskSummary, SubAgentWaitResult } from "@ku0/code-runtime-host-contract";
// Compatibility/fixture-only engine: production AutoDrive control now uses
// runtime mission snapshot + `code_runtime_run_*` APIs through
// `useAutoDriveController`. Do not add new product orchestration here until the
// planned facade split lands.
import { buildNextTaskProposal, reviewNextTaskProposal } from "./runtimeAutoDrivePlanner";
import {
  coerceReasonEffort,
  deriveAdaptiveExecutionConfig,
  resolveBaseExecutionConfig,
  resolveValidationCommands,
  sameExecutionConfig,
} from "./runtimeAutoDriveExecution";
import { extractLatestTaskOutput } from "./runtimeAutoDriveReviewParsing";
import {
  buildDefaultSummary,
  buildEmptyNavigation,
  buildNavigationFromContext,
  buildNavigationFromProposal,
  buildRerouteFromReview,
  defaultNow,
  estimateTokens,
  getPreIterationStopReason,
  hasDestructiveSignals,
  mapProposalReviewToStopReason,
  resolveTerminalState,
} from "./runtimeAutoDriveControllerSupport";
import {
  advanceContinuationState,
  resolveStoppedContinuationState,
} from "./runtimeAutoDriveContinuation";
import { maybePublishGoalReachedOutcome } from "./runtimeAutoDrivePublishControl";
import { resolvePublishAwareStopReason } from "./runtimeAutoDrivePublishRecovery";
import { renderAutoDriveFinalReport } from "./runtimeAutoDriveReport";
import { decideAutoDriveNextStep, shouldAutoRunChatgptDecisionLab } from "./runtimeAutoDrivePolicy";
import { synthesizeAutoDriveContext } from "./runtimeAutoDriveContext";
import type {
  AutoDriveConfidence,
  AutoDriveContextSnapshot,
  AutoDriveControllerDeps,
  AutoDriveExecutionConfig,
  AutoDriveIterationSummary,
  AutoDriveLedger,
  AutoDriveNextDecision,
  AutoDriveProposalReview,
  AutoDriveRouteProposal,
  AutoDriveRunRecord,
  AutoDriveStopReason,
  AutoDriveValidationResult,
} from "../types/autoDrive";
import { logger } from "../logger";

function notifyAutoDriveRunListener(
  listener: (run: AutoDriveRunRecord) => void,
  run: AutoDriveRunRecord
): void {
  try {
    listener(run);
  } catch (error) {
    logger.error("[AutoDriveRunController] listener failed", error);
  }
}

type AutoDriveControllerServices = {
  synthesizeContext?: (params: {
    deps: AutoDriveControllerDeps;
    run: AutoDriveRunRecord;
    iteration: number;
    previousSummary: AutoDriveIterationSummary | null;
  }) => Promise<AutoDriveContextSnapshot>;
  buildProposal?: (params: {
    run: AutoDriveRunRecord;
    context: AutoDriveContextSnapshot;
    iteration: number;
    previousSummary: AutoDriveIterationSummary | null;
  }) => AutoDriveRouteProposal;
  reviewProposal?: (params: {
    proposal: AutoDriveRouteProposal;
    context: AutoDriveContextSnapshot;
    run: AutoDriveRunRecord;
  }) => AutoDriveProposalReview;
  summarizeIteration?: (params: {
    iteration: number;
    run: AutoDriveRunRecord;
    context: AutoDriveContextSnapshot;
    proposal: AutoDriveRouteProposal;
    validation: AutoDriveValidationResult;
    task: AgentTaskSummary;
  }) => Promise<AutoDriveIterationSummary>;
  validateIteration?: (params: {
    deps: AutoDriveControllerDeps;
    iteration: number;
    run: AutoDriveRunRecord;
    context: AutoDriveContextSnapshot;
    proposal: AutoDriveRouteProposal;
    task: AgentTaskSummary;
  }) => Promise<AutoDriveValidationResult>;
  decideNextStep?: (params: {
    run: AutoDriveRunRecord;
    latestSummary: AutoDriveIterationSummary;
    criticConfidence: AutoDriveConfidence;
    hasDestructiveChange: boolean;
    hasDependencyChange: boolean;
    executionTuning: AutoDriveContextSnapshot["executionTuning"];
  }) => AutoDriveNextDecision;
  buildFinalReport?: (params: {
    run: AutoDriveRunRecord;
    latestSummary: AutoDriveIterationSummary | null;
  }) => string;
};

const DEFAULT_WAIT_TIMEOUT_MS = 30 * 60 * 1000;

export class AutoDriveRunController {
  private readonly deps: AutoDriveControllerDeps;
  private readonly ledger: AutoDriveLedger;
  private readonly services: Required<AutoDriveControllerServices>;
  private run: AutoDriveRunRecord;
  private runningPromise: Promise<AutoDriveRunRecord> | null = null;
  private pauseRequested = false;
  private stopReason: AutoDriveStopReason | null = null;
  private listeners = new Set<(run: AutoDriveRunRecord) => void>();
  private sessionExecution: AutoDriveExecutionConfig | null = null;

  constructor(
    input: {
      deps: AutoDriveControllerDeps;
      ledger: AutoDriveLedger;
      run: AutoDriveRunRecord;
    } & AutoDriveControllerServices
  ) {
    this.deps = input.deps;
    this.ledger = input.ledger;
    this.run = {
      ...input.run,
      navigation: input.run.navigation ?? buildEmptyNavigation(input.run),
    };
    this.sessionExecution = this.run.sessionId ? resolveBaseExecutionConfig(this.run) : null;
    this.services = {
      synthesizeContext: input.synthesizeContext ?? synthesizeAutoDriveContext,
      buildProposal:
        input.buildProposal ??
        ((params) =>
          buildNextTaskProposal({
            run: params.run,
            context: params.context,
            previousSummary: params.previousSummary,
          })),
      reviewProposal: input.reviewProposal ?? reviewNextTaskProposal,
      summarizeIteration:
        input.summarizeIteration ??
        (async (params) =>
          buildDefaultSummary({
            iteration: params.iteration,
            run: params.run,
            proposal: params.proposal,
            validation: params.validation,
            task: params.task,
          })),
      validateIteration: input.validateIteration ?? this.defaultValidateIteration.bind(this),
      decideNextStep: input.decideNextStep ?? decideAutoDriveNextStep,
      buildFinalReport: input.buildFinalReport ?? renderAutoDriveFinalReport,
    };
  }

  subscribe(listener: (run: AutoDriveRunRecord) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AutoDriveRunRecord {
    return this.run;
  }

  async start(): Promise<AutoDriveRunRecord> {
    if (this.runningPromise) {
      return this.runningPromise;
    }
    this.pauseRequested = false;
    this.stopReason = null;
    this.run = {
      ...this.run,
      status: "running",
      stage: "preparing_context",
      startedAt: this.run.startedAt ?? defaultNow(this.deps),
      updatedAt: defaultNow(this.deps),
    };
    await this.persistRun();
    this.runningPromise = this.runLoop();
    try {
      return await this.runningPromise;
    } finally {
      this.runningPromise = null;
    }
  }

  async resume(): Promise<AutoDriveRunRecord> {
    this.pauseRequested = false;
    if (this.run.status !== "paused") {
      return this.start();
    }
    this.run = {
      ...this.run,
      status: "running",
      stage: "preparing_context",
      updatedAt: defaultNow(this.deps),
      lastStopReason: null,
      navigation: {
        ...this.run.navigation,
        rerouting: false,
        lastDecision: "resume",
      },
    };
    await this.persistRun();
    return this.start();
  }

  async pause(): Promise<void> {
    this.pauseRequested = true;
    if (this.run.sessionId) {
      await this.deps.interruptSubAgentSession({
        sessionId: this.run.sessionId,
        reason: "pause_requested",
      });
    }
    if (!this.runningPromise) {
      this.run = {
        ...this.run,
        status: "paused",
        stage: "paused",
        updatedAt: defaultNow(this.deps),
        lastStopReason: {
          code: "missing_human_input",
          detail: "AutoDrive was paused by the operator.",
        },
        navigation: {
          ...this.run.navigation,
          lastDecision: "missing_human_input",
        },
      };
      await this.persistRun();
    }
  }

  async stop(): Promise<void> {
    this.stopReason = {
      code: "manual_stop",
      detail: "The user stopped the AutoDrive run.",
    };
    if (this.run.sessionId) {
      await this.deps.interruptSubAgentSession({
        sessionId: this.run.sessionId,
        reason: "manual_stop",
      });
    }
    if (!this.runningPromise) {
      await this.finalize("stopped", "stopped", this.stopReason);
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      notifyAutoDriveRunListener(listener, this.run);
    }
  }

  private async persistRun() {
    this.run = {
      ...this.run,
      updatedAt: defaultNow(this.deps),
      totals: {
        ...this.run.totals,
        elapsedMs:
          this.run.startedAt === null
            ? this.run.totals.elapsedMs
            : defaultNow(this.deps) - this.run.startedAt,
      },
      navigation: {
        ...this.run.navigation,
        remainingTokens:
          this.run.budget.maxTokens > 0
            ? Math.max(0, this.run.budget.maxTokens - this.run.totals.consumedTokensEstimate)
            : null,
        remainingIterations: Math.max(0, this.run.budget.maxIterations - this.run.iteration),
        remainingDurationMs:
          this.run.budget.maxDurationMs === null
            ? null
            : Math.max(0, this.run.budget.maxDurationMs - this.run.totals.elapsedMs),
      },
    };
    await this.ledger.writeRun(this.run);
    this.notify();
  }

  private async spawnSession(): Promise<void> {
    if (this.run.sessionId) {
      return;
    }
    const execution = this.sessionExecution ?? resolveBaseExecutionConfig(this.run);
    const session = await this.deps.spawnSubAgentSession({
      workspaceId: this.run.workspaceId,
      threadId: this.run.threadId,
      title: "AutoDrive",
      accessMode: execution.accessMode,
      reasonEffort: coerceReasonEffort(execution.reasoningEffort ?? null),
      modelId: execution.modelId,
      allowNetwork: this.run.riskPolicy.allowNetworkAnalysis,
      parentRunId: this.run.runId,
    });
    this.sessionExecution = execution;
    this.run = {
      ...this.run,
      sessionId: session.sessionId,
    };
    await this.persistRun();
  }

  private async refreshSessionForExecution(nextExecution: AutoDriveExecutionConfig): Promise<void> {
    if (this.run.sessionId && !sameExecutionConfig(this.sessionExecution, nextExecution)) {
      await this.deps.closeSubAgentSession({
        sessionId: this.run.sessionId,
        reason: "execution_profile_refresh",
        force: false,
      });
      this.run = {
        ...this.run,
        sessionId: null,
      };
      this.sessionExecution = null;
    }
    if (this.run.sessionId === null) {
      this.sessionExecution = nextExecution;
      await this.spawnSession();
    }
  }

  private async executeProposal(
    proposal: AutoDriveRouteProposal,
    context: AutoDriveContextSnapshot
  ): Promise<SubAgentWaitResult> {
    await this.refreshSessionForExecution(deriveAdaptiveExecutionConfig(this.run, context));
    const sessionId = this.run.sessionId;
    if (!sessionId) {
      throw new Error("AutoDrive session failed to initialize.");
    }
    await this.deps.sendSubAgentInstruction({
      sessionId,
      instruction: proposal.promptText,
      requestId: `${this.run.runId}:${proposal.iteration}`,
    });
    return this.deps.waitSubAgentSession({
      sessionId,
      timeoutMs: DEFAULT_WAIT_TIMEOUT_MS,
      pollIntervalMs: 500,
    });
  }

  private async defaultValidateIteration(params: {
    deps: AutoDriveControllerDeps;
    iteration: number;
    run: AutoDriveRunRecord;
    context: AutoDriveContextSnapshot;
    proposal: AutoDriveRouteProposal;
  }): Promise<AutoDriveValidationResult> {
    if (
      !params.run.riskPolicy.allowValidationCommands ||
      params.proposal.currentWaypoint.validationPlan.length === 0
    ) {
      return {
        ran: false,
        commands: [],
        success: null,
        failures: [],
        summary: "Validation commands are disabled or unavailable.",
      };
    }

    const commands = resolveValidationCommands({
      context: params.context,
      proposal: params.proposal,
    });
    const failures: string[] = [];
    for (const command of commands) {
      try {
        const result = await params.deps.runRuntimeExecutableSkill({
          request: {
            skillId: "core-bash",
            input: command,
            options: {
              workspaceId: params.run.workspaceId,
              command,
            },
          },
        });
        const exitCode =
          typeof result.metadata?.exitCode === "number" ? result.metadata.exitCode : 0;
        if (exitCode !== 0) {
          failures.push(command);
        }
      } catch {
        failures.push(command);
      }
    }

    return {
      ran: true,
      commands,
      success: failures.length === 0,
      failures,
      summary:
        failures.length === 0
          ? "All validation commands completed successfully."
          : `Validation failed for: ${failures.join(", ")}`,
    };
  }

  private async maybeApplyChatgptDecisionLab(
    context: AutoDriveContextSnapshot
  ): Promise<AutoDriveContextSnapshot> {
    if (
      typeof this.deps.runRuntimeBrowserDebug !== "function" ||
      !shouldAutoRunChatgptDecisionLab({ run: this.run, context })
    ) {
      return context;
    }

    try {
      const result = await this.deps.runRuntimeBrowserDebug({
        workspaceId: this.run.workspaceId,
        operation: "chatgpt_decision_lab",
        prompt: null,
        includeScreenshot: false,
        timeoutMs: 45_000,
        steps: null,
        decisionLab: {
          providerId: "chatgpt",
          question: `Which route should AutoDrive choose for iteration ${context.iteration}? Recommend the strongest option and explain the tradeoff.`,
          options: context.opportunities.candidates.map((candidate) => ({
            id: candidate.id,
            label: candidate.title,
            summary: candidate.summary,
          })),
          constraints: this.run.destination.hardBoundaries,
          allowLiveWebResearch: this.run.riskPolicy.allowNetworkAnalysis,
          chatgptUrl: null,
        },
      });
      const decisionLab = result.decisionLab;
      if (!decisionLab?.recommendedOptionId) {
        return context;
      }
      const recommendedIndex = context.opportunities.candidates.findIndex(
        (candidate) => candidate.id === decisionLab.recommendedOptionId
      );
      if (recommendedIndex < 0) {
        return context;
      }
      const recommendedCandidate = context.opportunities.candidates[recommendedIndex];
      const selectionSummary = [
        `Candidate ${recommendedIndex + 1} (${recommendedCandidate.title}) recommended by ChatGPT decision lab.`,
        decisionLab.decisionMemo,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ");

      this.run = {
        ...this.run,
        lastChatgptDecisionLab: {
          recommendedOptionId: decisionLab.recommendedOptionId ?? null,
          recommendedOption: decisionLab.recommendedOption ?? null,
          alternativeOptionIds: decisionLab.alternativeOptionIds ?? [],
          decisionMemo: decisionLab.decisionMemo ?? null,
          confidence: decisionLab.confidence ?? null,
          assumptions: decisionLab.assumptions ?? [],
          followUpQuestions: decisionLab.followUpQuestions ?? [],
        },
        runtimeDecisionTrace: {
          phase: "progress",
          summary: selectionSummary,
          selectedCandidateId: recommendedCandidate.id,
          selectedCandidateSummary: recommendedCandidate.summary,
          selectionTags: ["chatgpt_decision_lab_auto"],
          representativeCommand: null,
          authoritySources: ["chatgpt_web", "chrome_devtools_mcp"],
          heldOutGuidance: [],
        },
      };
      await this.persistRun();

      return {
        ...context,
        opportunities: {
          ...context.opportunities,
          selectedCandidateId: recommendedCandidate.id,
          selectionSummary,
        },
      };
    } catch (error) {
      logger.error("[AutoDriveRunController] chatgpt decision lab failed", error);
      return context;
    }
  }

  private async finalize(
    status: AutoDriveRunRecord["status"],
    stage: AutoDriveRunRecord["stage"],
    reason: AutoDriveStopReason | null
  ): Promise<AutoDriveRunRecord> {
    if (this.run.sessionId) {
      await this.deps.closeSubAgentSession({
        sessionId: this.run.sessionId,
        reason: reason?.code ?? status,
        force: false,
      });
    }
    this.run = {
      ...this.run,
      status,
      stage,
      completedAt: status === "paused" ? null : defaultNow(this.deps),
      lastStopReason: reason,
      continuationState:
        status === "completed" || status === "stopped" || status === "failed"
          ? resolveStoppedContinuationState(this.run, defaultNow(this.deps))
          : this.run.continuationState,
      navigation: {
        ...this.run.navigation,
        lastDecision: reason?.code ?? status,
      },
    };
    await this.persistRun();
    const latestSummary = this.run.summaries[this.run.summaries.length - 1] ?? null;
    await this.ledger.writeFinalReport({
      run: this.run,
      latestSummary,
      markdown: this.services.buildFinalReport({
        run: this.run,
        latestSummary,
      }),
    });
    return this.run;
  }

  private async finalizePendingOperatorIntervention(): Promise<AutoDriveRunRecord | null> {
    if (this.stopReason) {
      return this.finalize("stopped", "stopped", this.stopReason);
    }
    if (this.pauseRequested) {
      return this.finalize("paused", "paused", {
        code: "missing_human_input",
        detail: "AutoDrive was paused by the operator.",
      });
    }
    return null;
  }

  private async runLoop(): Promise<AutoDriveRunRecord> {
    while (true) {
      const pendingOperatorIntervention = await this.finalizePendingOperatorIntervention();
      if (pendingOperatorIntervention) {
        return pendingOperatorIntervention;
      }
      const preIterationStop = getPreIterationStopReason(this.run);
      if (preIterationStop) {
        const terminalState = resolveTerminalState(preIterationStop);
        return this.finalize(terminalState.status, terminalState.stage, preIterationStop);
      }

      const iteration = this.run.iteration + 1;
      const previousSummary = this.run.summaries[this.run.summaries.length - 1] ?? null;
      this.run = {
        ...this.run,
        iteration,
        stage: "preparing_context",
      };
      await this.persistRun();

      let context = await this.services.synthesizeContext({
        deps: this.deps,
        run: this.run,
        iteration,
        previousSummary,
      });
      context = await this.maybeApplyChatgptDecisionLab(context);
      await this.ledger.writeContext(context);
      this.run = {
        ...this.run,
        navigation: buildNavigationFromContext(this.run, context),
      };
      await this.persistRun();

      this.run = {
        ...this.run,
        stage: "planning_next_task",
      };
      await this.persistRun();
      const proposal = this.services.buildProposal({
        run: this.run,
        context,
        iteration,
        previousSummary,
      });
      const review = this.services.reviewProposal({
        proposal,
        context,
        run: this.run,
      });
      await this.ledger.writeProposal(proposal);
      this.run = {
        ...this.run,
        navigation: buildNavigationFromProposal(this.run, proposal),
      };
      await this.persistRun();

      if (review.shouldReroute) {
        const reroute = buildRerouteFromReview({
          run: this.run,
          iteration,
          review,
          proposal,
          deps: this.deps,
        });
        await this.ledger.writeReroute({
          runId: this.run.runId,
          iteration,
          reroute,
        });
        this.run = {
          ...this.run,
          latestReroute: reroute,
          navigation: {
            ...this.run.navigation,
            rerouting: true,
            rerouteReason: reroute.reason,
            lastDecision: "reroute",
          },
          totals: {
            ...this.run.totals,
            rerouteCount: this.run.totals.rerouteCount + 1,
          },
        };
        await this.persistRun();
        continue;
      }

      if (!review.approved) {
        return this.finalize("paused", "paused", mapProposalReviewToStopReason(review));
      }

      this.run = {
        ...this.run,
        stage: "executing_task",
        totals: {
          ...this.run.totals,
          consumedTokensEstimate:
            this.run.totals.consumedTokensEstimate + estimateTokens(proposal.promptText),
        },
      };
      await this.persistRun();
      const execution = await this.executeProposal(proposal, context);
      const postExecutionIntervention = await this.finalizePendingOperatorIntervention();
      if (postExecutionIntervention) {
        return postExecutionIntervention;
      }
      const task = execution.task;
      if (!task || execution.timedOut) {
        this.run = {
          ...this.run,
          totals: {
            ...this.run.totals,
            repeatedFailureCount: this.run.totals.repeatedFailureCount + 1,
          },
        };
        return this.finalize("failed", "failed", {
          code: "execution_failed",
          detail: execution.timedOut
            ? "The sub-agent execution timed out."
            : "The sub-agent returned no task summary.",
        });
      }

      this.run = {
        ...this.run,
        stage: "validating_result",
        totals: {
          ...this.run.totals,
          consumedTokensEstimate:
            this.run.totals.consumedTokensEstimate + estimateTokens(extractLatestTaskOutput(task)),
        },
      };
      await this.persistRun();
      const validation = await this.services.validateIteration({
        deps: this.deps,
        iteration,
        run: this.run,
        context,
        proposal,
        task,
      });
      const postValidationIntervention = await this.finalizePendingOperatorIntervention();
      if (postValidationIntervention) {
        return postValidationIntervention;
      }
      let summary = await this.services.summarizeIteration({
        iteration,
        run: this.run,
        context,
        proposal,
        validation,
        task,
      });

      this.run = {
        ...this.run,
        stage: "deciding_next_step",
        blockers: summary.blockers,
        currentBlocker: summary.blockers[0] ?? null,
        completedSubgoals: [
          ...new Set([...this.run.completedSubgoals, ...summary.completedSubgoals]),
        ],
        lastValidationSummary: summary.validation.summary,
        totals: {
          ...this.run.totals,
          validationFailureCount:
            this.run.totals.validationFailureCount + (summary.validation.success === false ? 1 : 0),
          noProgressCount:
            summary.progress.overallProgress <= (previousSummary?.progress.overallProgress ?? 0)
              ? this.run.totals.noProgressCount + 1
              : 0,
          repeatedFailureCount:
            summary.status === "failed" ? this.run.totals.repeatedFailureCount + 1 : 0,
        },
        navigation: {
          ...this.run.navigation,
          currentMilestone: summary.progress.currentMilestone,
          overallProgress: summary.progress.overallProgress,
          waypointCompletion: summary.progress.waypointCompletion,
          waypointStatus: summary.waypoint.status,
          remainingMilestones: summary.progress.remainingMilestones,
          offRoute: summary.routeHealth.offRoute,
          rerouting: summary.routeHealth.rerouteRecommended,
          rerouteReason: summary.routeHealth.rerouteReason,
          remainingBlockers: summary.progress.remainingBlockers,
          arrivalConfidence: summary.progress.arrivalConfidence,
          stopRisk: summary.progress.stopRisk,
        },
      };
      const decision = this.services.decideNextStep({
        run: this.run,
        latestSummary: summary,
        criticConfidence: review.confidence,
        hasDestructiveChange: hasDestructiveSignals(summary),
        hasDependencyChange: summary.changedFiles.some((file) =>
          /package\.json|pnpm-lock|Cargo\.toml|Cargo\.lock/i.test(file)
        ),
        executionTuning: context.executionTuning,
      });

      if (decision.action === "reroute" && decision.reroute) {
        summary = {
          ...summary,
          reroute: decision.reroute,
          routeHealth: {
            ...summary.routeHealth,
            rerouteRecommended: true,
            rerouteReason: decision.reroute.reason,
          },
        };
      }

      const publishOutcome =
        decision.reason?.code === "goal_reached"
          ? await maybePublishGoalReachedOutcome({
              deps: this.deps,
              run: this.run,
              context,
              summary,
            })
          : null;

      if (publishOutcome) {
        summary = {
          ...summary,
          publish: publishOutcome,
        };
      }
      const terminalReason = resolvePublishAwareStopReason({
        decisionReason: decision.reason ?? null,
        publishOutcome,
      });

      this.run = {
        ...this.run,
        summaries: [...this.run.summaries, summary],
        latestReroute: summary.reroute,
        latestPublishOutcome: publishOutcome,
        continuationState:
          decision.action === "continue" && summary.goalReached
            ? advanceContinuationState({
                run: this.run,
                summary,
                now: defaultNow(this.deps),
              }).continuationState
            : this.run.continuationState,
        navigation: {
          ...this.run.navigation,
          rerouting: decision.action === "reroute",
          rerouteReason: decision.reroute?.reason ?? this.run.navigation.rerouteReason,
          lastDecision: terminalReason?.code ?? decision.action,
        },
      };
      await this.ledger.writeSummary(summary);
      if (summary.reroute) {
        await this.ledger.writeReroute({
          runId: this.run.runId,
          iteration,
          reroute: summary.reroute,
        });
        this.run = {
          ...this.run,
          totals: {
            ...this.run.totals,
            rerouteCount: this.run.totals.rerouteCount + 1,
          },
        };
      }
      await this.persistRun();

      if (decision.action === "continue") {
        continue;
      }
      if (decision.action === "reroute") {
        continue;
      }
      if (decision.action === "pause") {
        return this.finalize("paused", "paused", terminalReason);
      }
      if (!terminalReason) {
        return this.finalize("failed", "failed", {
          code: "execution_failed",
          detail: "AutoDrive tried to stop without recording a terminal reason.",
        });
      }
      const terminalState = resolveTerminalState(terminalReason);
      return this.finalize(terminalState.status, terminalState.stage, terminalReason);
    }
  }
}
