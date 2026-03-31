import {
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
  type RuntimeCapabilitiesSummary,
} from "./runtimeClient";

export async function getRuntimeCapabilitiesSummary(): Promise<RuntimeCapabilitiesSummary> {
  return readRuntimeCapabilitiesSummary();
}

export async function getRuntimeHealth() {
  return getRuntimeClient().health();
}

export async function getRuntimeRemoteStatus() {
  return getRuntimeClient().remoteStatus();
}

export async function getRuntimeTerminalStatus() {
  return getRuntimeClient().terminalStatus();
}

export async function getRuntimeSettings() {
  return getRuntimeClient().settings();
}

export async function getRuntimeBootstrapSnapshot() {
  return getRuntimeClient().bootstrap();
}
