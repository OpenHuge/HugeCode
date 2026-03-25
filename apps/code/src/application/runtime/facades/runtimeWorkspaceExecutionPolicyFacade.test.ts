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

    expect(result.current.repositoryExecutionContractStatus).toBe("loading");

    await waitFor(() => {
      expect(result.current.repositoryExecutionContract).not.toBeNull();
    });

    expect(result.current.repositoryExecutionContractError).toBeNull();
    expect(result.current.repositoryExecutionContractStatus).toBe("ready");
  });

  it("marks missing workspace execution policy after a clean null read", async () => {
    vi.mocked(readRepositoryExecutionContract).mockResolvedValue(null);

    const { result } = renderHook(() => useRuntimeWorkspaceExecutionPolicy("ws-1"));

    expect(result.current.repositoryExecutionContractStatus).toBe("loading");

    await waitFor(() => {
      expect(result.current.repositoryExecutionContractStatus).toBe("missing");
    });

    expect(result.current.repositoryExecutionContract).toBeNull();
    expect(result.current.repositoryExecutionContractError).toBeNull();
  });

  it("marks execution policy failures as errors", async () => {
    vi.mocked(readRepositoryExecutionContract).mockRejectedValue(
      new Error("contract parse failed")
    );

    const { result } = renderHook(() => useRuntimeWorkspaceExecutionPolicy("ws-1"));

    expect(result.current.repositoryExecutionContractStatus).toBe("loading");

    await waitFor(() => {
      expect(result.current.repositoryExecutionContractStatus).toBe("error");
    });

    expect(result.current.repositoryExecutionContract).toBeNull();
    expect(result.current.repositoryExecutionContractError).toBe("contract parse failed");
  });

  it("clears execution policy state when no workspace is active", () => {
    const { result } = renderHook(() => useRuntimeWorkspaceExecutionPolicy(null));

    expect(result.current.repositoryExecutionContract).toBeNull();
    expect(result.current.repositoryExecutionContractError).toBeNull();
    expect(result.current.repositoryExecutionContractStatus).toBe("idle");
  });
});
