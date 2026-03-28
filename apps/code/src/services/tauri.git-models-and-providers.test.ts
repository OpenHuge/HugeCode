import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectRuntimeMode,
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  commitGit,
  fetchGit,
  getModelList,
  getProvidersCatalog,
  revertGitFile,
  stageGitAll,
  stageGitFile,
  unstageGitFile,
} from "./desktopHost";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "tauri"),
  getRuntimeClient: vi.fn(),
  readRuntimeCapabilitiesSummary: vi.fn(),
}));

describe("tauri invoke wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetWebRuntimeOauthFallbackStateForTests();
    __resetLocalUsageSnapshotCacheForTests();
    localStorage.clear();
    const invokeMock = vi.mocked(invoke);
    vi.mocked(listen).mockResolvedValue(async () => undefined);
    vi.mocked(isTauri).mockReturnValue(true);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      return undefined;
    });
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });
    vi.mocked(detectRuntimeMode).mockReturnValue("tauri");
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "tauri",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
  });

  it("routes stageGitAll through runtime gitStageAll", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitStageAllMock = vi.fn().mockResolvedValue({ ok: true, error: null });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitStageAll: runtimeGitStageAllMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await stageGitAll("ws-6");

    expect(runtimeGitStageAllMock).toHaveBeenCalledWith("ws-6");
    expect(invokeMock).not.toHaveBeenCalledWith("stage_git_all", expect.anything());
  });

  it("does not fall back to legacy stage_git_all invoke when runtime gitStageAll fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitStageAllMock = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "stage all denied" });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitStageAll: runtimeGitStageAllMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(stageGitAll("ws-6")).rejects.toThrow("stage all denied");
    expect(invokeMock).not.toHaveBeenCalledWith("stage_git_all", expect.anything());
  });

  it("routes stage/unstage/revert git file through runtime git change operations", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitChangesMock = vi.fn().mockResolvedValue({
      staged: [{ id: "chg-staged-1", path: "src/staged.ts", status: "staged", summary: "" }],
      unstaged: [
        { id: "chg-unstaged-1", path: "src/file.ts", status: "modified", summary: "" },
        { id: "chg-unstaged-2", path: "src/revert.ts", status: "modified", summary: "" },
      ],
    });
    const runtimeGitStageChangeMock = vi.fn().mockResolvedValue({ ok: true, error: null });
    const runtimeGitUnstageChangeMock = vi.fn().mockResolvedValue({ ok: true, error: null });
    const runtimeGitRevertChangeMock = vi.fn().mockResolvedValue({ ok: true, error: null });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitChanges: runtimeGitChangesMock,
      gitStageChange: runtimeGitStageChangeMock,
      gitUnstageChange: runtimeGitUnstageChangeMock,
      gitRevertChange: runtimeGitRevertChangeMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(stageGitFile("ws-6", "src/file.ts")).resolves.toBeUndefined();
    await expect(unstageGitFile("ws-6", "src/staged.ts")).resolves.toBeUndefined();
    await expect(revertGitFile("ws-6", "src/revert.ts")).resolves.toBeUndefined();

    expect(runtimeGitStageChangeMock).toHaveBeenCalledWith("ws-6", "chg-unstaged-1");
    expect(runtimeGitUnstageChangeMock).toHaveBeenCalledWith("ws-6", "chg-staged-1");
    expect(runtimeGitRevertChangeMock).toHaveBeenCalledWith("ws-6", "chg-unstaged-2");
    expect(invokeMock).not.toHaveBeenCalledWith("stage_git_file", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("unstage_git_file", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("revert_git_file", expect.anything());
  });

  it("does not fall back to legacy stage/unstage/revert invoke when runtime git change operations fail", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitChangesMock = vi.fn().mockResolvedValue({
      staged: [{ id: "chg-staged-2", path: "src/staged-denied.ts", status: "staged", summary: "" }],
      unstaged: [
        { id: "chg-unstaged-3", path: "src/file-denied.ts", status: "modified", summary: "" },
      ],
    });
    const runtimeGitStageChangeMock = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "stage denied" });
    const runtimeGitUnstageChangeMock = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "unstage denied" });
    const runtimeGitRevertChangeMock = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "revert denied" });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitChanges: runtimeGitChangesMock,
      gitStageChange: runtimeGitStageChangeMock,
      gitUnstageChange: runtimeGitUnstageChangeMock,
      gitRevertChange: runtimeGitRevertChangeMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(stageGitFile("ws-6", "src/file-denied.ts")).rejects.toThrow("stage denied");
    await expect(unstageGitFile("ws-6", "src/staged-denied.ts")).rejects.toThrow("unstage denied");
    await expect(revertGitFile("ws-6", "src/file-denied.ts")).rejects.toThrow("revert denied");
    expect(invokeMock).not.toHaveBeenCalledWith("stage_git_file", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("unstage_git_file", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("revert_git_file", expect.anything());
  });

  it("routes commitGit through runtime gitCommit", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitCommitMock = vi.fn().mockResolvedValue({
      committed: true,
      committedCount: 1,
      error: null,
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitCommit: runtimeGitCommitMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(commitGit("ws-commit-1", "feat: runtime commit")).resolves.toBeUndefined();

    expect(runtimeGitCommitMock).toHaveBeenCalledWith("ws-commit-1", "feat: runtime commit");
    expect(invokeMock).not.toHaveBeenCalledWith("commit_git", expect.anything());
  });

  it("does not fall back to legacy commit_git invoke when runtime gitCommit fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeGitCommitMock = vi.fn().mockResolvedValue({
      committed: false,
      committedCount: 0,
      error: "commit denied",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      gitCommit: runtimeGitCommitMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(commitGit("ws-commit-2", "feat: denied")).rejects.toThrow("commit denied");
    expect(invokeMock).not.toHaveBeenCalledWith("commit_git", expect.anything());
  });

  it("invokes fetch_git", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await fetchGit("ws-7");

    expect(invokeMock).toHaveBeenCalledWith("fetch_git", {
      workspaceId: "ws-7",
    });
  });

  it("routes getModelList through runtime models API", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeModelsMock = vi.fn().mockResolvedValue([
      {
        id: "gpt-5.3-codex",
        displayName: "GPT-5.3 Codex",
        provider: "openai",
        pool: "codex",
        source: "local-codex",
        available: true,
        supportsReasoning: true,
        supportsVision: false,
        reasoningEfforts: ["low", "high"],
        capabilities: ["chat", "coding"],
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      models: runtimeModelsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getModelList("ws-7")).resolves.toEqual({
      result: {
        data: [
          expect.objectContaining({
            id: "openai::gpt-5.3-codex",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            display_name: "GPT-5.3 Codex",
            provider: "openai",
            pool: "codex",
            source: "local-codex",
            available: true,
            description: "openai (chat, coding)",
            defaultReasoningEffort: "low",
            default_reasoning_effort: "low",
            isDefault: false,
            is_default: false,
            supportedReasoningEfforts: [
              expect.objectContaining({ reasoningEffort: "low" }),
              expect.objectContaining({ reasoningEffort: "high" }),
            ],
            supported_reasoning_efforts: [
              expect.objectContaining({ reasoning_effort: "low" }),
              expect.objectContaining({ reasoning_effort: "high" }),
            ],
          }),
        ],
      },
    });
    expect(runtimeModelsMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).not.toHaveBeenCalledWith("model_list", expect.anything());
  });

  it("preserves distinct runtime model slugs when model ids collide", async () => {
    const runtimeModelsMock = vi.fn().mockResolvedValue([
      {
        id: "codex",
        model: "gpt-5.3-codex",
        displayName: "GPT-5.3 Codex",
        provider: "openai",
        pool: "codex",
        source: "local-codex",
        available: true,
        reasoningEfforts: ["low", "high"],
        capabilities: ["chat", "coding"],
      },
      {
        id: "codex",
        model: "gpt-5.2-codex",
        displayName: "GPT-5.2 Codex",
        provider: "openai",
        pool: "codex",
        source: "oauth-account",
        available: true,
        reasoningEfforts: ["medium"],
        capabilities: ["chat"],
      },
      {
        id: "codex",
        modelId: "gpt-5.1-codex",
        display_name: "GPT-5.1 Codex",
        provider: "openai",
        pool: "codex",
        source: "oauth-account",
        available: true,
        reasoning_efforts: ["xhigh"],
        capabilities: ["chat"],
      },
      {
        id: "codex",
        model: "gpt-5.2-codex",
        displayName: "GPT-5.2 Codex duplicate",
        provider: "openai",
        pool: "codex",
        source: "oauth-account",
        available: true,
        reasoningEfforts: ["medium"],
        capabilities: ["chat"],
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      models: runtimeModelsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    const result = await getModelList("ws-7");
    expect(result).toMatchObject({
      result: {
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "codex",
            model: "gpt-5.3-codex",
          }),
          expect.objectContaining({
            id: "codex::gpt-5.2-codex",
            model: "gpt-5.2-codex",
          }),
          expect.objectContaining({
            id: "codex::gpt-5.1-codex",
            model: "gpt-5.1-codex",
          }),
        ]),
      },
    });
    const items = (result.result as { data?: unknown }).data;
    expect(Array.isArray(items) ? items : []).toHaveLength(3);
  });

  it("does not fall back to legacy model_list invoke when runtime models fail", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeModelsMock = vi.fn().mockRejectedValue(new Error("runtime models failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      models: runtimeModelsMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getModelList("ws-7")).rejects.toThrow("runtime models failed");
    expect(invokeMock).not.toHaveBeenCalledWith("model_list", expect.anything());
  });

  it("routes getProvidersCatalog through runtime providers catalog API", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimeProvidersCatalogMock = vi.fn().mockResolvedValue([
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
        registryVersion: "2026-02-17",
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      providersCatalog: runtimeProvidersCatalogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getProvidersCatalog()).resolves.toEqual([
      expect.objectContaining({
        providerId: "openai",
        oauthProviderId: "codex",
      }),
    ]);

    expect(runtimeProvidersCatalogMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).not.toHaveBeenCalledWith("code_providers_catalog", expect.anything());
  });

  it("preserves provider aliases in runtime providers catalog responses", async () => {
    const runtimeProvidersCatalogMock = vi.fn().mockResolvedValue([
      {
        providerId: "google",
        displayName: "Google",
        pool: "gemini",
        oauthProviderId: "gemini",
        aliases: ["google", "gemini", "antigravity", "anti-gravity"],
        defaultModelId: "gemini-3.1-pro",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "2026-03-15",
      },
    ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      providersCatalog: runtimeProvidersCatalogMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getProvidersCatalog()).resolves.toEqual([
      expect.objectContaining({
        oauthProviderId: "gemini",
        aliases: ["google", "gemini", "antigravity", "anti-gravity"],
      }),
    ]);
  });
});
