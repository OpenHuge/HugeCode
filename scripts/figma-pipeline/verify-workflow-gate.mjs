#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { runFocusBatch } from "./fetch-focus-batch.mjs";
import { developFromExport } from "./develop.mjs";
import { evaluateWorkflowGate } from "./workflow-gate-core.mjs";

const DEFAULT_PLAN_PATH = path.join(
  process.cwd(),
  "docs",
  "design-system",
  "figma-focus-plan.linear-dark-mode.json"
);
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), ".figma-workflow", "figma-exports");
const DEFAULT_VALIDATION_ROOT = path.join(
  process.cwd(),
  ".figma-workflow",
  "figma-exports-validation",
  "workflow-gate"
);
const DEFAULT_FAMILIES = ["Button", "Input", "Select"];
const smokeScriptPath = path.join(process.cwd(), "scripts", "figma-json-bridge", "smoke.mjs");

function printHelp() {
  process.stdout.write(`Usage:
  node scripts/figma-pipeline/verify-workflow-gate.mjs
  node scripts/figma-pipeline/verify-workflow-gate.mjs --plan docs/design-system/figma-focus-plan.linear-dark-mode.json --families Button,Input,Select

Options:
  --plan <path>             Focus plan JSON to verify
  --families <csv>          Focus families to include in the gate
  --source-export <path>    Explicit raw root export to use for local split verification
  --output-dir <path>       Existing artifact directory to search for root exports
  --validation-root <path>  Directory where the gate run should write reports
  --help                    Show this message
`);
}

function parseArgs(argv) {
  const options = {
    planPath: DEFAULT_PLAN_PATH,
    families: [...DEFAULT_FAMILIES],
    sourceExportPath: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    validationRoot: DEFAULT_VALIDATION_ROOT,
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
    if (current === "--source-export" && next) {
      options.sourceExportPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--output-dir" && next) {
      options.outputDir = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--validation-root" && next) {
      options.validationRoot = path.resolve(next);
      index += 1;
      continue;
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listRawExportCandidates(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter(
      (fileName) =>
        fileName.endsWith(".json") &&
        !fileName.endsWith(".summary.json") &&
        !fileName.endsWith(".manifest.json") &&
        !fileName.endsWith(".primitive-tokens.json") &&
        !fileName.endsWith(".semantic-tokens.json") &&
        !fileName.endsWith(".qa-report.json") &&
        !fileName.endsWith(".codegen-report.json") &&
        !fileName.endsWith(".component-specs.json") &&
        !fileName.endsWith(".variant-state-model.json") &&
        !fileName.endsWith(".component-inventory.json") &&
        !fileName.endsWith(".classified-node-graph.json") &&
        !fileName.endsWith(".generation-plan.json") &&
        !fileName.endsWith(".promotion-manifest.json")
    )
    .map((fileName) => path.join(directoryPath, fileName));
}

function findMatchingRootExport(plan, options) {
  const explicitPath = options.sourceExportPath;
  if (explicitPath) {
    const payload = readJson(explicitPath);
    if (
      payload?.fileKey === plan?.source?.fileKey &&
      payload?.selection?.id === plan?.source?.selection?.id
    ) {
      return explicitPath;
    }
    throw new Error(`Explicit source export does not match plan source: ${explicitPath}`);
  }

  const candidates = listRawExportCandidates(options.outputDir);
  const matching = candidates
    .map((candidatePath) => ({
      candidatePath,
      payload: readJson(candidatePath),
    }))
    .filter(
      ({ payload }) =>
        payload?.fileKey === plan?.source?.fileKey &&
        payload?.selection?.id === plan?.source?.selection?.id
    )
    .sort((left, right) =>
      String(right.payload?.exportedAt ?? "").localeCompare(String(left.payload?.exportedAt ?? ""))
    );

  if (matching.length === 0) {
    throw new Error(
      `No raw root export matching ${plan?.source?.fileKey}:${plan?.source?.selection?.id} was found in ${options.outputDir}.`
    );
  }

  return matching[0]?.candidatePath ?? null;
}

function normalizeArtifactPayload(payload) {
  const clone = structuredClone(payload);
  delete clone.exportedAt;
  return clone;
}

function createPayloadDigest(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalizeArtifactPayload(payload)))
    .digest("hex");
}

function runSmokeValidation(runRoot) {
  const smokeOutputDir = path.join(runRoot, "smoke-output");
  const portBase = 4100 + (Date.now() % 1000);
  const result = spawnSync(
    process.execPath,
    [smokeScriptPath, "--output-dir", smokeOutputDir, "--port-base", String(portBase)],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
      },
    }
  );

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    command: `node ${path.relative(process.cwd(), smokeScriptPath)} --output-dir ${path.relative(process.cwd(), smokeOutputDir)} --port-base ${portBase}`,
  };
}

function collectFocusedArtifacts(batchResult) {
  return Object.fromEntries(
    batchResult.results
      .filter((entry) => entry?.result?.output?.jsonPath)
      .map((entry) => {
        const jsonPath = path.resolve(process.cwd(), entry.result.output.jsonPath);
        return [
          entry.family,
          {
            jsonPath,
            payload: readJson(jsonPath),
            source: entry.result.source,
            cacheHit: Boolean(entry.result.cache?.hit),
          },
        ];
      })
  );
}

function compareFocusedArtifacts(leftArtifacts, rightArtifacts, families) {
  const comparisons = families.map((family) => {
    const left = leftArtifacts[family];
    const right = rightArtifacts[family];
    if (!left || !right) {
      return {
        family,
        stable: false,
        reason: "missing-focused-artifact",
      };
    }
    const leftDigest = createPayloadDigest(left.payload);
    const rightDigest = createPayloadDigest(right.payload);
    return {
      family,
      stable: leftDigest === rightDigest,
      leftDigest,
      rightDigest,
    };
  });

  return {
    stable: comparisons.every((entry) => entry.stable),
    comparisons,
  };
}

function summarizeDevelopResult(family, developResult) {
  const outputs = developResult.outputs ?? {};
  const requiredArtifacts = {
    classifiedNodeGraph: Boolean(outputs.classifiedNodeGraph),
    primitiveTokens: Boolean(outputs.primitiveTokens),
    semanticTokens: Boolean(outputs.semanticTokens),
    componentSpecs: Boolean(outputs.componentSpecs),
    qaReport: Boolean(outputs.qaReport),
    codegenReport: Boolean(outputs.codegenReport),
  };

  const specs = requiredArtifacts.componentSpecs
    ? readJson(path.resolve(process.cwd(), outputs.componentSpecs))
    : null;
  const qa = requiredArtifacts.qaReport
    ? readJson(path.resolve(process.cwd(), outputs.qaReport))
    : null;
  const semantic = requiredArtifacts.semanticTokens
    ? readJson(path.resolve(process.cwd(), outputs.semanticTokens))
    : null;
  const variantModel =
    outputs.variantStateModel &&
    fs.existsSync(path.resolve(process.cwd(), outputs.variantStateModel))
      ? readJson(path.resolve(process.cwd(), outputs.variantStateModel))
      : null;
  const componentSpec = specs?.components?.[0] ?? null;
  const states = componentSpec?.states ?? {};

  return {
    family,
    ok: developResult.ok,
    exportScope: developResult.exportScope,
    artifacts: requiredArtifacts,
    qa: {
      status: qa?.summary?.status ?? null,
      score: qa?.summary?.score ?? null,
      blockers: qa?.summary?.blockers ?? 0,
      warnings: qa?.summary?.warnings ?? 0,
    },
    semantic: {
      coverage: semantic?.summary?.coverage ?? 0,
      mappedCount: semantic?.summary?.mappedCount ?? 0,
      unmappedCount: semantic?.summary?.unmappedCount ?? 0,
    },
    structure: {
      slotCount: Array.isArray(componentSpec?.slots) ? componentSpec.slots.length : 0,
      slots: Array.isArray(componentSpec?.slots)
        ? componentSpec.slots.map((slot) => slot.name)
        : [],
      persistentStateCount: Array.isArray(states?.persistent) ? states.persistent.length : 0,
      interactionStateCount: Array.isArray(states?.interaction) ? states.interaction.length : 0,
      variants: Array.isArray(componentSpec?.variants) ? componentSpec.variants.length : 0,
    },
    variantModel: {
      axisCount: Array.isArray(variantModel?.axes) ? variantModel.axes.length : 0,
      stateCount: Array.isArray(variantModel?.states) ? variantModel.states.length : 0,
    },
    outputs,
  };
}

async function runOfflineFocusBatch({
  planPath,
  families,
  sourceExportPath,
  outputDir,
  reportPath,
}) {
  const previousToken = process.env.FIGMA_ACCESS_TOKEN;
  delete process.env.FIGMA_ACCESS_TOKEN;

  try {
    return await runFocusBatch({
      planPath,
      explicitInputPath: null,
      families,
      limit: families.length,
      delayMs: 0,
      maxCacheAgeMinutes: null,
      outputDir,
      sourceExportPath,
      reportPath,
      tokenEnv: "FIGMA_ACCESS_TOKEN",
      registryPath: path.join(
        process.cwd(),
        "docs",
        "design-system",
        "figma-reference-registry.json"
      ),
      apiBaseUrl: "https://api.figma.com",
      refresh: false,
      help: false,
    });
  } finally {
    if (previousToken === undefined) {
      delete process.env.FIGMA_ACCESS_TOKEN;
    } else {
      process.env.FIGMA_ACCESS_TOKEN = previousToken;
    }
  }
}

async function runWorkflowGate(options) {
  const plan = readJson(options.planPath);
  const sourceExportPath = findMatchingRootExport(plan, options);
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const runRoot = path.join(options.validationRoot, timestamp);

  fs.mkdirSync(runRoot, { recursive: true });

  const smoke = runSmokeValidation(runRoot);

  const splitAOutputDir = path.join(runRoot, "split-a-artifacts");
  const splitBOutputDir = path.join(runRoot, "split-b-artifacts");
  const cacheOutputDir = path.join(runRoot, "cache-artifacts");

  const localSplitA = await runOfflineFocusBatch({
    planPath: options.planPath,
    families: options.families,
    sourceExportPath,
    outputDir: splitAOutputDir,
    reportPath: path.join(runRoot, "focus-batch-split-a.json"),
  });

  const localSplitB = await runOfflineFocusBatch({
    planPath: options.planPath,
    families: options.families,
    sourceExportPath,
    outputDir: splitBOutputDir,
    reportPath: path.join(runRoot, "focus-batch-split-b.json"),
  });

  const cacheSeed = await runOfflineFocusBatch({
    planPath: options.planPath,
    families: options.families,
    sourceExportPath,
    outputDir: cacheOutputDir,
    reportPath: path.join(runRoot, "focus-batch-cache-seed.json"),
  });

  const cacheRepeat = await runOfflineFocusBatch({
    planPath: options.planPath,
    families: options.families,
    sourceExportPath,
    outputDir: cacheOutputDir,
    reportPath: path.join(runRoot, "focus-batch-cache-repeat.json"),
  });

  const splitAArtifacts = collectFocusedArtifacts(localSplitA);
  const splitBArtifacts = collectFocusedArtifacts(localSplitB);
  const digestComparison = compareFocusedArtifacts(
    splitAArtifacts,
    splitBArtifacts,
    options.families
  );

  const develop = options.families.map((family) => {
    const artifact = splitAArtifacts[family];
    if (!artifact) {
      return {
        family,
        ok: false,
        artifacts: {},
        qa: { status: null, blockers: 1 },
        structure: { slotCount: 0, persistentStateCount: 0, interactionStateCount: 0 },
        semantic: { coverage: 0 },
        variantModel: { axisCount: 0, stateCount: 0 },
      };
    }

    return summarizeDevelopResult(family, developFromExport(artifact.jsonPath));
  });

  const gate = evaluateWorkflowGate({
    smoke,
    focusFetch: {
      localSplitA,
      localSplitB,
      cacheSeed,
      cacheRepeat,
      digestStable: digestComparison.stable,
      digestComparison,
    },
    develop,
  });

  const report = {
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    planPath: path.relative(process.cwd(), options.planPath),
    families: options.families,
    sourceExportPath: path.relative(process.cwd(), sourceExportPath),
    smoke,
    focusFetch: {
      localSplitA,
      localSplitB,
      cacheSeed,
      cacheRepeat,
      digestStable: digestComparison.stable,
      digestComparison: digestComparison.comparisons,
    },
    develop,
    gate,
    commands: [
      smoke.command,
      `env -u FIGMA_ACCESS_TOKEN node scripts/figma-pipeline/fetch-focus-batch.mjs --plan ${path.relative(process.cwd(), options.planPath)} --families ${options.families.join(",")} --delay-ms 0 --output-dir ${path.relative(process.cwd(), splitAOutputDir)} --source-export ${path.relative(process.cwd(), sourceExportPath)}`,
      `env -u FIGMA_ACCESS_TOKEN node scripts/figma-pipeline/fetch-focus-batch.mjs --plan ${path.relative(process.cwd(), options.planPath)} --families ${options.families.join(",")} --delay-ms 0 --output-dir ${path.relative(process.cwd(), splitBOutputDir)} --source-export ${path.relative(process.cwd(), sourceExportPath)}`,
      `env -u FIGMA_ACCESS_TOKEN node scripts/figma-pipeline/fetch-focus-batch.mjs --plan ${path.relative(process.cwd(), options.planPath)} --families ${options.families.join(",")} --delay-ms 0 --output-dir ${path.relative(process.cwd(), cacheOutputDir)} --source-export ${path.relative(process.cwd(), sourceExportPath)}`,
      ...develop
        .filter((entry) => entry?.outputs)
        .map(
          (entry) =>
            `node scripts/figma-pipeline/develop.mjs ${path.relative(process.cwd(), splitAArtifacts[entry.family].jsonPath)}`
        ),
    ],
  };

  const reportPath = path.join(runRoot, "workflow-gate-report.json");
  writeJson(reportPath, report);

  return {
    ok: gate.decision === "go",
    reportPath: path.relative(process.cwd(), reportPath),
    gate,
    report,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await runWorkflowGate(options);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: result.ok,
        reportPath: result.reportPath,
        decision: result.gate.decision,
        status: result.gate.status,
        blockers: result.gate.blockers,
        risks: result.gate.risks,
      },
      null,
      2
    )}\n`
  );

  if (!result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

export { runWorkflowGate };
