import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type DesktopIncidentLevel = "info" | "warn";

export type DesktopIncidentRecord = {
  details?: Record<string, unknown> | null;
  event: string;
  level: DesktopIncidentLevel;
  message: string;
  occurredAt: string;
  sessionId?: string | null;
  windowId?: number | null;
};

export type DesktopIncidentSummary = {
  incidentLogPath: string;
  lastIncidentAt: string | null;
  logsDirectoryPath: string;
  recentIncidentCount: number;
};

type DesktopIncidentStoreDependencies = {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { mode?: number; recursive?: boolean }): void;
  readFileSync(path: string, encoding: "utf8"): string;
  renameSync(from: string, to: string): void;
  writeFileSync(path: string, data: string, options?: { encoding?: "utf8"; mode?: number }): void;
};

export type CreateDesktopIncidentStoreInput = {
  dependencies?: Partial<DesktopIncidentStoreDependencies>;
  incidentLogPath: string;
  maxBytes?: number;
  maxEntries?: number;
  now?: () => Date;
};

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_ENTRIES = 200;

function defaultDependencies(): DesktopIncidentStoreDependencies {
  return {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
  };
}

function serializeEntries(entries: DesktopIncidentRecord[]) {
  return entries
    .map((entry) => JSON.stringify(entry))
    .join("\n")
    .concat(entries.length > 0 ? "\n" : "");
}

function parseIncidentLog(logContents: string) {
  const entries: DesktopIncidentRecord[] = [];
  for (const line of logContents.split("\n")) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmedLine) as DesktopIncidentRecord;
      if (
        typeof parsed?.event === "string" &&
        typeof parsed?.level === "string" &&
        typeof parsed?.message === "string" &&
        typeof parsed?.occurredAt === "string"
      ) {
        entries.push(parsed);
      }
    } catch {
      // Ignore malformed historical lines and keep the recoverable entries.
    }
  }

  return entries;
}

function trimIncidentEntries(
  entries: DesktopIncidentRecord[],
  input: { maxBytes: number; maxEntries: number }
) {
  let trimmedEntries = entries.slice(-input.maxEntries);
  let serialized = serializeEntries(trimmedEntries);

  while (trimmedEntries.length > 1 && Buffer.byteLength(serialized, "utf8") > input.maxBytes) {
    trimmedEntries = trimmedEntries.slice(1);
    serialized = serializeEntries(trimmedEntries);
  }

  if (trimmedEntries.length === 1 && Buffer.byteLength(serialized, "utf8") > input.maxBytes) {
    const [entry] = trimmedEntries;
    trimmedEntries = [
      {
        ...entry,
        details: entry.details ? { truncated: true } : entry.details,
      },
    ];
    serialized = serializeEntries(trimmedEntries);
  }

  return {
    entries: trimmedEntries,
    serialized,
  };
}

function buildTempFilePath(incidentLogPath: string, now: Date) {
  return `${incidentLogPath}.${now.getTime().toString(36)}.tmp`;
}

export function createDesktopIncidentStore(input: CreateDesktopIncidentStoreInput) {
  const dependencies = {
    ...defaultDependencies(),
    ...input.dependencies,
  };
  const incidentLogPath = input.incidentLogPath;
  const logsDirectoryPath = dirname(incidentLogPath);
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxEntries = input.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = input.now ?? (() => new Date());

  let entries: DesktopIncidentRecord[] = [];
  if (dependencies.existsSync(incidentLogPath)) {
    entries = parseIncidentLog(dependencies.readFileSync(incidentLogPath, "utf8"));
  }
  entries = trimIncidentEntries(entries, { maxBytes, maxEntries }).entries;

  function persist() {
    dependencies.mkdirSync(logsDirectoryPath, {
      mode: 0o700,
      recursive: true,
    });
    const timestamp = now();
    const tempFilePath = buildTempFilePath(incidentLogPath, timestamp);
    const serialized = trimIncidentEntries(entries, { maxBytes, maxEntries }).serialized;
    dependencies.writeFileSync(tempFilePath, serialized, {
      encoding: "utf8",
      mode: 0o600,
    });
    dependencies.renameSync(tempFilePath, incidentLogPath);
  }

  return {
    getSummary(): DesktopIncidentSummary {
      const lastIncident = entries[entries.length - 1] ?? null;
      return {
        incidentLogPath,
        lastIncidentAt: lastIncident?.occurredAt ?? null,
        logsDirectoryPath,
        recentIncidentCount: entries.length,
      };
    },
    record(entry: Omit<DesktopIncidentRecord, "occurredAt"> & { occurredAt?: string | null }) {
      entries = trimIncidentEntries(
        [
          ...entries,
          {
            ...entry,
            occurredAt: entry.occurredAt ?? now().toISOString(),
          },
        ],
        { maxBytes, maxEntries }
      ).entries;
      persist();
      return entries[entries.length - 1] ?? null;
    },
  };
}
