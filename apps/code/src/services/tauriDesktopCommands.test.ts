import { invoke, isTauri } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCommitMessage, setMenuAccelerators } from "./tauriDesktopCommands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const isTauriMock = vi.mocked(isTauri);

beforeEach(() => {
  vi.clearAllMocks();
  isTauriMock.mockReturnValue(true);
});

describe("tauriDesktopCommands", () => {
  it("maps menu accelerator updates", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(
      setMenuAccelerators([
        { id: "new-agent", accelerator: "CommandOrControl+N" },
        { id: "toggle-terminal", accelerator: null },
      ])
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith("menu_set_accelerators", {
      updates: [
        { id: "new-agent", accelerator: "CommandOrControl+N" },
        { id: "toggle-terminal", accelerator: null },
      ],
    });
  });

  it("invokes commit message generation in tauri mode", async () => {
    invokeMock.mockResolvedValueOnce("feat: update runtime adapter");

    await expect(generateCommitMessage("ws-1")).resolves.toBe("feat: update runtime adapter");
    expect(invokeMock).toHaveBeenCalledWith("generate_commit_message", {
      workspaceId: "ws-1",
    });
  });

  it("rejects commit message generation outside tauri mode", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(generateCommitMessage("ws-2")).rejects.toThrow(
      "Commit message generation is not available outside the desktop app."
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("skips menu accelerator updates outside tauri mode", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(
      setMenuAccelerators([{ id: "new-agent", accelerator: "CommandOrControl+N" }])
    ).resolves.toBeUndefined();

    expect(invokeMock).not.toHaveBeenCalled();
  });
});
