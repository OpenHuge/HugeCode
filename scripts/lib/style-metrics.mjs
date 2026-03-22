import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const STYLE_ROOT = "apps/code/src/styles";
const STYLE_EXTENSION = ".css.ts";
const LOCAL_STYLE_ROOTS = ["apps/code/src/features", "apps/code/src/design-system"];
const STYLE_ALL_ROOTS = [STYLE_ROOT, ...LOCAL_STYLE_ROOTS];
const SOURCE_ROOT = "apps/code/src";
const SOURCE_EXTENSION = ".tsx";
const OVERSIZED_STYLE_THRESHOLD = 1314;
const BRIDGE_FILE_PATTERNS = [/Legacy\.global\.css\.ts$/u, /Panels\.global\.css\.ts$/u];
const EXCLUDED_DIRS = new Set([".codex", ".figma-workflow"]);

const DUPLICATE_SELECTOR_ALLOWLIST_EXACT = new Set([":root"]);
const DUPLICATE_SELECTOR_ALLOWLIST_PREFIXES = [":root["];

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function collectFiles(rootDir, extension) {
  const absoluteRoot = path.join(process.cwd(), rootDir);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const files = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
        continue;
      }
      throw error;
    }
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) {
          continue;
        }
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(extension)) {
        continue;
      }
      files.push(toPosixPath(path.relative(process.cwd(), absolutePath)));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function countFileLines(filePath) {
  const content = fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
  if (content.length === 0) {
    return 0;
  }
  return content.split(/\r?\n/u).length;
}

function countGlobalStyleCalls(content) {
  return (content.match(/globalStyle\(/gu) ?? []).length;
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/gu, " ").trim();
}

function isDuplicateSelectorAllowed(selector) {
  if (DUPLICATE_SELECTOR_ALLOWLIST_EXACT.has(selector)) {
    return true;
  }
  return DUPLICATE_SELECTOR_ALLOWLIST_PREFIXES.some((prefix) => selector.startsWith(prefix));
}

function extractGlobalStyleSelectors(content) {
  const selectors = [];
  const globalStylePattern = /globalStyle\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/gu;
  for (const match of content.matchAll(globalStylePattern)) {
    const selector = normalizeSelector(match[2] ?? "");
    if (selector.length > 0) {
      selectors.push(selector);
    }
  }
  return selectors;
}

function countDuplicateGlobalSelectors(styleFiles) {
  const selectorToFiles = new Map();
  for (const filePath of styleFiles) {
    const absolutePath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const selectors = new Set(extractGlobalStyleSelectors(content));
    for (const selector of selectors) {
      if (isDuplicateSelectorAllowed(selector)) {
        continue;
      }
      const files = selectorToFiles.get(selector) ?? new Set();
      files.add(filePath);
      selectorToFiles.set(selector, files);
    }
  }

  let duplicates = 0;
  for (const files of selectorToFiles.values()) {
    if (files.size > 1) {
      duplicates += 1;
    }
  }
  return duplicates;
}

function countBridgeStyleFiles(styleFiles) {
  return styleFiles.filter((filePath) =>
    BRIDGE_FILE_PATTERNS.some((pattern) => pattern.test(filePath))
  ).length;
}

function isGlobalStyleFile(filePath) {
  return filePath.endsWith(".global.css.ts");
}

function countButtonWithoutType() {
  const tsxFiles = collectFiles(SOURCE_ROOT, SOURCE_EXTENSION);
  let missing = 0;

  for (const filePath of tsxFiles) {
    const absolutePath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const sourceFile = ts.createSourceFile(
      absolutePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    const hasTypeAttribute = (opening) =>
      opening.attributes.properties.some(
        (property) => ts.isJsxAttribute(property) && property.name.text === "type"
      );

    const visit = (node) => {
      if (ts.isJsxElement(node)) {
        const opening = node.openingElement;
        if (opening.tagName.getText(sourceFile) === "button" && !hasTypeAttribute(opening)) {
          missing += 1;
        }
      } else if (ts.isJsxSelfClosingElement(node)) {
        if (node.tagName.getText(sourceFile) === "button" && !hasTypeAttribute(node)) {
          missing += 1;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return missing;
}

function countLocalStyleModules() {
  return LOCAL_STYLE_ROOTS.reduce(
    (total, rootDir) => total + collectFiles(rootDir, STYLE_EXTENSION).length,
    0
  );
}

export function collectStyleMetrics() {
  const styleFiles = collectFiles(STYLE_ROOT, STYLE_EXTENSION);
  const styleFilesAll = STYLE_ALL_ROOTS.flatMap((rootDir) =>
    collectFiles(rootDir, STYLE_EXTENSION)
  );
  const dedupedStyleFilesAll = [...new Set(styleFilesAll)].sort((left, right) =>
    left.localeCompare(right)
  );
  const dedupedStyleFilesManaged = dedupedStyleFilesAll.filter(
    (filePath) => !isGlobalStyleFile(filePath)
  );
  let styleTotalLines = 0;
  let globalStyleCount = 0;
  const oversizedStyleFiles = [];
  let styleTotalLinesAllRaw = 0;
  let globalStyleCountAllRaw = 0;
  const oversizedStyleFilesAllRaw = [];
  let styleTotalLinesAll = 0;
  let globalStyleCountAll = 0;
  const oversizedStyleFilesAll = [];

  for (const filePath of styleFiles) {
    const absolutePath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const lineCount = countFileLines(filePath);
    styleTotalLines += lineCount;
    globalStyleCount += countGlobalStyleCalls(content);
    if (lineCount >= OVERSIZED_STYLE_THRESHOLD) {
      oversizedStyleFiles.push({ filePath, lines: lineCount });
    }
  }

  for (const filePath of dedupedStyleFilesAll) {
    const absolutePath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const lineCount = countFileLines(filePath);
    styleTotalLinesAllRaw += lineCount;
    globalStyleCountAllRaw += countGlobalStyleCalls(content);
    if (lineCount >= OVERSIZED_STYLE_THRESHOLD) {
      oversizedStyleFilesAllRaw.push({ filePath, lines: lineCount });
    }
    if (isGlobalStyleFile(filePath)) {
      continue;
    }
    styleTotalLinesAll += lineCount;
    globalStyleCountAll += countGlobalStyleCalls(content);
    if (lineCount >= OVERSIZED_STYLE_THRESHOLD) {
      oversizedStyleFilesAll.push({ filePath, lines: lineCount });
    }
  }

  oversizedStyleFiles.sort(
    (left, right) => right.lines - left.lines || left.filePath.localeCompare(right.filePath)
  );
  oversizedStyleFilesAll.sort(
    (left, right) => right.lines - left.lines || left.filePath.localeCompare(right.filePath)
  );
  oversizedStyleFilesAllRaw.sort(
    (left, right) => right.lines - left.lines || left.filePath.localeCompare(right.filePath)
  );

  return {
    styleFileCount: styleFiles.length,
    styleTotalLines,
    globalStyleCount,
    localStyleModuleCount: countLocalStyleModules(),
    oversizedStyleFiles,
    buttonWithoutTypeCount: countButtonWithoutType(),
    duplicateSelectorCount: countDuplicateGlobalSelectors(styleFiles),
    styleFileCountAll: dedupedStyleFilesManaged.length,
    styleTotalLinesAll,
    globalStyleCountAll,
    styleFileCountAllRaw: dedupedStyleFilesAll.length,
    styleTotalLinesAllRaw,
    globalStyleCountAllRaw,
    oversizedCssTsFilesAllRaw: oversizedStyleFilesAllRaw,
    oversizedStyleFilesAllRaw,
    oversizedCssTsFilesAll: oversizedStyleFilesAll,
    oversizedStyleFilesAll,
    duplicateSelectorCountAllRaw: countDuplicateGlobalSelectors(dedupedStyleFilesAll),
    duplicateSelectorCountAll: countDuplicateGlobalSelectors(dedupedStyleFilesManaged),
    bridgeStyleFileCount: countBridgeStyleFiles(dedupedStyleFilesAll),
  };
}
