import {
  CODE_RUNTIME_RPC_EMPTY_PARAMS,
  CODE_RUNTIME_RPC_METHODS,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import { createExtendedRpcRuntimeClient } from "./runtimeClientRpcExtensionsFactory";
import type { RuntimeClient } from "./runtimeClientTypes";

describe("@ku0/code-runtime-client runtimeClientRpcExtensionsFactory app methods", () => {
  it("includes app-owned oauth, settings, and text-file RPC helpers in the shared client", async () => {
    const invokeRpc = vi.fn(async (_method: string, params: Record<string, unknown>) => params);
    const client = createExtendedRpcRuntimeClient<Record<string, unknown>>(
      invokeRpc
    ) as RuntimeClient<Record<string, unknown>>;

    await client.oauthAccounts("openai");
    await client.appSettingsGet();
    await client.textFileReadV1({
      scope: "workspace",
      kind: "mission-control",
      workspaceId: "ws-1",
    } as never);

    expect(invokeRpc).toHaveBeenNthCalledWith(1, CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST, {
      provider: "openai",
    });
    expect(invokeRpc).toHaveBeenNthCalledWith(
      2,
      CODE_RUNTIME_RPC_METHODS.APP_SETTINGS_GET,
      CODE_RUNTIME_RPC_EMPTY_PARAMS
    );
    expect(invokeRpc).toHaveBeenNthCalledWith(3, CODE_RUNTIME_RPC_METHODS.TEXT_FILE_READ_V1, {
      scope: "workspace",
      kind: "mission-control",
      workspaceId: "ws-1",
    });
  });
});
