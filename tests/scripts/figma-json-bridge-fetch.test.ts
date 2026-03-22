import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeArtifactBundle } from "../../scripts/figma-json-bridge/artifact-helpers.mjs";
import {
  fetchTargetArtifact,
  parseTargetUrl,
  resolveTarget,
} from "../../scripts/figma-json-bridge/fetch.mjs";

const tempRoots: string[] = [];

async function createTempRegistry() {
  const root = await mkdtemp(path.join(tmpdir(), "figma-fetch-registry-"));
  tempRoots.push(root);
  const registryPath = path.join(root, "registry.json");
  await writeFile(
    registryPath,
    `${JSON.stringify(
      {
        resources: [
          {
            id: "linear-design-system-community-root",
            fileKey: "KWUgG9JAz50HjH0jIrGkpH",
            nodeId: "8:2",
            url: "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2&p=f&t=weIRY2hJGy82XA7A-0",
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return registryPath;
}

describe("figma-json-bridge target resolution", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("parses file key and node id from a Figma design URL", () => {
    const target = parseTargetUrl(
      "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2&p=f&t=weIRY2hJGy82XA7A-0"
    );

    expect(target).toEqual({
      fileKey: "KWUgG9JAz50HjH0jIrGkpH",
      nodeId: "8:2",
      raw: "https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2&p=f&t=weIRY2hJGy82XA7A-0",
    });
  });

  it("resolves a registry-backed target for doctor and fetch flows", async () => {
    const registryPath = await createTempRegistry();

    const target = resolveTarget({
      resourceId: "linear-design-system-community-root",
      fileKey: null,
      nodeId: null,
      url: null,
      registryPath,
    });

    expect(target.fileKey).toBe("KWUgG9JAz50HjH0jIrGkpH");
    expect(target.nodeId).toBe("8:2");
    expect(target.resource?.id).toBe("linear-design-system-community-root");
  });

  it("returns a cache hit without requiring a token when a local artifact already exists", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "figma-fetch-cache-"));
    tempRoots.push(outputDir);
    writeArtifactBundle(
      {
        exportedAt: new Date().toISOString(),
        fileKey: "KWUgG9JAz50HjH0jIrGkpH",
        selection: {
          id: "8:2",
          name: "Design System (Dark Mode)",
          type: "CANVAS",
        },
        requestedTarget: {
          raw: "KWUgG9JAz50HjH0jIrGkpH:8:2",
          fileKey: "KWUgG9JAz50HjH0jIrGkpH",
          nodeId: "8:2",
          source: "figma-rest-api",
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

    delete process.env.FIGMA_ACCESS_TOKEN;
    const result = await fetchTargetArtifact({
      resourceId: null,
      fileKey: "KWUgG9JAz50HjH0jIrGkpH",
      nodeId: "8:2",
      url: null,
      registryPath: "",
      outputDir,
      tokenEnv: "FIGMA_ACCESS_TOKEN",
      apiBaseUrl: "https://api.figma.com",
      maxCacheAgeMinutes: 60,
      refresh: false,
    });

    expect(result.source).toBe("local-artifact-cache");
    expect(result.cache.hit).toBe(true);
  });
});
