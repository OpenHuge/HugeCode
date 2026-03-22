import { CODE_RUNTIME_RPC_METHODS } from "@ku0/code-runtime-host-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeRpcInvocationError } from "./runtimeClientErrorUtils";
import {
  computeWebRuntimeRetryDelayMs,
  parseWebRuntimeRetryAfterMs,
  shouldRetryWebRuntimeInvocation,
  WEB_RUNTIME_MAX_RETRY_ATTEMPTS,
} from "./runtimeClientWebRetryUtils";

describe("runtimeClientWebRetryUtils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries retryable methods for structured transport codes", () => {
    const cause = new RuntimeRpcInvocationError({
      code: "runtime.connection.unavailable",
      message: "",
      details: {
        status: null,
      },
    });

    expect(
      shouldRetryWebRuntimeInvocation({
        method: CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
        attempt: 0,
        cause,
      })
    ).toBe(true);
  });

  it("retries retryable methods for abort-like errors", () => {
    const cause = Object.assign(new Error(""), {
      name: "AbortError",
    });

    expect(
      shouldRetryWebRuntimeInvocation({
        method: CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
        attempt: 0,
        cause,
      })
    ).toBe(true);
  });

  it("does not retry non-retryable methods even when transport fails", () => {
    const cause = {
      code: "runtime.connection.unavailable",
      message: "",
    };

    expect(
      shouldRetryWebRuntimeInvocation({
        method: CODE_RUNTIME_RPC_METHODS.TURN_SEND,
        attempt: 0,
        cause,
      })
    ).toBe(false);
  });

  it("does not retry once attempts are exhausted", () => {
    const cause = {
      code: "NETWORK_ERROR",
      message: "",
    };

    expect(
      shouldRetryWebRuntimeInvocation({
        method: CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
        attempt: WEB_RUNTIME_MAX_RETRY_ATTEMPTS,
        cause,
      })
    ).toBe(false);
  });

  it("honors bounded retry-after hints for retryable status codes", () => {
    const cause = new RuntimeRpcInvocationError({
      code: "runtime.rate_limited",
      message: "",
      details: {
        status: 429,
        retryAfterMs: 800,
      },
    });

    expect(
      shouldRetryWebRuntimeInvocation({
        method: CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
        attempt: 0,
        cause,
      })
    ).toBe(true);
    expect(computeWebRuntimeRetryDelayMs(1, cause)).toBe(800);
  });

  it("uses full-jitter exponential backoff when retry-after is absent", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(computeWebRuntimeRetryDelayMs(1)).toBe(62);
    expect(computeWebRuntimeRetryDelayMs(2)).toBe(125);
  });

  it("parses Retry-After http-date values against a fixed clock", () => {
    const nowMs = Date.parse("Sun, 06 Nov 1994 08:49:30 GMT");

    expect(parseWebRuntimeRetryAfterMs("Sun, 06 Nov 1994 08:49:37 GMT", nowMs)).toBe(7_000);
  });

  it("does not schedule a retry when the remaining budget is below Retry-After", () => {
    const cause = new RuntimeRpcInvocationError({
      code: "runtime.rate_limited",
      message: "",
      details: {
        status: 429,
        retryAfterMs: 800,
      },
    });

    expect(
      shouldRetryWebRuntimeInvocation({
        method: CODE_RUNTIME_RPC_METHODS.WORKSPACES_LIST,
        attempt: 0,
        cause,
      })
    ).toBe(true);
    expect(computeWebRuntimeRetryDelayMs(1, cause, 500)).toBe(0);
  });
});
