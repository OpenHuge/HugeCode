// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRelativeSource } from "../../../test/styleSource";
import { Composer } from "./Composer";
import { ComposerMetaBar } from "./ComposerMetaBar";
import type { ComposerProps } from "./Composer.types";

type RenderAutoDriveOptions = {
  source?: string;
  enabled?: boolean;
  recovering?: boolean;
  recoverySummary?: string | null;
  presetActive?: "safe_default" | "tight_validation" | "fast_explore" | "custom";
  selectedRemoteBackendId?: string | null;
  controls?: Partial<{
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
    canStop: boolean;
    busyAction: "starting" | "pausing" | "resuming" | "stopping" | null;
  }>;
  readiness?: Partial<{
    readyToLaunch: boolean;
    issues: string[];
    warnings: string[];
    setupProgress: number;
  }>;
  run?: Partial<{
    status:
      | "created"
      | "running"
      | "paused"
      | "review_ready"
      | "completed"
      | "cancelled"
      | "stopped"
      | "failed";
    stage: string;
    iteration: number;
    overallProgress: number;
    waypointCompletion: number;
    waypointStatus: "pending" | "active" | "arrived" | "missed" | "blocked" | null;
    stopReason: string | null;
    runtimeScenarioProfile: {
      authorityScope: string | null;
      authoritySources: string[];
      representativeCommands: string[];
      componentCommands: string[];
      endToEndCommands: string[];
      samplePaths: string[];
      heldOutGuidance: string[];
      sourceSignals: string[];
      scenarioKeys: string[];
      safeBackground: boolean | null;
    } | null;
    runtimeDecisionTrace: {
      phase: string | null;
      summary: string | null;
      selectedCandidateId: string | null;
      selectedCandidateSummary: string | null;
      selectionTags: string[];
      representativeCommand: string | null;
      authoritySources: string[];
      heldOutGuidance: string[];
    } | null;
    runtimeOutcomeFeedback: {
      status: string | null;
      summary: string | null;
      failureClass: string | null;
      validationCommands: string[];
      humanInterventionRequired: boolean | null;
      heldOutPreserved: boolean | null;
      at: number | null;
    } | null;
    runtimeAutonomyState: {
      independentThread: boolean | null;
      autonomyPriority: string | null;
      highPriority: boolean | null;
      escalationPressure: "low" | "medium" | "high" | null;
      unattendedContinuationAllowed: boolean | null;
      backgroundSafe: boolean | null;
      humanInterventionHotspots: string[];
    } | null;
    runtimeContinuationState: {
      automaticFollowUpCount: number;
      status: "idle" | "continuing" | "stopped";
      lastContinuationAt: number | null;
      lastContinuationReason: string | null;
    } | null;
    lastChatgptDecisionLab: {
      recommendedOptionId: string | null;
      recommendedOption: string | null;
      alternativeOptionIds: string[];
      decisionMemo: string | null;
      confidence: "low" | "medium" | "high" | null;
      assumptions: string[];
      followUpQuestions: string[];
    } | null;
    runtimeResearchTrace: {
      status: "in_progress" | "selected" | "gap" | "blocked";
      summary: string;
      blockingReason: string | null;
    } | null;
    runtimeResearchSession: {
      phase: "queued" | "researching" | "synthesizing" | "selected" | "gap" | "blocked";
      summary: string;
      blockingReason: string | null;
      trustedSourceCount: number;
      totalSourceCount: number;
      sourceDomains: string[];
      coverageGaps: string[];
      recommendedCandidateId: string | null;
    } | null;
    runtimeResearchSources: Array<{
      label: string;
      url: string | null;
      domain: string | null;
    }>;
    lastChatgptResearchRouteLab: {
      phase: "queued" | "researching" | "synthesizing" | "selected" | "gap" | "blocked" | null;
      recommendedRoute: string | null;
      alternativeRoutes: string[];
      decisionMemo: string | null;
      recommendedRouteRationale: string | null;
      sources: Array<{
        label: string;
        url: string | null;
        domain: string | null;
      }>;
      sourceAssessment: {
        status: "trusted" | "mixed" | "insufficient" | null;
        trustedSourceCount: number;
        totalSourceCount: number;
        domains: string[];
      } | null;
      confidence: "low" | "medium" | "high" | null;
      openQuestions: string[];
      coverageGaps: string[];
      blockedReason: string | null;
    } | null;
  }> | null;
};

function buildAutoDrive(options: RenderAutoDriveOptions = {}) {
  const onToggleEnabled = vi.fn();
  const onApplyPreset = vi.fn();
  const onStart = vi.fn();
  const onPause = vi.fn();
  const onResume = vi.fn();
  const onStop = vi.fn();

  return {
    autoDrive: {
      source: options.source ?? "runtime_snapshot_v1",
      enabled: options.enabled ?? true,
      destination: {
        title: "Ship AutoDrive rail",
        endState: "Composer stays compact",
        doneDefinition: "Collapsed rail expands on demand",
        avoid: "Do not crowd the input surface",
        routePreference: "stability_first" as const,
      },
      budget: {
        maxTokens: 8_000,
        maxIterations: 4,
        maxDurationMinutes: 30,
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
        minimumConfidence: "medium" as const,
      },
      preset: {
        active: options.presetActive ?? "safe_default",
        apply: onApplyPreset,
      },
      controls: {
        canStart: options.controls?.canStart ?? false,
        canPause: options.controls?.canPause ?? false,
        canResume: options.controls?.canResume ?? false,
        canStop: options.controls?.canStop ?? false,
        busyAction: options.controls?.busyAction ?? null,
        onStart,
        onPause,
        onResume,
        onStop,
      },
      recovering: options.recovering ?? false,
      recoverySummary: options.recoverySummary ?? null,
      activity: [
        {
          id: "activity-1",
          kind: "stage" as const,
          title: "Executing",
          detail: "AutoDrive advanced to the next waypoint.",
          iteration: 2,
          timestamp: 1,
        },
      ],
      readiness: {
        readyToLaunch: options.readiness?.readyToLaunch ?? true,
        issues: options.readiness?.issues ?? [],
        warnings: options.readiness?.warnings ?? [],
        checklist: [
          { label: "Destination title set", complete: true },
          { label: "Desired end state mapped", complete: true },
          { label: "Done definition captured", complete: true },
        ],
        setupProgress: options.readiness?.setupProgress ?? 100,
      },
      run:
        options.run === null
          ? null
          : {
              status: options.run?.status ?? "running",
              stage: options.run?.stage ?? "executing_task",
              iteration: options.run?.iteration ?? 2,
              consumedTokensEstimate: 2_100,
              maxTokens: 8_000,
              maxIterations: 4,
              startStateSummary: "Branch feat/autodrive with remaining budget.",
              destinationSummary: "Ship AutoDrive rail",
              routeSummary: "baseline -> refine -> verify",
              currentMilestone: "Refine the rail",
              currentWaypointTitle: "Refine the rail",
              currentWaypointObjective: "Keep the composer compact.",
              currentWaypointArrivalCriteria: ["No expanded form", "Status rail visible"],
              remainingMilestones: ["Verify the flow"],
              offRoute: false,
              rerouting: false,
              rerouteReason: null,
              overallProgress: options.run?.overallProgress ?? 66,
              waypointCompletion: options.run?.waypointCompletion ?? 50,
              stopRisk: "medium" as const,
              arrivalConfidence: "medium" as const,
              remainingTokens: 5_900,
              remainingIterations: 2,
              remainingDurationMs: 900_000,
              remainingBlockers: [],
              lastValidationSummary: "validate:fast pending",
              stopReason: options.run?.stopReason ?? null,
              stopReasonCode: null,
              lastDecision: "continue",
              waypointStatus: options.run?.waypointStatus ?? "active",
              runtimeScenarioProfile: options.run?.runtimeScenarioProfile ?? null,
              runtimeDecisionTrace: options.run?.runtimeDecisionTrace ?? null,
              runtimeOutcomeFeedback: options.run?.runtimeOutcomeFeedback ?? null,
              runtimeAutonomyState: options.run?.runtimeAutonomyState ?? null,
              runtimeContinuationState: options.run?.runtimeContinuationState ?? null,
              lastChatgptDecisionLab: options.run?.lastChatgptDecisionLab ?? null,
              runtimeResearchTrace: options.run?.runtimeResearchTrace ?? null,
              runtimeResearchSession: options.run?.runtimeResearchSession ?? null,
              runtimeResearchSources: options.run?.runtimeResearchSources ?? [],
              lastChatgptResearchRouteLab: options.run?.lastChatgptResearchRouteLab ?? null,
              latestReroute: null,
            },
      onToggleEnabled,
      onChangeDestination: vi.fn(),
      onChangeBudget: vi.fn(),
      onChangeRiskPolicy: vi.fn(),
    },
    handlers: {
      onToggleEnabled,
      onApplyPreset,
      onStart,
      onPause,
      onResume,
      onStop,
    },
  };
}

function renderAutoDriveBar(options: RenderAutoDriveOptions = {}) {
  const { autoDrive, handlers } = buildAutoDrive(options);

  render(
    <ComposerMetaBar
      disabled={false}
      collaborationModes={[]}
      selectedCollaborationModeId={null}
      onSelectCollaborationMode={vi.fn()}
      models={[
        {
          id: "gpt-5",
          model: "gpt-5",
          displayName: "GPT-5",
          available: true,
        },
      ]}
      selectedModelId="gpt-5"
      onSelectModel={vi.fn()}
      reasoningOptions={["medium"]}
      selectedEffort="medium"
      onSelectEffort={vi.fn()}
      reasoningSupported={true}
      accessMode="on-request"
      onSelectAccessMode={vi.fn()}
      executionOptions={[{ value: "runtime", label: "Runtime" }]}
      selectedExecutionMode="runtime"
      onSelectExecutionMode={vi.fn()}
      remoteBackendOptions={[
        { value: "backend-local", label: "Local desktop runtime" },
        { value: "backend-cloud", label: "Cloud burst backend" },
      ]}
      selectedRemoteBackendId={options.selectedRemoteBackendId ?? "backend-local"}
      onSelectRemoteBackendId={vi.fn()}
      autoDrive={autoDrive}
    />
  );

  return handlers;
}

function createComposerProps(overrides: Partial<ComposerProps> = {}): ComposerProps {
  return {
    onSend: vi.fn(),
    onQueue: vi.fn(),
    onStop: vi.fn(),
    canStop: false,
    disabled: false,
    isProcessing: false,
    steerEnabled: false,
    collaborationModes: [],
    selectedCollaborationModeId: null,
    onSelectCollaborationMode: vi.fn(),
    models: [],
    selectedModelId: null,
    onSelectModel: vi.fn(),
    reasoningOptions: [],
    selectedEffort: null,
    onSelectEffort: vi.fn(),
    reasoningSupported: false,
    accessMode: "on-request",
    onSelectAccessMode: vi.fn(),
    executionOptions: [{ value: "runtime", label: "Runtime" }],
    selectedExecutionMode: "runtime",
    onSelectExecutionMode: vi.fn(),
    remoteBackendOptions: [
      { value: "backend-local", label: "Local desktop runtime" },
      { value: "backend-cloud", label: "Cloud burst backend" },
    ],
    selectedRemoteBackendId: "backend-local",
    onSelectRemoteBackendId: vi.fn(),
    skills: [],
    prompts: [],
    files: [],
    queuedMessages: [],
    draftText: "",
    onDraftChange: vi.fn(),
    ...overrides,
  };
}

function renderComposerWithAutoDrive(options: RenderAutoDriveOptions = {}) {
  const { autoDrive, handlers } = buildAutoDrive(options);
  render(<Composer {...createComposerProps({ autoDrive })} />);
  return handlers;
}

describe("ComposerMetaBar AutoDrive", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the meta rail to a single switch without exposing a settings flyout", () => {
    const handlers = renderAutoDriveBar({
      enabled: false,
      presetActive: "safe_default",
      controls: { canStart: false },
      run: null,
    });
    const autoDriveSwitch = screen.getByRole("switch", { name: "Toggle AutoDrive" });

    expect(autoDriveSwitch.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("button", { name: "AutoDrive settings" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "AutoDrive settings" })).toBeNull();
    expect(screen.queryByText("Route preset")).toBeNull();
    expect(screen.queryByText("L2")).toBeNull();
    expect(screen.queryByText("L3")).toBeNull();
    expect(screen.queryByText("L4")).toBeNull();

    fireEvent.click(autoDriveSwitch);

    expect(handlers.onApplyPreset).not.toHaveBeenCalled();
    expect(handlers.onToggleEnabled).toHaveBeenCalledWith(true);
  });

  it("keeps running controls out of the composer meta rail", () => {
    renderAutoDriveBar({
      enabled: true,
      controls: { canPause: true, canStop: true, canStart: false },
      run: {
        status: "running",
        overallProgress: 66,
      },
    });

    expect(screen.queryByRole("button", { name: "Pause AutoDrive" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Stop AutoDrive" })).toBeNull();
    expect(screen.queryByText("Route preset")).toBeNull();
  });

  it("shows no top status rail while AutoDrive is off", () => {
    renderComposerWithAutoDrive({
      enabled: false,
      controls: { canStart: false },
      run: null,
    });

    expect(screen.queryByLabelText("AutoDrive status rail")).toBeNull();
  });

  it("keeps the rail alive long enough to animate out after AutoDrive turns off", () => {
    vi.useFakeTimers();
    try {
      const active = buildAutoDrive({
        enabled: true,
        controls: { canStart: true },
        run: null,
      }).autoDrive;
      const inactive = buildAutoDrive({
        enabled: false,
        controls: { canStart: false },
        run: null,
      }).autoDrive;
      const { rerender } = render(<Composer {...createComposerProps({ autoDrive: active })} />);

      const visibleRail = screen.getByLabelText("AutoDrive status rail");
      expect(visibleRail.parentElement?.getAttribute("data-visibility")).toBe("visible");

      rerender(<Composer {...createComposerProps({ autoDrive: inactive })} />);

      const exitingRail = screen.getByLabelText("AutoDrive status rail");
      expect(exitingRail.parentElement?.getAttribute("data-visibility")).toBe("exiting");

      act(() => {
        vi.advanceTimersByTime(220);
      });

      expect(screen.queryByLabelText("AutoDrive status rail")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders a collapsed top rail only after AutoDrive is activated, then expands into details", () => {
    renderComposerWithAutoDrive({
      enabled: true,
      controls: { canStart: true },
      run: null,
    });

    const statusRail = screen.getByLabelText("AutoDrive status rail");
    const toggle = screen.getByRole("button", { name: /AutoDrive/ });

    expect(statusRail).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Ready to launch · Medium budget pressure")).toBeTruthy();
    expect(screen.queryByText("Route preset")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Route preset")).toBeTruthy();
    expect(screen.getByText("Safety default")).toBeTruthy();
    expect(screen.getByText("Validation")).toBeTruthy();
    expect(screen.getByText("Balanced")).toBeTruthy();
    expect(screen.getAllByText("Backend preference").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Local desktop runtime").length).toBeGreaterThan(0);
    expect(screen.getByText("Hard-stop budget")).toBeTruthy();
    expect(screen.getByText("8.0k tokens · 4 iterations · 30m")).toBeTruthy();
  });

  it("shows running controls inside the expanded top rail", () => {
    const handlers = renderComposerWithAutoDrive({
      enabled: true,
      controls: { canPause: true, canStop: true, canStart: false },
      run: {
        status: "running",
        overallProgress: 66,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(screen.getByText("66% route")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause AutoDrive" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop AutoDrive" }));

    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    expect(handlers.onStop).toHaveBeenCalledTimes(1);
  });

  it("surfaces runtime-native authority, eval lane, autonomy, and feedback details", () => {
    renderComposerWithAutoDrive({
      enabled: true,
      controls: { canPause: true, canStop: true, canStart: false },
      run: {
        status: "running",
        overallProgress: 66,
        runtimeScenarioProfile: {
          authorityScope: "workspace_graph",
          authoritySources: ["repo_authority", "workspace_graph"],
          representativeCommands: ["pnpm validate:fast"],
          componentCommands: [],
          endToEndCommands: ["pnpm test:e2e:smoke"],
          samplePaths: [".codex/e2e-map.json"],
          heldOutGuidance: ["Keep a held-out fixture untouched."],
          sourceSignals: ["repo_execution_contract"],
          scenarioKeys: ["workspace_graph_launch", "validation-recovery"],
          safeBackground: false,
        },
        runtimeDecisionTrace: {
          phase: "launch",
          summary: "Launch uses workspace graph and representative eval lane.",
          selectedCandidateId: "launch_autodrive",
          selectedCandidateSummary: "Prepare an independent AutoDrive mission.",
          selectionTags: ["workspace_graph", "eval_first"],
          representativeCommand: "pnpm validate:fast",
          authoritySources: ["repo_authority", "workspace_graph"],
          heldOutGuidance: ["Keep a held-out fixture untouched."],
        },
        runtimeOutcomeFeedback: {
          status: "launch_prepared",
          summary: "Runtime prepared AutoDrive launch context.",
          failureClass: null,
          validationCommands: ["pnpm validate:fast"],
          humanInterventionRequired: false,
          heldOutPreserved: true,
          at: null,
        },
        runtimeAutonomyState: {
          independentThread: true,
          autonomyPriority: "operator",
          highPriority: true,
          escalationPressure: "medium",
          unattendedContinuationAllowed: false,
          backgroundSafe: false,
          humanInterventionHotspots: ["validation", "scope_change"],
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(screen.getByText("Runtime authority")).toBeTruthy();
    expect(screen.getByText("workspace graph")).toBeTruthy();
    expect(screen.getByText("Eval lane")).toBeTruthy();
    expect(screen.getAllByText("pnpm validate:fast").length).toBeGreaterThan(0);
    expect(screen.getByText("Autonomy posture")).toBeTruthy();
    expect(
      screen.getByText("Operator priority · Independent thread · Human review hotspots")
    ).toBeTruthy();
    expect(screen.getByText("Runtime feedback")).toBeTruthy();
    expect(screen.getByText("Runtime prepared AutoDrive launch context.")).toBeTruthy();
  });

  it("surfaces browser-fix-loop status and decision-lab guidance inside the rail", () => {
    renderComposerWithAutoDrive({
      enabled: true,
      controls: { canPause: true, canStop: true, canStart: false },
      run: {
        status: "paused",
        overallProgress: 66,
        stopReason:
          "Browser verification gap remains: rerun pnpm validate:fast and confirm the real browser path.",
        runtimeScenarioProfile: {
          authorityScope: "workspace_graph",
          authoritySources: ["repo_authority", "workspace_graph", "browser_runtime"],
          representativeCommands: ["pnpm validate:fast"],
          componentCommands: [],
          endToEndCommands: [],
          samplePaths: [],
          heldOutGuidance: [],
          sourceSignals: ["browser_debug", "chatgpt_decision_lab"],
          scenarioKeys: ["browser_repro_fix_verify"],
          safeBackground: false,
        },
        runtimeContinuationState: {
          automaticFollowUpCount: 1,
          status: "continuing",
          lastContinuationAt: 1,
          lastContinuationReason:
            "Browser verification gap remains: rerun pnpm validate:fast and confirm the real browser path.",
        },
        lastChatgptDecisionLab: {
          recommendedOptionId: "option-a",
          recommendedOption: "Re-run the browser verification path after the code change.",
          alternativeOptionIds: ["option-b"],
          decisionMemo: "The browser path is still the only unresolved gate.",
          confidence: "high",
          assumptions: [],
          followUpQuestions: [],
        },
      },
    });

    expect(screen.getByText("66% route · Browser verification gap remains")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(screen.getByText("Browser verification gap remains")).toBeTruthy();
    expect(
      screen.getByText(
        "Browser verification gap remains: rerun pnpm validate:fast and confirm the real browser path."
      )
    ).toBeTruthy();
    expect(screen.getByText("Browser lane")).toBeTruthy();
    expect(screen.getByText("Verification gap")).toBeTruthy();
    expect(screen.getByText("Decision lab")).toBeTruthy();
    expect(screen.getByText("option-a · High confidence")).toBeTruthy();
  });

  it("surfaces blocked browser sessions instead of generic route copy", () => {
    renderComposerWithAutoDrive({
      enabled: true,
      controls: { canPause: true, canStop: true, canStart: false },
      run: {
        status: "failed",
        overallProgress: 41,
        runtimeScenarioProfile: {
          authorityScope: "workspace_graph",
          authoritySources: ["repo_authority", "workspace_graph", "browser_runtime"],
          representativeCommands: [],
          componentCommands: [],
          endToEndCommands: [],
          samplePaths: [],
          heldOutGuidance: [],
          sourceSignals: ["browser_debug", "chatgpt_decision_lab"],
          scenarioKeys: ["browser_repro_fix_verify"],
          safeBackground: false,
        },
        runtimeOutcomeFeedback: {
          status: "blocked",
          summary: "ChatGPT login required before the browser route can continue.",
          failureClass: "browser_session_blocked",
          validationCommands: [],
          humanInterventionRequired: true,
          heldOutPreserved: null,
          at: null,
        },
      },
    });

    expect(screen.getByText("41% route · Browser session blocked")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(screen.getByText("Browser session blocked")).toBeTruthy();
    expect(
      screen.getAllByText("ChatGPT login required before the browser route can continue.").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Session blocked")).toBeTruthy();
  });

  it("surfaces research source quality and the leading coverage gap in the rail", () => {
    renderComposerWithAutoDrive({
      enabled: true,
      controls: { canPause: true, canStop: true, canStart: false },
      run: {
        status: "running",
        overallProgress: 52,
        runtimeScenarioProfile: {
          authorityScope: "workspace_graph",
          authoritySources: ["repo_authority", "workspace_graph", "chatgpt_web"],
          representativeCommands: [],
          componentCommands: [],
          endToEndCommands: [],
          samplePaths: [],
          heldOutGuidance: [],
          sourceSignals: ["chatgpt_research_route_lab"],
          scenarioKeys: ["research_route_decide"],
          safeBackground: true,
        },
        runtimeResearchTrace: {
          status: "gap",
          summary: "Research gap remains: trusted evidence is still incomplete.",
          blockingReason: "ChatGPT did not cite enough trusted sources.",
        },
        runtimeResearchSession: {
          phase: "gap",
          summary: "Research gap remains: trusted evidence is still incomplete.",
          blockingReason: "ChatGPT did not cite enough trusted sources.",
          trustedSourceCount: 2,
          totalSourceCount: 3,
          sourceDomains: ["react.dev", "playwright.dev", "example.com"],
          coverageGaps: ["Confirm the current Vitest migration guidance."],
          recommendedCandidateId: "stabilize_route",
        },
        runtimeResearchSources: [
          {
            label: "React 19 upgrade guide",
            url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
            domain: "react.dev",
          },
        ],
        lastChatgptResearchRouteLab: {
          phase: "gap",
          recommendedRoute: "stabilize_route",
          alternativeRoutes: ["advance_primary_surface"],
          decisionMemo: "The route is still plausible but needs better evidence.",
          recommendedRouteRationale:
            "React and Playwright official docs support the route, but Vitest coverage is still incomplete.",
          sources: [
            {
              label: "React 19 upgrade guide",
              url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
              domain: "react.dev",
            },
          ],
          sourceAssessment: {
            status: "mixed",
            trustedSourceCount: 2,
            totalSourceCount: 3,
            domains: ["react.dev", "playwright.dev", "example.com"],
          },
          confidence: "medium",
          openQuestions: [],
          coverageGaps: ["Confirm the current Vitest migration guidance."],
          blockedReason: "missing_trusted_sources",
        },
      },
    });

    expect(screen.getByText("52% route · Research gap")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(screen.getByText("Research lane")).toBeTruthy();
    expect(screen.getByText("Research gap")).toBeTruthy();
    expect(screen.getByText("Source quality")).toBeTruthy();
    expect(screen.getByText("2 trusted of 3 sources · react.dev, playwright.dev")).toBeTruthy();
    expect(screen.getByText("Coverage gap")).toBeTruthy();
    expect(screen.getByText("Confirm the current Vitest migration guidance.")).toBeTruthy();
  });

  it("surfaces runtime recovery summary instead of generic restore copy", () => {
    renderComposerWithAutoDrive({
      enabled: true,
      recovering: true,
      recoverySummary: "Runtime recovered AutoDrive from checkpoint cp-7. Resume to continue.",
      controls: { canResume: true, canStop: true, canStart: false },
      run: {
        status: "paused",
        stopReason: "AutoDrive was paused by the operator.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(
      screen.getAllByText("Runtime recovered AutoDrive from checkpoint cp-7. Resume to continue.")
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Reloading the latest route snapshot before new controls are enabled.")
    ).toBeNull();
  });

  it("shows resume controls for paused runs inside the expanded top rail", () => {
    const handlers = renderComposerWithAutoDrive({
      enabled: true,
      controls: { canResume: true, canStop: true, canStart: false },
      run: {
        status: "paused",
        stopReason: "AutoDrive was paused by the operator.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(screen.queryByRole("button", { name: "Pause AutoDrive" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resume AutoDrive" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop AutoDrive" }));

    expect(handlers.onResume).toHaveBeenCalledTimes(1);
    expect(handlers.onStop).toHaveBeenCalledTimes(1);
  });

  it("surfaces degraded fallback copy from the expanded top rail", () => {
    renderComposerWithAutoDrive({
      source: "legacy_thread_projection",
      enabled: true,
      controls: { canStart: false, canPause: false, canResume: false, canStop: false },
      run: {
        status: "running",
        overallProgress: 42,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /AutoDrive/ }));

    expect(screen.getByText("Read-only fallback")).toBeTruthy();
    expect(screen.getByText("Degraded")).toBeTruthy();
    expect(
      screen.getByText(
        "Displayed route state is unavailable because the live mission-control snapshot is missing. Runtime-owned start, pause, resume, and stop controls stay disabled until runtime truth returns."
      )
    ).toBeTruthy();
  });

  it("replaces the old floating flyout with an inline status rail and breathing treatment", () => {
    const source = readRelativeSource(
      import.meta.dirname,
      "ComposerMetaBarAutoDriveMeta.styles.css.ts"
    );

    expect(source).not.toContain("export const menu = style({");
    expect(source).not.toContain('backdropFilter: "blur(18px)"');
    expect(source).not.toContain("linear-gradient(");
    expect(source).toContain("data-breathing");
    expect(source).toContain("data-visibility");
    expect(source).toContain("statusRailPresence");
    expect(source).toContain("autoDriveBreath");
    expect(source).toContain("statusRail");
    expect(source).toContain('boxShadow: "none"');
    expect(source).toContain(
      'background: "color-mix(in srgb, var(--ds-surface-hover) 84%, var(--ds-surface-control) 16%)"'
    );
    expect(source).toContain(
      'background: "color-mix(in srgb, var(--ds-surface-control) 84%, var(--ds-surface-card-base))"'
    );
  });
});
