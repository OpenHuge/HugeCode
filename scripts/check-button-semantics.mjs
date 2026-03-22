#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repoRoot = process.cwd();
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const TARGET_ROOT = "apps/code/src/";
const TARGET_EXTENSION = ".tsx";

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function listFromGit(gitArgs) {
  const output = execFileSync("git", gitArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(toPosixPath);
}

function collectChangedFiles() {
  const fromValidate = process.env[SHARED_CHANGED_FILES_ENV_KEY];
  if (fromValidate) {
    try {
      const parsed = JSON.parse(fromValidate);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((value) => toPosixPath(String(value))))].sort((left, right) =>
          left.localeCompare(right)
        );
      }
    } catch {
      // fall through to git-based discovery
    }
  }

  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right));
}

function collectTargetFiles() {
  return collectChangedFiles().filter(
    (filePath) => filePath.startsWith(TARGET_ROOT) && filePath.endsWith(TARGET_EXTENSION)
  );
}

function readJsxAttribute(opening, name) {
  for (const prop of opening.attributes.properties) {
    if (!ts.isJsxAttribute(prop)) {
      continue;
    }
    if (prop.name.text === name) {
      return prop;
    }
  }
  return null;
}

function hasNonEmptyJsxAttribute(opening, name) {
  const attribute = readJsxAttribute(opening, name);
  if (!attribute) {
    return false;
  }
  if (!attribute.initializer) {
    return true;
  }
  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text.trim().length > 0;
  }
  if (ts.isJsxExpression(attribute.initializer)) {
    const expression = attribute.initializer.expression;
    if (!expression) {
      return false;
    }
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text.trim().length > 0;
    }
    return true;
  }
  return true;
}

function containsNonLiteralExpression(nodes) {
  for (const node of nodes) {
    if (ts.isJsxExpression(node)) {
      if (
        node.expression &&
        !ts.isStringLiteral(node.expression) &&
        !ts.isNoSubstitutionTemplateLiteral(node.expression)
      ) {
        return true;
      }
      continue;
    }
    if (ts.isJsxElement(node) && containsNonLiteralExpression(node.children)) {
      return true;
    }
  }
  return false;
}

function collectRenderedText(nodes) {
  let text = "";
  for (const node of nodes) {
    if (ts.isJsxText(node)) {
      text += node.getText();
      continue;
    }
    if (ts.isJsxExpression(node)) {
      const expression = node.expression;
      if (
        expression &&
        (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
      ) {
        text += expression.text;
      }
      continue;
    }
    if (ts.isJsxElement(node)) {
      text += collectRenderedText(node.children);
    }
  }
  return text.trim();
}

function isIconOnlyButton(node) {
  if (!ts.isJsxElement(node)) {
    return false;
  }
  if (containsNonLiteralExpression(node.children)) {
    return false;
  }
  return collectRenderedText(node.children).length === 0;
}

function findViolationsInFile(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const violations = [];

  const visit = (node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === "button") {
      const opening = node.openingElement;
      if (!readJsxAttribute(opening, "type")) {
        const lineInfo = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
        violations.push({
          filePath,
          lineNumber: lineInfo.line + 1,
          kind: "missing-type",
          detail: "<button> requires an explicit type attribute.",
        });
      }
      const hasAccessibleName =
        hasNonEmptyJsxAttribute(opening, "aria-label") ||
        hasNonEmptyJsxAttribute(opening, "aria-labelledby");
      if (isIconOnlyButton(node) && !hasAccessibleName) {
        const lineInfo = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
        violations.push({
          filePath,
          lineNumber: lineInfo.line + 1,
          kind: "icon-only-missing-label",
          detail: "Icon-only button requires aria-label or aria-labelledby.",
        });
      }
    }
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(sourceFile) === "button" &&
      !readJsxAttribute(node, "type")
    ) {
      const lineInfo = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({
        filePath,
        lineNumber: lineInfo.line + 1,
        kind: "missing-type",
        detail: "<button /> requires an explicit type attribute.",
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

function main() {
  const targetFiles = collectTargetFiles();
  if (targetFiles.length === 0) {
    return;
  }

  const violations = targetFiles.flatMap((filePath) => findViolationsInFile(filePath));
  if (violations.length === 0) {
    return;
  }

  for (const violation of violations) {
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
}
