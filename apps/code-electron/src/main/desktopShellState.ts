import type {
  DesktopRuntimeMode,
  DesktopWindowLabel,
  OpenDesktopWindowInput,
} from "@ku0/code-platform-interfaces";

export type { DesktopRuntimeMode, DesktopWindowLabel };

export type DesktopWindowBounds = {
  height: number;
  width: number;
  x?: number;
  y?: number;
};

export type DesktopSessionDescriptor = {
  id: string;
  windowLabel: DesktopWindowLabel;
  workspacePath: string | null;
  workspaceLabel: string | null;
  preferredBackendId: string | null;
  runtimeMode: DesktopRuntimeMode;
  lastActiveAt: string;
  windowBounds?: DesktopWindowBounds;
};

export type DesktopPersistedState = {
  sessions: DesktopSessionDescriptor[];
  trayEnabled: boolean;
};

export type DesktopWindowDescriptor = {
  focused: boolean;
  hidden?: boolean;
  sessionId: string;
  windowId: number;
  windowLabel: DesktopWindowLabel;
  workspaceLabel: string | null;
};

export type OpenDesktopSessionInput = OpenDesktopWindowInput;

type ActiveWindowRecord = {
  sessionId: string;
  windowId: number;
};

type DesktopShellStateOptions = {
  now?: () => string;
  persistedState?: DesktopPersistedState;
};

const MAX_RECENT_SESSIONS = 20;

function createSessionFingerprint(input: {
  windowLabel: DesktopWindowLabel;
  workspacePath: string | null;
}) {
  return `${input.windowLabel}:${normalizeWorkspacePath(input.workspacePath) ?? ""}`;
}

function normalizeWorkspacePath(workspacePath: string | null | undefined) {
  if (typeof workspacePath !== "string") {
    return null;
  }

  const trimmedPath = workspacePath.trim();
  return trimmedPath.length > 0 ? trimmedPath : null;
}

function normalizeWorkspaceLabel(workspaceLabel: string | null | undefined) {
  if (typeof workspaceLabel !== "string") {
    return null;
  }

  const trimmedLabel = workspaceLabel.trim();
  return trimmedLabel.length > 0 ? trimmedLabel : null;
}

function sanitizeWindowBounds(bounds: DesktopWindowBounds | undefined) {
  if (!bounds) {
    return undefined;
  }

  const width = typeof bounds.width === "number" && bounds.width > 0 ? bounds.width : undefined;
  const height = typeof bounds.height === "number" && bounds.height > 0 ? bounds.height : undefined;
  if (!width || !height) {
    return undefined;
  }

  return {
    width,
    height,
    x: typeof bounds.x === "number" ? bounds.x : undefined,
    y: typeof bounds.y === "number" ? bounds.y : undefined,
  } satisfies DesktopWindowBounds;
}

function sanitizeSessionDescriptor(
  session: Partial<DesktopSessionDescriptor>,
  now: () => string
): DesktopSessionDescriptor | null {
  if (typeof session.id !== "string" || session.id.trim().length === 0) {
    return null;
  }

  const windowLabel = session.windowLabel === "about" ? "about" : "main";
  return {
    id: session.id,
    windowLabel,
    workspacePath: normalizeWorkspacePath(session.workspacePath),
    workspaceLabel: normalizeWorkspaceLabel(session.workspaceLabel),
    preferredBackendId:
      typeof session.preferredBackendId === "string" && session.preferredBackendId.trim().length > 0
        ? session.preferredBackendId.trim()
        : null,
    runtimeMode: session.runtimeMode === "remote" ? "remote" : "local",
    lastActiveAt:
      typeof session.lastActiveAt === "string" && session.lastActiveAt.length > 0
        ? session.lastActiveAt
        : now(),
    windowBounds: sanitizeWindowBounds(session.windowBounds),
  };
}

function restoreRecentSessions(
  sessions: Partial<DesktopSessionDescriptor>[] | undefined,
  now: () => string
) {
  const seenSessionIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const restoredSessions: DesktopSessionDescriptor[] = [];

  for (const entry of sessions ?? []) {
    const session = sanitizeSessionDescriptor(entry, now);
    if (!session || seenSessionIds.has(session.id)) {
      continue;
    }
    const fingerprint = createSessionFingerprint(session);
    if (seenFingerprints.has(fingerprint)) {
      continue;
    }
    seenSessionIds.add(session.id);
    seenFingerprints.add(fingerprint);
    restoredSessions.push(session);
    if (restoredSessions.length >= MAX_RECENT_SESSIONS) {
      break;
    }
  }

  return restoredSessions;
}

export function createDesktopShellState(options: DesktopShellStateOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const recentSessions = restoreRecentSessions(options.persistedState?.sessions, now);
  const activeWindows = new Map<number, ActiveWindowRecord>();
  let trayEnabled = options.persistedState?.trayEnabled === true;
  let sessionCounter = recentSessions.length;

  function nextSessionId() {
    sessionCounter += 1;
    return `desktop-session-${sessionCounter}`;
  }

  function upsertRecentSession(nextSession: DesktopSessionDescriptor) {
    const fingerprint = createSessionFingerprint(nextSession);
    const filteredSessions = recentSessions.filter((session) => {
      if (session.id === nextSession.id) {
        return false;
      }

      return createSessionFingerprint(session) !== fingerprint;
    });
    recentSessions.splice(
      0,
      recentSessions.length,
      {
        ...nextSession,
      },
      ...filteredSessions.slice(0, MAX_RECENT_SESSIONS - 1)
    );
  }

  function getSessionById(sessionId: string) {
    return recentSessions.find((session) => session.id === sessionId) ?? null;
  }

  function getSessionByWindowId(windowId: number) {
    const activeWindow = activeWindows.get(windowId);
    if (!activeWindow) {
      return null;
    }

    return getSessionById(activeWindow.sessionId);
  }

  function listWindows() {
    const windows: DesktopWindowDescriptor[] = [];
    for (const activeWindow of activeWindows.values()) {
      const session = getSessionById(activeWindow.sessionId);
      if (!session) {
        continue;
      }

      windows.push({
        windowId: activeWindow.windowId,
        sessionId: session.id,
        windowLabel: session.windowLabel,
        workspaceLabel: session.workspaceLabel,
        focused: false,
      });
    }
    return windows;
  }

  function attachWindow(session: DesktopSessionDescriptor, windowId: number) {
    upsertRecentSession({
      ...session,
      lastActiveAt: now(),
    });
    activeWindows.set(windowId, {
      windowId,
      sessionId: session.id,
    });
  }

  function detachWindow(windowId: number, windowBounds?: DesktopWindowBounds) {
    const session = getSessionByWindowId(windowId);
    activeWindows.delete(windowId);
    if (!session) {
      return;
    }

    upsertRecentSession({
      ...session,
      lastActiveAt: now(),
      windowBounds: sanitizeWindowBounds(windowBounds) ?? session.windowBounds,
    });
  }

  function setTrayEnabled(nextEnabled: boolean) {
    trayEnabled = nextEnabled;
  }

  function toPersistedState(): DesktopPersistedState {
    return {
      trayEnabled,
      sessions: recentSessions.map((session) => ({ ...session })),
    };
  }

  return {
    attachWindow,
    detachWindow,
    getSessionById,
    getSessionByWindowId,
    listWindows,
    resolveSession(input: OpenDesktopSessionInput) {
      return resolveSessionDescriptor(
        {
          get recentSessions() {
            return recentSessions;
          },
          nextSessionId,
          now,
        },
        input
      );
    },
    setTrayEnabled,
    toPersistedState,
    nextSessionId,
    now,
    get recentSessions() {
      return recentSessions.map((session) => ({ ...session }));
    },
    get trayEnabled() {
      return trayEnabled;
    },
  };
}

type SessionResolutionState = {
  recentSessions: DesktopSessionDescriptor[];
  nextSessionId: () => string;
  now: () => string;
};

export function resolveSessionDescriptor(
  state: SessionResolutionState | ReturnType<typeof createDesktopShellState>,
  input: OpenDesktopSessionInput
) {
  const normalizedInput = {
    windowLabel: input.windowLabel === "about" ? "about" : "main",
    workspacePath: normalizeWorkspacePath(input.workspacePath),
    workspaceLabel: normalizeWorkspaceLabel(input.workspaceLabel),
    preferredBackendId:
      typeof input.preferredBackendId === "string" && input.preferredBackendId.trim().length > 0
        ? input.preferredBackendId.trim()
        : null,
    runtimeMode: input.runtimeMode === "remote" ? "remote" : "local",
    duplicate: input.duplicate === true,
  } satisfies Pick<
    OpenDesktopSessionInput,
    "duplicate" | "preferredBackendId" | "runtimeMode" | "windowLabel"
  > & {
    workspaceLabel: string | null;
    workspacePath: string | null;
  };

  const nextFingerprint = createSessionFingerprint(normalizedInput);
  if (!normalizedInput.duplicate) {
    const existingSession = state.recentSessions.find(
      (session) => createSessionFingerprint(session) === nextFingerprint
    );
    if (existingSession) {
      return {
        ...existingSession,
      };
    }
  }

  return {
    id: state.nextSessionId(),
    windowLabel: normalizedInput.windowLabel,
    workspacePath: normalizedInput.workspacePath,
    workspaceLabel: normalizedInput.workspaceLabel,
    preferredBackendId: normalizedInput.preferredBackendId,
    runtimeMode: normalizedInput.runtimeMode,
    lastActiveAt: state.now(),
  } satisfies DesktopSessionDescriptor;
}

export function resolveCloseBehavior(
  state: Pick<ReturnType<typeof createDesktopShellState>, "trayEnabled" | "listWindows">,
  windowId: number
) {
  const activeWindows = state.listWindows();
  const isLastWindow = activeWindows.length === 1 && activeWindows[0]?.windowId === windowId;

  return state.trayEnabled && isLastWindow ? "hide" : "close";
}
