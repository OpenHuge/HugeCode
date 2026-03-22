import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-design-system-family-contracts.mjs",
  "scripts/lib/design-system-family-contract-config.mjs",
];

const FAMILY_DOCS = [
  "- `Button`",
  "- `Input`",
  "- `Checkbox`",
  "- `Switch`",
  "- `RadioGroup`",
  "- `Select`",
  "- `Popover`",
  "- `Dialog`",
  "- `Field`",
  "- `Textarea`",
  "- `Badge`",
  "- `Text`",
  "- `ListRow`",
  "- `SectionHeader`",
  "- `Shell`",
  "- `StatusBadge`",
  "- `Surface`",
  "- `Rows`",
];

const UI_EXPORTS = [
  'export { Button } from "./components/Button";',
  'export { Input } from "./components/Input";',
  'export { Checkbox } from "@ku0/design-system";',
  'export { Switch } from "@ku0/design-system";',
  'export { RadioGroup } from "@ku0/design-system";',
  'export { Select } from "./components/Select";',
  'export { PopoverSurface, PopoverMenuItem } from "./components/Popover";',
  'export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./components/Dialog";',
  'export { Field } from "@ku0/design-system";',
  'export { Textarea } from "./components/Textarea";',
  'export { Badge } from "./components/Badge";',
  'export { Text } from "@ku0/design-system";',
  'export { ListRow } from "@ku0/design-system";',
  'export { SectionHeader } from "@ku0/design-system";',
  'export { EmptySurface, ShellFrame, ShellSection, ShellToolbar } from "@ku0/design-system";',
  'export { StatusBadge } from "@ku0/design-system";',
  'export { Surface } from "@ku0/design-system";',
  'export { InlineActionRow, MetadataList, MetadataRow } from "@ku0/design-system";',
];

const REQUIRED_TEST_FILES = [
  "packages/design-system/src/components/Button.test.tsx",
  "packages/design-system/src/components/Input.test.tsx",
  "packages/design-system/src/components/Checkbox.test.tsx",
  "packages/design-system/src/components/Switch.test.tsx",
  "packages/design-system/src/components/RadioGroup.test.tsx",
  "packages/design-system/src/components/Select.test.tsx",
  "packages/design-system/src/components/Popover.test.tsx",
  "packages/design-system/src/components/Dialog.test.tsx",
  "packages/design-system/src/components/Field.test.tsx",
  "packages/design-system/src/components/Textarea.test.tsx",
  "packages/design-system/src/components/Badge.test.tsx",
  "packages/design-system/src/components/Text.test.tsx",
  "packages/design-system/src/components/Shell.test.tsx",
  "packages/design-system/src/components/SectionHeader.test.tsx",
  "packages/design-system/src/components/Rows.test.tsx",
  "packages/design-system/src/components/StatusBadge.test.tsx",
  "packages/design-system/src/components/Surface.test.tsx",
  "packages/ui/src/components/Button.compat.test.tsx",
  "packages/ui/src/components/Checkbox.test.tsx",
  "packages/ui/src/components/Switch.test.tsx",
  "packages/ui/src/components/RadioGroup.test.tsx",
  "packages/ui/src/components/Badge.test.tsx",
  "packages/ui/src/components/Text.test.tsx",
  "packages/ui/src/components/ListRow.test.tsx",
  "packages/ui/src/components/Select.test.tsx",
  "packages/ui/src/components/Popover.test.tsx",
  "packages/ui/src/components/Dialog.test.tsx",
  "packages/ui/src/components/Field.test.tsx",
  "packages/ui/src/components/Textarea.test.tsx",
  "packages/ui/src/components/SectionHeader.test.tsx",
  "packages/ui/src/components/Shell.test.tsx",
  "packages/ui/src/components/Rows.test.tsx",
  "packages/ui/src/components/StatusBadge.test.tsx",
  "packages/ui/src/components/Surface.test.tsx",
  "packages/ui/src/components/Button.compat.test.tsx",
  "apps/code/src/design-system/adapters/Select/Select.test.tsx",
  "apps/code/src/design-system/components/popover/PopoverPrimitives.test.tsx",
  "apps/code/src/design-system/components/ModalShell.test.tsx",
  "apps/code/src/design-system/components/shell/ShellPrimitives.test.tsx",
  "apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx",
  "apps/code/src/features/right-panel/RightPanelPrimitives.test.tsx",
] as const;

async function copyRequiredEntries(targetRoot) {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

async function writeFamilyFixtureRepo(targetRoot) {
  const publicDocsPath = path.join(
    targetRoot,
    "packages",
    "ui",
    "src",
    "components",
    "PublicComponents.mdx"
  );
  await mkdir(path.dirname(publicDocsPath), { recursive: true });
  await writeFile(
    publicDocsPath,
    ["# Public Components", "", "## Stable Shared Primitives", "", ...FAMILY_DOCS, ""].join("\n"),
    "utf8"
  );

  const uiIndexPath = path.join(targetRoot, "packages", "ui", "src", "index.ts");
  await mkdir(path.dirname(uiIndexPath), { recursive: true });
  await writeFile(uiIndexPath, `${UI_EXPORTS.join("\n")}\n`, "utf8");

  for (const relativePath of REQUIRED_TEST_FILES) {
    const targetPath = path.join(targetRoot, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, "export {};\n", "utf8");
  }
}

function runGuard(targetRoot) {
  return spawnSync(
    process.execPath,
    [
      path.join(targetRoot, "scripts", "check-design-system-family-contracts.mjs"),
      "--root",
      targetRoot,
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-design-system-family-contracts", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("includes family contracts in the design-system baseline command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts?.["check:design-system:baseline"]).toContain(
      "check:design-system:family-contracts"
    );
  });

  it("passes when governed families have promoted docs, exports, and contract tests", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-contracts-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeFamilyFixtureRepo(tempRoot);

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Design-system family contract check passed.");
  });

  it("fails when a governed family is missing from PublicComponents.mdx", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-contracts-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeFamilyFixtureRepo(tempRoot);

    const publicDocsPath = path.join(
      tempRoot,
      "packages",
      "ui",
      "src",
      "components",
      "PublicComponents.mdx"
    );
    await writeFile(
      publicDocsPath,
      [
        "# Public Components",
        "",
        "## Stable Shared Primitives",
        "",
        "- `Select`",
        "- `Field`",
        "- `Textarea`",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Dialog");
    expect(result.stderr).toContain("PublicComponents.mdx");
  });

  it("fails when required @ku0/ui exports are missing", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-contracts-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeFamilyFixtureRepo(tempRoot);

    const uiIndexPath = path.join(tempRoot, "packages", "ui", "src", "index.ts");
    await writeFile(
      uiIndexPath,
      [
        'export { Select } from "./components/Select";',
        'export { Dialog } from "./components/Dialog";',
        'export { Field } from "@ku0/design-system";',
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Popover");
    expect(result.stderr).toContain("missing @ku0/ui export");
  });

  it("fails when shared or app compatibility test evidence is missing", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-family-contracts-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);
    await writeFamilyFixtureRepo(tempRoot);

    await rm(path.join(tempRoot, "packages", "ui", "src", "components", "Textarea.test.tsx"));
    await rm(
      path.join(
        tempRoot,
        "apps",
        "code",
        "src",
        "design-system",
        "components",
        "ModalShell.test.tsx"
      )
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Textarea");
    expect(result.stderr).toContain("packages/ui/src/components/Textarea.test.tsx");
    expect(result.stderr).toContain("Dialog");
    expect(result.stderr).toContain("ModalShell.test.tsx");
  });
});
