import type { AutoDriveIterationSummary, AutoDriveRunRecord } from "../types/autoDrive";

export function sanitizeCommitMessage(message: string | null | undefined): string | null {
  if (typeof message !== "string") {
    return null;
  }
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildFallbackCommitMessage(
  run: AutoDriveRunRecord,
  summary: AutoDriveIterationSummary
): string {
  const source =
    sanitizeCommitMessage(summary.taskTitle) ?? sanitizeCommitMessage(run.destination.title);
  const normalized =
    source
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .slice(0, 60) ?? "advance route";
  return `feat(autodrive): ${normalized}`;
}

function sanitizeBranchSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function buildPublishBranchName(run: AutoDriveRunRecord, createdAt: number): string {
  const slug = sanitizeBranchSegment(run.destination.title) || "publish-candidate";
  const stamp = new Date(createdAt)
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const runTail = sanitizeBranchSegment(run.runId).slice(-10) || "run";
  return `autodrive/${slug}-${stamp}-${runTail}`;
}
