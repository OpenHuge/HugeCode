// @vitest-environment jsdom

import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TerminalDock } from "./TerminalDock";

describe("TerminalDock", () => {
  it("renders quick actions and invokes callbacks", () => {
    const onClearActiveTerminal = vi.fn();
    const onRestartActiveTerminal = vi.fn();
    const onInterruptActiveTerminal = vi.fn();

    const { container } = render(
      <TerminalDock
        isOpen
        terminals={[{ id: "terminal-1", title: "Terminal 1" }]}
        activeTerminalId="terminal-1"
        onSelectTerminal={() => undefined}
        onNewTerminal={() => undefined}
        onCloseTerminal={() => undefined}
        onClearActiveTerminal={onClearActiveTerminal}
        onRestartActiveTerminal={onRestartActiveTerminal}
        onInterruptActiveTerminal={onInterruptActiveTerminal}
        canClearActiveTerminal
        canRestartActiveTerminal
        canInterruptActiveTerminal
        sessionStatus="ready"
        terminalNode={<div>Terminal content</div>}
      />
    );

    const scoped = within(container);
    expect(scoped.getByText("Ready")).toBeTruthy();
    expect(
      container.querySelector(
        '.terminal-status-badge[data-status-tone="success"][data-shape="chip"][data-size="md"]'
      )
    ).toBeTruthy();
    fireEvent.click(scoped.getByRole("button", { name: "Clear terminal output" }));
    fireEvent.click(scoped.getByRole("button", { name: "Restart terminal session" }));
    fireEvent.click(scoped.getByRole("button", { name: "Interrupt terminal session" }));

    expect(onClearActiveTerminal).toHaveBeenCalledTimes(1);
    expect(onRestartActiveTerminal).toHaveBeenCalledTimes(1);
    expect(onInterruptActiveTerminal).toHaveBeenCalledTimes(1);
  });

  it("disables quick actions when active session is unavailable", () => {
    const { container } = render(
      <TerminalDock
        isOpen
        terminals={[{ id: "terminal-1", title: "Terminal 1" }]}
        activeTerminalId="terminal-1"
        onSelectTerminal={() => undefined}
        onNewTerminal={() => undefined}
        onCloseTerminal={() => undefined}
        onClearActiveTerminal={() => undefined}
        onRestartActiveTerminal={() => undefined}
        onInterruptActiveTerminal={() => undefined}
        canClearActiveTerminal={false}
        canRestartActiveTerminal={false}
        canInterruptActiveTerminal={false}
        sessionStatus="connecting"
        terminalNode={<div>Terminal content</div>}
      />
    );

    const scoped = within(container);
    expect(scoped.getByText("Connecting")).toBeTruthy();
    expect(
      container.querySelector(
        '.terminal-status-badge[data-status-tone="warning"][data-shape="chip"][data-size="md"]'
      )
    ).toBeTruthy();
    expect(
      (scoped.getByRole("button", { name: "Clear terminal output" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (
        scoped.getByRole("button", {
          name: "Restart terminal session",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (scoped.getByRole("button", { name: "Interrupt terminal session" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
