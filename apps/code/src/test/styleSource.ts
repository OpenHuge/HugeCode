import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readRelativeSource(importMetaDir: string, relativePath: string) {
  return readFileSync(resolve(importMetaDir, relativePath), "utf8");
}

export function getExportedStyleBlock(source: string, exportName: string) {
  const pattern = new RegExp(
    `export const ${escapeRegExp(exportName)} = style\\(\\{[\\s\\S]*?\\n\\}\\);`
  );
  const match = source.match(pattern)?.[0];
  if (!match) {
    throw new Error(`Unable to find style export "${exportName}" in source.`);
  }
  return match;
}

export function getApplyGlobalStyleBlock(source: string, selector: string) {
  const pattern = new RegExp(
    `applyGlobalStyle\\((["'])${escapeRegExp(selector)}\\1, \\{[\\s\\S]*?\\n\\}\\);`
  );
  const match = source.match(pattern)?.[0];
  if (!match) {
    throw new Error(`Unable to find applyGlobalStyle block for selector "${selector}" in source.`);
  }
  return match;
}
