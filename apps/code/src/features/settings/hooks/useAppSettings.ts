import { themeModes } from "@ku0/design-system";
import { normalizeActiveIntentContextByWorkspaceId } from "@ku0/code-platform-interfaces";
import { useSharedAppSettingsState } from "@ku0/code-workspace-client/settings-state";
import { useCallback } from "react";
import { createDefaultRemoteServerProfile } from "../../../application/runtime/facades/runtimeRemoteServerProfilesFacade";
import { runCodexDoctor } from "../../../application/runtime/ports/codexOperations";
import type {
  AppSettings,
  RemoteBackendProfile,
  WorkspaceAgentControlPersistedState,
} from "../../../types";
import { DEFAULT_COMMIT_MESSAGE_PROMPT } from "../../../utils/commitMessagePrompt";
import {
  CODE_FONT_SIZE_DEFAULT,
  clampCodeFontSize,
  DEFAULT_CODE_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
  normalizeFontFamily,
} from "../../../utils/fonts";
import { isMobilePlatform } from "../../../utils/platformPaths";
import { readSafeLocalStorageItem } from "../../../utils/safeLocalStorage";
import { getDefaultInterruptShortcut, isMacPlatform } from "../../../utils/shortcuts";
import { clampUiScale, UI_SCALE_DEFAULT } from "../../../utils/uiScale";
import {
  DEFAULT_OPEN_APP_ID,
  DEFAULT_OPEN_APP_TARGETS,
  OPEN_APP_STORAGE_KEY,
} from "../../app/constants";
import { normalizeOpenAppTargets } from "../../app/utils/openApp";

const allowedThemes = new Set<string>(themeModes);
const allowedPersonality = new Set(["friendly", "pragmatic"]);

type LegacyRemoteSettingsSnapshot = {
  remoteBackendProvider?: unknown;
  remoteBackendHost?: unknown;
  remoteBackendToken?: unknown;
  orbitWsUrl?: unknown;
  orbitAuthUrl?: unknown;
  orbitRunnerName?: unknown;
  orbitUseAccess?: unknown;
  orbitAccessClientId?: unknown;
  orbitAccessClientSecretRef?: unknown;
};

function normalizeDefaultAccessMode(value: unknown): AppSettings["defaultAccessMode"] {
  if (value === "read-only" || value === "full-access" || value === "on-request") {
    return value;
  }
  if (value === "current") {
    return "full-access";
  }
  return "full-access";
}

function normalizeComposerExecutionMode(
  value: unknown
): Exclude<AppSettings["lastComposerExecutionMode"], undefined> {
  if (value === "runtime" || value === "local-cli" || value === "hybrid") {
    return value;
  }
  if (value === "local_cli") {
    return "local-cli";
  }
  return null;
}

function normalizeComposerModelSelectionMode(
  value: unknown
): Exclude<AppSettings["composerModelSelectionMode"], undefined> {
  return value === "manual" ? "manual" : "auto";
}

function normalizeModelProviderFamilyId(
  value: unknown
): Exclude<AppSettings["lastComposerProviderFamilyId"], undefined> {
  if (value === "codex" || value === "claude" || value === "gemini" || value === "antigravity") {
    return value;
  }
  return null;
}

function normalizeLastActiveWorkspaceId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function normalizeWorkspaceAgentControlState(
  value: unknown
): WorkspaceAgentControlPersistedState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  return {
    readOnlyMode:
      typeof record.readOnlyMode === "boolean"
        ? record.readOnlyMode
        : record.read_only_mode === true
          ? true
          : record.read_only_mode === false
            ? false
            : null,
    requireUserApproval:
      typeof record.requireUserApproval === "boolean"
        ? record.requireUserApproval
        : record.require_user_approval === true
          ? true
          : record.require_user_approval === false
            ? false
            : null,
    webMcpAutoExecuteCalls:
      typeof record.webMcpAutoExecuteCalls === "boolean"
        ? record.webMcpAutoExecuteCalls
        : record.web_mcp_auto_execute_calls === true
          ? true
          : record.web_mcp_auto_execute_calls === false
            ? false
            : null,
  };
}

function normalizeWorkspaceAgentControlByWorkspaceId(
  value: unknown
): Exclude<AppSettings["workspaceAgentControlByWorkspaceId"], undefined> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const normalized: Record<string, WorkspaceAgentControlPersistedState> = {};
  for (const [workspaceId, entry] of Object.entries(value as Record<string, unknown>)) {
    const trimmedWorkspaceId = workspaceId.trim();
    if (!trimmedWorkspaceId) {
      continue;
    }
    const normalizedEntry = normalizeWorkspaceAgentControlState(entry);
    if (!normalizedEntry) {
      continue;
    }
    normalized[trimmedWorkspaceId] = normalizedEntry;
  }
  return normalized;
}

function normalizeRemoteBackendProfiles(
  value: unknown
): Exclude<AppSettings["remoteBackendProfiles"], undefined> {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: RemoteBackendProfile[] = [];
  const normalizeGatewayPath = (raw: string): string => {
    const trimmed = raw.trim();
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  };
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) {
      continue;
    }
    const provider = record.provider === "orbit" ? "orbit" : "tcp";
    const tcpOverlay =
      record.tcpOverlay === "netbird"
        ? "netbird"
        : record.tcp_overlay === "netbird"
          ? "netbird"
          : "tailscale";
    const gatewayConfigRecord =
      record.gatewayConfig && typeof record.gatewayConfig === "object"
        ? (record.gatewayConfig as Record<string, unknown>)
        : null;
    normalized.push({
      id,
      label:
        typeof record.label === "string" && record.label.trim().length > 0
          ? record.label.trim()
          : id,
      provider,
      tcpOverlay,
      host: typeof record.host === "string" && record.host.trim().length > 0 ? record.host : null,
      token:
        typeof record.token === "string" && record.token.trim().length > 0 ? record.token : null,
      gatewayConfig: gatewayConfigRecord
        ? {
            httpBaseUrl:
              typeof gatewayConfigRecord.httpBaseUrl === "string" &&
              gatewayConfigRecord.httpBaseUrl.trim().length > 0
                ? gatewayConfigRecord.httpBaseUrl.trim().replace(/\/+$/u, "")
                : null,
            wsBaseUrl:
              typeof gatewayConfigRecord.wsBaseUrl === "string" &&
              gatewayConfigRecord.wsBaseUrl.trim().length > 0
                ? gatewayConfigRecord.wsBaseUrl.trim().replace(/\/+$/u, "")
                : null,
            authMode:
              gatewayConfigRecord.authMode === "none" || gatewayConfigRecord.authMode === "token"
                ? gatewayConfigRecord.authMode
                : "none",
            tokenRef:
              typeof gatewayConfigRecord.tokenRef === "string" &&
              gatewayConfigRecord.tokenRef.trim().length > 0
                ? gatewayConfigRecord.tokenRef.trim()
                : null,
            healthcheckPath:
              typeof gatewayConfigRecord.healthcheckPath === "string" &&
              gatewayConfigRecord.healthcheckPath.trim().length > 0
                ? normalizeGatewayPath(gatewayConfigRecord.healthcheckPath)
                : null,
            enabled: gatewayConfigRecord.enabled !== false,
          }
        : null,
      orbitWsUrl:
        typeof record.orbitWsUrl === "string" && record.orbitWsUrl.trim().length > 0
          ? record.orbitWsUrl
          : null,
      orbitAuthUrl:
        typeof record.orbitAuthUrl === "string" && record.orbitAuthUrl.trim().length > 0
          ? record.orbitAuthUrl
          : null,
      orbitRunnerName:
        typeof record.orbitRunnerName === "string" && record.orbitRunnerName.trim().length > 0
          ? record.orbitRunnerName
          : null,
      orbitUseAccess: Boolean(record.orbitUseAccess),
      orbitAccessClientId:
        typeof record.orbitAccessClientId === "string" &&
        record.orbitAccessClientId.trim().length > 0
          ? record.orbitAccessClientId
          : null,
      orbitAccessClientSecretRef:
        typeof record.orbitAccessClientSecretRef === "string" &&
        record.orbitAccessClientSecretRef.trim().length > 0
          ? record.orbitAccessClientSecretRef
          : null,
    });
  }
  return normalized;
}

function normalizeLegacyRemoteProvider(value: unknown): RemoteBackendProfile["provider"] {
  return value === "orbit" ? "orbit" : "tcp";
}

function migrateLegacyRemoteProfile(settings: AppSettings): RemoteBackendProfile | null {
  const legacy = settings as AppSettings & LegacyRemoteSettingsSnapshot;
  const legacyKeys = [
    "remoteBackendProvider",
    "remoteBackendHost",
    "remoteBackendToken",
    "orbitWsUrl",
    "orbitAuthUrl",
    "orbitRunnerName",
    "orbitUseAccess",
    "orbitAccessClientId",
    "orbitAccessClientSecretRef",
  ] as const;
  const hasLegacyShape = legacyKeys.some((key) => Object.hasOwn(legacy, key));
  if (!hasLegacyShape) {
    return null;
  }

  return createDefaultRemoteServerProfile({
    provider: normalizeLegacyRemoteProvider(legacy.remoteBackendProvider),
    host:
      typeof legacy.remoteBackendHost === "string" && legacy.remoteBackendHost.trim().length > 0
        ? legacy.remoteBackendHost.trim()
        : null,
    token:
      typeof legacy.remoteBackendToken === "string" && legacy.remoteBackendToken.trim().length > 0
        ? legacy.remoteBackendToken.trim()
        : null,
    orbitWsUrl:
      typeof legacy.orbitWsUrl === "string" && legacy.orbitWsUrl.trim().length > 0
        ? legacy.orbitWsUrl.trim()
        : null,
    orbitAuthUrl:
      typeof legacy.orbitAuthUrl === "string" && legacy.orbitAuthUrl.trim().length > 0
        ? legacy.orbitAuthUrl.trim()
        : null,
    orbitRunnerName:
      typeof legacy.orbitRunnerName === "string" && legacy.orbitRunnerName.trim().length > 0
        ? legacy.orbitRunnerName.trim()
        : null,
    orbitUseAccess: legacy.orbitUseAccess === true,
    orbitAccessClientId:
      typeof legacy.orbitAccessClientId === "string" && legacy.orbitAccessClientId.trim().length > 0
        ? legacy.orbitAccessClientId.trim()
        : null,
    orbitAccessClientSecretRef:
      typeof legacy.orbitAccessClientSecretRef === "string" &&
      legacy.orbitAccessClientSecretRef.trim().length > 0
        ? legacy.orbitAccessClientSecretRef.trim()
        : null,
  });
}

function buildDefaultSettings(): AppSettings {
  const isMac = isMacPlatform();
  const isMobile = isMobilePlatform();
  return {
    codexBin: null,
    codexArgs: null,
    backendMode: isMobile ? "remote" : "local",
    remoteBackendProfiles: [],
    defaultRemoteBackendProfileId: null,
    defaultRemoteExecutionBackendId: null,
    orbitAutoStartRunner: false,
    keepDaemonRunningAfterAppClose: false,
    defaultAccessMode: "full-access",
    reviewDeliveryMode: "inline",
    composerModelShortcut: isMac ? "cmd+shift+m" : "ctrl+shift+m",
    composerAccessShortcut: isMac ? "cmd+shift+a" : "ctrl+shift+a",
    composerReasoningShortcut: isMac ? "cmd+shift+r" : "ctrl+shift+r",
    composerCollaborationShortcut: "shift+tab",
    interruptShortcut: getDefaultInterruptShortcut(),
    newAgentShortcut: isMac ? "cmd+n" : "ctrl+n",
    newWorktreeAgentShortcut: isMac ? "cmd+shift+n" : "ctrl+shift+n",
    newCloneAgentShortcut: isMac ? "cmd+alt+n" : "ctrl+alt+n",
    archiveThreadShortcut: isMac ? "cmd+ctrl+a" : "ctrl+alt+a",
    toggleProjectsSidebarShortcut: isMac ? "cmd+shift+p" : "ctrl+shift+p",
    toggleGitSidebarShortcut: isMac ? "cmd+shift+g" : "ctrl+shift+g",
    branchSwitcherShortcut: isMac ? "cmd+b" : "ctrl+b",
    toggleDebugPanelShortcut: isMac ? "cmd+shift+d" : "ctrl+shift+d",
    toggleTerminalShortcut: isMac ? "cmd+shift+t" : "ctrl+shift+t",
    cycleAgentNextShortcut: isMac ? "cmd+ctrl+down" : "ctrl+alt+down",
    cycleAgentPrevShortcut: isMac ? "cmd+ctrl+up" : "ctrl+alt+up",
    cycleWorkspaceNextShortcut: isMac ? "cmd+shift+down" : "ctrl+alt+shift+down",
    cycleWorkspacePrevShortcut: isMac ? "cmd+shift+up" : "ctrl+alt+shift+up",
    lastComposerModelId: null,
    lastComposerReasoningEffort: null,
    composerModelSelectionMode: "auto",
    lastComposerProviderFamilyId: null,
    lastComposerFastMode: null,
    lastComposerExecutionMode: null,
    uiScale: UI_SCALE_DEFAULT,
    theme: "system",
    usageShowRemaining: false,
    showMessageFilePath: true,
    showInternalRuntimeDiagnostics: false,
    threadTitleAutogenerationEnabled: true,
    uiFontFamily: DEFAULT_UI_FONT_FAMILY,
    codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
    codeFontSize: CODE_FONT_SIZE_DEFAULT,
    notificationSoundsEnabled: true,
    systemNotificationsEnabled: true,
    splitChatDiffView: false,
    preloadGitDiffs: true,
    gitDiffIgnoreWhitespaceChanges: false,
    commitMessagePrompt: DEFAULT_COMMIT_MESSAGE_PROMPT,
    experimentalCollabEnabled: false,
    collaborationModesEnabled: true,
    steerEnabled: true,
    unifiedExecEnabled: true,
    personality: "friendly",
    composerEditorPreset: "default",
    composerFenceExpandOnSpace: false,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: false,
    composerFenceWrapSelection: false,
    composerFenceAutoWrapPasteMultiline: false,
    composerFenceAutoWrapPasteCodeLike: false,
    composerListContinuation: false,
    composerCodeBlockCopyUseModifier: false,
    workspaceGroups: [],
    workspaceAgentControlByWorkspaceId: {},
    activeIntentContextByWorkspaceId: {},
    openAppTargets: DEFAULT_OPEN_APP_TARGETS,
    selectedOpenAppId: DEFAULT_OPEN_APP_ID,
    lastActiveWorkspaceId: null,
  };
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  const legacySettings = settings as AppSettings & LegacyRemoteSettingsSnapshot;
  const {
    remoteBackendProvider: _legacyRemoteBackendProvider,
    remoteBackendHost: _legacyRemoteBackendHost,
    remoteBackendToken: _legacyRemoteBackendToken,
    orbitWsUrl: _legacyOrbitWsUrl,
    orbitAuthUrl: _legacyOrbitAuthUrl,
    orbitRunnerName: _legacyOrbitRunnerName,
    orbitUseAccess: _legacyOrbitUseAccess,
    orbitAccessClientId: _legacyOrbitAccessClientId,
    orbitAccessClientSecretRef: _legacyOrbitAccessClientSecretRef,
    ...settingsWithoutLegacyRemoteFields
  } = legacySettings;
  const normalizedTargets = settings.openAppTargets?.length
    ? normalizeOpenAppTargets(settings.openAppTargets)
    : DEFAULT_OPEN_APP_TARGETS;
  const storedOpenAppId = readSafeLocalStorageItem(OPEN_APP_STORAGE_KEY);
  const hasPersistedSelection = normalizedTargets.some(
    (target) => target.id === settings.selectedOpenAppId
  );
  const hasStoredSelection =
    !hasPersistedSelection &&
    storedOpenAppId !== null &&
    normalizedTargets.some((target) => target.id === storedOpenAppId);
  const selectedOpenAppId = hasPersistedSelection
    ? settings.selectedOpenAppId
    : hasStoredSelection
      ? storedOpenAppId
      : (normalizedTargets[0]?.id ?? DEFAULT_OPEN_APP_ID);
  const commitMessagePrompt =
    settings.commitMessagePrompt && settings.commitMessagePrompt.trim().length > 0
      ? settings.commitMessagePrompt
      : DEFAULT_COMMIT_MESSAGE_PROMPT;
  const normalizedProfiles = normalizeRemoteBackendProfiles(settings.remoteBackendProfiles);
  const migratedLegacyProfile =
    normalizedProfiles.length === 0 ? migrateLegacyRemoteProfile(settings) : null;
  const remoteBackendProfiles =
    normalizedProfiles.length > 0
      ? normalizedProfiles
      : [migratedLegacyProfile ?? createDefaultRemoteServerProfile()];
  const defaultRemoteBackendProfileId =
    typeof settings.defaultRemoteBackendProfileId === "string" &&
    settings.defaultRemoteBackendProfileId.trim().length > 0 &&
    remoteBackendProfiles.some((profile) => profile.id === settings.defaultRemoteBackendProfileId)
      ? settings.defaultRemoteBackendProfileId.trim()
      : (remoteBackendProfiles[0]?.id ?? null);
  return {
    ...settingsWithoutLegacyRemoteFields,
    codexBin: settings.codexBin?.trim() ? settings.codexBin.trim() : null,
    codexArgs: settings.codexArgs?.trim() ? settings.codexArgs.trim() : null,
    uiScale: clampUiScale(settings.uiScale),
    theme: allowedThemes.has(settings.theme) ? settings.theme : "system",
    uiFontFamily: normalizeFontFamily(settings.uiFontFamily, DEFAULT_UI_FONT_FAMILY),
    codeFontFamily: normalizeFontFamily(settings.codeFontFamily, DEFAULT_CODE_FONT_FAMILY),
    codeFontSize: clampCodeFontSize(settings.codeFontSize),
    personality: allowedPersonality.has(settings.personality) ? settings.personality : "friendly",
    defaultAccessMode: normalizeDefaultAccessMode(settings.defaultAccessMode),
    composerModelSelectionMode: normalizeComposerModelSelectionMode(
      settings.composerModelSelectionMode
    ),
    lastComposerProviderFamilyId: normalizeModelProviderFamilyId(
      settings.lastComposerProviderFamilyId
    ),
    lastComposerFastMode: normalizeOptionalBoolean(settings.lastComposerFastMode),
    lastComposerExecutionMode: normalizeComposerExecutionMode(settings.lastComposerExecutionMode),
    reviewDeliveryMode: settings.reviewDeliveryMode === "detached" ? "detached" : "inline",
    commitMessagePrompt,
    remoteBackendProfiles,
    defaultRemoteBackendProfileId,
    defaultRemoteExecutionBackendId:
      typeof settings.defaultRemoteExecutionBackendId === "string" &&
      settings.defaultRemoteExecutionBackendId.trim().length > 0
        ? settings.defaultRemoteExecutionBackendId.trim()
        : null,
    workspaceAgentControlByWorkspaceId: normalizeWorkspaceAgentControlByWorkspaceId(
      settings.workspaceAgentControlByWorkspaceId
    ),
    activeIntentContextByWorkspaceId: normalizeActiveIntentContextByWorkspaceId(
      settings.activeIntentContextByWorkspaceId
    ),
    openAppTargets: normalizedTargets,
    selectedOpenAppId,
    lastActiveWorkspaceId: normalizeLastActiveWorkspaceId(settings.lastActiveWorkspaceId),
  };
}

export function useAppSettings() {
  const { settings, setSettings, saveSettings, isLoading } = useSharedAppSettingsState<AppSettings>(
    {
      buildDefaultSettings,
      normalizeSettings: normalizeAppSettings,
    }
  );

  const doctor = useCallback(async (codexBin: string | null, codexArgs: string | null) => {
    return runCodexDoctor(codexBin, codexArgs);
  }, []);

  return {
    settings,
    setSettings,
    saveSettings,
    doctor,
    isLoading,
  };
}
