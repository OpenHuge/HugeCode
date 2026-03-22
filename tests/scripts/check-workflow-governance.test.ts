import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

const governanceScriptPath = path.join(repoRoot, "scripts", "check-workflow-governance.mjs");

const basePackageJson = {
  name: "workflow-governance-fixture",
  private: true,
  scripts: {
    "preflight:codex": "node scripts/codex-preflight.mjs",
    "check:branch-policy": "node scripts/check-branch-policy.mjs --json",
    "collab:status": "node scripts/collab-sync-loop.mjs --status-only --json",
    "collab:sync:fast": "node scripts/collab-sync-loop.mjs --validate-profile fast",
    "collab:sync:full": "node scripts/collab-sync-loop.mjs --validate-profile full",
    preflight:
      "node scripts/deprecated-script-alias.mjs preflight preflight:codex -- pnpm preflight:codex",
    "codex:preflight":
      "node scripts/deprecated-script-alias.mjs codex:preflight preflight:codex -- pnpm preflight:codex",
  },
};

const baseCiWorkflow = `name: CI

on:
  pull_request:
    paths:
      - '.github/workflows/ci.yml'
      - 'docs/development/ci-workflows.md'
      - 'scripts/check-repo-sot.mjs'
      - 'scripts/check-workflow-governance.mjs'
      - 'scripts/workflow-list.mjs'

permissions:
  contents: read

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: dorny/paths-filter@v3
        with:
          filters: |
            repo_sot:
              - '.github/workflows/ci.yml'
              - 'docs/development/ci-workflows.md'
              - 'scripts/check-repo-sot.mjs'
              - 'scripts/check-workflow-governance.mjs'
              - 'scripts/workflow-list.mjs'
`;

async function createBaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "workflow-governance-"));
  tempRoots.push(tempRoot);

  await mkdir(path.join(tempRoot, ".github", "workflows"), { recursive: true });
  await mkdir(path.join(tempRoot, ".github", "actions"), { recursive: true });
  await mkdir(path.join(tempRoot, "docs", "development"), { recursive: true });
  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });

  await cp(governanceScriptPath, path.join(tempRoot, "scripts", "check-workflow-governance.mjs"));
  await writeFile(
    path.join(tempRoot, "package.json"),
    JSON.stringify(basePackageJson, null, 2),
    "utf8"
  );
  await writeFile(path.join(tempRoot, ".github", "workflows", "ci.yml"), baseCiWorkflow, "utf8");
  await writeFile(
    path.join(tempRoot, "docs", "development", "ci-workflows.md"),
    "# CI Workflow Map\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "scripts", "check-repo-sot.mjs"),
    "console.log('ok');\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "scripts", "workflow-list.mjs"),
    "console.log('ok');\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "scripts", "check-branch-policy.mjs"),
    "console.log('ok');\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "scripts", "collab-sync-loop.mjs"),
    "console.log('ok');\n",
    "utf8"
  );

  return tempRoot;
}

function runWorkflowGovernance(tempRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(tempRoot, "scripts", "check-workflow-governance.mjs")],
    {
      cwd: tempRoot,
      encoding: "utf8",
    }
  );
}

describe("check-workflow-governance", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("fails when a workflow references a missing shell script", async () => {
    const tempRoot = await createBaseRepo();

    await writeFile(
      path.join(tempRoot, ".github", "workflows", "fuzz.yml"),
      `name: Fuzz Gate

on:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: fuzz-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  fuzz:
    runs-on: ubuntu-latest
    steps:
      - run: bash scripts/fuzz-gate.sh
`,
      "utf8"
    );

    const result = runWorkflowGovernance(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".github/workflows/fuzz.yml");
    expect(result.stderr).toContain("scripts/fuzz-gate.sh");
  });

  it("fails when a workflow installs Playwright without selecting a workspace", async () => {
    const tempRoot = await createBaseRepo();

    await writeFile(
      path.join(tempRoot, ".github", "workflows", "nightly.yml"),
      `name: Nightly Robustness

on:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: nightly
  cancel-in-progress: false

jobs:
  ui_gate_3x:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm exec playwright install --with-deps
`,
      "utf8"
    );

    const result = runWorkflowGovernance(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".github/workflows/nightly.yml");
    expect(result.stderr).toContain("Playwright install commands must use a workspace-scoped");
  });

  it("fails when a workflow uses a deprecated pnpm script alias", async () => {
    const tempRoot = await createBaseRepo();

    await writeFile(
      path.join(tempRoot, ".github", "workflows", "codex-nightly.yml"),
      `name: Codex Nightly

on:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: codex-nightly-\${{ github.ref }}
  cancel-in-progress: false

jobs:
  codex-readiness:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm codex:preflight
`,
      "utf8"
    );

    const result = runWorkflowGovernance(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".github/workflows/codex-nightly.yml");
    expect(result.stderr).toContain("codex:preflight");
    expect(result.stderr).toContain("preflight:codex");
  });

  it("fails when a path-scoped workflow omits script coverage from a local action dependency", async () => {
    const tempRoot = await createBaseRepo();

    await mkdir(path.join(tempRoot, ".github", "actions", "with-script"), { recursive: true });
    await writeFile(
      path.join(tempRoot, ".github", "actions", "with-script", "action.yml"),
      `name: With Script
description: Fixture action

runs:
  using: composite
  steps:
    - shell: bash
      run: bash scripts/helper.sh
`,
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "scripts", "helper.sh"),
      "#!/usr/bin/env bash\nexit 0\n",
      "utf8"
    );

    await writeFile(
      path.join(tempRoot, ".github", "workflows", "path-scoped.yml"),
      `name: Path Scoped

on:
  pull_request:
    paths:
      - '.github/workflows/path-scoped.yml'
      - '.github/actions/with-script/action.yml'

permissions:
  contents: read

concurrency:
  group: path-scoped-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/with-script
`,
      "utf8"
    );

    const result = runWorkflowGovernance(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".github/workflows/path-scoped.yml");
    expect(result.stderr).toContain("scripts/helper.sh");
  });
});
