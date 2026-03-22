#!/usr/bin/env node

import process from "node:process";

const themeValuesModulePath = new URL(
  "../apps/code/src/styles/tokens/themeValues.ts",
  import.meta.url
);

function diffSets(left, right) {
  const leftOnly = [];
  const rightOnly = [];

  for (const value of left) {
    if (!right.has(value)) {
      leftOnly.push(value);
    }
  }

  for (const value of right) {
    if (!left.has(value)) {
      rightOnly.push(value);
    }
  }

  leftOnly.sort((a, b) => a.localeCompare(b));
  rightOnly.sort((a, b) => a.localeCompare(b));

  return { leftOnly, rightOnly };
}

function toThemeEntries(themeValues) {
  return [
    ["dark", themeValues.darkThemeValues],
    ["dim", themeValues.dimThemeValues],
    ["light", themeValues.lightThemeValues],
    ["system", themeValues.systemLightThemeValues],
  ];
}

function collectThemeShapeIssues(themeEntries, tokenNameSet) {
  const issues = [];

  for (const [themeName, values] of themeEntries) {
    const valueKeys = new Set(Object.keys(values));
    const diff = diffSets(tokenNameSet, valueKeys);
    if (diff.leftOnly.length === 0 && diff.rightOnly.length === 0) {
      continue;
    }
    issues.push({ kind: "theme-values-shape", themeName, diff });
  }

  return issues;
}

function collectCrossThemeIssues(themeEntries) {
  const issues = [];
  const [darkThemeName, darkThemeValues] = themeEntries[0] ?? [];
  if (!darkThemeName || !darkThemeValues) {
    return issues;
  }

  const darkKeys = new Set(Object.keys(darkThemeValues));
  for (const [themeName, values] of themeEntries.slice(1)) {
    const diff = diffSets(darkKeys, new Set(Object.keys(values)));
    if (diff.leftOnly.length === 0 && diff.rightOnly.length === 0) {
      continue;
    }
    issues.push({ kind: "cross-theme-parity", themeName, diff });
  }

  return issues;
}

function collectReducedOverrideIssues(reducedTransparencyOverrides, tokenNameSet) {
  const issues = [];

  for (const [themeName, overrides] of Object.entries(reducedTransparencyOverrides)) {
    const nonContractKeys = Object.keys(overrides)
      .filter((tokenName) => !tokenNameSet.has(tokenName))
      .sort((a, b) => a.localeCompare(b));

    if (nonContractKeys.length === 0) {
      continue;
    }

    issues.push({
      kind: "reduced-transparency-contract",
      themeName,
      nonContractKeys,
    });
  }

  return issues;
}

function printSetDiff(label, leftName, rightName, diff) {
  if (diff.leftOnly.length > 0) {
  }
  if (diff.rightOnly.length > 0) {
  }
}

function reportIssues(issues) {
  if (issues.length === 0) {
    return;
  }

  for (const issue of issues) {
    if (issue.kind === "theme-values-shape") {
      printSetDiff(
        `${issue.themeName} values must match themeTokenNames`,
        "themeTokenNames",
        `${issue.themeName}ThemeValues`,
        issue.diff
      );
      continue;
    }

    if (issue.kind === "cross-theme-parity") {
      printSetDiff(
        `dark and ${issue.themeName} key sets must match`,
        "darkThemeValues",
        `${issue.themeName}ThemeValues`,
        issue.diff
      );
      continue;
    }
  }
}

async function loadThemeValues() {
  return import(themeValuesModulePath.href);
}

async function main() {
  const themeValues = await loadThemeValues();
  const themeEntries = toThemeEntries(themeValues);
  const tokenNameSet = new Set(themeValues.themeTokenNames);

  const issues = [
    ...collectThemeShapeIssues(themeEntries, tokenNameSet),
    ...collectCrossThemeIssues(themeEntries),
    ...collectReducedOverrideIssues(themeValues.reducedTransparencyOverrides, tokenNameSet),
  ];

  if (issues.length > 0) {
    reportIssues(issues);
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
});
