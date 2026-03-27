import type { MissionControlProjection } from "./runtimeMissionControlFacade";

export function describeMissionRunRouteDetail(
  projection: MissionControlProjection | null | undefined,
  runId: string | null
) {
  if (!projection || !runId) return null;
  const run = projection.runs.find((entry) => entry.id === runId) ?? null;
  if (!run) return null;
  const routeLabel = run.routing?.routeLabel?.trim() || null;
  const resolvedBackendId = run.placement?.resolvedBackendId?.trim() || null;
  const routeHealth = run.routing?.health ?? run.placement?.readiness ?? null;
  const placementHealth = run.placement?.healthSummary ?? null;
  const parts = [routeLabel ?? (resolvedBackendId ? `Backend ${resolvedBackendId}` : null)];
  if (resolvedBackendId && !parts.some((part) => part?.includes(resolvedBackendId))) {
    parts.push(resolvedBackendId);
  }
  if (placementHealth === "placement_attention" || routeHealth === "attention") {
    parts.push("Route needs attention");
  } else if (placementHealth === "placement_blocked" || routeHealth === "blocked") {
    parts.push("Route blocked");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
