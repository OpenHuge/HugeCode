import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const nodeExecutable = process.execPath;
const windowsHide = process.platform === "win32";
const MAX_WINDOWS_COMMAND_LENGTH = 30_000;

function quoteForMessage(value) {
  return /[\s"]/u.test(value) ? JSON.stringify(value) : value;
}

function chunkFiles(binPath, baseArgs, files) {
  const chunks = [];
  let currentChunk = [];
  let currentLength =
    nodeExecutable.length +
    binPath.length +
    baseArgs.reduce((total, arg) => total + String(arg).length + 1, 0);

  for (const filePath of files) {
    const nextLength = currentLength + String(filePath).length + 1;
    if (
      currentChunk.length > 0 &&
      process.platform === "win32" &&
      nextLength >= MAX_WINDOWS_COMMAND_LENGTH
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength =
        nodeExecutable.length +
        binPath.length +
        baseArgs.reduce((total, arg) => total + String(arg).length + 1, 0);
    }

    currentChunk.push(filePath);
    currentLength += String(filePath).length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function runNodeCommand(binRelativePath, baseArgs, files) {
  const binPath = path.join(repoRoot, binRelativePath);
  const chunks = chunkFiles(binPath, baseArgs, files);

  for (const chunk of chunks) {
    await new Promise((resolve, reject) => {
      const child = spawn(nodeExecutable, [binPath, ...baseArgs, ...chunk], {
        cwd: repoRoot,
        stdio: "inherit",
        windowsHide,
      });

      child.on("error", reject);
      child.on("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            signal
              ? `${path.basename(binPath)} terminated by signal ${signal}.`
              : `${path.basename(binPath)} exited with code ${String(code)}.`
          )
        );
      });
    });
  }
}

const tsLikeTaskTitle = [
  [nodeExecutable, path.join(repoRoot, "node_modules/oxlint/bin/oxlint"), "--deny-warnings"]
    .map(quoteForMessage)
    .join(" "),
  [
    nodeExecutable,
    path.join(repoRoot, "node_modules/oxfmt/bin/oxfmt"),
    "--check",
    "--no-error-on-unmatched-pattern",
  ]
    .map(quoteForMessage)
    .join(" "),
].join(" && ");

const formatTaskTitle = [
  nodeExecutable,
  path.join(repoRoot, "node_modules/oxfmt/bin/oxfmt"),
  "--check",
  "--no-error-on-unmatched-pattern",
]
  .map(quoteForMessage)
  .join(" ");

export default {
  "*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}": {
    title: tsLikeTaskTitle,
    task: async (files) => {
      await runNodeCommand("node_modules/oxlint/bin/oxlint", ["--deny-warnings"], files);
      await runNodeCommand(
        "node_modules/oxfmt/bin/oxfmt",
        ["--check", "--no-error-on-unmatched-pattern"],
        files
      );
    },
  },
  "*.{json,jsonc,css,md}": {
    title: formatTaskTitle,
    task: async (files) => {
      await runNodeCommand(
        "node_modules/oxfmt/bin/oxfmt",
        ["--check", "--no-error-on-unmatched-pattern"],
        files
      );
    },
  },
};
