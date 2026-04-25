import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourcePath = resolve(packageDir, "src/preload/preload.cjs");
const targetPath = resolve(packageDir, "dist-electron/preload/preload.cjs");

mkdirSync(dirname(targetPath), { recursive: true });
copyFileSync(sourcePath, targetPath);
