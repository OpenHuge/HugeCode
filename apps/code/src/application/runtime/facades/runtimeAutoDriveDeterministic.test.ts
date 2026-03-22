import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeterministicAutoDriveHarness } from "./runtimeAutoDriveDeterministic";

describe("createDeterministicAutoDriveHarness", () => {
  it("keeps artifact subscribers isolated when one listener throws", () => {
    const harness = createDeterministicAutoDriveHarness();
    const failingListener = vi.fn(() => {
      throw new Error("artifact boom");
    });
    const healthyListener = vi.fn();

    expect(() => harness.subscribe(failingListener)).not.toThrow();
    expect(() => harness.subscribe(healthyListener)).not.toThrow();
    expect(healthyListener).toHaveBeenCalledTimes(1);

    expect(() => harness.clearArtifacts()).not.toThrow();
    expect(failingListener).toHaveBeenCalledTimes(2);
    expect(healthyListener).toHaveBeenCalledTimes(2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("supports a goal-reached scenario for arrival QA", async () => {
    const harness = createDeterministicAutoDriveHarness({
      scenario: "goal-reached",
    });

    await harness.deps.waitSubAgentSession({
      sessionId: "session-1",
      timeoutMs: 1000,
      pollIntervalMs: 10,
    });
    const result = await harness.deps.waitSubAgentSession({
      sessionId: "session-1",
      timeoutMs: 1000,
      pollIntervalMs: 10,
    });

    const output = result.task?.steps[0]?.output ?? "";
    expect(output).toContain("Goal reached: yes");
    expect(output).toContain("destination arrival checks");
  });

  it("supports a reroute-stop scenario for off-route QA", async () => {
    const harness = createDeterministicAutoDriveHarness({
      scenario: "reroute-stop",
    });

    const result = await harness.deps.waitSubAgentSession({
      sessionId: "session-1",
      timeoutMs: 1000,
      pollIntervalMs: 10,
    });

    const output = result.task?.steps[0]?.output ?? "";
    expect(output).toContain("Off Route: yes");
    expect(output).toContain("Reroute Reason:");
    expect(output).toContain("Waypoint Status: blocked");
  });

  it("can slow each waypoint wait to make pause and stop interactions testable", async () => {
    vi.useFakeTimers();
    const harness = createDeterministicAutoDriveHarness({
      stepDelayMs: 250,
    });

    let resolved = false;
    const waitPromise = harness.deps
      .waitSubAgentSession({
        sessionId: "session-1",
        timeoutMs: 1000,
        pollIntervalMs: 10,
      })
      .then((result) => {
        resolved = true;
        return result;
      });

    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(50);
    const result = await waitPromise;

    expect(resolved).toBe(true);
    expect(result.task?.steps[0]?.output ?? "").toContain("Goal reached: no");
  });

  it("releases a delayed wait early after an interrupt so operator controls stay responsive", async () => {
    vi.useFakeTimers();
    const harness = createDeterministicAutoDriveHarness({
      stepDelayMs: 1000,
    });

    void harness.deps.sendSubAgentInstruction({
      sessionId: "session-1",
      instruction: "run waypoint",
      requestId: "request-1",
    });

    let resolved = false;
    const waitPromise = harness.deps
      .waitSubAgentSession({
        sessionId: "session-1",
        timeoutMs: 1000,
        pollIntervalMs: 10,
      })
      .then((result) => {
        resolved = true;
        return result;
      });

    await vi.advanceTimersByTimeAsync(150);
    expect(resolved).toBe(false);

    await harness.deps.interruptSubAgentSession({
      sessionId: "session-1",
      reason: "manual_stop",
    });
    await vi.advanceTimersByTimeAsync(50);
    const result = await waitPromise;

    expect(resolved).toBe(true);
    expect(result.task?.steps[0]?.output ?? "").toContain("Waypoint Status:");
  });

  it("can recover persisted artifacts across harness instances for reload QA", async () => {
    let persistedState: string | null = null;
    const persistence = {
      load: () => persistedState,
      save: (value: string) => {
        persistedState = value;
      },
      clear: () => {
        persistedState = null;
      },
    };
    const firstHarness = createDeterministicAutoDriveHarness({
      persistence,
    });

    const ledger = firstHarness.createLedger("workspace-1");
    await ledger.writeRun({
      schemaVersion: "autodrive-run/v2",
      runId: "autodrive-e2e-run",
      workspaceId: "workspace-1",
      workspacePath: "/repo",
      threadId: "thread-1",
      status: "paused",
      stage: "paused",
      destination: {
        title: "Recover the route",
        desiredEndState: ["Show recovery state"],
        doneDefinition: {
          arrivalCriteria: ["Resume the route"],
          requiredValidation: [],
          waypointIndicators: [],
        },
        hardBoundaries: [],
        routePreference: "validation_first",
      },
      budget: {
        maxTokens: 1200,
        maxIterations: 2,
        maxDurationMs: 60_000,
        maxFilesPerIteration: 4,
        maxNoProgressIterations: 2,
        maxValidationFailures: 2,
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
      execution: {
        accessMode: "on-request",
        modelId: "gpt-5",
        reasoningEffort: "medium",
      },
      iteration: 1,
      totals: {
        consumedTokensEstimate: 640,
        elapsedMs: 1000,
        validationFailureCount: 0,
        noProgressCount: 0,
        repeatedFailureCount: 0,
        rerouteCount: 0,
      },
      blockers: [],
      completedSubgoals: [],
      summaries: [],
      navigation: {
        destinationSummary: "Recover the route",
        startStateSummary: "Paused after a safe checkpoint.",
        routeSummary: "baseline -> implement -> validate",
        currentWaypointTitle: "Advance the current waypoint",
        currentWaypointObjective: "Continue from the checkpoint.",
        currentWaypointArrivalCriteria: ["Resume the route"],
        remainingMilestones: ["Validate the route"],
        currentMilestone: "Advance the current waypoint",
        overallProgress: 33,
        waypointCompletion: 100,
        offRoute: false,
        rerouting: false,
        rerouteReason: null,
        remainingBlockers: [],
        arrivalConfidence: "medium",
        stopRisk: "medium",
        remainingTokens: 560,
        remainingIterations: 1,
        remainingDurationMs: 59_000,
        lastDecision: "missing_human_input",
      },
      createdAt: 1,
      updatedAt: 2,
      startedAt: 1,
      completedAt: null,
      lastStopReason: {
        code: "missing_human_input",
        detail: "AutoDrive was paused by the operator.",
      },
      sessionId: "session-1",
      lastValidationSummary: "validate:fast passed",
      currentBlocker: null,
      latestReroute: null,
    });

    const recoveredHarness = createDeterministicAutoDriveHarness({
      persistence,
    });
    const recoveredRun = await recoveredHarness.loadLatestRun({
      workspaceId: "workspace-1",
      threadId: "thread-1",
    });

    expect(recoveredRun?.status).toBe("paused");
    expect(
      recoveredHarness.listArtifacts().some((artifact) => artifact.path.endsWith("run.json"))
    ).toBe(true);
  });
});
