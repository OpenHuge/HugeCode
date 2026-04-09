import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";
import { resolveTaskSourceSecondaryLabel } from "@ku0/code-application/runtimeMissionControlTaskSourceProjector";

export function buildMissionSecondaryLabel(input: {
  isRuntimeManaged: boolean;
  taskSource?:
    | MissionControlProjection["tasks"][number]["taskSource"]
    | MissionControlProjection["runs"][number]["taskSource"]
    | MissionControlProjection["reviewPacks"][number]["taskSource"]
    | null
    | undefined;
}) {
  const labels: string[] = [];
  if (input.isRuntimeManaged) {
    labels.push("Runtime-managed mission");
  }
  const taskSourceLabel = resolveTaskSourceSecondaryLabel(input.taskSource ?? null);
  if (taskSourceLabel) {
    labels.push(taskSourceLabel);
  }
  return labels.length > 0 ? labels.join(" | ") : null;
}
