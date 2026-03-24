import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(import.meta.dirname, "..");
const forgeConfigPath = resolve(repoRoot, "apps/code-electron/forge.config.mjs");
const packageJsonPath = resolve(repoRoot, "apps/code-electron/package.json");

const { default: forgeConfig } = await import(pathToFileURL(forgeConfigPath).href);
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

const makerNames = new Set((forgeConfig.makers ?? []).map((maker) => maker.name));
const publisherNames = new Set((forgeConfig.publishers ?? []).map((publisher) => publisher.name));

const requiredMakers = [
  "@electron-forge/maker-zip",
  "@electron-forge/maker-dmg",
  "@electron-forge/maker-squirrel",
  "@electron-forge/maker-deb",
];

function writeLine(message) {
  process.stdout.write(`${message}\n`);
}

for (const makerName of requiredMakers) {
  if (!makerNames.has(makerName)) {
    throw new Error(`Missing required Electron Forge maker: ${makerName}`);
  }
}

if (!publisherNames.has("@electron-forge/publisher-github")) {
  throw new Error("Missing GitHub publisher in Electron Forge config.");
}

if (
  typeof packageJson.repository?.url !== "string" ||
  !packageJson.repository.url.includes("OpenHuge/HugeCode")
) {
  throw new Error("Electron package.json repository metadata must point to OpenHuge/HugeCode.");
}

if (!process.env.HUGECODE_ELECTRON_UPDATE_BASE_URL) {
  writeLine(
    "Electron publish dry-run: beta auto-update remains manual unless HUGECODE_ELECTRON_UPDATE_BASE_URL is set, because the public Electron update service ignores GitHub prereleases."
  );
} else {
  writeLine(
    `Electron publish dry-run: static beta update feed configured at ${process.env.HUGECODE_ELECTRON_UPDATE_BASE_URL}.`
  );
}

writeLine("Electron publish dry-run: Forge makers and GitHub publisher are configured.");
