#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { findLatestArtifactBundleForSelection, writeArtifactBundle } from "./artifact-helpers.mjs";

export const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), ".figma-workflow", "figma-exports");
export const DEFAULT_REGISTRY_PATH = path.join(
  process.cwd(),
  "docs",
  "design-system",
  "figma-reference-registry.json"
);
export const DEFAULT_TOKEN_ENV = "FIGMA_ACCESS_TOKEN";
export const DEFAULT_API_BASE_URL = "https://api.figma.com";
const DEFAULT_MAX_CACHE_AGE_MINUTES = 60;
const DEFAULT_MAX_RETRY_ATTEMPTS = 4;
const DEFAULT_MAX_RETRY_DELAY_MS = 8000;
const MAX_RETRY_AFTER_TO_AUTO_RETRY_MS = 30000;
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

function printHelp() {
  process.stdout.write(`Usage:
  pnpm -C tools/figma bridge:fetch --resource <registry-id>
  pnpm -C tools/figma bridge:fetch --file-key <fileKey> --node-id <nodeId>

Options:
  --resource <id>       Resource id from docs/design-system/figma-reference-registry.json
  --file-key <key>      Figma file key when not using --resource
  --node-id <id>        Figma node id (1:24862 or 1-24862)
  --url <url>           Full Figma design URL containing node-id
  --registry <path>     Override registry JSON path
  --output-dir <path>   Override artifacts output directory
  --token-env <name>    Environment variable containing a Figma personal access token
  --api-base-url <url>  Override the Figma API origin; useful for local smoke tests
  --max-cache-age-minutes <n>  Reuse the latest local artifact for the same node when it is newer than n minutes
  --refresh             Bypass the local artifact cache and fetch fresh data from Figma
  --help                Show this message
`);
}

export function normalizeNodeId(value) {
  return value.replace(/-/gu, ":");
}

export function parseTargetUrl(rawValue) {
  const url = new URL(rawValue);
  const rawNodeId = url.searchParams.get("node-id");
  if (!rawNodeId) {
    throw new Error("Expected the Figma URL to contain a node-id query parameter.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const designIndex = segments.findIndex((segment) => segment === "design");
  const fileKey = designIndex >= 0 ? (segments[designIndex + 1] ?? null) : null;
  if (!fileKey) {
    throw new Error("Could not infer the Figma file key from the provided URL.");
  }

  return {
    fileKey,
    nodeId: normalizeNodeId(rawNodeId),
    raw: rawValue,
  };
}

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
    maxCacheAgeMinutes: DEFAULT_MAX_CACHE_AGE_MINUTES,
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
    if (current === "--max-cache-age-minutes" && next) {
      options.maxCacheAgeMinutes = Number.parseInt(next, 10);
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

export function loadRegistry(registryPath) {
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

export function resolveTarget(options) {
  if (options.url) {
    return parseTargetUrl(options.url);
  }

  if (options.resourceId) {
    const registry = loadRegistry(options.registryPath);
    const resource = Array.isArray(registry.resources)
      ? registry.resources.find((entry) => entry.id === options.resourceId)
      : null;
    if (!resource) {
      throw new Error(`Resource '${options.resourceId}' was not found in ${options.registryPath}.`);
    }

    return {
      fileKey: resource.fileKey,
      nodeId: normalizeNodeId(resource.nodeId),
      raw: resource.url ?? resource.id,
      resource,
    };
  }

  if (options.fileKey && options.nodeId) {
    return {
      fileKey: options.fileKey,
      nodeId: options.nodeId,
      raw: `${options.fileKey}:${options.nodeId}`,
    };
  }

  throw new Error(
    "Missing target. Use --resource <id>, --url <figma-url>, or --file-key <key> --node-id <id>."
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parseRetryAfterMs(response) {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = Number.parseFloat(retryAfterHeader ?? "");
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.ceil(retryAfterSeconds * 1000);
  }

  return null;
}

function parseRetryDelayMs(response, attempt) {
  const retryAfterMs = parseRetryAfterMs(response);
  if (typeof retryAfterMs === "number") {
    return Math.min(DEFAULT_MAX_RETRY_DELAY_MS, retryAfterMs);
  }

  return Math.min(DEFAULT_MAX_RETRY_DELAY_MS, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

function buildRateLimitError(url, response) {
  const retryAfterMs = parseRetryAfterMs(response);
  const retryAfterSeconds =
    typeof retryAfterMs === "number" ? Math.ceil(retryAfterMs / 1000) : "unknown";
  const planTier = response.headers.get("x-figma-plan-tier") ?? "unknown";
  const rateLimitType = response.headers.get("x-figma-rate-limit-type") ?? "unknown";

  return new Error(
    `Figma request was rate limited for ${url}. Retry-After=${retryAfterSeconds}s, plan=${planTier}, limitType=${rateLimitType}. Reuse the local artifact cache, wait for the limit window to reset, or switch to the Desktop plugin fallback instead of retrying immediately.`
  );
}

async function fetchWithTimeout(url, init) {
  return fetch(url, {
    ...(init ?? {}),
    signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  });
}

async function fetchJson(url, token, attempt = 0) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response);
    const shouldRetry =
      attempt + 1 < DEFAULT_MAX_RETRY_ATTEMPTS &&
      (retryAfterMs === null || retryAfterMs <= MAX_RETRY_AFTER_TO_AUTO_RETRY_MS);

    if (!shouldRetry) {
      throw buildRateLimitError(url, response);
    }

    await sleep(parseRetryDelayMs(response, attempt));
    return fetchJson(url, token, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Figma request failed (${response.status} ${response.statusText}) for ${url}.`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Asset request failed (${response.status} ${response.statusText}) for ${url}.`);
  }
  return response.text();
}

async function fetchArrayBuffer(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Asset request failed (${response.status} ${response.statusText}) for ${url}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function buildApiUrl(baseUrl, pathname) {
  return new URL(`${baseUrl}${pathname}`);
}

async function fetchNodeDocument(fileKey, nodeId, token, apiBaseUrl) {
  const endpoint = buildApiUrl(apiBaseUrl, `/v1/files/${fileKey}/nodes`);
  endpoint.searchParams.set("ids", nodeId);
  const payload = await fetchJson(endpoint, token);
  const nodePayload = payload?.nodes?.[nodeId] ?? null;
  if (!nodePayload?.document) {
    throw new Error(`Node '${nodeId}' was not returned by the Figma file nodes endpoint.`);
  }

  return {
    payload,
    nodePayload,
  };
}

async function fetchRenderUrl(fileKey, nodeId, token, format, apiBaseUrl) {
  const endpoint = buildApiUrl(apiBaseUrl, `/v1/images/${fileKey}`);
  endpoint.searchParams.set("ids", nodeId);
  endpoint.searchParams.set("format", format);
  if (format === "png") {
    endpoint.searchParams.set("scale", "2");
  }

  const payload = await fetchJson(endpoint, token);
  const imageUrl = payload?.images?.[nodeId] ?? null;
  if (!imageUrl) {
    return null;
  }

  return imageUrl;
}

async function buildPayload(target, token, apiBaseUrl) {
  const { payload, nodePayload } = await fetchNodeDocument(
    target.fileKey,
    target.nodeId,
    token,
    apiBaseUrl
  );
  const pngUrl = await fetchRenderUrl(target.fileKey, target.nodeId, token, "png", apiBaseUrl);
  const svgUrl = await fetchRenderUrl(target.fileKey, target.nodeId, token, "svg", apiBaseUrl);

  const pngBase64 = pngUrl ? (await fetchArrayBuffer(pngUrl)).toString("base64") : "";
  const svgString = svgUrl ? await fetchText(svgUrl) : "";
  const parentPage = Array.isArray(payload?.document?.children)
    ? payload.document.children.find((child) => {
        const children = Array.isArray(child?.children) ? child.children : [];
        return children.some((grandChild) => grandChild?.id === target.nodeId);
      })
    : null;

  return {
    exportedAt: new Date().toISOString(),
    fileKey: target.fileKey,
    currentPage: parentPage
      ? {
          id: parentPage.id,
          name: parentPage.name,
        }
      : null,
    selection: {
      id: nodePayload.document.id,
      name: nodePayload.document.name,
      type: nodePayload.document.type,
    },
    requestedTarget: {
      raw: target.raw,
      fileKey: target.fileKey,
      nodeId: target.nodeId,
      url:
        target.resource?.url ??
        (typeof target.raw === "string" && target.raw.startsWith("http") ? target.raw : null),
      registryResourceId: target.resource?.id ?? null,
      source: "figma-rest-api",
    },
    documentMeta: {
      name: payload?.name ?? null,
      version: payload?.version ?? null,
      lastModified: payload?.lastModified ?? null,
    },
    document: nodePayload,
    resources: {
      pngBase64,
      svgString,
    },
  };
}

function isFiniteNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function loadCachedArtifact(target, options) {
  if (options.refresh || !isFiniteNonNegativeNumber(options.maxCacheAgeMinutes)) {
    return null;
  }

  const cachedBundle = findLatestArtifactBundleForSelection(
    options.outputDir,
    target.fileKey,
    target.nodeId
  );
  if (!cachedBundle?.jsonPath || !fs.existsSync(cachedBundle.jsonPath)) {
    return null;
  }

  const ageMs = Date.now() - cachedBundle.createdAtMs;
  if (ageMs > options.maxCacheAgeMinutes * 60 * 1000) {
    return null;
  }

  const summary = cachedBundle.summaryPath
    ? JSON.parse(fs.readFileSync(cachedBundle.summaryPath, "utf8"))
    : null;

  return {
    ageMs,
    bundle: cachedBundle,
    summary,
  };
}

function buildResultPayload(target, options, output, summary, cache) {
  return {
    ok: true,
    source: cache.hit ? "local-artifact-cache" : "figma-rest-api",
    input: {
      fileKey: target.fileKey,
      nodeId: target.nodeId,
      registryResourceId: target.resource?.id ?? null,
      apiBaseUrl: options.apiBaseUrl,
      maxCacheAgeMinutes: options.maxCacheAgeMinutes,
    },
    output,
    cache,
    summary,
  };
}

function buildCachedOutput(bundle) {
  return {
    jsonPath: path.relative(process.cwd(), bundle.jsonPath),
    summaryPath: bundle.summaryPath ? path.relative(process.cwd(), bundle.summaryPath) : null,
    manifestPath: bundle.manifestPath ? path.relative(process.cwd(), bundle.manifestPath) : null,
    pngPath: bundle.pngPath ? path.relative(process.cwd(), bundle.pngPath) : null,
    svgPath: bundle.svgPath ? path.relative(process.cwd(), bundle.svgPath) : null,
  };
}

function buildFreshOutput(artifact) {
  return {
    jsonPath: path.relative(process.cwd(), artifact.jsonPath),
    summaryPath: path.relative(process.cwd(), artifact.summaryPath),
    manifestPath: path.relative(process.cwd(), artifact.manifestPath),
    pngPath: artifact.pngPath ? path.relative(process.cwd(), artifact.pngPath) : null,
    svgPath: artifact.svgPath ? path.relative(process.cwd(), artifact.svgPath) : null,
  };
}

export async function fetchTargetArtifact(options) {
  const target = resolveTarget(options);
  const cached = loadCachedArtifact(target, options);
  if (cached) {
    return buildResultPayload(target, options, buildCachedOutput(cached.bundle), cached.summary, {
      hit: true,
      ageMs: cached.ageMs,
    });
  }

  const token = process.env[options.tokenEnv];
  if (!token || token.trim().length === 0) {
    throw new Error(
      `Missing Figma access token. Set ${options.tokenEnv} before running pnpm -C tools/figma bridge:fetch.`
    );
  }

  const payload = await buildPayload(target, token, options.apiBaseUrl);
  const artifact = writeArtifactBundle(payload, options.outputDir);

  return buildResultPayload(target, options, buildFreshOutput(artifact), artifact.summary, {
    hit: false,
    ageMs: null,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await fetchTargetArtifact(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
