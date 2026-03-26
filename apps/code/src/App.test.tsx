import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceBootState } from "./appBoot";

const appBootStyleSource = readFileSync(
  resolve(import.meta.dirname, "./styles/appBoot.css.ts"),
  "utf8"
);

function createDeferredModule<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("App boot fallback", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
  });

  function installBaseAppMocks(workspaceClientEntryModule: Promise<{ default: () => ReactNode }>) {
    vi.doMock("./features/layout/hooks/useWindowLabel", () => ({
      useWindowLabel: () => null,
    }));
    vi.doMock("./application/runtime/ports", () => ({
      RuntimePortsProvider: ({ children }: { children: ReactNode }) => children,
    }));
    vi.doMock("@ku0/code-application", () => ({
      ErrorBoundary: ({ children }: { children: ReactNode }) => children,
    }));
    vi.doMock("./web/WorkspaceClientEntry", () => workspaceClientEntryModule);
  }

  it("renders a visible boot fallback while the main app chunk is still loading", async () => {
    const workspaceClientEntryModule = createDeferredModule<{
      default: () => ReactNode;
    }>();

    installBaseAppMocks(workspaceClientEntryModule.promise);

    const { default: App } = await import("./App");

    render(<App />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);
    expect(bootFallback.textContent).toContain(workspaceBootState.detail);

    await act(async () => {
      workspaceClientEntryModule.resolve({
        default: () => <div>Loaded main app</div>,
      });
      await Promise.resolve();
    });

    const mainApp = await screen.findByText("Loaded main app");
    expect(mainApp.textContent).toBe("Loaded main app");
    expect(screen.queryByRole("status", { name: workspaceBootState.title })).toBeNull();
  }, 10000);

  it("ignores fixture query params and still resolves the main app shell", async () => {
    const workspaceClientEntryModule = createDeferredModule<{
      default: () => ReactNode;
    }>();

    window.history.replaceState({}, "", "/?e2e-fixture=execution-detail");
    installBaseAppMocks(workspaceClientEntryModule.promise);
    vi.doMock("./features/design-system/components/execution/ExecutionDetailVisualFixture", () => ({
      ExecutionDetailVisualFixture: () => <div>Unexpected fixture render</div>,
    }));

    const { default: App } = await import("./App");

    render(<App />);

    expect(screen.getByRole("status", { name: workspaceBootState.title })).toBeTruthy();

    await act(async () => {
      workspaceClientEntryModule.resolve({
        default: () => <div>Loaded main app from fixture query</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded main app from fixture query")).toBeTruthy();
    expect(screen.queryByText("Unexpected fixture render")).toBeNull();
  }, 10000);

  it("does not preload the workspace shell when rendering the about window", async () => {
    const workspaceClientEntryModuleFactory = vi.fn(async () => ({
      default: () => <div>Unexpected workspace shell</div>,
    }));

    vi.doMock("./features/layout/hooks/useWindowLabel", () => ({
      useWindowLabel: () => "about",
    }));
    vi.doMock("./features/about/components/AboutView", () => ({
      AboutView: () => <div>About window</div>,
    }));
    vi.doMock("./application/runtime/ports", () => ({
      RuntimePortsProvider: ({ children }: { children: ReactNode }) => children,
    }));
    vi.doMock("@ku0/code-application", () => ({
      ErrorBoundary: ({ children }: { children: ReactNode }) => children,
    }));
    vi.doMock("./web/WorkspaceClientEntry", workspaceClientEntryModuleFactory);

    const { default: App } = await import("./App");

    render(<App />);

    expect(await screen.findByText("About window")).toBeTruthy();
    expect(workspaceClientEntryModuleFactory).not.toHaveBeenCalled();
    expect(screen.queryByText("Unexpected workspace shell")).toBeNull();
  });

  it("keeps the app boot shell background neutral", () => {
    expect(appBootStyleSource).not.toContain("radial-gradient(circle at 20% 0%");
  });
});
