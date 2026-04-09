import type {
  AutoDriveConfidence,
  AutoDriveControllerHookDraft,
  AutoDriveContinuationPolicy,
  AutoDriveRiskPolicy,
  AutoDriveRoutePreference,
} from "../../../application/runtime/types/autoDrive";

export const DEFAULT_RISK_POLICY: AutoDriveRiskPolicy = {
  pauseOnDestructiveChange: true,
  pauseOnDependencyChange: true,
  pauseOnLowConfidence: true,
  pauseOnHumanCheckpoint: true,
  allowNetworkAnalysis: true,
  allowValidationCommands: true,
  allowChatgptDecisionLab: true,
  autoRunChatgptDecisionLab: true,
  chatgptDecisionLabMinConfidence: "medium",
  chatgptDecisionLabMaxScoreGap: 8,
  minimumConfidence: "medium",
};

export const DEFAULT_ROUTE_PREFERENCE: AutoDriveRoutePreference = "stability_first";

export const DEFAULT_CONTINUATION_POLICY: AutoDriveContinuationPolicy = {
  enabled: true,
  maxAutomaticFollowUps: 2,
  requireValidationSuccessToStop: true,
  minimumConfidenceToStop: "high",
};

export const DEFAULT_DRAFT: AutoDriveControllerHookDraft = {
  enabled: false,
  destination: {
    title: "",
    endState: "",
    doneDefinition: "",
    avoid: "",
    routePreference: DEFAULT_ROUTE_PREFERENCE,
  },
  budget: {
    maxTokens: 6000,
    maxIterations: 3,
    maxDurationMinutes: 10,
    maxFilesPerIteration: 6,
    maxNoProgressIterations: 2,
    maxValidationFailures: 2,
    maxReroutes: 2,
  },
  riskPolicy: DEFAULT_RISK_POLICY,
  continuation: DEFAULT_CONTINUATION_POLICY,
};

export type AutoDriveBudgetField = keyof AutoDriveControllerHookDraft["budget"];
export type AutoDrivePresetKey = "safe_default" | "tight_validation" | "fast_explore";

export const AUTO_DRIVE_PRESETS: Record<
  AutoDrivePresetKey,
  Pick<AutoDriveControllerHookDraft, "budget" | "riskPolicy"> & {
    routePreference: AutoDriveRoutePreference;
  }
> = {
  safe_default: {
    routePreference: "stability_first",
    budget: {
      maxTokens: 6000,
      maxIterations: 3,
      maxDurationMinutes: 10,
      maxFilesPerIteration: 6,
      maxNoProgressIterations: 2,
      maxValidationFailures: 2,
      maxReroutes: 2,
    },
    riskPolicy: DEFAULT_RISK_POLICY,
  },
  tight_validation: {
    routePreference: "validation_first",
    budget: {
      maxTokens: 2500,
      maxIterations: 2,
      maxDurationMinutes: 5,
      maxFilesPerIteration: 4,
      maxNoProgressIterations: 1,
      maxValidationFailures: 1,
      maxReroutes: 1,
    },
    riskPolicy: {
      ...DEFAULT_RISK_POLICY,
      allowNetworkAnalysis: false,
      allowValidationCommands: true,
    },
  },
  fast_explore: {
    routePreference: "speed_first",
    budget: {
      maxTokens: 4000,
      maxIterations: 2,
      maxDurationMinutes: 5,
      maxFilesPerIteration: 6,
      maxNoProgressIterations: 1,
      maxValidationFailures: 1,
      maxReroutes: 1,
    },
    riskPolicy: {
      ...DEFAULT_RISK_POLICY,
      allowNetworkAnalysis: true,
      allowValidationCommands: true,
    },
  },
};

function normalizeConfidence(value: string | null | undefined): AutoDriveConfidence {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return DEFAULT_RISK_POLICY.minimumConfidence;
}

function normalizeContinuationConfidence(value: string | null | undefined): AutoDriveConfidence {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return DEFAULT_CONTINUATION_POLICY.minimumConfidenceToStop;
}

type PersistedAutoDriveDraft = AutoDriveControllerHookDraft & {
  goal?: string;
  constraints?: string;
};

function migratePersistedDraftShape(
  value: PersistedAutoDriveDraft
): AutoDriveControllerHookDraft["destination"] {
  const migratedGoal = value.goal ?? "";
  const migratedConstraints = value.constraints ?? "";
  return {
    title: value.destination?.title ?? migratedGoal,
    endState: value.destination?.endState ?? "",
    doneDefinition: value.destination?.doneDefinition ?? "",
    avoid: value.destination?.avoid ?? migratedConstraints,
    routePreference: value.destination?.routePreference ?? DEFAULT_ROUTE_PREFERENCE,
  };
}

export function normalizeDraft(
  value: PersistedAutoDriveDraft | null | undefined
): AutoDriveControllerHookDraft {
  if (!value) {
    return DEFAULT_DRAFT;
  }
  return {
    enabled: value.enabled === true,
    destination: migratePersistedDraftShape(value),
    budget: {
      maxTokens: value.budget?.maxTokens ?? DEFAULT_DRAFT.budget.maxTokens,
      maxIterations: value.budget?.maxIterations ?? DEFAULT_DRAFT.budget.maxIterations,
      maxDurationMinutes:
        value.budget?.maxDurationMinutes ?? DEFAULT_DRAFT.budget.maxDurationMinutes,
      maxFilesPerIteration:
        value.budget?.maxFilesPerIteration ?? DEFAULT_DRAFT.budget.maxFilesPerIteration,
      maxNoProgressIterations:
        value.budget?.maxNoProgressIterations ?? DEFAULT_DRAFT.budget.maxNoProgressIterations,
      maxValidationFailures:
        value.budget?.maxValidationFailures ?? DEFAULT_DRAFT.budget.maxValidationFailures,
      maxReroutes: value.budget?.maxReroutes ?? DEFAULT_DRAFT.budget.maxReroutes,
    },
    riskPolicy: {
      ...DEFAULT_RISK_POLICY,
      ...(value.riskPolicy ?? {}),
      minimumConfidence: normalizeConfidence(value.riskPolicy?.minimumConfidence),
    },
    continuation: {
      ...DEFAULT_CONTINUATION_POLICY,
      ...(value.continuation ?? {}),
      minimumConfidenceToStop: normalizeContinuationConfidence(
        value.continuation?.minimumConfidenceToStop
      ),
    },
  };
}

function clampInteger(value: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.max(minimum, Math.round(value));
}

export function sanitizeBudgetValue(key: AutoDriveBudgetField, value: number): number {
  const minimums: Record<AutoDriveBudgetField, number> = {
    maxTokens: 100,
    maxIterations: 1,
    maxDurationMinutes: 1,
    maxFilesPerIteration: 1,
    maxNoProgressIterations: 1,
    maxValidationFailures: 1,
    maxReroutes: 1,
  };
  return clampInteger(value, minimums[key]);
}

export function normalizeBudgetDraftValue(current: number, next: number): number {
  if (!Number.isFinite(next)) {
    return current;
  }
  const rounded = Math.round(next);
  if (rounded <= 0) {
    return current;
  }
  return rounded;
}

export function resolveActivePresetKey(
  draft: AutoDriveControllerHookDraft
): AutoDrivePresetKey | "custom" {
  const entries = Object.entries(AUTO_DRIVE_PRESETS) as Array<
    [AutoDrivePresetKey, (typeof AUTO_DRIVE_PRESETS)[AutoDrivePresetKey]]
  >;
  for (const [key, preset] of entries) {
    const sameRoutePreference = draft.destination.routePreference === preset.routePreference;
    const sameBudget = Object.entries(preset.budget).every(([budgetKey, value]) => {
      const typedKey = budgetKey as keyof AutoDriveControllerHookDraft["budget"];
      return draft.budget[typedKey] === value;
    });
    const sameRiskPolicy = Object.entries(preset.riskPolicy).every(([policyKey, value]) => {
      const typedKey = policyKey as keyof AutoDriveRiskPolicy;
      return draft.riskPolicy[typedKey] === value;
    });
    if (sameRoutePreference && sameBudget && sameRiskPolicy) {
      return key;
    }
  }
  return "custom";
}
