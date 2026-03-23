type SentryMetricsOptions = {
  attributes?: Record<string, string>;
};

type SentryCaptureContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

let sentryReactModulePromise: Promise<typeof import("@sentry/react") | null> | null = null;

function loadSentryReactModule() {
  if (!sentryReactModulePromise) {
    sentryReactModulePromise = import("@sentry/react").catch(() => null);
  }
  return sentryReactModulePromise;
}

async function loadAvailableSentryReactModule() {
  if (!sentryReactModulePromise) {
    return null;
  }
  return sentryReactModulePromise;
}

export function recordSentryMetric(
  metricName: string,
  value: number,
  options?: SentryMetricsOptions
) {
  void loadSentryReactModule().then((sentry) => {
    sentry?.metrics?.count?.(metricName, value, options);
  });
}

export async function recordSentryMetricIfAvailable(
  metricName: string,
  value: number,
  options?: SentryMetricsOptions
): Promise<boolean> {
  const sentry = await loadAvailableSentryReactModule();
  const count = sentry?.metrics?.count;
  if (typeof count !== "function") {
    return false;
  }
  count(metricName, value, options);
  return true;
}

export function captureSentryException(error: unknown, context?: SentryCaptureContext) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  void loadSentryReactModule().then((sentry) => {
    sentry?.captureException?.(normalizedError, context);
  });
}

export function __resetSentryModuleForTests() {
  sentryReactModulePromise = null;
}
