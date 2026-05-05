import { afterEach, describe, expect, it } from "vitest";
import {
  canExportT3P0BrowserAccountData,
  canReadT3BrowserRoleOverride,
  canUseT3P0UnreleasedAssistantSurfaces,
  normalizeT3P0RuntimeRole,
  readT3OperatorUnlockState,
  readT3P0RuntimeRoleMode,
  verifyT3OperatorLocalPassword,
  writeT3OperatorUnlockState,
  T3_OPERATOR_DEFAULT_LOCAL_PASSWORD,
  T3_OPERATOR_UNLOCK_STORAGE_KEY,
  T3_P0_RUNTIME_ROLE_MODE_CARRIER,
} from "./t3P0RuntimeRole";

afterEach(() => {
  window.localStorage.removeItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER);
  window.sessionStorage.removeItem(T3_OPERATOR_UNLOCK_STORAGE_KEY);
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

  it("keeps the local storage role override development-only", () => {
    expect(canReadT3BrowserRoleOverride({ DEV: true })).toBe(true);
    expect(canReadT3BrowserRoleOverride({ DEV: false })).toBe(false);
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

  it("uses session storage as the operator unlock carrier", () => {
    expect(readT3OperatorUnlockState()).toBe(false);
    expect(readT3P0RuntimeRoleMode()).toBe("customer");

    writeT3OperatorUnlockState(true);

    expect(readT3OperatorUnlockState()).toBe(true);
    expect(readT3P0RuntimeRoleMode()).toBe("operator");

    writeT3OperatorUnlockState(false);

    expect(readT3P0RuntimeRoleMode()).toBe("customer");
  });

  it("verifies the local operator password without treating it as backend auth", () => {
    expect(verifyT3OperatorLocalPassword("secret", "secret")).toBe(true);
    expect(verifyT3OperatorLocalPassword("wrong", "secret")).toBe(false);
  });

  it("uses the unified local operator password when no environment override is configured", () => {
    expect(verifyT3OperatorLocalPassword(T3_OPERATOR_DEFAULT_LOCAL_PASSWORD)).toBe(true);
    expect(verifyT3OperatorLocalPassword(` ${T3_OPERATOR_DEFAULT_LOCAL_PASSWORD} `)).toBe(true);
  });
});
