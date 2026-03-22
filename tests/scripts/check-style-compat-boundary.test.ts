import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { compatAliasFamilies } from "../../scripts/lib/style-compat-config.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-style-compat-boundary.mjs",
  "scripts/lib/style-compat-config.mjs",
];

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

function runGuard(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "check-style-compat-boundary.mjs"), "--root", targetRoot],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-style-compat-boundary", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("keeps shared compat token families owned by the shared design system", () => {
    const ownerByFamily = new Map(compatAliasFamilies.map((entry) => [entry.family, entry.owner]));

    expect(ownerByFamily.get("--ds-modal-")).toBe("@ku0/design-system");
    expect(ownerByFamily.get("--ds-panel-")).toBe("@ku0/design-system");
    expect(ownerByFamily.get("--ds-popover-")).toBe("@ku0/design-system");
    expect(ownerByFamily.get("--ds-select-")).toBe("@ku0/design-system");
  });

  it("passes when runtime imports only approved compat layers and aliases stay within approved families", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(
      runtimeStylePath,
      ['import "./ds-modal.css";', 'import "./ds-toast.css";', 'import "./ds-diff.css";', ""].join(
        "\n"
      ),
      "utf8"
    );

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", {',
        '  "--ds-modal-backdrop": "var(--color-background)",',
        '  "--ds-panel-border": "var(--color-border)",',
        '  "--color-background": "var(--ds-surface-app)",',
        '  "--font-size-content": "1rem",',
        '  "--status-success": "green",',
        '  "--z-modal": "40",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Style compat boundary guard: no violations detected.");
  });

  it("fails when runtime.css.ts reintroduces retired app-local DS layers", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(
      runtimeStylePath,
      [
        'import "./design-system.css";',
        'import "./ds-panel.css";',
        'import "./ds-modal.css";',
        "",
      ].join("\n"),
      "utf8"
    );

    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "styles", "design-system.css.ts"),
      'export const legacy = "bad";\n',
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "styles", "ds-panel.css.ts"),
      'export const legacy = "bad";\n',
      "utf8"
    );

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", { "--ds-modal-backdrop": "black" });',
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/runtime.css.ts");
    expect(result.stderr).toContain("./design-system.css");
    expect(result.stderr).toContain("./ds-panel.css");
    expect(result.stderr).toContain("design-system.css.ts");
    expect(result.stderr).toContain("ds-panel.css.ts");
  });

  it("fails when the alias bridge introduces an unregistered compat family", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", {',
        '  "--ds-modal-backdrop": "black",',
        '  "--ds-experimental-chrome": "pink",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/tokens/dsAliases.css.ts");
    expect(result.stderr).toContain("--ds-experimental-chrome");
    expect(result.stderr).toContain("unregistered compat family");
  });

  it("passes when dialog compat classes stay inside the shared dialog primitive", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", { "--ds-modal-backdrop": "black" });',
        "",
      ].join("\n"),
      "utf8"
    );

    const dialogPath = path.join(
      tempRoot,
      "packages",
      "design-system",
      "src",
      "components",
      "Dialog.tsx"
    );
    await mkdir(path.dirname(dialogPath), { recursive: true });
    await writeFile(
      dialogPath,
      'export const DialogTitle = () => <h2 className="ds-modal-title" />;\n'
    );

    const featurePath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "example",
      "ExampleDialog.tsx"
    );
    await mkdir(path.dirname(featurePath), { recursive: true });
    await writeFile(
      featurePath,
      'export function ExampleDialog() { return <div className="shared-dialog" />; }\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Style compat boundary guard: no violations detected.");
  });

  it("fails when feature code reintroduces raw dialog compat classes", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", { "--ds-modal-backdrop": "black" });',
        "",
      ].join("\n"),
      "utf8"
    );

    const featurePath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "example",
      "ExampleDialog.tsx"
    );
    await mkdir(path.dirname(featurePath), { recursive: true });
    await writeFile(
      featurePath,
      'export function ExampleDialog() { return <div className="ds-modal-title" />; }\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/features/example/ExampleDialog.tsx");
    expect(result.stderr).toContain("ds-modal-title");
    expect(result.stderr).toContain("shared Dialog* helpers");
  });

  it("fails when feature code reintroduces raw panel or popover compat classes", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", {',
        '  "--ds-modal-backdrop": "black",',
        '  "--ds-panel-border": "gray",',
        '  "--ds-popover-item-gap": "4px",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const featurePath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "example",
      "ExampleChrome.tsx"
    );
    await mkdir(path.dirname(featurePath), { recursive: true });
    await writeFile(
      featurePath,
      [
        "export function ExampleChrome() {",
        '  return <div className="ds-panel"><button className="ds-popover-item" /></div>;',
        "}",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/features/example/ExampleChrome.tsx");
    expect(result.stderr).toContain("ds-panel");
    expect(result.stderr).toContain("ds-popover-item");
  });

  it("fails when feature code reintroduces raw select compat classes", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", {',
        '  "--ds-modal-backdrop": "black",',
        '  "--ds-select-trigger-border": "1px solid gray",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const featurePath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "example",
      "ExampleSelect.tsx"
    );
    await mkdir(path.dirname(featurePath), { recursive: true });
    await writeFile(
      featurePath,
      [
        "export function ExampleSelect() {",
        '  return <button className="ds-select-trigger">Open</button>;',
        "}",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/features/example/ExampleSelect.tsx");
    expect(result.stderr).toContain("ds-select-trigger");
    expect(result.stderr).toContain("data-ui-select-* hooks");
  });

  it("passes when select visual overrides stay inside approved preset files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", { "--ds-modal-backdrop": "black" });',
        "",
      ].join("\n"),
      "utf8"
    );

    const approvedPresetPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "settings",
      "components",
      "SettingsSelect.css.ts"
    );
    await mkdir(path.dirname(approvedPresetPath), { recursive: true });
    await writeFile(
      approvedPresetPath,
      [
        'import { style } from "@vanilla-extract/css";',
        "",
        "export const selectMenu = style({",
        "  vars: {",
        '    "--ds-select-trigger-gloss": "none",',
        '    "--ds-select-menu-shadow": "none",',
        "  },",
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Style compat boundary guard: no violations detected.");
  });

  it("fails when select visual overrides appear outside approved preset files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", { "--ds-modal-backdrop": "black" });',
        "",
      ].join("\n"),
      "utf8"
    );

    const roguePresetPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "example",
      "ExampleSelectChrome.css.ts"
    );
    await mkdir(path.dirname(roguePresetPath), { recursive: true });
    await writeFile(
      roguePresetPath,
      [
        'import { style } from "@vanilla-extract/css";',
        "",
        "export const rogueSelectChrome = style({",
        "  vars: {",
        '    "--ds-select-trigger-gloss": "none",',
        '    "--ds-select-menu-shadow": "none",',
        "  },",
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/features/example/ExampleSelectChrome.css.ts");
    expect(result.stderr).toContain("--ds-select-trigger-gloss");
    expect(result.stderr).toContain("select-visual-override-compat");
  });

  it("fails when feature code reintroduces legacy settings control classes", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-compat-boundary-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const runtimeStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "runtime.css.ts");
    await mkdir(path.dirname(runtimeStylePath), { recursive: true });
    await writeFile(runtimeStylePath, 'import "./ds-modal.css";\n', "utf8");

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", { "--ds-modal-backdrop": "black" });',
        "",
      ].join("\n"),
      "utf8"
    );

    const featurePath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "example",
      "LegacySettingsControls.tsx"
    );
    await mkdir(path.dirname(featurePath), { recursive: true });
    await writeFile(
      featurePath,
      [
        "export function LegacySettingsControls() {",
        '  return <input className="settings-input settings-input--compact" />;',
        "}",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/features/example/LegacySettingsControls.tsx");
    expect(result.stderr).toContain("settings-input");
    expect(result.stderr).toContain("design-system Input/Select/Textarea primitives");
  });
});
