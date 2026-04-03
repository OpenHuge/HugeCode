export type RuntimeExecutionLifecycleStage =
  | "before_execute"
  | "validated"
  | "blocked"
  | "started"
  | "tool_started"
  | "tool_completed"
  | "rerouted"
  | "after_execute"
  | "completed";

export type RuntimeExecutionLifecycleSummary = {
  stage: RuntimeExecutionLifecycleStage;
  summary: string;
  blocked: boolean;
  rerouted: boolean;
  validated: boolean;
  readyForReview: boolean;
  updatedAt: number | null;
};

export type RuntimeExecutionEvidenceState =
  | "missing"
  | "incomplete"
  | "confirmed"
  | "ready_for_review";

export type RuntimeExecutionEvidenceReviewStatus =
  | "ready"
  | "action_required"
  | "incomplete_evidence";

export type RuntimeExecutionEvidenceSummary = {
  state: RuntimeExecutionEvidenceState;
  summary: string;
  validationCount: number;
  artifactCount: number;
  warningCount: number;
  changedPathCount: number;
  authoritativeTraceId?: string | null;
  authoritativeCheckpointId?: string | null;
  reviewStatus?: RuntimeExecutionEvidenceReviewStatus | null;
};
