// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModalShell } from "../../../../design-system";

describe("ModalShell", () => {
  it("renders root and card classes and handles backdrop click", () => {
    const onBackdropClick = vi.fn();
    const { container } = render(
      <ModalShell
        className="custom-modal"
        cardClassName="custom-card"
        onBackdropClick={onBackdropClick}
        ariaLabel="My dialog"
      >
        <div>Modal content</div>
      </ModalShell>
    );

    const modal = container.querySelector(".ds-modal.custom-modal");
    const card = container.querySelector(".ds-modal-card.custom-card");
    const backdrop = container.querySelector("[data-ui-dialog-backdrop='true']");
    expect(modal).toBeTruthy();
    expect(card).toBeTruthy();
    expect(backdrop).toBeTruthy();
    expect(backdrop?.getAttribute("data-overlay-phase")).toBe("backdrop");
    expect(card?.getAttribute("data-overlay-phase")).toBe("surface");
    expect(card?.getAttribute("data-overlay-treatment")).toBe("translucent");
    if (!backdrop) {
      throw new Error("Expected modal backdrop");
    }
    expect(modal?.getAttribute("aria-label")).toBe("My dialog");
    fireEvent.click(backdrop);
    expect(onBackdropClick).toHaveBeenCalledTimes(1);
  });

  it("supports aria-labelledby and aria-describedby", () => {
    const { container } = render(
      <ModalShell ariaLabelledBy="dialog-title" ariaDescribedBy="dialog-description">
        <h2 id="dialog-title">Dialog title</h2>
        <p id="dialog-description">Dialog description</p>
      </ModalShell>
    );

    const modal = container.querySelector(".ds-modal");
    expect(modal?.getAttribute("aria-labelledby")).toBe("dialog-title");
    expect(modal?.getAttribute("aria-describedby")).toBe("dialog-description");
  });

  it("supports controlled close behavior and body scroll lock", () => {
    const onOpenChange = vi.fn();
    const previousOverflow = document.body.style.overflow;
    const { unmount } = render(
      <ModalShell open={true} onOpenChange={onOpenChange} ariaLabel="Controlled dialog">
        <div>Modal content</div>
      </ModalShell>
    );

    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    unmount();
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it("renders shared overlay markers for dialog layering", () => {
    const { container } = render(
      <ModalShell ariaLabel="Overlay markers">
        <div>Modal content</div>
      </ModalShell>
    );

    expect(
      container.querySelector(
        '.ds-modal[data-overlay-root="dialog"] [data-overlay-phase="backdrop"]'
      )
    ).toBeTruthy();
    expect(
      container.querySelector(
        '.ds-modal[data-overlay-root="dialog"] [data-overlay-phase="surface"][data-overlay-treatment="translucent"]'
      )
    ).toBeTruthy();
  });
});
