#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  APP_DESIGN_SYSTEM_ADAPTER_ENTRY_FILES,
  APP_DESIGN_SYSTEM_ALLOWED_COMPONENT_FILES,
  APP_DESIGN_SYSTEM_ALLOWED_TRIVIAL_COMPAT_COMPONENT_FILES,
  APP_DESIGN_SYSTEM_DELETED_COMPONENT_IMPORT_BASES,
  APP_DESIGN_SYSTEM_DELETED_PASSTHROUGH_FILES,
  APP_DESIGN_SYSTEM_ROOT_ADAPTER_EXPORTS,
  APP_DESIGN_SYSTEM_ROOT_APP_GRAMMAR_EXPORTS,
  APP_DESIGN_SYSTEM_ROOT_COMPAT_EXPORTS,
  APP_DESIGN_SYSTEM_ROOT_DIRECT_SHARED_EXPORTS,
} from "./lib/design-system-app-surface-config.mjs";

const APP_FEATURE_FORBIDDEN_SHARED_FAMILY_EXPORTS = [
  "InlineActionRow",
  "InlineActionRowProps",
  "MetadataList",
  "MetadataListProps",
  "MetadataRow",
  "MetadataRowProps",
  "PopoverMenuItem",
  "PopoverMenuItemProps",
  "PopoverSurface",
  "PopoverSurfaceProps",
  "StatusBadge",
  "StatusBadgeProps",
  "StatusBadgeTone",
  "Surface",
  "SurfaceProps",
];

const SOURCE_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

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

function toPosixPath(value) {
  return value.split(path.sep).join("/");
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

function collectFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const results = [];
  const stack = [rootDir];
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
      results.push(toPosixPath(absolutePath));
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function isTrivialPassthrough(sourceText) {
  const trimmed = sourceText.trim();
  return /^export\s+(?:\{[\s\S]*\}|\*)\s+from\s+["'][^"']+["'];?$/u.test(trimmed);
}

function collectExportMapForSource(sourceText) {
  const exportMap = new Map();
  const pattern = /export\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)";/gu;

  for (const match of sourceText.matchAll(pattern)) {
    const [, exportBlock = "", source = ""] = match;
    const names = exportBlock
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.replace(/^type\s+/u, "").trim());
    const current = exportMap.get(source) ?? new Set();
    for (const name of names) {
      current.add(name);
    }
    exportMap.set(source, current);
  }

  return exportMap;
}

function assertExpectedExports(exportMap, source, expectedExports, failures, label) {
  const actualExports = exportMap.get(source) ?? new Set();
  const missingExports = expectedExports.filter((name) => !actualExports.has(name));
  if (missingExports.length > 0) {
    failures.push(`${label}: missing export(s) from ${source}: ${missingExports.join(", ")}.`);
  }
}

function main() {
  const repoRoot = parseRootArg(process.argv.slice(2));
  const failures = [];

  const indexPath = path.join(repoRoot, "apps", "code", "src", "design-system", "index.ts");
  const indexSource = readRequiredFile(indexPath, "App design-system root barrel");
  const rootExportMap = collectExportMapForSource(indexSource);
  const directSharedExports = rootExportMap.get("@ku0/design-system") ?? new Set();

  for (const relativePath of APP_DESIGN_SYSTEM_ADAPTER_ENTRY_FILES) {
    if (!fs.existsSync(path.join(repoRoot, relativePath))) {
      failures.push(`Adapter passthrough entry is missing: ${relativePath}.`);
    }
  }

  for (const relativePath of APP_DESIGN_SYSTEM_ALLOWED_COMPONENT_FILES) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`Allowed compat surface is missing: ${relativePath}.`);
      continue;
    }

    const extension = path.posix.extname(relativePath);
    if (!SOURCE_FILE_EXTENSIONS.has(extension)) {
      continue;
    }

    if (APP_DESIGN_SYSTEM_ALLOWED_TRIVIAL_COMPAT_COMPONENT_FILES.has(relativePath)) {
      continue;
    }

    const sourceText = fs.readFileSync(absolutePath, "utf8");
    if (isTrivialPassthrough(sourceText)) {
      failures.push(
        `${relativePath}: compat or app-owned surface regressed into a trivial passthrough shell.`
      );
    }

    if (
      relativePath.startsWith("apps/code/src/design-system/components/execution/") &&
      /from\s+["']@ku0\/design-system["']/u.test(sourceText)
    ) {
      failures.push(
        `${relativePath}: execution survivor grammar must stay app-owned instead of importing raw shared primitives.`
      );
    }
  }

  const modalShellPath = path.join(
    repoRoot,
    "apps",
    "code",
    "src",
    "design-system",
    "components",
    "ModalShell.tsx"
  );
  if (fs.existsSync(modalShellPath)) {
    const modalShellSource = fs.readFileSync(modalShellPath, "utf8");
    if (!/from\s+["']\.\/modal\/ModalPrimitives["']/u.test(modalShellSource)) {
      failures.push(
        "apps/code/src/design-system/components/ModalShell.tsx: ModalShell must bridge through ./modal/ModalPrimitives."
      );
    }
    if (/from\s+["']@ku0\/design-system["']/u.test(modalShellSource)) {
      failures.push(
        "apps/code/src/design-system/components/ModalShell.tsx: ModalShell must not import Dialog directly from @ku0/design-system."
      );
    }
  }

  for (const relativePath of APP_DESIGN_SYSTEM_DELETED_PASSTHROUGH_FILES) {
    if (fs.existsSync(path.join(repoRoot, relativePath))) {
      failures.push(`${relativePath}: deleted passthrough surface must not exist.`);
    }
  }

  const appComponentFiles = collectFiles(
    path.join(repoRoot, "apps", "code", "src", "design-system", "components")
  ).map((absolutePath) => toPosixPath(path.relative(repoRoot, absolutePath)));
  const allowedComponentFiles = new Set(APP_DESIGN_SYSTEM_ALLOWED_COMPONENT_FILES);
  const deletedComponentFiles = new Set(APP_DESIGN_SYSTEM_DELETED_PASSTHROUGH_FILES);
  for (const relativePath of appComponentFiles) {
    if (allowedComponentFiles.has(relativePath) || deletedComponentFiles.has(relativePath)) {
      continue;
    }
    failures.push(
      `${relativePath}: unexpected app design-system component surface outside the frozen compat baseline.`
    );
  }

  for (const { source, exports } of APP_DESIGN_SYSTEM_ROOT_ADAPTER_EXPORTS) {
    assertExpectedExports(rootExportMap, source, exports, failures, "Root barrel adapter exports");
  }

  for (const { source, exports } of APP_DESIGN_SYSTEM_ROOT_COMPAT_EXPORTS) {
    assertExpectedExports(rootExportMap, source, exports, failures, "Root barrel compat exports");
  }

  for (const { source, exports } of APP_DESIGN_SYSTEM_ROOT_APP_GRAMMAR_EXPORTS) {
    assertExpectedExports(
      rootExportMap,
      source,
      exports,
      failures,
      "Root barrel app-owned grammar exports"
    );
  }

  const missingDirectSharedExports = APP_DESIGN_SYSTEM_ROOT_DIRECT_SHARED_EXPORTS.filter(
    (name) => !directSharedExports.has(name)
  );
  if (missingDirectSharedExports.length > 0) {
    failures.push(
      `Root barrel direct shared forwards are missing: ${missingDirectSharedExports.join(", ")}.`
    );
  }

  const unexpectedDirectSharedExports = [...directSharedExports]
    .filter((name) => !APP_DESIGN_SYSTEM_ROOT_DIRECT_SHARED_EXPORTS.includes(name))
    .sort((left, right) => left.localeCompare(right));
  if (unexpectedDirectSharedExports.length > 0) {
    failures.push(
      `Root barrel has unexpected direct shared forwards: ${unexpectedDirectSharedExports.join(", ")}.`
    );
  }

  for (const baseName of APP_DESIGN_SYSTEM_DELETED_COMPONENT_IMPORT_BASES) {
    const deletedImportPattern = new RegExp(
      `from\\s+"(?:\\./components/|.*design-system/components/)${escapeRegExp(baseName)}"`,
      "u"
    );
    if (deletedImportPattern.test(indexSource)) {
      failures.push(
        `${baseName}: root barrel must not route through deleted component passthrough paths.`
      );
    }
  }

  const searchableFiles = collectFiles(path.join(repoRoot, "apps", "code", "src")).filter(
    (absolutePath) => {
      const relativePath = toPosixPath(path.relative(repoRoot, absolutePath));
      const extension = path.posix.extname(relativePath);
      if (!SOURCE_FILE_EXTENSIONS.has(extension)) {
        return false;
      }
      return relativePath.startsWith("apps/code/src/");
    }
  );

  const featureFiles = searchableFiles.filter((absolutePath) =>
    toPosixPath(path.relative(repoRoot, absolutePath)).startsWith("apps/code/src/features/")
  );

  for (const absolutePath of featureFiles) {
    const relativePath = toPosixPath(path.relative(repoRoot, absolutePath));
    const sourceText = fs.readFileSync(absolutePath, "utf8");

    for (const exportName of APP_FEATURE_FORBIDDEN_SHARED_FAMILY_EXPORTS) {
      const exportPattern = new RegExp(
        `export\\s+(?:const|function|class|type|interface)\\s+${escapeRegExp(exportName)}\\b|export\\s*\\{[^}]*\\b${escapeRegExp(exportName)}\\b[^}]*\\}`,
        "u"
      );
      if (!exportPattern.test(sourceText)) {
        continue;
      }
      failures.push(
        `${relativePath}: feature-local surface must not export promoted shared family ${exportName}.`
      );
    }
  }

  for (const baseName of APP_DESIGN_SYSTEM_DELETED_COMPONENT_IMPORT_BASES) {
    const componentRefPattern = new RegExp(
      `(?:design-system/components|\\./components|\\.\\./components)/${escapeRegExp(baseName)}(?:["'])`,
      "u"
    );
    for (const absolutePath of searchableFiles) {
      const relativePath = toPosixPath(path.relative(repoRoot, absolutePath));
      const sourceText = fs.readFileSync(absolutePath, "utf8");
      if (!componentRefPattern.test(sourceText)) {
        continue;
      }
      failures.push(
        `${relativePath}: references deleted app design-system component path for ${baseName}.`
      );
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design-system surface semantics check failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Design-system surface semantics check passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
