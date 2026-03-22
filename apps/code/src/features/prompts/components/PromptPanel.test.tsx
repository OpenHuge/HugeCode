/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomPromptOption } from "../../../types";
import { PromptPanel } from "./PromptPanel";

afterEach(() => {
  cleanup();
});

const makePrompt = (overrides: Partial<CustomPromptOption> = {}): CustomPromptOption => ({
  name: "summarize",
  path: "/tmp/summarize.md",
  description: "Summarize a target",
  content: "Summarize the current target",
  scope: "workspace",
  ...overrides,
});

function renderPanel(
  prompt: CustomPromptOption,
  overrides: Partial<React.ComponentProps<typeof PromptPanel>> = {}
) {
  const props: React.ComponentProps<typeof PromptPanel> = {
    prompts: [prompt],
    workspacePath: "/tmp/workspace",
    filePanelMode: "prompts",
    onFilePanelModeChange: vi.fn(),
    onSendPrompt: vi.fn(),
    onSendPromptToNewAgent: vi.fn(),
    onCreatePrompt: vi.fn(),
    onUpdatePrompt: vi.fn(),
    onDeletePrompt: vi.fn(),
    onMovePrompt: vi.fn(),
    onRevealWorkspacePrompts: vi.fn(),
    onRevealGeneralPrompts: vi.fn(),
    canRevealGeneralPrompts: true,
    ...overrides,
  };
  render(<PromptPanel {...props} />);
  return props;
}

describe("PromptPanel", () => {
  it("sends custom commands with plain slash syntax", () => {
    const props = renderPanel(makePrompt());

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(props.onSendPrompt).toHaveBeenCalledWith("/summarize");
  });

  it("uses the legacy alias when a custom command collides with a built-in name", () => {
    const props = renderPanel(makePrompt({ name: "review", path: "/tmp/review.md" }));

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(props.onSendPrompt).toHaveBeenCalledWith("/prompts:review");
  });
});
