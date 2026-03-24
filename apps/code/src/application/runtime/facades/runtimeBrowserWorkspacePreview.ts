import type { TerminalSessionSummary } from "@ku0/code-runtime-host-contract";
import type { DesktopBrowserWorkspaceSessionInfo } from "../ports/desktopHostBridge";

export type PreviewTargetCandidate = {
  command: string | null;
  id: string;
  label: string;
  preferredUrl: string | null;
  scriptName?: string | null;
  source: "manual" | "package-script" | "observed";
};

export type PreviewBootStatus = "idle" | "starting" | "ready" | "failed";

export type PreviewBootResult = {
  candidate: PreviewTargetCandidate | null;
  error: string | null;
  previewUrl: string | null;
  session: DesktopBrowserWorkspaceSessionInfo | null;
  status: PreviewBootStatus;
  terminalSessionId: string | null;
};

type PreviewBootDeps = {
  ensurePreviewSession(input: {
    previewServerStatus: "starting" | "ready" | "failed";
    targetUrl?: string | null;
    workspaceId: string;
  }): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
  openRuntimeTerminalSession(workspaceId: string): Promise<TerminalSessionSummary>;
  readRuntimeTerminalSession(sessionId: string): Promise<TerminalSessionSummary | null>;
  setPreviewSessionStatus(input: {
    previewServerStatus: "starting" | "ready" | "failed";
    sessionId: string;
  }): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
  writeRuntimeTerminalSession(input: {
    sessionId: string;
    input: string;
  }): Promise<TerminalSessionSummary | null>;
};

type PackageJsonLike = {
  packageManager?: string;
  scripts?: Record<string, string>;
};

const PREVIEW_SCRIPT_ORDER = ["dev", "preview", "start"] as const;
const LOOPBACK_URL_PATTERN =
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/[^\s]*)?/gi;
const PORT_PATTERN = /(?:--port(?:=|\s+)|-p\s+|PORT=|port\s*:?\s*)(\d{2,5})/i;

function normalizeUrl(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function inferPackageManagerCommand(packageManager?: string | null) {
  const normalized = packageManager?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("yarn")) {
    return (scriptName: string) => `yarn ${scriptName}`;
  }
  if (normalized.startsWith("bun")) {
    return (scriptName: string) => `bun run ${scriptName}`;
  }
  if (normalized.startsWith("npm")) {
    return (scriptName: string) => `npm run ${scriptName}`;
  }
  return (scriptName: string) => `pnpm ${scriptName}`;
}

function inferPreferredUrl(scriptName: string, commandText: string): string | null {
  const portMatch = commandText.match(PORT_PATTERN);
  const explicitPort = portMatch ? Number.parseInt(portMatch[1] ?? "", 10) : null;
  if (explicitPort && Number.isFinite(explicitPort)) {
    return `http://127.0.0.1:${explicitPort}`;
  }
  if (scriptName === "preview") {
    return "http://127.0.0.1:4173";
  }
  if (scriptName === "dev") {
    return "http://127.0.0.1:5173";
  }
  if (scriptName === "start") {
    return "http://127.0.0.1:3000";
  }
  return null;
}

export function parsePreviewTargetCandidates(packageJsonContent: string): PreviewTargetCandidate[] {
  const trimmed = packageJsonContent.trim();
  if (!trimmed) {
    return [];
  }
  let parsed: PackageJsonLike;
  try {
    parsed = JSON.parse(trimmed) as PackageJsonLike;
  } catch {
    return [];
  }
  const scripts = parsed.scripts ?? {};
  const toCommand = inferPackageManagerCommand(parsed.packageManager ?? null);
  return PREVIEW_SCRIPT_ORDER.flatMap((scriptName) => {
    const commandText = scripts[scriptName];
    if (typeof commandText !== "string" || commandText.trim().length === 0) {
      return [];
    }
    return [
      {
        id: `script:${scriptName}`,
        label: `${scriptName} script`,
        command: toCommand(scriptName),
        preferredUrl: inferPreferredUrl(scriptName, commandText),
        scriptName,
        source: "package-script" as const,
      },
    ];
  });
}

export function extractObservedPreviewUrl(lines: string[]): string | null {
  for (const line of lines) {
    const matches = [...line.matchAll(LOOPBACK_URL_PATTERN)];
    for (const match of matches) {
      const candidate = normalizeUrl(match[0]);
      if (candidate) {
        return candidate;
      }
    }
  }
  return null;
}

async function canReachPreviewUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(2_500),
    });
    return response.ok || response.status === 401 || response.status === 403;
  } catch {
    return false;
  }
}

async function waitForObservedPreviewUrl(params: {
  preferredUrl?: string | null;
  readRuntimeTerminalSession(sessionId: string): Promise<TerminalSessionSummary | null>;
  sessionId: string;
  timeoutMs?: number;
}) {
  const deadline = Date.now() + (params.timeoutMs ?? 45_000);
  let lastObservedUrl = normalizeUrl(params.preferredUrl);

  while (Date.now() < deadline) {
    const session = await params.readRuntimeTerminalSession(params.sessionId);
    const observedUrl = extractObservedPreviewUrl(session?.lines ?? []);
    if (observedUrl) {
      lastObservedUrl = observedUrl;
    }
    if (lastObservedUrl && (await canReachPreviewUrl(lastObservedUrl))) {
      return lastObservedUrl;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return null;
}

export async function bootManagedPreview(params: {
  candidate?: PreviewTargetCandidate | null;
  deps: PreviewBootDeps;
  explicitUrl?: string | null;
  workspaceId: string;
}): Promise<PreviewBootResult> {
  const explicitUrl = normalizeUrl(params.explicitUrl);
  const candidate = params.candidate ?? null;

  if (explicitUrl) {
    const previewSession = await params.deps.ensurePreviewSession({
      workspaceId: params.workspaceId,
      targetUrl: explicitUrl,
      previewServerStatus: (await canReachPreviewUrl(explicitUrl)) ? "ready" : "starting",
    });
    if (!previewSession) {
      return {
        candidate,
        error: "Unable to open preview browser workspace session.",
        previewUrl: explicitUrl,
        session: null,
        status: "failed",
        terminalSessionId: null,
      };
    }
    const reachable = await canReachPreviewUrl(explicitUrl);
    if (!reachable) {
      await params.deps.setPreviewSessionStatus({
        sessionId: previewSession.sessionId,
        previewServerStatus: "failed",
      });
      return {
        candidate,
        error: "Preview target did not respond on the provided loopback URL.",
        previewUrl: explicitUrl,
        session: previewSession,
        status: "failed",
        terminalSessionId: null,
      };
    }
    return {
      candidate,
      error: null,
      previewUrl: explicitUrl,
      session: await params.deps.setPreviewSessionStatus({
        sessionId: previewSession.sessionId,
        previewServerStatus: "ready",
      }),
      status: "ready",
      terminalSessionId: null,
    };
  }

  if (!candidate?.command) {
    return {
      candidate,
      error: "No preview command or loopback URL is available yet.",
      previewUrl: null,
      session: null,
      status: "failed",
      terminalSessionId: null,
    };
  }

  const startingSession = await params.deps.ensurePreviewSession({
    workspaceId: params.workspaceId,
    targetUrl: candidate.preferredUrl ?? null,
    previewServerStatus: "starting",
  });
  const terminalSession = await params.deps.openRuntimeTerminalSession(params.workspaceId);
  await params.deps.writeRuntimeTerminalSession({
    sessionId: terminalSession.id,
    input: `${candidate.command}\n`,
  });
  const previewUrl = await waitForObservedPreviewUrl({
    preferredUrl: candidate.preferredUrl,
    readRuntimeTerminalSession: params.deps.readRuntimeTerminalSession,
    sessionId: terminalSession.id,
  });
  if (!previewUrl) {
    if (startingSession) {
      await params.deps.setPreviewSessionStatus({
        sessionId: startingSession.sessionId,
        previewServerStatus: "failed",
      });
    }
    return {
      candidate,
      error: "Preview server did not publish a reachable loopback URL in time.",
      previewUrl: candidate.preferredUrl ?? null,
      session: startingSession,
      status: "failed",
      terminalSessionId: terminalSession.id,
    };
  }

  const readySession = await params.deps.ensurePreviewSession({
    workspaceId: params.workspaceId,
    targetUrl: previewUrl,
    previewServerStatus: "ready",
  });
  return {
    candidate,
    error: readySession ? null : "Preview browser workspace session could not be updated.",
    previewUrl,
    session: readySession,
    status: readySession ? "ready" : "failed",
    terminalSessionId: terminalSession.id,
  };
}
