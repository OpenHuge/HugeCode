import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const outDir = resolve(appDir, "dist-electron");

const commonOptions = {
  bundle: true,
  external: ["electron"],
  logLevel: "info",
  platform: "node",
  sourcemap: true,
  target: "es2022",
};

export async function buildElectron() {
  await mkdir(outDir, { recursive: true });

  await Promise.all([
    build({
      ...commonOptions,
      entryPoints: [resolve(appDir, "electron/main.ts")],
      outfile: resolve(outDir, "main.cjs"),
      format: "cjs",
    }),
    build({
      ...commonOptions,
      entryPoints: [resolve(appDir, "electron/preload.ts")],
      outfile: resolve(outDir, "preload.cjs"),
      format: "cjs",
    }),
  ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildElectron();
}
