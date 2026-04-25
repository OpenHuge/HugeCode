#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(appRoot, "../..");
const manifestPath = resolve(appRoot, "upstream-sync.json");

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

if (failures.length > 0) {
  fail("T3 upstream sync check failed.", failures);
} else {
  process.stdout.write(
    `T3 upstream sync check passed for ${manifest.upstreamPackage}@${manifest.upstreamVersion} (${manifest.upstreamCommit}).\n`
  );
}
