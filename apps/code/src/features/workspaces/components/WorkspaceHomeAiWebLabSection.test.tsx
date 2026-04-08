// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { WorkspaceHomeAiWebLabSection } from "./WorkspaceHomeAiWebLabSection";

const useRuntimeAiWebLabControllerMock = vi.fn();

vi.mock("../../../application/runtime/facades/runtimeAiWebLabController", () => ({
  useRuntimeAiWebLabController: (...args: unknown[]) => useRuntimeAiWebLabControllerMock(...args),
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
  },
};

describe("WorkspaceHomeAiWebLabSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeAiWebLabControllerMock.mockReturnValue({
      applyArtifactToDraft: vi.fn(),
      canApplyArtifactToDraft: false,
      catalog: {
        defaultProviderId: "chatgpt",
        providers: [
          {
            available: true,
            capabilities: ["editable_canvas"],
            defaultEntrypointId: "prompt_refinement",
            displayName: "ChatGPT",
            entrypoints: [
              {
                capabilityId: "editable_canvas",
                id: "prompt_refinement",
                label: "Prompt refinement",
                url: "https://chatgpt.com/",
              },
            ],
            providerId: "chatgpt",
          },
        ],
      },
      closeSession: vi.fn(async () => undefined),
      error: null,
      extractArtifact: vi.fn(async () => undefined),
      extracting: false,
      focusSession: vi.fn(async () => undefined),
      loading: false,
      note: null,
      openEntrypoint: vi.fn(async () => undefined),
      openSession: vi.fn(async () => undefined),
      refresh: vi.fn(async () => undefined),
      saveProviderUrl: vi.fn(async () => undefined),
      setAutoAttachArtifact: vi.fn(async () => undefined),
      setAutoCreateWorktree: vi.fn(async () => undefined),
      setDefaultBaseRef: vi.fn(async () => undefined),
      setDefaultProvider: vi.fn(async () => undefined),
      setPreferredSessionMode: vi.fn(async () => undefined),
      setPreferredViewMode: vi.fn(async () => undefined),
      settings: {
        autoAttachArtifact: false,
        autoCreateWorktree: false,
        defaultBaseRef: "origin/main",
        defaultProvider: "chatgpt",
        preferredSessionMode: "managed",
        preferredViewMode: "docked",
        providerUrls: {
          chatgpt: "https://chatgpt.com/",
          gemini: "https://gemini.google.com/app",
        },
      },
      state: {
        actualUrl: null,
        activeEntrypointId: null,
        attachedEndpointCount: 0,
        available: true,
        catalog: null,
        lastArtifact: null,
        managedWindowOpen: false,
        modeSupport: {
          attached: true,
          docked: true,
          managed: true,
          window: true,
        },
        pageTitle: null,
        preferredViewMode: "docked",
        providerId: "chatgpt",
        sessionMode: "managed",
        statusMessage: "AI Web Lab is ready.",
        targetUrl: "https://chatgpt.com/",
      },
      worktreeRecommendation: null,
    });
  });

  it("keeps base-ref edits local until the operator explicitly saves", () => {
    render(<WorkspaceHomeAiWebLabSection workspace={workspace} onApplyArtifactToDraft={vi.fn()} />);

    const baseRefField = screen.getByLabelText("Base ref");
    fireEvent.change(baseRefField, { target: { value: "upstream/release" } });

    const controller = useRuntimeAiWebLabControllerMock.mock.results[0]?.value;
    expect(controller.setDefaultBaseRef).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save base ref" }));

    expect(controller.setDefaultBaseRef).toHaveBeenCalledWith("upstream/release");
  });

  it("keeps provider URL edits local until the operator explicitly saves", () => {
    render(<WorkspaceHomeAiWebLabSection workspace={workspace} onApplyArtifactToDraft={vi.fn()} />);

    const providerUrlField = screen.getByLabelText("chatgpt URL");
    fireEvent.change(providerUrlField, {
      target: { value: "https://chatgpt.com/g/g-123" },
    });

    const controller = useRuntimeAiWebLabControllerMock.mock.results[0]?.value;
    expect(controller.saveProviderUrl).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save URL" }));

    expect(controller.saveProviderUrl).toHaveBeenCalledWith(
      "chatgpt",
      "https://chatgpt.com/g/g-123"
    );
  });
});
