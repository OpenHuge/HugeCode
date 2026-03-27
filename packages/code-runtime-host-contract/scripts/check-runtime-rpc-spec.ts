import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { buildCodeRuntimeRpcSpec, CODE_RUNTIME_RPC_CONTRACT_VERSION } from "../src/codeRuntimeRpc";
import { CODE_RUNTIME_HOST_EVENT_KINDS } from "../src/index";
import {
  buildRuntimeRpcCompatArtifacts,
  COMPAT_LIFECYCLE_NOTE_PATH,
  SERVICE_LIB_PATH,
} from "./runtime-rpc-compat-artifacts";

type GeneratedSpecPayload = {
  generatedAt: string;
  rpc: ReturnType<typeof buildCodeRuntimeRpcSpec>;
  hostEventKinds: readonly string[];
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, "../../..");
const frozenSpecPath = resolve(
  workspaceRoot,
  `docs/runtime/spec/code-runtime-rpc-spec.${CODE_RUNTIME_RPC_CONTRACT_VERSION}.json`
);
const archivedSpecHistoryDir = resolve(workspaceRoot, "docs/archive/runtime/spec-history");
const regenerateHint = "pnpm --filter @ku0/code-runtime-host-contract spec:generate";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFrozenPayload(raw: string): GeneratedSpecPayload {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`Frozen spec at "${frozenSpecPath}" must contain a JSON object.`);
  }

  if (typeof parsed.generatedAt !== "string" || parsed.generatedAt.trim().length === 0) {
    throw new Error(`Frozen spec at "${frozenSpecPath}" must include a non-empty "generatedAt".`);
  }

  return parsed as GeneratedSpecPayload;
}

function normalizeFeatureForSemanticComparison(feature: string): string | null {
  if (/^contract_frozen_\d{4}_\d{2}_\d{2}$/u.test(feature)) {
    return null;
  }
  if (/^app_server_protocol_v\d+_\d{4}_\d{2}_\d{2}$/u.test(feature)) {
    return null;
  }
  return feature;
}

function normalizeSemanticFeatureList(features: readonly string[]): readonly string[] {
  const normalized = features
    .map(normalizeFeatureForSemanticComparison)
    .filter((feature): feature is string => feature !== null);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function findPreviousFrozenSpecVersion(currentVersion: string): string | null {
  if (!existsSync(archivedSpecHistoryDir)) {
    return null;
  }
  const versions = readdirSync(archivedSpecHistoryDir)
    .map((entry) => /^code-runtime-rpc-spec\.(\d{4}-\d{2}-\d{2})\.json$/u.exec(entry)?.[1] ?? null)
    .filter((version): version is string => version !== null)
    .filter((version) => version < currentVersion)
    .sort((left, right) => left.localeCompare(right));
  return versions.at(-1) ?? null;
}

function assertVersionBumpCarriesSemanticDelta(payload: GeneratedSpecPayload): void {
  const currentVersion = payload.rpc.contractVersion;
  const previousVersion = findPreviousFrozenSpecVersion(currentVersion);
  if (!previousVersion) {
    return;
  }

  const previousSpecPath = resolve(
    archivedSpecHistoryDir,
    `code-runtime-rpc-spec.${previousVersion}.json`
  );
  const previousPayload = parseFrozenPayload(readFileSync(previousSpecPath, "utf8"));

  const unchanged =
    isDeepStrictEqual(payload.rpc.methods, previousPayload.rpc.methods) &&
    isDeepStrictEqual(payload.rpc.canonicalMethods, previousPayload.rpc.canonicalMethods) &&
    isDeepStrictEqual(payload.rpc.errorCodes, previousPayload.rpc.errorCodes) &&
    isDeepStrictEqual(payload.rpc.transports, previousPayload.rpc.transports) &&
    isDeepStrictEqual(payload.rpc.executionGraphFields, previousPayload.rpc.executionGraphFields) &&
    isDeepStrictEqual(payload.hostEventKinds, previousPayload.hostEventKinds) &&
    isDeepStrictEqual(
      normalizeSemanticFeatureList(payload.rpc.features),
      normalizeSemanticFeatureList(previousPayload.rpc.features)
    );

  if (unchanged) {
    throw new Error(
      [
        `Runtime RPC contractVersion=${currentVersion} has no semantic delta vs previous frozen spec ${previousVersion}.`,
        "Version/freeze-only bumps are disallowed because they can break runtime handshake without functional contract changes.",
        "Either revert the version/freeze bump or include meaningful contract changes and regenerate frozen specs.",
      ].join("\n")
    );
  }
}

function diffList(
  label: string,
  actual: readonly string[],
  expected: readonly string[]
): string | null {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));

  if (missing.length === 0 && extra.length === 0) {
    return null;
  }

  const chunks: string[] = [`${label} changed.`];
  if (missing.length > 0) {
    chunks.push(`missing in frozen spec: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    chunks.push(`unexpected in frozen spec: ${extra.join(", ")}`);
  }
  return chunks.join(" ");
}

function collectMismatchDetails(
  actual: GeneratedSpecPayload,
  expected: GeneratedSpecPayload
): string[] {
  const details: string[] = [];

  if (actual.rpc.contractVersion !== expected.rpc.contractVersion) {
    details.push(
      `contractVersion mismatch: frozen="${actual.rpc.contractVersion}" expected="${expected.rpc.contractVersion}".`
    );
  }

  if (actual.rpc.freezeEffectiveAt !== expected.rpc.freezeEffectiveAt) {
    details.push(
      `freezeEffectiveAt mismatch: frozen="${actual.rpc.freezeEffectiveAt}" expected="${expected.rpc.freezeEffectiveAt}".`
    );
  }

  if (actual.rpc.methodSetHash !== expected.rpc.methodSetHash) {
    details.push(
      `methodSetHash mismatch: frozen="${actual.rpc.methodSetHash}" expected="${expected.rpc.methodSetHash}".`
    );
  }

  const methodDiff = diffList("methods", actual.rpc.methods, expected.rpc.methods);
  if (methodDiff) {
    details.push(methodDiff);
  }

  const canonicalMethodDiff = diffList(
    "canonicalMethods",
    actual.rpc.canonicalMethods,
    expected.rpc.canonicalMethods
  );
  if (canonicalMethodDiff) {
    details.push(canonicalMethodDiff);
  }

  const featureDiff = diffList("features", actual.rpc.features, expected.rpc.features);
  if (featureDiff) {
    details.push(featureDiff);
  }

  const hostEventDiff = diffList("hostEventKinds", actual.hostEventKinds, expected.hostEventKinds);
  if (hostEventDiff) {
    details.push(hostEventDiff);
  }

  if (!isDeepStrictEqual(actual.rpc.errorCodes, expected.rpc.errorCodes)) {
    details.push("errorCodes changed.");
  }

  if (!isDeepStrictEqual(actual.rpc.transports, expected.rpc.transports)) {
    details.push("transports changed.");
  }

  if (!isDeepStrictEqual(actual.rpc.executionGraphFields, expected.rpc.executionGraphFields)) {
    details.push("executionGraphFields changed.");
  }

  if (details.length === 0) {
    details.push("Frozen spec payload differs from regenerated payload.");
  }

  return details;
}

function buildExpectedPayload(generatedAt: string): GeneratedSpecPayload {
  return {
    generatedAt,
    rpc: buildCodeRuntimeRpcSpec(),
    hostEventKinds: CODE_RUNTIME_HOST_EVENT_KINDS,
  };
}

function main(): void {
  const frozenPayload = parseFrozenPayload(readFileSync(frozenSpecPath, "utf8"));
  const expectedPayload = buildExpectedPayload(frozenPayload.generatedAt);
  assertVersionBumpCarriesSemanticDelta(expectedPayload);

  const compatArtifacts = buildRuntimeRpcCompatArtifacts(workspaceRoot);
  const compatMismatches: string[] = [];
  if (readFileSync(compatArtifacts.serviceLibPath, "utf8") !== compatArtifacts.nextServiceSource) {
    compatMismatches.push(`${SERVICE_LIB_PATH} is out of date.`);
  }
  const lifecycleNotePath = resolve(workspaceRoot, COMPAT_LIFECYCLE_NOTE_PATH);
  if (
    !existsSync(lifecycleNotePath) ||
    readFileSync(lifecycleNotePath, "utf8") !== `${compatArtifacts.lifecycleMarkdown}\n`
  ) {
    compatMismatches.push(`${COMPAT_LIFECYCLE_NOTE_PATH} is out of date.`);
  }

  if (isDeepStrictEqual(frozenPayload, expectedPayload) && compatMismatches.length === 0) {
    process.stdout.write(`Runtime RPC frozen spec is up to date: ${frozenSpecPath}\n`);
    return;
  }

  const mismatchDetails = collectMismatchDetails(frozenPayload, expectedPayload);
  const messageLines = [
    `Runtime RPC frozen spec mismatch at ${frozenSpecPath}.`,
    ...mismatchDetails.map((detail) => `- ${detail}`),
    ...compatMismatches.map((detail) => `- ${detail}`),
    `Regenerate frozen spec with: ${regenerateHint}`,
  ];

  throw new Error(messageLines.join("\n"));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
