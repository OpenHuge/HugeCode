#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const supportedTargets = [
  {
    id: "win32/x64",
    readmePattern: /\|\s*Windows\s*\|\s*x64\s*\|\s*Supported desktop target\s*\|/u,
    releasePattern:
      /\|\s*Windows\s*\|\s*x64\s*\|\s*Packaged app, Squirrel `\.exe`, `\.nupkg`, and `RELEASES`\s*\|/u,
  },
  {
    id: "darwin/arm64",
    readmePattern:
      /\|\s*macOS\s*\|\s*arm64\s*\|\s*Supported Apple Silicon \/ M-series target\s*\|/u,
    releasePattern:
      /\|\s*macOS\s*\|\s*arm64\s*\|\s*Packaged app, `\.dmg`, and ZIP update artifact\s*\|/u,
  },
  {
    id: "darwin/x64",
    readmePattern: /\|\s*macOS\s*\|\s*x64\s*\|\s*Supported Intel target\s*\|/u,
    releasePattern:
      /\|\s*macOS\s*\|\s*x64\s*\|\s*Packaged app, `\.dmg`, and ZIP update artifact\s*\|/u,
  },
];

const requiredText = [
  {
    file: "README.md",
    snippets: [
      "Desktop product distribution targets are Windows and macOS:",
      "Windows ARM64 and Linux desktop distribution are not active product support targets unless a future ADR explicitly adds them.",
    ],
    patterns: supportedTargets.map((target) => target.readmePattern),
  },
  {
    file: "docs/workspace-map.md",
    snippets: [
      "The desktop product support matrix is Windows x64, macOS Apple Silicon",
      "(`darwin/arm64`), and macOS Intel (`darwin/x64`).",
      "distribution target policy, not permission to recreate retired app workspaces.",
    ],
  },
  {
    file: "docs/development/electron-updates.md",
    snippets: [
      "HugeCode desktop product distribution support is:",
      "Windows ARM64 and Linux desktop distribution are not active product support",
      "internal automation, are not a supported desktop product update channel.",
      "- macOS Apple Silicon and Intel: packaged app, `.dmg`, and ZIP update artifact",
      "- Windows x64: packaged app, Squirrel `.exe`, `.nupkg`, and `RELEASES`",
      "`pnpm check:desktop-product-support`",
    ],
    patterns: supportedTargets.map((target) => target.releasePattern),
  },
];

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readRepoJson(relativePath) {
  return JSON.parse(readRepoFile(relativePath));
}

const errors = [];

for (const check of requiredText) {
  const content = readRepoFile(check.file);
  for (const snippet of check.snippets) {
    if (!content.includes(snippet)) {
      errors.push(`${check.file}: missing desktop support contract text: ${snippet}`);
    }
  }
  for (const pattern of check.patterns ?? []) {
    if (!pattern.test(content)) {
      errors.push(`${check.file}: missing desktop support contract pattern: ${pattern}`);
    }
  }
}

const docsIndex = readRepoFile("docs/development/electron-updates.md");
if (/Windows\s+\|\s+arm64\s+\|/u.test(docsIndex)) {
  errors.push(
    "docs/development/electron-updates.md: Windows ARM64 must not be listed as supported."
  );
}
if (/Linux\s+\|\s+(?:x64|arm64)\s+\|/u.test(docsIndex)) {
  errors.push(
    "docs/development/electron-updates.md: Linux must not be listed in the supported desktop product table."
  );
}

const rootPackageJson = readRepoJson("package.json");
const rootScripts = rootPackageJson.scripts ?? {};
const requiredRootScripts = {
  "check:desktop-product-support": "node scripts/check-desktop-product-support.mjs",
  "dev:desktop": "pnpm --filter @ku0/code-t3 run desktop:dev",
  "desktop:dev": "pnpm dev:desktop",
  "desktop:build": "pnpm code-t3:desktop:build",
  "desktop:preview": "pnpm code-t3:desktop:preview",
  "code-t3:desktop:build": "pnpm --filter @ku0/code-t3 run desktop:build",
  "code-t3:desktop:preview": "pnpm --filter @ku0/code-t3 run desktop:preview",
};

for (const [scriptName, expectedCommand] of Object.entries(requiredRootScripts)) {
  if (rootScripts[scriptName] !== expectedCommand) {
    errors.push(`package.json: script ${scriptName} must be "${expectedCommand}".`);
  }
}

for (const scriptName of ["preflight:codex", "preflight:codex:ci"]) {
  if (!String(rootScripts[scriptName] ?? "").includes("pnpm check:desktop-product-support")) {
    errors.push(`package.json: ${scriptName} must run pnpm check:desktop-product-support.`);
  }
}

const codeT3PackageJson = readRepoJson("apps/code-t3/package.json");
const codeT3Scripts = codeT3PackageJson.scripts ?? {};
const codeT3DevDependencies = codeT3PackageJson.devDependencies ?? {};
const requiredCodeT3Scripts = {
  "desktop:dev": "node scripts/start-electron-dev.mjs",
  "desktop:build": "pnpm run build && node scripts/build-electron.mjs",
  "desktop:preview": "pnpm run desktop:build && electron dist-electron/main.cjs",
};

if (codeT3PackageJson.main !== "dist-electron/main.cjs") {
  errors.push('apps/code-t3/package.json: main must be "dist-electron/main.cjs".');
}

for (const [scriptName, expectedCommand] of Object.entries(requiredCodeT3Scripts)) {
  if (codeT3Scripts[scriptName] !== expectedCommand) {
    errors.push(`apps/code-t3/package.json: script ${scriptName} must be "${expectedCommand}".`);
  }
}

for (const dependencyName of ["electron", "esbuild"]) {
  if (typeof codeT3DevDependencies[dependencyName] !== "string") {
    errors.push(`apps/code-t3/package.json: devDependency ${dependencyName} is required.`);
  }
}

const codeT3Tsconfig = readRepoJson("apps/code-t3/tsconfig.json");
if (!Array.isArray(codeT3Tsconfig.include) || !codeT3Tsconfig.include.includes("electron")) {
  errors.push('apps/code-t3/tsconfig.json: include must contain "electron".');
}

for (const relativePath of [
  "apps/code-t3/electron/main.ts",
  "apps/code-t3/electron/preload.ts",
  "apps/code-t3/scripts/build-electron.mjs",
  "apps/code-t3/scripts/start-electron-dev.mjs",
]) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    errors.push(`${relativePath}: required desktop implementation file is missing.`);
  }
}

if (errors.length > 0) {
  process.stderr.write(`Desktop product support check failed.\n${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Desktop product support check passed: ${supportedTargets.map((target) => target.id).join(", ")}.\n`
);
