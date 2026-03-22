import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

async function createTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

async function copyRepoFile(relativePath: string, targetRoot: string): Promise<void> {
  const sourcePath = path.join(repoRoot, relativePath);
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
}

function runNode(targetRoot: string, relativeScriptPath: string, args: string[], env = {}) {
  return spawnSync(process.execPath, [path.join(targetRoot, relativeScriptPath), ...args], {
    cwd: targetRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function runGit(targetRoot: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: targetRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

function parseJsonResult(result: { stdout: string }) {
  return JSON.parse(result.stdout) as {
    ok: boolean;
    check: string;
    errors: string[];
    warnings?: string[];
    details?: Record<string, unknown>;
  };
}

function buildLineBlock(lineCount: number, prefix: string): string {
  return Array.from({ length: lineCount }, (_, index) => `${prefix} ${index + 1}`).join("\n");
}

async function setupCheckOutputFixture(
  targetRoot: string,
  scriptName: string,
  extraLibs: string[] = []
): Promise<void> {
  await copyRepoFile(`scripts/${scriptName}`, targetRoot);
  await copyRepoFile("scripts/lib/check-output.mjs", targetRoot);
  for (const libPath of extraLibs) {
    await copyRepoFile(`scripts/lib/${libPath}`, targetRoot);
  }
}

describe("guard script json mode", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("emits offender details for check-frontend-file-size --json", async () => {
    const tempRoot = await createTempRoot("frontend-size-json-");
    await setupCheckOutputFixture(tempRoot, "check-frontend-file-size.mjs");
    await mkdir(path.join(tempRoot, "apps", "code", "src"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "HugePanel.tsx"),
      buildLineBlock(1_315, "export const line"),
      "utf8"
    );
    runGit(tempRoot, ["init", "--initial-branch=main"]);

    const result = runNode(tempRoot, "scripts/check-frontend-file-size.mjs", ["--json"]);
    const payload = parseJsonResult(result);

    expect(result.status).toBe(1);
    expect(payload.check).toBe("check-frontend-file-size");
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain("HugePanel.tsx");
    expect(payload.details?.offenders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "apps/code/src/HugePanel.tsx",
          currentLines: 1315,
        }),
      ])
    );
  });

  it("reports legacy oversized frontend files in json warnings", async () => {
    const tempRoot = await createTempRoot("frontend-size-legacy-json-");
    await setupCheckOutputFixture(tempRoot, "check-frontend-file-size.mjs");
    await mkdir(path.join(tempRoot, "apps", "code", "src"), { recursive: true });
    const largeFilePath = path.join(tempRoot, "apps", "code", "src", "LegacyPanel.tsx");
    await writeFile(largeFilePath, buildLineBlock(1_319, "export const legacy"), "utf8");
    runGit(tempRoot, ["init", "--initial-branch=main"]);
    runGit(tempRoot, ["config", "user.name", "Codex"]);
    runGit(tempRoot, ["config", "user.email", "codex@example.com"]);
    runGit(tempRoot, ["add", "-A"]);
    runGit(tempRoot, ["commit", "-m", "baseline"]);

    const result = runNode(tempRoot, "scripts/check-frontend-file-size.mjs", ["--json", "--all"]);
    const payload = parseJsonResult(result);

    expect(result.status).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.warnings?.[0]).toContain("LegacyPanel.tsx");
    expect(payload.details?.legacyOversized).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "apps/code/src/LegacyPanel.tsx",
          currentLines: 1319,
        }),
      ])
    );
  });

  it("emits offender details for check-rust-file-size --json", async () => {
    const tempRoot = await createTempRoot("rust-size-json-");
    await setupCheckOutputFixture(tempRoot, "check-rust-file-size.mjs");
    await mkdir(path.join(tempRoot, "packages", "demo", "src"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "packages", "demo", "src", "lib.rs"),
      buildLineBlock(1_201, "fn line"),
      "utf8"
    );
    runGit(tempRoot, ["init", "--initial-branch=main"]);

    const result = runNode(tempRoot, "scripts/check-rust-file-size.mjs", ["--json"]);
    const payload = parseJsonResult(result);

    expect(result.status).toBe(1);
    expect(payload.check).toBe("check-rust-file-size");
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain("packages/demo/src/lib.rs");
    expect(payload.details?.offenders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "packages/demo/src/lib.rs",
          currentLines: 1201,
        }),
      ])
    );
  });

  it("emits violation details for check-runtime-layering --json", async () => {
    const tempRoot = await createTempRoot("runtime-layering-json-");
    await setupCheckOutputFixture(tempRoot, "check-runtime-layering.mjs");
    await mkdir(path.join(tempRoot, "packages", "code-runtime-service-rs", "src", "transport"), {
      recursive: true,
    });
    await writeFile(
      path.join(tempRoot, "packages", "code-runtime-service-rs", "src", "transport", "bridge.rs"),
      "use crate::rpc::handler;\n",
      "utf8"
    );

    const result = runNode(tempRoot, "scripts/check-runtime-layering.mjs", ["--json"], {
      VALIDATE_CHANGED_FILES_JSON: JSON.stringify([
        "packages/code-runtime-service-rs/src/transport/bridge.rs",
      ]),
    });
    const payload = parseJsonResult(result);

    expect(result.status).toBe(1);
    expect(payload.check).toBe("check-runtime-layering");
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain("transport/bridge.rs");
    expect(payload.details?.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "packages/code-runtime-service-rs/src/transport/bridge.rs",
          layer: "transport",
        }),
      ])
    );
  });

  it("emits structured results for codex-preflight --json", async () => {
    const tempRoot = await createTempRoot("codex-preflight-json-");
    await copyRepoFile("scripts/codex-preflight.mjs", tempRoot);
    await copyRepoFile("scripts/check-branch-policy.mjs", tempRoot);
    await copyRepoFile("scripts/dev-code-runtime-gateway-web-all.mjs", tempRoot);
    await copyRepoFile("scripts/collab-sync-loop.mjs", tempRoot);
    await copyRepoFile("scripts/lib/branch-policy.mjs", tempRoot);
    await copyRepoFile("scripts/lib/check-output.mjs", tempRoot);
    await copyRepoFile("scripts/lib/e2e-map.mjs", tempRoot);
    await mkdir(path.join(tempRoot, ".github", "workflows"), { recursive: true });
    await mkdir(path.join(tempRoot, ".github", "codex", "prompts"), { recursive: true });
    await mkdir(path.join(tempRoot, ".codex"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "AGENTS.md"),
      "# AGENTS\n\n`implementation_plan.md` remains a local working artifact.\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "package.json"),
      JSON.stringify(
        {
          name: "codex-preflight-fixture",
          private: true,
          scripts: {
            "lint:fix": "echo lint",
            "repo:doctor": "echo doctor",
            typecheck: "echo typecheck",
            "test:unit": "echo unit",
            "test:e2e:core": "echo core",
            "test:e2e:blocks": "echo blocks",
            "test:e2e:collab": "echo collab",
            "test:e2e:annotations": "echo annotations",
            "test:e2e:features": "echo features",
            "test:e2e:smoke": "echo smoke",
            "test:e2e:a11y": "echo a11y",
            "preflight:codex": "node scripts/codex-preflight.mjs",
            "preflight:codex:ci": "node scripts/codex-preflight.mjs --json",
            "check:runtime-contract": "echo runtime-contract",
            "check:runtime-contract:parity": "echo runtime-contract-parity",
            "check:branch-policy": "node scripts/check-branch-policy.mjs --json",
            validate: "echo validate",
            "validate:fast": "echo validate-fast",
            "validate:fast:e2e": "echo validate-fast-e2e",
            "validate:full": "echo validate-full",
            "collab:sync": "node scripts/collab-sync-loop.mjs",
            "collab:status": "node scripts/collab-sync-loop.mjs --status-only --json",
            "collab:sync:fast": "node scripts/collab-sync-loop.mjs --validate-profile fast",
            "collab:sync:full": "node scripts/collab-sync-loop.mjs --validate-profile full",
          },
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, ".codex", "e2e-map.json"),
      JSON.stringify(
        {
          categories: ["smoke", "core"],
          rules: [
            {
              category: "core",
              matchers: ["apps/code/src/services/**"],
            },
          ],
          fallback: {
            codeSrcCategory: "smoke",
          },
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, ".github", "workflows", "ci.yml"),
      "name: CI\njobs:\n  gate:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm preflight:codex\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, ".github", "workflows", "codex-nightly.yml"),
      "name: Codex Nightly\njobs:\n  codex:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: openai/codex-action@v1\n      - run: cat .github/codex/prompts/nightly-infra.md\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, ".github", "codex", "prompts", "nightly-infra.md"),
      "# Nightly Prompt\n",
      "utf8"
    );

    const codexHome = path.join(tempRoot, ".codex-home");
    await mkdir(path.join(codexHome, "sessions"), { recursive: true });
    await writeFile(
      path.join(codexHome, "auth.json"),
      JSON.stringify({ tokens: { access_token: "token" } }, null, 2),
      "utf8"
    );
    await writeFile(path.join(codexHome, "sessions", "latest.jsonl"), "{}\n", "utf8");

    const result = runNode(tempRoot, "scripts/codex-preflight.mjs", ["--json"], {
      CODEX_HOME: codexHome,
    });
    const payload = parseJsonResult(result);

    expect(result.status).toBe(0);
    expect(payload.check).toBe("codex-preflight");
    expect(payload.ok).toBe(true);
    expect(payload.errors).toEqual([]);
    expect(payload.details?.summary).toEqual(
      expect.objectContaining({
        failCount: 0,
      })
    );
    expect(payload.details?.checks).toContainEqual(
      expect.objectContaining({
        name: "AGENTS line budget",
      })
    );
  }, 30_000);

  it("emits structured results for check-branch-policy --json", async () => {
    const tempRoot = await createTempRoot("branch-policy-json-");
    await copyRepoFile("scripts/check-branch-policy.mjs", tempRoot);
    await copyRepoFile("scripts/lib/branch-policy.mjs", tempRoot);
    await copyRepoFile("scripts/lib/check-output.mjs", tempRoot);

    const result = runNode(tempRoot, "scripts/check-branch-policy.mjs", [
      "--branch",
      "topic/nope",
      "--json",
    ]);
    const payload = parseJsonResult(result);

    expect(result.status).toBe(1);
    expect(payload.check).toBe("check-branch-policy");
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain("topic/nope");
  });

  it("emits violation details for check-ui-service-boundary --json", async () => {
    const tempRoot = await createTempRoot("ui-service-boundary-json-");
    await setupCheckOutputFixture(tempRoot, "check-ui-service-boundary.mjs", [
      "ui-service-boundary.mjs",
    ]);
    await mkdir(path.join(tempRoot, "apps", "code", "src", "features", "demo"), {
      recursive: true,
    });
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "features", "demo", "Demo.tsx"),
      'import { getRuntimeClient } from "../../../services/runtimeClient";\n',
      "utf8"
    );

    const result = runNode(tempRoot, "scripts/check-ui-service-boundary.mjs", ["--json"]);
    const payload = parseJsonResult(result);

    expect(result.status).toBe(1);
    expect(payload.check).toBe("ui-service-boundary");
    expect(payload.ok).toBe(false);
    expect(payload.errors[0]).toContain("Demo.tsx:1");
    expect(payload.details?.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "apps/code/src/features/demo/Demo.tsx",
          rule: "service",
        }),
      ])
    );
  });
});
