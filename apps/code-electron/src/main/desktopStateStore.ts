import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import type { DesktopPersistedState } from "./desktopShellState.js";

const EMPTY_DESKTOP_PERSISTED_STATE: DesktopPersistedState = {
  trayEnabled: false,
  sessions: [],
};

type DesktopStateStoreDependencies = {
  existsSync?: typeof existsSync;
  mkdirSync?: typeof mkdirSync;
  readFileSync?: typeof readFileSync;
  tmpdir?: typeof tmpdir;
  writeFileSync?: typeof writeFileSync;
};

export type DesktopStateStore = {
  read(): DesktopPersistedState;
  write(state: DesktopPersistedState): void;
};

export type CreateDesktopStateStoreInput = {
  allowTemporaryStatePath?: boolean;
  dependencies?: DesktopStateStoreDependencies;
  statePath: string;
};

function isInsideDirectory(targetPath: string, directoryPath: string) {
  const resolvedTargetPath = resolve(targetPath);
  const resolvedDirectoryPath = resolve(directoryPath);

  return (
    resolvedTargetPath === resolvedDirectoryPath ||
    resolvedTargetPath.startsWith(`${resolvedDirectoryPath}${sep}`)
  );
}

export function createDesktopStateStore(input: CreateDesktopStateStoreInput): DesktopStateStore {
  const statePath = input.statePath;
  const dependencies = input.dependencies;
  const allowTemporaryStatePath = input.allowTemporaryStatePath === true;
  const fileExists = dependencies?.existsSync ?? existsSync;
  const createDirectory = dependencies?.mkdirSync ?? mkdirSync;
  const readStateFile = dependencies?.readFileSync ?? readFileSync;
  const readTempDirectory = dependencies?.tmpdir ?? tmpdir;
  const writeStateFile = dependencies?.writeFileSync ?? writeFileSync;

  return {
    read() {
      if (!fileExists(statePath)) {
        return EMPTY_DESKTOP_PERSISTED_STATE;
      }

      try {
        const raw = readStateFile(statePath, "utf8");
        const parsed = JSON.parse(raw) as Partial<DesktopPersistedState>;
        return {
          trayEnabled: parsed.trayEnabled === true,
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        };
      } catch {
        return EMPTY_DESKTOP_PERSISTED_STATE;
      }
    },
    write(state) {
      if (!allowTemporaryStatePath && isInsideDirectory(statePath, readTempDirectory())) {
        throw new Error("Desktop state must not be stored in the system temporary directory.");
      }

      createDirectory(dirname(statePath), { mode: 0o700, recursive: true });
      writeStateFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
    },
  };
}
