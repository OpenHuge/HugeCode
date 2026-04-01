import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DesktopCommandUnavailableError,
  invokeDesktopCommand,
  isDesktopHostRuntime,
} from "./desktopHostCore";

describe("desktopHostCore", () => {
  beforeEach(() => {
    delete (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost;
  });

  it("detects runtime availability from the Electron bridge core capability", () => {
    expect(isDesktopHostRuntime()).toBe(false);

    (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost = {
      kind: "electron",
      core: {
        invoke: vi.fn(),
      },
    };

    expect(isDesktopHostRuntime()).toBe(true);
  });

  it("invokes desktop commands through the Electron bridge core capability", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true });
    (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost = {
      kind: "electron",
      core: {
        invoke,
      },
    };

    await expect(invokeDesktopCommand("example_command", { enabled: true })).resolves.toEqual({
      ok: true,
    });
    expect(invoke).toHaveBeenCalledWith("example_command", { enabled: true });
  });

  it("throws when the Electron bridge core capability is unavailable", async () => {
    await expect(invokeDesktopCommand("missing_command")).rejects.toEqual(
      new DesktopCommandUnavailableError("missing_command")
    );
  });
});
