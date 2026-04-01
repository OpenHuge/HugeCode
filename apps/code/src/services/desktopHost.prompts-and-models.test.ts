import { invoke, isDesktopHostRuntime } from "@desktop-host/core";
import { listen } from "@desktop-host/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectRuntimeMode,
  getRuntimeClient,
  readRuntimeCapabilitiesSummary,
} from "./runtimeClient";
import {
  __resetLocalUsageSnapshotCacheForTests,
  __resetWebRuntimeOauthFallbackStateForTests,
  createPrompt,
  createRuntimePrompt,
  deletePrompt,
  deleteRuntimePrompt,
  getPromptsList,
  listRuntimePrompts,
  movePrompt,
  moveRuntimePrompt,
  updatePrompt,
  updateRuntimePrompt,
} from "../test/shims/desktopHostServices";

vi.mock("@desktop-host/core", () => ({
  invoke: vi.fn(),
  isDesktopHostRuntime: vi.fn(() => true),
}));

vi.mock("@desktop-host/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@desktop-host/dialogs", () => ({
  open: vi.fn(),
}));

vi.mock("@desktop-host/notifications", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "electron-bridge"),
  getRuntimeClient: vi.fn(),
  readRuntimeCapabilitiesSummary: vi.fn(),
}));

describe("desktop host invoke wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetWebRuntimeOauthFallbackStateForTests();
    __resetLocalUsageSnapshotCacheForTests();
    localStorage.clear();
    const invokeMock = vi.mocked(invoke);
    vi.mocked(listen).mockResolvedValue(async () => undefined);
    vi.mocked(isDesktopHostRuntime).mockReturnValue(true);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      return undefined;
    });
    vi.mocked(getRuntimeClient).mockImplementation(() => {
      throw new Error("runtime unavailable");
    });
    vi.mocked(detectRuntimeMode).mockReturnValue("electron-bridge");
    vi.mocked(readRuntimeCapabilitiesSummary).mockResolvedValue({
      mode: "electron-bridge",
      methods: [],
      features: [],
      wsEndpointPath: null,
      error: null,
    });
  });

  it("routes getPromptsList through runtime promptLibrary", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-workspace-1",
          title: "Workspace Prompt",
          description: "Workspace description",
          content: "workspace content",
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "prompt-global-1",
          title: "Global Prompt",
          description: "Global description",
          content: "global content",
          scope: "global",
        },
      ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-1")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Workspace Prompt",
            path: "prompt-workspace-1",
            description: "Workspace description",
            content: "workspace content",
            scope: "workspace",
          },
          {
            name: "Global Prompt",
            path: "prompt-global-1",
            description: "Global description",
            content: "global content",
            scope: "global",
          },
        ],
      },
      prompts: [
        {
          name: "Workspace Prompt",
          path: "prompt-workspace-1",
          description: "Workspace description",
          content: "workspace content",
          scope: "workspace",
        },
        {
          name: "Global Prompt",
          path: "prompt-global-1",
          description: "Global description",
          content: "global content",
          scope: "global",
        },
      ],
    });
    expect(runtimePromptLibraryMock).toHaveBeenNthCalledWith(1, "ws-prompts-1");
    expect(runtimePromptLibraryMock).toHaveBeenNthCalledWith(2, null);
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_list", expect.anything());
  });

  it("does not fall back to legacy prompts_list invoke when runtime promptLibrary fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryMock = vi.fn().mockRejectedValue(new Error("runtime prompts failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-2")).rejects.toThrow("runtime prompts failed");
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_list", expect.anything());
  });

  it("extracts argumentHint metadata from runtime prompt content", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-hint-1",
          title: "Prompt With Hint",
          description: "desc",
          content: '---\nargument_hint: "folder or file"\n---\nshow files',
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-hint")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt With Hint",
            path: "prompt-hint-1",
            description: "desc",
            content: "show files",
            scope: "workspace",
            argumentHint: "folder or file",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt With Hint",
          path: "prompt-hint-1",
          description: "desc",
          content: "show files",
          scope: "workspace",
          argumentHint: "folder or file",
        },
      ],
    });
  });

  it("extracts argumentHint from current runtime adapter metadata format", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-hint-v1",
          title: "Prompt Hint V1",
          description: "desc v1",
          content:
            '---\nruntime_adapter_meta: prompt_v1\nargument_hint: "workspace path"\n---\nlist files',
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-hint-v1")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt Hint V1",
            path: "prompt-hint-v1",
            description: "desc v1",
            content: "list files",
            scope: "workspace",
            argumentHint: "workspace path",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt Hint V1",
          path: "prompt-hint-v1",
          description: "desc v1",
          content: "list files",
          scope: "workspace",
          argumentHint: "workspace path",
        },
      ],
    });
  });

  it("extracts argumentHint from legacy hyphenated metadata key format", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-hint-hyphen",
          title: "Prompt Hint Hyphen",
          description: "desc hyphen",
          content: '---\nargument-hint: "file path"\n---\nprint file',
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-hint-hyphen")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt Hint Hyphen",
            path: "prompt-hint-hyphen",
            description: "desc hyphen",
            content: "print file",
            scope: "workspace",
            argumentHint: "file path",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt Hint Hyphen",
          path: "prompt-hint-hyphen",
          description: "desc hyphen",
          content: "print file",
          scope: "workspace",
          argumentHint: "file path",
        },
      ],
    });
  });

  it("extracts argumentHint from runtime adapter metadata with CRLF frontmatter", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-hint-crlf",
          title: "Prompt Hint CRLF",
          description: "desc crlf",
          content:
            '---\r\nruntime_adapter_meta: prompt_v1\r\nargument_hint: "workspace path"\r\n---\r\nlist files',
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-hint-crlf")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt Hint CRLF",
            path: "prompt-hint-crlf",
            description: "desc crlf",
            content: "list files",
            scope: "workspace",
            argumentHint: "workspace path",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt Hint CRLF",
          path: "prompt-hint-crlf",
          description: "desc crlf",
          content: "list files",
          scope: "workspace",
          argumentHint: "workspace path",
        },
      ],
    });
  });

  it("extracts argumentHint when frontmatter starts with UTF-8 BOM", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-hint-bom",
          title: "Prompt Hint BOM",
          description: "desc bom",
          content:
            '\uFEFF---\nruntime_adapter_meta: prompt_v1\nargument_hint: "workspace path"\n---\nlist files',
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-hint-bom")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt Hint BOM",
            path: "prompt-hint-bom",
            description: "desc bom",
            content: "list files",
            scope: "workspace",
            argumentHint: "workspace path",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt Hint BOM",
          path: "prompt-hint-bom",
          description: "desc bom",
          content: "list files",
          scope: "workspace",
          argumentHint: "workspace path",
        },
      ],
    });
  });

  it("extracts argumentHint from single-quoted frontmatter values", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-hint-single-quote",
          title: "Prompt Hint Single Quote",
          description: "desc single quote",
          content:
            "---\nruntime_adapter_meta: prompt_v1\nargument_hint: 'folder path'\n---\nlist files",
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-hint-single-quote")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt Hint Single Quote",
            path: "prompt-hint-single-quote",
            description: "desc single quote",
            content: "list files",
            scope: "workspace",
            argumentHint: "folder path",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt Hint Single Quote",
          path: "prompt-hint-single-quote",
          description: "desc single quote",
          content: "list files",
          scope: "workspace",
          argumentHint: "folder path",
        },
      ],
    });
  });

  it("decodes escaped apostrophes in single-quoted argumentHint values", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-hint-single-quote-escaped",
          title: "Prompt Hint Single Quote Escaped",
          description: "desc single quote escaped",
          content:
            "---\nruntime_adapter_meta: prompt_v1\nargument_hint: 'project''s path'\n---\nlist files",
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-hint-single-quote-escaped")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt Hint Single Quote Escaped",
            path: "prompt-hint-single-quote-escaped",
            description: "desc single quote escaped",
            content: "list files",
            scope: "workspace",
            argumentHint: "project's path",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt Hint Single Quote Escaped",
          path: "prompt-hint-single-quote-escaped",
          description: "desc single quote escaped",
          content: "list files",
          scope: "workspace",
          argumentHint: "project's path",
        },
      ],
    });
  });

  it("keeps prompt content unchanged when frontmatter is not argumentHint-only metadata", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-frontmatter-1",
          title: "Prompt Frontmatter",
          description: "desc",
          content: "---\nfoo: bar\nargument_hint: should-not-strip\n---\nraw body",
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-frontmatter")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Prompt Frontmatter",
            path: "prompt-frontmatter-1",
            description: "desc",
            content: "---\nfoo: bar\nargument_hint: should-not-strip\n---\nraw body",
            scope: "workspace",
          },
        ],
      },
      prompts: [
        {
          name: "Prompt Frontmatter",
          path: "prompt-frontmatter-1",
          description: "desc",
          content: "---\nfoo: bar\nargument_hint: should-not-strip\n---\nraw body",
          scope: "workspace",
        },
      ],
    });
  });

  it("routes prompt create/update/delete/move through runtime promptLibrary APIs", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryCreateMock = vi.fn().mockResolvedValue({
      id: "prompt-1",
      title: "Prompt 1",
      description: "desc 1",
      content: "content 1",
      scope: "workspace",
    });
    const runtimePromptLibraryUpdateMock = vi.fn().mockResolvedValue({
      id: "prompt-1",
      title: "Prompt 1 Updated",
      description: "desc 1 updated",
      content: "content 1 updated",
      scope: "workspace",
    });
    const runtimePromptLibraryDeleteMock = vi.fn().mockResolvedValue(true);
    const runtimePromptLibraryMoveMock = vi.fn().mockResolvedValue({
      id: "prompt-1",
      title: "Prompt 1 Updated",
      description: "desc 1 updated",
      content: "content 1 updated",
      scope: "global",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibraryCreate: runtimePromptLibraryCreateMock,
      promptLibraryUpdate: runtimePromptLibraryUpdateMock,
      promptLibraryDelete: runtimePromptLibraryDeleteMock,
      promptLibraryMove: runtimePromptLibraryMoveMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      createPrompt("ws-prompts-3", {
        scope: "workspace",
        name: "Prompt 1",
        description: "desc 1",
        argumentHint: "arg 1",
        content: "content 1",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        prompt: expect.objectContaining({
          name: "Prompt 1",
          path: "prompt-1",
          scope: "workspace",
        }),
      })
    );

    await expect(
      updatePrompt("ws-prompts-3", {
        path: "prompt-1",
        name: "Prompt 1 Updated",
        description: "desc 1 updated",
        argumentHint: "arg 1 updated",
        content: "content 1 updated",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        prompt: expect.objectContaining({
          name: "Prompt 1 Updated",
          path: "prompt-1",
          scope: "workspace",
        }),
      })
    );

    await expect(deletePrompt("ws-prompts-3", "prompt-1")).resolves.toEqual({
      result: { deleted: true },
      deleted: true,
    });

    await expect(
      movePrompt("ws-prompts-3", {
        path: "prompt-1",
        scope: "global",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        prompt: expect.objectContaining({
          name: "Prompt 1 Updated",
          path: "prompt-1",
          scope: "global",
        }),
      })
    );

    expect(runtimePromptLibraryCreateMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-3",
      scope: "workspace",
      title: "Prompt 1",
      description: "desc 1",
      content: '---\nruntime_adapter_meta: prompt_v1\nargument_hint: "arg 1"\n---\ncontent 1',
    });
    expect(runtimePromptLibraryUpdateMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-3",
      promptId: "prompt-1",
      title: "Prompt 1 Updated",
      description: "desc 1 updated",
      content:
        '---\nruntime_adapter_meta: prompt_v1\nargument_hint: "arg 1 updated"\n---\ncontent 1 updated',
    });
    expect(runtimePromptLibraryDeleteMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-3",
      promptId: "prompt-1",
    });
    expect(runtimePromptLibraryMoveMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-3",
      promptId: "prompt-1",
      targetScope: "global",
    });
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_create", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_update", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_delete", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_move", expect.anything());
  });

  it("does not fall back to legacy prompts_create invoke when runtime prompt create fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryCreateMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime prompt create failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibraryCreate: runtimePromptLibraryCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      createPrompt("ws-prompts-4", {
        scope: "workspace",
        name: "Prompt Fail",
        description: null,
        argumentHint: null,
        content: "content",
      })
    ).rejects.toThrow("runtime prompt create failed");
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_create", expect.anything());
  });

  it("keeps runtime prompt content raw when argumentHint is not provided", async () => {
    const runtimePromptLibraryCreateMock = vi.fn().mockResolvedValue({
      id: "prompt-raw-1",
      title: "Prompt Raw",
      description: "desc raw",
      content: "raw content",
      scope: "workspace",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibraryCreate: runtimePromptLibraryCreateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await createPrompt("ws-prompts-raw", {
      scope: "workspace",
      name: "Prompt Raw",
      description: "desc raw",
      argumentHint: null,
      content: "raw content",
    });

    expect(runtimePromptLibraryCreateMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-raw",
      scope: "workspace",
      title: "Prompt Raw",
      description: "desc raw",
      content: "raw content",
    });
  });

  it("dedupes prompt entries by id when workspace/global prompt lists overlap", async () => {
    const runtimePromptLibraryMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "prompt-shared-1",
          title: "Workspace Shared Prompt",
          description: "workspace shared",
          content: "workspace content",
          scope: "workspace",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "prompt-shared-1",
          title: "Global Shared Prompt",
          description: "global shared",
          content: "global content",
          scope: "global",
        },
        {
          id: "prompt-global-2",
          title: "Global Prompt 2",
          description: "global two",
          content: "global content two",
          scope: "global",
        },
      ]);
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(getPromptsList("ws-prompts-overlap")).resolves.toEqual({
      result: {
        prompts: [
          {
            name: "Workspace Shared Prompt",
            path: "prompt-shared-1",
            description: "workspace shared",
            content: "workspace content",
            scope: "workspace",
          },
          {
            name: "Global Prompt 2",
            path: "prompt-global-2",
            description: "global two",
            content: "global content two",
            scope: "global",
          },
        ],
      },
      prompts: [
        {
          name: "Workspace Shared Prompt",
          path: "prompt-shared-1",
          description: "workspace shared",
          content: "workspace content",
          scope: "workspace",
        },
        {
          name: "Global Prompt 2",
          path: "prompt-global-2",
          description: "global two",
          content: "global content two",
          scope: "global",
        },
      ],
    });
  });

  it("does not fall back to legacy prompts_update invoke when runtime prompt update fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryUpdateMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime prompt update failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibraryUpdate: runtimePromptLibraryUpdateMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      updatePrompt("ws-prompts-5", {
        path: "prompt-1",
        name: "Prompt Update Fail",
        description: null,
        argumentHint: null,
        content: "content",
      })
    ).rejects.toThrow("runtime prompt update failed");
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_update", expect.anything());
  });

  it("does not fall back to legacy prompts_delete invoke when runtime prompt delete fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryDeleteMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime prompt delete failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibraryDelete: runtimePromptLibraryDeleteMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(deletePrompt("ws-prompts-6", "prompt-1")).rejects.toThrow(
      "runtime prompt delete failed"
    );
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_delete", expect.anything());
  });

  it("does not fall back to legacy prompts_move invoke when runtime prompt move fails", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryMoveMock = vi
      .fn()
      .mockRejectedValue(new Error("runtime prompt move failed"));
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibraryMove: runtimePromptLibraryMoveMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(
      movePrompt("ws-prompts-7", {
        path: "prompt-1",
        scope: "global",
      })
    ).rejects.toThrow("runtime prompt move failed");
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_move", expect.anything());
  });

  it("routes runtime prompt library wrappers through runtime promptLibrary APIs without legacy adaptation", async () => {
    const invokeMock = vi.mocked(invoke);
    const runtimePromptLibraryMock = vi.fn().mockResolvedValue([
      {
        id: "prompt-runtime-1",
        title: "Runtime Prompt",
        description: "runtime description",
        content: "runtime content",
        scope: "workspace",
      },
    ]);
    const runtimePromptLibraryCreateMock = vi.fn().mockResolvedValue({
      id: "prompt-runtime-2",
      title: "Runtime Prompt 2",
      description: "runtime description 2",
      content: "runtime content 2",
      scope: "global",
    });
    const runtimePromptLibraryUpdateMock = vi.fn().mockResolvedValue({
      id: "prompt-runtime-2",
      title: "Runtime Prompt 2 Updated",
      description: "runtime description 2 updated",
      content: "runtime content 2 updated",
      scope: "global",
    });
    const runtimePromptLibraryDeleteMock = vi.fn().mockResolvedValue(true);
    const runtimePromptLibraryMoveMock = vi.fn().mockResolvedValue({
      id: "prompt-runtime-2",
      title: "Runtime Prompt 2 Updated",
      description: "runtime description 2 updated",
      content: "runtime content 2 updated",
      scope: "workspace",
    });
    vi.mocked(getRuntimeClient).mockReturnValue({
      promptLibrary: runtimePromptLibraryMock,
      promptLibraryCreate: runtimePromptLibraryCreateMock,
      promptLibraryUpdate: runtimePromptLibraryUpdateMock,
      promptLibraryDelete: runtimePromptLibraryDeleteMock,
      promptLibraryMove: runtimePromptLibraryMoveMock,
    } as unknown as ReturnType<typeof getRuntimeClient>);

    await expect(listRuntimePrompts(null)).resolves.toEqual([
      {
        id: "prompt-runtime-1",
        title: "Runtime Prompt",
        description: "runtime description",
        content: "runtime content",
        scope: "workspace",
      },
    ]);
    await expect(
      createRuntimePrompt({
        workspaceId: null,
        scope: "global",
        title: "Runtime Prompt 2",
        description: "runtime description 2",
        content: "runtime content 2",
      })
    ).resolves.toMatchObject({
      id: "prompt-runtime-2",
      scope: "global",
    });
    await expect(
      updateRuntimePrompt({
        workspaceId: "ws-prompts-runtime",
        promptId: "prompt-runtime-2",
        title: "Runtime Prompt 2 Updated",
        description: "runtime description 2 updated",
        content: "runtime content 2 updated",
      })
    ).resolves.toMatchObject({
      id: "prompt-runtime-2",
      title: "Runtime Prompt 2 Updated",
    });
    await expect(
      deleteRuntimePrompt({
        workspaceId: "ws-prompts-runtime",
        promptId: "prompt-runtime-2",
      })
    ).resolves.toBe(true);
    await expect(
      moveRuntimePrompt({
        workspaceId: "ws-prompts-runtime",
        promptId: "prompt-runtime-2",
        targetScope: "workspace",
      })
    ).resolves.toMatchObject({
      id: "prompt-runtime-2",
      scope: "workspace",
    });

    expect(runtimePromptLibraryMock).toHaveBeenCalledWith(null);
    expect(runtimePromptLibraryCreateMock).toHaveBeenCalledWith({
      workspaceId: null,
      scope: "global",
      title: "Runtime Prompt 2",
      description: "runtime description 2",
      content: "runtime content 2",
    });
    expect(runtimePromptLibraryUpdateMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-runtime",
      promptId: "prompt-runtime-2",
      title: "Runtime Prompt 2 Updated",
      description: "runtime description 2 updated",
      content: "runtime content 2 updated",
    });
    expect(runtimePromptLibraryDeleteMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-runtime",
      promptId: "prompt-runtime-2",
    });
    expect(runtimePromptLibraryMoveMock).toHaveBeenCalledWith({
      workspaceId: "ws-prompts-runtime",
      promptId: "prompt-runtime-2",
      targetScope: "workspace",
    });
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_list", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_create", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_update", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_delete", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("prompts_move", expect.anything());
  });
});
