import { describe, expect, it, vi } from "vitest";
import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
  type RuntimeToolExecutionMetricsSnapshot,
  type RuntimeExtensionRecord,
  type TerminalSessionSummary,
} from "@ku0/code-runtime-host-contract";
import { createExtendedRpcRuntimeClient } from "./runtimeClientRpcExtensionsFactory";
import { RUNTIME_EXTENSION_RPC_METHODS } from "./runtimeClientRpcMethods";
import type { RuntimeRpcInvoker } from "./runtimeClientRpcHelpers";

describe("runtimeClientRpcExtensionsFactory", () => {
  it("builds extension catalog payloads with canonical nullable fields", async () => {
    const invokeRpc = vi.fn(
      async () => [] as RuntimeExtensionRecord[]
    ) as unknown as RuntimeRpcInvoker;
    const client = createExtendedRpcRuntimeClient(invokeRpc);

    await client.extensionCatalogListV2();

    expect(invokeRpc).toHaveBeenCalledWith(
      RUNTIME_EXTENSION_RPC_METHODS.EXTENSION_CATALOG_LIST_V2,
      {
        workspaceId: null,
        includeDisabled: null,
        kinds: null,
      }
    );
  });

  it("normalizes terminal session summaries returned by core rpc methods", async () => {
    const invokeRpc = vi.fn(
      async () =>
        ({
          id: "terminal-1",
          workspaceId: "workspace-1",
          state: "created",
          createdAt: 1,
          updatedAt: 2,
          lines: ["hello"],
        }) satisfies TerminalSessionSummary
    ) as unknown as RuntimeRpcInvoker;
    const client = createExtendedRpcRuntimeClient(invokeRpc);

    await expect(client.terminalOpen("workspace-1")).resolves.toEqual({
      id: "terminal-1",
      workspaceId: "workspace-1",
      state: "created",
      createdAt: 1,
      updatedAt: 2,
      lines: ["hello"],
    });
    expect(invokeRpc).toHaveBeenCalledWith(CODE_RUNTIME_RPC_METHODS.TERMINAL_OPEN, {
      workspaceId: "workspace-1",
    });
  });

  it("uses the empty params sentinel when reading runtime tool metrics without a query", async () => {
    const invokeRpc = vi.fn(
      async () => ({}) as RuntimeToolExecutionMetricsSnapshot
    ) as unknown as RuntimeRpcInvoker;
    const client = createExtendedRpcRuntimeClient(invokeRpc);

    await client.runtimeToolMetricsRead();

    expect(invokeRpc).toHaveBeenCalledWith(
      CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_READ,
      CODE_RUNTIME_RPC_EMPTY_PARAMS
    );
  });
});
