/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

const mountedContainers: HTMLDivElement[] = [];

afterEach(() => {
  for (const container of mountedContainers.splice(0)) {
    container.remove();
  }
  document.body.innerHTML = "";
  document.body.style.overflow = "";
});

describe("Dialog", () => {
  it("does not render when open is false", () => {
    const markup = renderToStaticMarkup(
      <Dialog open={false} onOpenChange={() => undefined} ariaLabel="Hidden dialog">
        <div>Dialog body</div>
      </Dialog>
    );

    expect(markup).toBe("");
  });

  it("exposes dialog aria metadata and backdrop hooks", () => {
    const onOpenChange = vi.fn();
    const onBackdropClick = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    mountedContainers.push(container);
    document.body.appendChild(container);

    act(() => {
      root.render(
        <Dialog
          open={true}
          onOpenChange={onOpenChange}
          ariaLabelledBy="dialog-title"
          ariaDescribedBy="dialog-description"
          onBackdropClick={onBackdropClick}
        >
          <h2 id="dialog-title">Launch review</h2>
          <p id="dialog-description">Operator approval is required.</p>
        </Dialog>
      );
    });

    const dialog = container.querySelector("[role='dialog']");
    const backdrop = container.querySelector("[data-ui-dialog-backdrop='true']");

    expect(dialog?.getAttribute("aria-labelledby")).toBe("dialog-title");
    expect(dialog?.getAttribute("aria-describedby")).toBe("dialog-description");
    expect(backdrop).toBeTruthy();
    if (!(backdrop instanceof HTMLButtonElement)) {
      throw new Error("Expected dialog backdrop button");
    }

    act(() => {
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onBackdropClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    act(() => {
      root.unmount();
    });
  });

  it("closes on Escape while open", () => {
    const onOpenChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    mountedContainers.push(container);
    document.body.appendChild(container);

    act(() => {
      root.render(
        <Dialog open={true} onOpenChange={onOpenChange} ariaLabel="Shared dialog">
          <div>Dialog body</div>
        </Dialog>
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);

    act(() => {
      root.unmount();
    });
  });
});
