#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const distAssetsDir = path.join(workspaceRoot, "apps/code/dist/assets");

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "n/a";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    limit: (() => {
      const index = argv.indexOf("--limit");
      if (index === -1) {
        return 20;
      }
      const raw = argv[index + 1];
      const parsed = Number.parseInt(raw ?? "", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    })(),
  };
}

async function listAssetStats() {
  const entries = await readdir(distAssetsDir);
  const stats = [];
  for (const name of entries) {
    const fullPath = path.join(distAssetsDir, name);
    const info = await stat(fullPath);
    if (!info.isFile()) {
      continue;
    }
    stats.push({
      name,
      size: info.size,
    });
  }
  stats.sort((left, right) => right.size - left.size);
  return stats;
}

function findEntryChunk(assets) {
  return assets.find((asset) => /^index-[\w-]+\.js$/.test(asset.name)) ?? null;
}

function pickTopAssets(assets, limit) {
  return assets.slice(0, Math.max(limit, 1));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allAssets = await listAssetStats();
  const assets = pickTopAssets(allAssets, args.limit);
  const entryChunk = findEntryChunk(allAssets);

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          distAssetsDir,
          entryChunk,
          totalAssets: allAssets.length,
          topAssets: assets,
        },
        null,
        2
      )
    );
    process.stdout.write("\n");
    return;
  }

  process.stdout.write(`# apps/code bundle report\n`);
  process.stdout.write(`Generated: ${new Date().toISOString()}\n`);
  process.stdout.write(`Assets dir: ${distAssetsDir}\n\n`);

  if (entryChunk) {
    process.stdout.write(
      `Entry chunk: ${entryChunk.name} (${formatBytes(entryChunk.size)} | ${entryChunk.size} bytes)\n\n`
    );
  } else {
    process.stdout.write(`Entry chunk: not found in assets dir\n\n`);
  }

  process.stdout.write(`Top ${assets.length} assets by size:\n`);
  for (const asset of assets) {
    process.stdout.write(`- ${asset.name}: ${formatBytes(asset.size)} (${asset.size} bytes)\n`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `[report-code-bundle] ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
