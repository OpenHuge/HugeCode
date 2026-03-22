import { describe, expect, it } from "vitest";
import {
  darkThemeVars,
  dimThemeVars,
  lightThemeVars,
  systemLightThemeVars,
  themeModeStyles,
  themeTokenNames,
} from "./themeValues";

describe("@ku0/design-system theme values", () => {
  it("defines a complete token contract for dark, dim, light, and system-light modes", () => {
    expect(themeTokenNames.length).toBeGreaterThan(50);

    for (const tokenName of themeTokenNames) {
      expect(darkThemeVars[tokenName]).toEqual(expect.any(String));
      expect(dimThemeVars[tokenName]).toEqual(expect.any(String));
      expect(lightThemeVars[tokenName]).toEqual(expect.any(String));
      expect(systemLightThemeVars[tokenName]).toEqual(expect.any(String));
    }
  });

  it("treats dim as a first-class dark-surface theme mode", () => {
    expect(themeModeStyles.dim["color-scheme"]).toBe("dark");
    expect(themeModeStyles.light["color-scheme"]).toBe("light");
    expect(themeModeStyles.system["color-scheme"]).toBe("light");
  });
});
