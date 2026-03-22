import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(repoRoot, "apps", "code", "src");
const capabilitiesDir = path.join(repoRoot, "apps", "code-tauri", "src-tauri", "capabilities");

const permissionMatchers = [
  {
    matches(source) {
      return source.includes("@tauri-apps/api/core");
    },
    permissions: ["core:default"],
  },
  {
    matches(source) {
      return source.includes("@tauri-apps/plugin-dialog") && /\bask\b/.test(source);
    },
    permissions: ["dialog:allow-ask"],
  },
  {
    matches(source) {
      return source.includes("@tauri-apps/plugin-dialog") && /\bmessage\b/.test(source);
    },
    permissions: ["dialog:allow-message"],
  },
  {
    matches(source) {
      return source.includes("@tauri-apps/plugin-dialog") && /\bopen\b/.test(source);
    },
    permissions: ["dialog:allow-open"],
  },
  {
    matches(source) {
      return (
        source.includes("@tauri-apps/plugin-notification") &&
        (/\bisPermissionGranted\s*\(/.test(source) || /\.isPermissionGranted\s*\(/.test(source))
      );
    },
    permissions: ["notification:allow-is-permission-granted"],
  },
  {
    matches(source) {
      return source.includes("@tauri-apps/plugin-opener") && /\bopenUrl\b/.test(source);
    },
    permissions: ["opener:allow-open-url", "opener:allow-default-urls"],
  },
  {
    matches(source) {
      return source.includes("@tauri-apps/plugin-opener") && /\brevealItemInDir\b/.test(source);
    },
    permissions: ["opener:allow-reveal-item-in-dir"],
  },
  {
    matches(source) {
      return source.includes("@tauri-apps/plugin-process") && /\brelaunch\b/.test(source);
    },
    permissions: ["process:allow-restart"],
  },
  {
    matches(source) {
      return source.includes("@tauri-apps/plugin-updater");
    },
    permissions: ["updater:allow-check", "updater:allow-download-and-install"],
  },
];

function listSourceFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }
      if (
        entry.isFile() &&
        (absolutePath.endsWith(".ts") || absolutePath.endsWith(".tsx")) &&
        !absolutePath.endsWith(".test.ts") &&
        !absolutePath.endsWith(".test.tsx")
      ) {
        files.push(absolutePath);
      }
    }
  }
  return files;
}

function main() {
  const capabilityPaths = readdirSync(capabilitiesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(capabilitiesDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
  const declaredPermissions = new Set(
    capabilityPaths.flatMap((capabilityPath) => {
      const capability = JSON.parse(readFileSync(capabilityPath, "utf8"));
      return Array.isArray(capability.permissions) ? capability.permissions : [];
    })
  );
  const sourceFiles = listSourceFiles(frontendRoot);
  const usedPermissions = new Set();

  for (const filePath of sourceFiles) {
    const source = readFileSync(filePath, "utf8");
    for (const matcher of permissionMatchers) {
      if (matcher.matches(source)) {
        for (const permission of matcher.permissions) {
          usedPermissions.add(permission);
        }
      }
    }
  }

  const missingPermissions = Array.from(usedPermissions).filter(
    (permission) => !declaredPermissions.has(permission)
  );
  const unusedPermissions = Array.from(declaredPermissions).filter(
    (permission) => !usedPermissions.has(permission)
  );

  if (missingPermissions.length > 0) {
    const summary = missingPermissions.join(", ");
    process.stderr.write(`Missing desktop permissions: ${summary}\n`);
    process.exit(1);
  }

  if (unusedPermissions.length > 0) {
    const summary = unusedPermissions.join(", ");
    process.stderr.write(`Unused desktop permissions: ${summary}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `Desktop capabilities cover ${Array.from(usedPermissions).sort().join(", ")} across ${capabilityPaths.length} files.\n`
  );
}

main();
