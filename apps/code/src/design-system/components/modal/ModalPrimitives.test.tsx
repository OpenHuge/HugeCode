/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalShell } from "../ModalShell";
import {
  Dialog,
  DialogButton,
  DialogDescription,
  DialogDivider,
  DialogError,
  DialogFooter,
  DialogHeader,
  DialogInput,
  DialogLabel,
  DialogLabelText,
  DialogTextarea,
  DialogTitle,
} from "./ModalPrimitives";

afterEach(() => {
  cleanup();
});

describe("ModalPrimitives", () => {
  it("keeps dialog title, description, footer, error, divider, input, textarea, and button contracts", () => {
    const markup = renderToStaticMarkup(
      <Dialog
        open={true}
        onOpenChange={() => undefined}
        ariaLabel="Local dialog"
        className="custom-root"
      >
        <DialogHeader className="custom-header">
          <DialogTitle className="custom-title">Dialog title</DialogTitle>
          <DialogDescription className="custom-description">Dialog description</DialogDescription>
        </DialogHeader>
        <DialogLabel htmlFor="dialog-input" className="custom-label">
          Name
        </DialogLabel>
        <DialogInput id="dialog-input" value="Alpha" readOnly fieldClassName="custom-input" />
        <DialogLabelText className="custom-label-text">Notes</DialogLabelText>
        <DialogTextarea value="Ready" readOnly className="custom-textarea" />
        <DialogDivider className="custom-divider" />
        <DialogError className="custom-error">Needs review</DialogError>
        <DialogFooter className="custom-footer">
          <DialogButton className="custom-button" size="sm">
            Close
          </DialogButton>
        </DialogFooter>
      </Dialog>
    );

    expect(markup).toContain("app-dialog-root");
    expect(markup).toContain("custom-root");
    expect(markup).toContain("app-dialog-card");
    expect(markup).toContain("app-dialog-header");
    expect(markup).toContain("app-dialog-title");
    expect(markup).toContain("app-dialog-description");
    expect(markup).toContain("app-dialog-label");
    expect(markup).toContain("app-dialog-input");
    expect(markup).toContain("app-dialog-label-text");
    expect(markup).toContain("app-dialog-textarea");
    expect(markup).toContain("app-dialog-divider");
    expect(markup).toContain("app-dialog-error");
    expect(markup).toContain("app-dialog-footer");
    expect(markup).toContain("app-dialog-button");
    expect(markup).toContain("ds-modal");
    expect(markup).toContain("ds-modal-card");
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain(">Dialog title<");
    expect(markup).toContain(">Dialog description<");
    expect(markup).toContain(">Needs review<");
  });

  it("keeps ModalShell wired through the local dialog primitive with backdrop and aria semantics", () => {
    const onOpenChange = vi.fn();
    const onBackdropClick = vi.fn();

    render(
      <ModalShell
        open={true}
        onOpenChange={onOpenChange}
        onBackdropClick={onBackdropClick}
        ariaLabel="Project settings"
      >
        <div>Dialog body</div>
      </ModalShell>
    );

    const dialog = screen.getByRole("dialog", { name: "Project settings" });
    expect(dialog.className).toContain("app-dialog-root");

    const card = document.querySelector("[data-ui-dialog-card='true']");
    expect(card?.className).toContain("app-dialog-card");

    const backdrop = document.querySelector("[data-ui-dialog-backdrop='true']");
    expect(backdrop).toBeTruthy();
    if (!backdrop) {
      throw new Error("Expected local modal primitive backdrop");
    }

    fireEvent.click(backdrop);

    expect(onBackdropClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
