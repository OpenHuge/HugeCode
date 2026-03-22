#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const UX_AUDIT_DIR = path.resolve(process.cwd(), ".codex/ux-audit");
const UX_SCHEMA_PATH = path.join(UX_AUDIT_DIR, "schema.json");

function fail(message) {
  process.exit(1);
}

function listReports(prefix) {
  if (!fs.existsSync(UX_AUDIT_DIR)) {
    return [];
  }
  return fs
    .readdirSync(UX_AUDIT_DIR)
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".json"))
    .map((entry) => {
      const absolutePath = path.join(UX_AUDIT_DIR, entry);
      const stat = fs.statSync(absolutePath);
      return {
        fileName: entry,
        absolutePath,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort(
      (left, right) => right.mtimeMs - left.mtimeMs || right.fileName.localeCompare(left.fileName)
    );
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
}

function requireKeys(objectValue, keys, label) {
  for (const key of keys) {
    if (!(key in objectValue)) {
      fail(`${label} is missing required key "${key}".`);
    }
  }
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCoreReport(coreReport, schema) {
  assertObject(schema, "schema.json");
  assertObject(coreReport, "core report");

  const requiredFromSchema = Array.isArray(schema.required) ? schema.required : [];
  requireKeys(coreReport, requiredFromSchema, "core report");

  assertObject(coreReport.summary, "core.summary");
  requireKeys(coreReport.summary, ["totalDefects", "p0", "p1", "p2"], "core.summary");

  if (coreReport.summary.p0 !== 0) {
    fail(`summary.p0 must be 0 for release (received ${coreReport.summary.p0}).`);
  }
  if (coreReport.summary.p1 !== 0) {
    fail(`summary.p1 must be 0 for release (received ${coreReport.summary.p1}).`);
  }

  if (!Array.isArray(coreReport.pages) || coreReport.pages.length === 0) {
    fail("core.pages must be a non-empty array.");
  }

  const scoreKeys = [
    "visualAlignment",
    "interactionIntuition",
    "accessibility",
    "stateFeedback",
    "performanceFeeling",
  ];

  for (const page of coreReport.pages) {
    assertObject(page, "core.pages[]");
    requireKeys(page, ["id", "viewport", "scores", "defects", "screenshots"], "core.pages[]");
    assertObject(page.scores, `core.pages[${page.id}].scores`);
    requireKeys(page.scores, [...scoreKeys, "total"], `core.pages[${page.id}].scores`);

    const totalScore = Number(page.scores.total);
    if (!isFiniteNumber(totalScore) || totalScore < 4.5) {
      fail(`core.pages[${page.id}] total score must be >= 4.5 (received ${page.scores.total}).`);
    }

    for (const key of scoreKeys) {
      const value = Number(page.scores[key]);
      if (!isFiniteNumber(value) || value < 4.0) {
        fail(`core.pages[${page.id}] ${key} must be >= 4.0 (received ${page.scores[key]}).`);
      }
    }
  }

  assertObject(coreReport.slo, "core.slo");
  if (!Array.isArray(coreReport.slo.violations)) {
    fail("core.slo.violations must be an array.");
  }
  if (coreReport.slo.violations.length > 0) {
    fail(`sloViolations must be empty (received ${coreReport.slo.violations.length}).`);
  }
}

function validatePerfReport(perfReport) {
  assertObject(perfReport, "perf report");
  requireKeys(perfReport, ["generatedAt", "actions", "violations"], "perf report");

  if (!Array.isArray(perfReport.violations)) {
    fail("perf.violations must be an array.");
  }
  if (perfReport.violations.length > 0) {
    fail(`perf violations must be empty (received ${perfReport.violations.length}).`);
  }
}

function main() {
  if (!fs.existsSync(UX_SCHEMA_PATH)) {
    fail(`schema file not found at ${path.relative(process.cwd(), UX_SCHEMA_PATH)}.`);
  }

  const coreReports = listReports("core-");
  const perfReports = listReports("perf-");

  if (coreReports.length === 0) {
    fail("no core-*.json report found in .codex/ux-audit.");
  }
  if (perfReports.length === 0) {
    fail("no perf-*.json report found in .codex/ux-audit.");
  }

  const latestCore = coreReports[0];
  const latestPerf = perfReports[0];
  if (!latestCore || !latestPerf) {
    fail("unable to resolve latest report files.");
  }

  const schema = readJson(UX_SCHEMA_PATH);
  const coreReport = readJson(latestCore.absolutePath);
  const perfReport = readJson(latestPerf.absolutePath);

  validateCoreReport(coreReport, schema);
  validatePerfReport(perfReport);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}
