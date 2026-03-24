// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollaborationModeOption } from "../../../types";
import { getExportedStyleBlock, readRelativeSource } from "../../../test/styleSource";
import { ComposerMetaBar } from "./ComposerMetaBar";

let composerMetaWidth = 0;

const PLAN_COLLABORATION_MODES: CollaborationModeOption[] = [
  {
    id: "default",
    label: "Default",
    mode: "default",
    model: "gpt-5",
    reasoningEffort: null,
    developerInstructions: null,
    value: {},
  },
  {
    id: "plan",
    label: "Plan",
    mode: "plan",
    model: "gpt-5",
    reasoningEffort: null,
    developerInstructions: null,
    value: {},
  },
];

describe("ComposerMetaBar", () => {
  beforeEach(() => {
    composerMetaWidth = 0;
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains("composer-meta")) {
          return composerMetaWidth;
        }
        return 0;
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows only available models in the model menu when available models exist", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
          {
            id: "model-unavailable",
            model: "model-unavailable",
            displayName: "Model Unavailable",
            available: false,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={[]}
        selectedEffort={null}
        onSelectEffort={vi.fn()}
        reasoningSupported={false}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));

    const menu = screen.getByRole("menu", { name: "Default models" });
    expect(within(menu).getByText("Model Available")).toBeTruthy();
    expect(within(menu).queryByText("Model Unavailable (unavailable)")).toBeNull();
  });

  it("deduplicates duplicate routes inside the same provider and keeps provider selection separate", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "openai-primary",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            pool: "codex-primary",
            provider: "openai",
            available: true,
          },
          {
            id: "openai-secondary",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            pool: "codex-secondary",
            provider: "openai",
            available: true,
          },
        ]}
        selectedModelId="openai-primary"
        onSelectModel={vi.fn()}
        reasoningOptions={[]}
        selectedEffort={null}
        onSelectEffort={vi.fn()}
        reasoningSupported={false}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));

    const providerMenu = screen.getByRole("menu", { name: "Model providers" });
    expect(within(providerMenu).getAllByRole("menuitem", { name: "Codex" })).toHaveLength(1);
    const menu = screen.getByRole("menu", { name: "Codex models" });
    expect(within(menu).getAllByText("GPT-5.3 Codex")).toHaveLength(1);
  });

  it("groups Claude routes under one provider and prefers local Claude Code for the family default", () => {
    const onSelectModel = vi.fn();

    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "anthropic::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            pool: "claude",
            provider: "anthropic",
            available: true,
          },
          {
            id: "claude_code_local::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            pool: "claude_code_local",
            provider: "claude_code_local",
            available: true,
          },
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            pool: "codex",
            provider: "openai",
            available: true,
          },
        ]}
        selectedModelId="openai::gpt-5.4"
        onSelectModel={onSelectModel}
        reasoningOptions={[]}
        selectedEffort={null}
        onSelectEffort={vi.fn()}
        reasoningSupported={false}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));

    const providerMenu = screen.getByRole("menu", { name: "Model providers" });
    expect(within(providerMenu).getAllByRole("menuitem", { name: "Claude" })).toHaveLength(1);
    expect(within(providerMenu).getByRole("menuitem", { name: "Codex" })).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitem", { name: "Claude" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Claude Sonnet 4.5" }));
    expect(onSelectModel).toHaveBeenCalledWith("claude_code_local::claude-sonnet-4-5");
  });

  it("shows collapsed routing badges for the selected provider route", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        modelSelectionMode="auto"
        models={[
          {
            id: "claude_code_local::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            pool: "claude_code_local",
            provider: "claude_code_local",
            available: true,
            providerReadinessKind: "ready",
            providerReadinessMessage: "Local Claude Code is ready on this machine.",
            executionKind: "local",
          },
        ]}
        selectedModelId="claude_code_local::claude-sonnet-4-5"
        onSelectProvider={vi.fn()}
        onSelectModelSelectionMode={vi.fn()}
        onSelectModel={vi.fn()}
        reasoningOptions={[]}
        selectedEffort={null}
        onSelectEffort={vi.fn()}
        reasoningSupported={false}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    const modelButton = screen.getByRole("button", { name: "Model" });
    expect(modelButton.textContent).toContain("Claude Sonnet 4.5");
    expect(modelButton.textContent).toContain("Auto");
    expect(modelButton.textContent).toContain("Local");
    expect(modelButton.textContent).toContain("Ready");
    expect(modelButton.getAttribute("title")).toContain("Auto route");
    expect(modelButton.getAttribute("title")).toContain(
      "Local Claude Code is ready on this machine."
    );

    fireEvent.click(modelButton);
    expect(
      screen
        .getByRole("menuitemradio", { name: /Use recommended route/i })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitemradio", { name: /Claude Sonnet 4\.5/i })
        .getAttribute("aria-checked")
    ).toBe("false");
  });

  it("lists only the deduplicated models for the selected provider family", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "anthropic::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            pool: "claude",
            provider: "anthropic",
            available: true,
          },
          {
            id: "claude_code_local::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            pool: "claude_code_local",
            provider: "claude_code_local",
            available: true,
          },
        ]}
        selectedModelId="claude_code_local::claude-sonnet-4-5"
        onSelectModel={vi.fn()}
        reasoningOptions={[]}
        selectedEffort={null}
        onSelectEffort={vi.fn()}
        reasoningSupported={false}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));

    const providerMenu = screen.getByRole("menu", { name: "Model providers" });
    fireEvent.click(within(providerMenu).getByRole("menuitem", { name: "Claude" }));

    const menu = screen.getByRole("menu", { name: "Claude models" });
    expect(within(menu).getByRole("menuitemradio", { name: "Claude Sonnet 4.5" })).toBeTruthy();
    expect(within(menu).queryByText("GPT-5.4")).toBeNull();
  });

  it("does not hijack pointerdown events from selection menus inside the composer meta row", () => {
    const onSelectModel = vi.fn();
    const onSelectModelSelectionMode = vi.fn();
    const onSelectAutoRoute = vi.fn();

    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        modelSelectionMode="manual"
        onSelectAutoRoute={onSelectAutoRoute}
        onSelectModelSelectionMode={onSelectModelSelectionMode}
        models={[
          {
            id: "anthropic::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            pool: "claude",
            provider: "anthropic",
            available: true,
          },
          {
            id: "claude_code_local::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            pool: "claude_code_local",
            provider: "claude_code_local",
            available: true,
          },
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            pool: "codex",
            provider: "openai",
            available: true,
          },
        ]}
        selectedModelId="openai::gpt-5.4"
        onSelectModel={onSelectModel}
        reasoningOptions={[]}
        selectedEffort={null}
        onSelectEffort={vi.fn()}
        reasoningSupported={false}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    const autoOption = screen.getByRole("menuitemradio", {
      name: /Use recommended route/i,
    });
    expect(autoOption.getAttribute("aria-checked")).toBe("false");
    expect(
      screen.getByRole("menuitemradio", { name: "GPT-5.4" }).getAttribute("aria-checked")
    ).toBe("true");
    fireEvent.pointerDown(autoOption);
    fireEvent.click(autoOption);
    expect(onSelectAutoRoute).toHaveBeenCalledWith("codex");
    expect(onSelectModelSelectionMode).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    const claudeProvider = screen.getByRole("menuitem", { name: "Claude" });
    fireEvent.pointerDown(claudeProvider);
    fireEvent.click(claudeProvider);
    const claudeModel = screen.getByRole("menuitemradio", { name: "Claude Sonnet 4.5" });
    fireEvent.pointerDown(claudeModel);
    fireEvent.click(claudeModel);
    expect(onSelectModel).toHaveBeenCalledWith("claude_code_local::claude-sonnet-4-5");
  });

  it("renders a single collaboration toggle when plan mode is available", () => {
    const onSelectCollaborationMode = vi.fn();
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={PLAN_COLLABORATION_MODES}
        selectedCollaborationModeId="default"
        onSelectCollaborationMode={onSelectCollaborationMode}
        models={[
          {
            id: "gpt-5",
            model: "gpt-5",
            displayName: "GPT-5",
            available: true,
          },
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="full-access"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    const modeButton = screen.getByRole("button", { name: "Chat" });
    expect(modeButton.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Plan" })).toBeNull();
    expect(screen.queryByLabelText("Composer summary")).toBeNull();
    expect(screen.queryByText(/chat lane/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Execution path" })).toBeNull();

    fireEvent.click(modeButton);

    expect(onSelectCollaborationMode).toHaveBeenCalledWith("plan");
  });

  it("places the chat or plan toggle ahead of the model control in the meta row", () => {
    const { container } = render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={PLAN_COLLABORATION_MODES}
        selectedCollaborationModeId="default"
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "gpt-5",
            model: "gpt-5",
            displayName: "GPT-5",
            available: true,
          },
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    const modeButton = screen.getByRole("button", { name: "Chat" });
    const modelWrap = container.querySelector(".composer-select-wrap--model-provider");
    if (!modelWrap) {
      throw new Error("Model wrap not found");
    }

    expect(
      modeButton.compareDocumentPosition(modelWrap) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
  });

  it("shows the active plan mode as a single toggle and switches back to Chat", () => {
    const onSelectCollaborationMode = vi.fn();
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={PLAN_COLLABORATION_MODES}
        selectedCollaborationModeId="plan"
        onSelectCollaborationMode={onSelectCollaborationMode}
        models={[
          {
            id: "gpt-5",
            model: "gpt-5",
            displayName: "GPT-5",
            available: true,
          },
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    const modeButton = screen.getByRole("button", { name: "Plan" });
    expect(modeButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Chat" })).toBeNull();

    fireEvent.click(modeButton);

    expect(onSelectCollaborationMode).toHaveBeenCalledWith("default");
  });

  it("shows a Chat mode button when no collaboration modes are available", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "gpt-5",
            model: "gpt-5",
            displayName: "GPT-5",
            available: true,
          },
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByLabelText("Composer summary")).toBeNull();
    expect(screen.queryByRole("button", { name: "Execution path" })).toBeNull();
  });

  it("keeps context usage out of the meta control row once the workspace rail owns it", () => {
    const { container } = render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "gpt-5",
            model: "gpt-5",
            displayName: "GPT-5",
            available: true,
          },
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="full-access"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Context usage")).toBeNull();
    expect(screen.queryByText("2.4k / 8.0k tokens (30%)")).toBeNull();
    expect(container.querySelector('[data-core-loop-meta-rail="true"]')).toBeTruthy();
  });

  it("keeps the selected unavailable model visible in the summary and menu", () => {
    const { container } = render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
          {
            id: "model-unavailable",
            model: "model-unavailable",
            displayName: "Model Unavailable",
            available: false,
          },
        ]}
        selectedModelId="model-unavailable"
        onSelectModel={vi.fn()}
        reasoningOptions={[]}
        selectedEffort={null}
        onSelectEffort={vi.fn()}
        reasoningSupported={false}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Model" }).textContent).toContain(
      "Model Unavailable"
    );

    const modelButtons = within(container).getAllByRole("button", { name: "Model" });
    const modelButton = modelButtons.at(-1);
    if (!modelButton) {
      throw new Error("Model button not found");
    }
    fireEvent.click(modelButton);

    const menus = screen.getAllByRole("menu", { name: "Default models" });
    const menu = menus.at(-1);
    if (!menu) {
      throw new Error("Model menu not found");
    }
    expect(within(menu).getByText("Model Unavailable")).toBeTruthy();
    expect(within(menu).getByText("Unavailable")).toBeTruthy();
    expect(within(menu).getByText("Model Available")).toBeTruthy();
  });

  it("does not render access controls in the meta row", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Agent access" })).toBeNull();
  });

  it("shows disabled hybrid and local Codex CLI execution options when CLI is unavailable", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[
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
        ]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Execution path" }));

    const menu = screen.getByRole("listbox", { name: "Execution path" });
    expect(within(menu).getByRole("option", { name: "Runtime" })).toBeTruthy();
    expect(
      within(menu)
        .getByRole("option", { name: "Hybrid (Local Codex CLI unavailable)" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      within(menu)
        .getByRole("option", { name: "Local Codex CLI unavailable" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("uses a compact execution trigger label for local Codex CLI selections", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[
          { value: "runtime", label: "Runtime" },
          { value: "hybrid", label: "Hybrid" },
          { value: "local-cli", label: "Local Codex CLI (1.2.3)" },
        ]}
        selectedExecutionMode="local-cli"
        onSelectExecutionMode={vi.fn()}
      />
    );

    const executionButton = screen.getByRole("button", { name: "Execution path" });
    expect(within(executionButton).getByText("Codex CLI")).toBeTruthy();
    expect(within(executionButton).queryByText("Local Codex CLI (1.2.3)")).toBeNull();

    fireEvent.click(executionButton);

    const menu = screen.getByRole("listbox", { name: "Execution path" });
    expect(within(menu).getByRole("option", { name: "Local Codex CLI (1.2.3)" })).toBeTruthy();
  });

  it("renders distinct execution icons for runtime, hybrid, and local Codex CLI modes", () => {
    const { container, rerender } = render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[
          { value: "runtime", label: "Runtime" },
          { value: "hybrid", label: "Hybrid" },
          { value: "local-cli", label: "Local Codex CLI" },
        ]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(
      container.querySelector(".composer-icon--execution")?.getAttribute("data-execution-mode")
    ).toBe("runtime");
    expect(
      container.querySelector(".composer-icon--execution")?.getAttribute("data-execution-icon")
    ).toBe("runtime-host");

    rerender(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[
          { value: "runtime", label: "Runtime" },
          { value: "hybrid", label: "Hybrid" },
          { value: "local-cli", label: "Local Codex CLI" },
        ]}
        selectedExecutionMode="hybrid"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(
      container.querySelector(".composer-icon--execution")?.getAttribute("data-execution-mode")
    ).toBe("hybrid");
    expect(
      container.querySelector(".composer-icon--execution")?.getAttribute("data-execution-icon")
    ).toBe("hybrid-bridge");

    rerender(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[
          { value: "runtime", label: "Runtime" },
          { value: "hybrid", label: "Hybrid" },
          { value: "local-cli", label: "Local Codex CLI" },
        ]}
        selectedExecutionMode="local-cli"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(
      container.querySelector(".composer-icon--execution")?.getAttribute("data-execution-mode")
    ).toBe("local-cli");
    expect(
      container.querySelector(".composer-icon--execution")?.getAttribute("data-execution-icon")
    ).toBe("codex");
  });

  it("renders a remote backend picker in the bottom rail and dispatches selection changes", () => {
    const onSelectRemoteBackendId = vi.fn();
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
        remoteBackendOptions={[
          { value: "backend-remote-a", label: "Remote A" },
          { value: "backend-remote-b", label: "Remote B" },
        ]}
        selectedRemoteBackendId="backend-remote-b"
        onSelectRemoteBackendId={onSelectRemoteBackendId}
      />
    );

    const backendButton = screen.getByRole("button", { name: "Remote backend" });
    expect(within(backendButton).getByText("Remote B")).toBeTruthy();

    fireEvent.click(backendButton);

    const menu = screen.getByRole("listbox", { name: "Remote backend" });
    fireEvent.click(within(menu).getByRole("option", { name: "Remote A" }));

    expect(onSelectRemoteBackendId).toHaveBeenCalledWith("backend-remote-a");
  });

  it("keeps backend preference visible without rendering runtime placement in composer", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={[]}
        selectedCollaborationModeId={null}
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "model-available",
            model: "model-available",
            displayName: "Model Available",
            available: true,
          },
        ]}
        selectedModelId="model-available"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
        remoteBackendOptions={[{ value: "backend-remote-a", label: "Remote A" }]}
        selectedRemoteBackendId="backend-remote-a"
        onSelectRemoteBackendId={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Backend preference")).toBeTruthy();
    expect(screen.queryByLabelText("Latest runtime placement")).toBeNull();
  });

  it("keeps core controls visible instead of hiding them behind More", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={PLAN_COLLABORATION_MODES}
        selectedCollaborationModeId="default"
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "gpt-5",
            model: "gpt-5",
            displayName: "GPT-5",
            available: true,
          },
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium", "high"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[
          { value: "runtime", label: "Runtime" },
          { value: "hybrid", label: "Hybrid" },
        ]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Thinking mode" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Agent access" })).toBeNull();
    expect(screen.getByRole("button", { name: "Execution path" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More composer controls" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Thinking mode" }));
    expect(screen.getByRole("listbox", { name: "Thinking mode" })).toBeTruthy();
  });

  it("keeps meta overflow chrome on a flatter shell instead of a floating gradient popover", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerMetaBar.styles.css.ts");

    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface) 96%, transparent), color-mix(in srgb, var(--ds-surface-command) 92%, transparent))"
    );
    expect(source).not.toContain(
      'boxShadow: "0 22px 44px color-mix(in srgb, var(--ds-shadow-color) 14%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 10px 22px -24px color-mix(in srgb, var(--ds-shadow-color) 14%, transparent)"'
    );
    expect(source).not.toContain('borderRadius: "18px"');
  });

  it("keeps supporting autodrive/meta cards on muted shell surfaces instead of hero chrome", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerMetaBar.styles.css.ts");

    expect(source).not.toContain(
      "linear-gradient(180deg, color-mix(in srgb, var(--ds-surface) 98%, transparent), color-mix(in srgb, var(--ds-surface-hover) 68%, transparent))"
    );
    expect(source).not.toContain(
      'boxShadow: "0 16px 30px -24px color-mix(in srgb, var(--ds-shadow-color) 18%, transparent)"'
    );
    expect(source).not.toContain(
      'background: "color-mix(in srgb, var(--ds-surface-command) 80%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-primary) 12%, transparent) inset"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 0 0 4px color-mix(in srgb, var(--color-primary) 12%, transparent)"'
    );
  });

  it("keeps compact context markers on muted status chrome instead of inset accent rings", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerMetaBarSummary.styles.css.ts");

    expect(source).not.toContain('boxShadow: "0 0 0 1px var(--ds-border-strong) inset"');
    expect(source).not.toContain('background: "var(--ds-surface-command)"');
  });

  it("keeps composer meta icon sizes and stroke weights on a single shared scale", () => {
    const styleSource = readRelativeSource(import.meta.dirname, "ComposerMetaBar.styles.css.ts");
    const controlsSource = readRelativeSource(import.meta.dirname, "ComposerMetaBarControls.tsx");

    expect(styleSource).toContain(
      'export const iconModel = style({ width: "14px", height: "14px" });'
    );
    expect(styleSource).toContain(
      'export const iconGraphic = style({ width: "14px", height: "14px" });'
    );
    expect(styleSource).toContain(
      'export const iconGraphicModel = style({ width: "14px", height: "14px" });'
    );
    expect(controlsSource).toContain("const META_ICON_SIZE = 14;");
    expect(controlsSource).toContain("const META_ICON_STROKE_WIDTH = 1.8;");
    expect(controlsSource).toContain("const META_MODE_ICON_STROKE_WIDTH = 1.9;");
    expect(controlsSource).not.toContain('strokeWidth="1.3"');
    expect(controlsSource).not.toContain("size={16}");
  });

  it("keeps the chat and plan toggle typography aligned with the other meta controls", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerMetaBarControls.styles.css.ts");
    const modeToggleRule = getExportedStyleBlock(source, "modeToggle");

    expect(modeToggleRule).toContain('fontSize: "var(--font-size-meta)"');
    expect(modeToggleRule).toContain("fontWeight: 600");
    expect(modeToggleRule).toContain('lineHeight: "var(--line-height-chrome)"');
    expect(modeToggleRule).toContain('display: "inline-grid"');
    expect(modeToggleRule).toContain('gridTemplateColumns: "14px minmax(0, 1fr)"');
    expect(modeToggleRule).toContain('width: "74px"');
    expect(modeToggleRule).toContain('padding: "1px 9px 1px 9px"');
    expect(modeToggleRule).toContain('borderRadius: "10px"');
    expect(modeToggleRule).toContain(
      'background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)"'
    );
  });

  it("keeps composer meta selects on a single modern control surface instead of nested capsules", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerMetaBar.styles.css.ts");
    const selectSource = readRelativeSource(import.meta.dirname, "ComposerSelectMenu.css.ts");
    const controlsSource = readRelativeSource(import.meta.dirname, "ComposerMetaBarControls.tsx");
    const selectWrapRule = getExportedStyleBlock(source, "selectWrap");
    const selectTriggerRule = getExportedStyleBlock(source, "selectTrigger");

    expect(selectWrapRule).toContain('borderRadius: "8px"');
    expect(selectWrapRule).toContain('border: "1px solid transparent"');
    expect(selectWrapRule).toContain('background: "transparent"');
    expect(selectWrapRule).toContain('padding: "1px 7px 1px 7px"');
    expect(selectWrapRule).toContain('overflow: "hidden"');
    expect(selectWrapRule).toContain('boxShadow: "none"');
    expect(selectWrapRule).toContain("vars: flatTriggerChromeVars");
    expect(selectWrapRule).toContain(
      'background: "color-mix(in srgb, var(--ds-surface-hover) 78%, transparent)"'
    );

    expect(selectTriggerRule).toContain('borderRadius: "0"');
    expect(selectTriggerRule).toContain('background: "transparent"');
    expect(selectTriggerRule).toContain('border: "none"');
    expect(selectTriggerRule).toContain('minHeight: "24px"');
    expect(selectTriggerRule).toContain('lineHeight: "var(--line-height-chrome)"');
    expect(selectTriggerRule).not.toContain('backgroundImage: "var(--ds-select-trigger-gloss)"');

    expect(source).toContain("export const selectMenu = style([");
    expect(source).toContain("flatMenu,");
    expect(selectSource).toContain("export const flatTriggerChromeVars = {");
    expect(selectSource).toContain('"--ds-select-trigger-backdrop": "none"');
    expect(selectSource).toContain('"--ds-select-trigger-gloss": "none"');
    expect(selectSource).toContain('"--ds-select-menu-bg"');
    expect(selectSource).toContain('"--ds-select-menu-gloss": "none"');
    expect(selectSource).toContain('"--ds-select-menu-shadow": overlayValues.menuShadow');
    expect(selectSource).toContain('"--ds-select-menu-backdrop": overlayValues.menuBackdrop');

    expect(source).toContain("export const selectOption = style([compactOption]);");
    expect(selectSource).toContain("minHeight: statusChipValues.minHeight");
    expect(selectSource).toContain("padding: statusChipValues.optionPadding");
    expect(selectSource).toContain('borderRadius: "8px"');
    expect(source).toContain("approval: [");
    expect(source).toContain("execution: [");
    expect(source).toContain("multilineOptionLabel,");
    expect(controlsSource).toContain("data-ds-select-anchor");
  });

  it("keeps the chat and plan toggle on a fixed slot instead of recalculating width inline", () => {
    render(
      <ComposerMetaBar
        disabled={false}
        collaborationModes={PLAN_COLLABORATION_MODES}
        selectedCollaborationModeId="default"
        onSelectCollaborationMode={vi.fn()}
        models={[
          {
            id: "gpt-5",
            model: "gpt-5",
            displayName: "GPT-5",
            available: true,
          },
        ]}
        selectedModelId="gpt-5"
        onSelectModel={vi.fn()}
        reasoningOptions={["medium"]}
        selectedEffort="medium"
        onSelectEffort={vi.fn()}
        reasoningSupported={true}
        accessMode="on-request"
        onSelectAccessMode={vi.fn()}
        executionOptions={[{ value: "runtime", label: "Runtime" }]}
        selectedExecutionMode="runtime"
        onSelectExecutionMode={vi.fn()}
      />
    );

    const modeButton = screen.getByRole("button", { name: "Chat" });
    expect(modeButton.getAttribute("style")).toBeNull();
  });

  it("keeps the autodrive toggle on the same compact control scale as the composer meta rail", () => {
    const autoDriveSource = readRelativeSource(
      import.meta.dirname,
      "ComposerMetaBarAutoDriveMeta.styles.css.ts"
    );

    expect(autoDriveSource).toContain('width: "60px"');
    expect(autoDriveSource).toContain('height: "26px"');
    expect(autoDriveSource).toContain('width: "20px"');
    expect(autoDriveSource).toContain('letterSpacing: "0.02em"');
  });

  it("keeps composer meta dropdowns on flat shared chrome instead of frosted popovers", () => {
    const selectSource = readRelativeSource(import.meta.dirname, "ComposerSelectMenu.css.ts");

    expect(selectSource).toContain('"--ds-select-menu-bg": overlayValues.menuSurface');
    expect(selectSource).toContain('"--ds-select-menu-border": overlayValues.menuBorder');
    expect(selectSource).toContain('"--ds-select-menu-gloss": "none"');
    expect(selectSource).toContain('"--ds-select-menu-shadow": overlayValues.menuShadow');
    expect(selectSource).toContain('"--ds-select-menu-backdrop": overlayValues.menuBackdrop');
    expect(selectSource).not.toContain('"--ds-select-menu-bg": "transparent"');

    expect(selectSource).toContain("fontSize: statusChipValues.fontSize");
    expect(selectSource).toContain("lineHeight: statusChipValues.lineHeight");
    expect(selectSource).toContain("minHeight: statusChipValues.minHeight");
    expect(selectSource).toContain("padding: statusChipValues.optionPadding");
    expect(selectSource).toContain('borderRadius: "8px"');
    expect(selectSource).toContain('"--ds-select-option-hover-shadow": "none"');
    expect(selectSource).toContain('"--ds-select-option-selected-shadow": "none"');
    expect(selectSource).toContain("export const multilineOptionLabel = style({");
    expect(selectSource).toContain('"--ds-select-option-label-word-break": "break-word"');
  });
});
