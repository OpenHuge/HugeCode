// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import {
  getProvidersCatalog,
  getOAuthPrimaryAccount,
  listOAuthAccounts,
  listOAuthPools,
  replaceOAuthPoolMembers,
  setOAuthPrimaryAccount,
  upsertOAuthPool,
} from "../../../application/runtime/ports/tauriOauth";
import { runCodexDoctor } from "../../../application/runtime/ports/tauriCodexOperations";
import type { AppSettings, WorkspaceInfo } from "../../../types";
import { useCollaborationModes } from "../../collaboration/hooks/useCollaborationModes";
import { useModels } from "../../models/hooks/useModels";
import { NO_THREAD_SCOPE_SUFFIX } from "../../threads/utils/threadCodexParamsSeed";
import { makeThreadCodexParamsKey } from "../../threads/utils/threadStorage";
import { useThreadCodexControls } from "./useThreadCodexControls";

vi.mock("../../../application/runtime/ports/runtimeClientMode", () => ({
  detectRuntimeMode: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriCodexOperations", () => ({
  runCodexDoctor: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriOauth", () => ({
  getProvidersCatalog: vi.fn(),
  getOAuthPrimaryAccount: vi.fn(),
  listOAuthAccounts: vi.fn(),
  listOAuthPools: vi.fn(),
  replaceOAuthPoolMembers: vi.fn(),
  setOAuthPrimaryAccount: vi.fn(),
  upsertOAuthPool: vi.fn(),
}));

vi.mock("../../collaboration/hooks/useCollaborationModes", () => ({
  useCollaborationModes: vi.fn(),
}));

vi.mock("../../models/hooks/useModels", () => ({
  useModels: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeAgentControl", () => ({
  useWorkspaceRuntimeAgentControl: vi.fn(),
}));

const detectRuntimeModeMock = vi.mocked(detectRuntimeMode);
const getProvidersCatalogMock = vi.mocked(getProvidersCatalog);
const getOAuthPrimaryAccountMock = vi.mocked(getOAuthPrimaryAccount);
const listOAuthAccountsMock = vi.mocked(listOAuthAccounts);
const listOAuthPoolsMock = vi.mocked(listOAuthPools);
const replaceOAuthPoolMembersMock = vi.mocked(replaceOAuthPoolMembers);
const runCodexDoctorMock = vi.mocked(runCodexDoctor);
const setOAuthPrimaryAccountMock = vi.mocked(setOAuthPrimaryAccount);
const upsertOAuthPoolMock = vi.mocked(upsertOAuthPool);
const useCollaborationModesMock = vi.mocked(useCollaborationModes);
const useModelsMock = vi.mocked(useModels);
const useWorkspaceRuntimeAgentControlMock = vi.mocked(useWorkspaceRuntimeAgentControl);

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace One",
  path: "/tmp/workspace-one",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

const appSettings = {
  codexBin: "codex",
  codexArgs: "--profile personal",
  collaborationModesEnabled: true,
  composerModelShortcut: null,
  composerAccessShortcut: null,
  composerReasoningShortcut: null,
  composerCollaborationShortcut: null,
  lastComposerModelId: null,
  lastComposerReasoningEffort: null,
  lastComposerFastMode: null,
  lastComposerExecutionMode: null,
} as AppSettings;

const modelOption = {
  id: "openai::gpt-5.3-codex",
  displayName: "GPT-5.3 Codex",
  model: "gpt-5.3-codex",
  provider: "codex",
  pool: "codex",
  description: "Primary Codex model",
  available: true,
  supportedReasoningEfforts: [],
  defaultReasoningEffort: null,
  isDefault: true,
};

function createHook(options?: {
  setAppSettings?: ReturnType<typeof vi.fn<(value: SetStateAction<AppSettings>) => void>>;
  queueSaveSettings?: ReturnType<typeof vi.fn<(next: AppSettings) => Promise<AppSettings>>>;
  patchThreadCodexParams?: ReturnType<
    typeof vi.fn<(workspaceId: string, threadId: string, patch: Record<string, unknown>) => void>
  >;
  getThreadCodexParams?: ReturnType<
    typeof vi.fn<
      (
        workspaceId: string,
        threadId: string
      ) => {
        accessMode: "read-only" | "on-request" | "full-access" | null;
        collaborationModeId: string | null;
        executionProfileId?: string | null;
        preferredBackendIds?: string[] | null;
      } | null
    >
  >;
  activeThreadId?: string | null;
  visibleActiveThreadId?: string | null;
}) {
  const setAppSettings =
    options?.setAppSettings ?? vi.fn<(value: SetStateAction<AppSettings>) => void>();
  const queueSaveSettings =
    options?.queueSaveSettings ??
    vi.fn<(next: AppSettings) => Promise<AppSettings>>().mockResolvedValue(appSettings);
  const patchThreadCodexParams =
    options?.patchThreadCodexParams ??
    vi.fn<(workspaceId: string, threadId: string, patch: Record<string, unknown>) => void>();
  const getThreadCodexParams =
    options?.getThreadCodexParams ??
    vi.fn<
      (
        workspaceId: string,
        threadId: string
      ) => {
        accessMode: "read-only" | "on-request" | "full-access" | null;
        collaborationModeId: string | null;
        executionProfileId?: string | null;
        preferredBackendIds?: string[] | null;
      } | null
    >(() => null);
  const activeThreadId = options?.activeThreadId ?? null;
  const visibleActiveThreadId = options?.visibleActiveThreadId ?? activeThreadId;
  return renderHook(() =>
    useThreadCodexControls({
      activeWorkspace: workspace,
      appSettings,
      appSettingsLoading: false,
      setAppSettings,
      queueSaveSettings,
      addDebugEntry: vi.fn(),
      composerInputRef: { current: null },
      activeWorkspaceIdForParamsRef: { current: workspace.id },
      activeThreadIdRef: { current: activeThreadId },
      visibleActiveThreadIdRef: { current: visibleActiveThreadId },
      getThreadCodexParams,
      patchThreadCodexParams,
    })
  );
}

describe("useThreadCodexControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useModelsMock.mockReturnValue({
      models: [modelOption],
      selectedModel: modelOption,
      selectedModelId: "openai::gpt-5.3-codex",
      setSelectedModelId: vi.fn(),
      reasoningSupported: false,
      reasoningOptions: [],
      selectedEffort: null,
      setSelectedEffort: vi.fn(),
      refreshModels: vi.fn().mockResolvedValue(undefined),
    });

    useCollaborationModesMock.mockReturnValue({
      collaborationModes: [],
      selectedCollaborationMode: null,
      selectedCollaborationModeId: null,
      setSelectedCollaborationModeId: vi.fn(),
      refreshCollaborationModes: vi.fn(),
    });
    getProvidersCatalogMock.mockReset();
    getOAuthPrimaryAccountMock.mockReset();
    listOAuthAccountsMock.mockReset();
    listOAuthPoolsMock.mockReset();
    replaceOAuthPoolMembersMock.mockReset();
    setOAuthPrimaryAccountMock.mockReset();
    upsertOAuthPoolMock.mockReset();
    getOAuthPrimaryAccountMock.mockResolvedValue({
      provider: "codex",
      accountId: null,
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: null,
      inSync: true,
      createdAt: 1,
      updatedAt: 1,
    });
    replaceOAuthPoolMembersMock.mockResolvedValue([]);
    setOAuthPrimaryAccountMock.mockResolvedValue({
      provider: "codex",
      accountId: null,
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: null,
      inSync: true,
      createdAt: 1,
      updatedAt: 1,
    });
    getProvidersCatalogMock.mockResolvedValue([
      {
        providerId: "openai",
        displayName: "OpenAI",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: ["openai", "codex"],
        defaultModelId: "gpt-5.3-codex",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "1",
      },
      {
        providerId: "gemini",
        displayName: "Gemini",
        pool: "gemini",
        oauthProviderId: "gemini",
        aliases: ["gemini", "google", "antigravity"],
        defaultModelId: "gemini-3.1-pro",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "1",
      },
    ]);
    upsertOAuthPoolMock.mockResolvedValue({
      poolId: "pool-codex",
      provider: "codex",
      name: "codex routing",
      strategy: "round_robin",
      stickyMode: "cache_first",
      preferredAccountId: null,
      enabled: true,
      metadata: {},
      createdAt: 1,
      updatedAt: 1,
    });
    useWorkspaceRuntimeAgentControlMock.mockReturnValue({
      runtimeBackendsList: vi.fn().mockResolvedValue([
        { backendId: "backend-remote-a", displayName: "Remote A" },
        { backendId: "backend-remote-b", displayName: "Remote B" },
      ]),
    } as never);
  });

  it("exposes hybrid and local CLI execution in runtime-gateway-web mode when Codex doctor succeeds", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });

    const { result } = createHook();

    await waitFor(() => {
      expect(result.current.executionOptions).toEqual([
        { value: "runtime", label: "Runtime" },
        { value: "hybrid", label: "Hybrid" },
        { value: "local-cli", label: "Local Codex CLI (1.2.3)" },
      ]);
    });

    expect(runCodexDoctorMock).toHaveBeenCalledWith("codex", "--profile personal");
  });

  it("keeps execution restricted to runtime when runtime mode is unavailable", async () => {
    detectRuntimeModeMock.mockReturnValue("unavailable");

    const { result } = createHook();

    await waitFor(() => {
      expect(result.current.executionMode).toBe("runtime");
      expect(result.current.executionOptions).toEqual([
        { value: "runtime", label: "Runtime" },
        {
          value: "hybrid",
          label: "Hybrid (Local Codex CLI unavailable)",
          disabled: true,
        },
        {
          value: "local-cli",
          label: "Local Codex CLI unavailable",
          disabled: true,
        },
      ]);
    });

    expect(runCodexDoctorMock).not.toHaveBeenCalled();
    expect(listOAuthAccountsMock).not.toHaveBeenCalled();
    expect(listOAuthPoolsMock).not.toHaveBeenCalled();
  });

  it("rechecks local CLI availability when runtime mode becomes available after connect", async () => {
    let runtimeMode: ReturnType<typeof detectRuntimeMode> = "unavailable";
    detectRuntimeModeMock.mockImplementation(() => runtimeMode);
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });

    const { result, rerender } = createHook();

    await waitFor(() => {
      expect(
        result.current.executionOptions.find((option) => option.value === "local-cli")
      ).toEqual({
        value: "local-cli",
        label: "Local Codex CLI unavailable",
        disabled: true,
      });
    });
    expect(runCodexDoctorMock).not.toHaveBeenCalled();

    runtimeMode = "runtime-gateway-web";
    rerender();

    await waitFor(() => {
      expect(
        result.current.executionOptions.find((option) => option.value === "local-cli")
      ).toEqual({
        value: "local-cli",
        label: "Local Codex CLI (1.2.3)",
      });
    });

    expect(runCodexDoctorMock).toHaveBeenCalledWith("codex", "--profile personal");
  });

  it("falls back to runtime while keeping CLI-backed modes disabled when Codex doctor fails", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: false,
      codexBin: "codex",
      version: null,
      appServerOk: false,
      details: "codex missing",
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const setAppSettings = vi.fn();
    const patchThreadCodexParams = vi.fn();

    const { result } = createHook({ setAppSettings, patchThreadCodexParams });

    act(() => {
      result.current.setExecutionMode("local-cli");
    });

    await waitFor(() => {
      expect(result.current.executionMode).toBe("runtime");
      expect(result.current.executionOptions).toEqual([
        { value: "runtime", label: "Runtime" },
        {
          value: "hybrid",
          label: "Hybrid (Local Codex CLI unavailable)",
          disabled: true,
        },
        {
          value: "local-cli",
          label: "Local Codex CLI unavailable",
          disabled: true,
        },
      ]);
    });

    act(() => {
      result.current.handleSelectExecutionMode("local-cli");
    });

    expect(result.current.executionMode).toBe("runtime");
    expect(setAppSettings).not.toHaveBeenCalled();
    expect(patchThreadCodexParams).not.toHaveBeenCalled();
  });

  it("persists the stable model slug for home composer defaults", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const setAppSettings = vi.fn();
    const queueSaveSettings = vi.fn().mockResolvedValue(appSettings);

    const { result } = createHook({ setAppSettings, queueSaveSettings });

    await waitFor(() => {
      expect(result.current.executionOptions.length).toBeGreaterThan(0);
    });

    result.current.handleSelectModel("openai::gpt-5.3-codex");

    expect(setAppSettings).toHaveBeenCalledTimes(1);
    const update = setAppSettings.mock.calls[0]?.[0] as (current: AppSettings) => AppSettings;
    const next = update(appSettings);
    expect(next.lastComposerModelId).toBe("gpt-5.3-codex");
    expect(queueSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastComposerModelId: "gpt-5.3-codex" })
    );
  });

  it("persists the stable model slug for thread-scoped overrides", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const patchThreadCodexParams = vi.fn();

    const { result } = createHook({
      activeThreadId: "thread-1",
      patchThreadCodexParams,
    });

    await waitFor(() => {
      expect(result.current.executionOptions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.setThreadCodexSelectionKey(
        makeThreadCodexParamsKey("workspace-1", "thread-1")
      );
    });

    result.current.handleSelectModel("openai::gpt-5.3-codex");

    expect(patchThreadCodexParams).toHaveBeenCalledWith("workspace-1", "thread-1", {
      modelId: "gpt-5.3-codex",
    });
  });

  it("persists home composer execution mode defaults", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const setAppSettings = vi.fn();
    const queueSaveSettings = vi.fn().mockResolvedValue(appSettings);

    const { result } = createHook({ setAppSettings, queueSaveSettings });

    await waitFor(() => {
      expect(
        result.current.executionOptions.find((option) => option.value === "local-cli")
      ).toEqual({
        value: "local-cli",
        label: "Local Codex CLI (1.2.3)",
      });
    });

    act(() => {
      result.current.handleSelectExecutionMode("local-cli");
    });

    expect(setAppSettings).toHaveBeenCalledTimes(1);
    const update = setAppSettings.mock.calls[0]?.[0] as (current: AppSettings) => AppSettings;
    const next = update(appSettings);
    expect(next.lastComposerExecutionMode).toBe("local-cli");
    expect(queueSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastComposerExecutionMode: "local-cli" })
    );
  });

  it("persists thread-scoped execution mode overrides", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const patchThreadCodexParams = vi.fn();

    const { result } = createHook({
      activeThreadId: "thread-1",
      patchThreadCodexParams,
    });

    await waitFor(() => {
      expect(
        result.current.executionOptions.find((option) => option.value === "local-cli")
      ).toEqual({
        value: "local-cli",
        label: "Local Codex CLI (1.2.3)",
      });
    });

    act(() => {
      result.current.setThreadCodexSelectionKey(
        makeThreadCodexParamsKey("workspace-1", "thread-1")
      );
    });

    act(() => {
      result.current.handleSelectExecutionMode("local-cli");
    });

    expect(patchThreadCodexParams).toHaveBeenCalledWith("workspace-1", "thread-1", {
      executionMode: "local-cli",
    });
  });

  it("treats home composer scope as app defaults even when a stale thread ref exists", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const setAppSettings = vi.fn();
    const queueSaveSettings = vi.fn().mockResolvedValue(appSettings);
    const patchThreadCodexParams = vi.fn();

    const { result } = createHook({
      activeThreadId: "thread-stale",
      visibleActiveThreadId: null,
      setAppSettings,
      queueSaveSettings,
      patchThreadCodexParams,
    });

    await waitFor(() => {
      expect(
        result.current.executionOptions.find((option) => option.value === "local-cli")
      ).toEqual({
        value: "local-cli",
        label: "Local Codex CLI (1.2.3)",
      });
    });

    act(() => {
      result.current.setThreadCodexSelectionKey(`workspace-1:${NO_THREAD_SCOPE_SUFFIX}`);
    });

    act(() => {
      result.current.handleSelectExecutionMode("local-cli");
      result.current.handleSelectEffort("low");
    });

    expect(setAppSettings).toHaveBeenCalledTimes(2);
    const executionUpdate = setAppSettings.mock.calls[0]?.[0] as (
      current: AppSettings
    ) => AppSettings;
    expect(executionUpdate(appSettings).lastComposerExecutionMode).toBe("local-cli");
    const effortUpdate = setAppSettings.mock.calls[1]?.[0] as (current: AppSettings) => AppSettings;
    expect(effortUpdate(appSettings).lastComposerReasoningEffort).toBe("low");
    expect(queueSaveSettings).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ lastComposerExecutionMode: "local-cli" })
    );
    expect(queueSaveSettings).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ lastComposerReasoningEffort: "low" })
    );
    expect(patchThreadCodexParams).not.toHaveBeenCalled();
  });

  it("persists fast mode to app settings for home composer scope", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const setAppSettings = vi.fn();
    const queueSaveSettings = vi.fn().mockResolvedValue(appSettings);
    const patchThreadCodexParams = vi.fn();

    const { result } = createHook({
      activeThreadId: "thread-stale",
      visibleActiveThreadId: null,
      setAppSettings,
      queueSaveSettings,
      patchThreadCodexParams,
    });

    await waitFor(() => {
      expect(result.current.executionOptions).toEqual([
        { value: "runtime", label: "Runtime" },
        { value: "hybrid", label: "Hybrid" },
        { value: "local-cli", label: "Local Codex CLI (1.2.3)" },
      ]);
    });

    act(() => {
      result.current.setThreadCodexSelectionKey(`workspace-1:${NO_THREAD_SCOPE_SUFFIX}`);
    });

    act(() => {
      result.current.handleToggleFastMode(true);
    });

    expect(setAppSettings).toHaveBeenCalledTimes(1);
    const fastModeUpdate = setAppSettings.mock.calls[0]?.[0] as (
      current: AppSettings
    ) => AppSettings;
    expect(fastModeUpdate(appSettings).lastComposerFastMode).toBe(true);
    expect(queueSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastComposerFastMode: true })
    );
    expect(patchThreadCodexParams).not.toHaveBeenCalled();
  });

  it("persists thread-scoped fast mode through thread codex params", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const patchThreadCodexParams = vi.fn();

    const { result } = createHook({
      activeThreadId: "thread-1",
      patchThreadCodexParams,
    });

    await waitFor(() => {
      expect(result.current.executionOptions).toEqual([
        { value: "runtime", label: "Runtime" },
        { value: "hybrid", label: "Hybrid" },
        { value: "local-cli", label: "Local Codex CLI (1.2.3)" },
      ]);
    });

    act(() => {
      result.current.setThreadCodexSelectionKey(
        makeThreadCodexParamsKey("workspace-1", "thread-1")
      );
    });

    act(() => {
      result.current.handleToggleFastMode(true);
    });

    expect(patchThreadCodexParams).toHaveBeenCalledWith("workspace-1", "thread-1", {
      fastMode: true,
    });
  });

  it("hydrates composer account selection from the codex primary account", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    getOAuthPrimaryAccountMock.mockResolvedValue({
      provider: "codex",
      accountId: "codex-a2",
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: "codex-a2",
      inSync: true,
      createdAt: 10,
      updatedAt: 20,
    });
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        externalAccountId: null,
        routeConfig: null,
        routingState: null,
        chatgptWorkspaces: null,
        defaultChatgptWorkspaceId: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 10,
      },
      {
        accountId: "codex-a2",
        provider: "codex",
        email: "codex-a2@example.com",
        displayName: "Codex A2",
        status: "enabled",
        disabledReason: null,
        externalAccountId: null,
        routeConfig: null,
        routingState: null,
        chatgptWorkspaces: null,
        defaultChatgptWorkspaceId: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "pool-codex",
        provider: "codex",
        name: "codex routing",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-a2",
        enabled: true,
        metadata: {},
        createdAt: 1,
        updatedAt: 20,
      },
    ]);

    const { result } = createHook();

    await waitFor(() => {
      expect(result.current.selectedAccountIds).toEqual(["codex-a2"]);
    });

    expect(getOAuthPrimaryAccountMock).toHaveBeenCalledWith("codex");
    expect(setOAuthPrimaryAccountMock).not.toHaveBeenCalled();
  });

  it("writes codex composer primary selection through oauth primary account state", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    getOAuthPrimaryAccountMock.mockResolvedValue({
      provider: "codex",
      accountId: "codex-a1",
      account: null,
      defaultPoolId: "pool-codex",
      routeAccountId: "codex-a1",
      inSync: true,
      createdAt: 10,
      updatedAt: 20,
    });
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "codex-a1",
        provider: "codex",
        email: "codex-a1@example.com",
        displayName: "Codex A1",
        status: "enabled",
        disabledReason: null,
        externalAccountId: null,
        routeConfig: null,
        routingState: null,
        chatgptWorkspaces: null,
        defaultChatgptWorkspaceId: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 10,
      },
      {
        accountId: "codex-a2",
        provider: "codex",
        email: "codex-a2@example.com",
        displayName: "Codex A2",
        status: "enabled",
        disabledReason: null,
        externalAccountId: null,
        routeConfig: null,
        routingState: null,
        chatgptWorkspaces: null,
        defaultChatgptWorkspaceId: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([
      {
        poolId: "pool-codex",
        provider: "codex",
        name: "codex routing",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-a1",
        enabled: true,
        metadata: {},
        createdAt: 1,
        updatedAt: 20,
      },
    ]);

    const { result } = createHook();

    await waitFor(() => {
      expect(result.current.selectedAccountIds).toEqual(["codex-a1"]);
    });

    act(() => {
      result.current.handleSelectAccountIds(["codex-a2", "codex-a1"]);
    });

    await waitFor(() => {
      expect(setOAuthPrimaryAccountMock).toHaveBeenLastCalledWith({
        provider: "codex",
        accountId: "codex-a2",
      });
    });
    expect(replaceOAuthPoolMembersMock).toHaveBeenLastCalledWith("pool-codex", [
      {
        accountId: "codex-a2",
        weight: 1,
        priority: 0,
        position: 0,
        enabled: true,
      },
      {
        accountId: "codex-a1",
        weight: 1,
        priority: 1,
        position: 1,
        enabled: true,
      },
    ]);
  });

  it("brands gemini routing pool names as antigravity when the selected model uses that brand", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    useModelsMock.mockReturnValue({
      models: [
        {
          ...modelOption,
          id: "google::gemini-3.1-pro::brand:antigravity",
          displayName: "Antigravity 3.1 Pro",
          model: "gemini-3.1-pro",
          provider: "antigravity",
          pool: "antigravity",
          description: "Antigravity branded model",
        },
      ],
      selectedModel: {
        ...modelOption,
        id: "google::gemini-3.1-pro::brand:antigravity",
        displayName: "Antigravity 3.1 Pro",
        model: "gemini-3.1-pro",
        provider: "antigravity",
        pool: "antigravity",
        description: "Antigravity branded model",
      },
      selectedModelId: "google::gemini-3.1-pro::brand:antigravity",
      setSelectedModelId: vi.fn(),
      reasoningSupported: false,
      reasoningOptions: [],
      selectedEffort: null,
      setSelectedEffort: vi.fn(),
      refreshModels: vi.fn().mockResolvedValue(undefined),
    });
    listOAuthAccountsMock.mockResolvedValue([
      {
        accountId: "gemini-a1",
        provider: "gemini",
        email: "gemini-a1@example.com",
        displayName: "Gemini A1",
        status: "enabled",
        disabledReason: null,
        externalAccountId: null,
        routeConfig: null,
        routingState: null,
        chatgptWorkspaces: null,
        defaultChatgptWorkspaceId: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 20,
      },
    ]);
    listOAuthPoolsMock.mockResolvedValue([]);

    createHook();

    await waitFor(() => {
      expect(upsertOAuthPoolMock).toHaveBeenCalledWith({
        poolId: "pool-gemini",
        provider: "gemini",
        name: "Antigravity routing",
        preferredAccountId: "gemini-a1",
        enabled: true,
      });
    });
  });

  it("hydrates backend options from runtime discovery and defaults to the app default backend", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const { result } = renderHook(() =>
      useThreadCodexControls({
        activeWorkspace: workspace,
        appSettings: {
          ...appSettings,
          defaultRemoteExecutionBackendId: "backend-remote-b",
        } as AppSettings,
        appSettingsLoading: false,
        setAppSettings: vi.fn(),
        queueSaveSettings: vi.fn().mockResolvedValue(appSettings),
        addDebugEntry: vi.fn(),
        composerInputRef: { current: null },
        activeWorkspaceIdForParamsRef: { current: workspace.id },
        activeThreadIdRef: { current: null },
        visibleActiveThreadIdRef: { current: null },
        getThreadCodexParams: vi.fn(() => null),
        patchThreadCodexParams: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.remoteBackendOptions).toEqual([
        { value: "backend-remote-a", label: "Remote A" },
        { value: "backend-remote-b", label: "Remote B" },
      ]);
    });

    expect(result.current.selectedRemoteBackendId).toBe("backend-remote-b");
    expect(result.current.preferredBackendIds).toEqual(["backend-remote-b"]);
  });

  it("persists thread-scoped backend overrides through preferredBackendIds", async () => {
    detectRuntimeModeMock.mockReturnValue("runtime-gateway-web");
    runCodexDoctorMock.mockResolvedValue({
      ok: true,
      codexBin: "codex",
      version: "1.2.3",
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
    });
    const patchThreadCodexParams = vi.fn();

    const { result } = createHook({
      activeThreadId: "thread-1",
      patchThreadCodexParams,
    });

    await waitFor(() => {
      expect(result.current.remoteBackendOptions).toEqual([
        { value: "backend-remote-a", label: "Remote A" },
        { value: "backend-remote-b", label: "Remote B" },
      ]);
    });

    act(() => {
      result.current.setThreadCodexSelectionKey(
        makeThreadCodexParamsKey("workspace-1", "thread-1")
      );
    });

    act(() => {
      result.current.handleSelectRemoteBackendId("backend-remote-a");
    });

    expect(patchThreadCodexParams).toHaveBeenCalledWith("workspace-1", "thread-1", {
      preferredBackendIds: ["backend-remote-a"],
    });
  });
});
