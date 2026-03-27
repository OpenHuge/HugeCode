import type { CodeRuntimeHostEventEnvelope } from "@ku0/code-runtime-host-contract";
import type { TerminalSessionSummary } from "../contracts/runtime";
import { getRuntimeClient } from "./runtimeClient";
import {
  parseRuntimeTurnEventPayload,
  RUNTIME_TURN_EVENT_NAME,
  resolveWebRuntimeTurnTransportHints,
} from "./tauriRuntimeTransport";
import {
  clearRuntimeTerminalSessionId,
  createWebRuntimeTurnEventListener,
  createWebRuntimeTurnWsListener,
  getRuntimeTerminalSessionId,
  logRuntimeWarning,
  requireRuntimeTerminalSessionId,
  setRuntimeTerminalSessionId,
} from "./tauriRuntimeTurnHelpers";
import { registerRuntimeEventTauriSubscription } from "./runtimeEventBridgeTransportShared";

type UnlistenFn = () => void;

export async function openTerminalSession(
  workspaceId: string,
  terminalId: string,
  cols: number,
  rows: number
): Promise<{
  id: string;
  initialLines: string[];
  state: TerminalSessionSummary["state"];
}> {
  const runtimeClient = getRuntimeClient();
  const runtimeSession = await runtimeClient.terminalOpen(workspaceId);
  setRuntimeTerminalSessionId(workspaceId, terminalId, runtimeSession.id);
  try {
    await runtimeClient.terminalResize(runtimeSession.id, rows, cols);
  } catch {
    // Initial runtime resize is best-effort for parity with legacy open params.
  }
  try {
    await runtimeClient.terminalStreamStart?.(runtimeSession.id);
  } catch {
    // Stream start is best-effort because legacy runtimes may not expose it.
  }
  const initialLines = Array.isArray(runtimeSession.lines) ? runtimeSession.lines : [];
  return {
    id: terminalId,
    initialLines,
    state: runtimeSession.state,
  };
}

export async function writeTerminalSession(
  workspaceId: string,
  terminalId: string,
  data: string
): Promise<void> {
  const runtimeSessionId = requireRuntimeTerminalSessionId(workspaceId, terminalId);
  await getRuntimeClient().terminalWrite(runtimeSessionId, data);
}

export async function writeTerminalSessionRaw(
  workspaceId: string,
  terminalId: string,
  data: string
): Promise<boolean> {
  const runtimeSessionId = requireRuntimeTerminalSessionId(workspaceId, terminalId);
  return getRuntimeClient().terminalInputRaw(runtimeSessionId, data);
}

export async function readTerminalSession(
  workspaceId: string,
  terminalId: string
): Promise<TerminalSessionSummary | null> {
  const runtimeSessionId = requireRuntimeTerminalSessionId(workspaceId, terminalId);
  return getRuntimeClient().terminalRead(runtimeSessionId);
}

export async function startTerminalSessionStream(
  workspaceId: string,
  terminalId: string
): Promise<boolean> {
  const runtimeSessionId = requireRuntimeTerminalSessionId(workspaceId, terminalId);
  return getRuntimeClient().terminalStreamStart(runtimeSessionId);
}

export async function stopTerminalSessionStream(
  workspaceId: string,
  terminalId: string
): Promise<boolean> {
  const runtimeSessionId = requireRuntimeTerminalSessionId(workspaceId, terminalId);
  return getRuntimeClient().terminalStreamStop(runtimeSessionId);
}

export async function interruptTerminalSession(
  workspaceId: string,
  terminalId: string
): Promise<boolean> {
  const runtimeSessionId = requireRuntimeTerminalSessionId(workspaceId, terminalId);
  return getRuntimeClient().terminalInterrupt(runtimeSessionId);
}

export async function listenRuntimeTurnEvents(
  callback: (event: CodeRuntimeHostEventEnvelope) => void
): Promise<UnlistenFn> {
  try {
    const subscription = await registerRuntimeEventTauriSubscription(
      RUNTIME_TURN_EVENT_NAME,
      (payload) => {
        const parsed = parseRuntimeTurnEventPayload(payload);
        if (parsed) {
          callback(parsed);
        }
      },
      () => undefined
    );
    if (subscription) {
      return subscription;
    }
  } catch (error) {
    logRuntimeWarning("Runtime turn desktop event subscription unavailable.", { error });
  }

  const hints = await resolveWebRuntimeTurnTransportHints();
  const fallbackToSse = () =>
    hints.eventsEndpoint ? createWebRuntimeTurnEventListener(hints.eventsEndpoint, callback) : null;

  if (hints.wsEndpoint) {
    const wsListener = createWebRuntimeTurnWsListener(hints.wsEndpoint, callback, fallbackToSse);
    if (wsListener) {
      return wsListener;
    }
  }

  return fallbackToSse() ?? (() => undefined);
}

export async function resizeTerminalSession(
  workspaceId: string,
  terminalId: string,
  cols: number,
  rows: number
): Promise<void> {
  const runtimeSessionId = requireRuntimeTerminalSessionId(workspaceId, terminalId);
  await getRuntimeClient().terminalResize(runtimeSessionId, rows, cols);
}

export async function closeTerminalSession(workspaceId: string, terminalId: string): Promise<void> {
  const runtimeSessionId = getRuntimeTerminalSessionId(workspaceId, terminalId);
  if (!runtimeSessionId) {
    return;
  }
  const runtimeClient = getRuntimeClient();
  try {
    await runtimeClient.terminalStreamStop?.(runtimeSessionId);
  } catch {
    // Stream stop is best-effort because runtime may already be shutting down session.
  }
  await runtimeClient.terminalClose(runtimeSessionId);
  clearRuntimeTerminalSessionId(workspaceId, terminalId);
}
