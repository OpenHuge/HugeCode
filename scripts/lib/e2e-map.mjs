import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_E2E_MAP_PATH = ".codex/e2e-map.json";
const DEFAULT_E2E_FALLBACK_CODE_CATEGORY = "smoke";
const DEFAULT_E2E_FALLBACK_CODE_PATH_PREFIXES = ["apps/code/src/", "packages/design-system/"];

const DEFAULT_E2E_CATEGORIES = [
  "core",
  "blocks",
  "collab",
  "annotations",
  "features",
  "smoke",
  "a11y",
];

const DEFAULT_E2E_RULES = [
  {
    category: "a11y",
    pathContains: ["a11y", "accessibility", "aria"],
  },
  {
    category: "annotations",
    pathContains: ["annotation", "comment", "highlight"],
  },
  {
    category: "collab",
    pathContains: ["collab", "presence", "sync", "websocket", "loro", "crdt"],
  },
  {
    category: "blocks",
    pathContains: ["block", "nodeview", "drag"],
  },
  {
    category: "features",
    pathContains: ["import", "ai", "gateway", "persistence", "connector", "marketplace", "feature"],
  },
  {
    category: "core",
    pathContains: ["core", "editor", "prosemirror", "schema", "selection", "format"],
  },
  {
    category: "smoke",
    pathContains: ["smoke", "route", "navigation", "sidebar", "page", "layout"],
  },
];

function parseStringArray(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeRule(rawRule, validCategories) {
  if (!rawRule || typeof rawRule !== "object") {
    return null;
  }

  const category =
    typeof rawRule.category === "string" ? rawRule.category.trim().toLowerCase() : "";
  if (!validCategories.has(category)) {
    return null;
  }

  const pathPrefixes = parseStringArray(rawRule.pathPrefixes).map((value) => value.toLowerCase());
  const pathContains = parseStringArray(rawRule.pathContains).map((value) => value.toLowerCase());
  const pathRegexes = [];
  for (const pattern of parseStringArray(rawRule.pathRegex)) {
    try {
      pathRegexes.push(new RegExp(pattern, "u"));
    } catch {
      // Ignore invalid regex patterns from config.
    }
  }

  if (pathPrefixes.length === 0 && pathContains.length === 0 && pathRegexes.length === 0) {
    return null;
  }

  return {
    category,
    pathPrefixes,
    pathContains,
    pathRegexes,
  };
}

function buildDefaultConfig() {
  const categories = [...DEFAULT_E2E_CATEGORIES];
  const validCategories = new Set(categories);
  const rules = DEFAULT_E2E_RULES.map((rule) => normalizeRule(rule, validCategories)).filter(
    (rule) => rule !== null
  );
  return {
    categories,
    rules,
    fallbackCodeCategory: DEFAULT_E2E_FALLBACK_CODE_CATEGORY,
    fallbackCodePathPrefixes: [...DEFAULT_E2E_FALLBACK_CODE_PATH_PREFIXES],
  };
}

export function loadE2EMapConfig({
  repoRoot = process.cwd(),
  mapPath = DEFAULT_E2E_MAP_PATH,
} = {}) {
  const defaults = buildDefaultConfig();
  const absolutePath = path.join(repoRoot, mapPath);
  if (!fs.existsSync(absolutePath)) {
    return defaults;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    return defaults;
  }

  if (!parsed || typeof parsed !== "object") {
    return defaults;
  }

  const configuredCategories = parseStringArray(parsed.categories).map((value) =>
    value.toLowerCase()
  );
  const categories =
    configuredCategories.length > 0 ? [...new Set(configuredCategories)] : defaults.categories;
  const validCategories = new Set(categories);
  const rawRules = Array.isArray(parsed.rules) ? parsed.rules : [];
  const rules = rawRules
    .map((rule) => normalizeRule(rule, validCategories))
    .filter((rule) => rule !== null);
  const fallbackSection =
    parsed.fallback && typeof parsed.fallback === "object" ? parsed.fallback : {};
  const fallbackRaw = fallbackSection.codeSrcCategory;
  const fallbackCandidate =
    typeof fallbackRaw === "string"
      ? fallbackRaw.trim().toLowerCase()
      : defaults.fallbackCodeCategory;
  const fallbackCodeCategory = validCategories.has(fallbackCandidate)
    ? fallbackCandidate
    : defaults.fallbackCodeCategory;
  const fallbackCodePathPrefixes = (() => {
    const configuredPrefixes = parseStringArray(fallbackSection.codeSrcPrefixes)
      .map((value) => value.toLowerCase())
      .map((value) => value.split(path.sep).join("/"))
      .filter(Boolean);
    return configuredPrefixes.length > 0
      ? [...new Set(configuredPrefixes)]
      : defaults.fallbackCodePathPrefixes;
  })();

  return {
    categories,
    rules: rules.length > 0 ? rules : defaults.rules,
    fallbackCodeCategory,
    fallbackCodePathPrefixes,
  };
}

export function ruleMatchesPath(rule, normalizedPath) {
  if (rule.pathPrefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
    return true;
  }
  if (rule.pathContains.some((token) => normalizedPath.includes(token))) {
    return true;
  }
  return rule.pathRegexes.some((regex) => regex.test(normalizedPath));
}

export function normalizeE2ECategories(categories, config) {
  const validSet = new Set(config.categories);
  const categoryOrder = new Map(config.categories.map((category, index) => [category, index]));

  return [...new Set(categories)]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => validSet.has(value))
    .sort((left, right) => (categoryOrder.get(left) ?? 0) - (categoryOrder.get(right) ?? 0));
}

export function recommendE2ECategoriesFromPaths(
  filePaths,
  { config, skipPath = null, fallbackCodePathPrefixes = null } = {}
) {
  const categories = new Set();
  const candidateFallbackPrefixes =
    Array.isArray(fallbackCodePathPrefixes) && fallbackCodePathPrefixes.length > 0
      ? fallbackCodePathPrefixes
      : config.fallbackCodePathPrefixes;
  const normalizedFallbackPrefixes = candidateFallbackPrefixes
    .filter((value) => typeof value === "string")
    .map((value) => value.toLowerCase())
    .map((value) => value.split(path.sep).join("/"))
    .filter(Boolean);
  let hasFallbackScopeChanges = false;

  for (const rawFilePath of filePaths) {
    const normalizedPath = rawFilePath.split(path.sep).join("/").toLowerCase();
    if (typeof skipPath === "function" && skipPath(normalizedPath)) {
      continue;
    }

    if (normalizedFallbackPrefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
      hasFallbackScopeChanges = true;
    }

    for (const rule of config.rules) {
      if (ruleMatchesPath(rule, normalizedPath)) {
        categories.add(rule.category);
      }
    }
  }

  if (categories.size === 0 && hasFallbackScopeChanges && config.fallbackCodeCategory) {
    categories.add(config.fallbackCodeCategory);
  }

  return normalizeE2ECategories([...categories], config);
}
