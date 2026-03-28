import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceShellDir = import.meta.dirname;

describe("SharedWorkspaceShell styles", () => {
  it("keeps the shared shell header surface neutral instead of a branded page gradient", () => {
    const shellSource = readFileSync(
      resolve(workspaceShellDir, "SharedWorkspaceShell.css.ts"),
      "utf8"
    );
    const shellExport = shellSource.match(/export const shell = style\(\{[\s\S]*?\n\}\);/)?.[0];

    expect(shellExport).toContain('background: "var(--ds-surface-app)"');
    expect(shellExport).not.toContain("radial-gradient(circle at top left");
  });

  it("keeps the shared workspace selector on the system select chrome instead of a bright custom border", () => {
    const shellSource = readFileSync(
      resolve(workspaceShellDir, "SharedWorkspaceShell.css.ts"),
      "utf8"
    );
    const selectChromeSource = readFileSync(
      resolve(workspaceShellDir, "SharedWorkspaceSelectChrome.css.ts"),
      "utf8"
    );

    expect(selectChromeSource).toMatch(
      /"--ds-select-trigger-open-border":\s*"color-mix\(in srgb, var\(--ds-border-subtle\) 40%, transparent\)"/
    );
    expect(shellSource).toContain('minWidth: "240px"');
    expect(selectChromeSource).toContain('"--ds-select-menu-max-width": "min(420px, 92vw)"');
    expect(selectChromeSource).not.toMatch(/"--ds-select-trigger-open-border":\s*"1px solid/);
  });
});
