import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeArtifactBundle } from "../../scripts/figma-json-bridge/artifact-helpers.mjs";
import { resolveTargetArtifact } from "../../scripts/figma-json-bridge/resolve.mjs";

const tempRoots: string[] = [];

async function createTempRoot(prefix: string) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

describe("figma-json-bridge resolve", () => {
  afterEach(async () => {
    delete process.env.FIGMA_ACCESS_TOKEN;
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("returns an exact local artifact cache hit for a Figma link", async () => {
    const outputDir = await createTempRoot("figma-resolve-cache-");
    const exportedAt = new Date().toISOString();
    writeArtifactBundle(
      {
        exportedAt,
        fileKey: "KWUgG9JAz50HjH0jIrGkpH",
        selection: {
          id: "8:2",
          name: "Design System (Dark Mode)",
          type: "CANVAS",
        },
        requestedTarget: {
          raw: "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2",
          fileKey: "KWUgG9JAz50HjH0jIrGkpH",
          nodeId: "8:2",
          source: "local-source-export",
        },
        document: {
          document: {
            id: "8:2",
            name: "Design System (Dark Mode)",
            type: "CANVAS",
            children: [],
          },
        },
        resources: {
          pngBase64: "",
          svgString: "",
        },
      },
      outputDir
    );

    const result = await resolveTargetArtifact({
      resourceId: null,
      fileKey: null,
      nodeId: null,
      url: "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2",
      registryPath: "",
      outputDir,
      sourceExportPath: null,
      maxCacheAgeMinutes: 1440,
      allowFetch: false,
      tokenEnv: "FIGMA_ACCESS_TOKEN",
      apiBaseUrl: "https://api.figma.com",
      refresh: false,
      help: false,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toBe("local-artifact-cache");
    expect(result.output?.jsonPath).toContain("Design-System-Dark-Mode-8-2.json");
  });

  it("materializes an arbitrary node from a matching local source export", async () => {
    const outputDir = await createTempRoot("figma-resolve-output-");
    const exportedAt = new Date().toISOString();

    const rootArtifact = writeArtifactBundle(
      {
        exportedAt,
        fileKey: "KWUgG9JAz50HjH0jIrGkpH",
        selection: {
          id: "8:2",
          name: "Design System (Dark Mode)",
          type: "CANVAS",
        },
        requestedTarget: {
          raw: "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2",
          fileKey: "KWUgG9JAz50HjH0jIrGkpH",
          nodeId: "8:2",
          source: "local-source-export",
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
                    children: [],
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

    const result = await resolveTargetArtifact({
      resourceId: null,
      fileKey: null,
      nodeId: null,
      url: "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=68-3189",
      registryPath: "",
      outputDir,
      sourceExportPath: rootArtifact.jsonPath,
      maxCacheAgeMinutes: 1440,
      allowFetch: false,
      tokenEnv: "FIGMA_ACCESS_TOKEN",
      apiBaseUrl: "https://api.figma.com",
      refresh: false,
      help: false,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toBe("local-source-export");
    expect(result.sourceExportJsonPath).toContain("Design-System-Dark-Mode-8-2.json");
    expect(result.output?.jsonPath).toContain("Issue-More-Button-68-3189.json");
  });

  it("returns actionable local-only guidance when no local artifact is available", async () => {
    const outputDir = await createTempRoot("figma-resolve-miss-");
    const result = await resolveTargetArtifact({
      resourceId: null,
      fileKey: null,
      nodeId: null,
      url: "https://www.figma.com/design/test-file/Uncached-Design?node-id=68-3189",
      registryPath: "",
      outputDir,
      sourceExportPath: null,
      maxCacheAgeMinutes: 1440,
      allowFetch: false,
      tokenEnv: "FIGMA_ACCESS_TOKEN",
      apiBaseUrl: "https://api.figma.com",
      refresh: false,
      help: false,
    });

    expect(result.ok).toBe(false);
    expect(result.source).toBe("local-only-miss");
    expect(result.nextSteps?.[0]).toContain("pnpm -C tools/figma bridge:prepare");
    expect(result.nextSteps?.[2]).toContain("pnpm -C tools/figma bridge:resolve");
  });
});
