import type {
  AgentTaskAutoDriveState,
  HugeCodeAutoDriveStopReason,
  HugeCodeMissionControlSnapshot,
  HugeCodeRunState,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoDriveRunController } from "../../../application/runtime/facades/runtimeAutoDriveController";
import { createDeterministicAutoDriveHarness } from "../../../application/runtime/facades/runtimeAutoDriveDeterministic";
import type {
  AutoDriveRoutePreference,
  AutoDriveRunRecord,
} from "../../../application/runtime/types/autoDrive";
import { Badge } from "../../../design-system";
import { Card, CardDescription, CardTitle } from "../../../design-system";
import { SectionHeader } from "../../../design-system";
import { Surface } from "../../../design-system";
import { ComposerMetaBar } from "../../composer/components/ComposerMetaBar";
import { ComposerAutoDriveStatusBar } from "../../composer/components/ComposerMetaBarAutoDriveMeta";
import { fromRuntimeRoutePreference } from "../hooks/autoDriveRuntimeSnapshotAdapter";
import { useAutoDriveController } from "../hooks/useAutoDriveController";
import * as styles from "./AutoDriveNavigationFixture.css";

type FixtureDraftState = {
  autoDriveDraft?: ReturnType<typeof useAutoDriveController>["draft"] | null;
};

type FixtureScenario = "budget-stop" | "goal-reached" | "reroute-stop";

type FixtureConfig = Readonly<{
  scenario: FixtureScenario;
  stepDelayMs: number;
  persistKey: string | null;
  resetState: boolean;
  maxTokens: number;
  maxIterations: number;
}>;

type FixtureRuntimeControl = NonNullable<
  Parameters<typeof useAutoDriveController>[0]["runtimeControl"]
>;
type FixtureStartTaskInput = Parameters<FixtureRuntimeControl["startTask"]>[0];

function parseFixtureScenario(value: string | null): FixtureScenario {
  if (value === "reroute-stop") {
    return "reroute-stop";
  }
  return value === "goal-reached" ? "goal-reached" : "budget-stop";
}

function parsePositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildFixtureDraftState(
  fixtureConfig: Pick<FixtureConfig, "scenario" | "maxTokens" | "maxIterations">
): FixtureDraftState {
  return {
    autoDriveDraft: {
      enabled: true,
      destination: {
        title: "Upgrade AutoDrive into a navigation system",
        endState:
          "UI shows start state, route, waypoint, reroute and stop reason\nLedger records every navigation step",
        doneDefinition:
          "Show route summary in UI\nShow current waypoint in UI\nWrite run/context/proposal/summary/final-report artifacts",
        avoid:
          "Do not break manual composer mode\nDo not widen scope outside AutoDrive core surfaces",
        routePreference:
          fixtureConfig.scenario === "reroute-stop" ? "speed_first" : "validation_first",
      },
      budget: {
        maxTokens: fixtureConfig.maxTokens,
        maxIterations: fixtureConfig.maxIterations,
        maxDurationMinutes: 1,
        maxFilesPerIteration: 4,
        maxNoProgressIterations: 2,
        maxValidationFailures: 2,
        maxReroutes: 1,
      },
      riskPolicy: {
        pauseOnDestructiveChange: true,
        pauseOnDependencyChange: true,
        pauseOnLowConfidence: fixtureConfig.scenario === "reroute-stop" ? false : true,
        pauseOnHumanCheckpoint: fixtureConfig.scenario === "reroute-stop" ? false : true,
        allowNetworkAnalysis: false,
        allowValidationCommands: true,
        minimumConfidence: "medium",
      },
    },
  };
}

function toMissionRoutePreference(value: AutoDriveRoutePreference) {
  if (value === "stability_first") {
    return "stability_first" as const;
  }
  if (value === "speed_first") {
    return "speed_first" as const;
  }
  return "balanced" as const;
}

function mapRunStatusToMissionState(run: AutoDriveRunRecord): HugeCodeRunState {
  switch (run.status) {
    case "created":
      return "draft";
    case "running":
      if (run.stage === "preparing_context") {
        return "preparing";
      }
      if (run.stage === "validating_result") {
        return "validating";
      }
      return "running";
    case "paused":
      return "paused";
    case "completed":
      return "review_ready";
    case "failed":
      return "failed";
    case "stopped":
      return "cancelled";
    default:
      return "draft";
  }
}

function mapRunStatusToTaskStatus(run: AutoDriveRunRecord): HugeCodeTaskSummary["status"] {
  switch (mapRunStatusToMissionState(run)) {
    case "draft":
      return "ready";
    case "preparing":
    case "running":
    case "validating":
      return "running";
    case "paused":
      return "paused";
    case "review_ready":
      return "review_ready";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "ready";
  }
}

function mapStopReason(
  reason: AutoDriveRunRecord["lastStopReason"]
): HugeCodeAutoDriveStopReason | null {
  switch (reason?.code) {
    case "goal_reached":
      return "completed";
    case "missing_human_input":
      return "paused";
    case "token_budget_exhausted":
    case "max_iterations_reached":
    case "duration_budget_exhausted":
      return "budget_exhausted";
    case "repeated_validation_failures":
      return "validation_failed";
    case "reroute_limit_reached":
    case "no_meaningful_progress":
      return "rerouted";
    case "manual_stop":
      return "operator_intervened";
    case "execution_failed":
      return "failed";
    default:
      return null;
  }
}

function buildCompletedWaypoints(run: AutoDriveRunRecord): string[] {
  if (run.summaries.length > 0) {
    return run.summaries
      .filter((summary) => summary.waypoint.status === "arrived")
      .map((summary) => summary.waypoint.title);
  }
  return run.completedSubgoals;
}

function buildMissionControlSnapshot(
  run: AutoDriveRunRecord | null
): HugeCodeMissionControlSnapshot {
  const workspace = {
    id: "workspace-deterministic",
    name: "AutoDrive Fixture",
    rootPath: "fixtures/autodrive-navigation",
    connected: true,
    defaultProfileId: null,
  };

  if (!run) {
    return {
      source: "runtime_snapshot_v1",
      generatedAt: Date.now(),
      workspaces: [workspace],
      tasks: [],
      runs: [],
      reviewPacks: [],
    };
  }

  const missionState = mapRunStatusToMissionState(run);
  const completedWaypoints = buildCompletedWaypoints(run);
  const task: HugeCodeTaskSummary = {
    id: "thread-deterministic",
    workspaceId: run.workspaceId,
    title: run.destination.title,
    objective: run.destination.title,
    origin: {
      kind: "thread",
      threadId: "thread-deterministic",
      runId: run.runId,
      requestId: null,
    },
    mode: "delegate",
    modeSource: "execution_profile",
    status: mapRunStatusToTaskStatus(run),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    currentRunId:
      run.status === "completed" || run.status === "stopped" || run.status === "failed"
        ? null
        : run.runId,
    latestRunId: run.runId,
    latestRunState: missionState,
    nextAction: null,
    lineage: null,
  };

  const validations = run.lastValidationSummary
    ? [
        {
          id: `${run.runId}:validation`,
          label: "Validation",
          outcome: run.status === "failed" ? "failed" : "passed",
          summary: run.lastValidationSummary,
          startedAt: run.updatedAt,
          finishedAt: run.updatedAt,
        } as const,
      ]
    : [];

  const warnings = run.currentBlocker ? [run.currentBlocker] : [];
  const stopReason = mapStopReason(run.lastStopReason);
  const runSummary: HugeCodeRunSummary = {
    id: run.runId,
    taskId: task.id,
    workspaceId: run.workspaceId,
    state: missionState,
    title: run.destination.title,
    summary:
      run.lastStopReason?.detail ??
      run.navigation.routeSummary ??
      run.navigation.currentWaypointObjective ??
      run.destination.title,
    startedAt: run.startedAt,
    finishedAt: run.completedAt,
    updatedAt: run.updatedAt,
    currentStepIndex: run.iteration,
    pendingIntervention: null,
    executionProfile: null,
    profileReadiness: null,
    routing: null,
    approval: null,
    reviewDecision: null,
    intervention: null,
    operatorState: null,
    nextAction: null,
    warnings,
    validations,
    artifacts: [],
    autoDrive: {
      enabled: true,
      destination: {
        title: run.destination.title,
        desiredEndState: run.destination.desiredEndState,
        doneDefinition: {
          arrivalCriteria: run.destination.doneDefinition.arrivalCriteria,
          requiredValidation: run.destination.doneDefinition.requiredValidation,
          waypointIndicators: run.destination.doneDefinition.waypointIndicators,
        },
        hardBoundaries: run.destination.hardBoundaries,
        routePreference: toMissionRoutePreference(run.destination.routePreference),
      },
      budget: {
        maxTokens: run.budget.maxTokens,
        maxIterations: run.budget.maxIterations,
        maxDurationMs: run.budget.maxDurationMs,
        maxFilesPerIteration: run.budget.maxFilesPerIteration,
        maxNoProgressIterations: run.budget.maxNoProgressIterations,
        maxValidationFailures: run.budget.maxValidationFailures,
        maxReroutes: run.budget.maxReroutes,
      },
      riskPolicy: {
        pauseOnDestructiveChange: run.riskPolicy.pauseOnDestructiveChange,
        pauseOnDependencyChange: run.riskPolicy.pauseOnDependencyChange,
        pauseOnLowConfidence: run.riskPolicy.pauseOnLowConfidence,
        pauseOnHumanCheckpoint: run.riskPolicy.pauseOnHumanCheckpoint,
        allowNetworkAnalysis: run.riskPolicy.allowNetworkAnalysis,
        allowValidationCommands: run.riskPolicy.allowValidationCommands,
        minimumConfidence: run.riskPolicy.minimumConfidence,
      },
      navigation: {
        activeWaypoint: run.navigation.currentWaypointTitle,
        completedWaypoints,
        pendingWaypoints: run.navigation.remainingMilestones,
        lastProgressAt: run.updatedAt,
        rerouteCount: run.totals.rerouteCount,
        validationFailureCount: run.totals.validationFailureCount,
        noProgressIterations: run.totals.noProgressCount,
      },
      stop: stopReason
        ? {
            reason: stopReason,
            summary: run.lastStopReason?.detail ?? null,
            at: run.completedAt ?? run.updatedAt,
          }
        : null,
    },
    completionReason: run.lastStopReason?.detail ?? null,
    reviewPackId: null,
    lineage: null,
    ledger: null,
    governance: null,
    placement: null,
  };

  return {
    source: "runtime_snapshot_v1",
    generatedAt: Date.now(),
    workspaces: [workspace],
    tasks: [task],
    runs: [runSummary],
    reviewPacks: [],
  };
}

function buildHarnessPersistence(persistKey: string | null) {
  if (!persistKey) {
    return undefined;
  }
  const storageKey = `autodrive-fixture:${persistKey}`;
  return {
    load: () => window.sessionStorage.getItem(storageKey),
    save: (value: string) => {
      window.sessionStorage.setItem(storageKey, value);
    },
    clear: () => {
      window.sessionStorage.removeItem(storageKey);
    },
  };
}

function normalizeFixtureReasonEffort(
  value: FixtureStartTaskInput["reasonEffort"]
): "low" | "medium" | "high" | null {
  if (value === "xhigh") {
    return "high";
  }
  return value ?? null;
}

function buildRuntimeRunRecord(params: {
  autoDrive: AgentTaskAutoDriveState;
  accessMode: "read-only" | "on-request" | "full-access";
  reasonEffort: "low" | "medium" | "high" | null;
  modelId: string | null;
  title: string | null | undefined;
}): AutoDriveRunRecord {
  const now = Date.now();
  return {
    schemaVersion: "autodrive-run/v2",
    runId: "autodrive-e2e-run",
    workspaceId: "workspace-deterministic",
    workspacePath: "fixtures/autodrive-navigation",
    threadId: "thread-deterministic",
    status: "created",
    stage: "created",
    destination: {
      title: params.autoDrive.destination.title,
      desiredEndState: params.autoDrive.destination.desiredEndState ?? [],
      doneDefinition: {
        arrivalCriteria: params.autoDrive.destination.doneDefinition?.arrivalCriteria ?? [],
        requiredValidation: params.autoDrive.destination.doneDefinition?.requiredValidation ?? [],
        waypointIndicators: params.autoDrive.destination.doneDefinition?.waypointIndicators ?? [],
      },
      hardBoundaries: params.autoDrive.destination.hardBoundaries ?? [],
      routePreference: fromRuntimeRoutePreference(params.autoDrive.destination.routePreference),
    },
    budget: {
      maxTokens: params.autoDrive.budget?.maxTokens ?? 1200,
      maxIterations: params.autoDrive.budget?.maxIterations ?? 2,
      maxDurationMs: params.autoDrive.budget?.maxDurationMs ?? 60_000,
      maxFilesPerIteration: params.autoDrive.budget?.maxFilesPerIteration ?? 4,
      maxNoProgressIterations: params.autoDrive.budget?.maxNoProgressIterations ?? 2,
      maxValidationFailures: params.autoDrive.budget?.maxValidationFailures ?? 2,
      maxReroutes: params.autoDrive.budget?.maxReroutes ?? 1,
    },
    riskPolicy: {
      pauseOnDestructiveChange: params.autoDrive.riskPolicy?.pauseOnDestructiveChange ?? true,
      pauseOnDependencyChange: params.autoDrive.riskPolicy?.pauseOnDependencyChange ?? true,
      pauseOnLowConfidence: params.autoDrive.riskPolicy?.pauseOnLowConfidence ?? true,
      pauseOnHumanCheckpoint: params.autoDrive.riskPolicy?.pauseOnHumanCheckpoint ?? true,
      allowNetworkAnalysis: params.autoDrive.riskPolicy?.allowNetworkAnalysis ?? false,
      allowValidationCommands: params.autoDrive.riskPolicy?.allowValidationCommands ?? true,
      minimumConfidence: params.autoDrive.riskPolicy?.minimumConfidence ?? "medium",
    },
    execution: {
      accessMode: params.accessMode,
      modelId: params.modelId,
      reasoningEffort: params.reasonEffort,
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
      destinationSummary: params.title?.trim() || params.autoDrive.destination.title,
      startStateSummary: null,
      routeSummary: null,
      currentWaypointTitle: null,
      currentWaypointObjective: null,
      currentWaypointArrivalCriteria: [],
      waypointStatus: null,
      remainingMilestones: [],
      currentMilestone: null,
      overallProgress: 0,
      waypointCompletion: 0,
      offRoute: false,
      rerouting: false,
      rerouteReason: null,
      remainingBlockers: [],
      arrivalConfidence: params.autoDrive.riskPolicy?.minimumConfidence ?? "medium",
      stopRisk: "low",
      remainingTokens: params.autoDrive.budget?.maxTokens ?? 1200,
      remainingIterations: params.autoDrive.budget?.maxIterations ?? 2,
      remainingDurationMs: params.autoDrive.budget?.maxDurationMs ?? 60_000,
      lastDecision: null,
    },
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    lastStopReason: null,
    sessionId: null,
    lastValidationSummary: null,
    currentBlocker: null,
    latestReroute: null,
  };
}

export function AutoDriveNavigationFixture() {
  const fixtureConfig = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const scenario = parseFixtureScenario(searchParams.get("scenario"));
    const stepDelayMs = parsePositiveNumber(searchParams.get("step-delay-ms"), 0);
    const persistKey = searchParams.get("persist-key")?.trim() || null;
    const resetState = searchParams.get("reset-state") === "1";
    return {
      scenario,
      stepDelayMs,
      persistKey,
      resetState,
      maxTokens: scenario === "budget-stop" ? 1200 : 4000,
      maxIterations: scenario === "budget-stop" ? 2 : 3,
    } satisfies FixtureConfig;
  }, []);
  const harness = useMemo(
    () =>
      createDeterministicAutoDriveHarness({
        scenario: fixtureConfig.scenario,
        stepDelayMs: fixtureConfig.stepDelayMs,
        persistence: buildHarnessPersistence(fixtureConfig.persistKey),
      }),
    [fixtureConfig.persistKey, fixtureConfig.scenario, fixtureConfig.stepDelayMs]
  );
  const [artifacts, setArtifacts] = useState<Array<{ path: string; content: string }>>(() =>
    harness.listArtifacts()
  );
  const [draftState, setDraftState] = useState<FixtureDraftState>(() =>
    buildFixtureDraftState(fixtureConfig)
  );
  const [missionControlProjection, setMissionControlProjection] =
    useState<HugeCodeMissionControlSnapshot>(() => buildMissionControlSnapshot(null));
  const draftStateRef = useRef(draftState);
  const controllerRef = useRef<AutoDriveRunController | null>(null);
  const controllerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

  const detachController = useCallback(() => {
    controllerCleanupRef.current?.();
    controllerCleanupRef.current = null;
    controllerRef.current = null;
  }, []);

  const attachController = useCallback(
    (run: AutoDriveRunRecord) => {
      detachController();
      const controller = new AutoDriveRunController({
        deps: harness.deps,
        ledger: harness.createLedger("workspace-deterministic"),
        run,
      });
      controllerCleanupRef.current = controller.subscribe((nextRun) => {
        setMissionControlProjection(buildMissionControlSnapshot(nextRun));
      });
      controllerRef.current = controller;
      setMissionControlProjection(buildMissionControlSnapshot(run));
      return controller;
    },
    [detachController, harness]
  );

  const getThreadCodexParams = useCallback(() => draftStateRef.current, []);
  const patchThreadCodexParams = useCallback(
    (_workspaceId: string, _threadId: string, patch: FixtureDraftState) => {
      setDraftState((current) => ({
        ...current,
        ...patch,
      }));
    },
    []
  );

  useEffect(() => harness.subscribe(setArtifacts), [harness]);

  useEffect(() => {
    let cancelled = false;
    const resetMarkerKey = fixtureConfig.persistKey
      ? `autodrive-fixture-reset:${fixtureConfig.persistKey}`
      : null;
    const shouldResetPersistedState =
      fixtureConfig.resetState &&
      (!resetMarkerKey || window.sessionStorage.getItem(resetMarkerKey) !== "1");

    detachController();
    setDraftState(buildFixtureDraftState(fixtureConfig));

    if (shouldResetPersistedState || !fixtureConfig.persistKey) {
      harness.clearArtifacts();
      setMissionControlProjection(buildMissionControlSnapshot(null));
      if (resetMarkerKey) {
        window.sessionStorage.setItem(resetMarkerKey, "1");
      }
      return () => {
        cancelled = true;
      };
    }

    void harness
      .loadLatestRun({
        workspaceId: "workspace-deterministic",
        threadId: "thread-deterministic",
      })
      .then((recoveredRun) => {
        if (cancelled) {
          return;
        }
        if (!recoveredRun) {
          setMissionControlProjection(buildMissionControlSnapshot(null));
          return;
        }
        attachController(recoveredRun);
      });

    return () => {
      cancelled = true;
    };
  }, [attachController, detachController, fixtureConfig, harness]);

  useEffect(
    () => () => {
      detachController();
    },
    [detachController]
  );

  const runtimeControl = useMemo<FixtureRuntimeControl>(
    () => ({
      startTask: async (input) => {
        harness.clearArtifacts();
        const controller = attachController(
          buildRuntimeRunRecord({
            autoDrive: input.autoDrive ?? {
              enabled: true,
              destination: {
                title: input.title?.trim() || "AutoDrive mission",
                desiredEndState: [],
                doneDefinition: null,
                hardBoundaries: [],
                routePreference: "balanced",
              },
            },
            accessMode: input.accessMode ?? "on-request",
            reasonEffort: normalizeFixtureReasonEffort(input.reasonEffort),
            modelId: input.modelId ?? null,
            title: input.title,
          })
        );
        void controller.start();
        const run = controller.getSnapshot();
        const summary = {
          taskId: run.runId,
          workspaceId: run.workspaceId,
          threadId: run.threadId,
          title: run.destination.title,
          status: "running",
          accessMode: input.accessMode ?? "on-request",
          currentStep: run.iteration,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          startedAt: Date.now(),
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
        } satisfies Awaited<ReturnType<FixtureRuntimeControl["startTask"]>>;
        return summary;
      },
      interveneTask: async (input) => {
        const controller = controllerRef.current;
        if (!controller) {
          return {
            accepted: false,
            action: input.action,
            taskId: input.taskId,
            status: null,
            outcome: "unavailable",
          } satisfies Awaited<ReturnType<NonNullable<FixtureRuntimeControl["interveneTask"]>>>;
        }
        if (input.action === "pause") {
          await controller.pause();
        } else if (input.action === "resume") {
          void controller.resume();
        } else if (input.action === "cancel") {
          await controller.stop();
        }
        return {
          accepted:
            input.action === "pause" || input.action === "resume" || input.action === "cancel",
          action: input.action,
          taskId: input.taskId,
          status:
            input.action === "pause"
              ? "paused"
              : input.action === "cancel"
                ? "cancelled"
                : "running",
          outcome: "submitted",
        } satisfies Awaited<ReturnType<NonNullable<FixtureRuntimeControl["interveneTask"]>>>;
      },
    }),
    [attachController, harness]
  );

  const autoDrive = useAutoDriveController({
    activeWorkspace: {
      id: "workspace-deterministic",
      name: "AutoDrive Fixture",
      path: "fixtures/autodrive-navigation",
      connected: true,
      settings: {
        sidebarCollapsed: false,
      },
    },
    activeThreadId: "thread-deterministic",
    accessMode: "on-request",
    selectedModelId: "gpt-5",
    selectedEffort: "medium",
    missionControlProjection,
    runtimeControl,
    runtimeOverrides: {
      launchTaskThroughRuntimeControl: true,
    },
    threadCodexParamsVersion: 1,
    getThreadCodexParams,
    patchThreadCodexParams,
  });

  return (
    <div className={styles.page} data-visual-fixture="autodrive-navigation">
      <div className={styles.shell}>
        <Surface className={styles.headerPanel} padding="lg" tone="elevated">
          <SectionHeader
            title={
              <div className={styles.header}>
                <CardTitle className={styles.title}>AutoDrive Navigation Fixture</CardTitle>
                <CardDescription className={styles.subtitle}>
                  Deterministic end-to-end surface for route planning, waypoint execution, hard
                  stops and ledger visibility.
                </CardDescription>
              </div>
            }
            meta={
              <Badge tone="neutral" shape="chip" size="md">
                Scenario {fixtureConfig.scenario}
              </Badge>
            }
            actions={
              <Badge tone="neutral" shape="chip" size="md">
                Step delay {fixtureConfig.stepDelayMs}ms
              </Badge>
            }
          />
          {fixtureConfig.persistKey ? (
            <div className={styles.headerMetaRow}>
              <Badge tone="neutral" shape="chip" size="md">
                Recovery key {fixtureConfig.persistKey}
              </Badge>
            </div>
          ) : null}
        </Surface>
        <ComposerMetaBar
          disabled={false}
          collaborationModes={[]}
          selectedCollaborationModeId={null}
          onSelectCollaborationMode={() => undefined}
          models={[
            {
              id: "gpt-5",
              model: "gpt-5",
              displayName: "GPT-5",
              available: true,
            },
          ]}
          selectedModelId="gpt-5"
          onSelectModel={() => undefined}
          reasoningOptions={["medium"]}
          selectedEffort="medium"
          onSelectEffort={() => undefined}
          reasoningSupported={true}
          accessMode="on-request"
          onSelectAccessMode={() => undefined}
          executionOptions={[
            { value: "runtime", label: "Runtime" },
            { value: "local-cli", label: "Local CLI" },
          ]}
          selectedExecutionMode="runtime"
          onSelectExecutionMode={() => undefined}
          autoDrive={{
            enabled: autoDrive.enabled,
            destination: autoDrive.draft.destination,
            budget: autoDrive.draft.budget,
            riskPolicy: autoDrive.draft.riskPolicy,
            preset: autoDrive.preset,
            controls: autoDrive.controls,
            recovering: autoDrive.recovering,
            recoverySummary: autoDrive.recoverySummary,
            activity: autoDrive.activity,
            readiness: autoDrive.readiness,
            run: autoDrive.run
              ? {
                  status: autoDrive.run.status,
                  stage: autoDrive.run.stage,
                  iteration: autoDrive.run.iteration,
                  consumedTokensEstimate: autoDrive.run.totals.consumedTokensEstimate,
                  maxTokens: autoDrive.run.budget.maxTokens,
                  maxIterations: autoDrive.run.budget.maxIterations,
                  startStateSummary: autoDrive.run.navigation.startStateSummary,
                  destinationSummary: autoDrive.run.navigation.destinationSummary,
                  routeSummary: autoDrive.run.navigation.routeSummary,
                  currentMilestone: autoDrive.run.navigation.currentMilestone,
                  currentWaypointTitle: autoDrive.run.navigation.currentWaypointTitle,
                  currentWaypointObjective: autoDrive.run.navigation.currentWaypointObjective,
                  currentWaypointArrivalCriteria:
                    autoDrive.run.navigation.currentWaypointArrivalCriteria,
                  remainingMilestones: autoDrive.run.navigation.remainingMilestones,
                  offRoute: autoDrive.run.navigation.offRoute,
                  rerouting: autoDrive.run.navigation.rerouting,
                  rerouteReason: autoDrive.run.navigation.rerouteReason,
                  overallProgress: autoDrive.run.navigation.overallProgress,
                  waypointCompletion: autoDrive.run.navigation.waypointCompletion,
                  stopRisk: autoDrive.run.navigation.stopRisk,
                  arrivalConfidence: autoDrive.run.navigation.arrivalConfidence,
                  remainingTokens: autoDrive.run.navigation.remainingTokens,
                  remainingIterations: autoDrive.run.navigation.remainingIterations,
                  remainingDurationMs: autoDrive.run.navigation.remainingDurationMs,
                  remainingBlockers: autoDrive.run.navigation.remainingBlockers,
                  lastValidationSummary: autoDrive.run.lastValidationSummary ?? null,
                  stopReason: autoDrive.run.lastStopReason?.detail ?? null,
                  lastDecision: autoDrive.run.navigation.lastDecision,
                  runtimeScenarioProfile: autoDrive.run.runtimeScenarioProfile ?? null,
                  runtimeDecisionTrace: autoDrive.run.runtimeDecisionTrace ?? null,
                  runtimeOutcomeFeedback: autoDrive.run.runtimeOutcomeFeedback ?? null,
                  runtimeAutonomyState: autoDrive.run.runtimeAutonomyState ?? null,
                  latestReroute: autoDrive.run.latestReroute
                    ? {
                        mode: autoDrive.run.latestReroute.mode,
                        reason: autoDrive.run.latestReroute.reason,
                        trigger: autoDrive.run.latestReroute.trigger,
                        previousRouteSummary: autoDrive.run.latestReroute.previousRouteSummary,
                        nextRouteSummary: autoDrive.run.latestReroute.nextRouteSummary,
                      }
                    : null,
                }
              : null,
            onToggleEnabled: autoDrive.setEnabled,
            onChangeDestination: autoDrive.setDestinationValue,
            onChangeBudget: autoDrive.setBudgetValue,
            onChangeRiskPolicy: autoDrive.setRiskPolicyValue,
          }}
        />
        {autoDrive.enabled || autoDrive.run ? (
          <ComposerAutoDriveStatusBar
            autoDrive={{
              enabled: autoDrive.enabled,
              destination: autoDrive.draft.destination,
              budget: autoDrive.draft.budget,
              riskPolicy: autoDrive.draft.riskPolicy,
              preset: autoDrive.preset,
              controls: autoDrive.controls,
              recovering: autoDrive.recovering,
              recoverySummary: autoDrive.recoverySummary,
              activity: autoDrive.activity,
              readiness: autoDrive.readiness,
              run: autoDrive.run
                ? {
                    status: autoDrive.run.status,
                    stage: autoDrive.run.stage,
                    iteration: autoDrive.run.iteration,
                    consumedTokensEstimate: autoDrive.run.totals.consumedTokensEstimate,
                    maxTokens: autoDrive.run.budget.maxTokens,
                    maxIterations: autoDrive.run.budget.maxIterations,
                    startStateSummary: autoDrive.run.navigation.startStateSummary,
                    destinationSummary: autoDrive.run.navigation.destinationSummary,
                    routeSummary: autoDrive.run.navigation.routeSummary,
                    currentMilestone: autoDrive.run.navigation.currentMilestone,
                    currentWaypointTitle: autoDrive.run.navigation.currentWaypointTitle,
                    currentWaypointObjective: autoDrive.run.navigation.currentWaypointObjective,
                    currentWaypointArrivalCriteria:
                      autoDrive.run.navigation.currentWaypointArrivalCriteria,
                    remainingMilestones: autoDrive.run.navigation.remainingMilestones,
                    offRoute: autoDrive.run.navigation.offRoute,
                    rerouting: autoDrive.run.navigation.rerouting,
                    rerouteReason: autoDrive.run.navigation.rerouteReason,
                    overallProgress: autoDrive.run.navigation.overallProgress,
                    waypointCompletion: autoDrive.run.navigation.waypointCompletion,
                    stopRisk: autoDrive.run.navigation.stopRisk,
                    arrivalConfidence: autoDrive.run.navigation.arrivalConfidence,
                    remainingTokens: autoDrive.run.navigation.remainingTokens,
                    remainingIterations: autoDrive.run.navigation.remainingIterations,
                    remainingDurationMs: autoDrive.run.navigation.remainingDurationMs,
                    remainingBlockers: autoDrive.run.navigation.remainingBlockers,
                    lastValidationSummary: autoDrive.run.lastValidationSummary ?? null,
                    stopReason: autoDrive.run.lastStopReason?.detail ?? null,
                    lastDecision: autoDrive.run.navigation.lastDecision,
                    runtimeScenarioProfile: autoDrive.run.runtimeScenarioProfile ?? null,
                    runtimeDecisionTrace: autoDrive.run.runtimeDecisionTrace ?? null,
                    runtimeOutcomeFeedback: autoDrive.run.runtimeOutcomeFeedback ?? null,
                    runtimeAutonomyState: autoDrive.run.runtimeAutonomyState ?? null,
                    latestReroute: autoDrive.run.latestReroute
                      ? {
                          mode: autoDrive.run.latestReroute.mode,
                          reason: autoDrive.run.latestReroute.reason,
                          trigger: autoDrive.run.latestReroute.trigger,
                          previousRouteSummary: autoDrive.run.latestReroute.previousRouteSummary,
                          nextRouteSummary: autoDrive.run.latestReroute.nextRouteSummary,
                        }
                      : null,
                  }
                : null,
              onToggleEnabled: autoDrive.setEnabled,
              onChangeDestination: autoDrive.setDestinationValue,
              onChangeBudget: autoDrive.setBudgetValue,
              onChangeRiskPolicy: autoDrive.setRiskPolicyValue,
            }}
            autoDriveBackendLabel="Automatic runtime routing"
            disabled={false}
            visibilityState="visible"
          />
        ) : null}
        <Surface
          aria-label="AutoDrive ledger"
          className={styles.ledgerPanel}
          padding="lg"
          tone="default"
        >
          <SectionHeader
            title="Ledger artifacts"
            meta={
              <Badge tone="neutral" shape="chip" size="md">
                {artifacts.length} artifact(s)
              </Badge>
            }
          />
          <div className={styles.ledgerList}>
            {artifacts.length > 0 ? (
              artifacts.map((artifact) => (
                <Card
                  key={artifact.path}
                  data-testid="autodrive-ledger-path"
                  className={styles.ledgerItem}
                  variant="subtle"
                  padding="sm"
                >
                  <CardTitle className={styles.ledgerPath}>
                    <code>{artifact.path}</code>
                  </CardTitle>
                  <CardDescription className={styles.ledgerPreview}>
                    {artifact.content.slice(0, 220)}
                  </CardDescription>
                </Card>
              ))
            ) : (
              <Card
                data-testid="autodrive-ledger-path"
                className={styles.ledgerEmpty}
                variant="subtle"
                padding="sm"
              >
                <CardTitle className={styles.ledgerPath}>
                  <code>.hugecode/runs/autodrive-e2e-run/pending/route-plan.json</code>
                </CardTitle>
                <CardDescription className={styles.ledgerEmptyText}>
                  No artifacts written yet.
                </CardDescription>
              </Card>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}
