#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  ARTIFACT_SUFFIXES,
  PIPELINE_VERSION,
  flattenSemanticTemplate,
} from "./shared/contracts.mjs";
import {
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
} from "./shared/paths.mjs";

const DEFAULT_ASSIGNMENTS = Object.freeze({
  "color.bg.canvas": "color.1",
  "color.bg.app": "color.2",
  "color.bg.panel": "color.3",
  "color.bg.card": "color.4",
  "color.bg.elevated": "color.5",
  "color.bg.overlay": "color.6",
  "color.text.primary": "color.1",
  "color.text.secondary": "color.2",
  "color.text.tertiary": "color.3",
  "color.border.subtle": "color.4",
  "color.border.default": "color.5",
  "color.border.strong": "color.6",
  "space.xs": "spacing.1",
  "space.sm": "spacing.2",
  "space.md": "spacing.3",
  "space.lg": "spacing.4",
  "space.xl": "spacing.5",
  "radius.sm": "radius.1",
  "radius.md": "radius.2",
  "radius.lg": "radius.3",
  "borderWidth.default": "borderWidth.1",
  "shadow.sm": "shadow.1",
  "shadow.md": "shadow.2",
  "motion.blur.subtle": "blur.1",
  "motion.focus.width": "borderWidth.1",
});

function buildCollectionIndex(collections) {
  const index = new Map();
  for (const [category, entries] of Object.entries(collections ?? {})) {
    entries.forEach((entry, position) => {
      index.set(`${category}.${entry.name}`, {
        ref: `${category}.${entry.name}`,
        value: entry.value,
        count: entry.count,
        position,
      });
    });
  }
  return index;
}

export function mapSemanticTokens(exportJsonPath) {
  const primitivePath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.primitiveTokens);
  const primitivePayload = readJson(primitivePath);
  const collectionIndex = buildCollectionIndex(primitivePayload.collections);
  const desiredPaths = flattenSemanticTemplate();

  const mappings = [];
  const unresolved = [];

  for (const semanticPath of desiredPaths) {
    const preferredRef = DEFAULT_ASSIGNMENTS[semanticPath] ?? null;
    const resolved = preferredRef ? (collectionIndex.get(preferredRef) ?? null) : null;

    if (!resolved) {
      unresolved.push(semanticPath);
      continue;
    }

    mappings.push({
      path: semanticPath,
      primitiveRef: resolved.ref,
      value: resolved.value,
      confidence: 0.75,
      source: "default-assignment",
    });
  }

  const output = {
    artifactVersion: PIPELINE_VERSION,
    sourcePrimitiveRef: primitivePath.split(/[\\/]/u).pop(),
    mappings,
    summary: {
      mappedCount: mappings.length,
      unmappedCount: unresolved.length,
      coverage:
        desiredPaths.length === 0 ? 0 : Number((mappings.length / desiredPaths.length).toFixed(3)),
      unresolvedPaths: unresolved,
    },
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.semanticTokens);
  writeJson(outputPath, output);
  return { outputPath, output };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const { outputPath, output } = mapSemanticTokens(exportJsonPath);
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath, coverage: output.summary.coverage }, null, 2)}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
