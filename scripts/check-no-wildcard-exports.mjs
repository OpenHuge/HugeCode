#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TARGET_ROOTS = ["apps", "packages"];
const TARGET_EXTENSION_PATTERN = /\.(?:ts|tsx)$/u;
const WILDCARD_EXPORT_PATTERN = /^\s*export\s+\*\s+from\s+["'][^"']+["'];?\s*$/mu;

function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

function listChangedFilesFromEnv() {
  const raw = process.env.VALIDATE_CHANGED_FILES_JSON;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => toPosixPath(String(entry)));
  } catch {
    return [];
  }
}

function isTargetPath(filePath) {
  const normalized = toPosixPath(filePath);
  if (!TARGET_ROOTS.some((root) => normalized.startsWith(`${root}/`))) {
    return false;
  }
  if (!normalized.includes("/src/")) {
    return false;
  }
  if (normalized.endsWith(".d.ts")) {
    return false;
  }
  return TARGET_EXTENSION_PATTERN.test(normalized);
}

function walkFilesRecursive(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = toPosixPath(path.join(relativeDir, entry.name));
    if (entry.isDirectory()) {
      results.push(...walkFilesRecursive(relativePath));
      continue;
    }
    if (entry.isFile()) {
      results.push(relativePath);
    }
  }
  return results;
}

function listCandidateFiles() {
  const changedFiles = listChangedFilesFromEnv().filter(isTargetPath);
  if (changedFiles.length > 0) {
    return [...new Set(changedFiles)].sort((a, b) => a.localeCompare(b));
  }

  const allFiles = TARGET_ROOTS.flatMap((root) => walkFilesRecursive(root)).filter(isTargetPath);
  return [...new Set(allFiles)].sort((a, b) => a.localeCompare(b));
}

const files = listCandidateFiles();

if (files.length === 0) {
  process.exit(0);
}

const violations = [];

for (const filePath of files) {
  const absolutePath = path.join(repoRoot, filePath);
  let content = "";
  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    violations.push(`${filePath}: failed to read file (${String(error)})`);
    continue;
  }

  if (WILDCARD_EXPORT_PATTERN.test(content)) {
    violations.push(`${filePath}: wildcard re-export is forbidden; use explicit exports instead`);
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
  }
  process.exit(1);
}
