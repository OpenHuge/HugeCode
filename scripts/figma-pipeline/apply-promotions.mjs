#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { ARTIFACT_SUFFIXES, PIPELINE_VERSION } from "./shared/contracts.mjs";
import { loadPipelineArtifacts, readPipelineArtifacts } from "./shared/load-artifacts.mjs";
import {
  fileExists,
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  sha256File,
  writeJson,
} from "./shared/paths.mjs";

function parseCliOptions(argv) {
  return {
    explicitInputPath: argv.find((argument) => !argument.startsWith("--")) ?? null,
    overwrite: argv.includes("--overwrite"),
    applyRoot:
      argv
        .find((argument) => argument.startsWith("--apply-root="))
        ?.slice("--apply-root=".length) ?? null,
  };
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyApprovedFile(fileEntry, applyRoot, overwrite) {
  const targetPath = path.join(applyRoot, fileEntry.repoRelativePath);
  const targetExists = fileExists(targetPath);
  if (targetExists && !overwrite) {
    return {
      ok: false,
      reason: `Target file already exists: ${targetPath}. Re-run with --overwrite to apply.`,
    };
  }

  ensureParentDirectory(targetPath);
  fs.copyFileSync(fileEntry.artifactPath, targetPath);
  return {
    ok: true,
    path: targetPath,
    overwritten: targetExists,
  };
}

function buildAppliedTargetNotes(target, applyRoot, overwrittenFiles) {
  return [
    `Applied to ${applyRoot}.`,
    overwrittenFiles.length > 0
      ? "Existing files were overwritten."
      : "Only new files were created.",
    ...(target.targetLayer === "app-adapter"
      ? [
          "App adapter promotions only copy family files.",
          "If the family is meant to be consumable from app design-system entrypoints, wire it through apps/code/src/design-system/adapters/index.ts and then apps/code/src/design-system/index.ts.",
        ]
      : []),
  ];
}

export function applyPromotions(exportJsonPath, options = {}) {
  const artifacts = readPipelineArtifacts(exportJsonPath);
  const { promotionManifestPath } = loadPipelineArtifacts(exportJsonPath);
  const manifest = readJson(promotionManifestPath);
  const applyRoot = path.resolve(options.applyRoot ?? manifest.applyRoot ?? process.cwd());
  const appliedTargets = [];
  const skippedTargets = [];

  for (const target of manifest.targets ?? []) {
    if (target.approvalStatus !== "approved") {
      skippedTargets.push({
        componentName: target.componentName,
        family: target.family,
        reason: `Approval status is ${target.approvalStatus}. Only approved targets can be applied.`,
      });
      continue;
    }

    const appliedFiles = [];
    const overwrittenFiles = [];
    let failedReason = null;

    for (const fileEntry of target.files ?? []) {
      const artifactHash = sha256File(fileEntry.artifactPath);
      if (artifactHash !== fileEntry.artifactSha256) {
        failedReason = `Artifact hash changed for ${fileEntry.artifactPath}; regenerate the review manifest before applying.`;
        break;
      }

      const copyResult = copyApprovedFile(fileEntry, applyRoot, options.overwrite === true);
      if (!copyResult.ok) {
        failedReason = copyResult.reason;
        break;
      }

      appliedFiles.push({ path: copyResult.path, role: fileEntry.role });
      if (copyResult.overwritten) {
        overwrittenFiles.push(copyResult.path);
      }
    }

    if (failedReason) {
      skippedTargets.push({
        componentName: target.componentName,
        family: target.family,
        reason: failedReason,
      });
      continue;
    }

    appliedTargets.push({
      componentName: target.componentName,
      family: target.family,
      targetLayer: target.targetLayer,
      readiness: target.readiness,
      approvalStatus: "approved",
      appliedFiles,
      overwrittenFiles,
      notes: buildAppliedTargetNotes(target, applyRoot, overwrittenFiles),
    });
  }

  const report = {
    artifactVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceManifest: artifacts.manifest.files?.json ?? artifacts.manifest.source?.nodeId ?? "",
    manifestRef: promotionManifestPath,
    applyRoot,
    appliedTargets,
    skippedTargets,
  };

  const outputPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.promotionApplyReport);
  writeJson(outputPath, report);
  return { outputPath, output: report };
}

function main() {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const exportJsonPath = resolveLatestRawExportJsonPath(cliOptions.explicitInputPath);
  const { outputPath, output } = applyPromotions(exportJsonPath, cliOptions);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath,
        appliedTargets: output.appliedTargets.length,
        skippedTargets: output.skippedTargets.length,
      },
      null,
      2
    )}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
