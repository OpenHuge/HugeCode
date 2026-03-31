import { fileURLToPath } from "node:url";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// @boundaries-ignore shared workspace test/dev config
import { aliases } from "../../vitest.aliases";

const appRoot = fileURLToPath(new URL("./", import.meta.url));
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
const desktopCoreCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopHostCore.ts", import.meta.url)
);
const desktopDpiCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopDpi.ts", import.meta.url)
);
const desktopMenuCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopMenu.ts", import.meta.url)
);
const desktopWindowCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopHostWindow.ts", import.meta.url)
);
const desktopDialogCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopHostDialogs.ts", import.meta.url)
);
const desktopUpdaterCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopUpdater.ts", import.meta.url)
);
const desktopProcessCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopProcess.ts", import.meta.url)
);
const desktopOpenerCompatEntry = fileURLToPath(
  new URL("./src/application/runtime/ports/desktopHostOpener.ts", import.meta.url)
);
const legacyDesktopEventCompatEntry = fileURLToPath(
  new URL("./src/test/shims/tauriEventCompat.ts", import.meta.url)
);
const legacyDesktopNotificationCompatEntry = fileURLToPath(
  new URL("./src/test/shims/tauriNotificationCompat.ts", import.meta.url)
);
const liquidGlassCompatEntry = fileURLToPath(
  new URL("./src/test/shims/liquidGlassCompat.ts", import.meta.url)
);
const browserOptimizeDepsInclude = [
  "lucide-react",
  "lucide-react/dist/esm/icons/chevron-right",
  "lucide-react/dist/esm/icons/chevron-up",
  "lucide-react/dist/esm/icons/file-diff",
  "react",
  "react-dom",
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
  "react-markdown",
  "remark-gfm",
  "vscode-material-icons",
] as const;

export default defineConfig({
  root: appRoot,
  plugins: [vanillaExtractPlugin()],
  optimizeDeps: {
    include: [...browserOptimizeDepsInclude],
  },
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
        find: /^@tauri-apps\/api\/core$/,
        replacement: desktopCoreCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/dpi$/,
        replacement: desktopDpiCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/event$/,
        replacement: legacyDesktopEventCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/menu$/,
        replacement: desktopMenuCompatEntry,
      },
      {
        find: /^@tauri-apps\/api\/window$/,
        replacement: desktopWindowCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-dialog$/,
        replacement: desktopDialogCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-notification$/,
        replacement: legacyDesktopNotificationCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-opener$/,
        replacement: desktopOpenerCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-process$/,
        replacement: desktopProcessCompatEntry,
      },
      {
        find: /^@tauri-apps\/plugin-updater$/,
        replacement: desktopUpdaterCompatEntry,
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
    pool: "threads",
    include: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    setupFiles: ["src/test/vitest.browser.setup.ts"],
    testTimeout: 15000,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [
        {
          browser: "chromium",
          name: "chromium",
          viewport: {
            width: 1280,
            height: 800,
          },
        },
      ],
    },
    server: {
      warmup: {
        clientFiles: [],
      },
      deps: {
        inline: ["prosemirror-model", "prosemirror-state", "prosemirror-transform"],
      },
    },
  },
});
