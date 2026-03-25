const SMOKE_RUNTIME_READY_TIMEOUT_MS = "480000";
const SMOKE_WEBSERVER_TIMEOUT_MS = "540000";

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
