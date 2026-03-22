import { useMemo } from "react";
import type { AgentTaskSourceSummary } from "@ku0/code-runtime-host-contract";
import {
  resolveRepositoryExecutionDefaults,
  type RepositoryExecutionContract,
  type ResolvedRepositoryExecutionDefaults,
} from "./runtimeRepositoryExecutionContract";
import { useRuntimeWorkspaceExecutionPolicy } from "./runtimeWorkspaceExecutionPolicyFacade";

export type RuntimeWorkspaceLaunchDefaultsState = {
  repositoryExecutionContract: RepositoryExecutionContract | null;
  repositoryExecutionContractError: string | null;
  repositoryLaunchDefaults: ResolvedRepositoryExecutionDefaults;
};

function buildWorkspaceLaunchTaskSource(input: {
  draftTitle: string;
  draftInstruction: string;
}): AgentTaskSourceSummary {
  return {
    kind: "manual",
    title: input.draftTitle.trim() || input.draftInstruction.trim() || "Mission run",
  };
}

export function resolveRuntimeWorkspaceLaunchDefaults(input: {
  contract: RepositoryExecutionContract | null;
  draftTitle: string;
  draftInstruction: string;
}): ResolvedRepositoryExecutionDefaults {
  return resolveRepositoryExecutionDefaults({
    contract: input.contract,
    taskSource: buildWorkspaceLaunchTaskSource(input),
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
        draftTitle: input.draftTitle,
        draftInstruction: input.draftInstruction,
      }),
    [input.draftInstruction, input.draftTitle, repositoryExecutionContract]
  );

  return {
    repositoryExecutionContract,
    repositoryExecutionContractError,
    repositoryLaunchDefaults,
  };
}
