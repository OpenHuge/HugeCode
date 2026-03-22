import { useEffect, useState } from "react";
import {
  readRepositoryExecutionContract,
  type RepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";

export type RuntimeWorkspaceExecutionPolicyState = {
  repositoryExecutionContract: RepositoryExecutionContract | null;
  repositoryExecutionContractError: string | null;
};

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

  useEffect(() => {
    if (!workspaceId) {
      setRepositoryExecutionContract(null);
      setRepositoryExecutionContractError(null);
      return;
    }
    let cancelled = false;
    setRepositoryExecutionContract(null);
    setRepositoryExecutionContractError(null);
    void readRuntimeWorkspaceExecutionPolicy(workspaceId)
      .then((contract) => {
        if (cancelled) {
          return;
        }
        setRepositoryExecutionContract(contract);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setRepositoryExecutionContract(null);
        setRepositoryExecutionContractError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return {
    repositoryExecutionContract,
    repositoryExecutionContractError,
  };
}
