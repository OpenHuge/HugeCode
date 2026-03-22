import { comfortableDensityVars, compactDensityVars, themeTokenNames } from "./themeValues";

const themeTokenContract = Object.freeze(
  Object.fromEntries(themeTokenNames.map((tokenName) => [tokenName, null])) as Record<
    (typeof themeTokenNames)[number],
    null
  >
);

export const themeContract = Object.freeze({
  light: themeTokenContract,
  dark: themeTokenContract,
  dim: themeTokenContract,
  system: themeTokenContract,
  density: {
    compact: Object.keys(compactDensityVars),
    comfortable: Object.keys(comfortableDensityVars),
  },
});
