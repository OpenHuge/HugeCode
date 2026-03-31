import {
  getRuntimeClient,
  type SubAgentCloseAck,
  type SubAgentCloseRequest,
  type SubAgentInterruptAck,
  type SubAgentInterruptRequest,
  type SubAgentSendRequest,
  type SubAgentSendResult,
  type SubAgentSessionSummary,
  type SubAgentSpawnRequest,
  type SubAgentStatusRequest,
  type SubAgentWaitRequest,
  type SubAgentWaitResult,
} from "./runtimeClient";

export async function spawnSubAgentSession(
  request: SubAgentSpawnRequest
): Promise<SubAgentSessionSummary> {
  return getRuntimeClient().subAgentSpawn(request);
}

export async function sendSubAgentInstruction(
  request: SubAgentSendRequest
): Promise<SubAgentSendResult> {
  return getRuntimeClient().subAgentSend(request);
}

export async function waitSubAgentSession(
  request: SubAgentWaitRequest
): Promise<SubAgentWaitResult> {
  return getRuntimeClient().subAgentWait(request);
}

export async function getSubAgentSessionStatus(
  request: SubAgentStatusRequest
): Promise<SubAgentSessionSummary | null> {
  return getRuntimeClient().subAgentStatus(request);
}

export async function interruptSubAgentSession(
  request: SubAgentInterruptRequest
): Promise<SubAgentInterruptAck> {
  return getRuntimeClient().subAgentInterrupt(request);
}

export async function closeSubAgentSession(
  request: SubAgentCloseRequest
): Promise<SubAgentCloseAck> {
  return getRuntimeClient().subAgentClose(request);
}
