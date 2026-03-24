import { fileURLToPath } from "node:url";

type CreateWorkspaceAliasesOptions = {
  includeCodeApp?: boolean;
  codeAppRootUrl?: URL;
};

type WorkspaceAlias = {
  find: RegExp | string;
  replacement: string;
};

export function getRepoRootFromApp(appRootUrl: URL) {
  return fileURLToPath(new URL("../../", appRootUrl));
}

export function createCodeWorkspaceAliases(
  appRootUrl: URL,
  options: CreateWorkspaceAliasesOptions = {}
): WorkspaceAlias[] {
  const codeRuntimeClientEntry = fileURLToPath(
    new URL("../../packages/code-runtime-client/src/index.ts", appRootUrl)
  );
  const codeRuntimeClientSrc = fileURLToPath(
    new URL("../../packages/code-runtime-client/src", appRootUrl)
  );
  const codeRuntimeWebMcpClientEntry = fileURLToPath(
    new URL("../../packages/code-runtime-webmcp-client/src/index.ts", appRootUrl)
  );
  const codeRuntimeWebMcpClientSrc = fileURLToPath(
    new URL("../../packages/code-runtime-webmcp-client/src", appRootUrl)
  );
  const codeWorkspaceClientEntry = fileURLToPath(
    new URL("../../packages/code-workspace-client/src/index.ts", appRootUrl)
  );
  const codeWorkspaceClientSrc = fileURLToPath(
    new URL("../../packages/code-workspace-client/src", appRootUrl)
  );
  const codeWorkspaceClientAccountCenterEntry = fileURLToPath(
    new URL(
      "../../packages/code-workspace-client/src/account-center/AccountCenterDashboard.tsx",
      appRootUrl
    )
  );
  const codeWorkspaceClientRuntimeShellEntry = fileURLToPath(
    new URL(
      "../../packages/code-workspace-client/src/runtime-shell/WorkspaceRuntimeShell.tsx",
      appRootUrl
    )
  );
  const codeWorkspaceClientWorkspaceBindingsEntry = fileURLToPath(
    new URL("../../packages/code-workspace-client/src/workspace/bindings.ts", appRootUrl)
  );
  const codeWorkspaceClientWorkspaceBrowserBindingsEntry = fileURLToPath(
    new URL("../../packages/code-workspace-client/src/workspace/browserBindings.ts", appRootUrl)
  );
  const codeWorkspaceClientWorkspaceAppEntry = fileURLToPath(
    new URL("../../packages/code-workspace-client/src/workspace-app/index.ts", appRootUrl)
  );
  const codeWorkspaceClientWorkspaceNavigationEntry = fileURLToPath(
    new URL(
      "../../packages/code-workspace-client/src/workspace-shell/workspaceNavigation.ts",
      appRootUrl
    )
  );
  const codeWorkspaceClientSettingsShellEntry = fileURLToPath(
    new URL("../../packages/code-workspace-client/src/settings-shell/index.ts", appRootUrl)
  );
  const codeWorkspaceClientSettingsShellTypesEntry = fileURLToPath(
    new URL(
      "../../packages/code-workspace-client/src/settings-shell/settingsShellTypes.ts",
      appRootUrl
    )
  );
  const codeWorkspaceClientSettingsShellChromeEntry = fileURLToPath(
    new URL(
      "../../packages/code-workspace-client/src/settings-shell/SettingsModalChrome.global.css.ts",
      appRootUrl
    )
  );
  const codeRuntimeHostContractEntry = fileURLToPath(
    new URL("../../packages/code-runtime-host-contract/src/index.ts", appRootUrl)
  );
  const codeRuntimeHostContractCanonicalEntry = fileURLToPath(
    new URL("../../packages/code-runtime-host-contract/src/codeRuntimeRpc.ts", appRootUrl)
  );
  const codeRuntimeHostContractCompatEntry = fileURLToPath(
    new URL("../../packages/code-runtime-host-contract/src/codeRuntimeRpcCompat.ts", appRootUrl)
  );
  const designSystemIndex = fileURLToPath(
    new URL("../../packages/design-system/src/index.ts", appRootUrl)
  );
  const designSystemSrc = fileURLToPath(new URL("../../packages/design-system/src", appRootUrl));
  const sharedIndex = fileURLToPath(new URL("../../packages/shared/src/index.ts", appRootUrl));
  const sharedSrc = fileURLToPath(new URL("../../packages/shared/src", appRootUrl));
  const uiEntry = fileURLToPath(new URL("../../packages/ui/src/index.ts", appRootUrl));
  const uiGlobalsEntry = fileURLToPath(
    new URL("../../packages/ui/src/styles/globals.ts", appRootUrl)
  );
  const uiTokensEntry = fileURLToPath(
    new URL("../../packages/ui/src/styles/tokens.ts", appRootUrl)
  );
  const designSystemStylesEntry = fileURLToPath(
    new URL("../../packages/design-system/src/styles.ts", appRootUrl)
  );
  const reactEntry = fileURLToPath(new URL("./node_modules/react/index.js", appRootUrl));
  const reactJsxRuntimeEntry = fileURLToPath(
    new URL("./node_modules/react/jsx-runtime.js", appRootUrl)
  );
  const reactJsxDevRuntimeEntry = fileURLToPath(
    new URL("./node_modules/react/jsx-dev-runtime.js", appRootUrl)
  );
  const reactDomEntry = fileURLToPath(new URL("./node_modules/react-dom/index.js", appRootUrl));

  const aliases: WorkspaceAlias[] = [
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
      find: /^@ku0\/code-runtime-client$/,
      replacement: codeRuntimeClientEntry,
    },
    {
      find: /^@ku0\/code-runtime-client\/runtimeClientTypes$/,
      replacement: `${codeRuntimeClientSrc}/runtimeClientTypes.ts`,
    },
    {
      find: /^@ku0\/code-runtime-client\/(.+)$/,
      replacement: `${codeRuntimeClientSrc}/$1`,
    },
    {
      find: /^@ku0\/code-runtime-webmcp-client\/(.+)$/,
      replacement: `${codeRuntimeWebMcpClientSrc}/$1`,
    },
    {
      find: /^@ku0\/code-runtime-webmcp-client$/,
      replacement: codeRuntimeWebMcpClientEntry,
    },
    {
      find: /^@ku0\/code-workspace-client$/,
      replacement: codeWorkspaceClientEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/account-center$/,
      replacement: codeWorkspaceClientAccountCenterEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/runtime-shell$/,
      replacement: codeWorkspaceClientRuntimeShellEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/workspace-bindings$/,
      replacement: codeWorkspaceClientWorkspaceBindingsEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/workspace-browser-bindings$/,
      replacement: codeWorkspaceClientWorkspaceBrowserBindingsEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/workspace-app$/,
      replacement: codeWorkspaceClientWorkspaceAppEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/workspace-navigation$/,
      replacement: codeWorkspaceClientWorkspaceNavigationEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/settings-shell-types$/,
      replacement: codeWorkspaceClientSettingsShellTypesEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/settings-shell\/SettingsModalChrome\.global\.css$/,
      replacement: codeWorkspaceClientSettingsShellChromeEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/settings-shell$/,
      replacement: codeWorkspaceClientSettingsShellEntry,
    },
    {
      find: /^@ku0\/code-workspace-client\/(.+)$/,
      replacement: `${codeWorkspaceClientSrc}/$1`,
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
      find: /^@ku0\/ui\/styles\/globals$/,
      replacement: uiGlobalsEntry,
    },
    {
      find: /^@ku0\/ui\/styles\/tokens$/,
      replacement: uiTokensEntry,
    },
    {
      find: /^@ku0\/design-system\/styles$/,
      replacement: designSystemStylesEntry,
    },
    {
      find: /^@ku0\/design-system$/,
      replacement: designSystemIndex,
    },
    {
      find: /^@ku0\/design-system\/(.+)$/,
      replacement: `${designSystemSrc}/$1`,
    },
    {
      find: /^@ku0\/shared$/,
      replacement: sharedIndex,
    },
    {
      find: /^@ku0\/shared\/(.+)$/,
      replacement: `${sharedSrc}/$1`,
    },
    {
      find: /^@ku0\/ui$/,
      replacement: uiEntry,
    },
  ];

  if (options.includeCodeApp === true) {
    const codeAppRootUrl = options.codeAppRootUrl ?? appRootUrl;
    const codeAppSrc = fileURLToPath(new URL("./src", codeAppRootUrl));
    aliases.push({
      find: /^@ku0\/code-app$/,
      replacement: codeAppSrc,
    });
    aliases.push({
      find: /^@ku0\/code-app\/(.+)$/,
      replacement: `${codeAppSrc}/$1`,
    });
  }

  return aliases;
}
