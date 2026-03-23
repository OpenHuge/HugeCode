import { describe, expect, it, vi } from "vitest";
import { createDevServerUrl, resolveAvailableDevServerPort } from "./dev-server.mjs";

describe("dev-server helpers", () => {
  it("formats the dev server URL from the selected host and port", () => {
    expect(createDevServerUrl(5187)).toBe("http://127.0.0.1:5187");
    expect(createDevServerUrl(6001, "0.0.0.0")).toBe("http://0.0.0.0:6001");
  });

  it("reuses the preferred port when it can be reserved", async () => {
    const reserveRequestedPort = vi.fn(async (port) => {
      if (port === 5187) {
        return 5187;
      }
      return 6200;
    });

    await expect(
      resolveAvailableDevServerPort({
        preferredPort: 5187,
        reserveRequestedPort,
      })
    ).resolves.toBe(5187);
    expect(reserveRequestedPort).toHaveBeenCalledWith(5187);
  });

  it("falls back to an OS-assigned port when the preferred port cannot be reserved", async () => {
    const reserveRequestedPort = vi.fn(async (port) => {
      if (port === 5187) {
        throw new Error("Port already in use");
      }
      return 6200;
    });

    await expect(
      resolveAvailableDevServerPort({
        preferredPort: 5187,
        reserveRequestedPort,
      })
    ).resolves.toBe(6200);
    expect(reserveRequestedPort.mock.calls.map(([port]) => port)).toEqual([5187, null]);
  });
});
