// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { updateWorkspaceSettings } from "../../../services/workspaceBridge";
import {
  extractAiWebLabArtifact,
  getAiWebLabCatalog,
  getAiWebLabState,
  navigateAiWebLab,
  setAiWebLabViewMode,
} from "../ports/aiWebLab";
import { useRuntimeAiWebLabController } from "./runtimeAiWebLabController";

vi.mock("../../../services/workspaceBridge", () => ({
  updateWorkspaceSettings: vi.fn(),
}));

vi.mock("../ports/aiWebLab", () => ({
  closeAiWebLabSession: vi.fn(async () => null),
  extractAiWebLabArtifact: vi.fn(async () => null),
  focusAiWebLabSession: vi.fn(async () => null),
  getAiWebLabCatalog: vi.fn(async () => null),
  getAiWebLabState: vi.fn(async () => null),
  navigateAiWebLab: vi.fn(async () => null),
  openAiWebLabEntrypoint: vi.fn(async () => null),
  openAiWebLabSession: vi.fn(async () => null),
  setAiWebLabSessionMode: vi.fn(async () => null),
  setAiWebLabViewMode: vi.fn(async () => null),
}));

const workspace: WorkspaceInfo = {
  id: "ws-ai-web-lab",
  name: "AI Web Lab Workspace",
  path: "/tmp/ai-web-lab",
  connected: true,
  kind: "main",
  parentId: null,
  worktree: null,
  settings: {
    sidebarCollapsed: false,
    aiWebLabAutoAttachArtifact: false,
    aiWebLabDefaultBaseRef: "origin/main",
    aiWebLabDefaultProvider: "chatgpt",
    aiWebLabPreferredSessionMode: "managed",
    aiWebLabPreferredViewMode: "docked",
    aiWebLabProviderUrls: {
      chatgpt: "https://chatgpt.com/",
      gemini: "https://gemini.google.com/app",
    },
  },
};

describe("runtimeAiWebLabController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAiWebLabCatalog).mockResolvedValue({
      defaultProviderId: "chatgpt",
      providers: [],
    });
    vi.mocked(getAiWebLabState).mockResolvedValue(null);
  });

  it("rolls back optimistic settings and skips host updates when persistence fails", async () => {
    vi.mocked(updateWorkspaceSettings).mockRejectedValue(new Error("settings write failed"));
    const onApplyArtifactToDraft = vi.fn();

    const { result } = renderHook(() =>
      useRuntimeAiWebLabController({
        workspace,
        onApplyArtifactToDraft,
      })
    );

    await waitFor(() => {
      expect(vi.mocked(getAiWebLabCatalog)).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.setPreferredViewMode("window");
    });

    expect(result.current.settings.preferredViewMode).toBe("docked");
    expect(result.current.error).toBe("settings write failed");
    expect(result.current.note).toBeNull();
    expect(vi.mocked(setAiWebLabViewMode)).not.toHaveBeenCalled();
    expect(vi.mocked(updateWorkspaceSettings)).toHaveBeenCalledTimes(1);
    expect(onApplyArtifactToDraft).not.toHaveBeenCalled();
  });

  it("auto-attaches successful artifacts when the workspace setting is enabled", async () => {
    vi.mocked(updateWorkspaceSettings).mockImplementation(async (_workspaceId, nextSettings) => ({
      ...workspace,
      settings: nextSettings,
    }));
    vi.mocked(extractAiWebLabArtifact).mockResolvedValue({
      artifactKind: "prompt_markdown",
      content: "```markdown\nfinal prompt\n```",
      entrypointId: "prompt_refinement",
      extractedAt: "2026-04-07T00:00:00.000Z",
      format: "markdown",
      pageTitle: "ChatGPT",
      providerId: "chatgpt",
      sourceUrl: "https://chatgpt.com/c/example",
      status: "succeeded",
      errorMessage: null,
    });
    const onApplyArtifactToDraft = vi.fn();

    const { result } = renderHook(() =>
      useRuntimeAiWebLabController({
        workspace,
        onApplyArtifactToDraft,
      })
    );

    await waitFor(() => {
      expect(vi.mocked(getAiWebLabCatalog)).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.setAutoAttachArtifact(true);
    });

    await act(async () => {
      await result.current.extractArtifact();
    });

    expect(onApplyArtifactToDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "chatgpt",
        status: "succeeded",
      })
    );
    expect(result.current.note).toBe(
      "AI Web Lab artifact extracted and attached to the mission draft."
    );
  });

  it("persists provider URLs from explicit saves instead of transient field edits", async () => {
    vi.mocked(updateWorkspaceSettings).mockImplementation(async (_workspaceId, nextSettings) => ({
      ...workspace,
      settings: nextSettings,
    }));

    const { result } = renderHook(() =>
      useRuntimeAiWebLabController({
        workspace,
        onApplyArtifactToDraft: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(vi.mocked(getAiWebLabCatalog)).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.saveProviderUrl("gemini", "https://gemini.google.com/app/canvas");
    });

    expect(vi.mocked(updateWorkspaceSettings)).toHaveBeenLastCalledWith(
      workspace.id,
      expect.objectContaining({
        aiWebLabProviderUrls: {
          chatgpt: "https://chatgpt.com/",
          gemini: "https://gemini.google.com/app/canvas",
        },
      })
    );
    expect(result.current.settings.providerUrls.gemini).toBe(
      "https://gemini.google.com/app/canvas"
    );
    expect(vi.mocked(navigateAiWebLab)).not.toHaveBeenCalled();
  });
});
