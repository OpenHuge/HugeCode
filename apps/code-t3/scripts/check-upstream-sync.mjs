#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(appRoot, "../..");
const manifestPath = resolve(appRoot, "upstream-sync.json");
const args = new Set(process.argv.slice(2));
const reportDrift = args.has("--report-drift") || args.has("--enforce-clean-upstream");
const enforceCleanUpstream = args.has("--enforce-clean-upstream");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function fail(message, details = []) {
  process.stderr.write(`${message}\n`);
  for (const detail of details) {
    process.stderr.write(`- ${detail}\n`);
  }
  process.exitCode = 1;
}

function toPosixPath(value) {
  return value.replaceAll("\\", "/");
}

function listGitStatusPaths(repoRelativePath) {
  try {
    const output = execFileSync("git", ["status", "--porcelain=v1", "--", repoRelativePath], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split(/\r?\n/u)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
      .map(toPosixPath)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    failures.push(`git status for ${repoRelativePath} failed: ${error.message}`);
    return [];
  }
}

function formatManifestEntries(entries, fallback) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [fallback];
  }
  return entries.map((entry) => `${entry.path} - ${entry.reason}`);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const upstream = JSON.parse(await readFile(resolve(appRoot, "upstream/UPSTREAM.json"), "utf8"));
const upstreamPackage = JSON.parse(
  await readFile(resolve(appRoot, "upstream/package.json"), "utf8")
);
const failures = [];

if (upstream.commit !== manifest.upstreamCommit) {
  failures.push(
    `UPSTREAM.json commit is ${upstream.commit}, expected ${manifest.upstreamCommit}. Re-audit watched UI files and refresh upstream-sync.json.`
  );
}

if (upstreamPackage.name !== manifest.upstreamPackage) {
  failures.push(
    `upstream package name is ${upstreamPackage.name}, expected ${manifest.upstreamPackage}.`
  );
}

if (upstreamPackage.version !== manifest.upstreamVersion) {
  failures.push(
    `upstream package version is ${upstreamPackage.version}, expected ${manifest.upstreamVersion}.`
  );
}

for (const watchedFile of manifest.watchedFiles) {
  const absolutePath = resolve(repoRoot, watchedFile.path);
  try {
    const actual = sha256(await readFile(absolutePath));
    if (actual !== watchedFile.sha256) {
      failures.push(
        `${watchedFile.path} changed (${watchedFile.reason}); expected ${watchedFile.sha256}, got ${actual}.`
      );
    }
  } catch (error) {
    failures.push(`${watchedFile.path} could not be read: ${error.message}`);
  }
}

for (const [boundaryName, boundaryPath] of Object.entries(manifest.adaptationBoundary ?? {})) {
  try {
    await readFile(resolve(repoRoot, boundaryPath));
  } catch (error) {
    failures.push(
      `adaptationBoundary.${boundaryName} points to ${boundaryPath}, but it could not be read: ${error.message}.`
    );
  }
}

const upstreamRoot = manifest.upstreamRoot ?? "apps/code-t3/upstream";
const allowedUpstreamChanges = new Set(
  manifest.upstreamWritePolicy?.allowedLocalChanges?.map(String) ?? []
);
const upstreamChangedPaths = reportDrift ? listGitStatusPaths(upstreamRoot) : [];
const unexpectedUpstreamChangedPaths = upstreamChangedPaths.filter(
  (path) => !allowedUpstreamChanges.has(path)
);

if (enforceCleanUpstream && unexpectedUpstreamChangedPaths.length > 0) {
  failures.push(
    `${upstreamRoot} has local changes. Move product shell work into overlay roots or update the pinned upstream snapshot in one sync commit: ${unexpectedUpstreamChangedPaths.join(", ")}.`
  );
}

if (failures.length > 0) {
  fail("T3 upstream sync check failed.", failures);
} else {
  process.stdout.write(
    `T3 upstream sync check passed for ${manifest.upstreamPackage}@${manifest.upstreamVersion} (${manifest.upstreamCommit}).\n`
  );
}

if (reportDrift) {
  process.stdout.write("\nT3 sync boundary\n");
  process.stdout.write(`- Upstream root: ${upstreamRoot}\n`);
  for (const entry of formatManifestEntries(
    manifest.overlayRoots,
    "No overlay roots declared in upstream-sync.json"
  )) {
    process.stdout.write(`- Overlay: ${entry}\n`);
  }
  if (upstreamChangedPaths.length === 0) {
    process.stdout.write("- Upstream drift: none\n");
  } else {
    process.stdout.write("- Upstream drift:\n");
    for (const path of upstreamChangedPaths) {
      const marker = allowedUpstreamChanges.has(path) ? "allowed" : "unexpected";
      process.stdout.write(`  - ${path} (${marker})\n`);
    }
  }
}
