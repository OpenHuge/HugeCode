/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRelativeSource } from "../../../test/styleSource";
import { ComposerQueue } from "./ComposerQueue";

afterEach(() => {
  cleanup();
});

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {},
}));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: {
    new: vi.fn(),
  },
  MenuItem: {
    new: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));

describe("ComposerQueue", () => {
  const queuedMessages = [
    {
      id: "q-1",
      text: "Run lint and report failures",
      createdAt: 1,
      images: [],
    },
    {
      id: "q-2",
      text: "",
      createdAt: 2,
      images: ["/tmp/screenshot.png"],
    },
  ];

  it("renders queue count and items", () => {
    render(<ComposerQueue queuedMessages={queuedMessages} />);

    expect(document.querySelector('[data-composer-queue-panel="true"]')).toBeTruthy();
    expect(screen.getByTitle("2 queued")).toBeTruthy();
    expect(screen.getByText("Run lint and report failures")).toBeTruthy();
    expect(screen.getByText("Attachment · 1 attachment")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Queue item menu" })).toHaveLength(2);
  });

  it("keeps the queue shell flatter than the earlier raised card treatment", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerQueue.styles.css.ts");

    expect(source).not.toContain("linear-gradient(180deg");
    expect(source).not.toContain('borderRadius: "16px"');
    expect(source).not.toContain(
      '"0 12px 28px -24px color-mix(in srgb, var(--ds-shadow-color) 24%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ds-color-white) 6%, transparent)"'
    );
    expect(source).not.toContain(
      'boxShadow: "0 10px 22px -24px color-mix(in srgb, var(--ds-shadow-color) 18%, transparent)"'
    );
  });

  it("collapses and expands queued items", () => {
    render(<ComposerQueue queuedMessages={queuedMessages} />);

    const toggle = screen.getByRole("button", { name: "Collapse queued messages" });
    fireEvent.click(toggle);

    expect(screen.queryByText("Run lint and report failures")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand queued messages" })).toBeTruthy();
  });

  it("shows queue pause reason when provided", () => {
    render(
      <ComposerQueue
        queuedMessages={queuedMessages}
        queuePausedReason="Paused - waiting for plan accept/changes."
      />
    );

    expect(screen.getByText("Paused - waiting for plan accept/changes.")).toBeTruthy();
  });
});
