import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { isRuntimeGatewayReady, setAppTheme, stabilizeVisualSnapshot } from "./helpers";

const execFileAsync = promisify(execFile);
const FIXTURE_REPO_ROOT = path.join(os.tmpdir(), "open-fast-git-inspector-runtime-fixture");
const FIXTURE_REPO_DISPLAY = "Git Inspector Runtime Fixture";
const FIXTURE_VIEWPORT = { width: 1600, height: 1200 };
const COMMIT_DATE = "2026-03-11T10:00:00+08:00";

async function runGit(args: string[], cwd: string) {
  await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: COMMIT_DATE,
      GIT_COMMITTER_DATE: COMMIT_DATE,
    },
  });
}

async function seedRuntimeGitRepo(repoRoot: string) {
  await rm(repoRoot, { recursive: true, force: true });
  await mkdir(path.join(repoRoot, "src"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "src", "inspector.tsx"),
    [
      "export function InspectorCard() {",
      '  return <section aria-label="Inspector card">Initial runtime seed</section>;',
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(repoRoot, "README.md"),
    ["# Runtime Git Fixture", "", "Seeded by Playwright for inspector validation.", ""].join("\n"),
    "utf8"
  );

  await runGit(["init", "-b", "main"], repoRoot);
  await runGit(["config", "user.name", "Codex Fixture"], repoRoot);
  await runGit(["config", "user.email", "codex-fixture@example.com"], repoRoot);
  await runGit(["add", "."], repoRoot);
  await runGit(["commit", "-m", "chore: seed runtime inspector fixture"], repoRoot);

  await writeFile(
    path.join(repoRoot, "src", "inspector.tsx"),
    [
      "export function InspectorCard() {",
      "  return (",
      '    <section aria-label="Inspector card">',
      "      Runtime-backed diff selection now renders in the Git inspector fixture.",
      "    </section>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(repoRoot, "README.md"),
    [
      "# Runtime Git Fixture",
      "",
      "Seeded by Playwright for inspector validation.",
      "",
      "This file is intentionally staged so the Git panel shows both staged and unstaged sections.",
      "",
    ].join("\n"),
    "utf8"
  );
  await runGit(["add", "README.md"], repoRoot);
}

test.describe.configure({ mode: "serial", timeout: 90_000 });

test("git inspector runtime fixture renders a runtime-backed seeded repo", async ({
  page,
}, testInfo) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-backed Git fixture.");

  await seedRuntimeGitRepo(FIXTURE_REPO_ROOT);

  await page.setViewportSize(FIXTURE_VIEWPORT);
  await page.goto(
    `/fixtures.html?fixture=git-inspector-runtime&git-seed-path=${encodeURIComponent(
      FIXTURE_REPO_ROOT
    )}&git-seed-label=${encodeURIComponent(FIXTURE_REPO_DISPLAY)}`,
    { waitUntil: "domcontentloaded" }
  );
  await stabilizeVisualSnapshot(page);
  await setAppTheme(page, "dark");

  const fixture = page.locator('[data-visual-fixture="git-inspector-runtime"]').first();
  const diffSurface = page.getByTestId("git-inspector-runtime-diff-surface");
  await expect(fixture).toBeVisible();
  await expect(diffSurface).toBeVisible();
  await expect(page.getByText("Runtime-backed Git panel", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Staged (1)", { exact: true })).toBeVisible();
  await expect(page.getByText("Unstaged (1)", { exact: true })).toBeVisible();
  await expect(page.locator('[data-git-diff-row="true"]')).toHaveCount(2);
  await expect(
    page.getByText("Runtime-backed diff selection now renders", { exact: false }).first()
  ).toBeVisible();
  await expect(page.getByText("Fixture stand-in", { exact: true }).first()).toBeVisible();

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach("git-inspector-runtime", {
    body: screenshot,
    contentType: "image/png",
  });
});
