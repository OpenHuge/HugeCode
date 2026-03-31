import { describe, expect, it } from "vitest";
import { isWorkspacePathValidationUnavailableError } from "./useWorkspaces.helpers";

describe("isWorkspacePathValidationUnavailableError", () => {
  it("returns true for explicit unavailability code", () => {
    expect(
      isWorkspacePathValidationUnavailableError({
        code: "WORKSPACE_PATH_VALIDATION_UNAVAILABLE",
      })
    ).toBe(true);
  });

  it("returns true for method-not-found code with validation method", () => {
    expect(
      isWorkspacePathValidationUnavailableError({
        code: "METHOD_NOT_FOUND",
        method: "is_workspace_path_dir",
      })
    ).toBe(true);
  });

  it("returns true for runtime validation method unavailable code with validation method", () => {
    expect(
      isWorkspacePathValidationUnavailableError({
        code: "runtime.validation.method.unavailable",
        method: "is_workspace_path_dir",
      })
    ).toBe(true);
  });

  it("returns true for nested runtime unsupported errors", () => {
    expect(
      isWorkspacePathValidationUnavailableError({
        error: {
          name: "RuntimeRpcMethodUnsupportedError",
          method: "is_workspace_path_dir",
        },
      })
    ).toBe(true);
  });

  it("does not treat legacy message-only errors as unavailable", () => {
    expect(
      isWorkspacePathValidationUnavailableError(
        new Error("workspace path validation is only available in desktop-host runtime")
      )
    ).toBe(false);
  });

  it("returns false for unrelated method-not-found errors", () => {
    expect(
      isWorkspacePathValidationUnavailableError({
        code: "METHOD_NOT_FOUND",
        method: "workspace_list",
        message: "method not found: workspace_list",
      })
    ).toBe(false);
  });
});
