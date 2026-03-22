export function normalizeRuntimeExecutionMode(
  value: string | null | undefined
): "runtime" | "local-cli" | "hybrid" | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (normalized === "runtime") {
    return "runtime";
  }
  if (normalized === "local-cli" || normalized === "local_cli") {
    return "local-cli";
  }
  if (normalized === "hybrid") {
    return "hybrid";
  }
  return null;
}
