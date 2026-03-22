import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseRepositoryExecutionContract,
  readRepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";
import {
  readRuntimeWorkspaceExecutionPolicy,
  useRuntimeWorkspaceExecutionPolicy,
} from "./runtimeWorkspaceExecutionPolicyFacade";

vi.mock("./runtimeRepositoryExecutionContract", async () => {
  const actual = await vi.importActual<typeof import("./runtimeRepositoryExecutionContract")>(
    "./runtimeRepositoryExecutionContract"
  );
  return {
    ...actual,
    readRepositoryExecutionContract: vi.fn(),
  };
});

function createContract() {
  return parseRepositoryExecutionContract(
    JSON.stringify({
      version: 1,
      defaults: {
        executionProfileId: "balanced-delegate",
      },
      validationPresets: [],
      reviewProfiles: [],
    })
  );
}

describe("runtimeWorkspaceExecutionPolicyFacade", () => {
  beforeEach(() => {
    vi.mocked(readRepositoryExecutionContract).mockReset();
  });

  it("reuses the repository contract reader through the shared async facade", async () => {
    vi.mocked(readRepositoryExecutionContract).mockResolvedValue(createContract());

    await expect(readRuntimeWorkspaceExecutionPolicy("ws-1")).resolves.toMatchObject({
      defaults: {
        executionProfileId: "balanced-delegate",
      },
    });
  });

  it("loads workspace execution policy through the shared hook", async () => {
    vi.mocked(readRepositoryExecutionContract).mockResolvedValue(createContract());

    const { result } = renderHook(() => useRuntimeWorkspaceExecutionPolicy("ws-1"));

    await waitFor(() => {
      expect(result.current.repositoryExecutionContract).not.toBeNull();
    });

    expect(result.current.repositoryExecutionContractError).toBeNull();
  });

  it("clears execution policy state when no workspace is active", () => {
    const { result } = renderHook(() => useRuntimeWorkspaceExecutionPolicy(null));

    expect(result.current.repositoryExecutionContract).toBeNull();
    expect(result.current.repositoryExecutionContractError).toBeNull();
  });
});
