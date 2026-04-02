import type { RuntimeExtensionActivationSnapshot } from "@ku0/code-runtime-host-contract";
import type {
  RuntimeInvocationCatalogSnapshot,
  RuntimeInvocationDescriptor,
} from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";
import {
  listRuntimeInvocationDescriptors,
  normalizeRuntimeInvocationCatalogSnapshot,
  resolveRuntimeInvocationDescriptor,
} from "./runtimeInvocationCatalog";

export type RuntimeInvocationCatalogFacade = {
  readSnapshot: (input?: {
    sessionId?: string | null;
  }) => Promise<RuntimeInvocationCatalogSnapshot>;
  listInvocations: (input?: {
    sessionId?: string | null;
    activeOnly?: boolean | null;
    kind?: RuntimeInvocationDescriptor["kind"] | null;
  }) => Promise<RuntimeInvocationDescriptor[]>;
  resolveInvocation: (input: {
    invocationId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeInvocationDescriptor | null>;
};

export function createRuntimeInvocationCatalogFacade(input: {
  activation: {
    readSnapshot: (input?: {
      sessionId?: string | null;
    }) => Promise<RuntimeExtensionActivationSnapshot>;
  };
}): RuntimeInvocationCatalogFacade {
  async function readSnapshot(inputOptions?: {
    sessionId?: string | null;
  }): Promise<RuntimeInvocationCatalogSnapshot> {
    return normalizeRuntimeInvocationCatalogSnapshot(
      await input.activation.readSnapshot(inputOptions)
    );
  }

  return {
    readSnapshot,
    listInvocations: async (inputOptions) => {
      const snapshot = await readSnapshot({
        sessionId: inputOptions?.sessionId ?? null,
      });
      return listRuntimeInvocationDescriptors(snapshot, {
        activeOnly: inputOptions?.activeOnly ?? null,
        kind: inputOptions?.kind ?? null,
      });
    },
    resolveInvocation: async (inputOptions) => {
      const snapshot = await readSnapshot({
        sessionId: inputOptions.sessionId ?? null,
      });
      return resolveRuntimeInvocationDescriptor(snapshot, {
        invocationId: inputOptions.invocationId,
      });
    },
  };
}
