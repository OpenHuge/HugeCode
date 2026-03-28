import { readFile } from "node:fs/promises";
import type { ThemeDefinition } from "../../../core/kernel/contracts.js";

interface RawThemeFile {
  name?: string;
  tokens?: Record<string, string>;
  vars?: Record<string, string>;
  [key: string]: unknown;
}

export async function loadThemeFromPath(filePath: string): Promise<ThemeDefinition> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as RawThemeFile;
  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name.trim() : undefined;
  if (!name) {
    throw new Error(`Theme at ${filePath} is missing a name`);
  }

  const tokens = raw.tokens ?? raw.vars ?? {};
  return {
    name,
    filePath,
    sourcePath: filePath,
    tokens,
  };
}
