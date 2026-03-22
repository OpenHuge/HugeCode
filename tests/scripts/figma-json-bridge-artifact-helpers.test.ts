import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findLatestArtifactBundleForSelection,
  writeArtifactBundle,
} from "../../scripts/figma-json-bridge/artifact-helpers.mjs";

const tempRoots: string[] = [];

async function createOutputDir() {
  const root = await mkdtemp(path.join(tmpdir(), "figma-artifact-helper-"));
  tempRoots.push(root);
  return root;
}

function createPayload({
  exportedAt,
  nodeId,
  name,
}: {
  exportedAt: string;
  nodeId: string;
  name: string;
}) {
  return {
    exportedAt,
    fileKey: "figma-file",
    documentMeta: {
      name: "Linear Design System",
      version: "4242",
      lastModified: "2026-03-13T02:00:00.000Z",
    },
    selection: {
      id: nodeId,
      name,
      type: "FRAME",
    },
    document: {
      document: {
        id: nodeId,
        name,
        type: "FRAME",
        children: [],
      },
    },
    resources: {
      pngBase64: Buffer.from(`${name}-png`, "utf8").toString("base64"),
      svgString: `<svg><text>${name}</text></svg>`,
    },
  };
}

describe("figma-json-bridge artifact retention", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("keeps only the latest export bundle for the same Figma selection", async () => {
    const outputDir = await createOutputDir();

    const first = writeArtifactBundle(
      createPayload({
        exportedAt: "2026-03-12T03:47:06.660Z",
        nodeId: "0:1",
        name: "Design UI Kit",
      }),
      outputDir
    );
    await writeFile(
      first.jsonPath.replace(/\.json$/u, ".qa-report.json"),
      `${JSON.stringify({ score: 75 }, null, 2)}\n`,
      "utf8"
    );
    writeArtifactBundle(
      createPayload({
        exportedAt: "2026-03-12T03:48:06.660Z",
        nodeId: "0:1",
        name: "Design UI Kit",
      }),
      outputDir
    );

    const files = await readdir(outputDir);
    expect(files).toHaveLength(5);
    expect(files.some((fileName) => fileName.startsWith("2026-03-12T03-47-06-660Z"))).toBe(false);
    expect(files.some((fileName) => fileName.startsWith("2026-03-12T03-48-06-660Z"))).toBe(true);
    expect(files.some((fileName) => fileName.endsWith(".qa-report.json"))).toBe(false);
  });

  it("caps the total number of retained export bundles across different selections", async () => {
    const outputDir = await createOutputDir();
    vi.stubEnv("FIGMA_EXPORT_MAX_BUNDLES_PER_SELECTION", "5");
    vi.stubEnv("FIGMA_EXPORT_MAX_BUNDLES", "2");

    writeArtifactBundle(
      createPayload({
        exportedAt: "2026-03-12T03:47:06.660Z",
        nodeId: "0:1",
        name: "First Node",
      }),
      outputDir
    );
    writeArtifactBundle(
      createPayload({
        exportedAt: "2026-03-12T03:48:06.660Z",
        nodeId: "0:2",
        name: "Second Node",
      }),
      outputDir
    );
    const latest = writeArtifactBundle(
      createPayload({
        exportedAt: "2026-03-12T03:49:06.660Z",
        nodeId: "0:3",
        name: "Third Node",
      }),
      outputDir
    );

    const files = await readdir(outputDir);
    expect(files).toHaveLength(10);
    expect(files.some((fileName) => fileName.startsWith("2026-03-12T03-47-06-660Z"))).toBe(false);
    expect(files.some((fileName) => fileName.startsWith("2026-03-12T03-48-06-660Z"))).toBe(true);
    expect(files.some((fileName) => fileName.startsWith("2026-03-12T03-49-06-660Z"))).toBe(true);

    const latestManifest = JSON.parse(await readFile(latest.manifestPath, "utf8")) as {
      source: {
        nodeId: string;
        documentMeta: {
          version: string;
          name: string;
        };
      };
    };
    expect(latestManifest.source.nodeId).toBe("0:3");
    expect(latestManifest.source.documentMeta.version).toBe("4242");
    expect(latestManifest.source.documentMeta.name).toBe("Linear Design System");
  });

  it("finds the latest retained bundle for a specific file key and node id", async () => {
    const outputDir = await createOutputDir();

    writeArtifactBundle(
      createPayload({
        exportedAt: "2026-03-12T03:47:06.660Z",
        nodeId: "0:1",
        name: "Cached Node",
      }),
      outputDir
    );
    const latest = writeArtifactBundle(
      createPayload({
        exportedAt: "2026-03-12T03:49:06.660Z",
        nodeId: "0:2",
        name: "Target Node",
      }),
      outputDir
    );

    const found = findLatestArtifactBundleForSelection(outputDir, "figma-file", "0:2");
    expect(found?.jsonPath).toBe(latest.jsonPath);
    expect(found?.summaryPath).toBe(latest.summaryPath);
    expect(found?.manifestPath).toBe(latest.manifestPath);
  });
});
