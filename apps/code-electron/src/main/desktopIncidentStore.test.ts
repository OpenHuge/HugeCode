import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createDesktopIncidentStore } from "./desktopIncidentStore.js";

describe("desktopIncidentStore", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    for (const directoryPath of tempDirectories.splice(0)) {
      rmSync(directoryPath, { force: true, recursive: true });
    }
  });

  function createTempIncidentLogPath() {
    const directoryPath = mkdtempSync(join(tmpdir(), "hugecode-electron-incident-log-"));
    tempDirectories.push(directoryPath);
    return join(directoryPath, "logs", "desktop-incidents.ndjson");
  }

  it("persists incidents with bounded summaries and recent metadata", () => {
    const incidentLogPath = createTempIncidentLogPath();
    const store = createDesktopIncidentStore({
      incidentLogPath,
      maxEntries: 2,
    });

    store.record({
      event: "desktop_render_process_gone",
      level: "warn",
      message: "Renderer exited unexpectedly.",
      occurredAt: "2026-03-25T00:00:00.000Z",
      sessionId: "session-alpha",
      windowId: 101,
    });
    store.record({
      event: "desktop_window_unresponsive",
      level: "warn",
      message: "Window stopped responding.",
      occurredAt: "2026-03-25T01:00:00.000Z",
      sessionId: "session-alpha",
      windowId: 101,
    });
    store.record({
      event: "desktop_window_responsive",
      level: "info",
      message: "Window responsiveness recovered.",
      occurredAt: "2026-03-25T01:05:00.000Z",
      sessionId: "session-alpha",
      windowId: 101,
    });

    const summary = store.getSummary();
    expect(summary).toEqual({
      incidentLogPath,
      lastIncidentAt: "2026-03-25T01:05:00.000Z",
      logsDirectoryPath: dirname(incidentLogPath),
      recentIncidentCount: 2,
    });

    const parsedLog = readFileSync(incidentLogPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(parsedLog).toHaveLength(2);
    expect(parsedLog[0]?.event).toBe("desktop_window_unresponsive");
    expect(parsedLog[1]?.event).toBe("desktop_window_responsive");
  });

  it("loads valid historical incidents and ignores malformed lines", () => {
    const incidentLogPath = createTempIncidentLogPath();
    const logsDirectoryPath = join(incidentLogPath, "..");
    const store = createDesktopIncidentStore({
      incidentLogPath,
    });
    store.record({
      event: "desktop_child_process_gone",
      level: "warn",
      message: "Child process exited unexpectedly.",
      occurredAt: "2026-03-25T02:00:00.000Z",
    });

    const validLine = JSON.stringify({
      event: "desktop_render_process_gone",
      level: "warn",
      message: "Renderer failed.",
      occurredAt: "2026-03-25T03:00:00.000Z",
    });
    const malformedHistory = `${validLine}\nnot-json\n`;
    rmSync(incidentLogPath, { force: true });
    mkdirSync(logsDirectoryPath, { recursive: true, mode: 0o700 });
    writeFileSync(incidentLogPath, malformedHistory, { encoding: "utf8", mode: 0o600 });

    const loadedStore = createDesktopIncidentStore({
      incidentLogPath,
    });

    expect(loadedStore.getSummary()).toMatchObject({
      lastIncidentAt: "2026-03-25T03:00:00.000Z",
      recentIncidentCount: 1,
    });
  });
});
