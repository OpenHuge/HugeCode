/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LaunchScriptPopoverShell } from "./LaunchScriptPopoverShell";

describe("LaunchScriptPopoverShell", () => {
  it("wires run and context-menu edit actions", () => {
    const onRun = vi.fn();
    const onOpenEditor = vi.fn();

    render(
      <LaunchScriptPopoverShell
        editorOpen={false}
        buttonAriaLabel="Run launch script"
        buttonTitle="Run launch script"
        buttonIcon={<span aria-hidden>icon</span>}
        onRun={onRun}
        onOpenEditor={onOpenEditor}
        onCloseEditor={vi.fn()}
      >
        <div>Popover content</div>
      </LaunchScriptPopoverShell>
    );

    const button = screen.getByRole("button", { name: "Run launch script" });
    fireEvent.click(button);
    fireEvent.contextMenu(button);

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onOpenEditor).toHaveBeenCalledTimes(1);
  });

  it("renders popover content only while open", () => {
    const { rerender } = render(
      <LaunchScriptPopoverShell
        editorOpen={false}
        buttonAriaLabel="Run launch script"
        buttonTitle="Run launch script"
        buttonIcon={<span aria-hidden>icon</span>}
        onRun={vi.fn()}
        onOpenEditor={vi.fn()}
        onCloseEditor={vi.fn()}
      >
        <div>Popover content</div>
      </LaunchScriptPopoverShell>
    );

    expect(screen.queryByText("Popover content")).toBeNull();

    rerender(
      <LaunchScriptPopoverShell
        editorOpen={true}
        buttonAriaLabel="Run launch script"
        buttonTitle="Run launch script"
        buttonIcon={<span aria-hidden>icon</span>}
        onRun={vi.fn()}
        onOpenEditor={vi.fn()}
        onCloseEditor={vi.fn()}
      >
        <div>Popover content</div>
      </LaunchScriptPopoverShell>
    );

    expect(screen.getByText("Popover content")).toBeTruthy();
  });
});
