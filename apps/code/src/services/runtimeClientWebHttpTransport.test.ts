import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeWebRuntimeRawAttempt } from "./runtimeClientWebHttpTransport";

describe("runtimeClientWebHttpTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("captures retry-after headers on retryable HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 429,
          headers: {
            "Retry-After": "1",
          },
        })
      )
    );

    await expect(
      invokeWebRuntimeRawAttempt("http://127.0.0.1:8788/rpc", "code_workspaces_list", {})
    ).rejects.toMatchObject({
      details: {
        status: 429,
        retryAfterMs: 1_000,
      },
    });
  });
});
