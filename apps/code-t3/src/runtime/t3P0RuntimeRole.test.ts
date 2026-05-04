import { afterEach, describe, expect, it } from "vitest";
import {
  canExportT3P0BrowserAccountData,
  canUseT3P0UnreleasedAssistantSurfaces,
  normalizeT3P0RuntimeRole,
  readT3P0RuntimeRoleMode,
  T3_P0_RUNTIME_ROLE_MODE_CARRIER,
} from "./t3P0RuntimeRole";

afterEach(() => {
  window.localStorage.removeItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER);
});

describe("t3P0RuntimeRole", () => {
  it("defaults unknown and missing roles to customer", () => {
    expect(normalizeT3P0RuntimeRole(undefined)).toBe("customer");
    expect(normalizeT3P0RuntimeRole("")).toBe("customer");
    expect(normalizeT3P0RuntimeRole("admin")).toBe("customer");
  });

  it("allows only operator and developer as elevated roles", () => {
    expect(normalizeT3P0RuntimeRole("operator")).toBe("operator");
    expect(normalizeT3P0RuntimeRole("developer")).toBe("developer");
  });

  it("reads the P0 runtime role carrier from local storage", () => {
    window.localStorage.setItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER, "operator");

    expect(readT3P0RuntimeRoleMode()).toBe("operator");
  });

  it("keeps unreleased assistant surfaces developer-only", () => {
    expect(canUseT3P0UnreleasedAssistantSurfaces("customer")).toBe(false);
    expect(canUseT3P0UnreleasedAssistantSurfaces("operator")).toBe(false);
    expect(canUseT3P0UnreleasedAssistantSurfaces("developer")).toBe(true);
  });

  it("keeps browser account export for operator and developer only", () => {
    expect(canExportT3P0BrowserAccountData("customer")).toBe(false);
    expect(canExportT3P0BrowserAccountData("operator")).toBe(true);
    expect(canExportT3P0BrowserAccountData("developer")).toBe(true);
  });
});
