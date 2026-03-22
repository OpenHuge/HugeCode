/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalShell } from "./ModalShell";

afterEach(() => {
  cleanup();
});

describe("ModalShell", () => {
  it("forwards aria metadata and close hooks to the shared dialog", () => {
    const onOpenChange = vi.fn();
    const onBackdropClick = vi.fn();

    render(
      <ModalShell
        open={true}
        onOpenChange={onOpenChange}
        ariaLabel="Project settings"
        onBackdropClick={onBackdropClick}
      >
        <div>Modal body</div>
      </ModalShell>
    );

    const dialog = screen.getByRole("dialog", { name: "Project settings" });
    const backdrop = document.querySelector("[data-ui-dialog-backdrop='true']");

    expect(dialog).toBeTruthy();
    expect(dialog.className).toContain("app-dialog-root");
    expect(document.querySelector("[data-ui-dialog-card='true']")).toBeTruthy();
    expect(backdrop).toBeTruthy();
    if (!backdrop) {
      throw new Error("Expected modal shell backdrop");
    }

    fireEvent.click(backdrop);

    expect(onBackdropClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("respects the open prop when closed", () => {
    render(
      <ModalShell open={false} ariaLabel="Closed modal">
        <div>Modal body</div>
      </ModalShell>
    );

    expect(screen.queryByRole("dialog", { name: "Closed modal" })).toBeNull();
  });
});
