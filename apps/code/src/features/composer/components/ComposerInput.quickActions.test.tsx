/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerInput } from "./ComposerInput";
import * as styles from "./ComposerInput.styles.css";

let composerInputRowWidth = 900;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  composerInputRowWidth = 900;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      if ((this as HTMLElement).classList?.contains("composer-input-row")) {
        return composerInputRowWidth;
      }
      return 0;
    },
  });
});

type HarnessProps = {
  initialText?: string;
  initialSelection?: number | null;
  isProcessing?: boolean;
  canQueue?: boolean;
  onQueue?: () => void;
  initialEffort?: string | null;
  reasoningOptions?: string[];
  onSelectEffort?: (effort: string) => void;
  initialFastMode?: boolean;
  onToggleFastMode?: (enabled: boolean) => void;
  showExpand?: boolean;
  children?: ReactNode;
};

function ComposerInputHarness({
  initialText = "Check",
  initialSelection = 5,
  isProcessing = false,
  canQueue = false,
  onQueue,
  initialEffort = "medium",
  reasoningOptions = ["low", "medium", "high"],
  onSelectEffort,
  initialFastMode = false,
  onToggleFastMode,
  showExpand = false,
  children,
}: HarnessProps) {
  const [text, setText] = useState(initialText);
  const setSelectionStart = useState<number | null>(initialSelection)[1];
  const [selectedEffort, setSelectedEffort] = useState<string | null>(initialEffort);
  const [fastModeEnabled, setFastModeEnabled] = useState(initialFastMode);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <ComposerInput
      text={text}
      disabled={false}
      sendLabel="Send"
      canStop={false}
      canSend={text.trim().length > 0}
      canQueue={canQueue}
      isProcessing={isProcessing}
      onStop={() => undefined}
      onSend={() => undefined}
      onQueue={canQueue ? (onQueue ?? (() => undefined)) : undefined}
      isExpanded={false}
      onToggleExpand={showExpand ? () => undefined : undefined}
      onAddAttachment={() => undefined}
      reasoningOptions={reasoningOptions}
      selectedEffort={selectedEffort}
      onSelectEffort={(effort) => {
        setSelectedEffort(effort);
        onSelectEffort?.(effort);
      }}
      fastModeEnabled={fastModeEnabled}
      onToggleFastMode={(enabled) => {
        setFastModeEnabled(enabled);
        onToggleFastMode?.(enabled);
      }}
      reasoningSupported={reasoningOptions.length > 0}
      onTextChange={(next, nextSelection) => {
        setText(next);
        setSelectionStart(nextSelection);
      }}
      onSelectionChange={setSelectionStart}
      onKeyDown={() => undefined}
      textareaRef={textareaRef}
      suggestionsOpen={false}
      suggestions={[]}
      highlightIndex={0}
      onHighlightIndex={() => undefined}
      onSelectSuggestion={() => undefined}
      bottomContent={<div data-testid="workspace-bar">workspace</div>}
    >
      {children}
    </ComposerInput>
  );
}

describe("ComposerInput actions", () => {
  it("renders primary controls with accessible labels", () => {
    render(<ComposerInputHarness />);

    expect(screen.getByRole("button", { name: "Open composer menu" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add attachment" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("does not expose input expand actions even when expand support is provided", () => {
    render(<ComposerInputHarness showExpand={true} />);

    expect(screen.queryByRole("button", { name: "Expand input" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse input" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open composer menu" }));

    expect(screen.queryByText("Expand input")).toBeNull();
    expect(screen.queryByText("Collapse input")).toBeNull();
  });

  it("opens the composer menu with attachments and fast speed controls", () => {
    const { container } = render(<ComposerInputHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Open composer menu" }));

    expect(screen.getByText("Add files")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Fast speed" })).toBeTruthy();
    expect(screen.queryByText("Plan mode")).toBeNull();
    expect(container.querySelector(".composer-input-area")?.classList).toContain(
      styles.inputAreaSuggestionsOpen
    );
  });

  it("toggles fast speed through the composer menu", () => {
    const onToggleFastMode = vi.fn();
    render(<ComposerInputHarness onToggleFastMode={onToggleFastMode} />);

    fireEvent.click(screen.getByRole("button", { name: "Open composer menu" }));
    fireEvent.click(screen.getByRole("switch", { name: "Fast speed" }));

    expect(onToggleFastMode).toHaveBeenCalledTimes(1);
    expect(onToggleFastMode).toHaveBeenCalledWith(true);
    expect(screen.getByText("Add files")).toBeTruthy();
    expect((screen.getByRole("switch", { name: "Fast speed" }) as HTMLInputElement).checked).toBe(
      true
    );
  });

  it("calls queue callback when queue button is clicked", () => {
    const onQueue = vi.fn();
    render(<ComposerInputHarness initialText="next step" canQueue={true} onQueue={onQueue} />);

    fireEvent.click(screen.getByRole("button", { name: "Queue message" }));

    expect(onQueue).toHaveBeenCalledTimes(1);
  });

  it("shows run-state hints when queue is available during processing", () => {
    render(<ComposerInputHarness initialText="next step" isProcessing={true} canQueue={true} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea.getAttribute("placeholder")).toContain("Run active.");
    expect(textarea.getAttribute("placeholder")).toContain("Tab to queue.");
    expect(textarea.getAttribute("placeholder")).toContain("Shift+Enter for a new line.");
    expect(screen.queryByText("Run active")).toBeNull();
    expect(screen.queryByText("Queue ready")).toBeNull();
  });

  it("renders composer meta content in the bottom row instead of above the textarea", () => {
    const { container } = render(
      <ComposerInputHarness>
        <div data-testid="meta-bar">meta</div>
      </ComposerInputHarness>
    );

    const inputRow = container.querySelector(".composer-input-row");
    const draftZone = container.querySelector('[data-composer-draft-zone="true"]');
    if (!inputRow || !draftZone) {
      throw new Error("Composer layout containers not found");
    }

    expect(within(inputRow as HTMLElement).getByTestId("meta-bar")).toBeTruthy();
    expect(within(draftZone as HTMLElement).queryByTestId("meta-bar")).toBeNull();
  });

  it("renders the textarea inside the draft-zone scaffold", () => {
    const { container } = render(<ComposerInputHarness />);

    const draftZone = container.querySelector('[data-composer-draft-zone="true"]');
    if (!draftZone) {
      throw new Error("Composer draft zone not found");
    }

    expect(
      within(draftZone as HTMLElement).getByRole("textbox", { name: "Composer draft" })
    ).toBeTruthy();
  });

  it("starts the draft textarea at a single-line height", () => {
    render(<ComposerInputHarness />);

    const textarea = screen.getByRole("textbox", { name: "Composer draft" });

    expect(textarea.getAttribute("rows")).toBe("1");
    expect((textarea as HTMLTextAreaElement).style.minHeight).toBe("40px");
    expect((textarea as HTMLTextAreaElement).style.height).toBe("40px");
  });

  it("keeps the composer input shell flatter than the older gradient card treatment", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "ComposerInput.styles.css.ts"),
      "utf8"
    );

    expect(source).toContain('borderTop: "none"');
    expect(source).not.toContain(
      '"linear-gradient(180deg, color-mix(in srgb, var(--ds-surface-card) 97%, transparent), color-mix(in srgb, var(--ds-surface-composer) 94%, var(--ds-surface-muted) 6%))"'
    );
    expect(source).not.toContain('borderRadius: "24px"');
    expect(source).not.toContain(
      '"0 14px 40px color-mix(in srgb, var(--ds-shadow-color) 8%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 8px 18px -14px color-mix(in srgb, var(--color-primary) 24%, transparent)"'
    );
  });

  it("keeps add files and fast speed on the same menu-item visual baseline", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "ComposerInput.styles.css.ts"),
      "utf8"
    );

    expect(source).toContain("flatMenu,");
    expect(source).toContain('"--ds-popover-item-hit-area": "32px"');
    expect(source).toContain('"--ds-popover-item-gap": "10px"');
    expect(source).toContain('padding: "4px"');
    expect(source).toContain('gap: "4px"');
    expect(source).toContain('minHeight: "var(--ds-popover-item-hit-area, 32px)"');
    expect(source).toContain('gap: "var(--ds-popover-item-gap, 10px)"');
    expect(source).toContain('paddingInline: "var(--ds-popover-item-padding-inline, 10px)"');
    expect(source).toContain('color: "var(--ds-popover-item-text, var(--ds-text-primary))"');
    expect(source).toContain('color: "currentColor"');
    expect(source).toContain("fontWeight: 500");
    expect(source).toContain('color: "inherit"');
    expect(source).toContain('textOverflow: "ellipsis"');
  });

  it("renders bottom content below the footer row", () => {
    const { container } = render(<ComposerInputHarness />);

    const inputArea = container.querySelector(".composer-input-area");
    const inputRow = container.querySelector(".composer-input-row");
    const bottomContent = container.querySelector(".composer-bottom-content");
    const footerBar = container.querySelector('[data-composer-footer-bar="true"]');
    if (!inputArea || !inputRow || !bottomContent || !footerBar) {
      throw new Error("Composer layout containers not found");
    }

    expect(within(bottomContent as HTMLElement).getByTestId("workspace-bar")).toBeTruthy();
    expect(within(footerBar as HTMLElement).getByTestId("workspace-bar")).toBeTruthy();
    expect(inputArea.lastElementChild).toBe(footerBar);
    expect(inputRow.nextElementSibling).toBe(footerBar);
    expect(bottomContent.parentElement).toBe(footerBar);
  });

  it("switches to compact footer mode before hiding queue affordances", () => {
    composerInputRowWidth = 680;
    render(<ComposerInputHarness initialText="next step" canQueue={true} showExpand={true} />);

    const inputRow = document.querySelector(".composer-input-row");
    expect(inputRow?.getAttribute("data-footer-layout")).toBe("compact");
    expect(screen.queryByRole("button", { name: "Expand input" })).toBeNull();
    expect(screen.getByRole("button", { name: "Queue message" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("moves queue into overflow in minimal footer mode while preserving send", () => {
    composerInputRowWidth = 560;
    render(<ComposerInputHarness initialText="next step" canQueue={true} showExpand={true} />);

    const inputRow = document.querySelector(".composer-input-row");
    expect(inputRow?.getAttribute("data-footer-layout")).toBe("minimal");
    expect(screen.queryByRole("button", { name: "Expand input" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Queue message" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open composer menu" }));
    expect(screen.getByText("Queue message")).toBeTruthy();
  });
});
