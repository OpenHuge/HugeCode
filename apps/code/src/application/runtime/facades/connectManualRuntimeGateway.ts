import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
} from "@ku0/code-runtime-host-contract";
import { invokeRuntimeGatewayDiscoveryProbe } from "../ports/runtimeGatewayDiscovery";
import {
  clearManualWebRuntimeGatewayTarget,
  configureManualWebRuntimeGatewayTarget,
  readManualWebRuntimeGatewayTarget,
} from "../ports/runtimeWebGatewayConfig";

type ConnectManualRuntimeGatewayParams = {
  host: string | null;
  port: number;
  refreshWorkspaces: () => Promise<unknown>;
};

const MANUAL_RUNTIME_GATEWAY_PROBE_TIMEOUT_MS = 2_000;

export async function connectManualRuntimeGateway({
  host,
  port,
  refreshWorkspaces,
}: ConnectManualRuntimeGatewayParams): Promise<void> {
  const previousTarget = readManualWebRuntimeGatewayTarget();
  const attemptedHosts =
    host && host.trim().length > 0 ? [host.trim()] : ["localhost", "127.0.0.1"];
  let lastErrorMessage = `Unable to reach a runtime on port ${port}.`;

  for (const attemptedHost of attemptedHosts) {
    try {
      await invokeRuntimeGatewayDiscoveryProbe(
        `http://${attemptedHost}:${port}/rpc`,
        CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
        CODE_RUNTIME_RPC_EMPTY_PARAMS,
        MANUAL_RUNTIME_GATEWAY_PROBE_TIMEOUT_MS
      );
      configureManualWebRuntimeGatewayTarget({ host: attemptedHost, port });
      void Promise.resolve(refreshWorkspaces()).catch(() => undefined);
      return;
    } catch {
      lastErrorMessage = host
        ? `Unable to reach the runtime at ${attemptedHost}:${port}. Verify the host, port, and /rpc endpoint.`
        : `Unable to reach a local runtime on port ${port}. Tried localhost and 127.0.0.1. Verify the runtime is running and exposes /rpc.`;
    }
  }

  if (previousTarget) {
    configureManualWebRuntimeGatewayTarget(previousTarget);
  } else {
    clearManualWebRuntimeGatewayTarget();
  }
  throw new Error(lastErrorMessage);
}
