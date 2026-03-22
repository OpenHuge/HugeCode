import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeArtifactBundle } from "../../scripts/figma-json-bridge/artifact-helpers.mjs";
import {
  filterFocusTargets,
  runFocusBatch,
} from "../../scripts/figma-pipeline/fetch-focus-batch.mjs";

const tempRoots: string[] = [];

async function createTempRoot(prefix: string) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

describe("figma focus batch filtering", () => {
  afterEach(async () => {
    delete process.env.FIGMA_ACCESS_TOKEN;
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("filters by family and applies a limit in priority order", () => {
    const plan = {
      targets: [
        { family: "Button", priority: 1 },
        { family: "Input", priority: 2 },
        { family: "Select", priority: 3 },
      ],
    };

    expect(
      filterFocusTargets(plan, {
        families: ["Input", "Select"],
        limit: 1,
      }).map((target) => target.family)
    ).toEqual(["Input"]);
  });

  it("materializes focused targets from a local root export without requiring a token", async () => {
    const outputDir = await createTempRoot("figma-focus-output-");
    const planRoot = await createTempRoot("figma-focus-plan-");
    const planPath = path.join(planRoot, "focus-plan.json");
    const reportPath = path.join(planRoot, "focus-report.json");

    const rootArtifact = writeArtifactBundle(
      {
        exportedAt: "2026-03-13T04:50:51.935Z",
        fileKey: "KWUgG9JAz50HjH0jIrGkpH",
        selection: {
          id: "8:2",
          name: "Design System (Dark Mode)",
          type: "CANVAS",
        },
        documentMeta: {
          name: "Linear Design System (Community) (Copy)",
          version: "2330275133624231707",
          lastModified: "2026-03-13T03:20:50Z",
        },
        requestedTarget: {
          raw: "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2",
          fileKey: "KWUgG9JAz50HjH0jIrGkpH",
          nodeId: "8:2",
          source: "figma-rest-api",
        },
        document: {
          document: {
            id: "8:2",
            name: "Design System (Dark Mode)",
            type: "CANVAS",
            children: [
              {
                id: "65:2496",
                name: "Buttons Section",
                type: "SECTION",
                children: [
                  {
                    id: "68:3189",
                    name: "Issue More Button",
                    type: "COMPONENT_SET",
                    fills: [{ type: "SOLID", color: { r: 0.36, g: 0.42, b: 0.82 } }],
                    children: [
                      {
                        id: "68:3190",
                        name: "Default",
                        type: "COMPONENT",
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          schemaVersion: 0,
          components: {},
          componentSets: {},
          styles: {},
        },
        resources: {
          pngBase64: "",
          svgString: "",
        },
      },
      outputDir
    );

    await writeFile(
      planPath,
      `${JSON.stringify(
        {
          artifactVersion: 1,
          generatedAt: "2026-03-13T05:00:00.000Z",
          source: {
            fileKey: "KWUgG9JAz50HjH0jIrGkpH",
            selection: {
              id: "8:2",
              name: "Design System (Dark Mode)",
              type: "CANVAS",
            },
          },
          targets: [
            {
              family: "Button",
              priority: 1,
              resourceId: "linear-design-system-community-copy-button",
              target: {
                fileKey: "KWUgG9JAz50HjH0jIrGkpH",
                nodeId: "68:3189",
                nodeName: "Issue More Button",
                nodeType: "COMPONENT_SET",
                nodeCount: 2,
                childCount: 1,
                depth: 2,
              },
              workflowRecommendation: {
                codegenSafe: true,
                recommendedMode: "develop",
                recommendedCommand: "node scripts/figma-pipeline/develop.mjs",
                selectionType: "COMPONENT_SET",
                selectionName: "Issue More Button",
                nodeCount: 2,
                reasons: [],
              },
              cachePolicy: {
                maxCacheAgeMinutes: 360,
                refreshStrategy: "manual-on-design-change",
                burstProtection: "sequential-cache-first",
              },
            },
          ],
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = await runFocusBatch({
      planPath,
      explicitInputPath: null,
      families: [],
      limit: null,
      delayMs: 0,
      maxCacheAgeMinutes: null,
      outputDir,
      reportPath,
      tokenEnv: "FIGMA_ACCESS_TOKEN",
      registryPath: path.join(planRoot, "missing-registry.json"),
      apiBaseUrl: "https://api.figma.com",
      refresh: false,
      help: false,
      sourceExportPath: rootArtifact.jsonPath,
    });

    expect(result.ok).toBe(true);
    expect(result.summary.failures).toBe(0);
    expect(result.summary.localMaterializations).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.result?.source).toBe("local-source-export");

    const savedPayload = JSON.parse(
      await readFile(path.join(process.cwd(), result.results[0]?.result?.output?.jsonPath), "utf8")
    ) as {
      selection: { id: string; name: string; type: string };
      requestedTarget: { source: string; sourceSelectionId: string };
    };

    expect(savedPayload.selection).toEqual({
      id: "68:3189",
      name: "Issue More Button",
      type: "COMPONENT_SET",
    });
    expect(savedPayload.requestedTarget.source).toBe("local-source-export");
    expect(savedPayload.requestedTarget.sourceSelectionId).toBe("8:2");
  });
});
