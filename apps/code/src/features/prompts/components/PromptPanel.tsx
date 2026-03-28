import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import Plus from "lucide-react/dist/esm/icons/plus";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Search from "lucide-react/dist/esm/icons/search";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "../../../application/runtime/ports/desktopHostCore";
import { LogicalPosition } from "../../../application/runtime/ports/desktopDpi";
import { Menu, MenuItem } from "../../../application/runtime/ports/desktopMenu";
import { getCurrentWindow } from "../../../application/runtime/ports/desktopHostWindow";
import { Button, StatusBadge } from "../../../design-system";
import { PopoverMenuItem, PopoverSurface } from "../../../design-system";
import type { CustomPromptOption } from "../../../types";
import { getPromptArgumentHint } from "../../../utils/customPrompts";
import { buildCustomCommandText, isBuiltInSlashCommandName } from "../../../utils/slashCommands";
import { useDismissibleMenu } from "../../app/hooks/useDismissibleMenu";
import { PanelSearchField } from "../../../design-system";
import { type PanelTabId, PanelTabs } from "../../layout/components/PanelTabs";
import {
  InspectorSection,
  InspectorSectionBody,
  InspectorSectionHeader,
} from "../../right-panel/RightPanelPrimitives";
import * as styles from "./PromptPanel.css";

type PromptPanelProps = {
  prompts: CustomPromptOption[];
  workspacePath: string | null;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  showPanelTabs?: boolean;
  onSendPrompt: (text: string) => void | Promise<void>;
  onSendPromptToNewAgent: (text: string) => void | Promise<void>;
  onCreatePrompt: (data: {
    scope: "workspace" | "global";
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onUpdatePrompt: (data: {
    path: string;
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onDeletePrompt: (path: string) => void | Promise<void>;
  onMovePrompt: (data: { path: string; scope: "workspace" | "global" }) => void | Promise<void>;
  onRevealWorkspacePrompts: () => void | Promise<void>;
  onRevealGeneralPrompts: () => void | Promise<void>;
  canRevealGeneralPrompts: boolean;
};

const PROMPT_MENU_WIDTH = 220;
const PROMPT_MENU_ITEM_HEIGHT = 32;
const PROMPT_MENU_PADDING = 8;

type PromptEditorState = {
  mode: "create" | "edit";
  scope: "workspace" | "global";
  name: string;
  description: string;
  argumentHint: string;
  content: string;
  path?: string;
};

function isWorkspacePrompt(prompt: CustomPromptOption) {
  return prompt.scope === "workspace";
}

type PromptMenuAction = {
  label: string;
  run: () => void | Promise<void>;
};

type PromptContextMenuState = {
  actions: PromptMenuAction[];
  top: number;
  left: number;
};

export function PromptPanel({
  prompts,
  workspacePath,
  filePanelMode,
  onFilePanelModeChange,
  showPanelTabs = true,
  onSendPrompt,
  onSendPromptToNewAgent,
  onCreatePrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onMovePrompt,
  onRevealWorkspacePrompts,
  onRevealGeneralPrompts,
  canRevealGeneralPrompts,
}: PromptPanelProps) {
  const [query, setQuery] = useState("");
  const [argsByPrompt, setArgsByPrompt] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<PromptEditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<PromptContextMenuState | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const showError = (error: unknown) => {
    window.alert(error instanceof Error ? error.message : String(error));
  };

  const resetEditorState = () => {
    setEditorError(null);
    setPendingDeletePath(null);
  };

  const updateEditor = (patch: Partial<PromptEditorState>) => {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingDeletePath) {
      return;
    }
    const stillExists = prompts.some((prompt) => prompt.path === pendingDeletePath);
    if (!stillExists) {
      setPendingDeletePath(null);
    }
  }, [pendingDeletePath, prompts]);

  useDismissibleMenu({
    isOpen: Boolean(contextMenu),
    containerRef: contextMenuRef,
    onClose: () => setContextMenu(null),
  });

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    if (contextMenuRef.current) {
      contextMenuRef.current.style.setProperty("--prompt-context-menu-top", `${contextMenu.top}px`);
      contextMenuRef.current.style.setProperty(
        "--prompt-context-menu-left",
        `${contextMenu.left}px`
      );
    }
    function handleScroll() {
      setContextMenu(null);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextMenu]);

  const triggerHighlight = (key: string) => {
    if (!key) {
      return;
    }
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
    }
    setHighlightKey(key);
    highlightTimer.current = window.setTimeout(() => {
      setHighlightKey(null);
    }, 650);
  };

  const buildPromptText = (prompt: CustomPromptOption, args: string) => {
    return buildCustomCommandText(prompt, args);
  };

  const filteredPrompts = useMemo(() => {
    if (!normalizedQuery) {
      return prompts;
    }
    return prompts.filter((prompt) => {
      const haystack = `${prompt.name} ${prompt.description ?? ""} ${prompt.path}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, prompts]);

  const { workspacePrompts, globalPrompts } = useMemo(() => {
    const workspaceEntries: CustomPromptOption[] = [];
    const globalEntries: CustomPromptOption[] = [];
    filteredPrompts.forEach((prompt) => {
      if (isWorkspacePrompt(prompt)) {
        workspaceEntries.push(prompt);
      } else {
        globalEntries.push(prompt);
      }
    });
    return { workspacePrompts: workspaceEntries, globalPrompts: globalEntries };
  }, [filteredPrompts]);

  const totalCount = filteredPrompts.length;
  const hasPrompts = totalCount > 0;

  const handleArgsChange = (key: string, value: string) => {
    setArgsByPrompt((prev) => ({ ...prev, [key]: value }));
  };

  const startCreate = (scope: "workspace" | "global") => {
    resetEditorState();
    setEditor({
      mode: "create",
      scope,
      name: "",
      description: "",
      argumentHint: "",
      content: "",
    });
  };

  const startEdit = (prompt: CustomPromptOption) => {
    const scope = isWorkspacePrompt(prompt) ? "workspace" : "global";
    resetEditorState();
    setEditor({
      mode: "edit",
      scope,
      name: prompt.name,
      description: prompt.description ?? "",
      argumentHint: prompt.argumentHint ?? "",
      content: prompt.content ?? "",
      path: prompt.path,
    });
  };

  const handleSave = async () => {
    if (!editor || isSaving) {
      return;
    }
    const name = editor.name.trim();
    if (!name) {
      setEditorError("Name is required.");
      return;
    }
    if (/\s/.test(name)) {
      setEditorError("Name cannot include whitespace.");
      return;
    }
    setEditorError(null);
    setIsSaving(true);
    const description = editor.description.trim() || null;
    const argumentHint = editor.argumentHint.trim() || null;
    const content = editor.content;
    try {
      if (editor.mode === "create") {
        await onCreatePrompt({
          scope: editor.scope,
          name,
          description,
          argumentHint,
          content,
        });
        triggerHighlight(name);
      } else if (editor.path) {
        await onUpdatePrompt({
          path: editor.path,
          name,
          description,
          argumentHint,
          content,
        });
        triggerHighlight(editor.path ?? name);
      }
      setEditor(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = (prompt: CustomPromptOption) => {
    if (!prompt.path) {
      return;
    }
    setPendingDeletePath(prompt.path);
  };

  const handleDeleteConfirm = async (prompt: CustomPromptOption) => {
    if (!prompt.path) {
      return;
    }
    try {
      await onDeletePrompt(prompt.path);
      setPendingDeletePath((current) => (current === prompt.path ? null : current));
    } catch (error) {
      showError(error);
    }
  };

  const handleMove = async (prompt: CustomPromptOption, scope: "workspace" | "global") => {
    if (!prompt.path) {
      return;
    }
    try {
      await onMovePrompt({ path: prompt.path, scope });
      triggerHighlight(prompt.name);
    } catch (error) {
      showError(error);
    }
  };

  const showPromptMenu = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    prompt: CustomPromptOption
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const scope = isWorkspacePrompt(prompt) ? "workspace" : "global";
    const nextScope = scope === "workspace" ? "global" : "workspace";
    const actions: PromptMenuAction[] = [
      {
        label: "Edit",
        run: () => startEdit(prompt),
      },
      {
        label: `Move to ${nextScope === "workspace" ? "workspace" : "general"}`,
        run: () => handleMove(prompt, nextScope),
      },
      {
        label: "Delete",
        run: () => handleDeleteRequest(prompt),
      },
    ];
    if (!isTauri()) {
      const rect = event.currentTarget.getBoundingClientRect();
      const rawX = event.clientX > 0 ? event.clientX : rect.right;
      const rawY = event.clientY > 0 ? event.clientY : rect.bottom;
      const menuHeight =
        PROMPT_MENU_PADDING * 2 + Math.max(actions.length, 1) * PROMPT_MENU_ITEM_HEIGHT;
      const left = Math.min(
        Math.max(rawX, 8),
        Math.max(8, window.innerWidth - PROMPT_MENU_WIDTH - 8)
      );
      const top = Math.min(Math.max(rawY, 8), Math.max(8, window.innerHeight - menuHeight - 8));
      setContextMenu({ actions, left, top });
      return;
    }
    try {
      const menu = await Menu.new({
        items: await Promise.all(
          actions.map((action) =>
            MenuItem.new({
              text: action.label,
              action: () => void action.run(),
            })
          )
        ),
      });
      const position = new LogicalPosition(event.clientX, event.clientY);
      const window = getCurrentWindow();
      await menu.popup(position, window);
    } catch (error) {
      showError(error);
    }
  };

  const runContextMenuAction = async (action: PromptMenuAction) => {
    setContextMenu(null);
    try {
      await action.run();
    } catch (error) {
      showError(error);
    }
  };

  const renderPromptRow = (prompt: CustomPromptOption) => {
    const hint = getPromptArgumentHint(prompt);
    const showArgsInput = Boolean(hint);
    const key = prompt.path || prompt.name;
    const argsValue = argsByPrompt[key] ?? "";
    const effectiveArgs = showArgsInput ? argsValue : "";
    const isHighlighted = highlightKey === prompt.path || highlightKey === prompt.name;
    return (
      <div className={`prompt-row${isHighlighted ? " is-highlight" : ""}`} key={key}>
        <div className="prompt-row-header">
          <div className="prompt-name">/{prompt.name}</div>
          {prompt.description && <div className="prompt-description">{prompt.description}</div>}
        </div>
        {hint && <div className="prompt-hint">{hint}</div>}
        {isBuiltInSlashCommandName(prompt.name) && (
          <div className="prompt-hint">
            Conflicts with built-in /{prompt.name}; use /prompts:{prompt.name}.
          </div>
        )}
        <div className="prompt-actions">
          {showArgsInput ? (
            <input
              className="prompt-args-input"
              type="text"
              placeholder={hint ?? "Arguments"}
              value={argsValue}
              onChange={(event) => handleArgsChange(key, event.target.value)}
              aria-label={`Arguments for ${prompt.name}`}
            />
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="prompt-action"
            onClick={() => {
              const text = buildPromptText(prompt, effectiveArgs);
              if (!text) {
                return;
              }
              void onSendPrompt(text);
            }}
            title="Send to current agent"
          >
            Send
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="prompt-action"
            onClick={() => {
              const text = buildPromptText(prompt, effectiveArgs);
              if (!text) {
                return;
              }
              void onSendPromptToNewAgent(text);
            }}
            title="Send to a new agent"
          >
            New agent
          </Button>
          <Button
            variant="subtle"
            size="iconSm"
            className="prompt-action-menu"
            onClick={(event) => void showPromptMenu(event, prompt)}
            aria-label="Prompt actions"
            title="Prompt actions"
          >
            <MoreHorizontal size={14} aria-hidden />
          </Button>
        </div>
        {pendingDeletePath === prompt.path && (
          <div className="prompt-delete-confirm">
            <span>Delete this prompt?</span>
            <Button
              variant="ghost"
              size="sm"
              className="prompt-action"
              onClick={() => void handleDeleteConfirm(prompt)}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="prompt-action"
              onClick={() => setPendingDeletePath(null)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <InspectorSection>
        <InspectorSectionHeader
          title="Commands"
          subtitle="Saved workspace and personal prompt shortcuts for the current thread."
          actions={
            <StatusBadge tone={hasPrompts ? "progress" : "default"}>
              {hasPrompts ? `${totalCount} command${totalCount === 1 ? "" : "s"}` : "Empty"}
            </StatusBadge>
          }
        />
        <InspectorSectionBody className={styles.headerBody}>
          {showPanelTabs ? (
            <PanelTabs active={filePanelMode} onSelect={onFilePanelModeChange} />
          ) : null}
          <PanelSearchField
            className="file-tree-search"
            inputClassName="file-tree-search-input"
            placeholder="Filter commands"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter commands"
            icon={<Search aria-hidden />}
          />
        </InspectorSectionBody>
      </InspectorSection>
      <div className={styles.panelScroll}>
        {editor && (
          <div className="prompt-editor">
            <div className="prompt-editor-row">
              <label className="prompt-editor-label">
                Name
                <input
                  className="prompt-args-input"
                  type="text"
                  value={editor.name}
                  onChange={(event) => updateEditor({ name: event.target.value })}
                  placeholder="Command name"
                />
              </label>
              <label className="prompt-editor-label">
                Scope
                <select
                  className="prompt-scope-select"
                  value={editor.scope}
                  onChange={(event) =>
                    updateEditor({
                      scope: event.target.value as PromptEditorState["scope"],
                    })
                  }
                  disabled={editor.mode === "edit"}
                >
                  <option value="workspace">Workspace</option>
                  <option value="global">General</option>
                </select>
              </label>
            </div>
            <div className="prompt-editor-row">
              <label className="prompt-editor-label">
                Description
                <input
                  className="prompt-args-input"
                  type="text"
                  value={editor.description}
                  onChange={(event) => updateEditor({ description: event.target.value })}
                  placeholder="Optional description"
                />
              </label>
              <label className="prompt-editor-label">
                Argument hint
                <input
                  className="prompt-args-input"
                  type="text"
                  value={editor.argumentHint}
                  onChange={(event) => updateEditor({ argumentHint: event.target.value })}
                  placeholder="Optional argument hint"
                />
              </label>
            </div>
            <label className="prompt-editor-label">
              Content
              <textarea
                className="prompt-editor-textarea"
                value={editor.content}
                onChange={(event) => updateEditor({ content: event.target.value })}
                placeholder="Command content"
                rows={6}
              />
            </label>
            {editorError && <div className="prompt-editor-error">{editorError}</div>}
            <div className="prompt-editor-actions">
              <Button
                variant="ghost"
                size="sm"
                className="prompt-action"
                onClick={() => setEditor(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="prompt-action"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {editor.mode === "create" ? "Create" : "Save"}
              </Button>
            </div>
          </div>
        )}
        <InspectorSection>
          <InspectorSectionHeader
            title="Workspace commands"
            subtitle="Shortcuts shared with this project"
            actions={
              <Button
                variant="ghost"
                size="icon"
                className="prompt-section-add"
                onClick={() => startCreate("workspace")}
                aria-label="Add workspace command"
                title="Add workspace command"
              >
                <Plus aria-hidden />
              </Button>
            }
          />
          <InspectorSectionBody>
            {workspacePrompts.length > 0 ? (
              <div className="prompt-list">
                {workspacePrompts.map((prompt) => renderPromptRow(prompt))}
              </div>
            ) : (
              <div className="prompt-empty-card">
                <ScrollText className="prompt-empty-icon" aria-hidden />
                <div className="prompt-empty-text">
                  <div className="prompt-empty-title">No workspace commands yet</div>
                  <div className="prompt-empty-subtitle">
                    Create one here or drop a .md file into the{" "}
                    {workspacePath ? (
                      <button
                        type="button"
                        className="prompt-empty-link"
                        onClick={() => void onRevealWorkspacePrompts()}
                      >
                        workspace commands folder
                      </button>
                    ) : (
                      <span className="prompt-empty-link is-disabled">
                        workspace commands folder
                      </span>
                    )}
                    .
                  </div>
                </div>
              </div>
            )}
          </InspectorSectionBody>
        </InspectorSection>
        <InspectorSection>
          <InspectorSectionHeader
            title="Personal commands"
            subtitle="Reusable shortcuts available across workspaces"
            actions={
              <Button
                variant="ghost"
                size="icon"
                className="prompt-section-add"
                onClick={() => startCreate("global")}
                aria-label="Add personal command"
                title="Add personal command"
              >
                <Plus aria-hidden />
              </Button>
            }
          />
          <InspectorSectionBody>
            {globalPrompts.length > 0 ? (
              <div className="prompt-list">
                {globalPrompts.map((prompt) => renderPromptRow(prompt))}
              </div>
            ) : (
              <div className="prompt-empty-card">
                <ScrollText className="prompt-empty-icon" aria-hidden />
                <div className="prompt-empty-text">
                  <div className="prompt-empty-title">No personal commands yet</div>
                  <div className="prompt-empty-subtitle">
                    Create one here or drop a .md file into{" "}
                    {canRevealGeneralPrompts ? (
                      <button
                        type="button"
                        className="prompt-empty-link"
                        onClick={() => void onRevealGeneralPrompts()}
                      >
                        CODEX_HOME/prompts
                      </button>
                    ) : (
                      <span className="prompt-empty-link is-disabled">CODEX_HOME/prompts</span>
                    )}
                    .
                  </div>
                </div>
              </div>
            )}
          </InspectorSectionBody>
        </InspectorSection>
      </div>
      {contextMenu &&
        createPortal(
          <PopoverSurface
            ref={contextMenuRef}
            className="prompt-context-menu"
            role="menu"
            aria-label="Prompt actions"
            onContextMenu={(event) => event.preventDefault()}
          >
            {contextMenu.actions.map((action, index) => (
              <PopoverMenuItem
                key={`${action.label}-${index}`}
                className="prompt-context-option"
                onClick={() => void runContextMenuAction(action)}
              >
                {action.label}
              </PopoverMenuItem>
            ))}
          </PopoverSurface>,
          document.body
        )}
    </div>
  );
}
