import { describe, expect, it } from "vitest";
import { themeContract } from "./theme-contract";
import { darkThemeVars, lightThemeVars } from "./themeValues";

describe("themeContract", () => {
  it("exposes light, dim, dark, and system themes with the shared token key set", () => {
    const expectedKeys = Object.keys(lightThemeVars).sort();

    expect(Object.keys(themeContract.light).sort()).toEqual(expectedKeys);
    expect(Object.keys(themeContract.dark).sort()).toEqual(expectedKeys);
    expect(Object.keys(themeContract.dim).sort()).toEqual(expectedKeys);
    expect(Object.keys(themeContract.system).sort()).toEqual(expectedKeys);
    expect(Object.keys(themeContract.light).sort()).toEqual(Object.keys(darkThemeVars).sort());
  });
});
