type SessionLike = {
  setPermissionCheckHandler(
    handler: (
      webContents: unknown,
      permission: string,
      requestingOrigin: string,
      details?: unknown
    ) => boolean
  ): void;
  setPermissionRequestHandler(
    handler: (
      webContents: unknown,
      permission: string,
      callback: (granted: boolean) => void,
      details?: unknown
    ) => void
  ): void;
};

export function registerDesktopSessionSecurity(session: SessionLike) {
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  session.setPermissionCheckHandler(() => {
    return false;
  });
}
