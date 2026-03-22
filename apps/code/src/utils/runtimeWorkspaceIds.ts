export const DEFAULT_RUNTIME_WORKSPACE_ID = "workspace-local";

export function isRuntimeLocalWorkspaceId(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() === DEFAULT_RUNTIME_WORKSPACE_ID;
}
