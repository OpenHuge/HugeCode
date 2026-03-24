/**
 * Vitest alias configuration for workspace packages.
 *
 * This file centralizes all package aliases used by Vitest.
 * Aliases are ordered so that subpaths are matched before their parent packages.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type AliasEntry = { find: RegExp | string; replacement: string };

export const aliases: AliasEntry[] = [
  // ============================================
  // Subpath exports (must come before parent packages)
  // ============================================

  // @ku0/shared subpaths
  {
    find: "@ku0/code/workspace-surface",
    replacement: path.resolve(__dirname, "apps/code/src/MainAppContainerCore.tsx"),
  },
  {
    find: "@ku0/code-runtime-client/runtimeClientTypes",
    replacement: path.resolve(__dirname, "packages/code-runtime-client/src/runtimeClientTypes.ts"),
  },
  {
    find: /^@ku0\/code-runtime-client\/(.+)$/,
    replacement: path.resolve(__dirname, "packages/code-runtime-client/src/$1"),
  },
  {
    find: /^@ku0\/code-runtime-webmcp-client\/(.+)$/,
    replacement: path.resolve(__dirname, "packages/code-runtime-webmcp-client/src/$1"),
  },
  {
    find: "@ku0/code-workspace-client/account-center",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/account-center/AccountCenterDashboard.tsx"
    ),
  },
  {
    find: "@ku0/code-workspace-client/runtime-shell",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/runtime-shell/WorkspaceRuntimeShell.tsx"
    ),
  },
  {
    find: "@ku0/code-workspace-client/workspace-bindings",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/workspace/bindings.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/workspace-browser-bindings",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/workspace/browserBindings.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/workspace-app",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/workspace-app/index.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/workspace-navigation",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/workspace-shell/workspaceNavigation.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/workspace-shell",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/workspace-shell/index.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/settings-shell-types",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/settings-shell/settingsShellTypes.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/settings-shell/SettingsModalChrome.global.css",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/settings-shell/SettingsModalChrome.global.css.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/settings-shell",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/settings-shell/index.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/settings-state",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/settings-state/index.ts"
    ),
  },
  {
    find: "@ku0/code-workspace-client/account-center-state",
    replacement: path.resolve(
      __dirname,
      "packages/code-workspace-client/src/account-center/accountCenterState.ts"
    ),
  },
  {
    find: /^@ku0\/code-workspace-client\/(.+)$/,
    replacement: path.resolve(__dirname, "packages/code-workspace-client/src/$1"),
  },
  {
    find: "@ku0/design-system/styles",
    replacement: path.resolve(__dirname, "packages/design-system/src/styles.ts"),
  },
  {
    find: "@ku0/shared/utils",
    replacement: path.resolve(__dirname, "packages/shared/src/utils/index.ts"),
  },
  {
    find: "@ku0/shared/runtimeGatewayEnv",
    replacement: path.resolve(__dirname, "packages/shared/src/runtimeGatewayEnv.ts"),
  },
  {
    find: /^@ku0\/shared\/(.+)$/,
    replacement: path.resolve(__dirname, "packages/shared/src/$1"),
  },
  {
    find: "@ku0/shared/ui/chat",
    replacement: path.resolve(__dirname, "packages/shared/src/ui/chat/index.ts"),
  },
  {
    find: "@ku0/shared/ui/motion",
    replacement: path.resolve(__dirname, "packages/shared/src/ui/motion.ts"),
  },
  {
    find: "@ku0/shared/ui/nav",
    replacement: path.resolve(__dirname, "packages/shared/src/ui/nav/index.ts"),
  },
  {
    find: "@ku0/ui/styles/globals",
    replacement: path.resolve(__dirname, "packages/ui/src/styles/globals.ts"),
  },
  {
    find: "@ku0/ui/styles/tokens",
    replacement: path.resolve(__dirname, "packages/ui/src/styles/tokens.ts"),
  },
  {
    find: "@ku0/design-system/styles",
    replacement: path.resolve(__dirname, "packages/design-system/src/styles.ts"),
  },
  {
    find: "@ku0/ui/web-api",
    replacement: path.resolve(__dirname, "packages/ui/src/web-api.ts"),
  },

  // @ku0/native-bindings subpaths
  {
    find: "@ku0/native-bindings/flags",
    replacement: path.resolve(__dirname, "packages/native-bindings/src/flags.ts"),
  },
  {
    find: "@ku0/native-bindings/testing",
    replacement: path.resolve(__dirname, "packages/native-bindings/src/testing/index.ts"),
  },
  {
    find: "@ku0/native-bindings/node",
    replacement: path.resolve(__dirname, "packages/native-bindings/src/node.ts"),
  },

  {
    find: "@ku0/model-fabric-rs/node",
    replacement: path.resolve(__dirname, "packages/model-fabric-rs/src/node.ts"),
  },

  // ============================================
  // Main packages (alphabetical order)
  // ============================================
  {
    find: /^@ku0\/code-runtime-client$/,
    replacement: path.resolve(__dirname, "packages/code-runtime-client/src/index.ts"),
  },
  {
    find: /^@ku0\/code-runtime-webmcp-client$/,
    replacement: path.resolve(__dirname, "packages/code-runtime-webmcp-client/src/index.ts"),
  },
  {
    find: /^@ku0\/code-workspace-client$/,
    replacement: path.resolve(__dirname, "packages/code-workspace-client/src/index.ts"),
  },
  {
    find: "@ku0/design-system",
    replacement: path.resolve(__dirname, "packages/design-system/src/index.ts"),
  },
  {
    find: "@ku0/design-system",
    replacement: path.resolve(__dirname, "packages/design-system/src/index.ts"),
  },
  {
    find: "@ku0/model-fabric-rs",
    replacement: path.resolve(__dirname, "packages/model-fabric-rs/src/index.ts"),
  },
  {
    find: "@ku0/native-bindings",
    replacement: path.resolve(__dirname, "packages/native-bindings/src/index.ts"),
  },
  {
    find: "@ku0/shared",
    replacement: path.resolve(__dirname, "packages/shared/src/index.ts"),
  },
  {
    find: "@ku0/translator",
    replacement: path.resolve(__dirname, "packages/translator/src/index.ts"),
  },
  {
    find: "@ku0/ui",
    replacement: path.resolve(__dirname, "packages/ui/src/index.ts"),
  },
  {
    find: "@ku0/vector-similarity-rs",
    replacement: path.resolve(__dirname, "packages/vector-similarity-rs/src/index.ts"),
  },

  // ============================================
  // App aliases
  // ============================================
  {
    find: "@",
    replacement: path.resolve(__dirname, "apps/code/src"),
  },
];
