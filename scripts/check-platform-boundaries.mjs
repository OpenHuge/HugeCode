#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IMPORT_PATTERN = /(?:from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\))/gu;

const RULES = [
  {
    id: "shared-web-core-platform-import",
    description: "shared web core surfaces must not import Tauri or Electron runtime APIs directly",
    roots: ["apps/code-web", "packages/code-workspace-client"],
    appliesTo(relativeFilePath) {
      return (
        relativeFilePath.startsWith("apps/code-web/") ||
        relativeFilePath.startsWith("packages/code-workspace-client/")
      );
    },
    matches(content, specifier) {
      return (
        specifier.startsWith("@tauri-apps/") ||
        specifier === "electron" ||
        content.includes("window.hugeCodeDesktopHost") ||
        content.includes("ipcRenderer")
      );
    },
  },
  {
    id: "code-domain-platform-import",
    description:
      "code-domain must stay framework- and platform-neutral; no React, browser host, Tauri, or Electron imports",
    roots: ["packages/code-domain"],
    appliesTo(relativeFilePath) {
      return relativeFilePath.startsWith("packages/code-domain/");
    },
    matches(content, specifier) {
      return (
        specifier === "react" ||
        specifier === "react-dom" ||
        specifier.startsWith("@tauri-apps/") ||
        specifier === "electron" ||
        content.includes("window.hugeCodeDesktopHost") ||
        content.includes("ipcRenderer")
      );
    },
  },
  {
    id: "code-application-platform-import",
    description:
      "code-application must depend on platform interfaces, not concrete Tauri or Electron APIs",
    roots: ["packages/code-application"],
    appliesTo(relativeFilePath) {
      return relativeFilePath.startsWith("packages/code-application/");
    },
    matches(content, specifier) {
      return (
        specifier.startsWith("@tauri-apps/") ||
        specifier === "electron" ||
        content.includes("window.hugeCodeDesktopHost") ||
        content.includes("ipcRenderer")
      );
    },
  },
  {
    id: "code-platform-interfaces-neutrality",
    description:
      "code-platform-interfaces must stay abstract and must not import React, Tauri, or Electron runtime implementations",
    roots: ["packages/code-platform-interfaces"],
    appliesTo(relativeFilePath) {
      return relativeFilePath.startsWith("packages/code-platform-interfaces/");
    },
    matches(content, specifier) {
      return (
        specifier === "react" ||
        specifier === "react-dom" ||
        specifier.startsWith("@tauri-apps/") ||
        specifier === "electron" ||
        content.includes("window.hugeCodeDesktopHost") ||
        content.includes("ipcRenderer")
      );
    },
  },
];

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

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/u).length;
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
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".turbo" ||
        entry.name === "coverage"
      ) {
        continue;
      }

      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        continue;
      }

      files.push(absolutePath);
    }
  }

  return files;
}

export function findPlatformBoundaryViolations(repoRoot) {
  const scanRoots = RULES.flatMap((rule) => rule.roots)
    .map((relativePath) => path.join(repoRoot, relativePath))
    .filter(
      (absolutePath, index, allPaths) =>
        fs.existsSync(absolutePath) && allPaths.indexOf(absolutePath) === index
    );
  const violations = [];

  for (const rootDir of scanRoots) {
    for (const filePath of walkFiles(rootDir)) {
      const relativeFilePath = toPosixPath(path.relative(repoRoot, filePath));
      const content = fs.readFileSync(filePath, "utf8");

      for (const rule of RULES) {
        if (!rule.appliesTo(relativeFilePath)) {
          continue;
        }

        if (
          (content.includes("window.hugeCodeDesktopHost") || content.includes("ipcRenderer")) &&
          rule.matches(content, "")
        ) {
          const needle = content.includes("window.hugeCodeDesktopHost")
            ? "window.hugeCodeDesktopHost"
            : "ipcRenderer";
          const index = content.indexOf(needle);
          violations.push({
            filePath: relativeFilePath,
            line: getLineNumber(content, index),
            rule: rule.id,
            description: rule.description,
            snippet: content.split(/\r?\n/u)[getLineNumber(content, index) - 1]?.trim() ?? needle,
          });
          continue;
        }

        for (const match of content.matchAll(IMPORT_PATTERN)) {
          const specifier = match[1] ?? match[2];
          if (!specifier || !rule.matches(content, specifier)) {
            continue;
          }

          violations.push({
            filePath: relativeFilePath,
            line: getLineNumber(content, match.index ?? 0),
            rule: rule.id,
            description: rule.description,
            snippet:
              content.split(/\r?\n/u)[getLineNumber(content, match.index ?? 0) - 1]?.trim() ??
              specifier,
          });
        }
      }
    }
  }

  return violations;
}

function main() {
  const repoRoot = parseArgs(process.argv.slice(2));
  const violations = findPlatformBoundaryViolations(repoRoot);
  if (violations.length === 0) {
    process.exit(0);
  }

  for (const violation of violations) {
    process.stderr.write(
      `[platform-boundaries] ${violation.filePath}:${violation.line} ${violation.description} -> ${violation.snippet}\n`
    );
  }
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
