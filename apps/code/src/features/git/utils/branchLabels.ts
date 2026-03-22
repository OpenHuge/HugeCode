type BranchLabelContext = "header" | "panel";

type ResolveBranchDisplayLabelParams = {
  branchName: string | null | undefined;
  hasBranchContext: boolean;
  context: BranchLabelContext;
};

function normalizeBranchName(branchName: string | null | undefined): string {
  const trimmed = branchName?.trim() ?? "";
  return trimmed !== "unknown" ? trimmed : "";
}

export function resolveBranchDisplayLabel({
  branchName,
  hasBranchContext,
  context,
}: ResolveBranchDisplayLabelParams): string {
  const normalizedBranchName = normalizeBranchName(branchName);
  if (normalizedBranchName) {
    return normalizedBranchName;
  }

  if (hasBranchContext) {
    return "No branch";
  }

  return context === "header" ? "No git repo" : "Git unavailable";
}

export function resolveCurrentBranchName(branchName: string | null | undefined): string | null {
  const normalizedBranchName = normalizeBranchName(branchName);
  return normalizedBranchName || null;
}
