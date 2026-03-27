import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("workspace client boundaries", () => {
  it("loads the shared workspace client package from apps/code-web through a web host adapter", () => {
    const adapterSource = readRepoFile(
      "apps/code-web/app/components/createWebWorkspaceClientBindings.tsx"
    );
    const routerSource = readRepoFile("apps/code-web/app/router.tsx");

    expect(adapterSource).toContain("@ku0/code-workspace-client");
    expect(routerSource).toContain("createWebWorkspaceClientBindings");
    expect(adapterSource).not.toContain(
      "@ku0/code-workspace-client/compat/codeAppWorkspaceClientBindings"
    );
  });

  it("loads the shared workspace client package from apps/code through a desktop host adapter", () => {
    const source = readRepoFile("apps/code/src/App.tsx");

    expect(source).toContain("./web/WorkspaceClientEntry");
    expect(source).not.toContain(
      "@ku0/code-workspace-client/compat/codeAppWorkspaceClientBindings"
    );
  });

  it("routes the desktop workspace app through the shared workspace client entry", () => {
    const appSource = readRepoFile("apps/code/src/App.tsx");
    const entrySource = readRepoFile("apps/code/src/web/WorkspaceClientEntry.tsx");
    const bootstrapSource = readRepoFile(
      "packages/code-application/src/desktopWorkspaceBootstrap.ts"
    );

    expect(appSource).toContain("./web/WorkspaceClientEntry");
    expect(appSource).not.toContain("./web/WorkspaceAppBridge");
    expect(entrySource).toContain("WorkspaceClientBoot");
    expect(entrySource).toContain("@ku0/code-application");
    expect(entrySource).toContain("createDesktopWorkspaceBootstrap");
    expect(bootstrapSource).toContain("createDesktopWorkspaceClientBindings");
  });

  it("keeps the web adapter focused on binding composition instead of inline runtime transport", () => {
    const source = readRepoFile(
      "apps/code-web/app/components/createWebWorkspaceClientBindings.tsx"
    );

    expect(source).toContain("createSharedWebWorkspaceClientBindings");
    expect(source).not.toContain("createBrowserWorkspaceClientRuntimeGatewayBindings()");
    expect(source).not.toContain("createBrowserWorkspaceClientRuntimeBindings()");
    expect(source).not.toContain("createBrowserWorkspaceClientHostBindings()");
    expect(source).not.toContain("fetch(");
  });

  it("uses runtime and host domain slices instead of legacy empty binding buckets", () => {
    const desktopSource = readRepoFile("apps/code/src/web/WorkspaceClientEntry.tsx");
    const webSource = readRepoFile(
      "apps/code-web/app/components/createWebWorkspaceClientBindings.tsx"
    );
    const bootstrapSource = readRepoFile(
      "packages/code-application/src/desktopWorkspaceBootstrap.ts"
    );
    const sharedBindingsSource = readRepoFile(
      "packages/code-application/src/workspaceClientBindings.ts"
    );
    const kernelSource = readRepoFile(
      "apps/code/src/application/runtime/kernel/createRuntimeKernel.ts"
    );

    expect(desktopSource).toContain("createDesktopWorkspaceBootstrap");
    expect(desktopSource).toContain("runtimeKernel,");
    expect(desktopSource).toContain("openExternalUrl:");
    expect(desktopSource).toContain("waitForOauthBinding:");
    expect(desktopSource).toContain("testSystemNotification:");
    expect(desktopSource).not.toContain("dialogs:");
    expect(desktopSource).not.toContain("opener:");
    expect(desktopSource).not.toContain("menu:");
    expect(desktopSource).not.toContain("window:");
    expect(desktopSource).not.toContain("nativeFiles:");
    expect(desktopSource).not.toContain("updater:");
    expect(bootstrapSource).toContain("createDesktopWorkspaceClientBindings");
    expect(bootstrapSource).toContain(
      "runtimeGateway: input.runtimeKernel.workspaceClientRuntimeGateway"
    );
    expect(bootstrapSource).toContain("runtime: input.runtimeKernel.workspaceClientRuntime");
    expect(kernelSource).toContain("createWorkspaceClientRuntimeBindings");
    expect(kernelSource).toContain("workspaceClientRuntimeGateway:");
    expect(kernelSource).toContain("workspaceClientRuntime,");
    expect(webSource).not.toContain("runtimeGateway:");
    expect(webSource).not.toContain("runtime:");
    expect(webSource).not.toContain("host:");
    expect(sharedBindingsSource).toContain("runtimeGateway:");
    expect(sharedBindingsSource).toContain("runtime:");
    expect(sharedBindingsSource).toContain("host:");
    expect(sharedBindingsSource).toContain("createBrowserWorkspaceClientRuntimeBindings()");
    expect(sharedBindingsSource).toContain("createBrowserWorkspaceClientHostBindings()");
  });

  it("exports shared runtime shell, workspace app, settings, and account-state subpaths without code-app compat exports", () => {
    const source = readRepoFile("packages/code-workspace-client/package.json");

    expect(source).toContain('"./runtime-shell"');
    expect(source).toContain('"./workspace-app"');
    expect(source).toContain('"./workspace-shell"');
    expect(source).toContain('"./settings-shell"');
    expect(source).toContain('"./settings-state"');
    expect(source).toContain('"./account-center-state"');
    expect(source).not.toContain('"./compat/codeAppWorkspaceClientBindings"');
  });

  it("keeps the shared workspace client package free of apps/code source imports", () => {
    const source = readRepoFile("packages/code-workspace-client/src/index.ts");

    expect(source).toContain("./runtime-shell/WorkspaceRuntimeShell");
    expect(source).toContain("./settings-shell");
    expect(source).not.toContain("apps/code/src/");
  });

  it("loads the workspace app from the shared runtime shell instead of host callbacks", () => {
    const source = readRepoFile(
      "packages/code-workspace-client/src/runtime-shell/WorkspaceRuntimeShell.tsx"
    );

    expect(source).toContain("../workspace-app/WorkspaceApp");
    expect(source).not.toContain("loadWorkspaceAppContent");
  });

  it("stops exporting shared workspace surfaces from apps/code", () => {
    const source = readRepoFile("apps/code/package.json");

    expect(source).not.toContain('"./workspace-surface"');
    expect(source).not.toContain('"./main-app"');
    expect(source).not.toContain('"./workspace-host"');
  });

  it("loads account center from the shared workspace client package", () => {
    const source = readRepoFile("apps/code-web/app/routes/account.lazy.tsx");

    expect(source).toContain("@ku0/code-workspace-client");
    expect(source).toContain("Route.useRouteContext()");
    expect(source).toContain("WorkspaceClientBindingsProvider");
    expect(source).not.toContain("@ku0/code-workspace-client/compat/codeAppAccountCenter");
    expect(source).not.toContain("../../../code/src/features/settings/components/account-center");
  });

  it("uses the shared workspace shell as the web workspace surface", () => {
    const source = readRepoFile(
      "apps/code-web/app/components/createWebWorkspaceClientBindings.tsx"
    );

    expect(source).toContain("@ku0/code-application");
    expect(source).not.toContain("@ku0/code/workspace-surface");
  });

  it("removes legacy workspace-surface aliases from web and test tooling", () => {
    const webTsconfig = readRepoFile("apps/code-web/tsconfig.json");
    const viteAliases = readRepoFile("scripts/lib/viteWorkspaceAliases.ts");
    const vitestAliases = readRepoFile("vitest.aliases.ts");

    expect(webTsconfig).not.toContain("@ku0/code/workspace-surface");
    expect(viteAliases).not.toContain("@ku0/code/workspace-surface");
    expect(vitestAliases).not.toContain("@ku0/code/workspace-surface");
  });
});
