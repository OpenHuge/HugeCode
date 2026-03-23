import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DesktopPersistedState } from "./desktopShellState.js";

const EMPTY_DESKTOP_PERSISTED_STATE: DesktopPersistedState = {
  trayEnabled: false,
  sessions: [],
};

type DesktopStateStoreDependencies = {
  existsSync?: typeof existsSync;
  mkdirSync?: typeof mkdirSync;
  readFileSync?: typeof readFileSync;
  writeFileSync?: typeof writeFileSync;
};

export type DesktopStateStore = {
  read(): DesktopPersistedState;
  write(state: DesktopPersistedState): void;
};

export type CreateDesktopStateStoreInput = {
  dependencies?: DesktopStateStoreDependencies;
  statePath: string;
};

export function createDesktopStateStore(input: CreateDesktopStateStoreInput): DesktopStateStore {
  const statePath = input.statePath;
  const dependencies = input.dependencies;
  const fileExists = dependencies?.existsSync ?? existsSync;
  const createDirectory = dependencies?.mkdirSync ?? mkdirSync;
  const readStateFile = dependencies?.readFileSync ?? readFileSync;
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
      createDirectory(dirname(statePath), { recursive: true });
      writeStateFile(statePath, JSON.stringify(state, null, 2));
    },
  };
}
