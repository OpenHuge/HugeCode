/*
 * Deprecated runtime theme source.
 * Frozen for compatibility during the design-system runtime migration.
 * Do not import from runtime entrypoints or new code.
 * This is the only runtime installer allowed to consume themeContract/themeValues.
 */
import { assignVars, createGlobalTheme, globalStyle } from "@vanilla-extract/css";
import { layers } from "../system/layers.css";
import { themeContract } from "./themeContract.css";
import {
  darkThemeValues,
  dimThemeValues,
  lightThemeValues,
  reducedTransparencyOverrides,
  rootBaseStyles,
  systemLightThemeValues,
  themeModeStyles,
  toContractValueMap,
  toGlobalOverrideMap,
} from "./themeValues";

createGlobalTheme(":root", themeContract, toContractValueMap(darkThemeValues));
createGlobalTheme(':root[data-theme="dim"]', themeContract, toContractValueMap(dimThemeValues));
createGlobalTheme(':root[data-theme="light"]', themeContract, toContractValueMap(lightThemeValues));

globalStyle(":root", {
  "@layer": {
    [layers.tokens]: rootBaseStyles,
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);

globalStyle(':root[data-theme="dark"]', {
  "@layer": {
    [layers.tokens]: themeModeStyles.dark,
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);

globalStyle(':root[data-theme="dim"]', {
  "@layer": {
    [layers.tokens]: themeModeStyles.dim,
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);

globalStyle(':root[data-theme="light"]', {
  "@layer": {
    [layers.tokens]: themeModeStyles.light,
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);

globalStyle(":root:not([data-theme])", {
  "@layer": {
    [layers.tokens]: {
      "@media": {
        "(prefers-color-scheme: light)": {
          ...themeModeStyles.system,
          vars: assignVars(themeContract, toContractValueMap(systemLightThemeValues)),
        },
      },
    },
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);

globalStyle(':root[data-theme="dim"] .app.reduced-transparency', {
  "@layer": {
    [layers.tokens]: toGlobalOverrideMap(reducedTransparencyOverrides.dim),
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);

globalStyle(':root[data-theme="light"] .app.reduced-transparency', {
  "@layer": {
    [layers.tokens]: toGlobalOverrideMap(reducedTransparencyOverrides.light),
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);

globalStyle(":root:not([data-theme]) .app.reduced-transparency", {
  "@layer": {
    [layers.tokens]: {
      "@media": {
        "(prefers-color-scheme: light)": toGlobalOverrideMap(reducedTransparencyOverrides.system),
      },
    },
  },
} as unknown as import("@vanilla-extract/css").GlobalStyleRule);
