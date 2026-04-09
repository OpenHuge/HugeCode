// @vitest-environment node
import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

type ManualChunksContext = {
  getModuleInfo(id: string): null;
  getModuleIds(): IterableIterator<string>;
};

const TEST_MANUAL_CHUNKS_CONTEXT: ManualChunksContext = {
  getModuleInfo: () => null,
  getModuleIds: function* () {},
};

function resolveManualChunks() {
  const output = viteConfig.build?.rollupOptions?.output;
  if (!output || Array.isArray(output) || typeof output.manualChunks !== "function") {
    throw new Error("Expected vite manualChunks output function");
  }
  return output.manualChunks as (id: string, context: ManualChunksContext) => string | void;
}

function resolveChunkName(id: string) {
  return resolveManualChunks()(id, TEST_MANUAL_CHUNKS_CONTEXT);
}

describe("vite manualChunks", () => {
  it("keeps shared control-plane surface models in the governed context chunk", () => {
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/missionControlSurfaceModel.ts"
      )
    ).toBe("runtime-governed-context");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/reviewPackSurfaceModel.ts"
      )
    ).toBe("runtime-governed-context");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionNavigationTarget.ts"
      )
    ).toBe("runtime-governed-context");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionNavigationTypes.ts"
      )
    ).toBe("runtime-governed-context");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionControlProvenance.ts"
      )
    ).toBe("runtime-governed-context");
  });

  it("keeps shared mission-control projection helpers in the mission-control chunk", () => {
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtimeMissionControlRunProjection.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtimeMissionControlReviewPackProjection.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionControlOperatorAction.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionControlTakeoverAction.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionControlProjectionSummaries.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionControlPluginCatalog.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeMissionControlTaskSourceProjector.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeKernelPluginReadiness.ts"
      )
    ).toBe("runtime-mission-control");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeReviewPackDetailPresentation.ts"
      )
    ).toBe("runtime-auto-drive");
    expect(
      resolveChunkName(
        "/home/han/src/HugeCode/packages/code-application/src/runtime-control-plane/runtimeReviewPackDecisionActionsFacade.ts"
      )
    ).toBe("runtime-auto-drive");
  });
});
