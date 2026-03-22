import { describe, expect, it } from "vitest";
import {
  isMissingTauriCommandError,
  isRuntimeMethodUnsupportedError,
  isTimeoutLikeError,
  isWebRuntimeConnectionError,
  readRuntimeErrorCode,
  readRuntimeErrorMessage,
} from "./runtimeErrorClassifier";

describe("runtimeErrorClassifier", () => {
  it("detects missing tauri command via structured method-not-found code", () => {
    const error = {
      code: "METHOD_NOT_FOUND",
      method: "file_read",
      message: "ignored",
    };
    expect(isMissingTauriCommandError(error, "file_read")).toBe(true);
    expect(isMissingTauriCommandError(error, "file_write")).toBe(false);
  });

  it("detects runtime method unsupported from structured code and method", () => {
    const error = {
      code: "METHOD_UNAVAILABLE",
      method: "runtime/backends/list",
      message: "ignored",
    };
    expect(isRuntimeMethodUnsupportedError(error, "runtime/backends/list")).toBe(true);
    expect(isRuntimeMethodUnsupportedError(error, "runtime/backends/remove")).toBe(false);
  });

  it("detects runtime method unsupported from dot-case code and method", () => {
    const error = {
      code: "runtime.validation.method.unavailable",
      method: "runtime/backends/list",
      message: "ignored",
    };
    expect(isRuntimeMethodUnsupportedError(error, "runtime/backends/list")).toBe(true);
    expect(isRuntimeMethodUnsupportedError(error, "runtime/backends/remove")).toBe(false);
  });

  it("detects runtime method unsupported from nested error code chain", () => {
    const error = {
      details: {
        error: {
          code: "runtime.validation.method.unavailable",
          method: "runtime/backends/list",
          message: "ignored",
        },
      },
    };
    expect(isRuntimeMethodUnsupportedError(error, "runtime/backends/list")).toBe(true);
  });

  it("detects connection errors from structured code without relying on message", () => {
    const error = {
      code: "NETWORK_ERROR",
      message: "",
    };
    expect(isWebRuntimeConnectionError(error)).toBe(true);
  });

  it("detects timeout-like errors from structured code and abort-style names", () => {
    expect(isTimeoutLikeError({ code: "REQUEST_TIMEOUT" })).toBe(true);
    expect(isTimeoutLikeError({ name: "AbortError", message: "" })).toBe(true);
  });

  it("reads nested error code and message fields from chained payloads", () => {
    const error = {
      details: {
        error: {
          code: "runtime.transport.fetch_failed",
          message: "Fetch failed at runtime gateway.",
        },
      },
    };

    expect(readRuntimeErrorCode(error)).toBe("runtime.transport.fetch_failed");
    expect(readRuntimeErrorMessage(error)).toBe("Fetch failed at runtime gateway.");
  });
});
