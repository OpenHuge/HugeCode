import { describe, expect, it } from "vitest";

import {
  canonicalizeSourceNodeId,
  deriveFocusPlan,
} from "../../scripts/figma-pipeline/shared/focus-plan.mjs";

function createNode(id: string, name: string, type: string, children: unknown[] = []) {
  return { id, name, type, children };
}

describe("figma focus planning", () => {
  it("canonicalizes instance-backed source ids to the reusable node id", () => {
    expect(canonicalizeSourceNodeId("I62:2037;62:2020")).toBe("62:2020");
    expect(canonicalizeSourceNodeId("16-114")).toBe("16:114");
  });

  it("selects family representatives with component-set priority and excludes layout families", () => {
    const largeInputChildren = Array.from({ length: 260 }, (_, index) =>
      createNode(`11:${index + 200}`, `Input child ${index + 1}`, "RECTANGLE")
    );
    const exportPayload = {
      fileKey: "KWUgG9JAz50HjH0jIrGkpH",
      documentMeta: {
        name: "Linear Design System (Community) (Copy)",
      },
      selection: {
        id: "8:2",
        name: "Design System (Dark Mode)",
        type: "CANVAS",
      },
      currentPage: {
        id: "8:1",
        name: "Dark Mode",
      },
      document: {
        document: createNode("8:2", "Design System (Dark Mode)", "CANVAS", [
          createNode("16:114", "Buttons", "COMPONENT_SET", [
            createNode("16:115", "Primary", "COMPONENT"),
            createNode("16:116", "Secondary", "COMPONENT"),
          ]),
          createNode("11:103", "Input", "FRAME", largeInputChildren),
          createNode("9:1", "Stack", "FRAME", [createNode("9:2", "Child", "FRAME")]),
        ]),
      },
    };
    const inventory = {
      components: [
        {
          name: "Buttons",
          sourceNodeId: "16:114",
          signature: "buttons|COMPONENT_SET|component-set|2|none",
          classification: "composite",
          shared: true,
          occurrences: 8,
          confidence: 0.98,
          rationale: "Repeated structure with stable role signature.",
        },
        {
          name: "Input",
          sourceNodeId: "11:103",
          signature: "input|FRAME|layout|260|vertical",
          classification: "primitive",
          shared: true,
          occurrences: 12,
          confidence: 0.96,
          rationale: "Repeated structure with stable role signature.",
        },
        {
          name: "Stack",
          sourceNodeId: "9:1",
          signature: "stack|FRAME|layout|1|vertical",
          classification: "primitive",
          shared: true,
          occurrences: 20,
          confidence: 0.99,
          rationale: "Layout utility.",
        },
      ],
    };
    const specs = {
      components: [{ family: "Button" }, { family: "Input" }, { family: "Stack" }],
    };

    const plan = deriveFocusPlan(exportPayload, inventory, specs);

    expect(plan.summary.familiesSelected).toBe(2);
    expect(plan.targets.map((target) => target.family)).toEqual(["Button", "Input"]);
    expect(plan.targets[0]?.target.nodeId).toBe("16:114");
    expect(plan.targets[0]?.workflowRecommendation.codegenSafe).toBe(true);
    expect(plan.targets[0]?.cachePolicy.maxCacheAgeMinutes).toBe(1440);
    expect(plan.targets[1]?.workflowRecommendation.codegenSafe).toBe(false);
    expect(plan.targets[1]?.cachePolicy.maxCacheAgeMinutes).toBe(360);
  });
});
