import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bootBrandLabel, workspaceBootState } from "./appBoot";

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe("app boot contract", () => {
  it("keeps the static html boot shell aligned with the workspace boot copy", () => {
    const indexHtml = readFileSync(path.resolve(testDir, "../index.html"), "utf8");

    expect(indexHtml).toContain('<meta name="theme-color" content="#212121" />');
    expect(indexHtml).toContain('data-app-boot="workspace"');
    expect(indexHtml).toContain(bootBrandLabel);
    expect(indexHtml).toContain(workspaceBootState.title);
    expect(indexHtml).toContain(workspaceBootState.detail);
  });

  it("keeps the boot shell hydration-safe by avoiding whitespace before the boot surface", () => {
    const indexHtml = readFileSync(path.resolve(testDir, "../index.html"), "utf8");

    expect(indexHtml).toMatch(/<div id="root">\s*<div[\s\S]*data-app-boot="workspace"/);
  });
});
