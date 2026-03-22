import { describe, expect, it } from "vitest";

import { evaluateWorkflowGate } from "../../scripts/figma-pipeline/workflow-gate-core.mjs";

describe("figma workflow gate evaluation", () => {
  it("returns go when offline development loop and bridge checks are stable", () => {
    const result = evaluateWorkflowGate({
      smoke: {
        ok: true,
      },
      focusFetch: {
        localSplitA: {
          ok: true,
          summary: {
            failures: 0,
            cacheHits: 0,
            freshFetches: 0,
            localMaterializations: 2,
          },
        },
        localSplitB: {
          ok: true,
          summary: {
            failures: 0,
            cacheHits: 0,
            freshFetches: 0,
            localMaterializations: 2,
          },
        },
        cacheRepeat: {
          ok: true,
          summary: {
            failures: 0,
            cacheHits: 2,
            freshFetches: 0,
            localMaterializations: 0,
          },
        },
        digestStable: true,
      },
      develop: [
        {
          family: "Button",
          ok: true,
          qa: { status: "pass", blockers: 0 },
          semantic: { coverage: 0.42 },
          artifacts: {
            classifiedNodeGraph: true,
            primitiveTokens: true,
            semanticTokens: true,
            componentSpecs: true,
            qaReport: true,
            codegenReport: true,
          },
          structure: {
            slotCount: 3,
            persistentStateCount: 2,
            interactionStateCount: 3,
          },
          variantModel: {
            axisCount: 1,
          },
        },
        {
          family: "Input",
          ok: true,
          qa: { status: "pass", blockers: 0 },
          semantic: { coverage: 0.35 },
          artifacts: {
            classifiedNodeGraph: true,
            primitiveTokens: true,
            semanticTokens: true,
            componentSpecs: true,
            qaReport: true,
            codegenReport: true,
          },
          structure: {
            slotCount: 6,
            persistentStateCount: 3,
            interactionStateCount: 2,
          },
          variantModel: {
            axisCount: 1,
          },
        },
        {
          family: "Select",
          ok: true,
          qa: { status: "pass", blockers: 0 },
          semantic: { coverage: 0.31 },
          artifacts: {
            classifiedNodeGraph: true,
            primitiveTokens: true,
            semanticTokens: true,
            componentSpecs: true,
            qaReport: true,
            codegenReport: true,
          },
          structure: {
            slotCount: 3,
            persistentStateCount: 1,
            interactionStateCount: 2,
          },
          variantModel: {
            axisCount: 1,
          },
        },
      ],
    });

    expect(result.decision).toBe("go");
    expect(result.status).toBe("workflow-ready");
    expect(result.blockers).toHaveLength(0);
  });

  it("returns no-go when offline loop or required pipeline artifacts fail", () => {
    const result = evaluateWorkflowGate({
      smoke: {
        ok: false,
      },
      focusFetch: {
        localSplitA: {
          ok: false,
          summary: {
            failures: 1,
            cacheHits: 0,
            freshFetches: 1,
            localMaterializations: 0,
          },
        },
        localSplitB: {
          ok: false,
          summary: {
            failures: 1,
            cacheHits: 0,
            freshFetches: 1,
            localMaterializations: 0,
          },
        },
        cacheRepeat: {
          ok: false,
          summary: {
            failures: 1,
            cacheHits: 0,
            freshFetches: 1,
            localMaterializations: 0,
          },
        },
        digestStable: false,
      },
      develop: [
        {
          family: "Input",
          ok: true,
          qa: { status: "pass", blockers: 0 },
          semantic: { coverage: 0.12 },
          artifacts: {
            classifiedNodeGraph: true,
            primitiveTokens: false,
            semanticTokens: true,
            componentSpecs: true,
            qaReport: true,
            codegenReport: true,
          },
          structure: {
            slotCount: 0,
            persistentStateCount: 0,
            interactionStateCount: 0,
          },
          variantModel: {
            axisCount: 0,
          },
        },
      ],
    });

    expect(result.decision).toBe("no-go");
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("returns caution when workflow is usable but design inputs stay partially weak", () => {
    const result = evaluateWorkflowGate({
      smoke: {
        ok: true,
      },
      focusFetch: {
        localSplitA: {
          ok: true,
          summary: {
            failures: 0,
            cacheHits: 0,
            freshFetches: 0,
            localMaterializations: 2,
          },
        },
        localSplitB: {
          ok: true,
          summary: {
            failures: 0,
            cacheHits: 0,
            freshFetches: 0,
            localMaterializations: 2,
          },
        },
        cacheRepeat: {
          ok: true,
          summary: {
            failures: 0,
            cacheHits: 1,
            freshFetches: 0,
            localMaterializations: 0,
          },
        },
        digestStable: true,
      },
      develop: [
        {
          family: "Button",
          ok: true,
          qa: { status: "pass", blockers: 0 },
          semantic: { coverage: 0.11 },
          artifacts: {
            classifiedNodeGraph: true,
            primitiveTokens: true,
            semanticTokens: true,
            componentSpecs: true,
            qaReport: true,
            codegenReport: true,
          },
          structure: {
            slotCount: 3,
            persistentStateCount: 0,
            interactionStateCount: 0,
          },
          variantModel: {
            axisCount: 0,
          },
        },
        {
          family: "Select",
          ok: true,
          qa: { status: "pass", blockers: 0 },
          semantic: { coverage: 0.28 },
          artifacts: {
            classifiedNodeGraph: true,
            primitiveTokens: true,
            semanticTokens: true,
            componentSpecs: true,
            qaReport: true,
            codegenReport: true,
          },
          structure: {
            slotCount: 2,
            persistentStateCount: 1,
            interactionStateCount: 1,
          },
          variantModel: {
            axisCount: 1,
          },
        },
      ],
    });

    expect(result.decision).toBe("go");
    expect(result.status).toBe("workflow-ready-with-caveats");
    expect(result.risks.length).toBeGreaterThan(0);
  });
});
