import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";

function parsePsTable(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/u);
      if (!match) {
        return null;
      }
      return {
        pid: Number.parseInt(match[1], 10),
        ppid: Number.parseInt(match[2], 10),
        command: match[3] ?? "",
      };
    })
    .filter(Boolean);
}

function readUnixProcessTable() {
  try {
    const output = execFileSync("ps", ["-Ao", "pid=,ppid=,command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parsePsTable(output);
  } catch {
    return [];
  }
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function listProcessTree(rootPid) {
  if (!Number.isInteger(rootPid) || rootPid <= 0 || process.platform === "win32") {
    return [];
  }

  const processTable = readUnixProcessTable();
  const childrenByParent = new Map();
  for (const entry of processTable) {
    const existing = childrenByParent.get(entry.ppid) ?? [];
    existing.push(entry);
    childrenByParent.set(entry.ppid, existing);
  }

  const descendants = [];
  const queue = [rootPid];
  const seen = new Set([rootPid]);
  while (queue.length > 0) {
    const currentPid = queue.shift();
    const children = childrenByParent.get(currentPid) ?? [];
    for (const child of children) {
      if (seen.has(child.pid)) {
        continue;
      }
      seen.add(child.pid);
      descendants.push(child);
      queue.push(child.pid);
    }
  }
  return descendants;
}

export function formatProcessTree(rootPid) {
  const descendants = listProcessTree(rootPid);
  if (descendants.length === 0) {
    return `pid=${rootPid} (no descendant processes found)`;
  }
  const lines = descendants.map(
    (entry) => `pid=${entry.pid} ppid=${entry.ppid} command=${entry.command}`
  );
  return [`pid=${rootPid} descendants:`, ...lines].join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function killUnixPids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // Process may already be gone.
    }
  }
}

export async function terminateProcessTree(rootPid, options = {}) {
  const graceMs = Math.max(0, options.graceMs ?? 750);
  if (!Number.isInteger(rootPid) || rootPid <= 0) {
    return;
  }

  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/PID", String(rootPid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      // Process may already be gone.
    }
    return;
  }

  const descendants = listProcessTree(rootPid)
    .map((entry) => entry.pid)
    .filter((pid) => pid !== process.pid);
  const allPids = [...new Set([...descendants.reverse(), rootPid].filter((pid) => pid > 0))];

  killUnixPids(allPids, "SIGTERM");
  if (graceMs > 0) {
    await sleep(graceMs);
  }

  const surviving = allPids.filter((pid) => isProcessAlive(pid));
  if (surviving.length === 0) {
    return;
  }
  killUnixPids(surviving, "SIGKILL");
}
