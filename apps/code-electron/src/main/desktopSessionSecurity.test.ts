import { describe, expect, it, vi } from "vitest";
import { registerDesktopSessionSecurity } from "./desktopSessionSecurity.js";

describe("desktopSessionSecurity", () => {
  it("installs deny-by-default permission handlers on the default session", () => {
    const setPermissionCheckHandler = vi.fn();
    const setPermissionRequestHandler = vi.fn();

    registerDesktopSessionSecurity({
      setPermissionCheckHandler,
      setPermissionRequestHandler,
    });

    expect(setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    expect(setPermissionCheckHandler).toHaveBeenCalledTimes(1);

    const requestHandler = setPermissionRequestHandler.mock.calls[0]?.[0];
    const permissionCallback = vi.fn();
    requestHandler?.({}, "notifications", permissionCallback);
    expect(permissionCallback).toHaveBeenCalledWith(false);

    const checkHandler = setPermissionCheckHandler.mock.calls[0]?.[0];
    expect(checkHandler?.({}, "media", "hugecode-app://app/index.html")).toBe(false);
  });
});
