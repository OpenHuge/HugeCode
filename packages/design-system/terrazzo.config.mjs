import { defineConfig } from "@terrazzo/cli";
import css from "@terrazzo/plugin-css";
import js from "@terrazzo/plugin-js";
import vanillaExtract from "@terrazzo/plugin-vanilla-extract";

export default defineConfig({
  tokens: [
    "./tokens/primitives/colors.tokens.json",
    "./tokens/primitives/motion.tokens.json",
    "./tokens/primitives/radius.tokens.json",
    "./tokens/primitives/space.tokens.json",
    "./tokens/primitives/typography.tokens.json",
    "./tokens/semantic/common.tokens.json",
    "./tokens/semantic/light.tokens.json",
  ],
  outDir: "./src/generated",
  plugins: [
    css({
      skipBuild: true,
      variableName: (token) => `ds-${token.id.replace(/\./gu, "-")}`,
    }),
    js({
      js: "terrazzo-light-tokens.js",
      deep: true,
    }),
    vanillaExtract({
      filename: "terrazzo-light.css.ts",
      globalThemes: {
        lightTheme: {
          selector: ":root",
          mode: ".",
        },
      },
    }),
  ],
});
