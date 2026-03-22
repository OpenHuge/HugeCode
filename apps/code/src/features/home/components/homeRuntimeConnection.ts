export const DEFAULT_LOCAL_RUNTIME_PORT = 8788;

type RuntimeParseSuccess = {
  host: string | null;
  port: number;
  preview: string;
};

type RuntimeParseFailure = {
  error: string;
};

const REMOTE_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const ALLOWED_REMOTE_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);

function isValidPort(port: number) {
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

export function parseRuntimePortDraft(
  draft: string,
  defaultPort = DEFAULT_LOCAL_RUNTIME_PORT
): RuntimeParseSuccess | RuntimeParseFailure {
  const normalizedDraft = draft.trim();
  const parsedPort =
    normalizedDraft.length === 0 ? defaultPort : Number.parseInt(normalizedDraft, 10);

  if (!isValidPort(parsedPort)) {
    return { error: "Enter a valid runtime port between 1 and 65535." };
  }

  return {
    host: null,
    port: parsedPort,
    preview: `http://localhost / 127.0.0.1:${parsedPort}/rpc`,
  };
}

export function parseRemoteRuntimeAddress(
  draft: string,
  defaultPort = DEFAULT_LOCAL_RUNTIME_PORT
): RuntimeParseSuccess | RuntimeParseFailure {
  const normalizedDraft = draft.trim();
  if (normalizedDraft.length === 0) {
    return { error: "Enter a remote runtime address." };
  }

  const candidate = REMOTE_PROTOCOL_RE.test(normalizedDraft)
    ? normalizedDraft
    : `http://${normalizedDraft}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { error: "Enter a valid remote runtime address." };
  }

  if (!ALLOWED_REMOTE_PROTOCOLS.has(url.protocol)) {
    return { error: "Use an http, https, ws, or wss runtime address." };
  }

  const hostname = url.hostname.trim();
  if (hostname.length === 0) {
    return { error: "Enter a valid remote runtime host." };
  }

  const port = url.port.length > 0 ? Number.parseInt(url.port, 10) : defaultPort;
  if (!isValidPort(port)) {
    return { error: "Enter a valid runtime port between 1 and 65535." };
  }

  const previewHost =
    hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;

  return {
    host: hostname,
    port,
    preview: `${url.protocol}//${previewHost}:${port}/rpc`,
  };
}

export function parseRuntimeConnectionDraft(
  draft: string,
  defaultPort = DEFAULT_LOCAL_RUNTIME_PORT
): RuntimeParseSuccess | RuntimeParseFailure {
  const normalizedDraft = draft.trim();
  if (normalizedDraft.length === 0 || /^\d+$/.test(normalizedDraft)) {
    return parseRuntimePortDraft(normalizedDraft, defaultPort);
  }
  return parseRemoteRuntimeAddress(normalizedDraft, defaultPort);
}
