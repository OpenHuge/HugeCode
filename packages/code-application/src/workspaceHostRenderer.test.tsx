// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyBrowserRuntimeFlags,
  BrowserRuntimeBootstrapEffects,
  createWorkspaceHostRenderer,
} from "./workspaceHostRenderer";

describe("workspaceHostRenderer", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
    delete document.documentElement.dataset.desktopRuntime;
    delete document.documentElement.dataset.tauriRuntime;
    delete document.documentElement.dataset.electronRuntime;
  });

  it("applies browser runtime flags to the document root", () => {
    applyBrowserRuntimeFlags();

    expect(document.documentElement.dataset.desktopRuntime).toBe("browser");
    expect(document.documentElement.dataset.tauriRuntime).toBe("false");
    expect(document.documentElement.dataset.electronRuntime).toBe("false");
  });

  it("renders effects before host children and wraps providers outside them", () => {
    function EffectMarker() {
      return <div data-testid="effect-marker">Effect marker</div>;
    }

    function ProviderShell({ children }: { children?: ReactNode }) {
      return <section data-testid="provider-shell">{children}</section>;
    }

    const renderWorkspaceHost = createWorkspaceHostRenderer({
      effects: [EffectMarker],
      providers: [ProviderShell],
    });

    const markup = renderToStaticMarkup(renderWorkspaceHost(<div data-testid="body">Body</div>));

    expect(markup).toContain('data-testid="provider-shell"');
    expect(markup).toContain('data-testid="effect-marker"');
    expect(markup).toContain('data-testid="body"');
    expect(markup.indexOf('data-testid="effect-marker"')).toBeLessThan(
      markup.indexOf('data-testid="body"')
    );
    expect(markup.indexOf('data-testid="provider-shell"')).toBeLessThan(
      markup.indexOf('data-testid="effect-marker"')
    );
  });

  it("runs browser bootstrap effects inside the shared host renderer", async () => {
    const renderWorkspaceHost = createWorkspaceHostRenderer({
      effects: [BrowserRuntimeBootstrapEffects],
    });

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(renderWorkspaceHost(<div>Workspace body</div>));
    });

    expect(container.textContent).toContain("Workspace body");
    expect(document.documentElement.dataset.desktopRuntime).toBe("browser");
    expect(document.documentElement.dataset.tauriRuntime).toBe("false");
    expect(document.documentElement.dataset.electronRuntime).toBe("false");
  });
});
