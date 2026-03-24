import { describe, expect, it, vi } from "vitest";
import { createDesktopLaunchIntentController } from "./desktopLaunchIntentController.js";

describe("desktopLaunchIntentController", () => {
  it("captures protocol launch intents from initial argv and consumes them once", () => {
    const controller = createDesktopLaunchIntentController({
      app: {
        on: vi.fn(),
        setAsDefaultProtocolClient: vi.fn(() => true),
      },
      initialArgv: [
        "/Applications/HugeCode.app/Contents/MacOS/HugeCode",
        "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
      ],
      platform: "darwin",
      protocol: "hugecode",
    });

    controller.registerProtocolClient();

    expect(controller.consumePendingIntent()).toMatchObject({
      kind: "protocol",
      url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
    });
    expect(controller.consumePendingIntent()).toBeNull();
  });

  it("captures workspace launch intents from argv paths and derives the workspace label", () => {
    const controller = createDesktopLaunchIntentController({
      app: {
        addRecentDocument: vi.fn(),
        on: vi.fn(),
        setAsDefaultProtocolClient: vi.fn(() => true),
      },
      dependencies: {
        currentWorkingDirectory: () => "/Users/han/dev",
        existsSync: vi.fn((path: string) => path === "/Users/han/dev/workspaces/alpha"),
        statSync: vi.fn(() => ({
          isDirectory: () => true,
          isFile: () => false,
        })),
      },
      initialArgv: ["HugeCode", "workspaces/alpha"],
      platform: "darwin",
      protocol: "hugecode",
    });

    expect(controller.peekPendingIntent()).toMatchObject({
      kind: "workspace",
      launchPath: "/Users/han/dev/workspaces/alpha",
      launchPathKind: "directory",
      workspaceLabel: "alpha",
      workspacePath: "/Users/han/dev/workspaces/alpha",
    });
    expect(controller.getPendingOpenWindowInput()).toEqual({
      launchPath: "/Users/han/dev/workspaces/alpha",
      launchPathKind: "directory",
      workspaceLabel: "alpha",
      workspacePath: "/Users/han/dev/workspaces/alpha",
    });
  });

  it("normalizes file launches to the containing workspace directory and preserves the file target", () => {
    const addRecentDocument = vi.fn();
    const controller = createDesktopLaunchIntentController({
      app: {
        addRecentDocument,
        on: vi.fn(),
        setAsDefaultProtocolClient: vi.fn(() => true),
      },
      dependencies: {
        currentWorkingDirectory: () => "/Users/han/dev",
        existsSync: vi.fn((path: string) => path === "/Users/han/dev/workspaces/alpha/README.md"),
        statSync: vi.fn(() => ({
          isDirectory: () => false,
          isFile: () => true,
        })),
      },
      initialArgv: ["HugeCode", "workspaces/alpha/README.md"],
      platform: "darwin",
      protocol: "hugecode",
    });

    expect(controller.getPendingOpenWindowInput()).toEqual({
      launchPath: "/Users/han/dev/workspaces/alpha/README.md",
      launchPathKind: "file",
      workspaceLabel: "alpha",
      workspacePath: "/Users/han/dev/workspaces/alpha",
    });
    expect(addRecentDocument).toHaveBeenCalledWith("/Users/han/dev/workspaces/alpha/README.md");
  });

  it("registers open-url handling on macOS and ignores unrelated protocols", () => {
    let openUrlListener: ((event: { preventDefault(): void }, url: string) => void) | undefined;
    let openFileListener: ((event: { preventDefault(): void }, path: string) => void) | undefined;

    const app = {
      addRecentDocument: vi.fn(),
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        if (event === "open-url") {
          openUrlListener = listener as (event: { preventDefault(): void }, url: string) => void;
        }
        if (event === "open-file") {
          openFileListener = listener as (event: { preventDefault(): void }, path: string) => void;
        }
      }),
      setAsDefaultProtocolClient: vi.fn(() => true),
    };

    const controller = createDesktopLaunchIntentController({
      app,
      dependencies: {
        currentWorkingDirectory: () => "/Users/han/dev",
        existsSync: vi.fn((path: string) => path === "/Users/han/dev/workspaces/beta"),
        statSync: vi.fn(() => ({
          isDirectory: () => true,
          isFile: () => false,
        })),
      },
      platform: "darwin",
      protocol: "hugecode",
    });

    controller.registerAppHandlers();

    const preventDefault = vi.fn();
    openUrlListener?.({ preventDefault }, "mailto:test@example.com");
    expect(controller.consumePendingIntent()).toBeNull();

    openUrlListener?.({ preventDefault }, "hugecode://workspace/open?path=%2Fworkspace%2Fbeta");
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(controller.consumePendingIntent()).toMatchObject({
      kind: "protocol",
    });

    const preventDefaultFile = vi.fn();
    openFileListener?.({ preventDefault: preventDefaultFile }, "workspaces/beta");
    expect(preventDefaultFile).toHaveBeenCalledTimes(1);
    expect(controller.consumePendingIntent()).toMatchObject({
      kind: "workspace",
      launchPath: "/Users/han/dev/workspaces/beta",
      launchPathKind: "directory",
      workspaceLabel: "beta",
      workspacePath: "/Users/han/dev/workspaces/beta",
    });
  });
});
