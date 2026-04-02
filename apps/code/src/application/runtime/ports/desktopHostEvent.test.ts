import { beforeEach, describe, expect, it, vi } from "vitest";
import { listen } from "./desktopHostEvent";

describe("desktopHostEvent", () => {
  beforeEach(() => {
    delete (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost;
  });

  it("listens through the Electron bridge event capability", async () => {
    const unlisten = vi.fn();
    const bridgeListen = vi.fn().mockResolvedValue(unlisten);
    (window as Window & { hugeCodeDesktopHost?: unknown }).hugeCodeDesktopHost = {
      kind: "electron",
      event: {
        listen: bridgeListen,
      },
    };

    const result = await listen("fastcode://runtime/event", () => undefined);

    expect(result).toBe(unlisten);
    expect(bridgeListen).toHaveBeenCalledWith("fastcode://runtime/event", expect.any(Function));
  });

  it("throws when the Electron bridge event capability is unavailable", async () => {
    await expect(listen("fastcode://runtime/event", () => undefined)).rejects.toThrow(
      'Electron bridge event listener "fastcode://runtime/event" is unavailable.'
    );
  });
});
