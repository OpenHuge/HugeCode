import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { T3ChatWorkspaceChrome } from "./T3ChatWorkspaceChrome";
import type { T3CodeProviderRoute } from "@ku0/code-t3-runtime-adapter";

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  mountedRoot = null;
  mountedContainer?.remove();
  mountedContainer = null;
});

const codexRoute: T3CodeProviderRoute = {
  authState: "authenticated",
  backendId: "codex-app-server-builtin",
  backendLabel: "Built-in Codex",
  capabilities: ["codex", "reasoning"],
  installed: true,
  modelId: "gpt-5.3-codex",
  models: [
    {
      available: true,
      capabilities: ["chat", "coding", "reasoning"],
      name: "GPT-5.3 Codex",
      reasoningEfforts: ["low", "medium", "high", "xhigh"],
      runtimeProvider: "openai",
      shortName: "Codex",
      slug: "gpt-5.3-codex",
      source: "runtime",
      supportsReasoning: true,
      supportsVision: false,
    },
  ],
  preferredBackendIds: ["codex-app-server-builtin"],
  provider: "codex",
  providerLabel: "Codex",
  reasons: [],
  status: "ready",
  summary: "Runtime can use the built-in Codex route.",
};

function renderChrome() {
  const container = document.createElement("div");
  const props = {
    onComposerAccessModeChange: vi.fn(),
    onLocaleChange: vi.fn(),
    onComposerModeChange: vi.fn(),
    onComposerReasonEffortChange: vi.fn(),
  };
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <T3ChatWorkspaceChrome
        canLaunchTask={true}
        composerAccessMode="on-request"
        composerCommandMatches={[]}
        composerMode="build"
        composerModelOptions={[
          {
            available: true,
            model: {
              name: "GPT-5.3 Codex",
              shortName: "Codex",
              slug: "gpt-5.3-codex",
            },
            provider: "codex",
            route: codexRoute,
          },
        ]}
        composerReasonEffort="medium"
        locale="en"
        launching={false}
        notice={null}
        prompt="Implement the task"
        selectedModelId="gpt-5.3-codex"
        selectedModelLabel="Codex"
        selectedProvider="codex"
        selectedRoute={codexRoute}
        visibleTimeline={[]}
        onApplyComposerCommand={vi.fn()}
        onLaunchTask={vi.fn()}
        onModelSelection={vi.fn()}
        onPromptChange={vi.fn()}
        onToggleSidebar={vi.fn()}
        {...props}
      />
    );
  });
  mountedRoot = root;
  mountedContainer = container;
  return { container, props };
}

function changeSelect(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function findSelect(container: HTMLElement, label: string) {
  const select = container.querySelector(`select[aria-label="${label}"]`);
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`Missing select: ${label}`);
  }
  return select;
}

describe("T3ChatWorkspaceChrome", () => {
  it("lets composer mode, access, and reasoning be selected directly", () => {
    const { container, props } = renderChrome();
    const modeSelect = findSelect(container, "Composer mode");
    const accessSelect = findSelect(container, "Composer access mode");
    const reasoningSelect = findSelect(container, "Composer reasoning effort");

    changeSelect(modeSelect, "plan");
    changeSelect(accessSelect, "full-access");
    changeSelect(reasoningSelect, "xhigh");

    expect(props.onComposerModeChange).toHaveBeenCalledWith("plan");
    expect(props.onComposerAccessModeChange).toHaveBeenCalledWith("full-access");
    expect(props.onComposerReasonEffortChange).toHaveBeenCalledWith("xhigh");
    expect(container.querySelector('button[aria-label="More composer controls"]')).toBeNull();
  });
});
