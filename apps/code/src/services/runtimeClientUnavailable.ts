import type { RuntimeClient as SharedRuntimeClient } from "@ku0/code-runtime-client/runtimeClientTypes";
import type { AppSettings } from "../types";

type RuntimeClient = SharedRuntimeClient<AppSettings>;

type RejectUnavailableFn = <T>(operation: string) => Promise<T>;

export function createUnavailableRuntimeClient(
  rejectUnavailable: RejectUnavailableFn
): RuntimeClient {
  return {
    health() {
      return rejectUnavailable("health check");
    },
    workspaces() {
      return rejectUnavailable("list workspaces");
    },
    missionControlSnapshotV1() {
      return rejectUnavailable("read mission control snapshot");
    },
    workspacePickDirectory() {
      return rejectUnavailable("pick workspace directory");
    },
    workspaceCreate() {
      return rejectUnavailable("create workspace");
    },
    workspaceRename() {
      return rejectUnavailable("rename workspace");
    },
    workspaceRemove() {
      return rejectUnavailable("remove workspace");
    },
    workspaceFiles() {
      return rejectUnavailable("list workspace files");
    },
    workspaceFileRead() {
      return rejectUnavailable("read workspace file");
    },
    gitChanges() {
      return rejectUnavailable("list git changes");
    },
    gitLog() {
      return rejectUnavailable("read git log");
    },
    gitDiffRead() {
      return rejectUnavailable("read git diff");
    },
    gitBranches() {
      return rejectUnavailable("list git branches");
    },
    gitBranchCreate() {
      return rejectUnavailable("create git branch");
    },
    gitBranchCheckout() {
      return rejectUnavailable("checkout git branch");
    },
    gitStageChange() {
      return rejectUnavailable("stage git change");
    },
    gitStageAll() {
      return rejectUnavailable("stage all git changes");
    },
    gitUnstageChange() {
      return rejectUnavailable("unstage git change");
    },
    gitRevertChange() {
      return rejectUnavailable("revert git change");
    },
    gitCommit() {
      return rejectUnavailable("commit git changes");
    },
    promptLibrary() {
      return rejectUnavailable("list prompt library");
    },
    promptLibraryCreate() {
      return rejectUnavailable("create prompt library item");
    },
    promptLibraryUpdate() {
      return rejectUnavailable("update prompt library item");
    },
    promptLibraryDelete() {
      return rejectUnavailable("delete prompt library item");
    },
    promptLibraryMove() {
      return rejectUnavailable("move prompt library item");
    },
    threads() {
      return rejectUnavailable("list threads");
    },
    createThread() {
      return rejectUnavailable("create thread");
    },
    resumeThread() {
      return rejectUnavailable("resume thread");
    },
    archiveThread() {
      return rejectUnavailable("archive thread");
    },
    threadLiveSubscribe() {
      return rejectUnavailable("subscribe thread live updates");
    },
    threadLiveUnsubscribe() {
      return rejectUnavailable("unsubscribe thread live updates");
    },
    sendTurn() {
      return rejectUnavailable("send turn");
    },
    interruptTurn() {
      return rejectUnavailable("interrupt turn");
    },
    runtimeRunPrepareV2() {
      return rejectUnavailable("prepare runtime run v2");
    },
    runtimeRunStart() {
      return rejectUnavailable("start runtime run");
    },
    runtimeRunStartV2() {
      return rejectUnavailable("start runtime run v2");
    },
    runtimeRunGetV2() {
      return rejectUnavailable("read runtime run v2");
    },
    runtimeRunIntervene() {
      return rejectUnavailable("intervene runtime run");
    },
    runtimeRunInterveneV2() {
      return rejectUnavailable("intervene runtime run v2");
    },
    runtimeRunCancel() {
      return rejectUnavailable("cancel runtime run");
    },
    runtimeRunResume() {
      return rejectUnavailable("resume runtime run");
    },
    runtimeRunResumeV2() {
      return rejectUnavailable("resume runtime run v2");
    },
    runtimeRunSubscribe() {
      return rejectUnavailable("subscribe runtime run");
    },
    runtimeRunSubscribeV2() {
      return rejectUnavailable("subscribe runtime run v2");
    },
    runtimeReviewGetV2() {
      return rejectUnavailable("read runtime review v2");
    },
    runtimeRunsList() {
      return rejectUnavailable("list runtime runs");
    },
    kernelJobStartV3() {
      return rejectUnavailable("start kernel job v3");
    },
    kernelJobGetV3() {
      return rejectUnavailable("read kernel job v3");
    },
    kernelJobCancelV3() {
      return rejectUnavailable("cancel kernel job v3");
    },
    kernelJobResumeV3() {
      return rejectUnavailable("resume kernel job v3");
    },
    kernelJobInterveneV3() {
      return rejectUnavailable("intervene kernel job v3");
    },
    kernelJobSubscribeV3() {
      return rejectUnavailable("subscribe kernel job v3");
    },
    kernelJobCallbackRegisterV3() {
      return rejectUnavailable("register kernel job callback v3");
    },
    kernelJobCallbackRemoveV3() {
      return rejectUnavailable("remove kernel job callback v3");
    },
    subAgentSpawn() {
      return rejectUnavailable("spawn sub-agent session");
    },
    subAgentSend() {
      return rejectUnavailable("send sub-agent instruction");
    },
    subAgentWait() {
      return rejectUnavailable("wait sub-agent session");
    },
    subAgentStatus() {
      return rejectUnavailable("read sub-agent session status");
    },
    subAgentInterrupt() {
      return rejectUnavailable("interrupt sub-agent session");
    },
    subAgentClose() {
      return rejectUnavailable("close sub-agent session");
    },
    runtimeRunCheckpointApproval() {
      return rejectUnavailable("checkpoint runtime run approval");
    },
    runtimeToolPreflightV2() {
      return rejectUnavailable("evaluate runtime tool preflight v2");
    },
    actionRequiredSubmitV2() {
      return rejectUnavailable("submit action-required decision v2");
    },
    actionRequiredGetV2() {
      return rejectUnavailable("read action-required state v2");
    },
    runtimeToolOutcomeRecordV2() {
      return rejectUnavailable("record runtime tool outcome v2");
    },
    runtimePolicyGetV2() {
      return rejectUnavailable("read runtime policy v2");
    },
    runtimePolicySetV2() {
      return rejectUnavailable("set runtime policy v2");
    },
    kernelCapabilitiesListV2() {
      return rejectUnavailable("list kernel capabilities v2");
    },
    kernelSessionsListV2() {
      return rejectUnavailable("list kernel sessions v2");
    },
    kernelJobsListV2() {
      return rejectUnavailable("list kernel jobs v2");
    },
    kernelContextSnapshotV2() {
      return rejectUnavailable("snapshot kernel context v2");
    },
    kernelExtensionsListV2() {
      return rejectUnavailable("list kernel extensions v2");
    },
    kernelPoliciesEvaluateV2() {
      return rejectUnavailable("evaluate kernel policies v2");
    },
    kernelProjectionBootstrapV3() {
      return rejectUnavailable("bootstrap kernel projection v3");
    },
    acpIntegrationsList() {
      return rejectUnavailable("list ACP integrations");
    },
    acpIntegrationUpsert() {
      return rejectUnavailable("upsert ACP integration");
    },
    acpIntegrationRemove() {
      return rejectUnavailable("remove ACP integration");
    },
    acpIntegrationSetState() {
      return rejectUnavailable("set ACP integration state");
    },
    acpIntegrationProbe() {
      return rejectUnavailable("probe ACP integration");
    },
    runtimeBackendsList() {
      return rejectUnavailable("list runtime backends");
    },
    runtimeBackendUpsert() {
      return rejectUnavailable("upsert runtime backend");
    },
    runtimeBackendRemove() {
      return rejectUnavailable("remove runtime backend");
    },
    runtimeBackendSetState() {
      return rejectUnavailable("set runtime backend state");
    },
    codexExecRunV1() {
      return rejectUnavailable("run codex exec");
    },
    codexCloudTasksListV1() {
      return rejectUnavailable("list codex cloud tasks");
    },
    codexConfigPathGetV1() {
      return rejectUnavailable("get codex config path");
    },
    codexDoctorV1() {
      return rejectUnavailable("run codex doctor");
    },
    codexUpdateV1() {
      return rejectUnavailable("run codex update");
    },
    collaborationModesListV1() {
      return rejectUnavailable("list collaboration modes");
    },
    mcpServerStatusListV1() {
      return rejectUnavailable("list mcp server status");
    },
    browserDebugStatusV1() {
      return rejectUnavailable("read browser debug status");
    },
    browserDebugRunV1() {
      return rejectUnavailable("run browser debug operation");
    },
    extensionCatalogListV2() {
      return rejectUnavailable("list runtime extension catalog");
    },
    extensionGetV2() {
      return rejectUnavailable("read runtime extension");
    },
    extensionInstallV2() {
      return rejectUnavailable("install runtime extension v2");
    },
    extensionUpdateV2() {
      return rejectUnavailable("update runtime extension v2");
    },
    extensionSetStateV2() {
      return rejectUnavailable("set runtime extension state v2");
    },
    extensionRemoveV2() {
      return rejectUnavailable("remove runtime extension v2");
    },
    extensionRegistrySearchV2() {
      return rejectUnavailable("search runtime extension registry");
    },
    extensionRegistrySourcesV2() {
      return rejectUnavailable("list runtime extension registry sources");
    },
    extensionPermissionsEvaluateV2() {
      return rejectUnavailable("evaluate runtime extension permissions");
    },
    extensionHealthReadV2() {
      return rejectUnavailable("read runtime extension health");
    },
    extensionUiAppsListV2() {
      return rejectUnavailable("list runtime extension ui apps");
    },
    workspaceDiagnosticsListV1() {
      return rejectUnavailable("list workspace diagnostics");
    },
    workspacePatchApplyV1() {
      return rejectUnavailable("apply workspace patch");
    },
    extensionToolsListV2() {
      return rejectUnavailable("list runtime extension tools");
    },
    extensionResourceReadV2() {
      return rejectUnavailable("read runtime extension resource");
    },
    sessionExportV1() {
      return rejectUnavailable("export runtime session");
    },
    sessionImportV1() {
      return rejectUnavailable("import runtime session");
    },
    sessionDeleteV1() {
      return rejectUnavailable("delete runtime session");
    },
    threadSnapshotsGetV1() {
      return rejectUnavailable("read persisted runtime thread snapshots");
    },
    threadSnapshotsSetV1() {
      return rejectUnavailable("write persisted runtime thread snapshots");
    },
    securityPreflightV1() {
      return rejectUnavailable("evaluate runtime security preflight");
    },
    runtimeDiagnosticsExportV1() {
      return rejectUnavailable("export runtime diagnostics package");
    },
    distributedTaskGraph() {
      return rejectUnavailable("read distributed task graph");
    },
    runtimeToolMetricsRecord() {
      return rejectUnavailable("record runtime tool metrics");
    },
    runtimeToolMetricsRead(_query: unknown) {
      return rejectUnavailable("read runtime tool metrics");
    },
    runtimeToolMetricsReset() {
      return rejectUnavailable("reset runtime tool metrics");
    },
    runtimeToolGuardrailEvaluate() {
      return rejectUnavailable("evaluate runtime tool guardrails");
    },
    runtimeToolGuardrailRecordOutcome() {
      return rejectUnavailable("record runtime tool guardrail outcome");
    },
    runtimeToolGuardrailRead() {
      return rejectUnavailable("read runtime tool guardrail state");
    },
    models() {
      return rejectUnavailable("list model pool");
    },
    providersCatalog() {
      return rejectUnavailable("list runtime provider catalog");
    },
    remoteStatus() {
      return rejectUnavailable("get remote status");
    },
    terminalStatus() {
      return rejectUnavailable("get terminal status");
    },
    terminalOpen() {
      return rejectUnavailable("open terminal session");
    },
    terminalWrite() {
      return rejectUnavailable("write terminal session");
    },
    terminalInputRaw() {
      return rejectUnavailable("send raw terminal input");
    },
    terminalRead() {
      return rejectUnavailable("read terminal session");
    },
    terminalStreamStart() {
      return rejectUnavailable("start terminal stream");
    },
    terminalStreamStop() {
      return rejectUnavailable("stop terminal stream");
    },
    terminalInterrupt() {
      return rejectUnavailable("interrupt terminal session");
    },
    terminalResize() {
      return rejectUnavailable("resize terminal session");
    },
    terminalClose() {
      return rejectUnavailable("close terminal session");
    },
    cliSessions() {
      return rejectUnavailable("list local cli sessions");
    },
    oauthAccounts() {
      return rejectUnavailable("list oauth accounts");
    },
    oauthUpsertAccount() {
      return rejectUnavailable("upsert oauth account");
    },
    oauthRemoveAccount() {
      return rejectUnavailable("remove oauth account");
    },
    oauthPrimaryAccountGet() {
      return rejectUnavailable("get oauth primary account");
    },
    oauthPrimaryAccountSet() {
      return rejectUnavailable("set oauth primary account");
    },
    oauthPools() {
      return rejectUnavailable("list oauth pools");
    },
    oauthUpsertPool() {
      return rejectUnavailable("upsert oauth pool");
    },
    oauthRemovePool() {
      return rejectUnavailable("remove oauth pool");
    },
    oauthPoolMembers() {
      return rejectUnavailable("list oauth pool members");
    },
    oauthApplyPool() {
      return rejectUnavailable("apply oauth pool");
    },
    oauthReplacePoolMembers() {
      return rejectUnavailable("replace oauth pool members");
    },
    oauthSelectPoolAccount() {
      return rejectUnavailable("select oauth pool account");
    },
    oauthBindPoolAccount() {
      return rejectUnavailable("bind oauth pool account");
    },
    oauthReportRateLimit() {
      return rejectUnavailable("report oauth account rate limit");
    },
    oauthChatgptAuthTokensRefresh() {
      return rejectUnavailable("refresh oauth chatgpt auth tokens");
    },
    oauthCodexLoginStart() {
      return rejectUnavailable("start codex oauth login");
    },
    oauthCodexLoginCancel() {
      return rejectUnavailable("cancel codex oauth login");
    },
    oauthCodexAccountsImportFromCockpitTools() {
      return rejectUnavailable("import cockpit-tools codex accounts");
    },
    liveSkills() {
      return rejectUnavailable("list live skills");
    },
    runLiveSkill() {
      return rejectUnavailable("run live skill");
    },
    appSettingsGet() {
      return rejectUnavailable("read app settings");
    },
    appSettingsUpdate() {
      return rejectUnavailable("update app settings");
    },
    settings() {
      return rejectUnavailable("read settings");
    },
    bootstrap() {
      return rejectUnavailable("runtime bootstrap");
    },
  };
}
