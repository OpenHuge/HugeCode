import { normalizePathForDisplay } from "./platformPaths";

const FILE_LINK_PROTOCOL = "codex-file:";
const FILE_LINE_SUFFIX_PATTERN = "(?::\\d+(?::\\d+)?)?";

const FILE_PATH_PATTERN = new RegExp(
  `(\\\\\\\\\\?\\\\UNC\\\\[^\\s\\\`"'<>]+|\\\\\\?\\\\UNC\\\\[^\\s\\\`"'<>]+|\\\\\\\\\\?\\\\[A-Za-z]:\\\\[^\\s\\\`"'<>]+|\\\\\\?\\\\[A-Za-z]:\\\\[^\\s\\\`"'<>]+|[A-Za-z]:\\\\[^\\s\\\`"'<>]+|\\\\\\\\[^\\s\\\`"'<>]+\\\\[^\\s\\\`"'<>]+|\\/[^\\s\\\`"'<>]+|~\\/[^\\s\\\`"'<>]+|\\.{1,2}\\/[^\\s\\\`"'<>]+|[A-Za-z0-9._-]+(?:\\/[A-Za-z0-9._-]+)+)${FILE_LINE_SUFFIX_PATTERN}`,
  "g"
);
const FILE_PATH_MATCH = new RegExp(`^${FILE_PATH_PATTERN.source}$`);

const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}"]);
const RELATIVE_ALLOWED_PREFIXES = [
  "src/",
  "app/",
  "lib/",
  "tests/",
  "test/",
  "packages/",
  "apps/",
  "docs/",
  "scripts/",
];

function normalizeCandidateForMatching(value: string) {
  return normalizePathForDisplay(value.trim()).replace(/\\/g, "/");
}

function normalizeLinkTargetPath(value: string) {
  return normalizePathForDisplay(value.trim());
}

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

function isPathCandidate(value: string, leadingContext: string, previousChar: string) {
  const normalizedValue = normalizeCandidateForMatching(value);
  if (!normalizedValue.includes("/")) {
    return false;
  }
  const isWindowsNetworkPath =
    value.startsWith("\\\\") || value.startsWith("//") || value.startsWith("\\\\?\\UNC\\");
  if (normalizedValue.startsWith("//") && !isWindowsNetworkPath) {
    return false;
  }
  if (leadingContext.endsWith("://")) {
    return false;
  }
  if (
    normalizedValue.startsWith("/") ||
    normalizedValue.startsWith("./") ||
    normalizedValue.startsWith("../")
  ) {
    if (normalizedValue.startsWith("/") && previousChar && /[A-Za-z0-9.]/.test(previousChar)) {
      return false;
    }
    return true;
  }
  if (
    normalizedValue.startsWith("~/") ||
    /^[A-Za-z]:\//.test(normalizedValue) ||
    normalizedValue.startsWith("//")
  ) {
    return true;
  }
  const lastSegment = normalizedValue.split("/").pop() ?? "";
  if (lastSegment.includes(".")) {
    return true;
  }
  return RELATIVE_ALLOWED_PREFIXES.some((prefix) => normalizedValue.startsWith(prefix));
}

function splitTrailingPunctuation(value: string) {
  let end = value.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(value[end - 1])) {
    end -= 1;
  }
  return {
    path: value.slice(0, end),
    trailing: value.slice(end),
  };
}

export function toFileLink(path: string) {
  return `${FILE_LINK_PROTOCOL}${encodeURIComponent(path)}`;
}

function linkifyText(value: string) {
  FILE_PATH_PATTERN.lastIndex = 0;
  const nodes: MarkdownNode[] = [];
  let lastIndex = 0;
  let hasLink = false;

  for (const match of value.matchAll(FILE_PATH_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const raw = match[0];
    if (matchIndex > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, matchIndex) });
    }

    const leadingContext = value.slice(Math.max(0, matchIndex - 3), matchIndex);
    const previousChar = matchIndex > 0 ? value[matchIndex - 1] : "";
    const { path, trailing } = splitTrailingPunctuation(raw);
    if (path && isPathCandidate(path, leadingContext, previousChar)) {
      const linkTarget = normalizeLinkTargetPath(path);
      nodes.push({
        type: "link",
        url: toFileLink(linkTarget),
        children: [{ type: "text", value: linkTarget }],
      });
      if (trailing) {
        nodes.push({ type: "text", value: trailing });
      }
      hasLink = true;
    } else {
      nodes.push({ type: "text", value: raw });
    }

    lastIndex = matchIndex + raw.length;
  }

  if (lastIndex < value.length) {
    nodes.push({ type: "text", value: value.slice(lastIndex) });
  }

  return hasLink ? nodes : null;
}

function isSkippableParent(parentType?: string) {
  return parentType === "link" || parentType === "inlineCode" || parentType === "code";
}

function walk(node: MarkdownNode, parentType?: string) {
  if (!node.children) {
    return;
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    if (
      child.type === "text" &&
      typeof child.value === "string" &&
      !isSkippableParent(parentType)
    ) {
      const nextNodes = linkifyText(child.value);
      if (nextNodes) {
        node.children.splice(index, 1, ...nextNodes);
        index += nextNodes.length - 1;
        continue;
      }
    }
    walk(child, child.type);
  }
}

export function remarkFileLinks() {
  return (tree: MarkdownNode) => {
    walk(tree);
  };
}

export function isLinkableFilePath(value: string) {
  const trimmed = normalizeLinkTargetPath(value);
  if (!trimmed) {
    return false;
  }
  if (!FILE_PATH_MATCH.test(trimmed)) {
    return false;
  }
  return isPathCandidate(trimmed, "", "");
}

export function isFileLinkUrl(url: string) {
  return url.startsWith(FILE_LINK_PROTOCOL);
}

export function decodeFileLink(url: string) {
  return decodeURIComponent(url.slice(FILE_LINK_PROTOCOL.length));
}
