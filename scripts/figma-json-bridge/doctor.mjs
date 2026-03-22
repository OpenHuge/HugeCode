#!/usr/bin/env node

import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_REGISTRY_PATH,
  DEFAULT_TOKEN_ENV,
  resolveTarget,
} from "./fetch.mjs";
import { listRawExportJsonFiles } from "../figma-pipeline/shared/paths.mjs";

function parseArgs(argv) {
  const options = {
    resourceId: null,
    fileKey: null,
    nodeId: null,
    url: null,
    registryPath: DEFAULT_REGISTRY_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    tokenEnv: DEFAULT_TOKEN_ENV,
    apiBaseUrl: DEFAULT_API_BASE_URL,
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
      options.nodeId = next;
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
  }

  return options;
}

function printHelp() {
  process.stdout.write(`Usage:
  pnpm -C tools/figma bridge:prepare
  pnpm -C tools/figma bridge:listen
  pnpm -C tools/figma bridge:doctor --resource <registry-id>
  pnpm -C tools/figma bridge:doctor --url <figma-url>
  pnpm -C tools/figma bridge:doctor --file-key <fileKey> --node-id <nodeId>

Options:
  --resource <id>       Resource id from docs/design-system/figma-reference-registry.json
  --file-key <key>      Figma file key when not using --resource
  --node-id <id>        Figma node id (1:24862 or 1-24862)
  --url <url>           Full Figma design URL containing node-id
  --registry <path>     Override registry JSON path
  --output-dir <path>   Override artifacts output directory
  --token-env <name>    Environment variable containing a Figma personal access token
  --api-base-url <url>  Override the Figma API origin for reachability checks
  --help                Show this message

Notes:
  This command is for maintenance-oriented REST fetch diagnostics.
  The default local workflow is pnpm -C tools/figma bridge:prepare + pnpm -C tools/figma bridge:listen + Desktop plugin export.
`);
}

function loadRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Registry file was not found: ${registryPath}`);
  }
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

function findResource(resources, resourceId) {
  if (!resourceId) {
    return null;
  }
  return resources.find((entry) => entry.id === resourceId) ?? null;
}

function findLatestArtifact(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return null;
  }

  const entries =
    path.resolve(outputDir) === path.resolve(DEFAULT_OUTPUT_DIR)
      ? listRawExportJsonFiles()
      : fs
          .readdirSync(outputDir, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.endsWith(".json") &&
              !entry.name.endsWith(".summary.json") &&
              !entry.name.endsWith(".manifest.json")
          )
          .map((entry) => path.join(outputDir, entry.name))
          .sort();

  if (entries.length === 0) {
    return null;
  }

  const jsonPath = entries[entries.length - 1];
  const manifestPath = jsonPath.replace(/\.json$/u, ".manifest.json");
  const summaryPath = jsonPath.replace(/\.json$/u, ".summary.json");

  const stats = fs.statSync(jsonPath);
  const summary = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
    : null;

  return {
    jsonPath,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
    summaryPath: fs.existsSync(summaryPath) ? summaryPath : null,
    modifiedAt: stats.mtime.toISOString(),
    summary,
  };
}

function buildStatus(name, ok, detail, nextStep = null) {
  return { name, ok, detail, nextStep };
}

async function checkApiReachability(apiBaseUrl) {
  try {
    const hostname = new URL(apiBaseUrl).hostname;
    await Promise.race([
      dns.lookup(hostname),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timed out while resolving ${hostname}.`));
        }, 2500);
      }),
    ]);
    return {
      ok: true,
      detail: `Resolved ${hostname} from ${apiBaseUrl}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      detail: `Could not resolve the API host for ${apiBaseUrl}: ${message}`,
    };
  }
}

function buildFetchCommand(options, target) {
  if (!target) {
    return "Pass --resource <id>, --url <figma-url>, or --file-key <key> --node-id <id>.";
  }

  if (options.resourceId) {
    return `pnpm -C tools/figma bridge:fetch --resource ${options.resourceId}`;
  }
  if (options.url) {
    return `pnpm -C tools/figma bridge:fetch --url '${options.url}'`;
  }
  return `pnpm -C tools/figma bridge:fetch --file-key ${target.fileKey} --node-id ${target.nodeId}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const registry = loadRegistry(options.registryPath);
  const resources = Array.isArray(registry.resources) ? registry.resources : [];
  const resource = findResource(resources, options.resourceId);
  const latestArtifact = findLatestArtifact(options.outputDir);
  const tokenValue = process.env[options.tokenEnv] ?? "";
  const hasExplicitTarget =
    Boolean(options.resourceId) ||
    Boolean(options.url) ||
    Boolean(options.fileKey && options.nodeId);

  let resolvedTarget = null;
  let targetError = null;
  if (hasExplicitTarget) {
    try {
      resolvedTarget = resolveTarget(options);
    } catch (error) {
      targetError = error instanceof Error ? error.message : String(error);
    }
  }

  const apiReachability = await checkApiReachability(options.apiBaseUrl);

  const checks = [
    buildStatus(
      "registry",
      true,
      `${resources.length} resource(s) available in ${path.relative(process.cwd(), options.registryPath)}.`,
      hasExplicitTarget
        ? null
        : "Pass --resource <id>, --url <figma-url>, or --file-key <key> --node-id <id>."
    ),
    buildStatus(
      "target",
      hasExplicitTarget ? resolvedTarget !== null : true,
      hasExplicitTarget
        ? resolvedTarget
          ? `Resolved target -> fileKey ${resolvedTarget.fileKey}, nodeId ${resolvedTarget.nodeId}.`
          : (targetError ?? "Target could not be resolved.")
        : "No specific resource requested.",
      hasExplicitTarget && !resolvedTarget
        ? "Pick a valid registry id or provide a Figma URL/file key + node id."
        : null
    ),
    buildStatus(
      "token",
      tokenValue.trim().length > 0,
      tokenValue.trim().length > 0
        ? `Environment variable ${options.tokenEnv} is set.`
        : `Environment variable ${options.tokenEnv} is missing.`,
      tokenValue.trim().length > 0
        ? null
        : `Prefer pnpm -C tools/figma bridge:prepare + pnpm -C tools/figma bridge:listen for local work, or set ${options.tokenEnv} before running ${buildFetchCommand(options, resolvedTarget)}`
    ),
    buildStatus(
      "apiReachability",
      apiReachability.ok,
      apiReachability.detail,
      apiReachability.ok
        ? null
        : "Use pnpm -C tools/figma bridge:listen plus the Desktop plugin fallback, or restore DNS/network access to the Figma API host."
    ),
    buildStatus(
      "artifact",
      latestArtifact !== null,
      latestArtifact
        ? `Latest artifact: ${path.relative(process.cwd(), latestArtifact.jsonPath)} (${latestArtifact.modifiedAt}).`
        : `No raw export bundle found in ${path.relative(process.cwd(), options.outputDir)}.`,
      latestArtifact
        ? "Run pnpm -C tools/figma bridge:inspect to inspect the current bundle."
        : null
    ),
  ];

  const readyForHeadlessFetch =
    checks.find((check) => check.name === "token")?.ok &&
    checks.find((check) => check.name === "target")?.ok &&
    checks.find((check) => check.name === "apiReachability")?.ok;

  const readyForInspect = checks.find((check) => check.name === "artifact")?.ok;

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: checks.every((check) => check.ok),
        checks,
        resource: resource
          ? {
              id: resource.id,
              fileKey: resource.fileKey,
              nodeId: resource.nodeId,
              url: resource.url ?? null,
            }
          : null,
        target: resolvedTarget
          ? {
              fileKey: resolvedTarget.fileKey,
              nodeId: resolvedTarget.nodeId,
              raw: resolvedTarget.raw,
              registryResourceId: resolvedTarget.resource?.id ?? null,
              url: options.url ?? resolvedTarget.resource?.url ?? null,
            }
          : null,
        apiBaseUrl: options.apiBaseUrl,
        latestArtifact: latestArtifact
          ? {
              jsonPath: path.relative(process.cwd(), latestArtifact.jsonPath),
              summaryPath: latestArtifact.summaryPath
                ? path.relative(process.cwd(), latestArtifact.summaryPath)
                : null,
              manifestPath: latestArtifact.manifestPath
                ? path.relative(process.cwd(), latestArtifact.manifestPath)
                : null,
              modifiedAt: latestArtifact.modifiedAt,
              summary: latestArtifact.summary,
            }
          : null,
        next: {
          fetch: readyForHeadlessFetch
            ? buildFetchCommand(options, resolvedTarget)
            : checks.find((check) => check.name === "token")?.ok !== true
              ? `Prefer pnpm -C tools/figma bridge:prepare + pnpm -C tools/figma bridge:listen for local work, or set ${options.tokenEnv} and rerun ${buildFetchCommand(options, resolvedTarget)}`
              : checks.find((check) => check.name === "apiReachability")?.ok !== true
                ? "Use pnpm -C tools/figma bridge:listen plus the Desktop plugin fallback, or restore DNS/network access to api.figma.com."
                : buildFetchCommand(options, resolvedTarget),
          inspect: readyForInspect
            ? "pnpm -C tools/figma bridge:inspect"
            : "Create a raw export bundle first via pnpm -C tools/figma bridge:listen, or use pnpm -C tools/figma bridge:fetch only when you intentionally need a fresh REST snapshot.",
          note: "Figma MCP seat or quota limits are independent of this doctor command. Prefer the local bridge path for normal local work and treat REST fetch as maintenance-only.",
        },
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
