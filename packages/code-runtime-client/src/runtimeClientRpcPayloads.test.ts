import { describe, expect, it } from "vitest";
import { adaptRuntimeRpcPayload, withCanonicalFields } from "./runtimeClientRpcPayloads";

describe("@ku0/code-runtime-client runtimeClientRpcPayloads", () => {
  it("keeps simple canonical fields unchanged", () => {
    expect(withCanonicalFields({ workspaceId: "ws-1", displayName: "Demo" })).toEqual({
      workspaceId: "ws-1",
      displayName: "Demo",
    });
  });

  it("preserves canonical runtime run payloads without compat aliases", () => {
    expect(
      adaptRuntimeRpcPayload("runtimeRunPrepareV2", {
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        accessMode: "on-request",
        executionMode: "single",
        steps: [{ kind: "read", input: "Inspect runtime." }],
      })
    ).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        steps: [expect.objectContaining({ kind: "read", input: "Inspect runtime." })],
      })
    );
  });
});
