#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IMPORT_PATTERN = /(?:from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\))/gu;
const FEATURE_RUNTIME_CONTROL_PLANE_FACADES = new Set([
  "apps/code/src/application/runtime/facades/runtimeMissionControlFacade",
  "apps/code/src/application/runtime/facades/runtimeMissionControlLoop",
  "apps/code/src/application/runtime/facades/runtimeContinuityReadiness",
  "apps/code/src/application/runtime/facades/runtimeReviewContinuationFacade",
]);

function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

function parseArgs(argv) {
  const rootFlagIndex = argv.indexOf("--root");
  if (rootFlagIndex >= 0 && rootFlagIndex + 1 < argv.length) {
    return path.resolve(argv[rootFlagIndex + 1]);
  }
  return process.cwd();
}

function walkFiles(rootDir) {
  const stack = [rootDir];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".turbo") {
        continue;
      }
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        continue;
      }
      files.push(absolutePath);
    }
  }

  return files;
}

function getAppId(relativeFilePath) {
  const segments = toPosixPath(relativeFilePath).split("/");
  if (segments[0] !== "apps" || segments.length < 3) {
    return null;
  }
  return segments[1];
}

function getPackageId(relativeFilePath) {
  const segments = toPosixPath(relativeFilePath).split("/");
  if (segments[0] !== "packages" || segments.length < 3) {
    return null;
  }
  return segments[1];
}

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/u).length;
}

function resolveRelativeImport(filePath, specifier) {
  return toPosixPath(path.normalize(path.resolve(path.dirname(filePath), specifier)));
}

function normalizePathImport(specifier) {
  return toPosixPath(path.normalize(specifier));
}

function isTestLikeFile(relativeFilePath) {
  return /\.(?:test|spec)\.[jt]sx?$/u.test(relativeFilePath);
}

function stripKnownExtension(relativeFilePath) {
  return relativeFilePath.replace(/\.(?:ts|tsx|js|jsx)$/u, "");
}

function findViolations(repoRoot) {
  const scanRoots = [
    path.join(repoRoot, "apps"),
    path.join(repoRoot, "packages", "code-workspace-client"),
  ].filter((rootDir) => fs.existsSync(rootDir));
  const violations = [];

  for (const rootDir of scanRoots) {
    for (const filePath of walkFiles(rootDir)) {
      const relativeFilePath = toPosixPath(path.relative(repoRoot, filePath));
      const sourceAppId = getAppId(relativeFilePath);
      const sourcePackageId = getPackageId(relativeFilePath);
      if (!sourceAppId && !sourcePackageId) {
        continue;
      }

      const content = fs.readFileSync(filePath, "utf8");
      for (const match of content.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1] ?? match[2];
        if (!specifier) {
          continue;
        }

        let normalizedTarget = null;
        if (specifier.startsWith(".")) {
          normalizedTarget = resolveRelativeImport(filePath, specifier);
        } else if (specifier.includes("apps/")) {
          normalizedTarget = normalizePathImport(specifier);
        }

        if (!normalizedTarget) {
          continue;
        }

        const relativeTargetPath = normalizedTarget.startsWith(toPosixPath(repoRoot))
          ? toPosixPath(path.relative(repoRoot, normalizedTarget))
          : normalizedTarget;

        const targetMatch = relativeTargetPath.match(/^apps\/([^/]+)\/src(?:\/|$)/u);
        if (!targetMatch) {
          continue;
        }

        const targetAppId = targetMatch[1];
        if (
          relativeFilePath.startsWith("apps/code/src/features/") &&
          !isTestLikeFile(relativeFilePath) &&
          FEATURE_RUNTIME_CONTROL_PLANE_FACADES.has(stripKnownExtension(relativeTargetPath))
        ) {
          violations.push({
            filePath: relativeFilePath,
            line: getLineNumber(content, match.index ?? 0),
            specifier,
            target: relativeTargetPath,
            kind: "feature-to-app control-plane facade import",
          });
          continue;
        }

        if (sourceAppId && targetAppId === sourceAppId) {
          continue;
        }

        violations.push({
          filePath: relativeFilePath,
          line: getLineNumber(content, match.index ?? 0),
          specifier,
          target: relativeTargetPath,
          kind: sourcePackageId ? "package-to-app src import" : "cross-app src import",
        });
      }
    }
  }

  return violations;
}

function main() {
  const repoRoot = parseArgs(process.argv.slice(2));
  const violations = findViolations(repoRoot);
  if (violations.length === 0) {
    process.exit(0);
  }

  for (const violation of violations) {
    process.stderr.write(
      `[app-source-boundary] ${violation.filePath}:${violation.line} ${violation.kind} -> ${violation.specifier} (${violation.target})\n`
    );
  }
  process.exit(1);
}

main();
