import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import {
  DEFAULT_LOCAL_RUNTIME_GATEWAY_PORTS,
  discoverLocalRuntimeGatewayTargets as discoverLocalRuntimeGatewayTargetsShared,
  type LocalRuntimeGatewayTarget,
} from "@ku0/shared/runtimeGatewayBrowser";
import {
  assertRuntimeRpcCanonicalMethodsSupported,
  assertRuntimeRpcContractFeaturesSupported,
  assertRuntimeRpcContractMetadataSupported,
  assertRuntimeRpcContractVersionSupported,
  assertRuntimeRpcFreezeEffectiveAtSupported,
  assertRuntimeRpcMethodSetHashSupported,
  assertRuntimeRpcProfileSupported,
  normalizeRpcCapabilitiesPayload,
} from "../ports/runtimeClientCapabilitiesContract";
import { invokeRuntimeGatewayDiscoveryProbe } from "../ports/runtimeGatewayDiscovery";

export type DiscoveredLocalRuntimeGatewayTarget = LocalRuntimeGatewayTarget;

type DiscoverLocalRuntimeGatewayTargetsParams = {
  ports?: readonly number[];
};

async function probeRuntimeTarget(target: LocalRuntimeGatewayTarget, probeTimeoutMs: number) {
  try {
    const payload = await invokeRuntimeGatewayDiscoveryProbe(
      target.httpBaseUrl,
      CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES,
      {},
      probeTimeoutMs
    );
    const snapshot = normalizeRpcCapabilitiesPayload(payload);
    if (!snapshot) {
      return false;
    }
    if (snapshot.contractVersion) {
      assertRuntimeRpcContractVersionSupported(snapshot.contractVersion);
    }
    assertRuntimeRpcMethodSetHashSupported(snapshot);
    assertRuntimeRpcProfileSupported(snapshot);
    assertRuntimeRpcCanonicalMethodsSupported(snapshot);
    assertRuntimeRpcContractFeaturesSupported(snapshot);
    assertRuntimeRpcFreezeEffectiveAtSupported(snapshot);
    assertRuntimeRpcContractMetadataSupported(snapshot);
    return snapshot.methods.has(CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST);
  } catch {
    return false;
  }
}

export async function discoverLocalRuntimeGatewayTargets({
  ports = DEFAULT_LOCAL_RUNTIME_GATEWAY_PORTS,
}: DiscoverLocalRuntimeGatewayTargetsParams = {}): Promise<DiscoveredLocalRuntimeGatewayTarget[]> {
  return discoverLocalRuntimeGatewayTargetsShared({
    ports,
    probeTarget: probeRuntimeTarget,
  });
}
