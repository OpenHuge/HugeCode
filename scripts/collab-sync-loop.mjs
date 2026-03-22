#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import { evaluateBranchPolicy } from "./lib/branch-policy.mjs";

function usage() {
  const message = `
Usage: node scripts/collab-sync-loop.mjs [options]

Options:
  --branch <name>                 Target branch to sync (default: current branch)
  --message <text>                Commit message summary for collaborative milestones
  --validate-cmd <command>        Explicit validation command (default: pnpm validate)
  --validate-profile <profile>    Validation profile: fast | standard | full
  --max-retries <count>           Retry count for network/push races (default: 3)
  --retry-delay-ms <ms>           Initial retry delay in milliseconds (default: 1200)
  --status-only                   Fetch remote refs and report ahead/behind/dirty only
  --json                          Emit structured JSON output
  --fail-if-behind                Exit non-zero when the branch is behind origin/<branch>
  --fail-if-dirty                 Exit non-zero when the worktree is dirty
  --skip-validate                 Skip validation before commit
  --skip-commit                   Skip staging and commit
  --no-push                       Skip push to origin
  --dry-run                       Do not execute mutating commands
  -h, --help                      Show help
`;
  process.stdout.write(message.trimStart());
}

function parseArgs(rawArgs) {
  const options = {
    branch: null,
    message: null,
    validateCmd: "pnpm validate",
    validateCmdExplicit: false,
    validateProfile: null,
    maxRetries: 3,
    retryDelayMs: 1200,
    statusOnly: false,
    json: false,
    failIfBehind: false,
    failIfDirty: false,
    skipValidate: false,
    skipCommit: false,
    noPush: false,
    dryRun: false,
  };
  const flagMap = new Map([
    ["--status-only", "statusOnly"],
    ["--json", "json"],
    ["--fail-if-behind", "failIfBehind"],
    ["--fail-if-dirty", "failIfDirty"],
    ["--skip-validate", "skipValidate"],
    ["--skip-commit", "skipCommit"],
    ["--no-push", "noPush"],
    ["--dry-run", "dryRun"],
  ]);
  const valueMap = new Map([
    ["--branch", "branch"],
    ["--message", "message"],
    ["--validate-cmd", "validateCmd"],
    ["--validate-profile", "validateProfile"],
    ["--max-retries", "maxRetries"],
    ["--retry-delay-ms", "retryDelayMs"],
  ]);

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    if (flagMap.has(arg)) {
      const key = flagMap.get(arg);
      options[key] = true;
      continue;
    }

    if (valueMap.has(arg)) {
      const key = valueMap.get(arg);
      const value = rawArgs[i + 1];
      if (!value || (value.startsWith("-") && (flagMap.has(value) || valueMap.has(value)))) {
        usage();
        process.exit(1);
      }
      options[key] = value;
      if (arg === "--validate-cmd") {
        options.validateCmdExplicit = true;
      }
      i += 1;
      continue;
    }

    usage();
    process.exit(1);
  }

  const parsedRetries = Number.parseInt(String(options.maxRetries), 10);
  if (!Number.isFinite(parsedRetries) || parsedRetries < 1) {
    process.exit(1);
  }
  options.maxRetries = parsedRetries;

  const parsedDelay = Number.parseInt(String(options.retryDelayMs), 10);
  if (!Number.isFinite(parsedDelay) || parsedDelay < 0) {
    process.exit(1);
  }
  options.retryDelayMs = parsedDelay;

  if (
    options.validateProfile &&
    !["fast", "standard", "full"].includes(options.validateProfile.trim().toLowerCase())
  ) {
    process.exit(1);
  }
  options.validateProfile = options.validateProfile?.trim().toLowerCase() ?? null;

  return options;
}

function read(command, args, { allowFailure = false } = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    const message = error instanceof Error ? error.message : `Failed: ${command} ${args.join(" ")}`;
    throw new Error(message);
  }
}

function run(command, args, label, options) {
  if (options.dryRun) {
    return { status: 0, stdout: "", stderr: "", output: "" };
  }

  const result = spawnSync(command, args, {
    stdio: options.json ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
    encoding: options.json ? "utf8" : undefined,
  });

  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(
      `${label} failed with exit code ${result.status ?? 1}.${output ? `\n${output}` : ""}`
    );
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function runShell(command, label, options) {
  if (options.dryRun) {
    return { status: 0, stdout: "", stderr: "", output: "" };
  }
  const result = spawnSync(command, {
    stdio: options.json ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
    shell: true,
    encoding: options.json ? "utf8" : undefined,
  });
  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(
      `${label} failed with exit code ${result.status ?? 1}.${output ? `\n${output}` : ""}`
    );
  }
  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function sleepMs(delayMs) {
  if (delayMs <= 0) {
    return;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function retryDelayMs(baseDelayMs, attempt) {
  const boundedAttempt = Math.max(1, attempt);
  const exponentialDelay = baseDelayMs * 2 ** (boundedAttempt - 1);
  return Math.min(exponentialDelay, 10_000);
}

function isTransientNetworkFailure(output) {
  const lower = output.toLowerCase();
  return (
    lower.includes("unable to access") ||
    lower.includes("ssl_connect") ||
    lower.includes("could not resolve host") ||
    lower.includes("connection reset") ||
    lower.includes("operation timed out") ||
    lower.includes("connection timed out") ||
    lower.includes("remote end hung up unexpectedly")
  );
}

function isPushRaceFailure(output) {
  const lower = output.toLowerCase();
  return (
    lower.includes("failed to push some refs") ||
    lower.includes("fetch first") ||
    lower.includes("non-fast-forward")
  );
}

function runGitWithCapture(args, options) {
  if (options.dryRun) {
    return { status: 0, stdout: "", stderr: "", output: "" };
  }
  const result = spawnSync("git", args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    encoding: "utf8",
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const output = `${stdout}${stderr}`.trim();
  return {
    status: result.status ?? 1,
    stdout,
    stderr,
    output,
    error: result.error,
  };
}

function getCurrentBranch() {
  return read("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

function getPorcelain() {
  return read("git", ["status", "--porcelain"], { allowFailure: true })
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getAheadBehind(branch) {
  const output = read("git", ["rev-list", "--left-right", "--count", `HEAD...origin/${branch}`], {
    allowFailure: true,
  });
  if (!output) {
    return { ahead: 0, behind: 0 };
  }
  const [aheadRaw, behindRaw] = output.split(/\s+/u);
  return {
    ahead: Number.parseInt(aheadRaw ?? "0", 10) || 0,
    behind: Number.parseInt(behindRaw ?? "0", 10) || 0,
  };
}

function fetchRemote(branch, options) {
  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    const result = runGitWithCapture(["fetch", "--prune", "origin", branch], options);
    if (result.status === 0) {
      if (!options.json && result.output) {
        process.stdout.write(`${result.output}\n`);
      }
      return result;
    }
    if (result.error) {
      throw new Error(`Fetch from remote failed to start: ${result.error.message}`);
    }
    if (attempt < options.maxRetries && isTransientNetworkFailure(result.output)) {
      sleepMs(retryDelayMs(options.retryDelayMs, attempt));
      continue;
    }
    throw new Error(
      `Fetch from remote failed with exit code ${result.status}.\n${result.output || "(no output)"}`
    );
  }
}

function ensureSynced(branch, options) {
  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    const result = runGitWithCapture(
      ["pull", "--rebase", "--autostash", "origin", branch],
      options
    );
    if (result.status === 0) {
      if (!options.json) {
        const output = result.output.trim();
        if (output) {
          process.stdout.write(`${output}\n`);
        }
      }
      return result;
    }
    if (result.error) {
      throw new Error(`Sync from remote failed to start: ${result.error.message}`);
    }
    if (attempt < options.maxRetries && isTransientNetworkFailure(result.output)) {
      sleepMs(retryDelayMs(options.retryDelayMs, attempt));
      continue;
    }
    throw new Error(
      `Sync from remote failed with exit code ${result.status}.\n${result.output || "(no output)"}`
    );
  }
}

function resolveValidateCommand(options) {
  if (options.validateCmdExplicit) {
    return options.validateCmd;
  }
  if (options.validateProfile === "fast") {
    return "pnpm validate:fast";
  }
  if (options.validateProfile === "full") {
    return "pnpm validate:full";
  }
  return "pnpm validate";
}

function maybeCommit(options) {
  if (options.skipCommit) {
    return false;
  }

  run("git", ["add", "-A"], "Stage changes", options);

  const commitSummary =
    options.message && options.message.trim().length > 0
      ? options.message.trim()
      : "chore: collaborative sync milestone";
  const commitMessageWithTimestamp = `${commitSummary} (${new Date().toISOString()})`;

  if (options.dryRun) {
    return true;
  }

  const result = spawnSync("git", ["commit", "-m", commitMessageWithTimestamp], {
    stdio: options.json ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
    encoding: options.json ? "utf8" : undefined,
  });

  if (result.error) {
    throw new Error(`Commit failed to start: ${result.error.message}`);
  }

  if ((result.status ?? 1) !== 0) {
    const remaining = getPorcelain();
    if (remaining.length === 0) {
      return false;
    }
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(
      `Commit failed with exit code ${result.status ?? 1}.${output ? `\n${output}` : ""}`
    );
  }

  return true;
}

function handlePushFailure(result, attempt, branch, options) {
  if (result.error) {
    throw new Error(`Push failed to start: ${result.error.message}`);
  }
  if (attempt >= options.maxRetries) {
    throw new Error(`Push failed after ${attempt} attempt(s).\n${result.output || "(no output)"}`);
  }
  if (isPushRaceFailure(result.output)) {
    ensureSynced(branch, options);
    return true;
  }
  if (isTransientNetworkFailure(result.output)) {
    sleepMs(retryDelayMs(options.retryDelayMs, attempt));
    return true;
  }
  throw new Error(
    `Push failed with exit code ${result.status}.\n${result.output || "(no output)"}`
  );
}

function maybePush(branch, options) {
  if (options.noPush) {
    return false;
  }

  const { behind } = getAheadBehind(branch);
  if (behind > 0) {
    ensureSynced(branch, options);
  }

  const refreshed = getAheadBehind(branch);
  if (refreshed.ahead <= 0 && !options.dryRun) {
    return false;
  }

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    const result = runGitWithCapture(["push", "origin", branch], options);
    if (result.status === 0) {
      if (!options.json && result.output.trim()) {
        process.stdout.write(`${result.output.trim()}\n`);
      }
      return true;
    }
    handlePushFailure(result, attempt, branch, options);
  }
}

function collectStatus(branch) {
  const dirtyEntries = getPorcelain();
  const { ahead, behind } = getAheadBehind(branch);
  return {
    branch,
    ahead,
    behind,
    dirty: dirtyEntries.length > 0,
    dirtyEntries,
    syncedWithRemote: ahead === 0 && behind === 0,
    checkedAt: new Date().toISOString(),
  };
}

function enforceStatusGuards(status, options) {
  if (options.failIfBehind && status.behind > 0) {
    throw Object.assign(
      new Error(`Branch is behind origin/${status.branch} by ${status.behind} commit(s).`),
      {
        status,
        code: "behind_remote",
      }
    );
  }
  if (options.failIfDirty && status.dirty) {
    throw Object.assign(new Error("Working tree is dirty."), {
      status,
      code: "dirty_worktree",
    });
  }
}

function printHumanStatus(status) {
  const lines = [
    `branch: ${status.branch}`,
    `ahead: ${status.ahead}`,
    `behind: ${status.behind}`,
    `dirty: ${status.dirty ? "yes" : "no"}`,
  ];
  if (status.dirtyEntries.length > 0) {
    lines.push("dirty entries:");
    for (const entry of status.dirtyEntries) {
      lines.push(`  ${entry}`);
    }
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function printResult(payload, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  if (payload.status) {
    printHumanStatus(payload.status);
  }
}

function assertBranchPolicy(branch) {
  const policy = evaluateBranchPolicy(branch);
  if (policy.ok) {
    return;
  }

  throw Object.assign(new Error(policy.detail), {
    code: "invalid_branch_policy",
    branchPolicy: {
      branch: policy.branch,
      kind: policy.kind,
      detail: policy.detail,
    },
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const branch = options.branch?.trim() || getCurrentBranch();

  if (!branch || branch === "HEAD") {
    throw new Error("Unable to determine current branch (detached HEAD).");
  }

  assertBranchPolicy(branch);

  if (options.statusOnly) {
    fetchRemote(branch, options);
    const status = collectStatus(branch);
    enforceStatusGuards(status, options);
    printResult(
      {
        ok: true,
        mode: "status-only",
        status,
      },
      options
    );
    return;
  }

  ensureSynced(branch, options);

  const initialStatus = collectStatus(branch);
  const validateCommand = resolveValidateCommand(options);
  if (!options.skipValidate && initialStatus.dirty) {
    runShell(validateCommand, "Validation", options);
  }

  const committed = maybeCommit(options);
  const pushed = maybePush(branch, options);
  ensureSynced(branch, options);

  const finalStatus = collectStatus(branch);
  enforceStatusGuards(finalStatus, options);
  printResult(
    {
      ok: true,
      mode: "sync",
      validateCommand: options.skipValidate ? null : validateCommand,
      committed,
      pushed,
      status: finalStatus,
    },
    options
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const branchPolicy =
    error && typeof error === "object" && "branchPolicy" in error ? error.branchPolicy : undefined;
  const payload = {
    ok: false,
    mode: "error",
    code: typeof code === "string" ? code : "sync_failed",
    error: message,
    status,
    branchPolicy,
  };
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.exitCode = 1;
}
