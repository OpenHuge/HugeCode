#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";

const repoRoot = process.cwd();
const RUNTIME_PREFIX = "packages/code-runtime-service-rs/src/";
const json = process.argv.includes("--json");
const LAYERED_PREFIXES = {
  config: `${RUNTIME_PREFIX}config/`,
  rpc: `${RUNTIME_PREFIX}rpc/`,
  transport: `${RUNTIME_PREFIX}transport/`,
};

const DENYLIST = {
  config: [/\buse\s+crate::rpc_dispatch\b/u, /\buse\s+crate::turn_send_handler\b/u],
  rpc: [/\buse\s+crate::transport::/u],
  transport: [/\buse\s+crate::rpc::/u],
};

function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

function listFilesFromEnv() {
  const raw = process.env.VALIDATE_CHANGED_FILES_JSON;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => toPosixPath(String(entry)));
  } catch {
    return [];
  }
}

function listLayeredFilesFromDisk() {
  const result = [];
  for (const prefix of Object.values(LAYERED_PREFIXES)) {
    const absoluteDir = path.join(repoRoot, prefix);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }
    const stack = [absoluteDir];
    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(absolutePath);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".rs")) {
          continue;
        }
        result.push(toPosixPath(path.relative(repoRoot, absolutePath)));
      }
    }
  }
  return result;
}

function detectLayer(filePath) {
  for (const [layer, prefix] of Object.entries(LAYERED_PREFIXES)) {
    if (filePath.startsWith(prefix)) {
      return layer;
    }
  }
  return null;
}

const candidateFiles = listFilesFromEnv();
const files = (candidateFiles.length > 0 ? candidateFiles : listLayeredFilesFromDisk())
  .filter((filePath) => filePath.startsWith(RUNTIME_PREFIX))
  .filter((filePath) => filePath.endsWith(".rs"))
  .filter((filePath) => detectLayer(filePath) !== null)
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  if (json) {
    writeCheckJson({
      check: "check-runtime-layering",
      ok: true,
      details: {
        runtimePrefix: RUNTIME_PREFIX,
        checkedFiles: [],
        violations: [],
      },
    });
  }
  process.exit(0);
}

const violations = [];
for (const filePath of files) {
  const layer = detectLayer(filePath);
  if (!layer) {
    continue;
  }
  const absolutePath = path.join(repoRoot, filePath);
  let content = "";
  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    violations.push({
      filePath,
      layer,
      type: "read-error",
      message: `${filePath}: failed to read file (${String(error)})`,
    });
    continue;
  }

  for (const pattern of DENYLIST[layer] ?? []) {
    if (pattern.test(content)) {
      violations.push({
        filePath,
        layer,
        type: "layer-violation",
        pattern: String(pattern),
        message: `${filePath}: violates ${layer} layer import guard (${pattern})`,
      });
    }
  }
}

if (json) {
  writeCheckJson({
    check: "check-runtime-layering",
    ok: violations.length === 0,
    errors: violations.map((violation) => violation.message),
    details: {
      runtimePrefix: RUNTIME_PREFIX,
      checkedFiles: files,
      violations,
    },
  });
}

if (violations.length > 0) {
  if (!json) {
    writeLines(process.stderr, [
      renderCheckMessage(
        "check-runtime-layering",
        "Rust runtime layering guard detected forbidden cross-layer imports."
      ),
      ...violations.map((violation) => `- ${violation.message}`),
    ]);
  }
  process.exit(1);
}
