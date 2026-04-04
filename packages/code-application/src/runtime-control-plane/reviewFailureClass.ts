import type { HugeCodeFailureClass } from "@ku0/code-runtime-host-contract";

type ReviewFailureClassLabelStyle = "short" | "detail";

export function formatReviewFailureClassLabel(
  failureClass: HugeCodeFailureClass | null | undefined,
  options: { style?: ReviewFailureClassLabelStyle } = {}
): string | null {
  const style = options.style ?? "short";
  switch (failureClass) {
    case "validation_failed":
      return "Validation failure";
    case "approval_required":
      return "Approval required";
    case "runtime_failed":
      return "Runtime failure";
    case "timed_out":
      return style === "detail" ? "Run timed out" : "Timed out";
    case "interrupted":
      return "Interrupted";
    case "cancelled":
      return "Cancelled";
    case "unknown":
      return "Unknown failure";
    default:
      return null;
  }
}

export function describeReviewFailureClass(failureClass: HugeCodeFailureClass | null | undefined): {
  label: string | null;
  summary: string | null;
} {
  switch (failureClass) {
    case "validation_failed":
      return {
        label: formatReviewFailureClassLabel(failureClass, { style: "detail" }),
        summary: "The runtime reported a validation failure that needs operator attention.",
      };
    case "approval_required":
      return {
        label: formatReviewFailureClassLabel(failureClass, { style: "detail" }),
        summary: "A gatekeeper or approval intervention blocked this run.",
      };
    case "runtime_failed":
      return {
        label: formatReviewFailureClassLabel(failureClass, { style: "detail" }),
        summary: "The runtime experienced an unexpected error while executing the mission.",
      };
    case "timed_out":
      return {
        label: formatReviewFailureClassLabel(failureClass, { style: "detail" }),
        summary: "The run did not finish before the configured timeout window.",
      };
    case "interrupted":
      return {
        label: formatReviewFailureClassLabel(failureClass, { style: "detail" }),
        summary: "The run was interrupted manually or by a higher-priority signal.",
      };
    case "cancelled":
      return {
        label: formatReviewFailureClassLabel(failureClass, { style: "detail" }),
        summary: "The operator or system cancelled this run before completion.",
      };
    case "unknown":
      return {
        label: formatReviewFailureClassLabel(failureClass, { style: "detail" }),
        summary: "Runtime recorded that the run failed, but a detailed class was not attached.",
      };
    default:
      return {
        label: null,
        summary: null,
      };
  }
}
