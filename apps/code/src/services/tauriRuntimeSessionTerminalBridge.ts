import { getRuntimeClient } from "./runtimeClient";

export async function openRuntimeTerminalSession(workspaceId: string) {
  return getRuntimeClient().terminalOpen(workspaceId);
}

export async function readRuntimeTerminalSession(sessionId: string) {
  return getRuntimeClient().terminalRead(sessionId);
}

export async function writeRuntimeTerminalSession(input: { sessionId: string; input: string }) {
  return getRuntimeClient().terminalWrite(input.sessionId, input.input);
}

export async function interruptRuntimeTerminalSession(sessionId: string): Promise<boolean> {
  return getRuntimeClient().terminalInterrupt(sessionId);
}

export async function resizeRuntimeTerminalSession(input: {
  sessionId: string;
  rows: number;
  cols: number;
}): Promise<boolean> {
  return getRuntimeClient().terminalResize(input.sessionId, input.rows, input.cols);
}

export async function closeRuntimeTerminalSession(sessionId: string): Promise<boolean> {
  return getRuntimeClient().terminalClose(sessionId);
}
