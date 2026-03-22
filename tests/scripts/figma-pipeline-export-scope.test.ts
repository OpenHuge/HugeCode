import { describe, expect, it } from "vitest";

import { assessExportScope } from "../../scripts/figma-pipeline/shared/export-scope.mjs";

describe("figma pipeline export scope heuristics", () => {
  it("routes large canvas exports into audit mode", () => {
    const scope = assessExportScope({
      selection: {
        type: "CANVAS",
        name: "Design System (Dark Mode)",
      },
      nodeCount: 5432,
    });

    expect(scope.codegenSafe).toBe(false);
    expect(scope.recommendedMode).toBe("audit");
    expect(scope.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("CANVAS exports are page or section scale"),
        expect.stringContaining("5432 nodes"),
      ])
    );
  });

  it("allows focused component exports to continue into develop mode", () => {
    const scope = assessExportScope({
      selection: {
        type: "COMPONENT_SET",
        name: "Button",
      },
      nodeCount: 36,
    });

    expect(scope.codegenSafe).toBe(true);
    expect(scope.recommendedMode).toBe("develop");
    expect(scope.reasons).toHaveLength(0);
  });
});
