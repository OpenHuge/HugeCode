#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(import.meta.dirname, "..");
const tokensDir = path.join(packageRoot, "tokens");
const generatedDir = path.join(packageRoot, "src", "generated");
const figmaBridgeGeneratedDir = path.resolve(
  packageRoot,
  "..",
  "..",
  "scripts",
  "figma-json-bridge",
  "generated"
);
const themeManifestPath = path.join(tokensDir, "$themes.json");
const terrazzoPackagePath = require.resolve("@terrazzo/cli/package.json");
const terrazzoCliPath = path.join(path.dirname(terrazzoPackagePath), "bin", "cli.js");
const oxfmtPackagePath = require.resolve("oxfmt/package.json");
const oxfmtCliPath = path.join(path.dirname(oxfmtPackagePath), "bin", "oxfmt");

const themeFiles = Object.freeze({
  light: path.join(tokensDir, "semantic", "light.tokens.json"),
  dark: path.join(tokensDir, "semantic", "dark.tokens.json"),
  dim: path.join(tokensDir, "semantic", "dim.tokens.json"),
});

function listTokenFiles(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return listTokenFiles(absolutePath);
    }
    if (entry.isFile() && entry.name.endsWith(".tokens.json")) {
      return [absolutePath];
    }
    return [];
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function flattenTokens(node, segments = [], tokens = new Map()) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return tokens;
  }

  if (Object.hasOwn(node, "$value")) {
    tokens.set(segments.join("."), {
      type: typeof node.$type === "string" ? node.$type : "string",
      value: node.$value,
    });
    return tokens;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) {
      continue;
    }
    flattenTokens(value, segments.concat(key), tokens);
  }

  return tokens;
}

function mergeTokenMaps(...maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [key, value] of map.entries()) {
      merged.set(key, value);
    }
  }
  return merged;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveValue(rawValue, tokenMap, stack = []) {
  if (typeof rawValue !== "string") {
    return rawValue;
  }

  return rawValue.replace(/\{([^}]+)\}/gu, (_match, aliasPath) => {
    if (stack.includes(aliasPath)) {
      throw new Error(`Circular token alias detected: ${stack.concat(aliasPath).join(" -> ")}`);
    }

    const aliasToken = tokenMap.get(aliasPath);
    if (!aliasToken) {
      throw new Error(`Unknown token alias: ${aliasPath}`);
    }

    const resolved = resolveValue(aliasToken.value, tokenMap, stack.concat(aliasPath));
    if (typeof resolved !== "string") {
      throw new Error(`Alias ${aliasPath} resolved to a non-string value.`);
    }
    return resolved;
  });
}

function nestEntries(entries, mapper) {
  const root = {};
  for (const entry of entries) {
    const segments = entry.split(".");
    let cursor = root;
    for (const segment of segments.slice(0, -1)) {
      cursor[segment] ??= {};
      cursor = cursor[segment];
    }
    cursor[segments[segments.length - 1]] = mapper(entry, segments);
  }
  return root;
}

function toSource(value) {
  return JSON.stringify(value, null, 2);
}

function validateThemeKeyParity(themeMaps) {
  const expectedKeys = [...themeMaps.light.keys()].sort();
  for (const [themeName, tokenMap] of Object.entries(themeMaps)) {
    const currentKeys = [...tokenMap.keys()].sort();
    if (JSON.stringify(currentKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(`Theme ${themeName} token keys diverged from light token keys.`);
    }
  }
}

function runTerrazzo(command) {
  const result = spawnSync(
    process.execPath,
    [terrazzoCliPath, command, "--config", "terrazzo.config.mjs"],
    {
      cwd: packageRoot,
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    throw new Error(`Terrazzo ${command} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function formatGeneratedArtifacts() {
  const filesToFormat = [
    path.join(generatedDir, "terrazzo-light-tokens.js"),
    path.join(generatedDir, "terrazzo-light.css.ts"),
    path.join(generatedDir, "theme.css.ts"),
    path.join(generatedDir, "tokenPaths.ts"),
    path.join(figmaBridgeGeneratedDir, "figmaCodegenMap.js"),
  ].filter((filePath) => fs.existsSync(filePath));

  if (filesToFormat.length === 0) {
    return;
  }

  const result = spawnSync(process.execPath, [oxfmtCliPath, "--write", ...filesToFormat], {
    cwd: packageRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`oxfmt failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function buildGeneratedArtifacts() {
  const tokenFiles = listTokenFiles(tokensDir);
  if (tokenFiles.length === 0) {
    throw new Error(`No .tokens.json files found under ${tokensDir}`);
  }
  if (!fs.existsSync(themeManifestPath)) {
    throw new Error(`Missing Tokens Studio theme manifest: ${themeManifestPath}`);
  }

  const primitiveMaps = listTokenFiles(path.join(tokensDir, "primitives")).map((filePath) =>
    flattenTokens(readJson(filePath))
  );
  const primitiveJson = mergeTokenFiles(path.join(tokensDir, "primitives"));
  const themeManifest = readJson(themeManifestPath);
  const commonJson = readJson(path.join(tokensDir, "semantic", "common.tokens.json"));
  const themeTokenJson = Object.fromEntries(
    Object.entries(themeFiles).map(([themeName, filePath]) => [themeName, readJson(filePath)])
  );
  const commonMap = flattenTokens(readJson(path.join(tokensDir, "semantic", "common.tokens.json")));
  const primitiveMap = mergeTokenMaps(...primitiveMaps);

  const themeMaps = Object.fromEntries(
    Object.entries(themeFiles).map(([themeName, filePath]) => [
      themeName,
      mergeTokenMaps(primitiveMap, commonMap, flattenTokens(readJson(filePath))),
    ])
  );

  validateThemeKeyParity(themeMaps);

  const semanticKeys = [...themeMaps.light.keys()].filter(
    (tokenPath) => !tokenPath.startsWith("primitive.")
  );

  const resolvedThemes = Object.fromEntries(
    Object.entries(themeMaps).map(([themeName, tokenMap]) => [
      themeName,
      nestEntries(semanticKeys, (tokenPath) =>
        resolveValue(tokenMap.get(tokenPath).value, tokenMap)
      ),
    ])
  );

  const contractShape = nestEntries(semanticKeys, () => null);
  const tokenPaths = nestEntries(semanticKeys, (tokenPath) => tokenPath);
  const tokenCssVars = nestEntries(
    semanticKeys,
    (tokenPath) => `--ds-${tokenPath.replace(/\./gu, "-")}`
  );
  const flatTokenPaths = semanticKeys.sort();
  const figmaCodegenMap = Object.fromEntries(
    flatTokenPaths.map((tokenPath) => [
      tokenPath,
      {
        cssVar: `--ds-${tokenPath.replace(/\./gu, "-")}`,
        contractAccess: `vars.${tokenPath}`,
      },
    ])
  );

  const themeCssSource = `import { createGlobalTheme, createGlobalThemeContract } from "@vanilla-extract/css";

export const vars = createGlobalThemeContract(${toSource(contractShape)}, (_value, path) => \`--ds-\${path.join("-")}\`);

export const lightTheme = createGlobalTheme(":root", vars, ${toSource(resolvedThemes.light)});
export const explicitLightTheme = createGlobalTheme(':root[data-theme="light"]', vars, ${toSource(resolvedThemes.light)});
export const darkTheme = createGlobalTheme(':root[data-theme="dark"]', vars, ${toSource(resolvedThemes.dark)});
export const dimTheme = createGlobalTheme(':root[data-theme="dim"]', vars, ${toSource(resolvedThemes.dim)});
`;

  const tokenPathsSource = `export const tokenPaths = ${toSource(tokenPaths)} as const;

export const tokenCssVars = ${toSource(tokenCssVars)} as const;

export const flatTokenPaths = ${toSource(flatTokenPaths)} as const;

export type TokenPath = (typeof flatTokenPaths)[number];
`;

  writeFile(path.join(generatedDir, "theme.css.ts"), themeCssSource);
  writeFile(path.join(generatedDir, "tokenPaths.ts"), tokenPathsSource);
  writeFile(
    path.join(generatedDir, "dtcgTokens.json"),
    `${JSON.stringify(
      {
        $schema: "https://www.designtokens.org/TR/2025.10/format/",
        $metadata: {
          product: "HugeCode",
          themes: Object.keys(themeFiles),
        },
        primitive: cloneJson(primitiveJson),
        semantic: {
          common: cloneJson(commonJson),
        },
        themes: Object.fromEntries(
          Object.entries(themeTokenJson).map(([themeName, tokenJson]) => [
            themeName,
            cloneJson(tokenJson),
          ])
        ),
        tokensStudio: {
          $themes: cloneJson(themeManifest),
        },
      },
      null,
      2
    )}\n`
  );
  writeFile(
    path.join(generatedDir, "figmaCodegenMap.json"),
    `${JSON.stringify(figmaCodegenMap, null, 2)}\n`
  );
  writeFile(
    path.join(figmaBridgeGeneratedDir, "figmaCodegenMap.js"),
    `window.__HYPECODE_FIGMA_CODEGEN_MAP__ = ${JSON.stringify(figmaCodegenMap, null, 2)};\n`
  );
}

function mergeTokenFiles(directoryPath) {
  const root = {};
  for (const filePath of listTokenFiles(directoryPath)) {
    const relativeDir = path.dirname(path.relative(directoryPath, filePath));
    const segments = relativeDir === "." ? [] : relativeDir.split(path.sep);
    let cursor = root;
    for (const segment of segments) {
      cursor[segment] ??= {};
      cursor = cursor[segment];
    }
    Object.assign(cursor, readJson(filePath));
  }
  return root;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  runTerrazzo("check");

  if (checkOnly) {
    return;
  }

  runTerrazzo("build");
  buildGeneratedArtifacts();
  formatGeneratedArtifacts();
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
