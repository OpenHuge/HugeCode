// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { renderWebWorkspaceHost } from "./renderWebWorkspaceHost";

describe("renderWebWorkspaceHost", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    root = null;
    container = null;
    delete document.documentElement.dataset.desktopRuntime;
    delete document.documentElement.dataset.tauriRuntime;
    delete document.documentElement.dataset.electronRuntime;
  });

  it("wraps children in the shared web host shell and marks browser runtime flags", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(renderWebWorkspaceHost(<div>Web workspace body</div>));
    });

    expect(container.textContent).toContain("Web workspace body");
    expect(document.documentElement.dataset.desktopRuntime).toBe("browser");
    expect(document.documentElement.dataset.tauriRuntime).toBe("false");
    expect(document.documentElement.dataset.electronRuntime).toBe("false");
  });
});
