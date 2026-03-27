import { useEffect, useState } from "react";
import {
  readRepositoryExecutionContract,
  type RepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";

export type RuntimeWorkspaceExecutionPolicyState = {
  repositoryExecutionContract: RepositoryExecutionContract | null;
  repositoryExecutionContractError: string | null;
  repositoryExecutionContractStatus: RuntimeWorkspaceExecutionPolicyStatus;
};

export type RuntimeWorkspaceExecutionPolicyStatus =
  | "idle"
  | "loading"
  | "ready"
  | "missing"
  | "error";

export async function readRuntimeWorkspaceExecutionPolicy(
  workspaceId: string
): Promise<RepositoryExecutionContract | null> {
  return await readRepositoryExecutionContract(workspaceId);
}

export function useRuntimeWorkspaceExecutionPolicy(
  workspaceId: string | null
): RuntimeWorkspaceExecutionPolicyState {
  const [repositoryExecutionContract, setRepositoryExecutionContract] =
    useState<RepositoryExecutionContract | null>(null);
  const [repositoryExecutionContractError, setRepositoryExecutionContractError] = useState<
    string | null
  >(null);
  const [repositoryExecutionContractStatus, setRepositoryExecutionContractStatus] =
    useState<RuntimeWorkspaceExecutionPolicyStatus>("idle");

  useEffect(() => {
    if (!workspaceId) {
      setRepositoryExecutionContract(null);
      setRepositoryExecutionContractError(null);
      setRepositoryExecutionContractStatus("idle");
      return;
    }
    let cancelled = false;
    setRepositoryExecutionContract(null);
    setRepositoryExecutionContractError(null);
    setRepositoryExecutionContractStatus("loading");
    void readRuntimeWorkspaceExecutionPolicy(workspaceId)
      .then((contract) => {
        if (cancelled) {
          return;
        }
        setRepositoryExecutionContract(contract);
        setRepositoryExecutionContractStatus(contract ? "ready" : "missing");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setRepositoryExecutionContract(null);
        setRepositoryExecutionContractError(error instanceof Error ? error.message : String(error));
        setRepositoryExecutionContractStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return {
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryExecutionContractStatus,
  };
}
