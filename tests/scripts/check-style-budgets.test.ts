import { describe, expect, it } from "vitest";
import {
  buildProfileRuleFailures,
  buildRegressionFailures,
  resolveAdaptiveLineGrowthAllowance,
  resolveRegressionTolerance,
} from "../../scripts/check-style-budgets.mjs";

describe("check-style-budgets", () => {
  it("allows small style line-count growth within the regression tolerance window", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_100,
        globalStyleCount: 414,
        styleTotalLines: 14_380,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
      },
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
      }
    );

    expect(failures).toEqual([]);
  });

  it("fails when style line-count growth exceeds the tolerance window", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_250,
        globalStyleCount: 414,
        styleTotalLines: 14_450,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
      },
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
      }
    );

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("styleTotalLinesAll regressed"),
        expect.stringContaining("styleTotalLines regressed"),
      ])
    );
  });

  it("allows additional line growth when new style files and modules are added", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_520,
        globalStyleCount: 414,
        styleTotalLines: 14_660,
        styleFileCountAll: 116,
        styleFileCount: 64,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 63,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
      },
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        styleFileCountAll: 114,
        styleFileCount: 62,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
      }
    );

    expect(failures).toEqual([]);
  });

  it("still fails when line growth greatly exceeds the adaptive allowance", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 20_050,
        globalStyleCount: 414,
        styleTotalLines: 14_980,
        styleFileCountAll: 116,
        styleFileCount: 64,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 63,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
      },
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        styleFileCountAll: 114,
        styleFileCount: 62,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
      }
    );

    expect(failures).toEqual(
      expect.arrayContaining([expect.stringContaining("adaptive allowance")])
    );
  });

  it("allows small structural counter growth within the regression window", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 428,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
      },
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
      }
    );

    expect(failures).toEqual([]);
  });

  it("fails when structural counter growth exceeds the regression window", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 430,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
      },
      {
        globalStyleCountAll: 421,
        styleTotalLinesAll: 19_003,
        globalStyleCount: 414,
        styleTotalLines: 14_305,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 60,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
      }
    );

    expect(failures).toEqual(
      expect.arrayContaining([expect.stringContaining("globalStyleCountAll regressed")])
    );
  });

  it("uses the larger of the absolute and percentage tolerance", () => {
    expect(resolveRegressionTolerance("styleTotalLinesAll", 19_003)).toBe(160);
    expect(resolveRegressionTolerance("styleTotalLines", 14_305)).toBe(120);
    expect(resolveRegressionTolerance("styleTotalLines", 30_000)).toBe(150);
    expect(resolveRegressionTolerance("globalStyleCountAll", 421)).toBe(8);
  });

  it("derives adaptive style-line allowance from new style files and modules", () => {
    expect(
      resolveAdaptiveLineGrowthAllowance(
        "styleTotalLinesAll",
        {
          styleFileCountAll: 116,
          localStyleModuleCount: 63,
        },
        {
          styleFileCountAll: 114,
          localStyleModuleCount: 60,
          styleTotalLinesAll: 19_003,
          styleTotalLines: 14_305,
        }
      )
    ).toBe(841);
    expect(
      resolveAdaptiveLineGrowthAllowance(
        "styleTotalLines",
        {
          styleFileCount: 64,
          localStyleModuleCount: 63,
        },
        {
          styleFileCount: 62,
          localStyleModuleCount: 60,
          styleTotalLines: 14_305,
        }
      )
    ).toBe(400);
  });

  it("scales repo-wide adaptive allowance from local module density instead of total style-file density", () => {
    expect(
      resolveAdaptiveLineGrowthAllowance(
        "styleTotalLinesAll",
        {
          styleFileCountAll: 123,
          localStyleModuleCount: 79,
        },
        {
          styleFileCountAll: 118,
          localStyleModuleCount: 73,
          styleTotalLinesAll: 22_095,
        }
      )
    ).toBe(1779);
  });

  it("lets regression budgets scale with baseline averages for repo-wide style growth", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 300,
        styleTotalLinesAll: 23_299,
        globalStyleCount: 287,
        styleTotalLines: 14_226,
        styleFileCountAll: 122,
        styleFileCount: 62,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 78,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
      },
      {
        globalStyleCountAll: 368,
        styleTotalLinesAll: 22_095,
        globalStyleCount: 355,
        styleTotalLines: 15_029,
        styleFileCountAll: 118,
        styleFileCount: 64,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 73,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
      }
    );

    expect(failures).toEqual([]);
  });

  it("derives release profile budgets from baseline instead of fixed totals", () => {
    const failures = buildProfileRuleFailures(
      {
        globalStyleCountAll: 300,
        styleTotalLinesAll: 23_299,
        globalStyleCount: 287,
        styleTotalLines: 14_226,
        globalStyleCountAllRaw: 321,
        styleTotalLinesAllRaw: 29_453,
        duplicateSelectorCountAllRaw: 0,
        styleFileCountAll: 122,
        styleFileCount: 62,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 78,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [],
        oversizedCssTsFilesAllRaw: [],
      },
      {
        globalStyleCountAll: 368,
        styleTotalLinesAll: 22_095,
        globalStyleCount: 355,
        styleTotalLines: 15_029,
        globalStyleCountAllRaw: 402,
        styleTotalLinesAllRaw: 28_400,
        duplicateSelectorCountAllRaw: 0,
        styleFileCountAll: 118,
        styleFileCount: 64,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 73,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 0,
        oversizedCssTsFilesAllRaw: [],
      },
      {
        toleranceScale: 2,
        adaptiveScale: 1.25,
        includeRawMetrics: true,
      }
    );

    expect(failures).toEqual([]);
  });

  it("fails when a new oversized managed style file appears even if the count stays flat", () => {
    const failures = buildRegressionFailures(
      {
        globalStyleCountAll: 300,
        styleTotalLinesAll: 22_095,
        globalStyleCount: 287,
        styleTotalLines: 15_029,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 73,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [
          {
            filePath: "apps/code/src/features/new/NewPanel.styles.css.ts",
            lines: 930,
          },
        ],
      },
      {
        globalStyleCountAll: 300,
        styleTotalLinesAll: 22_095,
        globalStyleCount: 287,
        styleTotalLines: 15_029,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 73,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 1,
        oversizedCssTsFilesAll: [
          {
            filePath: "apps/code/src/features/existing/ExistingPanel.styles.css.ts",
            lines: 910,
          },
        ],
      }
    );

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("oversizedCssTsFilesAll introduced"),
        expect.stringContaining("NewPanel.styles.css.ts"),
      ])
    );
  });

  it("fails when a baseline-accepted oversized managed style file keeps growing", () => {
    const failures = buildProfileRuleFailures(
      {
        globalStyleCountAll: 300,
        styleTotalLinesAll: 22_095,
        globalStyleCount: 287,
        styleTotalLines: 15_029,
        globalStyleCountAllRaw: 321,
        styleTotalLinesAllRaw: 28_400,
        duplicateSelectorCountAllRaw: 0,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 73,
        oversizedStyleFiles: [],
        oversizedCssTsFilesAll: [
          {
            filePath: "apps/code/src/features/composer/components/ComposerMetaBar.styles.css.ts",
            lines: 1_120,
          },
        ],
        oversizedCssTsFilesAllRaw: [
          {
            filePath: "apps/code/src/features/composer/components/ComposerMetaBar.styles.css.ts",
            lines: 1_120,
          },
        ],
      },
      {
        globalStyleCountAll: 300,
        styleTotalLinesAll: 22_095,
        globalStyleCount: 287,
        styleTotalLines: 15_029,
        globalStyleCountAllRaw: 321,
        styleTotalLinesAllRaw: 28_400,
        duplicateSelectorCountAllRaw: 0,
        bridgeStyleFileCount: 0,
        buttonWithoutTypeCount: 0,
        duplicateSelectorCountAll: 0,
        duplicateSelectorCount: 0,
        localStyleModuleCount: 73,
        oversizedStyleFilesCount: 0,
        oversizedCssTsFilesAllCount: 1,
        oversizedCssTsFilesAll: [
          {
            filePath: "apps/code/src/features/composer/components/ComposerMetaBar.styles.css.ts",
            lines: 1_086,
          },
        ],
        oversizedCssTsFilesAllRaw: [
          {
            filePath: "apps/code/src/features/composer/components/ComposerMetaBar.styles.css.ts",
            lines: 1_086,
          },
        ],
      },
      {
        toleranceScale: 2,
        adaptiveScale: 1.25,
        includeRawMetrics: true,
      }
    );

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("oversizedCssTsFilesAll grew"),
        expect.stringContaining("ComposerMetaBar.styles.css.ts"),
        expect.stringContaining("oversizedCssTsFilesAllRaw grew"),
      ])
    );
  });
});
