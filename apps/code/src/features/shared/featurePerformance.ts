import { recordSentryMetricIfAvailable } from "./sentry";

export const FEATURE_PERFORMANCE_SURFACES = [
  "agent_runtime_orchestration",
  "agent_webmcp_console",
  "home",
  "home_launchpad",
  "home_recent_missions",
  "messages_timeline",
  "workspace_shell",
] as const;

export type FeaturePerformanceSurface = (typeof FEATURE_PERFORMANCE_SURFACES)[number];

let featureInteractionSequence = 0;

function getPerformanceApi(): Performance | null {
  if (typeof performance === "undefined") {
    return null;
  }
  return performance;
}

function buildMarkName(surface: FeaturePerformanceSurface, phase: string, sequence?: number) {
  return sequence === undefined
    ? `hugecode:${surface}:${phase}`
    : `hugecode:${surface}:${phase}:${sequence}`;
}

export function markFeatureVisible(surface: FeaturePerformanceSurface) {
  const perf = getPerformanceApi();
  perf?.mark(buildMarkName(surface, "visible"));
  void recordSentryMetricIfAvailable("feature_surface_visible", 1, {
    attributes: { surface },
  });
}

export function beginFeatureInteraction(surface: FeaturePerformanceSurface, phase = "open") {
  const perf = getPerformanceApi();
  const sequence = ++featureInteractionSequence;
  const startMark = buildMarkName(surface, `${phase}:start`, sequence);
  const endMark = buildMarkName(surface, `${phase}:end`, sequence);
  const measureName = buildMarkName(surface, `${phase}:duration_ms`, sequence);

  perf?.mark(startMark);
  void recordSentryMetricIfAvailable("feature_surface_interaction_started", 1, {
    attributes: { surface, phase },
  });

  return () => {
    perf?.mark(endMark);
    try {
      perf?.measure(measureName, startMark, endMark);
    } catch {
      // ignore measure failures in unsupported or mocked environments
    }
    void recordSentryMetricIfAvailable("feature_surface_interaction_completed", 1, {
      attributes: { surface, phase },
    });
  };
}
