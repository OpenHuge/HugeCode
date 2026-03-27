import type { WorkspaceClientRuntimeBindings } from "@ku0/code-workspace-client";
import { buildSharedMissionControlSummary } from "@ku0/code-workspace-client";
import {
  getAppSettings,
  syncRuntimeGatewayProfileFromAppSettings,
  updateAppSettings,
} from "../ports/tauriAppSettings";
import {
  applyOAuthPool,
  bindOAuthPoolAccount,
  getAccountInfo,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  runCodexLogin,
  setOAuthPrimaryAccount,
} from "../ports/tauriOauth";
import { getConfigModel, getModelList } from "../ports/tauriModels";
import { listWorkspaces } from "../ports/tauriWorkspaceCatalog";
import { subscribeScopedRuntimeUpdatedEvents } from "../ports/runtimeUpdatedEvents";
import {
  cancelRuntimeRun,
  interveneRuntimeRun,
  prepareRuntimeRunV2,
  submitRuntimeJobApprovalDecision,
  resumeRuntimeRun,
  startRuntimeRunV2,
} from "../ports/tauriRuntimeJobs";
import {
  archiveRuntimeThread,
  createRuntimeThread,
  listRuntimeThreads,
  resumeRuntimeThread,
} from "../ports/tauriRuntimeThreads";
import {
  checkoutRuntimeGitBranch,
  commitRuntimeGit,
  createRuntimeGitBranch,
  listRuntimeGitBranches,
  listRuntimeGitChanges,
  readRuntimeGitDiff,
  readRuntimeGitLog,
  revertRuntimeGitChange,
  stageAllRuntimeGitChanges,
  stageRuntimeGitChange,
  unstageRuntimeGitChange,
} from "../ports/tauriRuntimeGit";
import {
  listRuntimeWorkspaceFileEntries,
  readRuntimeWorkspaceFile,
} from "../ports/tauriRuntimeWorkspaceFiles";
import type {
  HugeCodeMissionControlSnapshot,
  KernelProjectionBootstrapRequest,
  KernelProjectionBootstrapResponse,
  KernelProjectionDelta,
  KernelProjectionSubscriptionRequest,
} from "@ku0/code-runtime-host-contract";

type CreateWorkspaceClientRuntimeBindingsInput = {
  readMissionControlSnapshot: () => Promise<HugeCodeMissionControlSnapshot>;
  bootstrapKernelProjection: (
    request?: KernelProjectionBootstrapRequest
  ) => Promise<KernelProjectionBootstrapResponse>;
  subscribeKernelProjection: (
    request: KernelProjectionSubscriptionRequest,
    listener: (delta: KernelProjectionDelta) => void
  ) => () => void;
};

export function createWorkspaceClientRuntimeBindings(
  input: CreateWorkspaceClientRuntimeBindingsInput
): WorkspaceClientRuntimeBindings {
  return {
    surface: "shared-workspace-client",
    settings: {
      getAppSettings: async () => (await getAppSettings()) as Record<string, unknown>,
      updateAppSettings: async (settings) =>
        (await updateAppSettings(settings as never)) as Record<string, unknown>,
      syncRuntimeGatewayProfileFromAppSettings: (settings) =>
        syncRuntimeGatewayProfileFromAppSettings(settings as never),
    },
    oauth: {
      listAccounts: listOAuthAccounts,
      listPools: listOAuthPools,
      listPoolMembers: listOAuthPoolMembers,
      getPrimaryAccount: getOAuthPrimaryAccount,
      setPrimaryAccount: setOAuthPrimaryAccount,
      applyPool: applyOAuthPool,
      bindPoolAccount: bindOAuthPoolAccount,
      runLogin: runCodexLogin,
      getAccountInfo,
      getProvidersCatalog,
    },
    models: {
      getModelList,
      getConfigModel,
    },
    workspaceCatalog: {
      listWorkspaces,
    },
    missionControl: {
      readMissionControlSnapshot: async () => {
        const bootstrap = await input.bootstrapKernelProjection({
          scopes: ["mission_control"],
        });
        const missionControl = bootstrap.slices.mission_control;
        return missionControl && typeof missionControl === "object"
          ? (missionControl as HugeCodeMissionControlSnapshot)
          : input.readMissionControlSnapshot();
      },
      readMissionControlSummary: async (activeWorkspaceId) => {
        const bootstrap = await input.bootstrapKernelProjection({
          scopes: ["mission_control"],
        });
        const missionControl = bootstrap.slices.mission_control;
        const snapshot =
          missionControl && typeof missionControl === "object"
            ? (missionControl as HugeCodeMissionControlSnapshot)
            : await input.readMissionControlSnapshot();
        return buildSharedMissionControlSummary(snapshot, activeWorkspaceId);
      },
    },
    kernelProjection: {
      bootstrap: input.bootstrapKernelProjection,
      subscribe: input.subscribeKernelProjection,
    },
    runtimeUpdated: {
      subscribeScopedRuntimeUpdatedEvents: (options, listener) =>
        subscribeScopedRuntimeUpdatedEvents(options, (event) =>
          listener({
            scope: [...event.scope],
            reason: event.reason,
            eventWorkspaceId: event.eventWorkspaceId,
            paramsWorkspaceId: event.paramsWorkspaceId,
          })
        ),
    },
    agentControl: {
      prepareRuntimeRun: prepareRuntimeRunV2,
      startRuntimeRun: startRuntimeRunV2,
      cancelRuntimeRun,
      resumeRuntimeRun,
      interveneRuntimeRun,
      submitRuntimeJobApprovalDecision,
    },
    threads: {
      listThreads: async (input) => listRuntimeThreads(input.workspaceId),
      createThread: async (input) => createRuntimeThread(input),
      resumeThread: async (input) => resumeRuntimeThread(input.workspaceId, input.threadId),
      archiveThread: async (input) => archiveRuntimeThread(input.workspaceId, input.threadId),
    },
    git: {
      listChanges: async (input) => listRuntimeGitChanges(input.workspaceId),
      readDiff: async (input) =>
        readRuntimeGitDiff(input.workspaceId, input.changeId, {
          offset: input.offset,
          maxBytes: input.maxBytes,
        }),
      listBranches: async (input) => listRuntimeGitBranches(input.workspaceId),
      createBranch: async (input) => createRuntimeGitBranch(input.workspaceId, input.branchName),
      checkoutBranch: async (input) =>
        checkoutRuntimeGitBranch(input.workspaceId, input.branchName),
      readLog: async (input) => readRuntimeGitLog(input.workspaceId, input.limit),
      stageChange: async (input) => stageRuntimeGitChange(input.workspaceId, input.changeId),
      stageAll: async (input) => stageAllRuntimeGitChanges(input.workspaceId),
      unstageChange: async (input) => unstageRuntimeGitChange(input.workspaceId, input.changeId),
      revertChange: async (input) => revertRuntimeGitChange(input.workspaceId, input.changeId),
      commit: async (input) => commitRuntimeGit(input.workspaceId, input.message),
    },
    workspaceFiles: {
      listWorkspaceFileEntries: async (input) => listRuntimeWorkspaceFileEntries(input.workspaceId),
      readWorkspaceFile: async (input) => readRuntimeWorkspaceFile(input.workspaceId, input.fileId),
    },
    review: {
      listReviewPacks: async () => {
        const bootstrap = await input.bootstrapKernelProjection({
          scopes: ["mission_control"],
        });
        const missionControl = bootstrap.slices.mission_control;
        if (missionControl && typeof missionControl === "object") {
          return (missionControl as HugeCodeMissionControlSnapshot).reviewPacks;
        }
        return (await input.readMissionControlSnapshot()).reviewPacks;
      },
    },
  };
}
