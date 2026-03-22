export type LifecycleStatusTone = "processing" | "completed" | "failed" | "unknown";

function normalizeStatusToken(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeLifecycleStatus(value: unknown): string {
  const raw = normalizeStatusToken(value);
  if (!raw) {
    return "";
  }

  const normalized = raw.replace(/[_\s-]/g, "").toLowerCase();
  if (
    ["inprogress", "running", "processing", "started", "pending", "queued"].includes(normalized)
  ) {
    return "inProgress";
  }
  if (["completed", "done", "success", "succeeded", "finished"].includes(normalized)) {
    return "completed";
  }
  if (["failed", "fail", "error", "errored"].includes(normalized)) {
    return "failed";
  }

  return raw;
}

export function lifecycleStatusTone(status?: string): LifecycleStatusTone {
  const normalized = normalizeLifecycleStatus(status);
  if (normalized === "failed") {
    return "failed";
  }
  if (normalized === "inProgress") {
    return "processing";
  }
  if (normalized === "completed") {
    return "completed";
  }
  return "unknown";
}
