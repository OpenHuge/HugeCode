// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("exposes shared dialog hooks and aria metadata", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open={true}
        onOpenChange={onOpenChange}
        ariaLabel="Shared dialog"
        cardClassName="dialog-card"
      >
        <div>Dialog body</div>
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "Shared dialog" })).toBeTruthy();
    expect(document.querySelector("[data-ui-dialog-backdrop='true']")).toBeTruthy();
    expect(document.querySelector("[data-ui-dialog-card='true'].dialog-card")).toBeTruthy();
  });

  it("lets backdrop handlers intercept close requests", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open={true}
        onOpenChange={onOpenChange}
        onBackdropClick={(event) => {
          event.preventDefault();
        }}
      >
        <div>Dialog body</div>
      </Dialog>
    );

    const backdrop = document.querySelector("[data-ui-dialog-backdrop='true']");
    expect(backdrop).toBeTruthy();
    if (!backdrop) {
      throw new Error("Expected shared dialog backdrop");
    }

    fireEvent.click(backdrop);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
