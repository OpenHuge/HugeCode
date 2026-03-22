import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(existingConfig) {
    return mergeConfig(existingConfig, {
      build: {
        chunkSizeWarningLimit: 1300,
      },
      plugins: [vanillaExtractPlugin()],
    });
  },
} satisfies StorybookConfig;

export default config;
