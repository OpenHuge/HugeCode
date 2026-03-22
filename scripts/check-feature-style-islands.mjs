#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const featuresRoot = "apps/code/src/features";
const allowlist = new Set([
  "apps/code/src/features/about/components/AboutView.global.css.ts",
  "apps/code/src/features/app/components/SidebarSurface.global.css.ts",
  "apps/code/src/features/atlas/components/AtlasPanel.global.css.ts",
  "apps/code/src/features/git/components/GitDiffViewer.global.css.ts",
  "apps/code/src/features/messages/components/MarkdownSkillReference.global.css.ts",
  "apps/code/src/features/messages/components/MessagesRichContent.global.css.ts",
  "apps/code/src/features/settings/components/sections/settings-codex-accounts-card/SettingsCodexAccountsSurface.global.css.ts",
  "apps/code/src/features/workspaces/components/WorkspaceHomeAgentSurface.global.css.ts",
]);

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function collectGlobalStyleIslands(rootDir) {
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
      if (!entry.isFile() || !entry.name.endsWith(".global.css.ts")) {
        continue;
      }
      results.push(toPosixPath(path.relative(repoRoot, absolutePath)));
    }
  }
  return results.sort((left, right) => left.localeCompare(right));
}

function main() {
  const islands = collectGlobalStyleIslands(featuresRoot);
  const failures = islands.filter((filePath) => !allowlist.has(filePath));
  if (failures.length > 0) {
    process.stderr.write("Feature-global style island guard failed.\n");
    for (const filePath of failures) {
      process.stderr.write(`- ${filePath}: new feature-global style islands are forbidden.\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Feature-global style island guard passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
