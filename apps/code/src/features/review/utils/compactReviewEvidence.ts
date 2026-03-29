import type { HugeCodeValidationOutcome } from "@ku0/code-runtime-host-contract";
import {
  type CompactReviewEvidenceInput,
  type ReviewEvidenceInputReviewGate,
} from "../../../application/runtime/facades/runtimeReviewEvidenceModel";
import { buildMissionProvenanceSummary } from "../../../application/runtime/facades/runtimeMissionControlProvenance";
import {
  buildTaskSourceEvidenceLabel,
  normalizeTaskSourceLinkage,
  readTaskSourceGitHubProvenanceHint,
} from "../../../application/runtime/facades/runtimeMissionControlTaskSourceProjector";
import { formatValidationOutcomeLabel } from "../../../utils/reviewPackLabels";

export type ReviewEvidenceTone = "default" | "warning" | "success" | "progress";

export type ReviewEvidenceTruthOrigin = "runtime_published" | "compatibility_projection";

export type ReviewEvidenceField = {
  id: "source" | "source-proof" | "placement" | "launch" | "validation" | "next-action";
  label: string;
  value: string;
  detail: string | null;
  tone: ReviewEvidenceTone;
  truthOrigin: ReviewEvidenceTruthOrigin;
};

export type ReviewEvidenceBadge = {
  id: string;
  label: string;
  tone: ReviewEvidenceTone;
};

export type CompactReviewEvidenceDescriptor = {
  summary: string;
  badges: ReviewEvidenceBadge[];
  fields: ReviewEvidenceField[];
};

function joinDefined(parts: Array<string | null | undefined>, separator: string): string {
  return parts.filter((value): value is string => Boolean(value)).join(separator);
}

function normalizeValidationValue(label: string): string {
  const normalized = label.startsWith("Validation ") ? label.slice("Validation ".length) : label;
  return normalized.length > 0
    ? `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1)}`
    : normalized;
}

function resolveValidationTone(input: {
  validationOutcome: HugeCodeValidationOutcome;
  reviewGateState?: "pass" | "warn" | "fail" | "blocked" | null;
  reviewStatus?: "ready" | "action_required" | "incomplete_evidence" | null;
}): ReviewEvidenceTone {
  if (
    input.reviewGateState === "blocked" ||
    input.reviewGateState === "fail" ||
    input.reviewStatus === "action_required" ||
    input.reviewStatus === "incomplete_evidence" ||
    input.validationOutcome === "failed" ||
    input.validationOutcome === "warning" ||
    input.validationOutcome === "unknown"
  ) {
    return "warning";
  }
  if (input.reviewGateState === "pass" || input.validationOutcome === "passed") {
    return "success";
  }
  return "default";
}

function buildSourceField(input: CompactReviewEvidenceInput): ReviewEvidenceField {
  const normalized = normalizeTaskSourceLinkage(input.source);
  const value = buildTaskSourceEvidenceLabel(input.source);
  if (!normalized || !value) {
    return {
      id: "source",
      label: "Source",
      value: "Not published",
      detail: "Task source missing from runtime payload.",
      tone: "warning",
      truthOrigin: "compatibility_projection",
    };
  }
  return {
    id: "source",
    label: "Source",
    value,
    detail: normalized.title ?? normalized.url ?? null,
    tone: "default",
    truthOrigin: "runtime_published",
  };
}

function buildSourceProofField(input: CompactReviewEvidenceInput): ReviewEvidenceField {
  const githubHint = readTaskSourceGitHubProvenanceHint(input.source);
  if (githubHint) {
    return {
      id: "source-proof",
      label: "Source proof",
      value:
        joinDefined(
          [githubHint.repoFullName ?? "GitHub source", githubHint.refLabel, githubHint.eventLabel],
          " · "
        ) || "GitHub source",
      detail:
        joinDefined(
          [
            githubHint.refLabel,
            githubHint.eventLabel,
            githubHint.commentLabel ? `Comment ${githubHint.commentLabel}` : null,
            githubHint.sourceRecordId ? `Record ${githubHint.sourceRecordId}` : null,
            githubHint.handshakeSummary ?? githubHint.handshakeState,
          ],
          " | "
        ) || null,
      tone: "progress",
      truthOrigin: "runtime_published",
    };
  }

  const citationSummary = buildMissionProvenanceSummary(input.sourceCitations ?? null);
  if (citationSummary) {
    return {
      id: "source-proof",
      label: "Source proof",
      value: citationSummary,
      detail: "Projected from generic citations.",
      tone: "default",
      truthOrigin: "compatibility_projection",
    };
  }

  const normalized = normalizeTaskSourceLinkage(input.source);
  const linkageDetail = joinDefined(
    [
      normalized?.canonicalUrl ? `URL ${normalized.canonicalUrl}` : null,
      normalized?.sourceTaskId ? `Task ${normalized.sourceTaskId}` : null,
      normalized?.sourceRunId ? `Run ${normalized.sourceRunId}` : null,
      normalized?.requestId ? `Request ${normalized.requestId}` : null,
    ],
    " | "
  );
  if (linkageDetail) {
    return {
      id: "source-proof",
      label: "Source proof",
      value: "Linked source record",
      detail: linkageDetail,
      tone: "default",
      truthOrigin: "compatibility_projection",
    };
  }

  return {
    id: "source-proof",
    label: "Source proof",
    value: "Not published",
    detail: "GitHub/source record fields not yet published.",
    tone: "warning",
    truthOrigin: "compatibility_projection",
  };
}

function buildPlacementField(input: CompactReviewEvidenceInput): ReviewEvidenceField {
  const placement = input.placement;
  if (!placement) {
    return {
      id: "placement",
      label: "Placement",
      value: "Not published",
      detail: input.routeDetail ?? "Placement missing from runtime payload.",
      tone: "warning",
      truthOrigin: "compatibility_projection",
    };
  }

  const tone: ReviewEvidenceTone =
    placement.lifecycleState === "confirmed" && placement.healthSummary === "placement_ready"
      ? "success"
      : placement.lifecycleState === "fallback" ||
          placement.healthSummary === "placement_blocked" ||
          placement.healthSummary === "placement_attention"
        ? "warning"
        : "progress";
  return {
    id: "placement",
    label: "Placement",
    value: `${placement.resolvedBackendId ?? "Route pending"} · ${placement.lifecycleState.replaceAll("_", " ")}`,
    detail:
      joinDefined(
        [
          placement.resolutionSource,
          placement.healthSummary === "placement_ready"
            ? "Placement ready"
            : (placement.healthSummary?.replaceAll("_", " ") ?? null),
        ],
        " · "
      ) || placement.summary,
    tone,
    truthOrigin: "runtime_published",
  };
}

function buildLaunchField(input: CompactReviewEvidenceInput): ReviewEvidenceField {
  const githubHint = readTaskSourceGitHubProvenanceHint(input.source);
  if (githubHint?.handshakeSummary || githubHint?.handshakeState) {
    return {
      id: "launch",
      label: "Plan / launch",
      value: githubHint.handshakeSummary ?? `Handshake ${githubHint.handshakeState}`,
      detail:
        joinDefined(
          [
            githubHint.refLabel,
            githubHint.sourceRecordId ? `Record ${githubHint.sourceRecordId}` : null,
          ],
          " | "
        ) || null,
      tone: "progress",
      truthOrigin: "runtime_published",
    };
  }

  const planVersion = input.missionBrief?.planVersion ?? input.relaunchContext?.sourcePlanVersion;
  if (planVersion) {
    return {
      id: "launch",
      label: "Plan / launch",
      value: `Plan ${planVersion}`,
      detail:
        input.missionBrief?.planSummary ??
        input.relaunchContext?.summary ??
        input.relaunchContext?.planChangeSummary ??
        null,
      tone: "progress",
      truthOrigin: "runtime_published",
    };
  }

  const normalized = normalizeTaskSourceLinkage(input.source);
  const launchLinkage = joinDefined(
    [
      normalized?.sourceTaskId ? `Task ${normalized.sourceTaskId}` : null,
      normalized?.sourceRunId ? `Run ${normalized.sourceRunId}` : null,
      normalized?.requestId ? `Request ${normalized.requestId}` : null,
      normalized?.threadId ? `Thread ${normalized.threadId}` : null,
    ],
    " | "
  );
  if (launchLinkage) {
    return {
      id: "launch",
      label: "Plan / launch",
      value: "Launch linkage",
      detail: launchLinkage,
      tone: "default",
      truthOrigin: "compatibility_projection",
    };
  }

  return {
    id: "launch",
    label: "Plan / launch",
    value: "Not published",
    detail: "Plan version or handshake missing.",
    tone: "warning",
    truthOrigin: "compatibility_projection",
  };
}

function buildValidationField(input: CompactReviewEvidenceInput): ReviewEvidenceField {
  return {
    id: "validation",
    label: "Validation",
    value: normalizeValidationValue(formatValidationOutcomeLabel(input.validationOutcome)),
    detail:
      buildReviewEvidenceGateLabel(input.reviewGate ?? null) ??
      joinDefined(
        [
          input.evidenceLabel,
          typeof input.warningCount === "number" && input.warningCount > 0
            ? `${input.warningCount} warning${input.warningCount === 1 ? "" : "s"}`
            : null,
        ],
        " · "
      ),
    tone: resolveValidationTone({
      validationOutcome: input.validationOutcome,
      reviewGateState: input.reviewGate?.state ?? null,
      reviewStatus: input.reviewStatus ?? null,
    }),
    truthOrigin: "runtime_published",
  };
}

function buildNextActionField(input: CompactReviewEvidenceInput): ReviewEvidenceField {
  const value =
    input.nextActionLabel?.trim() || input.recommendedNextAction?.trim() || "Inspect review detail";
  const detail = [
    input.nextActionDetail?.trim() || null,
    input.recommendedNextAction?.trim() || null,
    input.continuePathLabel ? `Continue via ${input.continuePathLabel}` : null,
  ].find((candidate) => Boolean(candidate) && candidate !== value);
  return {
    id: "next-action",
    label: "Next action",
    value,
    detail: detail ?? null,
    tone: "progress",
    truthOrigin: "runtime_published",
  };
}

export function buildReviewEvidenceGateLabel(
  reviewGate: ReviewEvidenceInputReviewGate
): string | null {
  if (!reviewGate?.state) {
    return null;
  }
  return `${reviewGate.state === "pass" ? "Review gate pass" : `Review gate ${reviewGate.state}`}${typeof reviewGate.findingCount === "number" && reviewGate.findingCount > 0 ? ` · ${reviewGate.findingCount} findings` : ""}`;
}

export function buildCompactReviewEvidenceDescriptor(
  input: CompactReviewEvidenceInput
): CompactReviewEvidenceDescriptor {
  const fields: ReviewEvidenceField[] = [
    buildSourceField(input),
    buildSourceProofField(input),
    buildPlacementField(input),
    buildLaunchField(input),
    buildValidationField(input),
    buildNextActionField(input),
  ];
  const hasCompatibilityProjection = fields.some(
    (field) => field.truthOrigin === "compatibility_projection"
  );
  return {
    summary: "Runtime truth, source lineage, validation, and next action in one strip.",
    badges: [
      { id: "runtime-truth-first", label: "Runtime truth", tone: "success" },
      ...(hasCompatibilityProjection
        ? [
            {
              id: "compatibility-projection",
              label: "Projected fallback",
              tone: "default" as const,
            },
          ]
        : []),
    ],
    fields,
  };
}
