import {
  getSafeLocalStorage,
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../utils/safeLocalStorage";

export type TextFileResponse = {
  exists: boolean;
  content: string;
  truncated: boolean;
};

export type FileScope = "workspace" | "global";
export type FileKind = "agents" | "config";

const MOCK_TEXT_FILE_STORAGE_KEY_PREFIX = "codex_monitor_mock_text_file_v1";

const EMPTY_TEXT_FILE_RESPONSE: TextFileResponse = {
  exists: false,
  content: "",
  truncated: false,
};

type TextFileGatewayDeps = {
  isDesktopHostRuntime: () => boolean;
  detectRuntimeMode: () => string;
  readCommand: string;
  writeCommand: string;
  invokeRead: (scope: FileScope, kind: FileKind, workspaceId?: string) => Promise<TextFileResponse>;
  invokeWrite: (
    scope: FileScope,
    kind: FileKind,
    content: string,
    workspaceId?: string
  ) => Promise<void>;
  isMissingTextFileError: (error: unknown) => boolean;
  isMissingDesktopHostInvokeError: (error: unknown) => boolean;
  isMissingDesktopHostCommandError: (error: unknown, command: string) => boolean;
  logRuntimeWarning: (message: string, context?: unknown) => void;
};

function canUseBrowserTextFileFallback(runtimeMode: string): boolean {
  return runtimeMode === "runtime-gateway-web";
}

function canUseMockStorage() {
  return getSafeLocalStorage() !== null;
}

function getMockTextFileStorageKey(scope: FileScope, kind: FileKind, workspaceId?: string) {
  if (scope === "workspace") {
    const normalizedWorkspaceId = workspaceId?.trim();
    if (!normalizedWorkspaceId) {
      return null;
    }
    return `${MOCK_TEXT_FILE_STORAGE_KEY_PREFIX}:workspace:${kind}:${normalizedWorkspaceId}`;
  }
  return `${MOCK_TEXT_FILE_STORAGE_KEY_PREFIX}:global:${kind}`;
}

function readMockTextFile(
  scope: FileScope,
  kind: FileKind,
  workspaceId?: string
): TextFileResponse {
  if (!canUseMockStorage()) {
    return EMPTY_TEXT_FILE_RESPONSE;
  }
  const storageKey = getMockTextFileStorageKey(scope, kind, workspaceId);
  if (!storageKey) {
    return EMPTY_TEXT_FILE_RESPONSE;
  }
  const content = readSafeLocalStorageItem(storageKey);
  if (content === null) {
    return EMPTY_TEXT_FILE_RESPONSE;
  }
  return { exists: true, content, truncated: false };
}

function writeMockTextFile(
  scope: FileScope,
  kind: FileKind,
  content: string,
  workspaceId?: string
) {
  if (!canUseMockStorage()) {
    return;
  }
  const storageKey = getMockTextFileStorageKey(scope, kind, workspaceId);
  if (!storageKey) {
    return;
  }
  writeSafeLocalStorageItem(storageKey, content);
}

export function createTextFileGateway(deps: TextFileGatewayDeps) {
  const read = async (
    scope: FileScope,
    kind: FileKind,
    workspaceId?: string
  ): Promise<TextFileResponse> => {
    if (!deps.isDesktopHostRuntime()) {
      if (!canUseBrowserTextFileFallback(deps.detectRuntimeMode())) {
        throw new Error("Text-file fallback is only available in runtime-gateway-web mode.");
      }
      return readMockTextFile(scope, kind, workspaceId);
    }
    try {
      return await deps.invokeRead(scope, kind, workspaceId);
    } catch (error) {
      if (deps.isMissingTextFileError(error)) {
        return EMPTY_TEXT_FILE_RESPONSE;
      }
      if (deps.isMissingDesktopHostInvokeError(error)) {
        deps.logRuntimeWarning(
          "Electron bridge invoke unavailable; using local text-file fallback.",
          {
            capabilityState: "browser-local-only",
            scope,
            kind,
            workspaceId: workspaceId ?? null,
          }
        );
        return readMockTextFile(scope, kind, workspaceId);
      }
      if (deps.isMissingDesktopHostCommandError(error, deps.readCommand)) {
        deps.logRuntimeWarning(
          `Electron bridge ${deps.readCommand} command unavailable; using browser-local text-file fallback.`,
          {
            capabilityState: "browser-local-only",
            scope,
            kind,
            workspaceId: workspaceId ?? null,
          }
        );
        return readMockTextFile(scope, kind, workspaceId);
      }
      throw error;
    }
  };

  const write = async (
    scope: FileScope,
    kind: FileKind,
    content: string,
    workspaceId?: string
  ): Promise<void> => {
    if (!deps.isDesktopHostRuntime()) {
      if (!canUseBrowserTextFileFallback(deps.detectRuntimeMode())) {
        throw new Error("Text-file fallback is only available in runtime-gateway-web mode.");
      }
      writeMockTextFile(scope, kind, content, workspaceId);
      return;
    }
    try {
      await deps.invokeWrite(scope, kind, content, workspaceId);
    } catch (error) {
      if (deps.isMissingDesktopHostInvokeError(error)) {
        deps.logRuntimeWarning(
          "Electron bridge invoke unavailable; using browser-local text-file fallback write.",
          {
            capabilityState: "browser-local-only",
            scope,
            kind,
            workspaceId: workspaceId ?? null,
          }
        );
        writeMockTextFile(scope, kind, content, workspaceId);
        return;
      }
      if (deps.isMissingDesktopHostCommandError(error, deps.writeCommand)) {
        deps.logRuntimeWarning(
          `Electron bridge ${deps.writeCommand} command unavailable; using browser-local text-file fallback.`,
          {
            capabilityState: "browser-local-only",
            scope,
            kind,
            workspaceId: workspaceId ?? null,
          }
        );
        writeMockTextFile(scope, kind, content, workspaceId);
        return;
      }
      throw error;
    }
  };

  return {
    read,
    write,
  };
}
