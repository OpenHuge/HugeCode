import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
  const separatorIndex = withoutExport.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = withoutExport.slice(0, separatorIndex).trim();
  const rawValue = withoutExport.slice(separatorIndex + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
    return null;
  }

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return {
      key,
      value: rawValue.slice(1, -1),
    };
  }

  return {
    key,
    value: rawValue,
  };
}

function loadEnvFileFallback(envPath) {
  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/u);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function resolveRootEnvLocalPath(metaUrl) {
  const scriptDir = dirname(fileURLToPath(metaUrl));
  return resolve(scriptDir, "../.env.local");
}

export function loadRootEnvLocal(metaUrl) {
  const envPath = resolveRootEnvLocalPath(metaUrl);
  if (!existsSync(envPath)) {
    return false;
  }

  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
    return true;
  }

  loadEnvFileFallback(envPath);
  return true;
}
