import { describe, expect, it } from "vitest";
import {
  isGitRuntimeUnavailableError,
  isMissingGitRepositoryError,
  shouldSuppressGitConsoleError,
} from "./repositoryErrors";

describe("repositoryErrors", () => {
  it("detects missing repository messages", () => {
    expect(isMissingGitRepositoryError("fatal: not a git repository")).toBe(true);
    expect(isMissingGitRepositoryError("Could not find repository for workspace")).toBe(true);
    expect(isMissingGitRepositoryError("transport offline")).toBe(false);
  });

  it("detects runtime compatibility failures as suppressed git noise", () => {
    const runtimeError = new Error("Runtime RPC compatFieldAliases mismatch from frozen contract.");
    runtimeError.name = "RuntimeRpcContractCompatFieldAliasesMismatchError";

    expect(isGitRuntimeUnavailableError(runtimeError)).toBe(true);
    expect(shouldSuppressGitConsoleError(runtimeError)).toBe(true);
  });

  it("detects transient runtime connection failures as suppressed git noise", () => {
    expect(isGitRuntimeUnavailableError(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldSuppressGitConsoleError(new Error("fatal: not a git repository"))).toBe(true);
    expect(shouldSuppressGitConsoleError(new Error("transport offline"))).toBe(false);
  });
});
