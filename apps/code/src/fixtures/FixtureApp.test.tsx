import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceBootState } from "../appBoot";

function createDeferredModule<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("FixtureApp", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/fixtures.html");
  });

  it("renders the execution detail fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      ExecutionDetailVisualFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=execution-detail");
    vi.doMock(
      "../features/design-system/components/execution/ExecutionDetailVisualFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        ExecutionDetailVisualFixture: () => <div>Loaded execution detail fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded execution detail fixture")).toBeTruthy();
  }, 10000);

  it("renders the shell controls fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      ShellControlsFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=shell-controls");
    vi.doMock("../features/layout/components/ShellControlsFixture", () => fixtureModule.promise);

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        ShellControlsFixture: () => <div>Loaded shell controls fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded shell controls fixture")).toBeTruthy();
  }, 10000);

  it("renders the mission control fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      MissionControlVisualFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=mission-control");
    vi.doMock(
      "../features/design-system/components/execution/MissionControlVisualFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        MissionControlVisualFixture: () => <div>Loaded mission control fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded mission control fixture")).toBeTruthy();
  }, 10000);

  it("renders the design-system closure fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      DesignSystemClosureFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=design-system-closure");
    vi.doMock(
      "../features/design-system/components/DesignSystemClosureFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        DesignSystemClosureFixture: () => <div>Loaded design-system closure fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded design-system closure fixture")).toBeTruthy();
  }, 10000);

  it("renders the main-shell closure fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      MainShellClosureFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=main-shell-closure");
    vi.doMock(
      "../features/design-system/components/MainShellClosureFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        MainShellClosureFixture: () => <div>Loaded main-shell closure fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded main-shell closure fixture")).toBeTruthy();
  }, 10000);

  it("renders the core-loop closure fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      CoreLoopClosureFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=core-loop-closure");
    vi.doMock(
      "../features/core-loop/components/CoreLoopClosureFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        CoreLoopClosureFixture: () => <div>Loaded core-loop closure fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded core-loop closure fixture")).toBeTruthy();
  }, 10000);

  it("renders the runtime sub-agent observability fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      WorkspaceHomeSubAgentObservabilityFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=runtime-subagent-observability");
    vi.doMock(
      "../features/workspaces/components/WorkspaceHomeSubAgentObservabilityFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        WorkspaceHomeSubAgentObservabilityFixture: () => (
          <div>Loaded runtime sub-agent observability fixture</div>
        ),
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded runtime sub-agent observability fixture")).toBeTruthy();
  }, 10000);

  it("renders the review-loop closure fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      ReviewLoopClosureFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=review-loop-closure");
    vi.doMock(
      "../features/review/components/review-loop/ReviewLoopClosureFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        ReviewLoopClosureFixture: () => <div>Loaded review-loop closure fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded review-loop closure fixture")).toBeTruthy();
  }, 10000);

  it("renders the composer action stop fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      ComposerActionVisualFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=composer-action-stop");
    vi.doMock(
      "../features/composer/components/ComposerActionVisualFixture",
      () => fixtureModule.promise
    );

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    expect(screen.getByText("Composer Action Stop Fixture")).toBeTruthy();

    await act(async () => {
      fixtureModule.resolve({
        ComposerActionVisualFixture: () => <div>Loaded composer action stop fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded composer action stop fixture")).toBeTruthy();
  }, 10000);

  it("renders the right-panel v2 fixture when requested through the dedicated fixture host", async () => {
    const fixtureModule = createDeferredModule<{
      RightPanelV2VisualFixture: () => JSX.Element;
    }>();

    window.history.replaceState({}, "", "/fixtures.html?fixture=right-panel-v2");
    vi.doMock("../features/right-panel/RightPanelV2VisualFixture", () => fixtureModule.promise);

    const { FixtureApp } = await import("./FixtureApp");

    render(<FixtureApp />);

    const bootFallback = screen.getByRole("status", { name: workspaceBootState.title });
    expect(bootFallback.getAttribute("data-app-boot")).toBe(workspaceBootState.variant);

    await act(async () => {
      fixtureModule.resolve({
        RightPanelV2VisualFixture: () => <div>Loaded right-panel v2 fixture</div>,
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("Loaded right-panel v2 fixture")).toBeTruthy();
  }, 10000);
});
