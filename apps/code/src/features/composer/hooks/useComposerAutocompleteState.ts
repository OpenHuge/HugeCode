import { useCallback, useMemo } from "react";
import type { CustomPromptOption, SkillOption } from "../../../types";
import { findNextPromptArgCursor, findPromptArgRangeAtCursor } from "../../../utils/customPrompts";
import { isComposingEvent } from "../../../utils/keys";
import { buildSlashCommandRegistry } from "../../../utils/slashCommands";
import { buildSkillMetaChips } from "../../skills/utils/skillPresentation";
import type { ComposerDraftSyncMode } from "./useComposerDraftSync";
import type { AutocompleteItem } from "./useComposerAutocomplete";
import { useComposerAutocomplete } from "./useComposerAutocomplete";

type Skill = SkillOption;
type UseComposerAutocompleteStateArgs = {
  text: string;
  selectionStart: number | null;
  disabled: boolean;
  skills: Skill[];
  prompts: CustomPromptOption[];
  files: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  setText: (next: string, syncMode?: ComposerDraftSyncMode) => void;
  setSelectionStart: (next: number | null) => void;
  onItemApplied?: (
    item: AutocompleteItem,
    context: { triggerChar: string; insertedText: string }
  ) => void;
};

const MAX_FILE_SUGGESTIONS = 500;
const FILE_TRIGGER_PREFIX = /^(?:\s|["'`]|\(|\[|\{)$/;

function isFileTriggerActive(text: string, cursor: number | null) {
  if (!text || cursor === null) {
    return false;
  }
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) {
    return false;
  }
  const prevChar = atIndex > 0 ? beforeCursor[atIndex - 1] : "";
  if (prevChar && !FILE_TRIGGER_PREFIX.test(prevChar)) {
    return false;
  }
  const afterAt = beforeCursor.slice(atIndex + 1);
  return afterAt.length === 0 || !/\s/.test(afterAt);
}

function getFileTriggerQuery(text: string, cursor: number | null) {
  if (!text || cursor === null) {
    return null;
  }
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) {
    return null;
  }
  const prevChar = atIndex > 0 ? beforeCursor[atIndex - 1] : "";
  if (prevChar && !FILE_TRIGGER_PREFIX.test(prevChar)) {
    return null;
  }
  const afterAt = beforeCursor.slice(atIndex + 1);
  if (/\s/.test(afterAt)) {
    return null;
  }
  return afterAt;
}

export function useComposerAutocompleteState({
  text,
  selectionStart,
  disabled,
  skills,
  prompts,
  files,
  textareaRef,
  setText,
  setSelectionStart,
  onItemApplied,
}: UseComposerAutocompleteStateArgs) {
  const formatSkillDescription = useCallback((skill: Skill) => {
    const parts: string[] = [];
    if (skill.description) {
      parts.push(skill.description);
    }
    if (skill.scope === "workspace") {
      parts.push("Project skill");
    } else if (skill.scope === "global") {
      parts.push("Global skill");
    }
    if (skill.sourceFamily === "agents") {
      parts.push(".agents");
    } else if (skill.sourceFamily === "codex") {
      parts.push(".codex");
    } else if (skill.sourceFamily === "bundled") {
      parts.push("Bundled");
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, []);

  const formatSkillHint = useCallback((skill: Skill) => {
    const parts: string[] = [];
    if (skill.enabled === false) {
      parts.push("Disabled");
    }
    if (skill.shadowedBy) {
      parts.push(`Shadowed by ${skill.shadowedBy}`);
    }
    if (Array.isArray(skill.aliases) && skill.aliases.length > 0) {
      parts.push(skill.aliases.join(", "));
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, []);

  const skillItems = useMemo<AutocompleteItem[]>(
    () =>
      skills.map((skill) => ({
        id: `skill:${skill.name}`,
        label: skill.name,
        description: formatSkillDescription(skill),
        metaChips: buildSkillMetaChips(skill),
        hint: formatSkillHint(skill),
        insertText: `$${skill.name}`,
        group: "Skills" as const,
      })),
    [formatSkillDescription, formatSkillHint, skills]
  );

  const fileTriggerActive = useMemo(
    () => isFileTriggerActive(text, selectionStart),
    [selectionStart, text]
  );
  const fileItems = useMemo<AutocompleteItem[]>(
    () =>
      fileTriggerActive
        ? (() => {
            const query = getFileTriggerQuery(text, selectionStart) ?? "";
            const limited = query ? files : files.slice(0, MAX_FILE_SUGGESTIONS);
            return limited.map((path) => ({
              id: path,
              label: path,
              insertText: path,
              group: "Files" as const,
            }));
          })()
        : [],
    [fileTriggerActive, files, selectionStart, text]
  );

  const slashItems = useMemo<AutocompleteItem[]>(() => {
    const registry = buildSlashCommandRegistry({ prompts });
    return registry.entries.map((entry) => ({
      id: entry.id,
      label: entry.name,
      description: entry.description,
      hint: entry.hint,
      insertText: entry.insertText,
      cursorOffset: entry.cursorOffset,
      group: "Slash" as const,
    }));
  }, [prompts]);

  const triggers = useMemo(
    () => [
      { trigger: "/", items: slashItems },
      { trigger: "$", items: skillItems },
      { trigger: "@", items: fileItems },
    ],
    [fileItems, skillItems, slashItems]
  );

  const {
    active: isAutocompleteOpen,
    matches: autocompleteMatches,
    highlightIndex,
    setHighlightIndex,
    moveHighlight,
    range: autocompleteRange,
    close: closeAutocomplete,
  } = useComposerAutocomplete({
    text,
    selectionStart,
    triggers,
  });
  const autocompleteAnchorIndex = autocompleteRange
    ? Math.max(0, autocompleteRange.start - 1)
    : null;

  const applyAutocomplete = useCallback(
    (item: AutocompleteItem) => {
      if (!autocompleteRange) {
        return;
      }
      const triggerIndex = Math.max(0, autocompleteRange.start - 1);
      const triggerChar = text[triggerIndex] ?? "";
      const cursor = selectionStart ?? autocompleteRange.end;
      const promptRange = triggerChar === "@" ? findPromptArgRangeAtCursor(text, cursor) : null;
      const replaceTriggerChar = triggerChar === "@" || triggerChar === "$";
      const before = replaceTriggerChar
        ? text.slice(0, triggerIndex)
        : text.slice(0, autocompleteRange.start);
      const after = text.slice(autocompleteRange.end);
      const insert = item.insertText ?? item.label;
      const actualInsert = triggerChar === "@" ? insert.replace(/^@+/, "") : insert;
      const needsSpace = promptRange ? false : after.length === 0 ? true : !/^\s/.test(after);
      const nextText = `${before}${actualInsert}${needsSpace ? " " : ""}${after}`;
      setText(nextText);
      onItemApplied?.(item, { triggerChar, insertedText: actualInsert });
      closeAutocomplete();
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        const insertCursor = Math.min(
          actualInsert.length,
          Math.max(0, item.cursorOffset ?? actualInsert.length)
        );
        const cursor =
          before.length +
          insertCursor +
          (item.cursorOffset === undefined ? (needsSpace ? 1 : 0) : 0);
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
        setSelectionStart(cursor);
      });
    },
    [
      autocompleteRange,
      closeAutocomplete,
      selectionStart,
      setSelectionStart,
      setText,
      text,
      textareaRef,
      onItemApplied,
    ]
  );

  const handleTextChange = useCallback(
    (next: string, cursor: number | null, syncMode?: ComposerDraftSyncMode) => {
      setText(next, syncMode);
      setSelectionStart(cursor);
    },
    [setSelectionStart, setText]
  );

  const handleSelectionChange = useCallback(
    (cursor: number | null) => {
      setSelectionStart(cursor);
    },
    [setSelectionStart]
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (disabled) {
        return;
      }
      if (isComposingEvent(event)) {
        return;
      }
      if (isAutocompleteOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveHighlight(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveHighlight(-1);
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const selected = autocompleteMatches[highlightIndex] ?? autocompleteMatches[0];
          if (selected) {
            applyAutocomplete(selected);
          }
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          const selected = autocompleteMatches[highlightIndex] ?? autocompleteMatches[0];
          if (selected) {
            applyAutocomplete(selected);
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeAutocomplete();
          return;
        }
      }
      if (event.key === "Tab") {
        const cursor = selectionStart ?? text.length;
        const nextCursor = findNextPromptArgCursor(text, cursor);
        if (nextCursor !== null) {
          event.preventDefault();
          requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) {
              return;
            }
            textarea.focus();
            textarea.setSelectionRange(nextCursor, nextCursor);
            setSelectionStart(nextCursor);
          });
        }
      }
    },
    [
      applyAutocomplete,
      autocompleteMatches,
      closeAutocomplete,
      disabled,
      highlightIndex,
      isAutocompleteOpen,
      moveHighlight,
      selectionStart,
      setSelectionStart,
      text,
      textareaRef,
    ]
  );

  return {
    isAutocompleteOpen,
    autocompleteMatches,
    autocompleteAnchorIndex,
    highlightIndex,
    setHighlightIndex,
    applyAutocomplete,
    handleInputKeyDown,
    handleTextChange,
    handleSelectionChange,
    fileTriggerActive,
  };
}
