#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_ENTRY_MAX_BYTES = 1_000_000;
const DEFAULT_CHUNK_MAX_BYTES = 350_000;
const DEFAULT_GROWTH_TOLERANCE_PCT = 3;
const DEFAULT_CONFIG_PATH = "scripts/config/code-bundle-budget.config.mjs";
function parseArgs(argv) {
  const args = {
    json: argv.includes("--json"),
    assetsDir: path.resolve(process.cwd(), "apps/code/dist/assets"),
    configPath: path.resolve(
      process.cwd(),
      process.env.CODE_BUNDLE_BUDGET_CONFIG?.trim() || DEFAULT_CONFIG_PATH
    ),
    entryMaxBytes: null,
    chunkMaxBytes: null,
    growthTolerancePct: null,
    allowChunkNames: new Set(),
  };

  const envAllowlist = process.env.CODE_BUNDLE_BUDGET_CHUNK_ALLOWLIST?.split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (envAllowlist) {
    for (const name of envAllowlist) {
      args.allowChunkNames.add(name);
    }
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }
    if (token === "--assets-dir") {
      args.assetsDir = path.resolve(process.cwd(), argv[index + 1] ?? args.assetsDir);
      index += 1;
      continue;
    }
    if (token === "--config") {
      args.configPath = path.resolve(process.cwd(), argv[index + 1] ?? args.configPath);
      index += 1;
      continue;
    }
    if (token === "--entry-max-bytes") {
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.entryMaxBytes = parsed;
      }
      index += 1;
      continue;
    }
    if (token === "--chunk-max-bytes") {
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.chunkMaxBytes = parsed;
      }
      index += 1;
      continue;
    }
    if (token === "--growth-tolerance-pct") {
      const parsed = Number.parseFloat(argv[index + 1] ?? "");
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.growthTolerancePct = parsed;
      }
      index += 1;
      continue;
    }
    if (token === "--allow-chunk") {
      const name = (argv[index + 1] ?? "").trim();
      if (name) {
        args.allowChunkNames.add(name);
      }
      index += 1;
    }
  }

  return args;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "n/a";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

function isJavaScriptChunk(name) {
  return name.endsWith(".js");
}

function isEntryChunk(name) {
  return /^(?:index|main)(?:-[\w-]+)?\.js$/u.test(name);
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function toNonNegativeNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function normalizeKnownLargeChunkPrefixes(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const entries = Object.entries(value).filter(([prefix, size]) => {
    const normalizedPrefix = String(prefix ?? "").trim();
    const normalizedSize = Number.parseInt(String(size ?? ""), 10);
    return normalizedPrefix.length > 0 && Number.isFinite(normalizedSize) && normalizedSize > 0;
  });
  return Object.fromEntries(entries);
}

async function loadBudgetConfig(configPath) {
  try {
    const moduleUrl = pathToFileURL(configPath).href;
    const loaded = await import(moduleUrl);
    const raw = loaded.codeBundleBudgetConfig ?? loaded.default ?? {};
    const normalized = {
      entryMaxBytes: toPositiveInteger(raw.entryMaxBytes, DEFAULT_ENTRY_MAX_BYTES),
      chunkMaxBytes: toPositiveInteger(raw.chunkMaxBytes, DEFAULT_CHUNK_MAX_BYTES),
      growthTolerancePct: toNonNegativeNumber(raw.growthTolerancePct, DEFAULT_GROWTH_TOLERANCE_PCT),
      knownLargeChunkPrefixes: normalizeKnownLargeChunkPrefixes(raw.knownLargeChunkPrefixes),
    };
    return {
      path: configPath,
      ...normalized,
    };
  } catch (error) {
    throw new Error(
      `Failed to load bundle budget config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function getKnownChunkPrefix(chunkName, knownLargeChunkPrefixEntries) {
  for (const [prefix] of knownLargeChunkPrefixEntries) {
    if (chunkName.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

async function readAssets(assetsDir) {
  const names = await readdir(assetsDir);
  const chunks = [];
  for (const name of names) {
    if (!isJavaScriptChunk(name)) {
      continue;
    }
    const info = await stat(path.join(assetsDir, name));
    if (!info.isFile()) {
      continue;
    }
    chunks.push({ name, size: info.size });
  }
  chunks.sort((left, right) => right.size - left.size);
  return chunks;
}

async function readEntryChunkFromBuildRoot(assetsDir) {
  const buildRoot = path.dirname(assetsDir);
  for (const name of ["index.js", "main.js"]) {
    const candidatePath = path.join(buildRoot, name);
    try {
      const info = await stat(candidatePath);
      if (info.isFile()) {
        return { name, size: info.size };
      }
    } catch {}
  }
  return null;
}

function evaluateEntryChunk(entryChunk, assetsDir, entryMaxBytes) {
  if (!entryChunk) {
    return [
      {
        type: "missing-entry",
        message: `Entry chunk not found in ${assetsDir}.`,
      },
    ];
  }
  if (entryChunk.size <= entryMaxBytes) {
    return [];
  }
  return [
    {
      type: "entry-over-budget",
      chunk: entryChunk.name,
      size: entryChunk.size,
      max: entryMaxBytes,
      message: `Entry chunk ${entryChunk.name} is ${entryChunk.size} bytes (limit ${entryMaxBytes}).`,
    },
  ];
}

function evaluateKnownLargeChunk({
  chunk,
  chunkMaxBytes,
  growthTolerancePct,
  knownLargeChunkPrefixes,
  knownLargeChunkPrefixEntries,
}) {
  const knownPrefix = getKnownChunkPrefix(chunk.name, knownLargeChunkPrefixEntries);
  if (!knownPrefix || chunk.size <= chunkMaxBytes) {
    return null;
  }
  const baselineBytes = knownLargeChunkPrefixes[knownPrefix];
  const knownChunkMaxBytes = resolveKnownChunkBudgetBytes({
    baselineBytes,
    chunkMaxBytes,
    growthTolerancePct,
  });
  const withinBudget = chunk.size <= knownChunkMaxBytes;
  const knownLargeChunkMatch = {
    chunk: chunk.name,
    prefix: knownPrefix,
    size: chunk.size,
    baselineBytes,
    maxAllowedBytes: knownChunkMaxBytes,
    withinBudget,
  };
  if (withinBudget) {
    return { knownLargeChunkMatch, violation: null };
  }
  return {
    knownLargeChunkMatch,
    violation: {
      type: "known-chunk-regression",
      chunk: chunk.name,
      size: chunk.size,
      max: knownChunkMaxBytes,
      baseline: baselineBytes,
      prefix: knownPrefix,
      message: `Known chunk ${chunk.name} exceeds tolerance (${chunk.size} bytes > ${knownChunkMaxBytes}, baseline ${baselineBytes}, prefix ${knownPrefix}).`,
    },
  };
}

function resolveKnownChunkBudgetBytes({ baselineBytes, chunkMaxBytes, growthTolerancePct }) {
  const growthBudgetBytes = Math.ceil(baselineBytes * (1 + growthTolerancePct / 100));
  return Math.max(chunkMaxBytes, growthBudgetBytes);
}

function evaluateChunks({
  chunks,
  entryChunk,
  chunkMaxBytes,
  growthTolerancePct,
  knownLargeChunkPrefixes,
  knownLargeChunkPrefixEntries,
  allowChunkNames,
}) {
  const violations = [];
  const knownLargeChunkMatches = [];
  for (const chunk of chunks) {
    if (
      !chunk?.name ||
      (entryChunk && chunk.name === entryChunk.name) ||
      allowChunkNames.has(chunk.name)
    ) {
      continue;
    }
    const knownChunkEvaluation = evaluateKnownLargeChunk({
      chunk,
      chunkMaxBytes,
      growthTolerancePct,
      knownLargeChunkPrefixes,
      knownLargeChunkPrefixEntries,
    });
    if (knownChunkEvaluation) {
      knownLargeChunkMatches.push(knownChunkEvaluation.knownLargeChunkMatch);
      if (knownChunkEvaluation.violation) {
        violations.push(knownChunkEvaluation.violation);
      }
      continue;
    }
    if (chunk.size <= chunkMaxBytes) {
      continue;
    }
    violations.push({
      type: "chunk-over-budget",
      chunk: chunk.name,
      size: chunk.size,
      max: chunkMaxBytes,
      message: `Chunk ${chunk.name} is ${chunk.size} bytes (limit ${chunkMaxBytes}).`,
    });
  }
  return { knownLargeChunkMatches, violations };
}

function printHumanOutput(output) {
  const { assetsDir, entryChunk, appliedConfig, knownLargeChunkMatches, violations } = output;
  process.stdout.write(`Code bundle budget check\n`);
  process.stdout.write(`Assets: ${assetsDir}\n`);
  process.stdout.write(`Config: ${appliedConfig.configPath}\n`);
  if (entryChunk) {
    process.stdout.write(
      `Entry chunk: ${entryChunk.name} (${formatBytes(entryChunk.size)} | ${entryChunk.size} bytes)\n`
    );
  } else {
    process.stdout.write("Entry chunk: not found\n");
  }
  process.stdout.write(
    `Budget: entry <= ${appliedConfig.entryMaxBytes} bytes; chunk <= ${appliedConfig.chunkMaxBytes} bytes; known growth <= ${appliedConfig.growthTolerancePct}%\n`
  );
  if (knownLargeChunkMatches.length > 0) {
    process.stdout.write("Known large chunk checks:\n");
    for (const match of knownLargeChunkMatches) {
      process.stdout.write(
        `- ${match.chunk}: ${match.size} bytes (baseline ${match.baselineBytes}, max ${match.maxAllowedBytes})\n`
      );
    }
  }
  if (violations.length === 0) {
    process.stdout.write("Budget check passed.\n");
    return;
  }
  process.stdout.write("Violations:\n");
  for (const violation of violations) {
    process.stdout.write(`- ${violation.message}\n`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loadedConfig = await loadBudgetConfig(args.configPath);
  const entryMaxBytes = args.entryMaxBytes ?? loadedConfig.entryMaxBytes;
  const chunkMaxBytes = args.chunkMaxBytes ?? loadedConfig.chunkMaxBytes;
  const growthTolerancePct = args.growthTolerancePct ?? loadedConfig.growthTolerancePct;
  const knownLargeChunkPrefixes = loadedConfig.knownLargeChunkPrefixes;
  const knownLargeChunkPrefixEntries = Object.entries(knownLargeChunkPrefixes).sort(
    ([left], [right]) => right.length - left.length
  );

  const chunks = await readAssets(args.assetsDir);
  const entryChunk =
    chunks.find((chunk) => isEntryChunk(chunk.name)) ??
    (await readEntryChunkFromBuildRoot(args.assetsDir));
  const violations = evaluateEntryChunk(entryChunk, args.assetsDir, entryMaxBytes);
  const chunkEvaluation = evaluateChunks({
    chunks,
    entryChunk,
    chunkMaxBytes,
    growthTolerancePct,
    knownLargeChunkPrefixes,
    knownLargeChunkPrefixEntries,
    allowChunkNames: args.allowChunkNames,
  });
  violations.push(...chunkEvaluation.violations);

  const output = {
    generatedAt: new Date().toISOString(),
    assetsDir: args.assetsDir,
    appliedConfig: {
      configPath: loadedConfig.path,
      entryMaxBytes,
      chunkMaxBytes,
      growthTolerancePct,
      knownLargeChunkPrefixes,
      allowChunkNames: [...args.allowChunkNames].sort((left, right) => left.localeCompare(right)),
    },
    entryChunk,
    topChunks: chunks.slice(0, 20),
    knownLargeChunkMatches: chunkEvaluation.knownLargeChunkMatches,
    violations,
    ok: violations.length === 0,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    printHumanOutput(output);
  }

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[check-code-bundle-budget] ${message}\n`);
  process.exitCode = 1;
});
