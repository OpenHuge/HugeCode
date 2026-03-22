// @vitest-environment jsdom

import { Suspense } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("createWebWorkspaceClientBindings", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
    vi.resetModules();
    vi.doUnmock("./WebWorkspaceShellApp");
  });

  it("defers loading the shared workspace shell until the workspace app renders", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let sharedWorkspaceShellLoads = 0;

    vi.doMock("./WebWorkspaceShellApp", () => {
      sharedWorkspaceShellLoads += 1;
      return {
        default: function MockWorkspaceShellApp() {
          return <div>Lazy shared workspace shell</div>;
        },
      };
    });

    const { createWebWorkspaceClientBindings } = await import("./createWebWorkspaceClientBindings");

    const bindings = createWebWorkspaceClientBindings({
      readRouteSelection: () => ({ kind: "home" }),
      subscribeRouteSelection: () => () => undefined,
      navigateToWorkspace: () => undefined,
      navigateToSection: () => undefined,
      navigateHome: () => undefined,
    });

    expect(sharedWorkspaceShellLoads).toBe(0);

    const WorkspaceApp = bindings.platformUi.WorkspaceApp;

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <Suspense fallback={<div>Loading shared workspace shell…</div>}>
          <WorkspaceApp />
        </Suspense>
      );
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sharedWorkspaceShellLoads).toBe(1);
    expect(container?.textContent).toContain("Lazy shared workspace shell");
  }, 20_000);
});
