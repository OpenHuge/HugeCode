import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { RuntimeCapabilitiesSummary, RuntimeClientMode } from "../ports/runtimeClient";

export type RuntimeGateway = {
  detectMode: () => RuntimeClientMode;
  discoverLocalTargets: () => Promise<
    Array<{
      host: string;
      port: number;
      httpBaseUrl: string;
      wsBaseUrl: string;
    }>
  >;
  configureManualWebTarget: (target: { host: string; port: number }) => void;
  readCapabilitiesSummary: () => Promise<RuntimeCapabilitiesSummary>;
  readMissionControlSnapshot: () => Promise<HugeCodeMissionControlSnapshot>;
};

type CreateRuntimeGatewayInput = RuntimeGateway;

export function createRuntimeGateway(input: CreateRuntimeGatewayInput): RuntimeGateway {
  return {
    detectMode: input.detectMode,
    discoverLocalTargets: input.discoverLocalTargets,
    configureManualWebTarget: input.configureManualWebTarget,
    readCapabilitiesSummary: input.readCapabilitiesSummary,
    readMissionControlSnapshot: input.readMissionControlSnapshot,
  };
}
