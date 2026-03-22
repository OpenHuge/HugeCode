#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const STYLE_EXTENSION = ".css.ts";
const SEARCH_ROOT = "apps/code/src/features";
const BRIDGE_PATTERNS = [/Legacy\.global\.css\.ts$/u, /Panels\.global\.css\.ts$/u];

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function collectFiles(rootDir) {
  const absoluteRoot = path.join(process.cwd(), rootDir);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const files = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(STYLE_EXTENSION)) {
        continue;
      }
      files.push(toPosixPath(path.relative(process.cwd(), absolutePath)));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function isBridgeFile(filePath) {
  return BRIDGE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function main() {
  const files = collectFiles(SEARCH_ROOT);
  const bridgeFiles = files.filter(isBridgeFile);
  if (bridgeFiles.length === 0) {
    return;
  }

  for (const filePath of bridgeFiles) {
  }

  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
}
