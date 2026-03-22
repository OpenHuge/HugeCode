import path from "node:path";

export const STYLE_GUARD_EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".codex",
  ".figma-workflow",
  ".next",
  ".turbo",
  ".out",
  "storybook-static",
]);

export const STYLE_GUARD_SCAN_ROOTS = ["apps/code", "apps/code-web", "packages/design-system"];

export const SEMANTIC_STYLE_GUARD_SCAN_ROOTS = ["apps/code", "apps/code-web"];

export const STYLE_GUARD_ALLOWED_COLOR_LITERAL_PREFIXES = ["packages/design-system/src/"];

export const STYLE_GUARD_ALLOWED_COLOR_LITERAL_FILES = new Set([]);

export const STYLE_GUARD_ALLOWED_LEGACY_ALIAS_FILES = new Set([
  "apps/code/src/styles/tokens/dsAliases.css.ts",
]);

export const STYLE_GUARD_ALLOWED_COLOR_MIX_PREFIXES = ["packages/design-system/src/"];

export const STYLE_GUARD_ALLOWED_COLOR_MIX_FILES = new Set([
  "apps/code/src/styles/tokens/dsAliases.css.ts",
]);

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function isExcludedStyleDirectory(directoryName) {
  return STYLE_GUARD_EXCLUDED_DIRS.has(directoryName);
}

export function isAllowedColorLiteralPath(filePath) {
  return (
    STYLE_GUARD_ALLOWED_COLOR_LITERAL_FILES.has(filePath) ||
    STYLE_GUARD_ALLOWED_COLOR_LITERAL_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  );
}

export function isAllowedColorMixPath(filePath) {
  return (
    STYLE_GUARD_ALLOWED_COLOR_MIX_FILES.has(filePath) ||
    STYLE_GUARD_ALLOWED_COLOR_MIX_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  );
}

export function isAllowedLegacyAliasPath(filePath) {
  return STYLE_GUARD_ALLOWED_LEGACY_ALIAS_FILES.has(filePath);
}
