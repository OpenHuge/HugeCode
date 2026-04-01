import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyOAuthPool,
  bindOAuthPoolAccount,
  cancelCodexLogin,
  getAccountInfo,
  getAccountRateLimits,
  getOAuthPrimaryAccount,
  getProvidersCatalog,
  importCodexAccountsFromCockpitTools,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  readOAuthSubscriptionPersistenceCapability,
  removeOAuthAccount,
  removeOAuthPool,
  replaceOAuthPoolMembers,
  reportOAuthRateLimit,
  runCodexLogin,
  selectOAuthPoolAccount,
  setOAuthPrimaryAccount,
  upsertOAuthAccount,
  upsertOAuthPool,
} from "./oauth";
import { getCollaborationModes } from "./collaboration";
import { pickImageFiles, readWorkspaceFile } from "./desktopFiles";
import { getMissionControlSnapshot } from "./missionControl";
import { setMenuAccelerators } from "./desktopMenu";
import { getConfigModel, getModelList } from "./models";
import { sendNotification } from "./desktopNotifications";
import { getRuntimeHealth } from "./runtime";
import { getRuntimeCapabilitiesSummary as getRuntimeCapabilitiesSummaryFromRemoteServers } from "./remoteServers";
import {
  cancelRuntimeRun,
  getRuntimeRunV2,
  subscribeRuntimeRunV2,
  submitRuntimeJobApprovalDecision,
  interveneRuntimeRun,
  resumeRuntimeRun,
  startRuntimeRunV2,
} from "./runtimeJobs";
import { getInstructionSkill, getSkillsList } from "./skills";
import { getRuntimeCapabilitiesSummary as getRuntimeCapabilitiesSummaryFromThreads } from "./threads";
import { openRuntimeTerminalSession } from "./runtimeTerminal";
import { localUsageSnapshot } from "./usage";
import {
  sendSubAgentInstruction,
  spawnSubAgentSession,
  waitSubAgentSession,
} from "./runtimeSubAgents";
import { listWorkspaces } from "./workspaceCatalog";
import { isWorkspacePathDir, pickWorkspacePath, pickWorkspacePaths } from "./workspaceDialogs";
import {
  getCollaborationModes as getCollaborationModesBridge,
  getConfigModel as getConfigModelBridge,
} from "../../../services/desktopHostRpc";
import { setMenuAccelerators as setMenuAcceleratorsBridge } from "../../../services/desktopHostCommands";
import { sendNotification as sendNotificationBridge } from "../../../services/notificationsBridge";
import { getMissionControlSnapshot as getMissionControlSnapshotBridge } from "../../../services/runtimeMissionControlBridge";
import {
  getInstructionSkill as getInstructionSkillBridge,
  getModelList as getModelListBridge,
  getSkillsList as getSkillsListBridge,
} from "../../../services/runtimeCatalogBridge";
import {
  applyOAuthPool as applyOAuthPoolBridge,
  bindOAuthPoolAccount as bindOAuthPoolAccountBridge,
  cancelCodexLogin as cancelCodexLoginBridge,
  getAccountInfo as getAccountInfoBridge,
  getAccountRateLimits as getAccountRateLimitsBridge,
  getOAuthPrimaryAccount as getOAuthPrimaryAccountBridge,
  getProvidersCatalog as getProvidersCatalogBridge,
  importCodexAccountsFromCockpitTools as importCodexAccountsFromCockpitToolsBridge,
  listOAuthAccounts as listOAuthAccountsBridge,
  listOAuthPoolMembers as listOAuthPoolMembersBridge,
  listOAuthPools as listOAuthPoolsBridge,
  readOAuthSubscriptionPersistenceCapability as readOAuthSubscriptionPersistenceCapabilityBridge,
  removeOAuthAccount as removeOAuthAccountBridge,
  removeOAuthPool as removeOAuthPoolBridge,
  replaceOAuthPoolMembers as replaceOAuthPoolMembersBridge,
  reportOAuthRateLimit as reportOAuthRateLimitBridge,
  runCodexLogin as runCodexLoginBridge,
  selectOAuthPoolAccount as selectOAuthPoolAccountBridge,
  setOAuthPrimaryAccount as setOAuthPrimaryAccountBridge,
  upsertOAuthAccount as upsertOAuthAccountBridge,
  upsertOAuthPool as upsertOAuthPoolBridge,
} from "../../../services/oauthBridge";
import {
  getRuntimeCapabilitiesSummary as getRuntimeCapabilitiesSummaryBridge,
  getRuntimeHealth as getRuntimeHealthBridge,
} from "../../../services/runtimeSystemBridge";
import {
  cancelRuntimeRun as cancelRuntimeRunBridge,
  getRuntimeRunV2 as getRuntimeRunV2Bridge,
  subscribeRuntimeRunV2 as subscribeRuntimeRunV2Bridge,
  submitRuntimeJobApprovalDecision as submitRuntimeJobApprovalDecisionBridge,
  interveneRuntimeRun as interveneRuntimeRunBridge,
  resumeRuntimeRun as resumeRuntimeRunBridge,
  startRuntimeRunV2 as startRuntimeRunV2Bridge,
} from "../../../services/runtimeJobsBridge";
import { openRuntimeTerminalSession as openRuntimeTerminalSessionBridge } from "../../../services/runtimeSessionTerminalBridge";
import {
  sendSubAgentInstruction as sendSubAgentInstructionBridge,
  spawnSubAgentSession as spawnSubAgentSessionBridge,
  waitSubAgentSession as waitSubAgentSessionBridge,
} from "../../../services/runtimeSubAgentsBridge";
import { localUsageSnapshot as localUsageSnapshotBridge } from "../../../services/runtimeUsageBridge";
import { readWorkspaceFile as readWorkspaceFileBridge } from "../../../services/runtimeWorkspaceFilesBridge";
import { listWorkspaces as listWorkspacesBridge } from "../../../services/workspaceBridge";
import {
  isWorkspacePathDir as isWorkspacePathDirBridge,
  pickImageFiles as pickImageFilesBridge,
  pickWorkspacePath as pickWorkspacePathBridge,
  pickWorkspacePaths as pickWorkspacePathsBridge,
} from "../../../services/workspaceBridge";

describe("runtime port contract", () => {
  it("re-exports critical runtime functions from narrow runtime ports", () => {
    const runtimePortExports = [
      ["interveneRuntimeRun", interveneRuntimeRun, interveneRuntimeRunBridge],
      ["cancelRuntimeRun", cancelRuntimeRun, cancelRuntimeRunBridge],
      ["resumeRuntimeRun", resumeRuntimeRun, resumeRuntimeRunBridge],
      ["startRuntimeRunV2", startRuntimeRunV2, startRuntimeRunV2Bridge],
      ["getRuntimeRunV2", getRuntimeRunV2, getRuntimeRunV2Bridge],
      ["subscribeRuntimeRunV2", subscribeRuntimeRunV2, subscribeRuntimeRunV2Bridge],
      [
        "submitRuntimeJobApprovalDecision",
        submitRuntimeJobApprovalDecision,
        submitRuntimeJobApprovalDecisionBridge,
      ],
      ["getMissionControlSnapshot", getMissionControlSnapshot, getMissionControlSnapshotBridge],
      ["spawnSubAgentSession", spawnSubAgentSession, spawnSubAgentSessionBridge],
      ["sendSubAgentInstruction", sendSubAgentInstruction, sendSubAgentInstructionBridge],
      ["waitSubAgentSession", waitSubAgentSession, waitSubAgentSessionBridge],
      ["openRuntimeTerminalSession", openRuntimeTerminalSession, openRuntimeTerminalSessionBridge],
      ["getRuntimeHealth", getRuntimeHealth, getRuntimeHealthBridge],
      [
        "threads.getRuntimeCapabilitiesSummary",
        getRuntimeCapabilitiesSummaryFromThreads,
        getRuntimeCapabilitiesSummaryBridge,
      ],
      [
        "remoteServers.getRuntimeCapabilitiesSummary",
        getRuntimeCapabilitiesSummaryFromRemoteServers,
        getRuntimeCapabilitiesSummaryBridge,
      ],
    ] as const;

    for (const [name, exportedValue, bridgeValue] of runtimePortExports) {
      expect(exportedValue, `${name} should be re-exported directly`).toBe(bridgeValue);
    }
  });

  it("re-exports leaf runtime ports from dedicated bridge or desktop service modules", () => {
    const leafPortExports = [
      ["getConfigModel", getConfigModel, getConfigModelBridge],
      ["getModelList", getModelList, getModelListBridge],
      ["setMenuAccelerators", setMenuAccelerators, setMenuAcceleratorsBridge],
      ["sendNotification", sendNotification, sendNotificationBridge],
      ["pickImageFiles", pickImageFiles, pickImageFilesBridge],
      ["readWorkspaceFile", readWorkspaceFile, readWorkspaceFileBridge],
      ["isWorkspacePathDir", isWorkspacePathDir, isWorkspacePathDirBridge],
      ["pickWorkspacePath", pickWorkspacePath, pickWorkspacePathBridge],
      ["pickWorkspacePaths", pickWorkspacePaths, pickWorkspacePathsBridge],
      ["getInstructionSkill", getInstructionSkill, getInstructionSkillBridge],
      ["getSkillsList", getSkillsList, getSkillsListBridge],
      ["localUsageSnapshot", localUsageSnapshot, localUsageSnapshotBridge],
      ["getCollaborationModes", getCollaborationModes, getCollaborationModesBridge],
      ["listWorkspaces", listWorkspaces, listWorkspacesBridge],
    ] as const;

    for (const [name, exportedValue, bridgeValue] of leafPortExports) {
      expect(exportedValue, `${name} should be re-exported directly`).toBe(bridgeValue);
    }
  });

  it("re-exports identity control-plane functions from dedicated oauth bridges", () => {
    const oauthPortExports = [
      ["listOAuthAccounts", listOAuthAccounts, listOAuthAccountsBridge],
      ["listOAuthPools", listOAuthPools, listOAuthPoolsBridge],
      ["listOAuthPoolMembers", listOAuthPoolMembers, listOAuthPoolMembersBridge],
      ["getOAuthPrimaryAccount", getOAuthPrimaryAccount, getOAuthPrimaryAccountBridge],
      ["setOAuthPrimaryAccount", setOAuthPrimaryAccount, setOAuthPrimaryAccountBridge],
      ["upsertOAuthAccount", upsertOAuthAccount, upsertOAuthAccountBridge],
      ["removeOAuthAccount", removeOAuthAccount, removeOAuthAccountBridge],
      ["upsertOAuthPool", upsertOAuthPool, upsertOAuthPoolBridge],
      ["removeOAuthPool", removeOAuthPool, removeOAuthPoolBridge],
      ["replaceOAuthPoolMembers", replaceOAuthPoolMembers, replaceOAuthPoolMembersBridge],
      ["applyOAuthPool", applyOAuthPool, applyOAuthPoolBridge],
      ["selectOAuthPoolAccount", selectOAuthPoolAccount, selectOAuthPoolAccountBridge],
      ["bindOAuthPoolAccount", bindOAuthPoolAccount, bindOAuthPoolAccountBridge],
      ["reportOAuthRateLimit", reportOAuthRateLimit, reportOAuthRateLimitBridge],
      ["getAccountInfo", getAccountInfo, getAccountInfoBridge],
      ["getAccountRateLimits", getAccountRateLimits, getAccountRateLimitsBridge],
      [
        "readOAuthSubscriptionPersistenceCapability",
        readOAuthSubscriptionPersistenceCapability,
        readOAuthSubscriptionPersistenceCapabilityBridge,
      ],
      ["getProvidersCatalog", getProvidersCatalog, getProvidersCatalogBridge],
      [
        "importCodexAccountsFromCockpitTools",
        importCodexAccountsFromCockpitTools,
        importCodexAccountsFromCockpitToolsBridge,
      ],
      ["runCodexLogin", runCodexLogin, runCodexLoginBridge],
      ["cancelCodexLogin", cancelCodexLogin, cancelCodexLoginBridge],
    ] as const;

    for (const [name, exportedValue, bridgeValue] of oauthPortExports) {
      expect(exportedValue, `${name} should be re-exported directly`).toBe(bridgeValue);
    }
  });

  it("keeps remoteServers focused on runtime server controls", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "remoteServers.ts"), "utf8");

    expect(source).not.toMatch(
      /acpIntegrationProbe[\s\S]*acpIntegrationsList[\s\S]*acpIntegrationRemove[\s\S]*acpIntegrationSetState[\s\S]*acpIntegrationUpsert[\s\S]*getBackendPoolBootstrapPreview[\s\S]*getBackendPoolDiagnostics[\s\S]*orbitConnectTest[\s\S]*orbitRunnerStart[\s\S]*orbitRunnerStatus[\s\S]*orbitRunnerStop[\s\S]*orbitSignInPoll[\s\S]*orbitSignInStart[\s\S]*orbitSignOut[\s\S]*netbirdDaemonCommandPreview[\s\S]*netbirdStatus[\s\S]*runtimeBackendRemove[\s\S]*runtimeBackendSetState[\s\S]*runtimeBackendsList[\s\S]*runtimeBackendUpsert[\s\S]*tailscaleDaemonCommandPreview[\s\S]*tailscaleDaemonStart[\s\S]*tailscaleDaemonStatus[\s\S]*tailscaleDaemonStop[\s\S]*tailscaleStatus/
    );
  });

  it("does not expose workspace catalog reads from remoteServers", () => {
    const remoteServersSource = readFileSync(
      path.resolve(import.meta.dirname, "remoteServers.ts"),
      "utf8"
    );

    expect(remoteServersSource).not.toMatch(/export\s*\{\s*listWorkspaces\s*\}\s*from/);
  });

  it("keeps leaf ports free of retired compatibility aggregation imports", () => {
    const leafPortSources = [
      "collaboration.ts",
      "desktopFiles.ts",
      "desktopMenu.ts",
      "models.ts",
      "desktopNotifications.ts",
      "skills.ts",
      "usage.ts",
      "workspaceDialogs.ts",
    ] as const;

    for (const fileName of leafPortSources) {
      const source = readFileSync(path.resolve(import.meta.dirname, fileName), "utf8");

      expect(
        source,
        `${fileName} should not import retired compatibility aggregation exports`
      ).not.toMatch(/from\s+["']\.\/(?:compat|legacy)[A-Za-z0-9]*["']/);
    }
  });

  it("keeps runtimeJobs free of retired compatibility aggregation imports", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "runtimeJobs.ts"), "utf8");

    expect(source).not.toMatch(/from\s+["']\.\/(?:compat|legacy)[A-Za-z0-9]*["']/);
  });

  it("keeps workspace client runtime bindings on kernel jobs instead of legacy runtime runs", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../kernel/createWorkspaceClientRuntimeBindings.ts"),
      "utf8"
    );

    expect(source).toMatch(/from\s+["']\.\.\/ports\/runtimeJobs["']/);
    expect(source).not.toMatch(/from\s+["']\.\.\/ports\/runtimeRuns["']/);
  });

  it("routes runtime agent control dependencies through kernel jobs for control-plane mutations", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../kernel/createRuntimeAgentControlDependencies.ts"),
      "utf8"
    );

    expect(source).toMatch(/from\s+["']\.\.\/ports\/runtimeJobs["']/);
    expect(source).toMatch(/startRuntimeRunWithRemoteSelection/);
  });

  it("removes legacy run-first approval names from shared and app-facing control surfaces", () => {
    const appSurfaceSource = readFileSync(
      path.resolve(import.meta.dirname, "../types/webMcpBridge.ts"),
      "utf8"
    );
    const sharedSurfaceSource = readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../../../../../packages/code-runtime-webmcp-client/src/webMcpBridgeTypes.ts"
      ),
      "utf8"
    );
    const facadeSource = readFileSync(
      path.resolve(import.meta.dirname, "../facades/runtimeAgentControlFacade.ts"),
      "utf8"
    );

    expect(appSurfaceSource).toContain("@ku0/code-runtime-webmcp-client/webMcpBridgeTypes");
    expect(appSurfaceSource).not.toContain("checkpointRunApproval");
    expect(sharedSurfaceSource).toContain("submitTaskApprovalDecision");
    expect(sharedSurfaceSource).not.toContain("checkpointRunApproval");
    expect(facadeSource).toContain("submitTaskApprovalDecision");
    expect(facadeSource).not.toContain("checkpointRunApproval");
  });

  it("retires runtimeRuns in favor of kernel jobs and mission-control projections", () => {
    const source = path.resolve(import.meta.dirname, "runtimeRuns.ts");

    expect(() => readFileSync(source, "utf8")).toThrow();
  });

  it("keeps threads off legacy runtime run controls", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "threads.ts"), "utf8");

    expect(source).not.toMatch(/cancelRuntimeRun/);
    expect(source).not.toMatch(/listRuntimeRuns/);
    expect(source).not.toMatch(/startRuntimeRun/);
    expect(source).not.toMatch(/subscribeRuntimeRun/);
    expect(source).not.toMatch(/\.\/runtimeRuns/);
  });

  it("keeps workspaceCatalog free of retired compatibility aggregation imports", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "workspaceCatalog.ts"), "utf8");

    expect(source).not.toMatch(/from\s+["']\.\/(?:compat|legacy)[A-Za-z0-9]*["']/);
  });

  it("keeps oauth free of retired compatibility aggregation imports", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "oauth.ts"), "utf8");

    expect(source).not.toMatch(/from\s+["']\.\/(?:compat|legacy)[A-Za-z0-9]*["']/);
  });

  it("deletes app-local shared runtime shim files once the shared package owns them", () => {
    const deletedServiceShims = [
      "../../../services/runtimeClientRpcHelpers.ts",
      "../../../services/runtimeClientRpcPayloads.ts",
      "../../../services/runtimeEventStateMachine.ts",
      "../../../services/webMcpBridgeModelContextApi.ts",
    ] as const;

    for (const relativePath of deletedServiceShims) {
      expect(() => readFileSync(path.resolve(import.meta.dirname, relativePath), "utf8")).toThrow();
    }
  });
});
