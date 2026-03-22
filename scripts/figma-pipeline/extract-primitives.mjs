#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { ARTIFACT_SUFFIXES, PIPELINE_VERSION } from "./shared/contracts.mjs";
import {
  numberOrNull,
  rankedEntriesFromFrequencyMap,
  stableSignature,
  toArray,
  toHex,
  toRgbaString,
  valueFrequencyMap,
} from "./shared/normalize.mjs";
import {
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  writeJson,
} from "./shared/paths.mjs";

function collectPaints(node, bucket, category) {
  for (const paint of toArray(node?.[category])) {
    if (!paint || typeof paint !== "object") {
      continue;
    }
    if (paint.type === "SOLID" && paint.color) {
      const alpha = typeof paint.opacity === "number" ? paint.opacity : 1;
      const serialized = alpha >= 1 ? toHex(paint.color) : toRgbaString(paint.color, alpha);
      if (serialized) {
        bucket.colors.push(serialized);
      }
    }
    if (paint.type === "IMAGE") {
      bucket.imageRefs.push(String(paint.imageRef ?? "unknown-image"));
    }
  }
}

function collectTypography(node, bucket) {
  if (String(node?.type ?? "").toUpperCase() !== "TEXT") {
    return;
  }

  const style = node?.style ?? {};
  const signature = stableSignature([
    style.fontFamily ?? "unknown",
    style.fontWeight ?? "unknown",
    style.fontSize ?? "unknown",
    style.lineHeightPx ?? "unknown",
    style.letterSpacing ?? "unknown",
  ]);
  bucket.typography.push(signature);
}

function collectSpacingAndSizing(node, bucket) {
  if (typeof node?.itemSpacing === "number") {
    bucket.spacing.push(`${node.itemSpacing}px`);
  }

  for (const key of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
    if (typeof node?.[key] === "number") {
      bucket.spacing.push(`${node[key]}px`);
    }
  }

  if (typeof node?.cornerRadius === "number") {
    bucket.radius.push(`${node.cornerRadius}px`);
  }

  for (const key of ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"]) {
    if (typeof node?.[key] === "number") {
      bucket.radius.push(`${node[key]}px`);
    }
  }

  for (const key of ["strokeWeight"]) {
    if (typeof node?.[key] === "number") {
      bucket.borderWidth.push(`${node[key]}px`);
    }
  }

  const box = node?.absoluteBoundingBox ?? null;
  if (box && typeof box === "object") {
    if (typeof box.width === "number") {
      bucket.sizing.push(`${Math.round(box.width)}px`);
    }
    if (typeof box.height === "number") {
      bucket.sizing.push(`${Math.round(box.height)}px`);
    }
  }
}

function collectEffects(node, bucket) {
  for (const effect of toArray(node?.effects)) {
    if (!effect || typeof effect !== "object") {
      continue;
    }
    if (typeof effect.radius === "number") {
      bucket.blur.push(`${effect.radius}px`);
    }
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      const colorValue =
        effect.color && typeof effect.color === "object"
          ? toRgbaString(effect.color, typeof effect.color.a === "number" ? effect.color.a : 1)
          : "rgba(0, 0, 0, 0.24)";
      bucket.shadow.push(
        stableSignature([
          effect.type,
          `${numberOrNull(effect.offset?.x) ?? 0}px`,
          `${numberOrNull(effect.offset?.y) ?? 0}px`,
          `${numberOrNull(effect.radius) ?? 0}px`,
          `${numberOrNull(effect.spread) ?? 0}px`,
          colorValue,
        ])
      );
    }
  }
}

function walk(node, bucket) {
  collectPaints(node, bucket, "fills");
  collectPaints(node, bucket, "strokes");
  collectTypography(node, bucket);
  collectSpacingAndSizing(node, bucket);
  collectEffects(node, bucket);

  if (typeof node?.opacity === "number") {
    bucket.opacity.push(String(Number(node.opacity.toFixed(3))));
  }

  for (const child of toArray(node?.children)) {
    walk(child, bucket);
  }
}

function toCollection(entries) {
  const ranked = rankedEntriesFromFrequencyMap(valueFrequencyMap(entries));
  return ranked.map(({ value, count }, index) => ({
    name: `${index + 1}`,
    value,
    count,
  }));
}

export function extractPrimitiveTokens(exportJsonPath) {
  const payload = readJson(exportJsonPath);
  const rootNode = payload?.document?.document ?? payload?.document ?? null;
  if (!rootNode || typeof rootNode !== "object") {
    throw new Error(`Export payload ${exportJsonPath} did not contain document.document.`);
  }

  const bucket = {
    colors: [],
    typography: [],
    spacing: [],
    sizing: [],
    radius: [],
    borderWidth: [],
    shadow: [],
    blur: [],
    opacity: [],
    imageRefs: [],
  };
  walk(rootNode, bucket);

  const output = {
    artifactVersion: PIPELINE_VERSION,
    sourceGraphRef: replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.classifiedNodeGraph)
      .split(/[\\/]/u)
      .pop(),
    collections: {
      color: toCollection(bucket.colors),
      typography: toCollection(bucket.typography),
      spacing: toCollection(bucket.spacing),
      sizing: toCollection(bucket.sizing),
      radius: toCollection(bucket.radius),
      borderWidth: toCollection(bucket.borderWidth),
      shadow: toCollection(bucket.shadow),
      blur: toCollection(bucket.blur),
      opacity: toCollection(bucket.opacity),
    },
    summary: {
      totalCollections: 9,
      imageRefCount: new Set(bucket.imageRefs).size,
      topColor: bucket.colors[0] ?? null,
      topSpacing: bucket.spacing[0] ?? null,
      topRadius: bucket.radius[0] ?? null,
    },
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.primitiveTokens);
  writeJson(outputPath, output);
  return { outputPath, output };
}

function main() {
  const exportJsonPath = resolveLatestRawExportJsonPath(process.argv[2] ?? null);
  const { outputPath, output } = extractPrimitiveTokens(exportJsonPath);
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath, collections: Object.keys(output.collections) }, null, 2)}\n`
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
