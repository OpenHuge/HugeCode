import { describe, expect, it, vi } from "vitest";
import {
  extractCollaborationModeId,
  getFallbackCollaborationModes,
  isChatCollaborationMode,
  isPlanCollaborationMode,
  loadRuntimeCollaborationModes,
  parseRuntimeCollaborationModesResponse,
  pickDefaultCollaborationModeId,
} from "./runtimeCollaborationModes";

vi.mock("../ports/collaboration", () => ({
  getCollaborationModes: vi.fn(),
}));

describe("runtimeCollaborationModes", () => {
  it("normalizes alternate transport response shapes into canonical modes", () => {
    const modes = parseRuntimeCollaborationModesResponse({
      result: [{ mode: "plan" }, { mode: "default" }],
    });

    expect(modes.map((mode) => mode.id)).toEqual(["plan", "default"]);
    expect(pickDefaultCollaborationModeId(modes)).toBe("default");
  });

  it("preserves custom mode ids when the runtime mode maps onto the default flow", () => {
    const modes = parseRuntimeCollaborationModesResponse({
      result: {
        data: [
          { id: "pair-programming", mode: "default", label: "Pair Programming" },
          { id: "plan", mode: "plan", label: "Plan" },
        ],
      },
    });

    expect(modes.map((mode) => mode.id)).toEqual(["plan", "pair-programming"]);
    expect(pickDefaultCollaborationModeId(modes)).toBe("pair-programming");
  });

  it("loads runtime modes through the canonical transport projection", async () => {
    const { getCollaborationModes } = await import("../ports/collaboration");
    vi.mocked(getCollaborationModes).mockResolvedValue({
      result: {
        data: [{ mode: "default" }, { mode: "code" }],
      },
    });

    await expect(loadRuntimeCollaborationModes("workspace-1")).resolves.toMatchObject([
      { id: "plan" },
      { id: "default", mode: "default" },
    ]);
  });

  it("shares one mode-classification rule across features", () => {
    expect(isPlanCollaborationMode("plan")).toBe(true);
    expect(isChatCollaborationMode("default")).toBe(true);
    expect(isChatCollaborationMode("review")).toBe(false);
    expect(
      extractCollaborationModeId({ settings: { id: "pair-programming" }, mode: "default" })
    ).toBe("pair-programming");
  });

  it("keeps synthetic fallback modes identifiable for downstream runtime routing", () => {
    expect(getFallbackCollaborationModes()).toEqual([
      expect.objectContaining({
        id: "plan",
        value: {
          id: "plan",
          mode: "plan",
          settings: { id: "plan" },
        },
      }),
      expect.objectContaining({
        id: "default",
        value: {
          id: "default",
          mode: "default",
          settings: { id: "default" },
        },
      }),
    ]);
  });
});
