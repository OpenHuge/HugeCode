// @vitest-environment node
import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

function resolveManualChunks() {
  const output = viteConfig.build?.rollupOptions?.output;
  if (!output || Array.isArray(output) || typeof output.manualChunks !== "function") {
    throw new Error("Expected vite manualChunks output function");
  }
  return output.manualChunks;
}

describe("vite manualChunks", () => {
  it("keeps shared control-plane surface models in the governed context chunk", () => {
    const manualChunks = resolveManualChunks();

    expect(
      manualChunks(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/missionControlSurfaceModel.ts"
      )
    ).toBe("runtime-governed-context");
    expect(
      manualChunks(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/reviewPackSurfaceModel.ts"
      )
    ).toBe("runtime-governed-context");
  });

  it("keeps shared mission-control projection helpers in the mission-control chunk", () => {
    const manualChunks = resolveManualChunks();

    expect(
      manualChunks(
        "/home/han/src/HugeCode/packages/code-application/src/runtimeMissionControlRunProjection.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      manualChunks(
        "/home/han/src/HugeCode/packages/code-application/src/runtimeMissionControlReviewPackProjection.ts"
      )
    ).toBe("runtime-mission-control");
  });
});
