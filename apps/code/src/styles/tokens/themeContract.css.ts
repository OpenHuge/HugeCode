/*
 * Deprecated runtime theme source.
 * Frozen for compatibility during the design-system runtime migration.
 * Do not import from runtime entrypoints or new code.
 * Only themes.css.ts may import this file.
 */
import { createGlobalThemeContract } from "@vanilla-extract/css";
import { themeTokenNames } from "./themeValues";

const contractShape = Object.fromEntries(
  themeTokenNames.map((tokenName) => [tokenName, null])
) as Record<string, null>;

export const themeContract = createGlobalThemeContract(
  contractShape,
  (_value, path) => `--${path.join("-")}`
);
