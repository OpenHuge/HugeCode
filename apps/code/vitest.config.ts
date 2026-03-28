import { fileURLToPath } from "node:url";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vitest/config";
// @boundaries-ignore shared workspace test/dev config
import { aliases } from "../../vitest.aliases";

const codeRuntimeHostContractEntry = fileURLToPath(
  new URL("../../packages/code-runtime-host-contract/src/index.ts", import.meta.url)
);
const codeRuntimeHostContractCanonicalEntry = fileURLToPath(
  new URL("../../packages/code-runtime-host-contract/src/codeRuntimeRpc.ts", import.meta.url)
);
const codeRuntimeHostContractCompatEntry = fileURLToPath(
  new URL("../../packages/code-runtime-host-contract/src/codeRuntimeRpcCompat.ts", import.meta.url)
);
const designSystemEntry = fileURLToPath(
  new URL("../../packages/design-system/src/index.ts", import.meta.url)
);
const designSystemStylesEntry = fileURLToPath(
  new URL("../../packages/design-system/src/styles.ts", import.meta.url)
);
const reactEntry = fileURLToPath(new URL("./node_modules/react/index.js", import.meta.url));
const reactJsxRuntimeEntry = fileURLToPath(
  new URL("./node_modules/react/jsx-runtime.js", import.meta.url)
);
const reactJsxDevRuntimeEntry = fileURLToPath(
  new URL("./node_modules/react/jsx-dev-runtime.js", import.meta.url)
);
const reactDomEntry = fileURLToPath(new URL("./node_modules/react-dom/index.js", import.meta.url));
const nodeUtilShimEntry = fileURLToPath(new URL("./src/test/shims/nodeUtil.ts", import.meta.url));
const nodeTtyShimEntry = fileURLToPath(new URL("./src/test/shims/nodeTty.ts", import.meta.url));
const tauriCoreCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/packageCompat/tauriApiCoreCompat.ts", import.meta.url)
);
const tauriDpiCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/packageCompat/tauriApiDpiCompat.ts", import.meta.url)
);
const tauriMenuCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/packageCompat/tauriApiMenuCompat.ts", import.meta.url)
);
const tauriWindowCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/packageCompat/tauriApiWindowCompat.ts", import.meta.url)
);
const tauriDialogCompatEntry = fileURLToPath(
  new URL(
    "./src/application/runtime/ports/packageCompat/tauriPluginDialogCompat.ts",
    import.meta.url
  )
);
const tauriUpdaterCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/tauriUpdater.ts", import.meta.url)
);
const tauriProcessCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/tauriProcess.ts", import.meta.url)
);
const tauriOpenerCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/tauriOpener.ts", import.meta.url)
);
const tauriEventCompatEntry = fileURLToPath(
  new URL("./src/test/shims/tauriEventCompat.ts", import.meta.url)
);
const tauriNotificationCompatEntry = fileURLToPath(
  new URL("./src/test/shims/tauriNotificationCompat.ts", import.meta.url)
);
const liquidGlassCompatEntry = fileURLToPath(
  new URL("./src/test/shims/liquidGlassCompat.ts", import.meta.url)
);
const TEST_OPTIMIZER_INCLUDE = [
  "@testing-library/react",
  "lucide-react",
  "react",
  "react-dom",
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
  "react-markdown",
  "remark-gfm",
  "vscode-material-icons",
] as const;

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: reactEntry,
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: reactJsxRuntimeEntry,
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: reactJsxDevRuntimeEntry,
      },
      {
        find: /^react-dom$/,
        replacement: reactDomEntry,
      },
      {
        find: /^node:util$/,
        replacement: nodeUtilShimEntry,
      },
      {
        find: /^util$/,
        replacement: nodeUtilShimEntry,
      },
      {
        find: /^node:tty$/,
        replacement: nodeTtyShimEntry,
      },
      {
        find: /^tty$/,
        replacement: nodeTtyShimEntry,
      },
      {
        find: /^browser-external:tty$/,
        replacement: nodeTtyShimEntry,
      },
      {
        find: /^@tauri-apps\/api\/core$/,
        replacement: tauriCoreCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/dpi$/,
        replacement: tauriDpiCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/event$/,
        replacement: tauriEventCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/menu$/,
        replacement: tauriMenuCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/window$/,
        replacement: tauriWindowCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-dialog$/,
        replacement: tauriDialogCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-notification$/,
        replacement: tauriNotificationCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-opener$/,
        replacement: tauriOpenerCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-process$/,
        replacement: tauriProcessCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-updater$/,
        replacement: tauriUpdaterCompatEntry,
      },
      {
        find: /^tauri-plugin-liquid-glass-api$/,
        replacement: liquidGlassCompatEntry,
      },
      {
        find: /^@ku0\/code-runtime-host-contract\/codeRuntimeRpc$/,
        replacement: codeRuntimeHostContractCanonicalEntry,
      },
      {
        find: /^@ku0\/code-runtime-host-contract\/codeRuntimeRpcCompat$/,
        replacement: codeRuntimeHostContractCompatEntry,
      },
      {
        find: /^@ku0\/code-runtime-host-contract$/,
        replacement: codeRuntimeHostContractEntry,
      },
      {
        find: "@ku0/design-system/styles",
        replacement: designSystemStylesEntry,
      },
      {
        find: "@ku0/design-system",
        replacement: designSystemEntry,
      },
      ...aliases,
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    setupFiles: ["src/test/vitest.setup.ts"],
    deps: {
      // Vitest recommends optimizer.client for jsdom projects with large UI dependency trees.
      optimizer: {
        client: {
          enabled: true,
          include: [...TEST_OPTIMIZER_INCLUDE],
        },
      },
    },
  },
});
