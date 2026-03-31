import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
} from "./tauriOauth";
import { getCollaborationModes } from "./tauriCollaboration";
import { pickImageFiles, readWorkspaceFile } from "./tauriFiles";
import { getMissionControlSnapshot } from "./tauriMissionControl";
import { setMenuAccelerators } from "./tauriMenu";
import { getConfigModel, getModelList } from "./tauriModels";
import { sendNotification } from "./tauriNotifications";
import { getRuntimeHealth } from "./tauriRuntime";
import { getRuntimeCapabilitiesSummary as getRuntimeCapabilitiesSummaryFromRemoteServers } from "./tauriRemoteServers";
import {
  cancelRuntimeRun,
  getRuntimeRunV2,
  subscribeRuntimeRunV2,
  submitRuntimeJobApprovalDecision,
  interveneRuntimeRun,
  resumeRuntimeRun,
  startRuntimeRunV2,
} from "./tauriRuntimeJobs";
import { getInstructionSkill, getSkillsList } from "./tauriSkills";
import { getRuntimeCapabilitiesSummary as getRuntimeCapabilitiesSummaryFromThreads } from "./tauriThreads";
import { openRuntimeTerminalSession } from "./tauriRuntimeTerminal";
import { localUsageSnapshot } from "./tauriUsage";
import {
  sendSubAgentInstruction,
  spawnSubAgentSession,
  waitSubAgentSession,
} from "./tauriRuntimeSubAgents";
import { listWorkspaces } from "./tauriWorkspaceCatalog";
import { isWorkspacePathDir, pickWorkspacePath, pickWorkspacePaths } from "./tauriWorkspaceDialogs";
import {
  getCollaborationModes as getCollaborationModesBridge,
  getConfigModel as getConfigModelBridge,
} from "../../../services/desktopHostRpc";
import { setMenuAccelerators as setMenuAcceleratorsBridge } from "../../../services/desktopHostCommands";
import { sendNotification as sendNotificationBridge } from "../../../services/tauriNotificationsBridge";
import { getMissionControlSnapshot as getMissionControlSnapshotBridge } from "../../../services/tauriRuntimeMissionControlBridge";
import {
  getInstructionSkill as getInstructionSkillBridge,
  getModelList as getModelListBridge,
  getSkillsList as getSkillsListBridge,
} from "../../../services/tauriRuntimeCatalogBridge";
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
} from "../../../services/tauriOauthBridge";
import {
  getRuntimeCapabilitiesSummary as getRuntimeCapabilitiesSummaryBridge,
  getRuntimeHealth as getRuntimeHealthBridge,
} from "../../../services/tauriRuntimeSystemBridge";
import {
  cancelRuntimeRun as cancelRuntimeRunBridge,
  getRuntimeRunV2 as getRuntimeRunV2Bridge,
  subscribeRuntimeRunV2 as subscribeRuntimeRunV2Bridge,
  submitRuntimeJobApprovalDecision as submitRuntimeJobApprovalDecisionBridge,
  interveneRuntimeRun as interveneRuntimeRunBridge,
  resumeRuntimeRun as resumeRuntimeRunBridge,
  startRuntimeRunV2 as startRuntimeRunV2Bridge,
} from "../../../services/tauriRuntimeJobsBridge";
import { openRuntimeTerminalSession as openRuntimeTerminalSessionBridge } from "../../../services/tauriRuntimeSessionTerminalBridge";
import {
  sendSubAgentInstruction as sendSubAgentInstructionBridge,
  spawnSubAgentSession as spawnSubAgentSessionBridge,
  waitSubAgentSession as waitSubAgentSessionBridge,
} from "../../../services/tauriRuntimeSubAgentsBridge";
import { localUsageSnapshot as localUsageSnapshotBridge } from "../../../services/tauriRuntimeUsageBridge";
import { readWorkspaceFile as readWorkspaceFileBridge } from "../../../services/tauriRuntimeWorkspaceFilesBridge";
import { listWorkspaces as listWorkspacesBridge } from "../../../services/tauriWorkspaceBridge";
import {
  isWorkspacePathDir as isWorkspacePathDirBridge,
  pickImageFiles as pickImageFilesBridge,
  pickWorkspacePath as pickWorkspacePathBridge,
  pickWorkspacePaths as pickWorkspacePathsBridge,
} from "../../../services/tauriWorkspaceBridge";

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return collectSourceFiles(absolutePath);
    }

    if (!absolutePath.endsWith(".ts") && !absolutePath.endsWith(".tsx")) {
      return [];
    }

    if (
      absolutePath.endsWith(".test.ts") ||
      absolutePath.endsWith(".test.tsx") ||
      absolutePath.endsWith(".test.shared.tsx") ||
      absolutePath.includes(`${path.sep}test${path.sep}`)
    ) {
      return [];
    }

    return [absolutePath];
  });
}

describe("tauri runtime port contract", () => {
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
        "tauriThreads.getRuntimeCapabilitiesSummary",
        getRuntimeCapabilitiesSummaryFromThreads,
        getRuntimeCapabilitiesSummaryBridge,
      ],
      [
        "tauriRemoteServers.getRuntimeCapabilitiesSummary",
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

  it("retires the deprecated tauri compat port entirely", () => {
    const source = path.resolve(import.meta.dirname, "tauri.ts");

    expect(existsSync(source)).toBe(false);
  });

  it("keeps active renderer source off tauri-named runtime ports", () => {
    const appSourceRoot = path.resolve(import.meta.dirname, "../../..");
    const offenders = collectSourceFiles(appSourceRoot)
      .filter(
        (filePath) =>
          !filePath.includes(`${path.sep}application${path.sep}runtime${path.sep}ports${path.sep}`)
      )
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return /application\/runtime\/ports\/tauri[A-Z][A-Za-z]+/.test(source);
      })
      .map((filePath) => path.relative(appSourceRoot, filePath))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps canonical runtime ports off tauri-named wrappers and bridge modules", () => {
    const runtimePortsRoot = path.resolve(import.meta.dirname);
    const offenders = collectSourceFiles(runtimePortsRoot)
      .filter((filePath) => !filePath.includes(`${path.sep}packageCompat${path.sep}`))
      .filter((filePath) => !path.basename(filePath).startsWith("tauri"))
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return (
          /from\s+["']\.\/tauri[A-Z][A-Za-z]+["']/.test(source) ||
          /from\s+["']\.\.\/\.\.\/\.\.\/services\/tauri[A-Z][A-Za-z]+Bridge["']/.test(source)
        );
      })
      .map((filePath) => path.relative(runtimePortsRoot, filePath))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("retires the deprecated tauri service barrel entirely", () => {
    const source = path.resolve(import.meta.dirname, "../../../services/tauri.ts");

    expect(existsSync(source)).toBe(false);
  });

  it("keeps raw kernel ports off the legacy tauri service type surface", () => {
    const runtimeKernelPortSources = [
      "tauriRuntimeGit.ts",
      "tauriRuntimeJobs.ts",
      "tauriRuntimeWorkspaceFiles.ts",
    ] as const;

    for (const fileName of runtimeKernelPortSources) {
      const source = readFileSync(path.resolve(import.meta.dirname, fileName), "utf8");

      expect(source, `${fileName} should not import legacy tauri service types`).not.toMatch(
        /from\s+["']\.\.\/\.\.\/\.\.\/services\/tauri["']/
      );
    }
  });

  it("keeps tauriRemoteServers off the deprecated tauri aggregation port for runtime server controls", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "tauriRemoteServers.ts"), "utf8");

    expect(source).not.toMatch(
      /acpIntegrationProbe[\s\S]*acpIntegrationsList[\s\S]*acpIntegrationRemove[\s\S]*acpIntegrationSetState[\s\S]*acpIntegrationUpsert[\s\S]*getBackendPoolBootstrapPreview[\s\S]*getBackendPoolDiagnostics[\s\S]*orbitConnectTest[\s\S]*orbitRunnerStart[\s\S]*orbitRunnerStatus[\s\S]*orbitRunnerStop[\s\S]*orbitSignInPoll[\s\S]*orbitSignInStart[\s\S]*orbitSignOut[\s\S]*netbirdDaemonCommandPreview[\s\S]*netbirdStatus[\s\S]*runtimeBackendRemove[\s\S]*runtimeBackendSetState[\s\S]*runtimeBackendsList[\s\S]*runtimeBackendUpsert[\s\S]*tailscaleDaemonCommandPreview[\s\S]*tailscaleDaemonStart[\s\S]*tailscaleDaemonStatus[\s\S]*tailscaleDaemonStop[\s\S]*tailscaleStatus[\s\S]*from\s+["']\.\/tauri["']/
    );
  });

  it("does not expose workspace catalog reads from tauriRemoteServers", () => {
    const remoteServersSource = readFileSync(
      path.resolve(import.meta.dirname, "tauriRemoteServers.ts"),
      "utf8"
    );

    expect(remoteServersSource).not.toMatch(/export\s*\{\s*listWorkspaces\s*\}\s*from/);
  });

  it("retires tauri leaf aliases that only mirrored canonical desktop ports", () => {
    const retiredLeafPortSources = ["tauriApps.ts", "tauriAppSettings.ts"] as const;

    for (const fileName of retiredLeafPortSources) {
      expect(() => readFileSync(path.resolve(import.meta.dirname, fileName), "utf8")).toThrow();
    }
  });

  it("keeps leaf ports off the deprecated tauri aggregation port", () => {
    const leafPortSources = [
      "tauriCollaboration.ts",
      "tauriFiles.ts",
      "tauriMenu.ts",
      "tauriModels.ts",
      "tauriNotifications.ts",
      "tauriSkills.ts",
      "tauriUsage.ts",
      "tauriWorkspaceDialogs.ts",
    ] as const;

    for (const fileName of leafPortSources) {
      const source = readFileSync(path.resolve(import.meta.dirname, fileName), "utf8");

      expect(source, `${fileName} should not import deprecated tauri compat exports`).not.toMatch(
        /from\s+["']\.\/tauri["']/
      );
    }
  });

  it("keeps tauriRuntimeJobs off the deprecated tauri aggregation port", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "tauriRuntimeJobs.ts"), "utf8");

    expect(source).not.toMatch(/from\s+["']\.\/tauri["']/);
  });

  it("keeps workspace client runtime bindings on kernel jobs instead of legacy runtime runs", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../kernel/createWorkspaceClientRuntimeBindings.ts"),
      "utf8"
    );

    expect(source).toMatch(/from\s+["']\.\.\/ports\/runtimeJobs["']/);
    expect(source).not.toMatch(/from\s+["']\.\.\/ports\/tauriRuntimeRuns["']/);
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

  it("retires tauriRuntimeRuns in favor of kernel jobs and mission-control projections", () => {
    const source = path.resolve(import.meta.dirname, "tauriRuntimeRuns.ts");

    expect(() => readFileSync(source, "utf8")).toThrow();
  });

  it("keeps tauriThreads off legacy runtime run controls", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "tauriThreads.ts"), "utf8");

    expect(source).not.toMatch(/cancelRuntimeRun/);
    expect(source).not.toMatch(/listRuntimeRuns/);
    expect(source).not.toMatch(/startRuntimeRun/);
    expect(source).not.toMatch(/subscribeRuntimeRun/);
    expect(source).not.toMatch(/\.\/tauriRuntimeRuns/);
  });

  it("keeps tauriWorkspaceCatalog off the deprecated tauri aggregation port", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "tauriWorkspaceCatalog.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']\.\/tauri["']/);
  });

  it("keeps tauriOauth off the deprecated tauri aggregation port", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "tauriOauth.ts"), "utf8");

    expect(source).not.toMatch(/from\s+["']\.\/tauri["']/);
  });

  it("retires tauriCodex in favor of oauth and codex operations ports", () => {
    const source = path.resolve(import.meta.dirname, "tauriCodex.ts");

    expect(() => readFileSync(source, "utf8")).toThrow();
  });
});
