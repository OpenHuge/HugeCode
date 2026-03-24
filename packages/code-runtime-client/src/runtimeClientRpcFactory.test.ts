import { describe, expect, it, vi } from "vitest";
import {
  CODE_RUNTIME_RPC_METHODS,
  type LiveSkillExecutionResult,
  type WorkspaceSummary,
} from "@ku0/code-runtime-host-contract";
import { createBaseRpcRuntimeClient } from "./runtimeClientRpcFactory";
import type { RuntimeRpcInvoker } from "./runtimeClientRpcHelpers";

describe("runtimeClientRpcFactory", () => {
  it("builds workspace rpc payloads with canonical fields", async () => {
    const invokeRpc = vi.fn(
      async () =>
        ({
          id: "workspace-1",
          path: "/repo",
          displayName: "Runtime Shell",
          connected: true,
          defaultModelId: null,
        }) satisfies WorkspaceSummary
    ) as unknown as RuntimeRpcInvoker;
    const client = createBaseRpcRuntimeClient(invokeRpc);

    await client.workspaceCreate("/repo", "Runtime Shell");

    expect(invokeRpc).toHaveBeenCalledWith(CODE_RUNTIME_RPC_METHODS.WORKSPACE_CREATE, {
      path: "/repo",
      displayName: "Runtime Shell",
    });
  });

  it("normalizes live-skill execution before calling the runtime", async () => {
    const invokeRpc = vi.fn(
      async () =>
        ({
          runId: "run-1",
          skillId: "core-bash",
          status: "completed",
          message: "completed",
          output: "echo hello",
          network: null,
          artifacts: [],
          metadata: {},
        }) satisfies LiveSkillExecutionResult
    ) as unknown as RuntimeRpcInvoker;
    const client = createBaseRpcRuntimeClient(invokeRpc);

    await client.runLiveSkill({
      skillId: "bash",
      input: "echo hello",
      options: {
        workspaceId: "workspace-1",
      },
    });

    expect(invokeRpc).toHaveBeenCalledWith(CODE_RUNTIME_RPC_METHODS.LIVE_SKILL_EXECUTE, {
      skillId: "core-bash",
      input: "echo hello",
      options: {
        workspaceId: "workspace-1",
      },
    });
  });
});
