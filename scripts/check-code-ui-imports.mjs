#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const appSourceRoot = path.join(repoRoot, "apps/code/src");
const allowedUiSpecifiers = ["@ku0/ui/styles/globals", "@ku0/ui/styles/tokens"];
const allowedDirectSharedComponentImportFiles = new Set([
  "apps/code/src/features/app/components/main-shell/MainShellAdapters.tsx",
  "apps/code/src/features/core-loop/components/CoreLoopAdapters.tsx",
  "apps/code/src/features/review/components/review-loop/ReviewLoopAdapters.tsx",
]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const failures = [];
const disallowedDesignSystemComponentRoots = [
  "/design-system/components/Avatar",
  "/design-system/components/Badge",
  "/design-system/components/Button",
  "/design-system/components/Card",
  "/design-system/components/Checkbox",
  "/design-system/components/DropdownMenu",
  "/design-system/components/EmptyState",
  "/design-system/components/Icon",
  "/design-system/components/Input",
  "/design-system/components/Popover",
  "/design-system/components/popover/PopoverPrimitives",
  "/design-system/components/SectionHeader",
  "/design-system/components/Select",
  "/design-system/components/StatusBadge",
  "/design-system/components/Surface",
  "/design-system/components/Switch",
  "/design-system/components/Tabs",
  "/design-system/components/Text",
  "/design-system/components/Textarea",
  "/design-system/components/textarea/TextareaPrimitives",
  "/design-system/components/Tooltip",
  "/design-system/components/ModalShell",
  "/design-system/components/PanelPrimitives",
  "/design-system/components/ToastPrimitives",
  "/design-system/components/toast/ToastPrimitives",
  "/design-system/components/modal/ModalPrimitives",
  "/design-system/components/panel/PanelPrimitives",
  "/design-system/components/shell/ShellPrimitives",
  "/design-system/components/modal/ModalCardPresets.css",
  "/design-system/components/execution/ActivityLogRow",
  "/design-system/components/execution/DiffReviewPanel",
  "/design-system/components/execution/ExecutionStatusPill",
  "/design-system/components/execution/ToolCallChip",
  "/design-system/components/execution/executionStatus",
];
const disallowedFeatureDesignSystemRoots = [
  "/features/design-system/components/modal/ModalShell",
  "/features/design-system/components/panel/PanelPrimitives",
  "/features/design-system/components/popover/PopoverPrimitives",
  "/features/design-system/components/textarea/TextareaPrimitives",
  "/features/design-system/components/toast/ToastPrimitives",
  "/features/design-system/components/modal/ModalPrimitives",
  "/features/design-system/components/panel/PanelPrimitives",
  "/features/design-system/components/shell/ShellPrimitives",
  "/features/design-system/components/execution/ActivityLogRow",
  "/features/design-system/components/execution/DiffReviewPanel",
  "/features/design-system/components/execution/ExecutionStatusPill",
  "/features/design-system/components/execution/ToolCallChip",
  "/features/design-system/components/execution/ExecutionPrimitives.css",
  "/features/design-system/components/execution/executionStatus",
];

function isAppDesignSystemFile(absolutePath) {
  return absolutePath.startsWith(path.join(appSourceRoot, "design-system"));
}

function isDisallowedRelativeDesignSystemComponent(specifier) {
  if (!specifier?.startsWith(".")) {
    return false;
  }
  return disallowedDesignSystemComponentRoots.some((suffix) => specifier.endsWith(suffix));
}

function isDisallowedRelativeFeatureDesignSystemImport(specifier) {
  if (!specifier?.startsWith(".")) {
    return false;
  }
  return disallowedFeatureDesignSystemRoots.some((suffix) => specifier.endsWith(suffix));
}

function walk(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    if (!sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const sourceText = fs.readFileSync(absolutePath, "utf8");
    const relativePath = path.relative(repoRoot, absolutePath);
    const isTsxLikeFile = [".tsx", ".jsx"].includes(path.extname(absolutePath));
    const importPattern = /(?:^|\n)\s*import(?:[^"'`]*?\sfrom\s+)?["']([^"']+)["']/gu;

    for (const match of sourceText.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier) {
        continue;
      }

      if (specifier.startsWith("@ku0/ui")) {
        if (allowedUiSpecifiers.includes(specifier)) {
          continue;
        }

        failures.push({
          filePath: path.relative(repoRoot, absolutePath),
          specifier,
          reason: "disallowed @ku0/ui import",
        });
        continue;
      }

      if (
        specifier === "@ku0/design-system" &&
        isTsxLikeFile &&
        !isAppDesignSystemFile(absolutePath) &&
        !allowedDirectSharedComponentImportFiles.has(relativePath)
      ) {
        failures.push({
          filePath: relativePath,
          specifier,
          reason:
            "import shared design-system components through apps/code/src/design-system unless the file is a registered app-grammar exception",
        });
        continue;
      }

      if (isAppDesignSystemFile(absolutePath)) {
        continue;
      }

      if (isDisallowedRelativeDesignSystemComponent(specifier)) {
        failures.push({
          filePath: path.relative(repoRoot, absolutePath),
          specifier,
          reason: "import shared families from apps/code/src/design-system root barrel",
        });
        continue;
      }

      if (isDisallowedRelativeFeatureDesignSystemImport(specifier)) {
        failures.push({
          filePath: path.relative(repoRoot, absolutePath),
          specifier,
          reason: "import app design-system surfaces from apps/code/src/design-system root barrel",
        });
      }
    }
  }
}

walk(appSourceRoot);

if (failures.length > 0) {
  process.stderr.write("apps/code UI import boundary check failed.\n");
  for (const failure of failures) {
    process.stderr.write(`- ${failure.filePath}: ${failure.reason} (${failure.specifier})\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("apps/code UI import boundary check passed.\n");
}
