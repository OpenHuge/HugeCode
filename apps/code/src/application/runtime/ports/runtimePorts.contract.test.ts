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

  it("retires tauri-named runtime port wrappers entirely", () => {
    const runtimePortsRoot = path.resolve(import.meta.dirname);
    const tauriCompatFiles = readdirSync(runtimePortsRoot)
      .filter((entry) => entry.startsWith("tauri"))
      .filter((entry) => entry.endsWith(".ts"))
      .sort();

    expect(tauriCompatFiles).toEqual([]);
  });

  it("retires the deprecated tauri service barrel entirely", () => {
    const source = path.resolve(import.meta.dirname, "../../../services/tauri.ts");

    expect(existsSync(source)).toBe(false);
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

  it("retires tauriRuntimeRuns in favor of kernel jobs and mission-control projections", () => {
    const source = path.resolve(import.meta.dirname, "tauriRuntimeRuns.ts");

    expect(existsSync(source)).toBe(false);
  });
});
