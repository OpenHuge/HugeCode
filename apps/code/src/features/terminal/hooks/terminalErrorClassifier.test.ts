import { describe, expect, it } from "vitest";
import {
  shouldIgnoreTerminalCloseError,
  shouldIgnoreTerminalTransportError,
} from "./terminalErrorClassifier";

describe("terminalErrorClassifier", () => {
  it("ignores close errors when structured not-found code is present", () => {
    expect(
      shouldIgnoreTerminalCloseError({
        details: {
          error: {
            code: "runtime.validation.resource.not_found",
            message: "permission denied",
          },
        },
      })
    ).toBe(true);
  });

  it("ignores close errors when legacy terminal-not-found message is present", () => {
    expect(
      shouldIgnoreTerminalCloseError(new Error("Runtime terminal session not found for ws-1:t-1"))
    ).toBe(true);
  });

  it("does not ignore close errors for unrelated failures", () => {
    expect(shouldIgnoreTerminalCloseError(new Error("permission denied"))).toBe(false);
  });

  it("ignores transport errors when io disconnect message is present", () => {
    expect(shouldIgnoreTerminalTransportError(new Error("broken pipe"))).toBe(true);
  });

  it("ignores transport errors when structured not-found code is present", () => {
    expect(
      shouldIgnoreTerminalTransportError({
        code: "runtime.validation.resource.not_found",
        message: "runtime channel unavailable",
      })
    ).toBe(true);
  });

  it("does not ignore transport errors for unrelated failures", () => {
    expect(shouldIgnoreTerminalTransportError(new Error("permission denied"))).toBe(false);
  });
});
