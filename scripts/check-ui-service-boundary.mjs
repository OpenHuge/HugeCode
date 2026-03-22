#!/usr/bin/env node

import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";
import {
  collectUiBoundaryCandidates,
  collectUiBoundaryViolations,
} from "./lib/ui-service-boundary.mjs";

const repoRoot = process.cwd();
const json = process.argv.includes("--json");

function main() {
  const candidates = collectUiBoundaryCandidates(repoRoot);
  if (candidates.length === 0) {
    if (json) {
      writeCheckJson({
        check: "ui-service-boundary",
        ok: true,
        details: { filesChecked: 0, violations: [] },
      });
    }
    return;
  }

  const violations = collectUiBoundaryViolations(repoRoot, candidates);
  if (violations.length === 0) {
    if (json) {
      writeCheckJson({
        check: "ui-service-boundary",
        ok: true,
        details: { filesChecked: candidates.length, violations: [] },
      });
    }
    return;
  }

  if (json) {
    writeCheckJson({
      check: "ui-service-boundary",
      ok: false,
      errors: violations.map(
        (violation) =>
          `${violation.filePath}:${violation.line} ${violation.ruleDescription} -> ${violation.snippet}`
      ),
      details: {
        filesChecked: candidates.length,
        violations,
      },
    });
    process.exit(1);
  }

  writeLines(
    process.stderr,
    violations.map((violation) =>
      renderCheckMessage(
        "ui-service-boundary",
        `${violation.filePath}:${violation.line} ${violation.ruleDescription} -> ${violation.snippet}`
      )
    )
  );
  process.exit(1);
}

main();
