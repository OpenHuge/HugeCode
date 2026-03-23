import { Button, PanelSearchField, StatusBadge } from "../../../design-system";
import { useVirtualizer } from "@tanstack/react-virtual";
import ChevronsUpDown from "lucide-react/dist/esm/icons/chevrons-up-down";
import File from "lucide-react/dist/esm/icons/file";
import Folder from "lucide-react/dist/esm/icons/folder";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import Plus from "lucide-react/dist/esm/icons/plus";
import Search from "lucide-react/dist/esm/icons/search";
import type { MouseEvent } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "../../../application/runtime/ports/tauriCore";
import { LogicalPosition } from "../../../application/runtime/ports/tauriDpi";
import { convertFileSrc, readWorkspaceFile } from "../../../application/runtime/ports/tauriFiles";
import { Menu, MenuItem } from "../../../application/runtime/ports/tauriMenu";
import { revealItemInDir } from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { getCurrentWindow } from "../../../application/runtime/ports/tauriWindow";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { OpenAppTarget } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { joinWorkspacePath, revealInFileManagerLabel } from "../../../utils/platformPaths";
import { languageFromPath } from "../../../utils/syntaxLanguage";
import { type PanelTabId, PanelTabs } from "../../layout/components/PanelTabs";
import {
  InspectorSection,
  InspectorSectionBody,
  InspectorSectionGroup,
  InspectorSectionHeader,
  RightPanelEmptyState,
} from "../../right-panel/RightPanelPrimitives";
import { FileTypeIconImage } from "../../shared/components/FileTypeIconImage";
import * as styles from "./FileTreePanel.styles.css";

type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children: FileTreeNode[];
};

type FileTreePanelProps = {
  workspaceId: string;
  workspacePath: string;
  files: string[];
  modifiedFiles: string[];
  isLoading: boolean;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  showPanelTabs?: boolean;
  onInsertText?: (text: string) => void;
  canInsertText: boolean;
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
};

type FileTreeBuildNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children: Map<string, FileTreeBuildNode>;
};

type FileEntry = {
  path: string;
  lower: string;
  segments: string[];
};

type FileTreeRowEntry = {
  node: FileTreeNode;
  depth: number;
  isFolder: boolean;
  isExpanded: boolean;
};

const FILE_TREE_ROW_HEIGHT = 28;
const FILE_TREE_SKELETON_WIDTHS = [68, 71, 74, 77, 80, 83, 86, 89];
const LazyFilePreviewPopover = lazy(() =>
  import("./FilePreviewPopover").then((module) => ({ default: module.FilePreviewPopover }))
);

function buildTree(entries: FileEntry[]): { nodes: FileTreeNode[]; folderPaths: Set<string> } {
  const root = new Map<string, FileTreeBuildNode>();
  const addNode = (
    map: Map<string, FileTreeBuildNode>,
    name: string,
    path: string,
    type: "file" | "folder"
  ) => {
    const existing = map.get(name);
    if (existing) {
      if (type === "folder") {
        existing.type = "folder";
      }
      return existing;
    }
    const node: FileTreeBuildNode = {
      name,
      path,
      type,
      children: new Map(),
    };
    map.set(name, node);
    return node;
  };

  entries.forEach(({ segments }) => {
    if (!segments.length) {
      return;
    }
    let currentMap = root;
    let currentPath = "";
    segments.forEach((segment, index) => {
      const isFile = index === segments.length - 1;
      const nextPath = currentPath ? `${currentPath}/${segment}` : segment;
      const node = addNode(currentMap, segment, nextPath, isFile ? "file" : "folder");
      if (!isFile) {
        currentMap = node.children;
        currentPath = nextPath;
      }
    });
  });

  const folderPaths = new Set<string>();

  const toArray = (map: Map<string, FileTreeBuildNode>): FileTreeNode[] => {
    const nodes = Array.from(map.values()).map((node) => {
      if (node.type === "folder") {
        folderPaths.add(node.path);
      }
      return {
        name: node.name,
        path: node.path,
        type: node.type,
        children: node.type === "folder" ? toArray(node.children) : [],
      };
    });
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return nodes;
  };

  return { nodes: toArray(root), folderPaths };
}

const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "avif",
  "bmp",
  "heic",
  "heif",
  "tif",
  "tiff",
]);

function isImagePath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return imageExtensions.has(ext);
}

export function FileTreePanel({
  workspaceId,
  workspacePath,
  files,
  modifiedFiles,
  isLoading,
  filePanelMode,
  onFilePanelModeChange,
  showPanelTabs = true,
  onInsertText,
  canInsertText,
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
}: FileTreePanelProps) {
  const [filterMode, setFilterMode] = useState<"all" | "modified">("all");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{
    top: number;
    left: number;
    arrowTop: number;
    height: number;
  } | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [_previewLoading, setPreviewLoading] = useState(false);
  const [_previewError, setPreviewError] = useState<string | null>(null);
  const [previewSelection, setPreviewSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const dragAnchorLineRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const hasManualToggle = useRef(false);
  const showLoading = isLoading && files.length === 0;
  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualListRef = useRef<HTMLDivElement | null>(null);
  const debouncedQuery = useDebouncedValue(query, 150);
  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const modifiedPathSet = useMemo(() => new Set(modifiedFiles), [modifiedFiles]);
  const fileEntries = useMemo(
    () =>
      files.map((path) => ({
        path,
        lower: path.toLowerCase(),
        segments: path.split("/").filter(Boolean),
      })),
    [files]
  );
  const sourceEntries = useMemo(
    () =>
      filterMode === "modified"
        ? fileEntries.filter((entry) => modifiedPathSet.has(entry.path))
        : fileEntries,
    [fileEntries, filterMode, modifiedPathSet]
  );
  const previewKind = useMemo(
    () => (previewPath && isImagePath(previewPath) ? "image" : "text"),
    [previewPath]
  );

  const visibleEntries = useMemo(() => {
    if (!normalizedQuery) {
      return sourceEntries;
    }
    return sourceEntries.filter((entry) => entry.lower.includes(normalizedQuery));
  }, [sourceEntries, normalizedQuery]);

  const { nodes, folderPaths } = useMemo(() => buildTree(visibleEntries), [visibleEntries]);

  const visibleFolderPaths = folderPaths;
  const hasFolders = visibleFolderPaths.size > 0;
  const allVisibleExpanded =
    hasFolders && Array.from(visibleFolderPaths).every((path) => expandedFolders.has(path));

  useEffect(() => {
    setExpandedFolders((prev) => {
      if (normalizedQuery || filterMode === "modified") {
        return new Set(folderPaths);
      }
      const next = new Set<string>();
      prev.forEach((path) => {
        if (folderPaths.has(path)) {
          next.add(path);
        }
      });
      if (next.size === 0 && !hasManualToggle.current) {
        nodes.forEach((node) => {
          if (node.type === "folder") {
            next.add(node.path);
          }
        });
      }
      return next;
    });
  }, [filterMode, folderPaths, nodes, normalizedQuery]);

  useEffect(() => {
    setPreviewPath(null);
    setPreviewAnchor(null);
    setPreviewSelection(null);
    setPreviewContent("");
    setPreviewTruncated(false);
    setPreviewError(null);
    setPreviewLoading(false);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
  }, []);

  const closePreview = useCallback(() => {
    setPreviewPath(null);
    setPreviewAnchor(null);
    setPreviewSelection(null);
    setPreviewContent("");
    setPreviewTruncated(false);
    setPreviewError(null);
    setPreviewLoading(false);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
  }, []);

  useEffect(() => {
    if (!previewPath) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewPath, closePreview]);

  const toggleAllFolders = () => {
    if (!hasFolders) {
      return;
    }
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (allVisibleExpanded) {
        visibleFolderPaths.forEach((path) => {
          next.delete(path);
        });
      } else {
        visibleFolderPaths.forEach((path) => {
          next.add(path);
        });
      }
      return next;
    });
    hasManualToggle.current = true;
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const resolvePath = useCallback(
    (relativePath: string) => {
      return joinWorkspacePath(workspacePath, relativePath);
    },
    [workspacePath]
  );

  const previewImageSrc = useMemo(() => {
    if (!previewPath || previewKind !== "image") {
      return null;
    }
    try {
      return convertFileSrc(resolvePath(previewPath));
    } catch {
      return null;
    }
  }, [previewPath, previewKind, resolvePath]);

  const openPreview = useCallback((path: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const estimatedWidth = 640;
    const estimatedHeight = 520;
    const padding = 16;
    const maxHeight = Math.min(estimatedHeight, window.innerHeight - padding * 2);
    const left = Math.min(
      Math.max(padding, rect.left - estimatedWidth - padding),
      Math.max(padding, window.innerWidth - estimatedWidth - padding)
    );
    const top = Math.min(
      Math.max(padding, rect.top - maxHeight * 0.35),
      Math.max(padding, window.innerHeight - maxHeight - padding)
    );
    const arrowTop = Math.min(
      Math.max(16, rect.top + rect.height / 2 - top),
      Math.max(16, maxHeight - 16)
    );
    setPreviewPath(path);
    setPreviewAnchor({ top, left, arrowTop, height: maxHeight });
    setPreviewSelection(null);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
  }, []);

  useEffect(() => {
    if (!previewPath) {
      return;
    }
    let cancelled = false;
    if (previewKind === "image") {
      setPreviewContent("");
      setPreviewTruncated(false);
      setPreviewError(null);
      setPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setPreviewLoading(true);
    setPreviewError(null);
    readWorkspaceFile(workspaceId, previewPath)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setPreviewContent(response.content ?? "");
        setPreviewTruncated(Boolean(response.truncated));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPreviewError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewKind, previewPath, workspaceId]);

  const flatNodes = useMemo(() => {
    const rows: FileTreeRowEntry[] = [];
    const walk = (node: FileTreeNode, depth: number) => {
      const isFolder = node.type === "folder";
      const isExpanded = isFolder && expandedFolders.has(node.path);
      rows.push({ node, depth, isFolder, isExpanded });
      if (isFolder && isExpanded) {
        node.children.forEach((child) => {
          walk(child, depth + 1);
        });
      }
    };
    nodes.forEach((node) => {
      walk(node, 0);
    });
    return rows;
  }, [nodes, expandedFolders]);

  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => FILE_TREE_ROW_HEIGHT,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualHeight = rowVirtualizer.getTotalSize();

  useEffect(() => {
    if (!virtualListRef.current) {
      return;
    }
    virtualListRef.current.style.setProperty("--file-tree-virtual-height", `${virtualHeight}px`);
  }, [virtualHeight]);

  useEffect(() => {
    if (!isDragSelecting) {
      return;
    }
    const handleMouseUp = () => {
      setIsDragSelecting(false);
      dragAnchorLineRef.current = null;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDragSelecting]);

  const selectRangeFromAnchor = useCallback((anchor: number, index: number) => {
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    setPreviewSelection({ start, end });
  }, []);

  const handleSelectLine = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      if (dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }
      if (event.shiftKey && previewSelection) {
        const anchor = previewSelection.start;
        selectRangeFromAnchor(anchor, index);
        return;
      }
      setPreviewSelection({ start: index, end: index });
    },
    [previewSelection, selectRangeFromAnchor]
  );

  const handleLineMouseDown = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      if (previewKind !== "text" || event.button !== 0) {
        return;
      }
      event.preventDefault();
      setIsDragSelecting(true);
      const anchor = event.shiftKey && previewSelection ? previewSelection.start : index;
      dragAnchorLineRef.current = anchor;
      dragMovedRef.current = false;
      selectRangeFromAnchor(anchor, index);
    },
    [previewKind, previewSelection, selectRangeFromAnchor]
  );

  const handleLineMouseEnter = useCallback(
    (index: number, _event: MouseEvent<HTMLButtonElement>) => {
      if (!isDragSelecting) {
        return;
      }
      const anchor = dragAnchorLineRef.current;
      if (anchor === null) {
        return;
      }
      if (anchor !== index) {
        dragMovedRef.current = true;
      }
      selectRangeFromAnchor(anchor, index);
    },
    [isDragSelecting, selectRangeFromAnchor]
  );

  const handleLineMouseUp = useCallback(() => {
    if (!isDragSelecting) {
      return;
    }
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
  }, [isDragSelecting]);

  const selectionHints = useMemo(
    () =>
      previewKind === "text" ? ["Shift + click or drag + click", "for multi-line selection"] : [],
    [previewKind]
  );

  const handleAddSelection = useCallback(() => {
    if (
      !canInsertText ||
      previewKind !== "text" ||
      !previewPath ||
      !previewSelection ||
      !onInsertText
    ) {
      return;
    }
    const lines = previewContent.split("\n");
    const selected = lines.slice(previewSelection.start, previewSelection.end + 1);
    const language = languageFromPath(previewPath);
    const fence = language ? `\`\`\`${language}` : "```";
    const start = previewSelection.start + 1;
    const end = previewSelection.end + 1;
    const rangeLabel = start === end ? `L${start}` : `L${start}-L${end}`;
    const snippet = `${previewPath}:${rangeLabel}\n${fence}\n${selected.join("\n")}\n\`\`\``;
    onInsertText(snippet);
    closePreview();
  }, [
    canInsertText,
    previewContent,
    previewKind,
    previewPath,
    previewSelection,
    onInsertText,
    closePreview,
  ]);

  const showMenu = useCallback(
    async (event: MouseEvent<HTMLButtonElement>, relativePath: string) => {
      if (!isTauri()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        const menu = await Menu.new({
          items: [
            await MenuItem.new({
              text: "Add to chat",
              enabled: canInsertText,
              action: async () => {
                if (!canInsertText) {
                  return;
                }
                onInsertText?.(relativePath);
              },
            }),
            await MenuItem.new({
              text: revealInFileManagerLabel(),
              action: async () => {
                try {
                  await revealItemInDir(resolvePath(relativePath));
                } catch (error) {
                  pushErrorToast({
                    title: `Couldn’t open in ${revealInFileManagerLabel()}`,
                    message:
                      error instanceof Error ? error.message : "Unable to reveal the file path.",
                  });
                }
              },
            }),
          ],
        });
        const window = getCurrentWindow();
        const position = new LogicalPosition(event.clientX, event.clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn’t open file actions",
          message: error instanceof Error ? error.message : "Unable to open the file menu.",
        });
      }
    },
    [canInsertText, onInsertText, resolvePath]
  );

  const renderRow = (entry: FileTreeRowEntry) => {
    const { node, isFolder, isExpanded } = entry;
    return (
      <>
        <button
          type="button"
          className={joinClassNames(
            styles.row,
            isFolder ? styles.rowFolder : styles.rowFile,
            "file-tree-row",
            isFolder ? "is-folder" : "is-file"
          )}
          onClick={(event) => {
            if (isFolder) {
              toggleFolder(node.path);
              return;
            }
            openPreview(node.path, event.currentTarget);
          }}
          onContextMenu={(event) => {
            void showMenu(event, node.path);
          }}
        >
          {isFolder ? (
            <span
              className={joinClassNames(
                styles.chevron,
                isExpanded && styles.chevronOpen,
                "file-tree-chevron",
                isExpanded && "is-open"
              )}
            >
              ›
            </span>
          ) : (
            <span className={joinClassNames(styles.spacer, "file-tree-spacer")} aria-hidden />
          )}
          <span className={joinClassNames(styles.icon, "file-tree-icon")} aria-hidden>
            {isFolder ? (
              <Folder size={12} />
            ) : (
              <FileTypeIconImage
                path={node.path}
                alt=""
                className={joinClassNames(styles.iconImage, "file-tree-icon-image")}
                fallback={<File size={12} />}
              />
            )}
          </span>
          <span className={joinClassNames(styles.name, "file-tree-name")}>{node.name}</span>
        </button>
        {!isFolder && (
          <Button
            variant="ghost"
            size="icon"
            className={joinClassNames(styles.action, "file-tree-action")}
            onClick={(event) => {
              event.stopPropagation();
              if (!canInsertText) {
                return;
              }
              onInsertText?.(node.path);
            }}
            disabled={!canInsertText}
            aria-label={`Mention ${node.name}`}
            title="Mention in chat"
          >
            <Plus size={10} aria-hidden />
          </Button>
        )}
      </>
    );
  };

  const countLabel = visibleEntries.length
    ? normalizedQuery
      ? `${visibleEntries.length} match${visibleEntries.length === 1 ? "" : "es"}`
      : filterMode === "modified"
        ? `${visibleEntries.length} modified`
        : `${visibleEntries.length} file${visibleEntries.length === 1 ? "" : "s"}`
    : showLoading
      ? "Loading files"
      : filterMode === "modified"
        ? "No modified"
        : "No files";

  return (
    <div className={joinClassNames(styles.panel, "file-tree-panel")}>
      <InspectorSection>
        <InspectorSectionGroup className={styles.headerGroup}>
          <InspectorSectionHeader
            title="Files"
            subtitle="Browse the workspace tree and mention files in the thread."
            actions={
              <StatusBadge tone={filterMode === "modified" ? "progress" : "default"}>
                {countLabel}
              </StatusBadge>
            }
          />
          <InspectorSectionBody className={styles.headerStack}>
            <div className={styles.headerControls}>
              {showPanelTabs ? (
                <PanelTabs active={filePanelMode} onSelect={onFilePanelModeChange} />
              ) : null}
              {hasFolders ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className={joinClassNames(styles.toggle, "file-tree-toggle")}
                  onClick={toggleAllFolders}
                  aria-label={allVisibleExpanded ? "Collapse all folders" : "Expand all folders"}
                  title={allVisibleExpanded ? "Collapse all folders" : "Expand all folders"}
                >
                  <ChevronsUpDown size={14} aria-hidden />
                </Button>
              ) : null}
            </div>
            <PanelSearchField
              className="file-tree-search"
              inputClassName="file-tree-search-input"
              placeholder="Filter files and folders"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Filter files and folders"
              icon={<Search aria-hidden />}
              trailing={
                <Button
                  variant="ghost"
                  size="icon"
                  className={joinClassNames(
                    styles.searchFilter,
                    filterMode === "modified" && styles.searchFilterActive,
                    "file-tree-search-filter",
                    filterMode === "modified" && "is-active"
                  )}
                  onClick={() => {
                    setFilterMode((prev) => (prev === "all" ? "modified" : "all"));
                  }}
                  aria-pressed={filterMode === "modified"}
                  aria-label={
                    filterMode === "modified" ? "Show all files" : "Show modified files only"
                  }
                  title={filterMode === "modified" ? "Show all files" : "Show modified files only"}
                >
                  <GitBranch size={14} aria-hidden />
                </Button>
              }
            />
          </InspectorSectionBody>
        </InspectorSectionGroup>
      </InspectorSection>
      <div className={joinClassNames(styles.list, "file-tree-list")} ref={listRef}>
        {showLoading ? (
          <div className={joinClassNames(styles.skeleton, "file-tree-skeleton")}>
            {FILE_TREE_SKELETON_WIDTHS.map((width) => (
              <div
                className={joinClassNames(styles.skeletonRow, "file-tree-skeleton-row")}
                key={`file-tree-skeleton-${width}`}
                data-width={width}
              />
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <div className={joinClassNames(styles.empty, "file-tree-empty")}>
            {(() => {
              const copy = normalizedQuery
                ? filterMode === "modified"
                  ? {
                      title: "No modified files match",
                      body: "Try a broader search or switch back to all files to inspect the workspace tree.",
                    }
                  : {
                      title: "No matching files",
                      body: "Try a broader search to find files or folders in this workspace.",
                    }
                : filterMode === "modified"
                  ? {
                      title: "No modified files",
                      body: "Switch back to all files to browse the workspace tree for this thread.",
                    }
                  : {
                      title: "No files available",
                      body: "Open a folder or repository-backed workspace to browse files here.",
                    };

              return <RightPanelEmptyState title={copy.title} body={copy.body} />;
            })()}
          </div>
        ) : (
          <div className={joinClassNames(styles.virtual, "file-tree-virtual")} ref={virtualListRef}>
            {virtualRows.map((virtualRow) => {
              const entry = flatNodes[virtualRow.index];
              if (!entry) {
                return null;
              }
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="file-tree-virtual-row"
                  data-top={virtualRow.start}
                >
                  <div
                    className={joinClassNames(styles.rowWrap, "file-tree-row-wrap")}
                    data-depth={Math.min(Math.max(entry.depth, 0), 10)}
                  >
                    {renderRow(entry)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {previewPath && previewAnchor
        ? createPortal(
            <Suspense fallback={null}>
              <LazyFilePreviewPopover
                path={previewPath}
                absolutePath={resolvePath(previewPath)}
                content={previewContent}
                truncated={previewTruncated}
                previewKind={previewKind}
                imageSrc={previewImageSrc}
                openTargets={openTargets}
                openAppIconById={openAppIconById}
                selectedOpenAppId={selectedOpenAppId}
                onSelectOpenAppId={onSelectOpenAppId}
                selection={previewSelection}
                onSelectLine={handleSelectLine}
                onLineMouseDown={handleLineMouseDown}
                onLineMouseEnter={handleLineMouseEnter}
                onLineMouseUp={handleLineMouseUp}
                onClearSelection={() => setPreviewSelection(null)}
                onAddSelection={handleAddSelection}
                canInsertText={canInsertText}
                onClose={closePreview}
                selectionHints={selectionHints}
                anchorTop={previewAnchor.top}
                anchorLeft={previewAnchor.left}
                arrowTop={previewAnchor.arrowTop}
              />
            </Suspense>,
            document.body
          )
        : null}
    </div>
  );
}
