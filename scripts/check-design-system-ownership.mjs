#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const duplicateFamilyBaseline = new Set([
  "Avatar",
  "Badge",
  "Button",
  "Card",
  "Dialog",
  "Input",
  "Panel",
  "Popover",
  "Select",
  "Tabs",
  "Textarea",
  "Toast",
  "Tooltip",
]);

const allowedAppComponentFiles = new Set([
  "apps/code/src/design-system/components/Icon.tsx",
  "apps/code/src/design-system/components/IconButton.tsx",
  "apps/code/src/design-system/components/ModalCardPresets.css.ts",
  "apps/code/src/design-system/components/ModalShell.tsx",
  "apps/code/src/design-system/components/ModalShell.test.tsx",
  "apps/code/src/design-system/components/execution/ActivityLogRow.tsx",
  "apps/code/src/design-system/components/execution/DiffReviewPanel.tsx",
  "apps/code/src/design-system/components/execution/ExecutionPrimitives.css.ts",
  "apps/code/src/design-system/components/execution/ExecutionPrimitives.test.tsx",
  "apps/code/src/design-system/components/execution/executionStatus.ts",
  "apps/code/src/design-system/components/execution/ExecutionStatusPill.tsx",
  "apps/code/src/design-system/components/execution/ToolCallChip.tsx",
  "apps/code/src/design-system/components/modal/ModalPrimitives.tsx",
  "apps/code/src/design-system/components/modal/ModalPrimitives.test.tsx",
  "apps/code/src/design-system/components/panel/PanelPrimitives.tsx",
  "apps/code/src/design-system/components/panel/PanelPrimitives.test.tsx",
  "apps/code/src/design-system/components/popover/PopoverPrimitives.tsx",
  "apps/code/src/design-system/components/popover/PopoverPrimitives.test.tsx",
  "apps/code/src/design-system/components/shell/ShellPrimitives.tsx",
  "apps/code/src/design-system/components/shell/ShellPrimitives.test.tsx",
  "apps/code/src/design-system/components/textarea/TextareaPrimitives.tsx",
  "apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx",
  "apps/code/src/design-system/components/toast/ToastPrimitives.tsx",
  "apps/code/src/design-system/components/toast/ToastPrimitives.test.tsx",
]);

const allowedAppAdapterFiles = new Set([
  "apps/code/src/design-system/adapters/Button/Button.tsx",
  "apps/code/src/design-system/adapters/Button/index.ts",
  "apps/code/src/design-system/adapters/Input/Input.tsx",
  "apps/code/src/design-system/adapters/Input/index.ts",
  "apps/code/src/design-system/adapters/index.test.ts",
  "apps/code/src/design-system/adapters/index.ts",
]);

const allowedAppRootFiles = new Set([
  "apps/code/src/design-system/index.project-coverage.test.tsx",
  "apps/code/src/design-system/index.ts",
]);

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function collectFiles(rootDir) {
  const absoluteRoot = path.join(repoRoot, rootDir);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const results = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      results.push(toPosixPath(path.relative(repoRoot, absolutePath)));
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function collectComponentFamilies(rootDir) {
  const families = new Set();
  for (const filePath of collectFiles(rootDir)) {
    const extension = path.posix.extname(filePath);
    if (![".ts", ".tsx"].includes(extension)) {
      continue;
    }
    if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
      continue;
    }
    if (filePath.endsWith(".stories.tsx")) {
      continue;
    }
    const baseName = path.posix.basename(filePath, extension);
    if (baseName.endsWith(".css")) {
      continue;
    }
    families.add(baseName);
  }
  return families;
}

function intersect(left, right) {
  return [...left].filter((entry) => right.has(entry)).sort((a, b) => a.localeCompare(b));
}

function stripTestSuffix(filePath) {
  return filePath.replace(/\.test(?=\.[^.]+$)/u, "");
}

function isPermittedAppCompatTestFile(filePath) {
  if (!/\.test\.(ts|tsx)$/u.test(filePath)) {
    return false;
  }

  const implementationPath = stripTestSuffix(filePath);
  return allowedAppComponentFiles.has(implementationPath);
}

function main() {
  const failures = [];
  const sharedFamilies = collectComponentFamilies("packages/design-system/src/components");
  const uiFamilies = collectComponentFamilies("packages/ui/src/components");
  const duplicateFamilies = intersect(sharedFamilies, uiFamilies);

  for (const family of duplicateFamilies) {
    if (!duplicateFamilyBaseline.has(family)) {
      failures.push(
        `New duplicate family detected across packages/design-system and packages/ui: ${family}.`
      );
    }
  }

  const appComponentFiles = collectFiles("apps/code/src/design-system/components");
  for (const filePath of appComponentFiles) {
    if (isPermittedAppCompatTestFile(filePath)) {
      continue;
    }
    if (!allowedAppComponentFiles.has(filePath)) {
      failures.push(
        `${filePath}: new app-level design-system component files are forbidden in Wave 1.`
      );
    }
  }

  const appAdapterFiles = collectFiles("apps/code/src/design-system/adapters");
  for (const filePath of appAdapterFiles) {
    if (!allowedAppAdapterFiles.has(filePath)) {
      failures.push(
        `${filePath}: new app-level design-system adapter files are forbidden until the adapter/barrel debt baseline is updated deliberately.`
      );
    }
  }

  const appRootFiles = collectFiles("apps/code/src/design-system").filter(
    (filePath) =>
      !filePath.startsWith("apps/code/src/design-system/adapters/") &&
      !filePath.startsWith("apps/code/src/design-system/components/")
  );
  for (const filePath of appRootFiles) {
    if (!allowedAppRootFiles.has(filePath)) {
      failures.push(
        `${filePath}: new app design-system root barrel surface files are forbidden until the adapter/barrel debt baseline is updated deliberately.`
      );
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design-system ownership guard failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Design-system ownership guard passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
