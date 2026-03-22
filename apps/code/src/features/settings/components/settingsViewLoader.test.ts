import { describe, expect, it } from "vitest";
import { loadSettingsView, preloadSettingsView } from "./settingsViewLoader";

describe("settingsViewLoader", () => {
  it("reuses the same module promise for preload and lazy load", async () => {
    const firstLoad = loadSettingsView();
    const preload = preloadSettingsView();

    expect(preload).toBe(firstLoad);

    const loaded = await firstLoad;
    expect(loaded.default).toBeTypeOf("function");
  }, 30_000);
});
