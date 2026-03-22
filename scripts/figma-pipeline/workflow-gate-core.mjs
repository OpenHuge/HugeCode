function missingRequiredArtifacts(artifacts = {}) {
  return Object.entries({
    classifiedNodeGraph: artifacts.classifiedNodeGraph,
    primitiveTokens: artifacts.primitiveTokens,
    semanticTokens: artifacts.semanticTokens,
    componentSpecs: artifacts.componentSpecs,
    qaReport: artifacts.qaReport,
    codegenReport: artifacts.codegenReport,
  })
    .filter(([, present]) => !present)
    .map(([name]) => name);
}

function hasCompleteOfflineRun(run) {
  return Boolean(
    run?.ok &&
    run?.summary?.failures === 0 &&
    Number(run?.summary?.freshFetches ?? 0) === 0 &&
    Number(run?.summary?.localMaterializations ?? 0) > 0
  );
}

function hasStableCacheRepeat(run) {
  return Boolean(
    run?.ok &&
    run?.summary?.failures === 0 &&
    Number(run?.summary?.freshFetches ?? 0) === 0 &&
    Number(run?.summary?.cacheHits ?? 0) > 0
  );
}

export function evaluateWorkflowGate(input) {
  const blockers = [];
  const risks = [];
  const notes = [];

  if (!input?.smoke?.ok) {
    blockers.push(
      "UI bridge smoke failed, so export/download/send/clipboard round-trip is not reliable."
    );
  }

  if (!hasCompleteOfflineRun(input?.focusFetch?.localSplitA)) {
    blockers.push(
      "Offline focus-fetch could not materialize focused artifacts from a local root export without online fallback."
    );
  }

  if (!hasCompleteOfflineRun(input?.focusFetch?.localSplitB)) {
    blockers.push(
      "Repeated offline local split from the same root export was not stable enough to reproduce focused artifacts."
    );
  }

  if (!hasStableCacheRepeat(input?.focusFetch?.cacheRepeat)) {
    blockers.push(
      "Offline repeat run did not resolve entirely through focused-artifact cache, so daily development would still depend on regeneration or network."
    );
  }

  if (!input?.focusFetch?.digestStable) {
    blockers.push("Repeated local splits produced different focused artifact payloads.");
  }

  for (const developResult of input?.develop ?? []) {
    if (!developResult?.ok) {
      blockers.push(`${developResult.family} develop pipeline did not complete successfully.`);
      continue;
    }

    const missingArtifacts = missingRequiredArtifacts(developResult.artifacts);
    if (missingArtifacts.length > 0) {
      blockers.push(
        `${developResult.family} is missing required pipeline artifacts: ${missingArtifacts.join(", ")}.`
      );
    }

    if (developResult?.qa?.status !== "pass" || Number(developResult?.qa?.blockers ?? 0) > 0) {
      blockers.push(`${developResult.family} QA report is not in a shippable state.`);
    }

    if (Number(developResult?.structure?.slotCount ?? 0) === 0) {
      blockers.push(
        `${developResult.family} component spec does not expose usable slots for implementation.`
      );
    }

    const stateCount =
      Number(developResult?.structure?.persistentStateCount ?? 0) +
      Number(developResult?.structure?.interactionStateCount ?? 0);
    if (stateCount === 0) {
      risks.push(
        `${developResult.family} relies on weak state inference only; implementation should stay conservative.`
      );
    }

    if (Number(developResult?.semantic?.coverage ?? 0) < 0.2) {
      risks.push(
        `${developResult.family} semantic token coverage is low (${developResult?.semantic?.coverage ?? 0}), so token mapping still needs manual review.`
      );
    }

    if (Number(developResult?.variantModel?.axisCount ?? 0) === 0) {
      risks.push(
        `${developResult.family} has no source-derived variant axes, so family-wide variant changes should remain out of scope.`
      );
    }
  }

  if (
    input?.focusFetch?.localSplitA?.summary?.freshFetches ||
    input?.focusFetch?.localSplitB?.summary?.freshFetches
  ) {
    blockers.push("Offline local split unexpectedly performed fresh remote fetches.");
  }

  if (input?.focusFetch?.cacheRepeat?.summary?.freshFetches) {
    blockers.push("Offline cache repeat unexpectedly performed fresh remote fetches.");
  }

  if (blockers.length === 0) {
    notes.push(
      "Offline focus-fetch, local split repeatability, cache reuse, and UI bridge smoke all satisfied the gate."
    );
  }

  if ((input?.develop ?? []).length === 0) {
    blockers.push("No focused component families were verified through the develop pipeline.");
  }

  return {
    decision: blockers.length === 0 ? "go" : "no-go",
    status:
      blockers.length > 0
        ? "workflow-blocked"
        : risks.length > 0
          ? "workflow-ready-with-caveats"
          : "workflow-ready",
    blockers,
    risks,
    notes,
  };
}
