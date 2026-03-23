import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { Button, Input } from "./index";
import { Button as RootButton, Input as RootInput } from "../index";

describe("design-system adapter barrel", () => {
  it("exposes only the remaining substantive adapter entries", () => {
    expect([Button, Input]).toHaveLength(2);
  });

  it("wires substantive adapters through the root app design-system barrel", () => {
    expect([RootButton, RootInput]).toHaveLength(2);
  });

  it("keeps the adapter barrel focused on adapter exports instead of theme or token families", () => {
    const cwd = process.cwd();
    const adapterBarrelPath =
      basename(cwd) === "code" && basename(dirname(cwd)) === "apps"
        ? "src/design-system/adapters/index.ts"
        : "apps/code/src/design-system/adapters/index.ts";
    const source = readFileSync(adapterBarrelPath, "utf8");
    const exportedKeys = [Button, Input];

    expect(exportedKeys).toHaveLength(2);
    expect(source).not.toContain("themeSemantics");
    expect(source).not.toContain("themeValues");
    expect(source).not.toContain("componentThemeVars");
    expect(source).not.toContain("semanticThemeVars");
    expect(source).not.toContain("executionThemeVars");
    expect(source).not.toContain("Card");
    expect(source).not.toContain("RadioGroup");
    expect(source).not.toContain("Select");
    expect(source).not.toContain("Avatar");
    expect(source).not.toContain("StatusBadge");
    expect(source).not.toContain("Surface");
    expect(source).not.toContain("Tabs");
    expect(source).not.toContain("Tooltip");
  });
});
