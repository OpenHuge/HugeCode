#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { ARTIFACT_SUFFIXES, PIPELINE_VERSION } from "./shared/contracts.mjs";
import { loadPipelineArtifacts, readPipelineArtifacts } from "./shared/load-artifacts.mjs";
import {
  readJson,
  replaceJsonSuffix,
  resolveLatestRawExportJsonPath,
  sha256File,
  writeJson,
} from "./shared/paths.mjs";

function parseCliOptions(argv) {
  return {
    explicitInputPath: argv.find((argument) => !argument.startsWith("--")) ?? null,
    applyRoot:
      argv
        .find((argument) => argument.startsWith("--apply-root="))
        ?.slice("--apply-root=".length) ?? process.cwd(),
    approveReadyTargets: argv.includes("--approve-ready-targets"),
    approveAllTargets: argv.includes("--approve-all-targets"),
  };
}

function toRelativeRepoPath(absolutePath, repoRoot) {
  return path.relative(repoRoot, absolutePath).replace(/\\/gu, "/");
}

function determineApprovalStatus(target, options) {
  if (options.approveAllTargets) {
    return "approved";
  }
  if (
    options.approveReadyTargets &&
    target.readiness === "ready" &&
    (target.blockers ?? []).length === 0
  ) {
    return "approved";
  }
  return "pending-review";
}

function determineApprovalNotes(target, approvalStatus) {
  const targetNotes = target.notes ?? [];

  if (approvalStatus === "approved") {
    return [
      target.readiness === "ready"
        ? "Target auto-approved because readiness is ready."
        : "Target auto-approved via --approve-all-targets.",
      ...targetNotes,
    ];
  }

  return [
    "Review scaffold output against the promotion review markdown before applying.",
    ...targetNotes,
    ...(target.blockers ?? []).map((blocker) => `Blocker: ${blocker}`),
  ];
}

function buildManifestTarget(target, report, repoRoot, applyRoot, options) {
  const approvalStatus = determineApprovalStatus(target, options);
  const files = target.generatedFiles.map((fileEntry) => {
    const repoRelativePath = toRelativeRepoPath(fileEntry.path, report.outputRoot);
    const targetPath = path.join(applyRoot, repoRelativePath);
    const targetExists = fs.existsSync(targetPath);
    return {
      role: fileEntry.role,
      artifactPath: fileEntry.path,
      repoRelativePath,
      artifactSha256: sha256File(fileEntry.path),
      targetExists,
      targetSha256: targetExists ? sha256File(targetPath) : null,
      diffStatus: !targetExists
        ? "new"
        : sha256File(fileEntry.path) === sha256File(targetPath)
          ? "unchanged"
          : "modified",
    };
  });

  return {
    componentName: target.componentName,
    family: target.family,
    targetLayer: target.targetLayer,
    readiness: target.readiness,
    approvalStatus,
    approvalNotes: determineApprovalNotes(target, approvalStatus),
    files,
  };
}

function buildReviewMarkdown(manifest, codegenReport) {
  const lines = [
    "# Promotion Review",
    "",
    `Source manifest: \`${manifest.sourceManifest}\``,
    `Codegen report: \`${manifest.codegenReportRef}\``,
    `Apply root: \`${manifest.applyRoot}\``,
    "",
    "## Targets",
    "",
  ];

  for (const target of manifest.targets) {
    lines.push(`### ${target.componentName} (${target.family})`);
    lines.push(`- Target layer: \`${target.targetLayer}\``);
    lines.push(`- Readiness: \`${target.readiness}\``);
    lines.push(`- Approval status: \`${target.approvalStatus}\``);
    if (target.approvalNotes.length > 0) {
      for (const note of target.approvalNotes) {
        lines.push(`- Note: ${note}`);
      }
    }
    for (const fileEntry of target.files) {
      lines.push(
        `- ${fileEntry.role}: \`${fileEntry.repoRelativePath}\` (${fileEntry.diffStatus})`
      );
    }
    lines.push("");
  }

  if ((codegenReport.skippedTargets ?? []).length > 0) {
    lines.push("## Skipped Targets");
    lines.push("");
    for (const skippedTarget of codegenReport.skippedTargets) {
      lines.push(
        `- ${skippedTarget.componentName} (${skippedTarget.family}) at ${skippedTarget.stage}: ${skippedTarget.reason}`
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function reviewPromotions(exportJsonPath, options = {}) {
  const artifacts = readPipelineArtifacts(exportJsonPath);
  const repoRoot = process.cwd();
  const { codegenReportPath, promotionManifestPath } = loadPipelineArtifacts(exportJsonPath);
  const codegenReport = readJson(codegenReportPath);
  const applyRoot = path.resolve(options.applyRoot ?? process.cwd());
  const reviewDocPath = replaceJsonSuffix(exportJsonPath, ARTIFACT_SUFFIXES.promotionReview);
  const manifest = {
    artifactVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceManifest: artifacts.manifest.files?.json ?? artifacts.manifest.source?.nodeId ?? "",
    codegenReportRef: codegenReportPath,
    reviewDocPath,
    applyRoot,
    targets: (codegenReport.generatedTargets ?? []).map((target) =>
      buildManifestTarget(target, codegenReport, repoRoot, applyRoot, options)
    ),
  };

  writeJson(promotionManifestPath, manifest);
  fs.writeFileSync(reviewDocPath, buildReviewMarkdown(manifest, codegenReport), "utf8");

  return {
    outputPath: promotionManifestPath,
    reviewDocPath,
    output: manifest,
  };
}

function main() {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const exportJsonPath = resolveLatestRawExportJsonPath(cliOptions.explicitInputPath);
  const { outputPath, reviewDocPath, output } = reviewPromotions(exportJsonPath, cliOptions);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath,
        reviewDocPath,
        targets: output.targets.length,
        approvedTargets: output.targets.filter((target) => target.approvalStatus === "approved")
          .length,
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
