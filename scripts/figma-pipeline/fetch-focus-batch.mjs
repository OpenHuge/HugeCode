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
} from "../figma-json-bridge/fetch.mjs";
import {
  findReusableFocusedArtifact,
  materializeFocusedArtifactFromLocalSource,
} from "../figma-json-bridge/local-source-artifacts.mjs";
import { deriveFocusPlanFromExport } from "./shared/focus-plan.mjs";
import { readJson, resolveLatestRawExportJsonPath, writeJson } from "./shared/paths.mjs";

const DEFAULT_DELAY_MS = 1500;
const DEFAULT_REPORT_PATH = path.join(
  process.cwd(),
  ".figma-workflow",
  "figma-exports-validation",
  "focus-batch-report.json"
);

function printHelp() {
  process.stdout.write(`Usage:
  pnpm -C tools/figma pipeline:focus-fetch --plan docs/design-system/figma-focus-plan.linear-dark-mode.json
  pnpm -C tools/figma pipeline:focus-fetch --families Button,Input,Select --limit 3

Options:
  --plan <path>         Use an existing focus plan JSON
  --families <csv>      Restrict execution to specific families
  --limit <n>           Only execute the first n targets after filtering
  --delay-ms <n>        Delay between fresh Figma requests; cache hits do not wait
  --max-cache-age-minutes <n>  Override per-target cache TTL
  --output-dir <path>   Override Figma artifact output directory
  --source-export <path>  Reuse a specific raw root export when materializing focused child artifacts locally
  --report <path>       Write a batch execution report JSON
  --token-env <name>    Override the token env var name
  --api-base-url <url>  Override the Figma API origin
  --refresh             Bypass local cache
  --help                Show this message
`);
}

function parseArgs(argv) {
  const options = {
    planPath: null,
    explicitInputPath: null,
    families: [],
    limit: null,
    delayMs: DEFAULT_DELAY_MS,
    maxCacheAgeMinutes: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    sourceExportPath: null,
    reportPath: DEFAULT_REPORT_PATH,
    tokenEnv: DEFAULT_TOKEN_ENV,
    registryPath: DEFAULT_REGISTRY_PATH,
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
    if (current === "--plan" && next) {
      options.planPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--families" && next) {
      options.families = next
        .split(",")
        .map((family) => family.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (current === "--limit" && next) {
      options.limit = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (current === "--delay-ms" && next) {
      options.delayMs = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (current === "--max-cache-age-minutes" && next) {
      options.maxCacheAgeMinutes = Number.parseInt(next, 10);
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
    if (current === "--report" && next) {
      options.reportPath = path.resolve(next);
      index += 1;
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
    if (!current.startsWith("--") && options.explicitInputPath === null) {
      options.explicitInputPath = current;
      continue;
    }
  }

  return options;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function readPlan(options) {
  if (options.planPath) {
    return JSON.parse(fs.readFileSync(options.planPath, "utf8"));
  }

  const exportJsonPath = resolveLatestRawExportJsonPath(options.explicitInputPath);
  return deriveFocusPlanFromExport(exportJsonPath);
}

export function filterFocusTargets(plan, options) {
  const requestedFamilies = new Set(options.families.map((family) => family.toLowerCase()));
  const filtered = (Array.isArray(plan?.targets) ? plan.targets : []).filter((target) => {
    if (requestedFamilies.size === 0) {
      return true;
    }
    return requestedFamilies.has(String(target.family ?? "").toLowerCase());
  });

  if (Number.isInteger(options.limit) && options.limit > 0) {
    return filtered.slice(0, options.limit);
  }

  return filtered;
}

function resolveSourceExportPath(options, plan) {
  if (options.refresh) {
    return null;
  }

  const candidatePaths = [];
  if (options.sourceExportPath) {
    candidatePaths.push(options.sourceExportPath);
  }

  try {
    const latestRawExportPath = resolveLatestRawExportJsonPath(options.explicitInputPath);
    if (latestRawExportPath) {
      candidatePaths.push(latestRawExportPath);
    }
  } catch {}

  for (const candidatePath of candidatePaths) {
    if (!candidatePath || !fs.existsSync(candidatePath)) {
      continue;
    }
    const payload = readJson(candidatePath);
    if (
      payload?.fileKey === plan?.source?.fileKey &&
      payload?.selection?.id === plan?.source?.selection?.id
    ) {
      return {
        jsonPath: candidatePath,
        payload,
      };
    }
  }

  return null;
}

export async function runFocusBatch(options) {
  const plan = readPlan(options);
  const targets = filterFocusTargets(plan, options);
  const sourceExport = resolveSourceExportPath(options, plan);
  const startedAt = new Date().toISOString();
  const results = [];
  let cacheHits = 0;
  let freshFetches = 0;
  let localMaterializations = 0;
  let failures = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    try {
      let result = findReusableFocusedArtifact(target, options);
      if (!result && sourceExport) {
        result = materializeFocusedArtifactFromLocalSource(sourceExport.payload, target, options);
      }
      if (!result) {
        result = await fetchTargetArtifact({
          resourceId: null,
          fileKey: target?.target?.fileKey ?? null,
          nodeId: target?.target?.nodeId ?? null,
          url: null,
          registryPath: options.registryPath,
          outputDir: options.outputDir,
          tokenEnv: options.tokenEnv,
          apiBaseUrl: options.apiBaseUrl,
          maxCacheAgeMinutes:
            Number.isInteger(options.maxCacheAgeMinutes) && options.maxCacheAgeMinutes >= 0
              ? options.maxCacheAgeMinutes
              : Number(target?.cachePolicy?.maxCacheAgeMinutes ?? 360),
          refresh: options.refresh,
        });
      }
      if (result.cache.hit) {
        cacheHits += 1;
      } else if (result.source === "local-source-export") {
        localMaterializations += 1;
      } else {
        freshFetches += 1;
      }
      results.push({
        family: target.family,
        priority: target.priority,
        resourceId: target.resourceId,
        workflowRecommendation: target.workflowRecommendation,
        result,
      });

      if (!result.cache.hit && index < targets.length - 1 && options.delayMs > 0) {
        await sleep(options.delayMs);
      }
    } catch (error) {
      failures += 1;
      results.push({
        family: target.family,
        priority: target.priority,
        resourceId: target.resourceId,
        workflowRecommendation: target.workflowRecommendation,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const report = {
    artifactVersion: 1,
    startedAt,
    completedAt: new Date().toISOString(),
    planPath: options.planPath ? path.relative(process.cwd(), options.planPath) : null,
    outputDir: path.relative(process.cwd(), options.outputDir),
    strategy: {
      refresh: options.refresh,
      delayMs: options.delayMs,
      defaultMaxCacheAgeMinutes: options.maxCacheAgeMinutes,
      fetchPolicy: "sequential-cache-first",
      sourceExportPath: sourceExport ? path.relative(process.cwd(), sourceExport.jsonPath) : null,
    },
    summary: {
      selectedTargets: targets.length,
      cacheHits,
      freshFetches,
      localMaterializations,
      failures,
    },
    results,
  };

  writeJson(options.reportPath, report);

  return {
    ok: failures === 0,
    reportPath: path.relative(process.cwd(), options.reportPath),
    summary: report.summary,
    results,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  runFocusBatch(options)
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) {
        process.exit(1);
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
