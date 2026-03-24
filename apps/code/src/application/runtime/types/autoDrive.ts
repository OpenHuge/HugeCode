import type {
  AgentTaskSummary,
  GitBranchesSnapshot,
  GitLogEntry,
  GitLogResponse,
  RuntimeBrowserDebugRunRequest,
  RuntimeBrowserDebugRunResponse,
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  SubAgentCloseAck,
  SubAgentCloseRequest,
  SubAgentInterruptAck,
  SubAgentInterruptRequest,
  SubAgentSendRequest,
  SubAgentSendResult,
  SubAgentSessionSummary,
  SubAgentSpawnRequest,
  SubAgentWaitRequest,
  SubAgentWaitResult,
} from "@ku0/code-runtime-host-contract";
import type {
  AccessMode,
  ConversationItem,
  GitCommitDiff,
  GitFileStatus,
  GitHubIssuesResponse,
  GitHubPullRequestsResponse,
} from "../../../types";

export type AutoDriveRunStage =
  | "created"
  | "preparing_context"
  | "planning_next_task"
  | "executing_task"
  | "validating_result"
  | "deciding_next_step"
  | "paused"
  | "completed"
  | "stopped"
  | "failed";

export type AutoDriveRunStatus =
  | "created"
  | "running"
  | "paused"
  | "completed"
  | "stopped"
  | "failed";

export type AutoDriveConfidence = "low" | "medium" | "high";
export type AutoDriveRiskLevel = "low" | "medium" | "high";
export type AutoDriveRoutePreference =
  | "stability_first"
  | "minimal_change"
  | "validation_first"
  | "docs_first"
  | "speed_first";
export type AutoDriveStopAction = "continue" | "reroute" | "pause" | "stop";
export type AutoDriveWaypointStatus = "pending" | "active" | "arrived" | "missed" | "blocked";

export type AutoDriveDestinationModel = {
  title: string;
  desiredEndState: string[];
  doneDefinition: {
    arrivalCriteria: string[];
    requiredValidation: string[];
    waypointIndicators: string[];
  };
  hardBoundaries: string[];
  routePreference: AutoDriveRoutePreference;
};

export type AutoDriveBudget = {
  maxTokens: number;
  maxIterations: number;
  maxDurationMs: number | null;
  maxFilesPerIteration: number | null;
  maxNoProgressIterations: number;
  maxValidationFailures: number;
  maxReroutes: number;
};

export type AutoDriveRiskPolicy = {
  pauseOnDestructiveChange: boolean;
  pauseOnDependencyChange: boolean;
  pauseOnLowConfidence: boolean;
  pauseOnHumanCheckpoint: boolean;
  allowNetworkAnalysis: boolean;
  allowChatgptDecisionLab?: boolean;
  autoRunChatgptDecisionLab?: boolean;
  allowValidationCommands: boolean;
  minimumConfidence: AutoDriveConfidence;
  chatgptDecisionLabMinConfidence?: AutoDriveConfidence;
  chatgptDecisionLabMaxScoreGap?: number;
};

export type AutoDriveContinuationPolicy = {
  enabled: boolean;
  maxAutomaticFollowUps: number;
  requireValidationSuccessToStop: boolean;
  minimumConfidenceToStop: AutoDriveConfidence;
};

export type AutoDriveContinuationStatus = "idle" | "continuing" | "stopped";

export type AutoDriveContinuationState = {
  automaticFollowUpCount: number;
  status: AutoDriveContinuationStatus;
  lastContinuationAt: number | null;
  lastContinuationReason: string | null;
};

export type AutoDriveExecutionConfig = {
  accessMode: AccessMode;
  modelId: string | null;
  reasoningEffort: string | null;
};

export type AutoDriveRunTotals = {
  consumedTokensEstimate: number;
  elapsedMs: number;
  validationFailureCount: number;
  noProgressCount: number;
  repeatedFailureCount: number;
  rerouteCount: number;
};

export type AutoDriveStopReason = {
  code:
    | "goal_reached"
    | "token_budget_exhausted"
    | "max_iterations_reached"
    | "repeated_validation_failures"
    | "no_meaningful_progress"
    | "destructive_change_requires_review"
    | "dependency_change_requires_review"
    | "confidence_too_low"
    | "missing_human_input"
    | "human_checkpoint_required"
    | "mainline_conflict_requires_review"
    | "manual_stop"
    | "proposal_rejected"
    | "execution_failed"
    | "duration_budget_exhausted"
    | "reroute_limit_reached"
    | "unsafe_route_requires_review";
  detail: string;
};

export type AutoDriveTaskReference = {
  taskId: string;
  status: AgentTaskSummary["status"] | "missing";
  outputExcerpt: string;
};

export type AutoDriveValidationResult = {
  ran: boolean;
  commands: string[];
  success: boolean | null;
  failures: string[];
  summary: string;
};

export type AutoDriveRuleEvidence = {
  path: string;
  summary: string;
};

export type AutoDriveCommitEvidence = GitLogEntry & {
  touchedPaths: string[];
};

export type AutoDriveCollaboratorBoundarySignal = {
  path: string;
  summary: string;
};

export type AutoDriveCollaboratorIntent = {
  recentDirection: string;
  touchedAreas: string[];
  boundarySignals: AutoDriveCollaboratorBoundarySignal[];
  probableIntent: string;
  conflictRisk: AutoDriveRiskLevel;
  confidence: AutoDriveConfidence;
};

export type AutoDriveExternalResearchEntry = {
  query: string;
  summary: string;
  sources: string[];
};

export type AutoDriveResearchSource = {
  label: string;
  url: string | null;
  domain: string | null;
};

export type AutoDriveRepoEvaluationProfile = {
  representativeCommands: string[];
  componentCommands: string[];
  endToEndCommands: string[];
  samplePaths: string[];
  heldOutGuidance: string[];
  sourceSignals: string[];
  scenarioKeys: string[];
};

export type AutoDriveRuntimeScenarioProfile = {
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
};

export type AutoDriveRuntimeDecisionTrace = {
  phase: string | null;
  summary: string | null;
  selectedCandidateId: string | null;
  selectedCandidateSummary: string | null;
  selectionTags: string[];
  representativeCommand: string | null;
  authoritySources: string[];
  heldOutGuidance: string[];
};

export type AutoDriveRuntimeOutcomeFeedback = {
  status: string | null;
  summary: string | null;
  failureClass: string | null;
  validationCommands: string[];
  humanInterventionRequired: boolean | null;
  heldOutPreserved: boolean | null;
  at: number | null;
};

export type AutoDriveRuntimeAutonomyState = {
  independentThread: boolean | null;
  autonomyPriority: string | null;
  highPriority: boolean | null;
  escalationPressure: AutoDriveRiskLevel | null;
  unattendedContinuationAllowed: boolean | null;
  backgroundSafe: boolean | null;
  humanInterventionHotspots: string[];
};

export type AutoDriveRuntimeContinuationState = AutoDriveContinuationState;

export type AutoDriveChatgptDecisionLabResult = {
  recommendedOptionId: string | null;
  recommendedOption: string | null;
  alternativeOptionIds: string[];
  decisionMemo: string | null;
  confidence: AutoDriveConfidence | null;
  assumptions: string[];
  followUpQuestions: string[];
};

export type AutoDriveRuntimeResearchTrace = {
  status: "in_progress" | "selected" | "gap" | "blocked";
  summary: string;
  blockingReason: string | null;
};

export type AutoDriveChatgptResearchRouteLabResult = {
  recommendedRoute: string | null;
  alternativeRoutes: string[];
  decisionMemo: string | null;
  sources: AutoDriveResearchSource[];
  confidence: AutoDriveConfidence | null;
  openQuestions: string[];
  blockedReason: string | null;
};

export type AutoDriveIntentSignalKind =
  | "operator_intent"
  | "previous_summary"
  | "collaborator_intent"
  | "repo_rule"
  | "external_research"
  | "repo_backlog"
  | "thread_history"
  | "thread_memory"
  | "blocker";

export type AutoDriveIntentSignal = {
  kind: AutoDriveIntentSignalKind;
  summary: string;
  source: string | null;
  confidence: AutoDriveConfidence;
};

export type AutoDriveDirectionHypothesis = {
  summary: string;
  rationale: string;
  suggestedAreas: string[];
  confidence: AutoDriveConfidence;
  dominantSignalKinds: AutoDriveIntentSignalKind[];
};

export type AutoDriveIntentModel = {
  summary: string;
  signals: AutoDriveIntentSignal[];
  directionHypotheses: AutoDriveDirectionHypothesis[];
};

export type AutoDriveOpportunityCandidate = {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  repoAreas: string[];
  score: number;
  confidence: AutoDriveConfidence;
  risk: AutoDriveRiskLevel;
  scoreBreakdown?: Array<{
    reasonCode: string;
    label: string;
    delta: number;
  }>;
  selectionTags?: string[];
};

export type AutoDriveOpportunityQueue = {
  selectedCandidateId: string | null;
  selectionSummary?: string | null;
  candidates: AutoDriveOpportunityCandidate[];
};

export type AutoDrivePublishReadiness = {
  allowed: boolean;
  recommendedMode: "hold" | "branch_only" | "push_candidate";
  summary: string;
  reasonCodes: Array<
    | "dirty_working_tree"
    | "behind_remote"
    | "missing_remote"
    | "active_blockers"
    | "validation_incomplete"
    | "route_risk_high"
  >;
};

export type AutoDrivePublishOutcome = {
  mode: "branch_only" | "push_candidate";
  status: "completed" | "failed" | "skipped";
  summary: string;
  commitMessage: string | null;
  branchName: string | null;
  restoreBranch?: string | null;
  pushed: boolean;
  operatorActions?: string[];
  createdAt: number;
};

export type AutoDrivePublishHandoff = {
  schemaVersion: "autodrive-publish-handoff/v1";
  runId: string;
  workspaceId: string;
  threadId: string | null;
  createdAt: number;
  publish: {
    branchName: string;
    commitMessage: string | null;
    summary: string;
  };
  destination: {
    title: string;
    desiredEndState: string[];
  };
  validation: {
    commands: string[];
    success: boolean | null;
    summary: string;
  };
  evidence: {
    summaryText: string;
    changedFiles: string[];
    blockers: string[];
  };
  reviewDraft: {
    title: string;
    body: string;
    checklist: string[];
  };
  operatorCommands: string[];
};

export type AutoDriveRepoBacklog = {
  openIssues: number | null;
  openPullRequests: number | null;
  highlights: string[];
};

export type AutoDriveThreadContext = {
  threadId: string;
  snapshotUpdatedAt: number | null;
  recentUserPrompts: string[];
  recentAssistantReplies: string[];
  longTermMemorySummary: string | null;
  longTermMemoryUpdatedAt: number | null;
  summary: string | null;
};

export type AutoDriveExternalResearchPolicy = {
  provider: "openai" | "anthropic" | "google" | "local" | "unknown";
  enabled: boolean;
  strategy: "disabled" | "search-only" | "search+content";
  fetchPageContent: boolean;
  query: string | null;
  recencyDays: number | null;
  reasonCodes: string[];
};

export type AutoDriveExecutionTuning = {
  summary: string;
  reasons: string[];
  effectiveMaxFilesPerIteration: number;
  validationCommandPreference: "fast" | "full";
  publishPriority: "none" | "prepare_branch" | "push_candidate";
  cautionLevel: "normal" | "elevated" | "high";
};

export type AutoDriveHistoricalPublishCorridor = {
  runId: string;
  destinationTitle: string;
  summaryText: string;
  changedFiles: string[];
  validationCommands: string[];
  validationSummary: string;
  createdAt: number;
  matchScore: number;
};

export type AutoDrivePublishHistory = {
  bestCorridor: AutoDriveHistoricalPublishCorridor | null;
  latestFailureSummary: string | null;
};

export type AutoDriveRouteHealth = {
  offRoute: boolean;
  noProgressLoop: boolean;
  rerouteRecommended: boolean;
  rerouteReason: string | null;
  triggerSignals: string[];
};

export type AutoDriveProgressModel = {
  currentMilestone: string | null;
  currentWaypointTitle: string | null;
  completedWaypoints: number;
  totalWaypoints: number;
  waypointCompletion: number;
  overallProgress: number;
  remainingMilestones: string[];
  remainingBlockers: string[];
  remainingDistance: string;
  arrivalConfidence: AutoDriveConfidence;
  stopRisk: AutoDriveRiskLevel;
};

export type AutoDriveStartStateModel = {
  summary: string;
  repo: {
    branch: string | null;
    dirtyWorkingTree: boolean;
    recentCommits: string[];
    touchedAreas: string[];
    changedPaths: string[];
    unresolvedBlockers: string[];
  };
  task: {
    completedSubgoals: string[];
    pendingMilestones: string[];
    confidence: AutoDriveConfidence;
    risk: AutoDriveRiskLevel;
    currentBlocker: string | null;
  };
  system: {
    consumedTokensEstimate: number;
    remainingTokensEstimate: number | null;
    iterationsUsed: number;
    remainingIterations: number;
    elapsedMs: number;
    remainingDurationMs: number | null;
    validationFailureCount: number;
    noProgressCount: number;
    repeatedFailureCount: number;
    rerouteCount: number;
    stopRisk: AutoDriveRiskLevel;
  };
  routeHealth: AutoDriveRouteHealth;
};

export type AutoDriveContextSnapshot = {
  schemaVersion: "autodrive-context/v2";
  runId: string;
  iteration: number;
  destination: AutoDriveDestinationModel;
  startState: AutoDriveStartStateModel;
  repo: {
    packageManager: string | null;
    workspaceMarkers: string[];
    scripts: {
      test?: string;
      testComponent?: string;
      dev?: string;
      build?: string;
      validateFast?: string;
      validate?: string;
      validateFull?: string;
      preflight?: string;
      [key: string]: string | undefined;
    };
    evaluation?: AutoDriveRepoEvaluationProfile;
    ruleEvidence: AutoDriveRuleEvidence[];
    relevantDocs: AutoDriveRuleEvidence[];
    relevantFiles: string[];
  };
  git: {
    branch: string | null;
    remote: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
    recentCommits: AutoDriveCommitEvidence[];
    workingTree: {
      dirty: boolean;
      stagedCount: number;
      unstagedCount: number;
      changedPaths: string[];
      totalAdditions: number;
      totalDeletions: number;
    };
  };
  collaboratorIntent: AutoDriveCollaboratorIntent;
  intent: AutoDriveIntentModel;
  opportunities: AutoDriveOpportunityQueue;
  executionTuning: AutoDriveExecutionTuning;
  publishReadiness: AutoDrivePublishReadiness;
  publishHistory: AutoDrivePublishHistory;
  repoBacklog: AutoDriveRepoBacklog;
  threadContext: AutoDriveThreadContext | null;
  previousSummary: AutoDriveIterationSummary | null;
  blockers: string[];
  completedSubgoals: string[];
  externalResearch: AutoDriveExternalResearchEntry[];
  researchPolicy?: AutoDriveExternalResearchPolicy;
  synthesizedAt: number;
};

export type AutoDriveRouteEvidence = {
  kind:
    | "destination"
    | "intent_signal"
    | "direction_hypothesis"
    | "repo_rule"
    | "doc"
    | "git"
    | "summary"
    | "collaborator_intent"
    | "external"
    | "evaluation";
  detail: string;
  source?: string | null;
};

export type AutoDriveRouteMilestone = {
  id: string;
  title: string;
  description: string;
  status: "completed" | "active" | "remaining" | "blocked";
  arrivalCriteria: string[];
  repoAreas: string[];
};

export type AutoDriveWaypointProposal = {
  id: string;
  title: string;
  objective: string;
  whyNow: string;
  repoAreas: string[];
  commandsToRun: string[];
  validationPlan: string[];
  samplePaths: string[];
  heldOutGuidance: string[];
  scenarioKeys: string[];
  arrivalCriteria: string[];
  stopIf: string[];
  rerouteTriggers: string[];
  expectedOutput: string[];
  estimatedCost: {
    tokens: number;
    iterations: number;
    durationMs: number | null;
    risk: AutoDriveRiskLevel;
  };
  confidence: AutoDriveConfidence;
};

export type AutoDriveRouteProposal = {
  schemaVersion: "autodrive-route-proposal/v2";
  runId: string;
  iteration: number;
  routeSummary: string;
  routeSelectionReason: string;
  whyThisWaypointNow: string;
  evidence: AutoDriveRouteEvidence[];
  evidenceSummary: string;
  collaboratorIntentSummary: string;
  milestones: AutoDriveRouteMilestone[];
  currentWaypoint: AutoDriveWaypointProposal;
  remainingMilestones: string[];
  routeConfidence: AutoDriveConfidence;
  promptText: string;
};

export type AutoDriveProposalReviewIssue = {
  code:
    | "scope_too_large"
    | "missing_validation"
    | "proposal_drift"
    | "desktop_web_mixup"
    | "low_evidence_inference"
    | "protected_boundary_conflict"
    | "route_budget_pressure"
    | "reroute_required";
  detail: string;
};

export type AutoDriveProposalReview = {
  approved: boolean;
  issues: AutoDriveProposalReviewIssue[];
  confidence: AutoDriveConfidence;
  shouldReroute: boolean;
  rerouteReason: string | null;
};

export type AutoDriveRerouteRecord = {
  iteration: number;
  mode: "soft" | "hard";
  reason: string;
  trigger: string;
  previousRouteSummary: string | null;
  nextRouteSummary: string | null;
  createdAt: number;
};

export type AutoDriveWaypointResult = {
  id: string;
  title: string;
  status: AutoDriveWaypointStatus;
  arrivalCriteriaMet: string[];
  arrivalCriteriaMissed: string[];
};

export type AutoDriveIterationSummary = {
  schemaVersion: "autodrive-summary/v2";
  runId: string;
  iteration: number;
  status: "success" | "failed" | "paused";
  taskTitle: string;
  summaryText: string;
  changedFiles: string[];
  blockers: string[];
  completedSubgoals: string[];
  unresolvedItems: string[];
  suggestedNextAreas: string[];
  validation: AutoDriveValidationResult;
  progress: AutoDriveProgressModel;
  routeHealth: AutoDriveRouteHealth;
  waypoint: AutoDriveWaypointResult;
  goalReached: boolean;
  task: AutoDriveTaskReference;
  reroute: AutoDriveRerouteRecord | null;
  publish?: AutoDrivePublishOutcome | null;
  createdAt: number;
};

export type AutoDriveRunNavigationState = {
  destinationSummary: string;
  startStateSummary: string | null;
  routeSummary: string | null;
  currentWaypointTitle: string | null;
  currentWaypointObjective: string | null;
  currentWaypointArrivalCriteria: string[];
  waypointStatus?: AutoDriveWaypointStatus | null;
  remainingMilestones: string[];
  currentMilestone: string | null;
  overallProgress: number;
  waypointCompletion: number;
  offRoute: boolean;
  rerouting: boolean;
  rerouteReason: string | null;
  remainingBlockers: string[];
  arrivalConfidence: AutoDriveConfidence;
  stopRisk: AutoDriveRiskLevel;
  remainingTokens: number | null;
  remainingIterations: number;
  remainingDurationMs: number | null;
  lastDecision: string | null;
};

export type AutoDriveRunRecord = {
  schemaVersion: "autodrive-run/v2";
  runId: string;
  workspaceId: string;
  workspacePath: string;
  threadId: string | null;
  status: AutoDriveRunStatus;
  stage: AutoDriveRunStage;
  destination: AutoDriveDestinationModel;
  budget: AutoDriveBudget;
  riskPolicy: AutoDriveRiskPolicy;
  continuationPolicy?: AutoDriveContinuationPolicy | null;
  continuationState?: AutoDriveContinuationState | null;
  execution?: AutoDriveExecutionConfig | null;
  iteration: number;
  totals: AutoDriveRunTotals;
  blockers: string[];
  completedSubgoals: string[];
  summaries: AutoDriveIterationSummary[];
  navigation: AutoDriveRunNavigationState;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  lastStopReason: AutoDriveStopReason | null;
  sessionId: string | null;
  lastValidationSummary?: string | null;
  currentBlocker?: string | null;
  latestReroute?: AutoDriveRerouteRecord | null;
  latestPublishOutcome?: AutoDrivePublishOutcome | null;
  runtimeScenarioProfile?: AutoDriveRuntimeScenarioProfile | null;
  runtimeDecisionTrace?: AutoDriveRuntimeDecisionTrace | null;
  runtimeOutcomeFeedback?: AutoDriveRuntimeOutcomeFeedback | null;
  runtimeAutonomyState?: AutoDriveRuntimeAutonomyState | null;
  runtimeContinuationState?: AutoDriveRuntimeContinuationState | null;
  lastChatgptDecisionLab?: AutoDriveChatgptDecisionLabResult | null;
  runtimeResearchTrace?: AutoDriveRuntimeResearchTrace | null;
  runtimeResearchSources?: AutoDriveResearchSource[];
  lastChatgptResearchRouteLab?: AutoDriveChatgptResearchRouteLabResult | null;
};

export type AutoDriveNextDecision = {
  action: AutoDriveStopAction;
  reason: AutoDriveStopReason | null;
  reroute?: AutoDriveRerouteRecord | null;
};

export type AutoDriveControllerDeps = {
  getGitStatus: (workspaceId: string) => Promise<{
    branchName: string;
    files: GitFileStatus[];
    stagedFiles: GitFileStatus[];
    unstagedFiles: GitFileStatus[];
    totalAdditions: number;
    totalDeletions: number;
  }>;
  getGitLog: (workspaceId: string, limit: number) => Promise<GitLogResponse>;
  getGitCommitDiff: (workspaceId: string, sha: string) => Promise<GitCommitDiff[]>;
  listGitBranches: (workspaceId: string) => Promise<GitBranchesSnapshot>;
  getGitRemote?: (workspaceId: string) => Promise<string | null>;
  stageGitAll?: (workspaceId: string) => Promise<void>;
  commitGit?: (workspaceId: string, message: string) => Promise<void>;
  generateCommitMessage?: (workspaceId: string) => Promise<string>;
  createGitBranch?: (workspaceId: string, name: string) => Promise<void>;
  checkoutGitBranch?: (workspaceId: string, name: string) => Promise<void>;
  pushGit?: (workspaceId: string) => Promise<void>;
  getGitHubIssues?: (workspaceId: string) => Promise<GitHubIssuesResponse>;
  getGitHubPullRequests?: (workspaceId: string) => Promise<GitHubPullRequestsResponse>;
  readPersistedThreadSnapshots?: () => Promise<
    Record<
      string,
      {
        workspaceId: string;
        threadId: string;
        name: string;
        updatedAt: number;
        items: ConversationItem[];
        lastDurationMs?: number | null;
      }
    >
  >;
  readThreadAtlasMemoryDigests?: () => Promise<
    Record<
      string,
      {
        summary: string;
        updatedAt: number;
      }
    >
  >;
  getWorkspaceFiles: (workspaceId: string) => Promise<string[]>;
  readWorkspaceFile: (
    workspaceId: string,
    path: string
  ) => Promise<{ content: string; truncated: boolean }>;
  spawnSubAgentSession: (request: SubAgentSpawnRequest) => Promise<SubAgentSessionSummary>;
  sendSubAgentInstruction: (request: SubAgentSendRequest) => Promise<SubAgentSendResult>;
  waitSubAgentSession: (request: SubAgentWaitRequest) => Promise<SubAgentWaitResult>;
  getSubAgentSessionStatus: (request: {
    sessionId: string;
  }) => Promise<SubAgentSessionSummary | null>;
  interruptSubAgentSession: (request: SubAgentInterruptRequest) => Promise<SubAgentInterruptAck>;
  closeSubAgentSession: (request: SubAgentCloseRequest) => Promise<SubAgentCloseAck>;
  runRuntimeBrowserDebug?: (
    request: RuntimeBrowserDebugRunRequest
  ) => Promise<RuntimeBrowserDebugRunResponse>;
  runLiveSkill: (request: LiveSkillExecuteRequest) => Promise<LiveSkillExecutionResult>;
  now?: () => number;
  createRunId?: () => string;
  delay?: (durationMs: number) => Promise<void>;
};

export type AutoDriveLedger = {
  writeRun: (run: AutoDriveRunRecord) => Promise<void>;
  writeContext: (context: AutoDriveContextSnapshot) => Promise<void>;
  writeProposal: (proposal: AutoDriveRouteProposal) => Promise<void>;
  writeSummary: (summary: AutoDriveIterationSummary) => Promise<void>;
  writeReroute: (record: {
    runId: string;
    iteration: number;
    reroute: AutoDriveRerouteRecord;
  }) => Promise<void>;
  writeFinalReport: (input: {
    run: AutoDriveRunRecord;
    latestSummary: AutoDriveIterationSummary | null;
    markdown: string;
  }) => Promise<void>;
  writePublishHandoff?: (input: {
    runId: string;
    handoff: AutoDrivePublishHandoff;
    markdown: string;
  }) => Promise<void>;
  readRun?: (runId: string) => Promise<AutoDriveRunRecord | null>;
};

export type AutoDriveControllerHookDraft = {
  enabled: boolean;
  scenarioProfile?: "browser_repro_fix_verify" | "research_route_decide" | null;
  destination: {
    title: string;
    endState: string;
    doneDefinition: string;
    avoid: string;
    routePreference: AutoDriveRoutePreference;
  };
  budget: {
    maxTokens: number;
    maxIterations: number;
    maxDurationMinutes: number;
    maxFilesPerIteration: number;
    maxNoProgressIterations: number;
    maxValidationFailures: number;
    maxReroutes: number;
  };
  riskPolicy: AutoDriveRiskPolicy;
  continuation?: AutoDriveContinuationPolicy;
};
