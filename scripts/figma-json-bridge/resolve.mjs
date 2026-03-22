#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_API_BASE_URL,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_REGISTRY_PATH,
  DEFAULT_TOKEN_ENV,
  fetchTargetArtifact,
  normalizeNodeId,
  resolveTarget,
} from "./fetch.mjs";
import { findLatestArtifactBundleForSelection } from "./artifact-helpers.mjs";
import {
  findReusableFocusedArtifact,
  materializeFocusedArtifactFromLocalSource,
} from "./local-source-artifacts.mjs";
import { listRawExportJsonFiles, readJson } from "../figma-pipeline/shared/paths.mjs";

const DEFAULT_MAX_CACHE_AGE_MINUTES = 1440;

function printHelp() {
  process.stdout.write(`Usage:
  pnpm -C tools/figma bridge:resolve --url <figma-url>
  pnpm -C tools/figma bridge:resolve --resource <registry-id>
  pnpm -C tools/figma bridge:resolve --file-key <fileKey> --node-id <nodeId>

Options:
  --resource <id>       Resource id from docs/design-system/figma-reference-registry.json
  --file-key <key>      Figma file key when not using --resource
  --node-id <id>        Figma node id (1:24862 or 1-24862)
  --url <url>           Full Figma design URL containing node-id
  --registry <path>     Override registry JSON path
  --output-dir <path>   Override artifacts output directory
  --source-export <path>  Prefer a specific raw source export when materializing a node locally
  --max-cache-age-minutes <n>  Reuse the latest local artifact for the same node when it is newer than n minutes
  --allow-fetch         Allow an explicit REST fetch fallback when no local artifact can satisfy the request
  --token-env <name>    Environment variable containing a Figma personal access token
  --api-base-url <url>  Override the Figma API origin
  --refresh             Bypass local cache and local source reuse; only meaningful with --allow-fetch
  --help                Show this message
`);
}

function parseArgs(argv) {
  const options = {
    resourceId: null,
    fileKey: null,
    nodeId: null,
    url: null,
    registryPath: DEFAULT_REGISTRY_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    sourceExportPath: null,
    maxCacheAgeMinutes: DEFAULT_MAX_CACHE_AGE_MINUTES,
    allowFetch: false,
    tokenEnv: DEFAULT_TOKEN_ENV,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    refresh: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--help" || current === "-h") {
      options.help = true;
      continue;
    }
    if (current === "--resource" && next) {
      options.resourceId = next;
      index += 1;
      continue;
    }
    if (current === "--file-key" && next) {
      options.fileKey = next;
      index += 1;
      continue;
    }
    if (current === "--node-id" && next) {
      options.nodeId = normalizeNodeId(next);
      index += 1;
      continue;
    }
    if (current === "--url" && next) {
      options.url = next;
      index += 1;
      continue;
    }
    if (current === "--registry" && next) {
      options.registryPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--output-dir" && next) {
      options.outputDir = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--source-export" && next) {
      options.sourceExportPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--max-cache-age-minutes" && next) {
      options.maxCacheAgeMinutes = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (current === "--allow-fetch") {
      options.allowFetch = true;
      continue;
    }
    if (current === "--token-env" && next) {
      options.tokenEnv = next;
      index += 1;
      continue;
    }
    if (current === "--api-base-url" && next) {
      options.apiBaseUrl = next.replace(/\/+$/u, "");
      index += 1;
      continue;
    }
    if (current === "--refresh") {
      options.refresh = true;
      continue;
    }
  }

  return options;
}

function buildPseudoTarget(target, maxCacheAgeMinutes) {
  return {
    resourceId: target.resource?.id ?? null,
    cachePolicy: {
      maxCacheAgeMinutes,
    },
    target: {
      fileKey: target.fileKey,
      nodeId: target.nodeId,
      nodeName: null,
      nodeType: null,
    },
  };
}

function buildOutput(bundle) {
  return {
    jsonPath: path.relative(process.cwd(), bundle.jsonPath),
    summaryPath: bundle.summaryPath ? path.relative(process.cwd(), bundle.summaryPath) : null,
    manifestPath: bundle.manifestPath ? path.relative(process.cwd(), bundle.manifestPath) : null,
    pngPath: bundle.pngPath ? path.relative(process.cwd(), bundle.pngPath) : null,
    svgPath: bundle.svgPath ? path.relative(process.cwd(), bundle.svgPath) : null,
  };
}

function buildInput(target, options) {
  return {
    fileKey: target.fileKey,
    nodeId: target.nodeId,
    registryResourceId: target.resource?.id ?? null,
    apiBaseUrl: options.apiBaseUrl,
    maxCacheAgeMinutes: options.maxCacheAgeMinutes,
    allowFetch: options.allowFetch,
  };
}

function buildCachedResult(target, options, cachedBundle) {
  const summary = cachedBundle.summaryPath
    ? JSON.parse(fs.readFileSync(cachedBundle.summaryPath, "utf8"))
    : null;
  return {
    ok: true,
    source: "local-artifact-cache",
    input: buildInput(target, options),
    output: buildOutput(cachedBundle),
    cache: {
      hit: true,
      ageMs: Date.now() - cachedBundle.createdAtMs,
    },
    summary,
  };
}

function findSourceExportCandidates(target, options) {
  const candidates = [];
  const seen = new Set();

  if (options.sourceExportPath && fs.existsSync(options.sourceExportPath)) {
    candidates.push(options.sourceExportPath);
    seen.add(options.sourceExportPath);
  }

  const rawExports = [...listRawExportJsonFiles()].reverse();
  for (const candidatePath of rawExports) {
    if (seen.has(candidatePath)) {
      continue;
    }
    try {
      const payload = readJson(candidatePath);
      if (payload?.fileKey === target.fileKey) {
        candidates.push(candidatePath);
        seen.add(candidatePath);
      }
    } catch {
      // Ignore malformed or transient artifacts and keep searching.
    }
  }

  return candidates;
}

function tryMaterializeFromLocalSource(target, options) {
  if (options.refresh) {
    return null;
  }

  const pseudoTarget = buildPseudoTarget(target, options.maxCacheAgeMinutes);
  for (const candidatePath of findSourceExportCandidates(target, options)) {
    try {
      const payload = readJson(candidatePath);
      const result = materializeFocusedArtifactFromLocalSource(payload, pseudoTarget, options);
      if (result) {
        return {
          ...result,
          sourceExportJsonPath: path.relative(process.cwd(), candidatePath),
        };
      }
    } catch {
      // Keep scanning other source exports for the same file.
    }
  }

  return null;
}

function buildMissResult(target, options) {
  const rerunArgs = target.resource?.id
    ? `--resource ${target.resource.id}`
    : target.raw?.startsWith("http")
      ? `--url ${target.raw}`
      : `--file-key ${target.fileKey} --node-id ${target.nodeId}`;

  return {
    ok: false,
    source: "local-only-miss",
    input: buildInput(target, options),
    reason: "No matching local artifact or reusable source export was found for this Figma target.",
    nextSteps: [
      "Run `pnpm -C tools/figma bridge:prepare` and `pnpm -C tools/figma bridge:listen`.",
      "Open the file in Figma Desktop, select the target node, and export it through HugeCode Local Figma Bridge.",
      `Re-run \`pnpm -C tools/figma bridge:resolve ${rerunArgs}\` to reuse the local artifact cache.`,
      options.allowFetch
        ? `If local export is still unavailable, set ${options.tokenEnv} and rerun with \`--allow-fetch\`.`
        : `If you intentionally need a REST fallback, rerun with \`--allow-fetch\` after setting ${options.tokenEnv}.`,
    ],
  };
}

export async function resolveTargetArtifact(options) {
  const target = resolveTarget(options);
  const pseudoTarget = buildPseudoTarget(target, options.maxCacheAgeMinutes);

  const reusableArtifact = findReusableFocusedArtifact(pseudoTarget, options);
  if (reusableArtifact) {
    const cachedBundle = findLatestArtifactBundleForSelection(
      options.outputDir,
      target.fileKey,
      target.nodeId
    );
    if (cachedBundle) {
      return buildCachedResult(target, options, cachedBundle);
    }
    return reusableArtifact;
  }

  const localSourceResult = tryMaterializeFromLocalSource(target, options);
  if (localSourceResult) {
    return {
      ...localSourceResult,
      input: buildInput(target, options),
    };
  }

  if (!options.allowFetch) {
    return buildMissResult(target, options);
  }

  return fetchTargetArtifact(options);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await resolveTargetArtifact(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
