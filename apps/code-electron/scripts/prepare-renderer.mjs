import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptsDir, "..");
const sourceRendererDir = resolve(packageDir, "../code/dist");
const targetRendererDir = resolve(packageDir, "dist-electron/renderer");

if (!existsSync(sourceRendererDir)) {
  throw new Error(`Renderer build output not found at ${sourceRendererDir}`);
}

rmSync(targetRendererDir, { recursive: true, force: true });
mkdirSync(dirname(targetRendererDir), { recursive: true });
cpSync(sourceRendererDir, targetRendererDir, { recursive: true });
