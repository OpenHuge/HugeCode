#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { collectStyleMetrics } from "./lib/style-metrics.mjs";

const DEFAULT_BASELINE_PATH = ".codex/style-metrics-baseline.json";

const PROFILE_POLICIES = {
  strict: {
    toleranceScale: 1,
    adaptiveScale: 1,
    includeRawMetrics: true,
  },
  release: {
    toleranceScale: 2,
    adaptiveScale: 1.25,
    includeRawMetrics: true,
  },
};

const REGRESSION_TOLERANCE_RULES = {
  styleTotalLinesAll: { absolute: 160, percent: 0.5 },
  styleTotalLines: { absolute: 120, percent: 0.5 },
  globalStyleCountAll: { absolute: 8, percent: 1.5 },
  globalStyleCount: { absolute: 6, percent: 1.5 },
};

const ADAPTIVE_LINE_GROWTH_RULES = {
  styleTotalLinesAll: {
    styleFileMetric: "styleFileCountAll",
    baselineStyleLineMetric: "styleTotalLinesAll",
    baselineStyleFileMetric: "styleFileCountAll",
    perStyleFileMinimum: 140,
    perStyleFileAverageRatio: 0.75,
    baselineLocalLineMetric: "styleTotalLinesAll",
    baselineLocalModuleMetric: "localStyleModuleCount",
    perLocalStyleModuleMinimum: 70,
    perLocalStyleModuleAverageRatio: 0.59,
  },
  styleTotalLines: {
    styleFileMetric: "styleFileCount",
    baselineStyleLineMetric: "styleTotalLines",
    baselineStyleFileMetric: "styleFileCount",
    perStyleFileMinimum: 110,
    perStyleFileAverageRatio: 0.45,
    baselineLocalLineMetric: "styleTotalLines",
    baselineLocalModuleMetric: "localStyleModuleCount",
    perLocalStyleModuleMinimum: 55,
    perLocalStyleModuleAverageRatio: 0.25,
  },
};

const METRIC_RULE_KEY_ALIASES = {
  duplicateSelectorCountAllRaw: "duplicateSelectorCountAll",
  globalStyleCountAllRaw: "globalStyleCountAll",
  styleTotalLinesAllRaw: "styleTotalLinesAll",
};

const VALID_BUDGET_PROFILES = new Set(["regression", ...Object.keys(PROFILE_POLICIES)]);

function ensureKnownProfile(profile, source) {
  if (VALID_BUDGET_PROFILES.has(profile)) {
    return;
  }
  throw new Error(
    `Unknown ${source} "${profile}". Expected one of: ${[...VALID_BUDGET_PROFILES].join(", ")}.`
  );
}

function readEnvProfile() {
  const envProfile = process.env.STYLE_BUDGET_PROFILE?.trim();
  if (!envProfile) {
    return null;
  }
  ensureKnownProfile(envProfile, "STYLE_BUDGET_PROFILE");
  return envProfile;
}

function parseArgs(argv) {
  const args = {
    profile: "regression",
    baselinePath: DEFAULT_BASELINE_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--strict":
        args.profile = "strict";
        break;
      case "--profile": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("Missing value for --profile.");
        }
        ensureKnownProfile(next, "profile");
        args.profile = next;
        index += 1;
        break;
      }
      case "--baseline": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("Missing value for --baseline.");
        }
        args.baselinePath = next;
        index += 1;
        break;
      }
      default:
        break;
    }
  }

  const envProfile = readEnvProfile();
  if (envProfile) {
    args.profile = envProfile;
  } else if (
    process.env.STYLE_BUDGET_STRICT === "1" ||
    process.env.STYLE_BUDGET_STRICT === "true"
  ) {
    // Backward compatibility for existing strict-mode callers.
    args.profile = "strict";
  }
  return args;
}

function resolveOversizedCount(metrics) {
  if (!metrics || !Array.isArray(metrics.oversizedStyleFiles)) {
    return 0;
  }
  return metrics.oversizedStyleFiles.length;
}

function resolveOversizedAllCount(metrics) {
  if (!metrics) {
    return 0;
  }
  if (Array.isArray(metrics.oversizedCssTsFilesAll)) {
    return metrics.oversizedCssTsFilesAll.length;
  }
  if (Array.isArray(metrics.oversizedStyleFilesAll)) {
    return metrics.oversizedStyleFilesAll.length;
  }
  return Number(metrics.oversizedCssTsFilesAllCount ?? metrics.oversizedStyleFilesAllCount ?? 0);
}

function resolveOversizedRawCount(metrics) {
  if (Array.isArray(metrics.oversizedCssTsFilesAllRaw)) {
    return metrics.oversizedCssTsFilesAllRaw.length;
  }
  if (Array.isArray(metrics.oversizedStyleFilesAllRaw)) {
    return metrics.oversizedStyleFilesAllRaw.length;
  }
  return Number(
    metrics.oversizedCssTsFilesAllRawCount ?? metrics.oversizedStyleFilesAllRawCount ?? 0
  );
}

function normalizeOversizedEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.filePath === "string" &&
        Number.isFinite(Number(entry.lines))
    )
    .map((entry) => ({
      filePath: String(entry.filePath),
      lines: Number(entry.lines),
    }))
    .sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function resolveOversizedEntries(metrics, keys) {
  for (const key of keys) {
    const entries = normalizeOversizedEntries(metrics?.[key]);
    if (entries.length > 0) {
      return entries;
    }
  }
  return [];
}

function summarizeOversizedEntry(entry) {
  return `${entry.filePath} (${entry.lines} lines)`;
}

function buildOversizedEntryFailures(metricLabel, currentEntries, baselineEntries) {
  if (baselineEntries.length === 0) {
    return [];
  }

  const failures = [];
  const baselineByPath = new Map(baselineEntries.map((entry) => [entry.filePath, entry.lines]));

  for (const entry of currentEntries) {
    const baselineLines = baselineByPath.get(entry.filePath);
    if (baselineLines === undefined) {
      failures.push(
        `${metricLabel} introduced: ${summarizeOversizedEntry(entry)} is not in the baseline allowlist`
      );
      continue;
    }
    if (entry.lines > baselineLines) {
      failures.push(
        `${metricLabel} grew: ${entry.filePath} ${entry.lines} > baseline ${baselineLines}`
      );
    }
  }

  return failures;
}

function readBaseline(baselinePath) {
  const absolutePath = path.resolve(process.cwd(), baselinePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...parsed,
    oversizedStyleFilesCount: resolveOversizedCount(parsed),
    oversizedCssTsFilesAllCount: resolveOversizedAllCount(parsed),
    oversizedStyleFilesAllCount: resolveOversizedAllCount(parsed),
  };
}

export function resolveRegressionTolerance(metricKey, baselineValue) {
  const canonicalMetricKey = METRIC_RULE_KEY_ALIASES[metricKey] ?? metricKey;
  const rule = REGRESSION_TOLERANCE_RULES[canonicalMetricKey];
  if (!rule || !Number.isFinite(baselineValue) || baselineValue <= 0) {
    return 0;
  }
  return Math.max(rule.absolute, Math.ceil(baselineValue * (rule.percent / 100)));
}

function resolveAdaptiveAverageAllowance(baseline, lineMetricKey, countMetricKey, ratio, minimum) {
  if (!baseline) {
    return 0;
  }
  const lineBaseline = Number(baseline[lineMetricKey] ?? 0);
  const countBaseline = Number(baseline[countMetricKey] ?? 0);
  if (!Number.isFinite(lineBaseline) || !Number.isFinite(countBaseline) || countBaseline <= 0) {
    return minimum;
  }
  return Math.max(minimum, Math.ceil((lineBaseline / countBaseline) * ratio));
}

export function resolveAdaptiveLineGrowthAllowance(
  metricKey,
  metrics,
  baseline,
  adaptiveScale = 1
) {
  const canonicalMetricKey = METRIC_RULE_KEY_ALIASES[metricKey] ?? metricKey;
  const rule = ADAPTIVE_LINE_GROWTH_RULES[canonicalMetricKey];
  if (!rule || !baseline || !metrics) {
    return 0;
  }

  const styleFileDelta = Math.max(
    0,
    Number(metrics[rule.styleFileMetric] ?? 0) - Number(baseline[rule.styleFileMetric] ?? 0)
  );
  const localStyleModuleDelta = Math.max(
    0,
    Number(metrics.localStyleModuleCount ?? 0) - Number(baseline.localStyleModuleCount ?? 0)
  );

  const perStyleFileAllowance = resolveAdaptiveAverageAllowance(
    baseline,
    rule.baselineStyleLineMetric,
    rule.baselineStyleFileMetric,
    rule.perStyleFileAverageRatio,
    rule.perStyleFileMinimum
  );
  const perLocalStyleModuleAllowance = resolveAdaptiveAverageAllowance(
    baseline,
    rule.baselineLocalLineMetric,
    rule.baselineLocalModuleMetric,
    rule.perLocalStyleModuleAverageRatio,
    rule.perLocalStyleModuleMinimum
  );

  return Math.ceil(
    (styleFileDelta * perStyleFileAllowance +
      localStyleModuleDelta * perLocalStyleModuleAllowance) *
      adaptiveScale
  );
}

export function buildProfileRuleFailures(metrics, baseline, policy) {
  if (!baseline) {
    return ["style budget baseline is required for baseline-derived profile checks"];
  }
  const failures = [];
  const increasedChecks = [
    ["globalStyleCountAll", metrics.globalStyleCountAll],
    ["styleTotalLinesAll", metrics.styleTotalLinesAll],
    ["globalStyleCount", metrics.globalStyleCount],
    ["styleTotalLines", metrics.styleTotalLines],
    ["bridgeStyleFileCount", metrics.bridgeStyleFileCount],
    ["buttonWithoutTypeCount", metrics.buttonWithoutTypeCount],
    ["duplicateSelectorCountAll", metrics.duplicateSelectorCountAll],
    ["duplicateSelectorCount", metrics.duplicateSelectorCount],
  ];

  if (policy.includeRawMetrics) {
    increasedChecks.push(
      ["globalStyleCountAllRaw", metrics.globalStyleCountAllRaw],
      ["styleTotalLinesAllRaw", metrics.styleTotalLinesAllRaw],
      ["duplicateSelectorCountAllRaw", metrics.duplicateSelectorCountAllRaw]
    );
  }

  for (const [key, value] of increasedChecks) {
    const baselineValue = Number(baseline[key] ?? value);
    const regressionTolerance = Math.ceil(
      resolveRegressionTolerance(key, baselineValue) * policy.toleranceScale
    );
    const adaptiveAllowance = resolveAdaptiveLineGrowthAllowance(
      key,
      metrics,
      baseline,
      policy.adaptiveScale
    );
    const tolerance = regressionTolerance + adaptiveAllowance;
    const maxAllowed = baselineValue + tolerance;
    if (value > maxAllowed) {
      failures.push(
        tolerance > 0
          ? `${key} exceeds derived ${maxAllowed} (baseline ${baselineValue}, +${regressionTolerance} profile headroom${adaptiveAllowance > 0 ? `, +${adaptiveAllowance} adaptive allowance` : ""})`
          : `${key} exceeds baseline ${baselineValue}`
      );
    }
  }

  const baselineLocalStyleModuleCount = Number(
    baseline.localStyleModuleCount ?? metrics.localStyleModuleCount
  );
  if (metrics.localStyleModuleCount < baselineLocalStyleModuleCount) {
    failures.push(
      `localStyleModuleCount regressed: ${metrics.localStyleModuleCount} < baseline ${baselineLocalStyleModuleCount}`
    );
  }

  const oversizedEntries = resolveOversizedEntries(metrics, ["oversizedStyleFiles"]);
  const baselineOversizedEntries = resolveOversizedEntries(baseline, ["oversizedStyleFiles"]);
  const oversizedCount = oversizedEntries.length;
  const baselineOversizedCount = Number(baseline.oversizedStyleFilesCount ?? 0);
  if (oversizedCount > baselineOversizedCount) {
    failures.push(
      `oversizedStyleFiles regressed: ${oversizedCount} > baseline ${baselineOversizedCount}`
    );
  }
  failures.push(
    ...buildOversizedEntryFailures(
      "oversizedStyleFiles",
      oversizedEntries,
      baselineOversizedEntries
    )
  );

  const oversizedAllEntries = resolveOversizedEntries(metrics, [
    "oversizedCssTsFilesAll",
    "oversizedStyleFilesAll",
  ]);
  const baselineOversizedAllEntries = resolveOversizedEntries(baseline, [
    "oversizedCssTsFilesAll",
    "oversizedStyleFilesAll",
  ]);
  const oversizedAllCount = oversizedAllEntries.length;
  const baselineOversizedAllCount = Number(
    baseline.oversizedCssTsFilesAllCount ?? baseline.oversizedStyleFilesAllCount ?? 0
  );
  if (oversizedAllCount > baselineOversizedAllCount) {
    failures.push(
      `oversizedCssTsFilesAll regressed: ${oversizedAllCount} > baseline ${baselineOversizedAllCount}`
    );
  }
  failures.push(
    ...buildOversizedEntryFailures(
      "oversizedCssTsFilesAll",
      oversizedAllEntries,
      baselineOversizedAllEntries
    )
  );

  if (policy.includeRawMetrics) {
    const oversizedRawEntries = resolveOversizedEntries(metrics, [
      "oversizedCssTsFilesAllRaw",
      "oversizedStyleFilesAllRaw",
    ]);
    const baselineOversizedRawEntries = resolveOversizedEntries(baseline, [
      "oversizedCssTsFilesAllRaw",
      "oversizedStyleFilesAllRaw",
    ]);
    const oversizedRawCount = oversizedRawEntries.length;
    const baselineOversizedRawCount = resolveOversizedRawCount(baseline);
    if (oversizedRawCount > baselineOversizedRawCount) {
      failures.push(
        `oversizedCssTsFilesAllRaw regressed: ${oversizedRawCount} > baseline ${baselineOversizedRawCount}`
      );
    }
    failures.push(
      ...buildOversizedEntryFailures(
        "oversizedCssTsFilesAllRaw",
        oversizedRawEntries,
        baselineOversizedRawEntries
      )
    );
  }

  return failures;
}

export function buildRegressionFailures(metrics, baseline) {
  if (!baseline) {
    return [];
  }
  const failures = [];
  const baselineOversizedCount = Number(baseline.oversizedStyleFilesCount ?? 0);
  const baselineOversizedAllCount = Number(
    baseline.oversizedCssTsFilesAllCount ?? baseline.oversizedStyleFilesAllCount ?? 0
  );
  const increasedRegressionChecks = [
    ["globalStyleCountAll", metrics.globalStyleCountAll],
    ["styleTotalLinesAll", metrics.styleTotalLinesAll],
    ["globalStyleCount", metrics.globalStyleCount],
    ["styleTotalLines", metrics.styleTotalLines],
    ["bridgeStyleFileCount", metrics.bridgeStyleFileCount],
    ["buttonWithoutTypeCount", metrics.buttonWithoutTypeCount],
    ["duplicateSelectorCountAll", metrics.duplicateSelectorCountAll],
    ["duplicateSelectorCount", metrics.duplicateSelectorCount],
  ];
  for (const [key, value] of increasedRegressionChecks) {
    const baselineValue = Number(baseline[key] ?? value);
    const regressionTolerance = resolveRegressionTolerance(key, baselineValue);
    const adaptiveAllowance = resolveAdaptiveLineGrowthAllowance(key, metrics, baseline);
    const tolerance = regressionTolerance + adaptiveAllowance;
    const maxAllowed = baselineValue + tolerance;
    if (value > maxAllowed) {
      failures.push(
        tolerance > 0
          ? `${key} regressed: ${value} > baseline ${baselineValue} (+${regressionTolerance} base tolerance${adaptiveAllowance > 0 ? `, +${adaptiveAllowance} adaptive allowance` : ""} => ${maxAllowed})`
          : `${key} regressed: ${value} > baseline ${baselineValue}`
      );
    }
  }

  const baselineLocalStyleModuleCount = Number(
    baseline.localStyleModuleCount ?? metrics.localStyleModuleCount
  );
  if (metrics.localStyleModuleCount < baselineLocalStyleModuleCount) {
    failures.push(
      `localStyleModuleCount regressed: ${metrics.localStyleModuleCount} < baseline ${baselineLocalStyleModuleCount}`
    );
  }

  const oversizedEntries = resolveOversizedEntries(metrics, ["oversizedStyleFiles"]);
  const baselineOversizedEntries = resolveOversizedEntries(baseline, ["oversizedStyleFiles"]);
  const oversizedCount = oversizedEntries.length;
  if (oversizedCount > baselineOversizedCount) {
    failures.push(
      `oversizedStyleFiles regressed: ${oversizedCount} > baseline ${baselineOversizedCount}`
    );
  }
  failures.push(
    ...buildOversizedEntryFailures(
      "oversizedStyleFiles",
      oversizedEntries,
      baselineOversizedEntries
    )
  );

  const oversizedAllEntries = resolveOversizedEntries(metrics, [
    "oversizedCssTsFilesAll",
    "oversizedStyleFilesAll",
  ]);
  const baselineOversizedAllEntries = resolveOversizedEntries(baseline, [
    "oversizedCssTsFilesAll",
    "oversizedStyleFilesAll",
  ]);
  const oversizedAllCount = oversizedAllEntries.length;
  if (oversizedAllCount > baselineOversizedAllCount) {
    failures.push(
      `oversizedCssTsFilesAll regressed: ${oversizedAllCount} > baseline ${baselineOversizedAllCount}`
    );
  }
  failures.push(
    ...buildOversizedEntryFailures(
      "oversizedCssTsFilesAll",
      oversizedAllEntries,
      baselineOversizedAllEntries
    )
  );

  return failures;
}

function printSummary(metrics, baseline, profile) {
  const baselineMode = baseline ? `baseline=${profile}` : `baseline=none profile=${profile}`;
  const oversizedAllCount = resolveOversizedAllCount(metrics);
  const duplicateSelectorCountAll = Number(metrics.duplicateSelectorCountAll ?? 0);

  process.stdout.write(
    `${[
      `Style metrics summary (${baselineMode})`,
      `  styleTotalLinesAll=${metrics.styleTotalLinesAll}`,
      `  styleTotalLines=${metrics.styleTotalLines}`,
      `  globalStyleCountAll=${metrics.globalStyleCountAll}`,
      `  localStyleModuleCount=${metrics.localStyleModuleCount}`,
      `  oversizedCssTsFilesAll=${oversizedAllCount}`,
      `  duplicateSelectorCountAll=${duplicateSelectorCountAll}`,
    ].join("\n")}\n`
  );
}

function printFailures(failures) {
  for (const failure of failures) {
    process.stderr.write(`Style budget failure: ${failure}\n`);
  }
}

function isDirectExecution() {
  const entryArg = process.argv[1];
  if (!entryArg) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(entryArg)).href;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const metrics = collectStyleMetrics();
  const baseline = readBaseline(args.baselinePath);
  const profilePolicy = PROFILE_POLICIES[args.profile];
  const profileFailures = profilePolicy
    ? buildProfileRuleFailures(metrics, baseline, profilePolicy)
    : [];
  const regressionFailures =
    args.profile === "regression" ? buildRegressionFailures(metrics, baseline) : [];
  const failures = [...profileFailures, ...regressionFailures];

  if (failures.length === 0) {
    printSummary(metrics, baseline, args.profile);
    return;
  }

  printFailures(failures);
  process.exit(1);
}

if (isDirectExecution()) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Style budget guard error: ${message}\n`);

    process.exit(1);
  }
}
