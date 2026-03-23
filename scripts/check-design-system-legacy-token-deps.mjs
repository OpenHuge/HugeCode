#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const themeSemanticsPath = path.join(rootDir, "packages/design-system/src/themeSemantics.ts");
const forbiddenPatterns = [/--surface-/u, /--text-/u, /--border-/u, /--brand-/u];

if (!fs.existsSync(themeSemanticsPath)) {
  process.stderr.write(`Missing design-system semantics file: ${themeSemanticsPath}\n`);
  process.exit(1);
}

const source = fs.readFileSync(themeSemanticsPath, "utf8");
const matchedPatterns = forbiddenPatterns.filter((pattern) => pattern.test(source));

if (matchedPatterns.length > 0) {
  process.stderr.write(
    "Design-system legacy token dependency guard failed: themeSemantics must not reference legacy alias families.\n"
  );
  process.exit(1);
}

process.stdout.write("Design-system legacy token dependency guard passed.\n");
