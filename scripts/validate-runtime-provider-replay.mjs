#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  buildRuntimeReplayValidationReport,
  compileRuntimeReplayFixture,
  loadRuntimeReplayDataset,
  parseRuntimeReplayFilters,
  selectRuntimeReplaySamples,
  validateRuntimeReplayDataset,
  writeJson,
} from "./lib/runtimeReplayDataset.mjs";

function writeStdoutLine(message) {
  process.stdout.write(`${message}\n`);
}

function writeStderrLine(message) {
  process.stderr.write(`${message}\n`);
}

function main() {
  const filters = parseRuntimeReplayFilters(process.argv.slice(2));
  const dataset = loadRuntimeReplayDataset({ manifestPath: filters.manifestPath });
  const selectedSamples = selectRuntimeReplaySamples(dataset, filters);
  const selectedDataset = {
    ...dataset,
    manifest: {
      ...dataset.manifest,
      samples: selectedSamples.map((entry) => entry.manifestEntry),
    },
    samples: selectedSamples,
  };
  const validation = validateRuntimeReplayDataset(selectedDataset, {
    requireRecorded: filters.requireRecorded,
    skipTaxonomyCoverageWarnings: selectedSamples.length !== dataset.samples.length,
    requireCoverageMatrixSatisfaction: selectedSamples.length === dataset.samples.length,
    skipCoverageMatrixCatalogStatusAlignment: selectedSamples.length !== dataset.samples.length,
  });

  if (selectedSamples.length === 0) {
    validation.errors.push("No dataset samples matched the requested filters.");
  }

  for (const warning of validation.warnings) {
    writeStdoutLine(`warning: ${warning}`);
  }
  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      writeStderrLine(`error: ${error}`);
    }
    process.exit(1);
  }

  if (filters.emitCompiledFixture) {
    const compiledFixture = compileRuntimeReplayFixture(dataset, selectedSamples);
    const outputPath = path.isAbsolute(filters.emitCompiledFixture)
      ? filters.emitCompiledFixture
      : path.resolve(process.cwd(), filters.emitCompiledFixture);
    writeJson(outputPath, compiledFixture);
    writeStdoutLine(`Compiled replay fixture: ${outputPath}`);
  }

  const report = buildRuntimeReplayValidationReport({
    dataset,
    selectedSamples,
    validation,
  });

  if (filters.outputReportPath) {
    const outputPath = path.isAbsolute(filters.outputReportPath)
      ? filters.outputReportPath
      : path.resolve(process.cwd(), filters.outputReportPath);
    writeJson(outputPath, report);
    writeStdoutLine(`Validation report: ${outputPath}`);
  }

  const thinScenarioTypes = report.scenarioStats?.thinScenarioTypes ?? [];
  const scenarioDensity = report.scenarioStats?.scenarioDensity ?? null;
  const familyDensity = report.scenarioStats?.familyDensity ?? null;
  const candidatePromotionQueue = report.scenarioStats?.candidatePromotionQueue ?? [];
  const scenarioPriorityQueue = report.scenarioStats?.scenarioPriorityQueue ?? [];
  const evolutionSignals = report.evolutionSignals ?? null;
  const coverageMatrix = report.coverageMatrix ?? null;
  const candidateIntake = report.candidateIntake ?? null;
  const backgroundReadyQueue = report.backgroundReadyQueue ?? null;
  const baselineGovernance = report.baselineGovernance ?? null;
  const lineageGraphSummary = report.lineageGraphSummary ?? null;
  const regressionCoverage = report.regressionCoverage ?? null;
  const traceGradeDistribution = report.traceGradeDistribution ?? null;
  const matrixCoverageByAxis = report.matrixCoverageByAxis ?? null;
  const promotionCandidatesByRisk = report.promotionCandidatesByRisk ?? null;
  const liveProbeStability = report.liveProbeStability ?? null;
  const freshnessDebt = report.freshnessDebt ?? null;
  writeStdoutLine(
    `Scenario stats: ${report.scenarioStats?.totalSamples ?? 0} samples; stability=${JSON.stringify(report.scenarioStats?.stabilityCounts ?? {})}; thin=${thinScenarioTypes.map((entry) => `${entry.scenarioType}:${entry.sampleCount}`).join(", ") || "none"}`
  );
  if (scenarioDensity) {
    writeStdoutLine(
      `Scenario density: min=${scenarioDensity.minimumSampleCount}; fully_gated_single=${(Array.isArray(scenarioDensity.fullyGatedButSingleSample) ? scenarioDensity.fullyGatedButSingleSample : []).map((entry) => entry.scenarioType).join(", ") || "none"}; background_ready_but_thin=${(Array.isArray(scenarioDensity.backgroundReadyButThin) ? scenarioDensity.backgroundReadyButThin : []).map((entry) => entry.id).join(", ") || "none"}`
    );
  }
  if (familyDensity) {
    writeStdoutLine(
      `Family density: min=${familyDensity.minimumSampleCount}; thin=${(Array.isArray(familyDensity.thinFamilies) ? familyDensity.thinFamilies : []).map((entry) => `${entry.family}:${entry.sampleCount}`).join(", ") || "none"}; dense=${(Array.isArray(familyDensity.denseFamilies) ? familyDensity.denseFamilies : []).map((entry) => `${entry.family}:${entry.sampleCount}`).join(", ") || "none"}`
    );
  }
  if (
    Object.keys(report.scenarioStats?.recoveryFailureClassDistribution ?? {}).length > 0 ||
    Object.keys(report.scenarioStats?.recoveryEvidenceModeDistribution ?? {}).length > 0
  ) {
    writeStdoutLine(
      `Recovery distributions: failureClasses=${JSON.stringify(report.scenarioStats?.recoveryFailureClassDistribution ?? {})}; evidenceModes=${JSON.stringify(report.scenarioStats?.recoveryEvidenceModeDistribution ?? {})}`
    );
  }
  if (scenarioPriorityQueue.length > 0) {
    writeStdoutLine(
      `Scenario priorities: ${scenarioPriorityQueue
        .slice(0, 5)
        .map(
          (entry) =>
            `${entry.scenarioType}[${entry.coverageTier};${entry.gapSignals.join("|") || "healthy"}]`
        )
        .join(", ")}`
    );
  }
  if (coverageMatrix) {
    writeStdoutLine(
      `Coverage matrix: profiles=${coverageMatrix.configuredProfileCount}; gaps=${coverageMatrix.gapCount}; scenarios=${(coverageMatrix.scenarioCoverage ?? []).map((entry) => `${entry.scenarioType}:${entry.coverageStatus}`).join(", ") || "none"}`
    );
    if ((coverageMatrix.capabilityCoverage?.length ?? 0) > 0) {
      writeStdoutLine(
        `Capability coverage: ${(coverageMatrix.capabilityCoverage ?? []).map((entry) => `${entry.capabilityId}:${entry.coverageStatus}`).join(", ")}`
      );
    }
    if ((coverageMatrix.gaps?.length ?? 0) > 0) {
      writeStdoutLine(
        `Coverage gaps: ${coverageMatrix.gaps
          .slice(0, 8)
          .map((entry) =>
            entry.capabilityId
              ? `capability:${entry.capabilityId}->${entry.profileId}`
              : `scenario:${entry.scenarioType}->${entry.profileId}`
          )
          .join(", ")}`
      );
    }
  }
  if (candidateIntake) {
    writeStdoutLine(
      `Candidate intake: candidates=${candidateIntake.summary?.candidateSampleCount ?? 0}; workflow_failures=${candidateIntake.summary?.workflowFailureCandidateCount ?? 0}; background_ready_nightly=${candidateIntake.summary?.backgroundReadyNightlyCount ?? 0}; matrix_gaps=${candidateIntake.summary?.matrixGapSuggestionCount ?? 0}`
    );
  }
  if (candidatePromotionQueue.length > 0) {
    writeStdoutLine(
      `Candidate queue: ${candidatePromotionQueue
        .slice(0, 5)
        .map(
          (entry) =>
            `${entry.id}[score=${entry.promotionReadiness?.score ?? 0};${entry.blockers.join("|") || "ready"}]`
        )
        .join(", ")}`
    );
  }
  if (evolutionSignals) {
    writeStdoutLine(
      `Evolution signals: seeds=${JSON.stringify(evolutionSignals.seedSourceCounts ?? {})}; tracks=${JSON.stringify(evolutionSignals.incubationTrackCounts ?? {})}; levers=${JSON.stringify(evolutionSignals.recommendedLeverCounts ?? {})}`
    );
    if ((evolutionSignals.lineageLinks?.length ?? 0) > 0) {
      writeStdoutLine(
        `Prompt lineage: ${evolutionSignals.lineageLinks
          .slice(0, 5)
          .map((entry) => `${entry.parentSampleId}->${entry.id}[${entry.strategy}]`)
          .join(", ")}`
      );
    }
  }
  if (backgroundReadyQueue) {
    writeStdoutLine(
      `Background-ready queue: selected=${backgroundReadyQueue.selectedCount}; excluded=${backgroundReadyQueue.summary?.excludedCount ?? 0}; allowlist=${backgroundReadyQueue.allowlist?.join(",") || "none"}`
    );
    if ((backgroundReadyQueue.selected?.length ?? 0) > 0) {
      writeStdoutLine(
        `Background-ready selected: ${backgroundReadyQueue.selected
          .slice(0, 5)
          .map((entry) => `${entry.id}[${entry.queueProfile};${entry.gaps.join("|") || "no_gaps"}]`)
          .join(", ")}`
      );
    }
  }
  if (lineageGraphSummary) {
    writeStdoutLine(
      `Lineage graph: samples=${lineageGraphSummary.nodeCounts?.sample ?? 0}; edges=${Object.values(lineageGraphSummary.edgeCounts ?? {}).reduce((sum, value) => sum + value, 0)}; unresolved=${lineageGraphSummary.unresolvedCount ?? 0}; blocked=${lineageGraphSummary.blockedCount ?? 0}`
    );
  }
  if (baselineGovernance) {
    writeStdoutLine(
      `Baseline governance: closure=${baselineGovernance.baselineClosureStatus}; fully_gated=${baselineGovernance.fullyGatedBaselineCount}/${baselineGovernance.baselineSampleCount}; backlog=${baselineGovernance.baselineBacklogCount}; density=${baselineGovernance.densityStatus}`
    );
    writeStdoutLine(
      `Baseline scenarios: ${baselineGovernance.scenarioTypes
        ?.filter((entry) => entry.baselineSampleCount > 0)
        .map(
          (entry) =>
            `${entry.scenarioType}[${entry.fullyGatedBaselineCount}/${entry.baselineSampleCount};${entry.densityStatus}]`
        )
        .join(", ")}`
    );
  }
  if (regressionCoverage) {
    writeStdoutLine(
      `Regression coverage: linked=${regressionCoverage.samplesWithLinkedRegressions}/${report.scenarioStats?.totalSamples ?? 0}; layers=${JSON.stringify(regressionCoverage.byLayer ?? {})}`
    );
    if ((regressionCoverage.regressionBacklog?.length ?? 0) > 0) {
      writeStdoutLine(
        `Regression backlog: ${regressionCoverage.regressionBacklog
          .slice(0, 5)
          .map(
            (entry) => `${entry.id}[priority=${entry.priorityScore};blockers=${entry.blockerCount}]`
          )
          .join(", ")}`
      );
    }
  }
  if (traceGradeDistribution) {
    writeStdoutLine(
      `Trace grades: counts=${JSON.stringify(traceGradeDistribution.counts ?? {})}; passing=${traceGradeDistribution.passingSampleCount ?? 0}; average=${traceGradeDistribution.averageScore ?? 0}`
    );
  }
  if (matrixCoverageByAxis) {
    writeStdoutLine(`Axis coverage: ${JSON.stringify(matrixCoverageByAxis)}`);
  }
  if (promotionCandidatesByRisk) {
    writeStdoutLine(`Promotion candidates by risk: ${JSON.stringify(promotionCandidatesByRisk)}`);
  }
  if (liveProbeStability) {
    writeStdoutLine(
      `Live probe stability: counts=${JSON.stringify(liveProbeStability.counts ?? {})}; samples=${liveProbeStability.perSample?.length ?? 0}`
    );
  }
  if (freshnessDebt) {
    writeStdoutLine(
      `Freshness debt: overdue=${freshnessDebt.overdueCount ?? 0}; samples=${(freshnessDebt.overdueSamples ?? []).map((entry) => `${entry.id}:${entry.freshnessDebt?.debtDays ?? 0}`).join(", ") || "none"}`
    );
  }

  writeStdoutLine(
    `Validated runtime replay dataset: ${dataset.manifestPath} (${selectedSamples.length}/${dataset.samples.length} selected samples)`
  );
}

main();
