import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import packager from "@electron/packager";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageDir = resolve(scriptDir, "..");
const distDir = resolve(packageDir, "dist-electron");
const outDir = resolve(packageDir, "out");
const packageJsonPath = resolve(packageDir, "package.json");

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const stagingDir = await mkdtemp(resolve(tmpdir(), "hugecode-electron-package-"));
const stagingPackageDir = resolve(stagingDir, "app");

async function main() {
  try {
    await rm(outDir, { force: true, recursive: true });
    await cp(distDir, resolve(stagingPackageDir, "dist-electron"), { recursive: true });

    const stagingPackageJson = {
      name: "hugecode",
      productName: "HugeCode",
      version: packageJson.version,
      type: "module",
      main: "dist-electron/main/main.js",
    };

    await writeFile(
      resolve(stagingPackageDir, "package.json"),
      `${JSON.stringify(stagingPackageJson, null, 2)}\n`,
      "utf8"
    );

    await packager({
      arch: process.arch,
      asar: true,
      dir: stagingPackageDir,
      executableName: "HugeCode",
      electronVersion: "41.0.3",
      out: outDir,
      overwrite: true,
      platform: process.platform,
      prune: false,
      quiet: true,
    });
  } finally {
    await rm(stagingDir, { force: true, recursive: true });
  }
}

await main();
