import { describe, expect, it } from "vitest";
import { createThemeRegistry } from "../src/core/kernel/theme-registry.js";

describe("ThemeRegistry", () => {
  it("keeps discovered and runtime themes in one registry and applies them by name", () => {
    const registry = createThemeRegistry();

    registry.setDiscoveredThemes([
      {
        name: "dark",
        filePath: "/built-in/dark.json",
        sourcePath: "/built-in/dark.json",
        tokens: { accent: "#000000" },
      },
      {
        name: "light",
        filePath: "/built-in/light.json",
        sourcePath: "/built-in/light.json",
        tokens: { accent: "#ffffff" },
      },
    ]);
    registry.registerRuntimeTheme({
      name: "plugin-theme",
      sourcePath: "runtime://plugin-theme",
      tokens: { accent: "#ff00ff" },
    });

    expect(registry.getAllThemes().map((item) => item.name)).toEqual([
      "dark",
      "light",
      "plugin-theme",
    ]);

    const applied = registry.applyTheme("plugin-theme");
    expect(applied?.sourcePath).toBe("runtime://plugin-theme");
    expect(registry.getActiveTheme()?.name).toBe("plugin-theme");

    registry.resetRuntimeThemes();
    expect(registry.getTheme("plugin-theme")).toBeUndefined();
    expect(registry.getAllThemes().map((item) => item.name)).toEqual(["dark", "light"]);
  });
});
