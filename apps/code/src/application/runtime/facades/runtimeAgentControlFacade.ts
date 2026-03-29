import type { RuntimePolicySnapshot } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentControl } from "../types/webMcpBridge";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { buildRuntimeDiscoveryControl } from "./runtimeDiscoveryControl";

export type RuntimeAgentControlFacade = RuntimeAgentControl & {
  getGitStatus: (workspaceId: string) => Promise<unknown>;
  getGitDiffs: (workspaceId: string) => Promise<unknown>;
  listGitBranches: (workspaceId: string) => Promise<unknown>;
  stageGitFile: (workspaceId: string, path: string) => Promise<void>;
  stageGitAll: (workspaceId: string) => Promise<void>;
  unstageGitFile: (workspaceId: string, path: string) => Promise<void>;
  revertGitFile: (workspaceId: string, path: string) => Promise<void>;
  commitGit: (workspaceId: string, message: string) => Promise<void>;
  createGitBranch: (workspaceId: string, name: string) => Promise<void>;
  checkoutGitBranch: (workspaceId: string, name: string) => Promise<void>;
  getRuntimePolicy: () => Promise<RuntimePolicySnapshot>;
};

export type RuntimeAgentControlDependencies = {
  [K in keyof RuntimeAgentControlFacade]: RuntimeAgentControlFacade[K];
} & {
  runtimeDiscoveryControl: ReturnType<typeof buildRuntimeDiscoveryControl>;
};

export function createRuntimeAgentControlFacade(
  workspaceId: RuntimeWorkspaceId,
  deps: RuntimeAgentControlDependencies
): RuntimeAgentControlFacade {
  return {
    listTasks: deps.listTasks,
    getTaskStatus: deps.getTaskStatus,
    startTask: deps.startTask,
    interruptTask: deps.interruptTask,
    interveneTask: deps.interveneTask,
    resumeTask: deps.resumeTask,
    submitTaskApprovalDecision: deps.submitTaskApprovalDecision,
    actionRequiredGetV2: deps.actionRequiredGetV2,
    actionRequiredSubmitV2: deps.actionRequiredSubmitV2,
    respondToServerRequest: deps.respondToServerRequest,
    respondToUserInputRequest: deps.respondToUserInputRequest,
    respondToServerRequestResult: deps.respondToServerRequestResult,
    listLiveSkills: deps.listLiveSkills,
    runLiveSkill: deps.runLiveSkill,
    getGitStatus: deps.getGitStatus,
    getGitDiffs: deps.getGitDiffs,
    listGitBranches: deps.listGitBranches,
    stageGitFile: deps.stageGitFile,
    stageGitAll: deps.stageGitAll,
    unstageGitFile: deps.unstageGitFile,
    revertGitFile: deps.revertGitFile,
    commitGit: deps.commitGit,
    createGitBranch: deps.createGitBranch,
    checkoutGitBranch: deps.checkoutGitBranch,
    distributedTaskGraph: deps.distributedTaskGraph,
    getRuntimeCapabilitiesSummary: deps.getRuntimeCapabilitiesSummary,
    getRuntimeHealth: deps.getRuntimeHealth,
    getRuntimeTerminalStatus: deps.getRuntimeTerminalStatus,
    runtimeToolMetricsRead: deps.runtimeToolMetricsRead,
    runtimeToolGuardrailRead: deps.runtimeToolGuardrailRead,
    ...deps.runtimeDiscoveryControl,
    getRuntimePolicy: deps.getRuntimePolicy,
    spawnSubAgentSession: deps.spawnSubAgentSession,
    sendSubAgentInstruction: deps.sendSubAgentInstruction,
    waitSubAgentSession: deps.waitSubAgentSession,
    getSubAgentSessionStatus: deps.getSubAgentSessionStatus,
    interruptSubAgentSession: deps.interruptSubAgentSession,
    closeSubAgentSession: deps.closeSubAgentSession,
  };
}
