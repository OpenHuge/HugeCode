#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_CONFIG_PATH = ".codex/code-integration-watch.json";
const REVIEW_BY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function shellQuote(token) {
  if (/^[A-Za-z0-9_./:@=+-]+$/u.test(token)) {
    return token;
  }
  return `'${token.replace(/'/gu, "'\\''")}'`;
}

function runGit(args, options = {}) {
  const { allowFailure = false } = options;
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    const rendered = ["git", ...args].map(shellQuote).join(" ");
    const detail =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : String(error);
    throw new Error(`command failed: ${rendered}\n${detail}`);
  }
}

function resolveConfigPath() {
  const argv = process.argv.slice(2);
  const explicit = argv.find((arg) => arg.startsWith("--config="));
  if (explicit) {
    const value = explicit.slice("--config=".length).trim();
    if (!value) {
      throw new Error("`--config=` requires a value.");
    }
    return value;
  }
  return DEFAULT_CONFIG_PATH;
}

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function ensureRefExists(refName) {
  try {
    runGit(["rev-parse", "--verify", `${refName}^{commit}`]);
  } catch (error) {
    throw new Error(
      `missing git ref: ${refName}\n${error instanceof Error ? error.message : error}`
    );
  }
}

function toRemoteHeadName(remoteRef) {
  const prefix = "origin/";
  if (!remoteRef.startsWith(prefix)) {
    throw new Error(
      `only origin/* remote refs are supported for auto-fetch, received: ${remoteRef}`
    );
  }
  return remoteRef.slice(prefix.length);
}

function fetchRequiredRefs(targetBranch, trackedBranches) {
  const uniqueRefs = [...new Set([targetBranch, ...trackedBranches])];
  const refspecs = uniqueRefs.map((remoteRef) => {
    const remoteHead = toRemoteHeadName(remoteRef);
    return `+refs/heads/${remoteHead}:refs/remotes/${remoteRef}`;
  });

  runGit(["fetch", "--no-tags", "--prune", "origin", ...refspecs]);
}

function loadConfig(configPath) {
  const absolutePath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`config file not found: ${configPath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `invalid JSON in ${configPath}: ${error instanceof Error ? error.message : error}`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`config must be a JSON object: ${configPath}`);
  }

  const targetBranch = typeof parsed.targetBranch === "string" ? parsed.targetBranch.trim() : "";
  const trackedBranches = Array.isArray(parsed.trackedBranches)
    ? parsed.trackedBranches
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    : [];
  const triage = Array.isArray(parsed.triage) ? parsed.triage : [];

  if (!targetBranch) {
    throw new Error(`config missing "targetBranch": ${configPath}`);
  }
  if (trackedBranches.length === 0) {
    throw new Error(`config missing non-empty "trackedBranches": ${configPath}`);
  }

  return {
    absolutePath,
    targetBranch,
    trackedBranches,
    triage,
  };
}

function parseTriageString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function parseTriageRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const branch = parseTriageString(row.branch);
  const commit = parseTriageString(row.commit);
  if (!branch || !commit) {
    return null;
  }

  return {
    key: `${branch}:${commit}`,
    value: {
      decision: parseTriageString(row.decision, "documented"),
      reason: parseTriageString(row.reason),
      reviewBy: parseTriageString(row.reviewBy),
    },
  };
}

function buildTriageIndex(triageRows) {
  const index = new Map();
  for (const row of triageRows) {
    const parsed = parseTriageRow(row);
    if (!parsed) {
      continue;
    }
    index.set(parsed.key, parsed.value);
  }
  return index;
}

function parseCherryLine(line) {
  const match = line.match(/^([+-])\s+([0-9a-f]{7,40})$/u);
  if (!match) {
    return null;
  }
  return { state: match[1], commit: match[2] };
}

function getCommitSubject(commit) {
  return runGit(["log", "--format=%s", "-n", "1", commit]);
}

function collectBranchStatus(targetBranch, branch, triageIndex) {
  const output = runGit(["cherry", targetBranch, branch], { allowFailure: true });
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const integratedEquivalent = [];
  const pendingTriaged = [];
  const pendingUntriaged = [];

  for (const line of lines) {
    const parsed = parseCherryLine(line);
    if (!parsed) {
      continue;
    }
    const subject = getCommitSubject(parsed.commit);
    if (parsed.state === "-") {
      integratedEquivalent.push({ commit: parsed.commit, subject });
      continue;
    }

    const triageKey = `${branch}:${parsed.commit}`;
    const triage = triageIndex.get(triageKey);
    if (triage) {
      pendingTriaged.push({ commit: parsed.commit, subject, triage });
      continue;
    }

    pendingUntriaged.push({ commit: parsed.commit, subject });
  }

  return {
    branch,
    integratedEquivalent,
    pendingTriaged,
    pendingUntriaged,
  };
}

function printStatus(targetBranch, statuses) {
  for (const status of statuses) {
    const { branch, integratedEquivalent, pendingTriaged, pendingUntriaged } = status;

    for (const row of pendingTriaged) {
      const suffix = [
        row.triage.decision ? `decision=${row.triage.decision}` : null,
        row.triage.reviewBy ? `reviewBy=${row.triage.reviewBy}` : null,
      ]
        .filter(Boolean)
        .join(", ");
    }

    for (const row of pendingUntriaged) {
    }
  }
}

function collectTriageQuality(statuses) {
  const today = new Date().toISOString().slice(0, 10);
  const missingReviewBy = [];
  const invalidReviewBy = [];
  const overdue = [];

  for (const status of statuses) {
    for (const row of status.pendingTriaged) {
      const reviewBy = row.triage.reviewBy;
      if (!reviewBy) {
        missingReviewBy.push({ branch: status.branch, commit: row.commit, subject: row.subject });
        continue;
      }
      if (!REVIEW_BY_PATTERN.test(reviewBy)) {
        invalidReviewBy.push({
          branch: status.branch,
          commit: row.commit,
          subject: row.subject,
          reviewBy,
        });
        continue;
      }
      if (reviewBy < today) {
        overdue.push({ branch: status.branch, commit: row.commit, subject: row.subject, reviewBy });
      }
    }
  }

  return {
    today,
    missingReviewBy,
    invalidReviewBy,
    overdue,
  };
}

function renderTriageIssueRows(rows, suffixKey = null) {
  const preview = rows.slice(0, 5);
  return preview.map((row) => {
    const suffix = suffixKey ? ` (${suffixKey}=${row[suffixKey]})` : "";
    return `${row.branch} ${row.commit} ${row.subject}${suffix}`;
  });
}

function main() {
  const configPath = resolveConfigPath();
  const strict = hasFlag("--strict");
  const fetchFirst = hasFlag("--fetch");
  const { absolutePath, targetBranch, trackedBranches, triage } = loadConfig(configPath);
  const triageIndex = buildTriageIndex(triage);

  if (fetchFirst) {
    fetchRequiredRefs(targetBranch, trackedBranches);
  }

  ensureRefExists(targetBranch);
  for (const branch of trackedBranches) {
    ensureRefExists(branch);
  }

  const statuses = trackedBranches.map((branch) =>
    collectBranchStatus(targetBranch, branch, triageIndex)
  );
  printStatus(targetBranch, statuses);

  const triageQuality = collectTriageQuality(statuses);
  if (triageQuality.missingReviewBy.length > 0) {
    const details = renderTriageIssueRows(triageQuality.missingReviewBy).join("; ");
    throw new Error(
      `triaged commits must include reviewBy (YYYY-MM-DD): ${details}${
        triageQuality.missingReviewBy.length > 5 ? "; ..." : ""
      }`
    );
  }
  if (triageQuality.invalidReviewBy.length > 0) {
    const details = renderTriageIssueRows(triageQuality.invalidReviewBy, "reviewBy").join("; ");
    throw new Error(
      `invalid reviewBy format on triaged commits: ${details}${
        triageQuality.invalidReviewBy.length > 5 ? "; ..." : ""
      }`
    );
  }
  if (triageQuality.overdue.length > 0) {
    const details = renderTriageIssueRows(triageQuality.overdue, "reviewBy").join("; ");
    throw new Error(
      `triage reviewBy overdue (today=${triageQuality.today}): ${details}${
        triageQuality.overdue.length > 5 ? "; ..." : ""
      }`
    );
  }

  const untriagedCount = statuses.reduce((sum, status) => sum + status.pendingUntriaged.length, 0);
  const triagedCount = statuses.reduce((sum, status) => sum + status.pendingTriaged.length, 0);
  const pendingCount = untriagedCount + triagedCount;

  if (untriagedCount > 0) {
    throw new Error(`found ${untriagedCount} untriaged pending commit(s).`);
  }
  if (strict && pendingCount > 0) {
    throw new Error(`strict mode enabled and ${pendingCount} pending commit(s) remain.`);
  }

  if (pendingCount > 0) {
    return;
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exitCode = 1;
}
