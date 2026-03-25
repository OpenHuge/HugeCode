function normalizeBoolean(value) {
  return value === true;
}

function normalizeMetricCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeFailedSteps(steps) {
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps
    .filter((step) => step?.ok === false && typeof step?.label === "string")
    .map((step) => step.label);
}

function normalizeErrors(errors) {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
}

export function runVisibilityCheckWithTimeout(label, fn, timeoutMs = 10000) {
  const timeoutSentinel = Symbol("timeout");
  let timeoutId = null;
  const wrapped = Promise.resolve()
    .then(fn)
    .then(
      (value) => ({ kind: "ok", value }),
      (error) => ({ kind: "error", error })
    );
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(timeoutSentinel), timeoutMs);
  });

  return Promise.race([wrapped, timeoutPromise])
    .then((outcome) => {
      if (outcome === timeoutSentinel) {
        throw new Error(`timeout:${label}:${timeoutMs}`);
      }
      if (outcome.kind === "error") {
        throw outcome.error;
      }
      return outcome.value;
    })
    .finally(() => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    });
}

export function summarizeVisibilityCheckResult(result) {
  const failedSteps = normalizeFailedSteps(result?.steps);
  const errors = normalizeErrors(result?.errors);
  return {
    ok: failedSteps.length === 0 && errors.length === 0,
    url: typeof result?.url === "string" ? result.url : null,
    mode: {
      cdp: normalizeBoolean(result?.useCdp),
      trace: normalizeBoolean(result?.useTrace),
      initScript: normalizeBoolean(result?.useInit),
    },
    metricCount: normalizeMetricCount(result?.metricCount),
    stepCount: Array.isArray(result?.steps) ? result.steps.length : 0,
    failedSteps,
    errors,
  };
}

export function resolveVisibilityCheckExitCode(summary) {
  return summary?.ok ? 0 : 1;
}
