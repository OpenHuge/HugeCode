import { beforeEach, describe, expect, it, vi } from "vitest";

const openUrlMock = vi.fn(async () => undefined);
const revealItemInDirMock = vi.fn(async () => undefined);

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: openUrlMock,
  revealItemInDir: revealItemInDirMock,
}));

describe("tauriOpener", () => {
  beforeEach(() => {
    openUrlMock.mockClear();
    revealItemInDirMock.mockClear();
  });

  it("passes safe external URLs to the tauri opener", async () => {
    const { openUrl, revealItemInDir } = await import("./tauriOpener");

    await openUrl("https://example.com/docs");
    await revealItemInDir("/tmp/workspace");

    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/docs");
    expect(revealItemInDirMock).toHaveBeenCalledWith("/tmp/workspace");
  });

  it("rejects unsafe external URLs", async () => {
    const { openUrl } = await import("./tauriOpener");

    await expect(openUrl("javascript:alert(1)")).rejects.toThrow("Blocked unsafe external URL.");
    expect(openUrlMock).not.toHaveBeenCalled();
  });
});
