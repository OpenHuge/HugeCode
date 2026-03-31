import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as runtimeEvents from "../../../application/runtime/ports/events";
import type { TerminalExitEvent } from "../../../application/runtime/ports/events";
import {
  openTerminalSession,
  readTerminalSession,
  resizeTerminalSession,
  writeTerminalSessionRaw,
} from "../../../application/runtime/ports/terminal";
import { getRuntimeTerminalStatus } from "../../../application/runtime/ports/runtime";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import type { DebugEntry, TerminalStatus, WorkspaceInfo } from "../../../types";
import { buildErrorDebugEntry } from "../../../utils/debugEntries";
import {
  getAppServerParams,
  isNativeStateFabricUpdatedEvent,
} from "../../../utils/appServerEvents";
import { shouldIgnoreTerminalTransportError } from "./terminalErrorClassifier";

const MAX_BUFFER_CHARS = 200_000;
const WEB_RUNTIME_TERMINAL_POLL_MS = 250;
const TERMINAL_SESSION_STATE_VALUES = new Set(["created", "exited", "ioFailed", "unsupported"]);
const TERMINAL_RUNTIME_STATE_VALUES = new Set(["ready", "uninitialized", "unsupported"]);

type CanonicalTerminalSessionState = "created" | "exited" | "ioFailed" | "unsupported";
type CanonicalTerminalRuntimeState = "ready" | "uninitialized" | "unsupported";
type CompatibleTerminalSessionSummary = {
  workspaceId: string;
  state?: string | null;
  lines?: string[] | null;
};
type CompatibleTerminalStatusPayload = {
  state?: string | null;
  message?: string | null;
};

type UseTerminalSessionOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeTerminalId: string | null;
  isVisible: boolean;
  onDebug?: (entry: DebugEntry) => void;
  onSessionExit?: (workspaceId: string, terminalId: string) => void;
};

type TerminalOpenResolution = {
  state: CanonicalTerminalSessionState | "unknown";
  workspaceId: string;
};

type TerminalAppearance = {
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selection?: string;
  };
  fontFamily: string;
};

type TerminalLike = {
  cols: number;
  rows: number;
  onData: (handler: (data: string) => void) => { dispose: () => void };
  loadAddon: (addon: unknown) => void;
  open: (element: HTMLElement) => void;
  write: (data: string) => void;
  reset: () => void;
  refresh: (start: number, end: number) => void;
  focus: () => void;
  dispose: () => void;
};

type FitAddonLike = {
  fit: () => void;
  activate?: (terminal?: unknown) => void;
  dispose?: () => void;
};

type XtermModuleConstructors = {
  TerminalCtor: new (options?: Record<string, unknown>) => TerminalLike;
  FitAddonCtor: new () => FitAddonLike;
};

export type TerminalSessionState = {
  status: TerminalStatus;
  message: string;
  containerRef: RefObject<HTMLDivElement | null>;
  hasSession: boolean;
  readyKey: string | null;
  cleanupTerminalSession: (workspaceId: string, terminalId: string) => void;
};

function appendBuffer(existing: string | undefined, data: string): string {
  const next = (existing ?? "") + data;
  if (next.length <= MAX_BUFFER_CHARS) {
    return next;
  }
  return next.slice(next.length - MAX_BUFFER_CHARS);
}

function resolveTerminalSessionState(
  summary: CompatibleTerminalSessionSummary | null | undefined
): CanonicalTerminalSessionState | "unknown" {
  if (!summary) {
    return "unknown";
  }
  const state = summary.state;
  if (typeof state === "string") {
    if (TERMINAL_SESSION_STATE_VALUES.has(state)) {
      return state as CanonicalTerminalSessionState;
    }
    return "unknown";
  }
  return "unknown";
}

function resolveTerminalRuntimeState(
  status: CompatibleTerminalStatusPayload | null | undefined
): CanonicalTerminalRuntimeState | "unknown" {
  if (!status) {
    return "unknown";
  }
  const state = status.state;
  if (typeof state === "string") {
    if (TERMINAL_RUNTIME_STATE_VALUES.has(state)) {
      return state as CanonicalTerminalRuntimeState;
    }
    return "unknown";
  }
  return "unknown";
}

function terminalSessionMessageForState(
  state: CanonicalTerminalSessionState | "unknown",
  summary: CompatibleTerminalSessionSummary | null | undefined
): string {
  switch (state) {
    case "created":
      return "Terminal ready.";
    case "exited":
      return "Terminal session exited.";
    case "ioFailed":
      return "Terminal session encountered an I/O failure.";
    case "unsupported":
      return "Terminal is not supported by this runtime.";
    default:
      return `Terminal session returned an unknown state${
        typeof summary?.state === "string" ? `: ${summary.state}` : ""
      }.`;
  }
}

function terminalProtocolErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const message = error.message.trim();
  if (!message) {
    return null;
  }
  if (/returned invalid terminal state/i.test(message)) {
    return message;
  }
  return null;
}

function getTerminalAppearance(container: HTMLElement | null): TerminalAppearance {
  if (typeof window === "undefined") {
    return {
      theme: {
        background: "transparent",
        foreground: "#d9dee7",
        cursor: "#d9dee7",
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    };
  }

  const target = container ?? document.documentElement;
  const styles = getComputedStyle(target);
  const background =
    styles.getPropertyValue("--terminal-background").trim() ||
    styles.getPropertyValue("--surface-debug").trim() ||
    styles.getPropertyValue("--surface-panel").trim() ||
    "#11151b";
  const foreground =
    styles.getPropertyValue("--terminal-foreground").trim() ||
    styles.getPropertyValue("--text-stronger").trim() ||
    "#d9dee7";
  const cursor = styles.getPropertyValue("--terminal-cursor").trim() || foreground;
  const selection = styles.getPropertyValue("--terminal-selection").trim();
  const fontFamily =
    styles.getPropertyValue("--terminal-font-family").trim() ||
    styles.getPropertyValue("--code-font-family").trim() ||
    'Menlo, Monaco, "Courier New", monospace';

  return {
    theme: {
      background,
      foreground,
      cursor,
      selection: selection || undefined,
    },
    fontFamily,
  };
}

export function useTerminalSession({
  activeWorkspace,
  activeTerminalId,
  isVisible,
  onDebug,
  onSessionExit,
}: UseTerminalSessionOptions): TerminalSessionState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<TerminalLike | null>(null);
  const fitAddonRef = useRef<FitAddonLike | null>(null);
  const inputDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const xtermModulePromiseRef = useRef<Promise<XtermModuleConstructors> | null>(null);
  const openedSessionsRef = useRef<Set<string>>(new Set());
  const openingSessionsRef = useRef<Map<string, Promise<void>>>(new Map());
  const terminalOpenResolutionRef = useRef<Map<string, TerminalOpenResolution>>(new Map());
  const outputBuffersRef = useRef<Map<string, string>>(new Map());
  const activeKeyRef = useRef<string | null>(null);
  const renderedKeyRef = useRef<string | null>(null);
  const activeWorkspaceRef = useRef<WorkspaceInfo | null>(null);
  const activeTerminalIdRef = useRef<string | null>(null);
  const onSessionExitRef = useRef(onSessionExit);
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [message, setMessage] = useState("Open a terminal to start a session.");
  const [hasSession, setHasSession] = useState(false);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [_sessionResetCounter, setSessionResetCounter] = useState(0);
  const [terminalMountVersion, setTerminalMountVersion] = useState(0);
  const loadXtermModules = useCallback(async (): Promise<XtermModuleConstructors> => {
    if (!xtermModulePromiseRef.current) {
      xtermModulePromiseRef.current = Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/xterm/css/xterm.css"),
      ]).then(([xterm, fitAddon]) => ({
        TerminalCtor: xterm.Terminal as unknown as XtermModuleConstructors["TerminalCtor"],
        FitAddonCtor: fitAddon.FitAddon as unknown as XtermModuleConstructors["FitAddonCtor"],
      }));
    }
    return xtermModulePromiseRef.current;
  }, []);
  const cleanupTerminalSession = useCallback((workspaceId: string, terminalId: string) => {
    const key = `${workspaceId}:${terminalId}`;
    outputBuffersRef.current.delete(key);
    openedSessionsRef.current.delete(key);
    openingSessionsRef.current.delete(key);
    terminalOpenResolutionRef.current.delete(key);
    setReadyKey((prev) => (prev === key ? null : prev));
    setSessionResetCounter((prev) => prev + 1);
    if (activeKeyRef.current === key) {
      terminalRef.current?.reset();
      setHasSession(false);
      setStatus("idle");
      setMessage("Open a terminal to start a session.");
    }
  }, []);

  const activeKey = useMemo(() => {
    if (!activeWorkspace || !activeTerminalId) {
      return null;
    }
    return `${activeWorkspace.id}:${activeTerminalId}`;
  }, [activeTerminalId, activeWorkspace]);

  useEffect(() => {
    activeKeyRef.current = activeKey;
    activeWorkspaceRef.current = activeWorkspace;
    activeTerminalIdRef.current = activeTerminalId;
  }, [activeKey, activeTerminalId, activeWorkspace]);

  useEffect(() => {
    onSessionExitRef.current = onSessionExit;
  }, [onSessionExit]);

  const writeToTerminal = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  const refreshTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    const lastRow = Math.max(0, terminal.rows - 1);
    terminal.refresh(0, lastRow);
    terminal.focus();
  }, []);

  const syncActiveBuffer = useCallback(
    (key: string) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }
      term.reset();
      const buffered = outputBuffersRef.current.get(key);
      if (buffered) {
        term.write(buffered);
      }
      refreshTerminal();
    },
    [refreshTerminal]
  );

  useEffect(() => {
    const unlistenAppServerEvents =
      typeof runtimeEvents.subscribeAppServerEvents === "function"
        ? runtimeEvents.subscribeAppServerEvents(
            (event) => {
              if (!isNativeStateFabricUpdatedEvent(event)) {
                return;
              }
              const params = getAppServerParams(event);
              const scopeKind = String(params.scopeKind ?? params.scope_kind ?? "").trim();
              if (scopeKind !== "terminal") {
                return;
              }
              const workspaceId = String(
                params.workspaceId ?? params.workspace_id ?? event.workspace_id ?? ""
              ).trim();
              const terminalId = String(params.sessionId ?? params.session_id ?? "").trim();
              const data = typeof params.chunk === "string" ? params.chunk : "";
              if (!workspaceId || !terminalId || !data) {
                return;
              }
              const key = `${workspaceId}:${terminalId}`;
              const next = appendBuffer(outputBuffersRef.current.get(key), data);
              outputBuffersRef.current.set(key, next);
              if (activeKeyRef.current === key) {
                writeToTerminal(data);
              }
            },
            {
              onError: (error) => {
                onDebug?.(buildErrorDebugEntry("terminal listen error", error));
              },
            }
          )
        : () => undefined;

    return () => {
      unlistenAppServerEvents();
    };
  }, [onDebug, writeToTerminal]);

  useEffect(() => {
    const unlisten = runtimeEvents.subscribeTerminalExit(
      (payload: TerminalExitEvent) => {
        cleanupTerminalSession(payload.workspaceId, payload.terminalId);
        onSessionExitRef.current?.(payload.workspaceId, payload.terminalId);
      },
      {
        onError: (error) => {
          onDebug?.(buildErrorDebugEntry("terminal exit listen error", error));
        },
      }
    );
    return () => {
      unlisten();
    };
  }, [cleanupTerminalSession, onDebug]);

  useEffect(() => {
    if (!isVisible) {
      inputDisposableRef.current?.dispose();
      inputDisposableRef.current = null;
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
        setTerminalMountVersion((previous) => previous + 1);
      }
      fitAddonRef.current = null;
      renderedKeyRef.current = null;
      return;
    }

    let disposed = false;

    const ensureTerminal = async () => {
      if (terminalRef.current || !containerRef.current) {
        return;
      }
      try {
        const { TerminalCtor, FitAddonCtor } = await loadXtermModules();
        if (disposed || terminalRef.current || !containerRef.current || !isVisible) {
          return;
        }
        const appearance = getTerminalAppearance(containerRef.current);
        const terminal = new TerminalCtor({
          cursorBlink: true,
          fontSize: 12,
          fontFamily: appearance.fontFamily,
          allowTransparency: true,
          theme: appearance.theme,
          scrollback: 5000,
        });
        const fitAddon = new FitAddonCtor();
        terminal.loadAddon(fitAddon);
        terminal.open(containerRef.current);
        fitAddon.fit();
        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        setTerminalMountVersion((previous) => previous + 1);

        inputDisposableRef.current = terminal.onData((data: string) => {
          const workspace = activeWorkspaceRef.current;
          const terminalId = activeTerminalIdRef.current;
          if (!workspace || !terminalId) {
            return;
          }
          const key = `${workspace.id}:${terminalId}`;
          if (!openedSessionsRef.current.has(key)) {
            return;
          }
          void writeTerminalSessionRaw(workspace.id, terminalId, data).catch((error) => {
            if (shouldIgnoreTerminalTransportError(error)) {
              openedSessionsRef.current.delete(key);
              return;
            }
            onDebug?.(buildErrorDebugEntry("terminal write error", error));
          });
        });
      } catch (error) {
        if (disposed || !isVisible) {
          return;
        }
        setStatus("error");
        setMessage("Failed to load terminal renderer.");
        onDebug?.(buildErrorDebugEntry("terminal module load error", error));
      }
    };

    void ensureTerminal();

    return () => {
      disposed = true;
    };
  }, [isVisible, loadXtermModules, onDebug]);

  useEffect(() => {
    return () => {
      inputDisposableRef.current?.dispose();
      inputDisposableRef.current = null;
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
        setTerminalMountVersion((previous) => previous + 1);
      }
      fitAddonRef.current = null;
      openingSessionsRef.current.clear();
      terminalOpenResolutionRef.current.clear();
    };
  }, []);

  useEffect(() => {
    void terminalMountVersion;
    if (!isVisible) {
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    if (!activeWorkspace || !activeTerminalId) {
      setStatus("idle");
      setMessage("Open a terminal to start a session.");
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    if (!terminalRef.current || !fitAddonRef.current) {
      setStatus("idle");
      setMessage("Preparing terminal...");
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    const key = `${activeWorkspace.id}:${activeTerminalId}`;
    const fitAddon = fitAddonRef.current;
    fitAddon.fit();

    const cols = terminalRef.current.cols;
    const rows = terminalRef.current.rows;
    let isStale = false;

    const openSession = async () => {
      setStatus("connecting");
      setMessage("Starting terminal session...");

      try {
        const capabilityStatus = await getRuntimeTerminalStatus();
        const capabilityState = resolveTerminalRuntimeState(
          capabilityStatus as CompatibleTerminalStatusPayload
        );
        if (capabilityState === "unsupported") {
          if (isStale || activeKeyRef.current !== key) {
            return;
          }
          setStatus("error");
          setMessage(
            capabilityStatus?.message?.trim() || "Terminal is not supported by this runtime."
          );
          setHasSession(false);
          setReadyKey(null);
          return;
        }
        if (capabilityState === "uninitialized" && !isStale) {
          setStatus("connecting");
          setMessage(
            capabilityStatus?.message?.trim() || "Terminal runtime is still initializing."
          );
        }
      } catch (error) {
        onDebug?.(buildErrorDebugEntry("terminal capability status error", error));
        const protocolErrorMessage = terminalProtocolErrorMessage(error);
        if (protocolErrorMessage && !isStale && activeKeyRef.current === key) {
          setStatus("error");
          setMessage(protocolErrorMessage);
          setHasSession(false);
          setReadyKey(null);
          return;
        }
      }

      if (!openedSessionsRef.current.has(key)) {
        const inFlightOpen = openingSessionsRef.current.get(key);
        if (inFlightOpen) {
          await inFlightOpen;
        } else {
          // Keep open idempotent when effects re-run before the first open resolves.
          const openPromise = (async () => {
            const openResult = await openTerminalSession(
              activeWorkspace.id,
              activeTerminalId,
              cols,
              rows
            );
            openedSessionsRef.current.add(key);
            terminalOpenResolutionRef.current.set(key, {
              state: resolveTerminalSessionState({
                workspaceId: activeWorkspace.id,
                state: openResult.state,
                lines: openResult.initialLines,
              }),
              workspaceId: activeWorkspace.id,
            });
            // Use initial lines from the open response (e.g. "Terminal is not available")
            // before attempting a separate readback, so stub messages surface immediately.
            if (openResult.initialLines.length > 0) {
              outputBuffersRef.current.set(key, `${openResult.initialLines.join("\n")}\n`);
            }
            try {
              const summary = await readTerminalSession(activeWorkspace.id, activeTerminalId);
              if (summary && Array.isArray(summary.lines) && summary.lines.length > 0) {
                outputBuffersRef.current.set(key, `${summary.lines.join("\n")}\n`);
              }
              if (summary) {
                terminalOpenResolutionRef.current.set(key, {
                  state: resolveTerminalSessionState(summary),
                  workspaceId: summary.workspaceId,
                });
              }
            } catch (error) {
              onDebug?.(buildErrorDebugEntry("terminal readback error", error));
            }
          })().finally(() => {
            openingSessionsRef.current.delete(key);
          });
          openingSessionsRef.current.set(key, openPromise);
          await openPromise;
        }
      }

      if (isStale || activeKeyRef.current !== key) {
        return;
      }

      const openResolution = terminalOpenResolutionRef.current.get(key);
      const openState = openResolution?.state ?? "unknown";
      if (openState !== "created") {
        openedSessionsRef.current.delete(key);
        openingSessionsRef.current.delete(key);
        terminalOpenResolutionRef.current.delete(key);
        const statusLevel: TerminalStatus = openState === "exited" ? "idle" : "error";
        setStatus(statusLevel);
        setMessage(
          terminalSessionMessageForState(
            openState,
            openResolution
              ? { workspaceId: openResolution.workspaceId, state: openResolution.state }
              : null
          )
        );
        setHasSession(false);
        setReadyKey(null);
        if (openState === "exited") {
          onSessionExitRef.current?.(
            openResolution?.workspaceId ?? activeWorkspace.id,
            activeTerminalId
          );
        }
        return;
      }

      setStatus("ready");
      setMessage("Terminal ready.");
      setHasSession(true);
      setReadyKey(key);
      if (renderedKeyRef.current !== key) {
        syncActiveBuffer(key);
        renderedKeyRef.current = key;
      } else {
        refreshTerminal();
      }
    };

    openSession().catch((error) => {
      if (isStale || activeKeyRef.current !== key) {
        return;
      }
      setStatus("error");
      setMessage("Failed to start terminal session.");
      onDebug?.(buildErrorDebugEntry("terminal open error", error));
    });

    return () => {
      isStale = true;
    };
  }, [
    activeTerminalId,
    activeWorkspace,
    isVisible,
    onDebug,
    refreshTerminal,
    syncActiveBuffer,
    terminalMountVersion,
  ]);

  useEffect(() => {
    if (!isVisible || !activeKey || !terminalRef.current || !fitAddonRef.current) {
      return;
    }
    fitAddonRef.current.fit();
    refreshTerminal();
  }, [activeKey, isVisible, refreshTerminal]);

  useEffect(() => {
    if (
      !isVisible ||
      !terminalRef.current ||
      !activeWorkspace ||
      !activeTerminalId ||
      !hasSession
    ) {
      return;
    }
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon) {
      return;
    }

    const resize = () => {
      fitAddon.fit();
      const key = `${activeWorkspace.id}:${activeTerminalId}`;
      resizeTerminalSession(
        activeWorkspace.id,
        activeTerminalId,
        terminal.cols,
        terminal.rows
      ).catch((error) => {
        if (shouldIgnoreTerminalTransportError(error)) {
          openedSessionsRef.current.delete(key);
          return;
        }
        onDebug?.(buildErrorDebugEntry("terminal resize error", error));
      });
    };

    const observer = new ResizeObserver(() => {
      resize();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    resize();

    return () => {
      observer.disconnect();
    };
  }, [activeTerminalId, activeWorkspace, hasSession, isVisible, onDebug]);

  useEffect(() => {
    if (!isVisible || !activeWorkspace || !activeTerminalId || !hasSession) {
      return;
    }
    if (detectRuntimeMode() !== "runtime-gateway-web") {
      return;
    }

    const key = `${activeWorkspace.id}:${activeTerminalId}`;
    let cancelled = false;

    const pollSession = async () => {
      try {
        const summary = await readTerminalSession(activeWorkspace.id, activeTerminalId);
        if (cancelled || !summary || activeKeyRef.current !== key) {
          return;
        }
        const sessionState = resolveTerminalSessionState(summary);
        if (sessionState !== "created") {
          openedSessionsRef.current.delete(key);
          openingSessionsRef.current.delete(key);
          terminalOpenResolutionRef.current.delete(key);
          const statusLevel: TerminalStatus = sessionState === "exited" ? "idle" : "error";
          setStatus(statusLevel);
          setMessage(terminalSessionMessageForState(sessionState, summary));
          setHasSession(false);
          setReadyKey(null);
          if (sessionState === "exited") {
            onSessionExitRef.current?.(summary.workspaceId, activeTerminalId);
          }
          return;
        }

        const nextBuffer =
          Array.isArray(summary.lines) && summary.lines.length > 0
            ? `${summary.lines.join("\n")}\n`
            : "";
        const previousBuffer = outputBuffersRef.current.get(key) ?? "";
        if (nextBuffer === previousBuffer) {
          return;
        }

        outputBuffersRef.current.set(key, nextBuffer);
        if (!terminalRef.current) {
          return;
        }
        if (nextBuffer.startsWith(previousBuffer)) {
          const delta = nextBuffer.slice(previousBuffer.length);
          if (delta.length > 0) {
            writeToTerminal(delta);
          }
          refreshTerminal();
          return;
        }

        syncActiveBuffer(key);
      } catch (error) {
        if (!cancelled) {
          onDebug?.(buildErrorDebugEntry("terminal poll error", error));
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void pollSession();
    }, WEB_RUNTIME_TERMINAL_POLL_MS);
    void pollSession();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeTerminalId,
    activeWorkspace,
    hasSession,
    isVisible,
    onDebug,
    refreshTerminal,
    syncActiveBuffer,
    writeToTerminal,
  ]);

  return {
    status,
    message,
    containerRef,
    hasSession,
    readyKey,
    cleanupTerminalSession,
  };
}
