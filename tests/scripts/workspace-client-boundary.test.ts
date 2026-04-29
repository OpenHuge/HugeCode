import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function repoPathExists(relativePath: string) {
  return existsSync(path.join(repoRoot, relativePath));
}

describe("workspace client boundaries", () => {
  it("keeps retired legacy app workspaces absent", () => {
    expect(repoPathExists("apps/code")).toBe(false);
    expect(repoPathExists("apps/code-web")).toBe(false);
    expect(repoPathExists("apps/code-electron")).toBe(false);
  });

  it("exports shared runtime shell, workspace app, settings, and account-state subpaths", () => {
    const source = readRepoFile("packages/code-workspace-client/package.json");

    expect(source).toContain('"./runtime-shell"');
    expect(source).toContain('"./workspace-app"');
    expect(source).toContain('"./workspace-shell"');
    expect(source).toContain('"./settings-shell"');
    expect(source).toContain('"./settings-state"');
    expect(source).toContain('"./account-center-state"');
    expect(source).not.toContain('"./compat/codeAppWorkspaceClientBindings"');
  });

  it("keeps the shared workspace client package free of deleted app source imports", () => {
    const source = readRepoFile("packages/code-workspace-client/src/index.ts");

    expect(source).toContain("./runtime-shell/WorkspaceRuntimeShell");
    expect(source).toContain("./settings-shell");
    expect(source).not.toContain("apps/code/src/");
    expect(source).not.toContain("apps/code-web/");
    expect(source).not.toContain("apps/code-electron/");
  });

  it("routes workspace shell rendering through the shared runtime shell package", () => {
    const workspaceAppSource = readRepoFile(
      "packages/code-workspace-client/src/workspace/WorkspaceClientApp.tsx"
    );
    const applicationBindingsSource = readRepoFile(
      "packages/code-application/src/workspaceClientBindings.ts"
    );
    const desktopBootstrapSource = readRepoFile(
      "packages/code-application/src/desktopWorkspaceBootstrap.ts"
    );

    expect(workspaceAppSource).toContain("bindings.platformUi.WorkspaceRuntimeShell");
    expect(applicationBindingsSource).toContain("@ku0/code-workspace-client/runtime-shell");
    expect(applicationBindingsSource).toContain("WorkspaceRuntimeShell");
    expect(desktopBootstrapSource).toContain("createDesktopWorkspaceBootstrap");
    expect(desktopBootstrapSource).toContain("input.runtimeKernel.workspaceClientRuntimeGateway");
    expect(desktopBootstrapSource).toContain("input.runtimeKernel.workspaceClientRuntime");
  });

  it("removes legacy workspace-surface aliases from shared tooling", () => {
    const viteAliases = readRepoFile("scripts/lib/viteWorkspaceAliases.ts");
    const vitestAliases = readRepoFile("vitest.aliases.ts");

    expect(viteAliases).not.toContain("@ku0/code/workspace-surface");
    expect(vitestAliases).not.toContain("@ku0/code/workspace-surface");
  });
});
