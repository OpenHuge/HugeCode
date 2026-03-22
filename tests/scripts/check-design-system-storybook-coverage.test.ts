import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-design-system-storybook-coverage.mjs",
  "scripts/lib/design-system-family-contract-config.mjs",
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
    [
      path.join(targetRoot, "scripts", "check-design-system-storybook-coverage.mjs"),
      "--root",
      targetRoot,
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-design-system-storybook-coverage", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("includes storybook coverage in the design-system baseline command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["check:design-system:baseline"]).toContain(
      "check:design-system:storybook-coverage"
    );
  });

  it("passes when promoted shared primitives have exports and dedicated inspection stories", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-storybook-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const publicDocsPath = path.join(
      tempRoot,
      "packages",
      "ui",
      "src",
      "components",
      "PublicComponents.mdx"
    );
    await mkdir(path.dirname(publicDocsPath), { recursive: true });
    await writeFile(
      publicDocsPath,
      [
        "# Public Components",
        "",
        "## Stable Shared Primitives",
        "",
        "### Form Controls",
        "",
        "- `Button`",
        "- `Input`",
        "",
        "### Information And Layout",
        "",
        "- `StatusBadge`",
        "",
      ].join("\n"),
      "utf8"
    );

    const indexPath = path.join(tempRoot, "packages", "ui", "src", "index.ts");
    await writeFile(
      indexPath,
      [
        'export { Button } from "./components/Button";',
        'export { Input } from "./components/Input";',
        'export { StatusBadge } from "@ku0/design-system";',
        "",
      ].join("\n"),
      "utf8"
    );

    for (const componentName of ["Button", "Input", "StatusBadge"]) {
      await writeFile(
        path.join(tempRoot, "packages", "ui", "src", "components", `${componentName}.stories.tsx`),
        `export default { title: "Components/${componentName}" };\n`,
        "utf8"
      );
    }

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Design-system Storybook coverage check passed.");
  });

  it("allows grouped inspection families to map to curated export sets", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-storybook-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const publicDocsPath = path.join(
      tempRoot,
      "packages",
      "ui",
      "src",
      "components",
      "PublicComponents.mdx"
    );
    await mkdir(path.dirname(publicDocsPath), { recursive: true });
    await writeFile(
      publicDocsPath,
      [
        "# Public Components",
        "",
        "## Stable Shared Primitives",
        "",
        "- `Rows`",
        "- `Shell`",
        "",
      ].join("\n"),
      "utf8"
    );

    const indexPath = path.join(tempRoot, "packages", "ui", "src", "index.ts");
    await writeFile(
      indexPath,
      [
        'export { InlineActionRow, MetadataList, MetadataRow } from "@ku0/design-system";',
        'export { EmptySurface, ShellFrame, ShellSection, ShellToolbar } from "@ku0/design-system";',
        "",
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "packages", "ui", "src", "components", "Rows.stories.tsx"),
      'export default { title: "Components/Rows" };\n',
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "packages", "ui", "src", "components", "Shell.stories.tsx"),
      'export default { title: "Components/Shell" };\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Design-system Storybook coverage check passed.");
  });

  it("checks governed families against curated export sets instead of same-name defaults", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-storybook-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const publicDocsPath = path.join(
      tempRoot,
      "packages",
      "ui",
      "src",
      "components",
      "PublicComponents.mdx"
    );
    await mkdir(path.dirname(publicDocsPath), { recursive: true });
    await writeFile(
      publicDocsPath,
      [
        "# Public Components",
        "",
        "## Stable Shared Primitives",
        "",
        "- `Popover`",
        "- `Dialog`",
        "",
      ].join("\n"),
      "utf8"
    );

    const indexPath = path.join(tempRoot, "packages", "ui", "src", "index.ts");
    await writeFile(
      indexPath,
      [
        'export { PopoverSurface, PopoverMenuItem } from "./components/Popover";',
        'export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./components/Dialog";',
        "",
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "packages", "ui", "src", "components", "Popover.stories.tsx"),
      'export default { title: "Components/Popover" };\n',
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "packages", "ui", "src", "components", "Dialog.stories.tsx"),
      'export default { title: "Components/Dialog" };\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Design-system Storybook coverage check passed.");
  });

  it("fails when a promoted shared primitive is missing a dedicated story surface", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-storybook-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const publicDocsPath = path.join(
      tempRoot,
      "packages",
      "ui",
      "src",
      "components",
      "PublicComponents.mdx"
    );
    await mkdir(path.dirname(publicDocsPath), { recursive: true });
    await writeFile(
      publicDocsPath,
      ["# Public Components", "", "## Stable Shared Primitives", "", "- `Select`", ""].join("\n"),
      "utf8"
    );

    const indexPath = path.join(tempRoot, "packages", "ui", "src", "index.ts");
    await writeFile(indexPath, 'export { Select } from "./components/Select";\n', "utf8");

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Select");
    expect(result.stderr).toContain("missing Storybook/docs inspection surface");
  });

  it("fails when a promoted shared primitive is listed in docs but not exported from @ku0/ui", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-storybook-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const publicDocsPath = path.join(
      tempRoot,
      "packages",
      "ui",
      "src",
      "components",
      "PublicComponents.mdx"
    );
    await mkdir(path.dirname(publicDocsPath), { recursive: true });
    await writeFile(
      publicDocsPath,
      ["# Public Components", "", "## Stable Shared Primitives", "", "- `Field`", ""].join("\n"),
      "utf8"
    );

    const indexPath = path.join(tempRoot, "packages", "ui", "src", "index.ts");
    await writeFile(indexPath, 'export { Button } from "./components/Button";\n', "utf8");
    await writeFile(
      path.join(tempRoot, "packages", "ui", "src", "components", "Field.stories.tsx"),
      'export default { title: "Components/Field" };\n',
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Field");
    expect(result.stderr).toContain("missing @ku0/ui export");
  });
});
