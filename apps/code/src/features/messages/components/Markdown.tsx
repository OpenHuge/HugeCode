import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import "./MessagesRichContent.styles.css";
import "./MarkdownSkillReference.global.css";
import { openUrl } from "../../../application/runtime/facades/desktopHostFacade";
import Box from "lucide-react/dist/esm/icons/box";
import { Button, Tooltip } from "../../../design-system";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { joinClassNames } from "../../../utils/classNames";
import type { SkillOption } from "../../../types";
import {
  decodeFileLink,
  isFileLinkUrl,
  isLinkableFilePath,
  remarkFileLinks,
  toFileLink,
} from "../../../utils/remarkFileLinks";
import { normalizePathForDisplay } from "../../../utils/platformPaths";
import { highlightLineSegments } from "../../../utils/syntax";
import {
  buildSkillMetaChips,
  buildSkillStateChips,
  findSkillByReferenceName,
  formatSkillScopeLabel,
  formatSkillSourceLabel,
  SKILL_REFERENCE_SCHEME,
  splitTextWithSkillReferences,
} from "../../skills/utils/skillPresentation";
import * as styles from "./Markdown.styles.css";

type MarkdownProps = {
  value: string;
  skills?: SkillOption[];
  className?: string;
  codeBlock?: boolean;
  codeBlockStyle?: "default" | "message";
  codeBlockCopyUseModifier?: boolean;
  showFilePath?: boolean;
  workspacePath?: string | null;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  onOpenThreadLink?: (threadId: string) => void;
};

type CodeBlockProps = {
  className?: string;
  value: string;
  copyUseModifier: boolean;
};

type PreProps = {
  node?: {
    tagName?: string;
    children?: Array<{
      tagName?: string;
      properties?: { className?: string[] | string };
      children?: Array<{ value?: string }>;
    }>;
  };
  children?: ReactNode;
  copyUseModifier: boolean;
};

type LinkBlockProps = {
  urls: string[];
};

type FileReferenceDisplayMode = "compact" | "full";

type ParsedFileReference = {
  fullPath: string;
  fileName: string;
  lineLabel: string | null;
  parentPath: string | null;
};

type MarkdownParentNode = {
  type?: string;
  children?: MarkdownNode[];
};

type MarkdownNode = {
  type?: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MarkdownNode[];
};

async function openExternalUrl(url: string) {
  try {
    const opened = await openUrl(url);
    if (opened) {
      return;
    }
  } catch (error) {
    pushErrorToast({
      title: "Couldn’t open link",
      message: error instanceof Error ? error.message : "Unable to open link.",
    });
    return;
  }

  pushErrorToast({
    title: "Couldn’t open link",
    message: "Unable to open link.",
  });
}

function normalizePathSeparators(path: string) {
  return path.replace(/\\/g, "/");
}

function trimTrailingPathSeparators(path: string) {
  return path.replace(/\/+$/, "");
}

function isWindowsAbsolutePath(path: string) {
  return /^[A-Za-z]:\//.test(path);
}

function isAbsolutePath(path: string) {
  return path.startsWith("/") || isWindowsAbsolutePath(path);
}

function extractPathRoot(path: string) {
  if (isWindowsAbsolutePath(path)) {
    return path.slice(0, 2).toLowerCase();
  }
  if (path.startsWith("/")) {
    return "/";
  }
  return "";
}

function splitAbsolutePath(path: string) {
  const root = extractPathRoot(path);
  if (!root) {
    return null;
  }
  const withoutRoot = root === "/" ? path.slice(1) : path.slice(2).replace(/^\/+/, "");
  return {
    root,
    segments: withoutRoot.split("/").filter(Boolean),
  };
}

function toRelativePath(fromPath: string, toPath: string) {
  const fromAbsolute = splitAbsolutePath(fromPath);
  const toAbsolute = splitAbsolutePath(toPath);
  if (!fromAbsolute || !toAbsolute) {
    return null;
  }
  if (fromAbsolute.root !== toAbsolute.root) {
    return null;
  }
  const caseInsensitive = fromAbsolute.root !== "/";
  let commonLength = 0;
  while (
    commonLength < fromAbsolute.segments.length &&
    commonLength < toAbsolute.segments.length &&
    (caseInsensitive
      ? fromAbsolute.segments[commonLength].toLowerCase() ===
        toAbsolute.segments[commonLength].toLowerCase()
      : fromAbsolute.segments[commonLength] === toAbsolute.segments[commonLength])
  ) {
    commonLength += 1;
  }
  const backtrack = new Array(fromAbsolute.segments.length - commonLength).fill("..");
  const forward = toAbsolute.segments.slice(commonLength);
  return [...backtrack, ...forward].join("/");
}

function relativeDisplayPath(path: string, workspacePath?: string | null) {
  const normalizedPath = trimTrailingPathSeparators(
    normalizePathSeparators(normalizePathForDisplay(path.trim()))
  );
  if (!workspacePath) {
    return normalizedPath;
  }
  const normalizedWorkspace = trimTrailingPathSeparators(
    normalizePathSeparators(normalizePathForDisplay(workspacePath.trim()))
  );
  if (!normalizedWorkspace) {
    return normalizedPath;
  }
  if (!isAbsolutePath(normalizedPath) || !isAbsolutePath(normalizedWorkspace)) {
    return normalizedPath;
  }
  const relative = toRelativePath(normalizedWorkspace, normalizedPath);
  if (relative === null) {
    return normalizedPath;
  }
  if (relative.length === 0) {
    const segments = normalizedPath.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : normalizedPath;
  }
  return relative;
}

function extractLanguageTag(className?: string) {
  if (!className) {
    return null;
  }
  const match = className.match(/language-([\w-]+)/i);
  if (!match) {
    return null;
  }
  return match[1];
}

function extractCodeFromPre(node?: PreProps["node"]) {
  const codeNode = node?.children?.find((child) => child.tagName === "code");
  const className = codeNode?.properties?.className;
  const normalizedClassName = Array.isArray(className) ? className.join(" ") : className;
  const value = codeNode?.children?.map((child) => child.value ?? "").join("") ?? "";
  return {
    className: normalizedClassName,
    value: value.replace(/\n$/, ""),
  };
}

function normalizeUrlLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const withoutBullet = trimmed.replace(/^(?:[-*]|\d+\.)\s+/, "");
  if (!/^https?:\/\/\S+$/i.test(withoutBullet)) {
    return null;
  }
  return withoutBullet;
}

function extractUrlLines(value: string) {
  const lines = value.split(/\r?\n/);
  const urls = lines
    .map((line) => normalizeUrlLine(line))
    .filter((line): line is string => Boolean(line));
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return null;
  }
  if (urls.length !== nonEmptyLines.length) {
    return null;
  }
  return urls;
}

function normalizeListIndentation(value: string) {
  const lines = value.split(/\r?\n/);
  let inFence = false;
  let activeOrderedItem = false;
  let orderedBaseIndent = 4;
  let orderedIndentOffset: number | null = null;

  const countLeadingSpaces = (line: string) => line.match(/^\s*/)?.[0].length ?? 0;
  const spaces = (count: number) => " ".repeat(Math.max(0, count));
  const normalized = lines.map((line) => {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      inFence = !inFence;
      activeOrderedItem = false;
      orderedIndentOffset = null;
      return line;
    }
    if (inFence) {
      return line;
    }
    if (!line.trim()) {
      return line;
    }

    const orderedMatch = line.match(/^(\s*)\d+\.\s+/);
    if (orderedMatch) {
      const rawIndent = orderedMatch[1].length;
      const normalizedIndent = rawIndent > 0 && rawIndent < 4 ? 4 : rawIndent;
      activeOrderedItem = true;
      orderedBaseIndent = normalizedIndent + 4;
      orderedIndentOffset = null;
      if (normalizedIndent !== rawIndent) {
        return `${spaces(normalizedIndent)}${line.trimStart()}`;
      }
      return line;
    }

    const bulletMatch = line.match(/^(\s*)([-*+])\s+/);
    if (bulletMatch) {
      const rawIndent = bulletMatch[1].length;
      let targetIndent = rawIndent;

      if (!activeOrderedItem && rawIndent > 0 && rawIndent < 4) {
        targetIndent = 4;
      }

      if (activeOrderedItem) {
        if (orderedIndentOffset === null && rawIndent < orderedBaseIndent) {
          orderedIndentOffset = orderedBaseIndent - rawIndent;
        }
        if (orderedIndentOffset !== null) {
          const adjustedIndent = rawIndent + orderedIndentOffset;
          if (adjustedIndent <= orderedBaseIndent + 12) {
            targetIndent = adjustedIndent;
          }
        }
      }

      if (targetIndent !== rawIndent) {
        return `${spaces(targetIndent)}${line.trimStart()}`;
      }
      return line;
    }

    const leadingSpaces = countLeadingSpaces(line);
    if (activeOrderedItem && leadingSpaces < orderedBaseIndent) {
      activeOrderedItem = false;
      orderedIndentOffset = null;
    }
    return line;
  });
  return normalized.join("\n");
}

function LinkBlock({ urls }: LinkBlockProps) {
  const urlCounts = new Map<string, number>();
  return (
    <div className={styles.markdownLinkblock}>
      {urls.map((url) => {
        const occurrence = (urlCounts.get(url) ?? 0) + 1;
        urlCounts.set(url, occurrence);
        const key = occurrence === 1 ? url : `${url}#${occurrence}`;
        return (
          <a
            key={key}
            href={url}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openExternalUrl(url);
            }}
          >
            {url}
          </a>
        );
      })}
    </div>
  );
}

function parseFileReference(rawPath: string, workspacePath?: string | null): ParsedFileReference {
  const trimmed = rawPath.trim();
  const lineMatch = trimmed.match(/^(.*?):(\d+(?::\d+)?)$/);
  const pathWithoutLine = (lineMatch?.[1] ?? trimmed).trim();
  const lineLabel = lineMatch?.[2] ?? null;
  const displayPath = relativeDisplayPath(pathWithoutLine, workspacePath);
  const normalizedPath = trimTrailingPathSeparators(displayPath) || displayPath;
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  const fallbackFile = normalizedPath || trimmed;
  const fileName = lastSlashIndex >= 0 ? normalizedPath.slice(lastSlashIndex + 1) : fallbackFile;
  const rawParentPath = lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : "";
  const parentPath = rawParentPath || (normalizedPath.startsWith("/") ? "/" : null);

  return {
    fullPath: trimmed,
    fileName,
    lineLabel,
    parentPath,
  };
}

function normalizeDisplayFileReference(rawPath: string) {
  const trimmed = rawPath.trim();
  const lineMatch = trimmed.match(/^(.*?):(\d+(?::\d+)?)$/);
  const pathWithoutLine = normalizePathForDisplay((lineMatch?.[1] ?? trimmed).trim());
  const lineLabel = lineMatch?.[2] ?? null;
  return lineLabel ? `${pathWithoutLine}:${lineLabel}` : pathWithoutLine;
}

function FileReferenceLink({
  href,
  rawPath,
  showFilePath,
  workspacePath,
  displayMode = "compact",
  onClick,
  onContextMenu,
}: {
  href: string;
  rawPath: string;
  showFilePath: boolean;
  workspacePath?: string | null;
  displayMode?: FileReferenceDisplayMode;
  onClick: (event: React.MouseEvent, path: string) => void;
  onContextMenu: (event: React.MouseEvent, path: string) => void;
}) {
  const { fullPath, fileName, lineLabel, parentPath } = parseFileReference(rawPath, workspacePath);
  const fullDisplayPath = normalizeDisplayFileReference(rawPath);
  return (
    <a
      href={href}
      className={styles.messageFileLink}
      title={fullPath}
      onClick={(event) => onClick(event, rawPath)}
      onContextMenu={(event) => onContextMenu(event, rawPath)}
    >
      {displayMode === "full" ? (
        <span className={styles.messageFileLinkName}>{fullDisplayPath}</span>
      ) : (
        <>
          <span className={styles.messageFileLinkName}>{fileName}</span>
          {lineLabel ? <span className={styles.messageFileLinkLine}>L{lineLabel}</span> : null}
          {showFilePath && parentPath ? (
            <span className={styles.messageFileLinkPath}>in {parentPath}</span>
          ) : null}
        </>
      )}
    </a>
  );
}

function CodeBlock({ className, value, copyUseModifier }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const languageTag = extractLanguageTag(className);
  const languageLabel = languageTag ?? "Code";
  const fencedValue = `\`\`\`${languageTag ?? ""}\n${value}\n\`\`\``;
  const highlightedSegments = highlightLineSegments(value, languageTag);
  let highlightedOffset = 0;

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    try {
      const shouldFence = copyUseModifier ? event.altKey : true;
      const nextValue = shouldFence ? fencedValue : value;
      await navigator.clipboard.writeText(nextValue);
      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      // No-op: clipboard errors can occur in restricted contexts.
    }
  };

  return (
    <div className={styles.markdownCodeblock}>
      <div className={styles.markdownCodeblockHeader}>
        <span className={styles.markdownCodeblockLanguage}>{languageLabel}</span>
        <Button
          variant="ghost"
          size="sm"
          className={joinClassNames(
            styles.markdownCodeblockCopy,
            copied ? styles.stateCopied : null
          )}
          onClick={handleCopy}
          aria-label="Copy code block"
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className={styles.markdownCodeblockPre}>
        <code className={className}>
          {highlightedSegments.map((segment) => {
            const key = `${segment.className ?? "plain"}:${highlightedOffset}`;
            highlightedOffset += segment.text.length;
            return segment.className ? (
              <span key={key} className={segment.className}>
                {segment.text}
              </span>
            ) : (
              <span key={key}>{segment.text}</span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function PreBlock({ node, children, copyUseModifier }: PreProps) {
  const { className, value } = extractCodeFromPre(node);
  if (!className && !value && children) {
    return <pre>{children}</pre>;
  }
  const urlLines = extractUrlLines(value);
  if (urlLines) {
    return <LinkBlock urls={urlLines} />;
  }
  return <CodeBlock className={className} value={value} copyUseModifier={copyUseModifier} />;
}

function createSkillReferenceRemarkPlugin(skills: SkillOption[]) {
  const blockedParentTypes = new Set(["link", "linkReference", "definition", "inlineCode", "code"]);

  const transformChildren = (parent: MarkdownParentNode) => {
    const { children } = parent;
    if (!Array.isArray(children)) {
      return;
    }

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!child || typeof child !== "object") {
        continue;
      }
      if (child.type === "text" && typeof child.value === "string") {
        const segments = splitTextWithSkillReferences(child.value, skills);
        if (segments.length === 1 && segments[0]?.kind === "text") {
          continue;
        }
        const replacementNodes = segments.map<MarkdownNode>((segment) => {
          if (segment.kind !== "skill") {
            return { type: "text", value: segment.value };
          }
          return {
            type: "link",
            url: `${SKILL_REFERENCE_SCHEME}${encodeURIComponent(segment.skill.name)}`,
            title: segment.referenceName,
            children: [{ type: "text", value: segment.value }],
          };
        });
        children.splice(index, 1, ...replacementNodes);
        index += replacementNodes.length - 1;
        continue;
      }
      if (blockedParentTypes.has(child.type ?? "")) {
        continue;
      }
      transformChildren(child);
    }
  };

  return () => (tree: MarkdownParentNode) => {
    if (tree) {
      transformChildren(tree);
    }
  };
}

function SkillReferenceInline({
  referenceName,
  skill,
}: {
  referenceName: string;
  skill: SkillOption | null;
}) {
  const description =
    skill?.description?.trim() || "Reusable workflow guidance for this workspace.";
  const metaChips = skill ? buildSkillMetaChips(skill).filter((value) => value !== "Skill") : [];
  const stateChips = skill ? buildSkillStateChips(skill) : [];
  const sourceLabel = skill ? formatSkillSourceLabel(skill.sourceFamily) : null;
  const scopeLabel = skill ? formatSkillScopeLabel(skill.scope) : null;
  const displayName = skill?.name ?? referenceName;

  return (
    <Tooltip
      side="top"
      contentClassName={styles.skillReferenceTooltipContent}
      content={
        <span className={styles.skillReferenceCard}>
          <span className={styles.skillReferenceCardEyebrow}>
            <span className={styles.skillReferenceCardEyebrowLabel}>Skill</span>
            {scopeLabel ? (
              <span className={styles.skillReferenceCardEyebrowMeta}>{scopeLabel}</span>
            ) : null}
            {sourceLabel ? (
              <span className={styles.skillReferenceCardEyebrowMeta}>{sourceLabel}</span>
            ) : null}
          </span>
          <span className={styles.skillReferenceCardTitleRow}>
            <span className={styles.skillReferenceCardTitle}>{displayName}</span>
          </span>
          <span className={styles.skillReferenceCardDescription}>{description}</span>
          {metaChips.length > 0 || stateChips.length > 0 ? (
            <span className={styles.skillReferenceCardMeta}>
              {metaChips.map((chip) => (
                <span key={chip} className={styles.skillReferenceCardMetaChip}>
                  {chip}
                </span>
              ))}
              {stateChips.map((chip) => (
                <span
                  key={chip}
                  className={joinClassNames(
                    styles.skillReferenceCardMetaChip,
                    styles.skillReferenceCardMetaChipWarning
                  )}
                >
                  {chip}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      }
    >
      <span className={styles.skillReferenceLink} tabIndex={0}>
        <span className={styles.skillReferenceIcon} aria-hidden>
          <Box size={13} />
        </span>
        <span className={styles.skillReferenceLabel}>{displayName}</span>
      </span>
    </Tooltip>
  );
}

export function Markdown({
  value,
  skills = [],
  className,
  codeBlock,
  codeBlockStyle = "default",
  codeBlockCopyUseModifier = false,
  showFilePath = true,
  workspacePath = null,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenThreadLink,
}: MarkdownProps) {
  const normalizedValue = codeBlock ? value : normalizeListIndentation(value);
  const content = codeBlock ? `\`\`\`\n${normalizedValue}\n\`\`\`` : normalizedValue;
  const skillReferenceRemarkPlugin = createSkillReferenceRemarkPlugin(skills);
  const handleFileLinkClick = (event: React.MouseEvent, path: string) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenFileLink?.(path);
  };
  const handleFileLinkContextMenu = (event: React.MouseEvent, path: string) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenFileLinkMenu?.(event, path);
  };
  const filePathWithOptionalLineMatch = /^(.+?)(:\d+(?::\d+)?)?$/;
  const getLinkablePath = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }
    const match = trimmed.match(filePathWithOptionalLineMatch);
    const pathOnly = match?.[1]?.trim() ?? trimmed;
    if (!pathOnly || !isLinkableFilePath(pathOnly)) {
      return null;
    }
    return normalizeDisplayFileReference(trimmed);
  };
  const standaloneFileReference = (() => {
    if (codeBlock) {
      return null;
    }
    const trimmed = normalizedValue.trim();
    if (!trimmed || trimmed.includes("\n")) {
      return null;
    }
    const linkablePath = getLinkablePath(trimmed);
    if (!linkablePath) {
      return null;
    }
    return normalizeDisplayFileReference(trimmed) === normalizeDisplayFileReference(linkablePath)
      ? linkablePath
      : null;
  })();
  const components: Components = {
    a: ({ href, children }) => {
      const url = href ?? "";
      if (url.startsWith(SKILL_REFERENCE_SCHEME)) {
        const skillName = decodeURIComponent(url.slice(SKILL_REFERENCE_SCHEME.length));
        const skill = findSkillByReferenceName(skills, skillName);
        const referenceName =
          typeof children === "string"
            ? children.replace(/^\$/, "").trim()
            : Array.isArray(children)
              ? children
                  .map((child) => (typeof child === "string" ? child : ""))
                  .join("")
                  .replace(/^\$/, "")
                  .trim()
              : skillName;
        return <SkillReferenceInline referenceName={referenceName} skill={skill} />;
      }
      const threadId = url.startsWith("thread://")
        ? url.slice("thread://".length).trim()
        : url.startsWith("/thread/")
          ? url.slice("/thread/".length).trim()
          : "";
      if (threadId) {
        return (
          <a
            href={href}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenThreadLink?.(threadId);
            }}
          >
            {children}
          </a>
        );
      }
      if (isFileLinkUrl(url)) {
        const path = decodeFileLink(url);
        return (
          <FileReferenceLink
            href={href ?? toFileLink(path)}
            rawPath={path}
            showFilePath={showFilePath}
            workspacePath={workspacePath}
            onClick={handleFileLinkClick}
            onContextMenu={handleFileLinkContextMenu}
          />
        );
      }
      const isExternal =
        url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:");

      if (!isExternal) {
        return <a href={href}>{children}</a>;
      }

      return (
        <a
          href={href}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openExternalUrl(url);
          }}
        >
          {children}
        </a>
      );
    },
    code: ({ className: codeClassName, children }) => {
      if (codeClassName) {
        return <code className={codeClassName}>{children}</code>;
      }
      const text = String(children ?? "").trim();
      const linkablePath = getLinkablePath(text);
      if (!linkablePath) {
        return <code>{children}</code>;
      }
      const href = toFileLink(linkablePath);
      return (
        <FileReferenceLink
          href={href}
          rawPath={linkablePath}
          showFilePath={showFilePath}
          workspacePath={workspacePath}
          onClick={handleFileLinkClick}
          onContextMenu={handleFileLinkContextMenu}
        />
      );
    },
  };

  if (codeBlockStyle === "message") {
    components.pre = ({ node, children }) => (
      <PreBlock node={node as PreProps["node"]} copyUseModifier={codeBlockCopyUseModifier}>
        {children}
      </PreBlock>
    );
  }

  if (standaloneFileReference) {
    return (
      <div className={className}>
        <FileReferenceLink
          href={toFileLink(standaloneFileReference)}
          rawPath={standaloneFileReference}
          showFilePath={showFilePath}
          workspacePath={workspacePath}
          displayMode="full"
          onClick={handleFileLinkClick}
          onContextMenu={handleFileLinkContextMenu}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFileLinks, skillReferenceRemarkPlugin]}
        urlTransform={(url) => {
          const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url);
          if (
            url.startsWith(SKILL_REFERENCE_SCHEME) ||
            isFileLinkUrl(url) ||
            url.startsWith("http://") ||
            url.startsWith("https://") ||
            url.startsWith("mailto:") ||
            url.startsWith("#") ||
            url.startsWith("/") ||
            url.startsWith("./") ||
            url.startsWith("../")
          ) {
            return url;
          }
          if (!hasScheme) {
            return url;
          }
          return "";
        }}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
