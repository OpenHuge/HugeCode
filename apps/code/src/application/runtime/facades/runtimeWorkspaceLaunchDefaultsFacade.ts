import { useMemo } from "react";
import type { AgentTaskSourceSummary } from "@ku0/code-runtime-host-contract";
import {
  type RepositoryExecutionContract,
  type ResolvedRepositoryExecutionDefaults,
} from "./runtimeRepositoryExecutionContract";
import { resolveRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionDefaults";
import { buildManualTaskSource } from "./runtimeTaskSourceFacade";
import { useRuntimeWorkspaceExecutionPolicy } from "./runtimeWorkspaceExecutionPolicyFacade";

export type RuntimeWorkspaceLaunchDefaultsState = {
  repositoryExecutionContract: RepositoryExecutionContract | null;
  repositoryExecutionContractError: string | null;
  repositoryLaunchDefaults: ResolvedRepositoryExecutionDefaults;
};

export function resolveRuntimeWorkspaceLaunchDefaults(input: {
  contract: RepositoryExecutionContract | null;
  workspaceId: string;
  draftTitle: string;
  draftInstruction: string;
}): ResolvedRepositoryExecutionDefaults {
  return resolveRepositoryExecutionDefaults({
    contract: input.contract,
    taskSource: buildManualTaskSource({
      workspaceId: input.workspaceId,
      title: input.draftTitle.trim() || input.draftInstruction.trim() || "Mission run",
    }) as AgentTaskSourceSummary,
  });
}

export function useRuntimeWorkspaceLaunchDefaults(input: {
  workspaceId: string;
  draftTitle: string;
  draftInstruction: string;
}): RuntimeWorkspaceLaunchDefaultsState {
  const { repositoryExecutionContract, repositoryExecutionContractError } =
    useRuntimeWorkspaceExecutionPolicy(input.workspaceId);

  const repositoryLaunchDefaults = useMemo(
    () =>
      resolveRuntimeWorkspaceLaunchDefaults({
        contract: repositoryExecutionContract,
        workspaceId: input.workspaceId,
        draftTitle: input.draftTitle,
        draftInstruction: input.draftInstruction,
      }),
    [input.draftInstruction, input.draftTitle, input.workspaceId, repositoryExecutionContract]
  );

  return {
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryLaunchDefaults,
  };
}
