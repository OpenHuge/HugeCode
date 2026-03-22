const DEFAULT_WEB_E2E_PORT = 5187;
export const DEFAULT_WEB_SERVER_TIMEOUT = 300_000;

export function resolveWebE2EPort(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.WEB_E2E_PORT;
  if (!raw) {
    return DEFAULT_WEB_E2E_PORT;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_WEB_E2E_PORT;
  }

  return parsed;
}

export function parseWebServerTimeout(raw: string | undefined) {
  if (!raw) {
    return DEFAULT_WEB_SERVER_TIMEOUT;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1_000) {
    return DEFAULT_WEB_SERVER_TIMEOUT;
  }

  return parsed;
}
