import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = ["scripts/check-design-system-ownership.mjs"];

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
    [path.join(targetRoot, "scripts", "check-design-system-ownership.mjs")],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

async function writeRepoFile(targetRoot: string, relativePath: string, content = "export {};\n") {
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function createOwnershipFixtureRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-ownership-"));
  tempRoots.push(tempRoot);
  await copyRequiredEntries(tempRoot);

  const allowedFiles = [
    "packages/design-system/src/components/Button.tsx",
    "packages/ui/src/components/Button.stories.tsx",
    "apps/code/src/design-system/index.ts",
    "apps/code/src/design-system/index.project-coverage.test.tsx",
    "apps/code/src/design-system/adapters/index.ts",
    "apps/code/src/design-system/adapters/index.test.ts",
    "apps/code/src/design-system/adapters/Button/index.ts",
    "apps/code/src/design-system/adapters/Button/Button.tsx",
    "apps/code/src/design-system/adapters/Card/index.ts",
    "apps/code/src/design-system/adapters/Card/Card.tsx",
    "apps/code/src/design-system/adapters/Input/index.ts",
    "apps/code/src/design-system/adapters/Input/Input.tsx",
    "apps/code/src/design-system/adapters/Radio/index.ts",
    "apps/code/src/design-system/adapters/Radio/Radio.tsx",
    "apps/code/src/design-system/adapters/Select/index.ts",
    "apps/code/src/design-system/adapters/Select/Select.tsx",
    "apps/code/src/design-system/adapters/Select/Select.test.tsx",
    "apps/code/src/design-system/components/ModalShell.tsx",
    "apps/code/src/design-system/components/ModalShell.test.tsx",
    "apps/code/src/design-system/components/modal/ModalPrimitives.tsx",
    "apps/code/src/design-system/components/modal/ModalPrimitives.test.tsx",
    "apps/code/src/design-system/components/panel/PanelPrimitives.tsx",
    "apps/code/src/design-system/components/panel/PanelPrimitives.test.tsx",
    "apps/code/src/design-system/components/popover/PopoverPrimitives.tsx",
    "apps/code/src/design-system/components/popover/PopoverPrimitives.test.tsx",
    "apps/code/src/design-system/components/shell/ShellPrimitives.tsx",
    "apps/code/src/design-system/components/shell/ShellPrimitives.test.tsx",
    "apps/code/src/design-system/components/textarea/TextareaPrimitives.tsx",
    "apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx",
    "apps/code/src/design-system/components/toast/ToastPrimitives.tsx",
    "apps/code/src/design-system/components/toast/ToastPrimitives.test.tsx",
    "apps/code/src/design-system/components/execution/ActivityLogRow.tsx",
    "apps/code/src/design-system/components/execution/DiffReviewPanel.tsx",
    "apps/code/src/design-system/components/execution/ExecutionPrimitives.css.ts",
    "apps/code/src/design-system/components/execution/ExecutionPrimitives.test.tsx",
    "apps/code/src/design-system/components/execution/ExecutionStatusPill.tsx",
    "apps/code/src/design-system/components/execution/ToolCallChip.tsx",
    "apps/code/src/design-system/components/execution/executionStatus.ts",
  ];

  for (const relativePath of allowedFiles) {
    await writeRepoFile(tempRoot, relativePath);
  }

  return tempRoot;
}

describe("check-design-system-ownership", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("passes when app design-system files stay within the current adapter and barrel baseline", async () => {
    const tempRoot = await createOwnershipFixtureRepo();

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });

  it("fails when a new app adapter file is added outside the frozen baseline", async () => {
    const tempRoot = await createOwnershipFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/adapters/Chip/Chip.tsx",
      "export const Chip = true;\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when a new app design-system root file is added outside the frozen baseline", async () => {
    const tempRoot = await createOwnershipFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/runtimeCompat.ts",
      "export const runtimeCompat = true;\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("allows new compat test files for existing app design-system surfaces", async () => {
    const tempRoot = await createOwnershipFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/ModalShell.test.tsx",
      "export {};\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });

  it("fails when a compat test file would introduce a new app surface", async () => {
    const tempRoot = await createOwnershipFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/Chip.test.tsx",
      "export {};\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when a second dialog or panel shell surface is added outside the approved grammar files", async () => {
    const tempRoot = await createOwnershipFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/Dialog.tsx",
      "export const Dialog = true;\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });

  it("fails when a second root-level compat bridge file is reintroduced", async () => {
    const tempRoot = await createOwnershipFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/Popover.tsx",
      "export const Popover = true;\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
  });
});
