#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0 && !allowFailure) {
    const rendered = result.stderr?.trim() || `git ${args.join(" ")} failed`;
    throw new Error(rendered);
  }

  return result;
}

function resolveDiffArgs(baseRef, headRef) {
  const candidates = [
    ["diff", "--name-only", `${baseRef}...${headRef}`],
    ["diff", "--name-only", baseRef, headRef],
  ];

  for (const candidate of candidates) {
    const result = runGit(candidate, { allowFailure: true });
    if (result.status === 0) {
      return candidate.slice(2);
    }
  }

  throw new Error(`Unable to diff ${baseRef} against ${headRef}`);
}

function writeOutput(name, value) {
  const rendered = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, rendered);
    return;
  }

  process.stdout.write(rendered);
}

function isMarkdownFile(file) {
  return file.endsWith(".md") || file.endsWith(".mdx");
}

function isPackageOwnedChange(file) {
  if (file.startsWith("apps/code-electron/")) {
    return !isMarkdownFile(file);
  }

  if (file.startsWith("packages/code-application/")) {
    return !isMarkdownFile(file);
  }

  if (file.startsWith("packages/code-platform-interfaces/")) {
    return !isMarkdownFile(file);
  }

  return (
    file === "apps/code/package.json" ||
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "pnpm-workspace.yaml" ||
    file === "scripts/electron-publish-dry-run.mjs" ||
    file === "scripts/electron-verify-release-contract.mjs" ||
    file === "scripts/lib/electron-update-release-contract.mjs" ||
    /^patches\/electron-.*\.patch$/u.test(file)
  );
}

function isVerifyOwnedChange(file) {
  return (
    file === ".github/workflows/_reusable-electron-beta.yml" ||
    file === ".github/workflows/electron-beta.yml" ||
    file === ".github/actions/setup-node-pnpm/action.yml" ||
    file === ".github/actions/upload-workflow-artifact/action.yml" ||
    file === "scripts/classify-electron-beta-scope.mjs"
  );
}

const baseRef = process.env.CI_SCOPE_BASE_REF?.trim() || "HEAD^";
const headRef = process.env.CI_SCOPE_HEAD_REF?.trim() || "HEAD";
const diffArgs = resolveDiffArgs(baseRef, headRef);
const changedFiles = runGit(["diff", "--name-only", ...diffArgs])
  .stdout.split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

const electronPackageRequired = changedFiles.some((file) => isPackageOwnedChange(file));
const electronVerifyRequired =
  electronPackageRequired || changedFiles.some((file) => isVerifyOwnedChange(file));

writeOutput("electron_package_required", electronPackageRequired ? "true" : "false");
writeOutput("electron_verify_required", electronVerifyRequired ? "true" : "false");
