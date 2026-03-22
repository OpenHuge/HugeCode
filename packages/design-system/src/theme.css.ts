import { type GlobalStyleRule, globalStyle } from "@vanilla-extract/css";
import {
  comfortableDensityVars,
  compactDensityVars,
  darkThemeVars,
  dimThemeVars,
  lightThemeVars,
  systemDarkThemeVars,
  systemLightThemeVars,
} from "./themeValues";

globalStyle(":root", {
  ...systemLightThemeVars,
  colorScheme: "light dark",
});

globalStyle("html:root:not([data-theme])", {
  ...systemLightThemeVars,
  colorScheme: "light",
});

globalStyle("html:root:not([data-theme])", {
  "@media": {
    "(prefers-color-scheme: dark)": {
      ...systemDarkThemeVars,
      colorScheme: "dark",
    },
  },
});

globalStyle(':root[data-theme="dark"], .dark', {
  ...darkThemeVars,
  colorScheme: "dark",
});

globalStyle(':root[data-theme="dim"], .dim', {
  ...dimThemeVars,
  colorScheme: "dark",
});

globalStyle(':root[data-theme="light"], .light', {
  ...lightThemeVars,
  colorScheme: "light",
});

globalStyle('[data-density="compact"]', compactDensityVars as GlobalStyleRule);

globalStyle('[data-density="comfortable"]', comfortableDensityVars as GlobalStyleRule);
