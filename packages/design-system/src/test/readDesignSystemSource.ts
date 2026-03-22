import { readFileSync } from "node:fs";
import path from "node:path";

const srcRoot = path.resolve(import.meta.dirname, "..");

export function readDesignSystemSource(relativePath: string) {
  return readFileSync(path.join(srcRoot, relativePath), "utf8");
}
