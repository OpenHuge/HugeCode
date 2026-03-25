const SMOKE_RUNTIME_READY_TIMEOUT_MS = "480000";
const SMOKE_WEBSERVER_TIMEOUT_MS = "540000";

function readBooleanFlag(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
}

export function resolveCodeRuntimeServicePrewarmPolicy({ category, env = process.env } = {}) {
  const explicitOverride = readBooleanFlag(env.CODE_RUNTIME_E2E_PREWARM);
  if (explicitOverride !== null) {
    return {
      enabled: explicitOverride,
      reason: explicitOverride
        ? "explicit CODE_RUNTIME_E2E_PREWARM override"
        : "disabled by CODE_RUNTIME_E2E_PREWARM override",
    };
  }

  if (category === "smoke") {
    return {
      enabled: true,
      reason: "smoke runs prewarm the Rust runtime service to reduce cold-cache startup variance",
    };
  }

  if (readBooleanFlag(env.CI) === true) {
    return {
      enabled: true,
      reason: "CI runs prewarm the Rust runtime service to reduce cold-cache startup variance",
    };
  }

  return {
    enabled: false,
    reason: "prewarm not required for this category",
  };
}

export function buildCodeE2EStartupEnv({ category, env = process.env } = {}) {
  if (category !== "smoke") {
    return {
      ...env,
    };
  }

  return {
    ...env,
    // Smoke runs regularly pay the cold Rust runtime compile cost before
    // the health endpoint exists, so keep their startup budget higher than
    // interactive/default dev without changing the repo-wide baseline.
    CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS:
      env.CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS ?? SMOKE_RUNTIME_READY_TIMEOUT_MS,
    PW_WEBSERVER_TIMEOUT_MS: env.PW_WEBSERVER_TIMEOUT_MS ?? SMOKE_WEBSERVER_TIMEOUT_MS,
  };
}
