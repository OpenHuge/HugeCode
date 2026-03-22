#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { DESIGN_SYSTEM_OPERATOR_ADJUNCT_FIXTURES } from "./lib/design-system-operator-adjunct-fixture-config.mjs";

function parseRootArg(argv) {
  const rootFlagIndex = argv.indexOf("--root");
  if (rootFlagIndex === -1) {
    return process.cwd();
  }

  const candidate = argv[rootFlagIndex + 1];
  if (!candidate) {
    throw new Error("Missing value for --root.");
  }

  return path.resolve(candidate);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function readRequiredFile(absolutePath, label) {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} is missing at ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function fixtureHostRegistersFixture(fixtureAppSourceText, fixtureName) {
  const fixturePattern = new RegExp(`fixtureName\\s*===\\s*"${escapeRegExp(fixtureName)}"`, "u");
  return fixturePattern.test(fixtureAppSourceText);
}

function smokeSpecCoversFixture(smokeSpecSourceText, fixtureName) {
  const literalFixtureUrlPattern = new RegExp(
    `/fixtures\\.html\\?fixture=${escapeRegExp(fixtureName)}`,
    "u"
  );
  const helperFixtureIdPattern = new RegExp(
    `fixtureId\\s*:\\s*"${escapeRegExp(fixtureName)}"`,
    "u"
  );
  return (
    literalFixtureUrlPattern.test(smokeSpecSourceText) ||
    helperFixtureIdPattern.test(smokeSpecSourceText)
  );
}

function main() {
  const repoRoot = parseRootArg(process.argv.slice(2));
  const fixtureAppPath = path.join(repoRoot, "apps", "code", "src", "fixtures", "FixtureApp.tsx");
  const fixtureSmokeSpecPath = path.join(
    repoRoot,
    "tests",
    "e2e",
    "src",
    "code",
    "design-system-fixture-smoke.spec.ts"
  );

  const fixtureAppSourceText = readRequiredFile(fixtureAppPath, "Fixture host");
  const fixtureSmokeSpecSourceText = readRequiredFile(
    fixtureSmokeSpecPath,
    "Design-system fixture smoke spec"
  );
  const failures = [];

  for (const fixture of DESIGN_SYSTEM_OPERATOR_ADJUNCT_FIXTURES) {
    if (!fixtureHostRegistersFixture(fixtureAppSourceText, fixture.fixtureId)) {
      failures.push(
        `${fixture.fixtureId}: missing fixture host registration in apps/code/src/fixtures/FixtureApp.tsx.`
      );
    }

    if (!smokeSpecCoversFixture(fixtureSmokeSpecSourceText, fixture.fixtureId)) {
      failures.push(
        `${fixture.fixtureId}: missing smoke coverage in tests/e2e/src/code/design-system-fixture-smoke.spec.ts.`
      );
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design-system operator adjunct fixture coverage check failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Design-system operator adjunct fixture coverage check passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
