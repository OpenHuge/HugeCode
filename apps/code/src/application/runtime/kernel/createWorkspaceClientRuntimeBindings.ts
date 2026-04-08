import type { WorkspaceClientRuntimeBindings } from "@ku0/code-workspace-client/workspace-bindings";
import {
  readRuntimeCompositionSettingsForWorkspace,
  writeRuntimeCompositionSettingsForWorkspace,
} from "@ku0/code-platform-interfaces";
import { logger } from "../logger";
import {
  getAppSettings,
  syncRuntimeGatewayProfileFromAppSettings,
  updateAppSettings,
} from "../ports/desktopAppSettings";
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
} from "../ports/oauth";
import { getConfigModel, getModelList } from "../ports/models";
import { listWorkspaces } from "../ports/workspaceCatalog";
import { subscribeScopedRuntimeUpdatedEvents } from "../ports/runtimeUpdatedEvents";
import {
  cancelRuntimeRun,
  interveneRuntimeRun,
  prepareRuntimeRunV2,
  submitRuntimeJobApprovalDecision,
  resumeRuntimeRun,
  startRuntimeRunV2,
} from "../ports/runtimeJobs";
import {
  archiveRuntimeThread,
  createRuntimeThread,
  listRuntimeThreads,
  resumeRuntimeThread,
} from "../ports/runtimeThreads";
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
} from "../ports/runtimeGit";
import {
  listRuntimeWorkspaceFileEntries,
  readRuntimeWorkspaceFile,
} from "../ports/runtimeWorkspaceFiles";
import type {
  HugeCodeMissionControlSnapshot,
  KernelProjectionBootstrapRequest,
  KernelProjectionBootstrapResponse,
  KernelProjectionDelta,
  KernelProjectionSubscriptionRequest,
} from "@ku0/code-runtime-host-contract";
import {
  getRuntimeCompositionProfileV2,
  listRuntimeCompositionProfilesV2,
  publishRuntimeCompositionSnapshotV1,
  resolveRuntimeCompositionV2,
} from "../ports/runtimeComposition";
import { createWorkspaceClientRuntimeMissionControlSurfaceBindings } from "../../../../../../packages/code-workspace-client/src/workspace/missionControlBindings";

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
  const missionControlSurface = createWorkspaceClientRuntimeMissionControlSurfaceBindings({
    bootstrapKernelProjection: input.bootstrapKernelProjection,
    readMissionControlSnapshot: input.readMissionControlSnapshot,
    reportMissionControlFallback: ({ reason, error }) => {
      logger.warn("Mission control bindings fell back to snapshot-backed truth.", {
        reason,
        error,
      });
    },
  });

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
    missionControl: missionControlSurface.missionControl,
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
    review: missionControlSurface.review,
    composition: {
      listProfilesV2: async (workspaceId) => listRuntimeCompositionProfilesV2({ workspaceId }),
      getProfileV2: async (workspaceId, profileId) =>
        getRuntimeCompositionProfileV2({
          workspaceId,
          profileId,
        }),
      resolveV2: async (input) => resolveRuntimeCompositionV2(input),
      publishSnapshotV1: async (input) => publishRuntimeCompositionSnapshotV1(input),
      getSettings: async (workspaceId) =>
        readRuntimeCompositionSettingsForWorkspace(
          (await getAppSettings()) as Record<string, unknown>,
          workspaceId
        ),
      updateSettings: async (workspaceId, settings) => {
        const currentSettings = (await getAppSettings()) as Record<string, unknown>;
        const nextSettings = writeRuntimeCompositionSettingsForWorkspace(
          currentSettings,
          workspaceId,
          settings
        );
        const savedSettings = (await updateAppSettings(nextSettings as never)) as Record<
          string,
          unknown
        >;
        return readRuntimeCompositionSettingsForWorkspace(savedSettings, workspaceId);
      },
    },
  };
}
