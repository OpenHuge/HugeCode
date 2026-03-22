import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseRepositoryExecutionContract,
  readRepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";
import {
  resolveRuntimeWorkspaceLaunchDefaults,
  useRuntimeWorkspaceLaunchDefaults,
} from "./runtimeWorkspaceLaunchDefaultsFacade";

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
        validationPresetId: "standard",
      },
      sourceMappings: {
        manual: {
          executionProfileId: "operator-review",
          validationPresetId: "review-first",
          preferredBackendIds: ["backend-policy-a"],
        },
      },
      validationPresets: [
        { id: "standard", commands: ["pnpm validate"] },
        { id: "review-first", commands: ["pnpm validate:fast"] },
      ],
    })
  );
}

describe("runtimeWorkspaceLaunchDefaultsFacade", () => {
  beforeEach(() => {
    vi.mocked(readRepositoryExecutionContract).mockReset();
  });

  it("resolves manual launch defaults through the shared runtime facade", () => {
    const resolved = resolveRuntimeWorkspaceLaunchDefaults({
      contract: createContract(),
      draftTitle: "Inspect launch defaults",
      draftInstruction: "",
    });

    expect(resolved).toMatchObject({
      sourceMappingKind: "manual",
      executionProfileId: "operator-review",
      validationPresetId: "review-first",
      preferredBackendIds: ["backend-policy-a"],
    });
  });

  it("loads repository execution defaults for the workspace and exposes errors separately", async () => {
    vi.mocked(readRepositoryExecutionContract).mockResolvedValue(createContract());

    const { result } = renderHook(() =>
      useRuntimeWorkspaceLaunchDefaults({
        workspaceId: "ws-1",
        draftTitle: "",
        draftInstruction: "Investigate runtime launch defaults.",
      })
    );

    await waitFor(() => {
      expect(result.current.repositoryExecutionContract).not.toBeNull();
    });

    expect(result.current.repositoryExecutionContractError).toBeNull();
    expect(result.current.repositoryLaunchDefaults).toMatchObject({
      sourceMappingKind: "manual",
      executionProfileId: "operator-review",
      validationPresetId: "review-first",
      preferredBackendIds: ["backend-policy-a"],
    });
  });

  it("returns a null contract and captures the read error when the workspace contract lookup fails", async () => {
    vi.mocked(readRepositoryExecutionContract).mockRejectedValue(
      new Error("workspace read failed")
    );

    const { result } = renderHook(() =>
      useRuntimeWorkspaceLaunchDefaults({
        workspaceId: "ws-1",
        draftTitle: "Launch mission",
        draftInstruction: "",
      })
    );

    await waitFor(() => {
      expect(result.current.repositoryExecutionContractError).toBe("workspace read failed");
    });

    expect(result.current.repositoryExecutionContract).toBeNull();
    expect(result.current.repositoryLaunchDefaults.executionProfileId).toBeNull();
  });
});
