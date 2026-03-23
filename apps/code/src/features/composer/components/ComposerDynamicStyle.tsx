import Box from "lucide-react/dist/esm/icons/box";
import type { CSSProperties, RefObject } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./ComposerInput.styles.css";

export type InlineSkillOverlayChipLayout = {
  key: string;
  label: string;
  skill: {
    description?: string | null;
  };
  end: number;
  top: number;
  left: number;
  width: number;
  height: number;
};

function toStylePropertyName(property: string) {
  if (property.startsWith("--")) {
    return property;
  }
  if (property.startsWith("ms")) {
    return `-${property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
  }
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function applyStyleMap(node: HTMLElement, styleMap: CSSProperties | undefined) {
  if (!styleMap) {
    return;
  }

  for (const [property, value] of Object.entries(styleMap)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    node.style.setProperty(toStylePropertyName(property), String(value));
  }
}

function clearStyleMap(node: HTMLElement, styleMap: CSSProperties | undefined) {
  if (!styleMap) {
    return;
  }

  for (const property of Object.keys(styleMap)) {
    node.style.removeProperty(toStylePropertyName(property));
  }
}

export function useElementStyleMap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  styleMap: CSSProperties | undefined
) {
  const previousStyleRef = useRef<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    clearStyleMap(node, previousStyleRef.current);
    applyStyleMap(node, styleMap);
    previousStyleRef.current = styleMap;

    return () => {
      clearStyleMap(node, previousStyleRef.current);
      previousStyleRef.current = undefined;
    };
  }, [ref, styleMap]);
}

type InlineSkillOverlayChipProps = {
  layout: InlineSkillOverlayChipLayout;
  onSelectionChange: (selectionStart: number | null) => void;
  resolveCursorEnd: (tokenEnd: number) => number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function InlineSkillOverlayChip({
  layout,
  onSelectionChange,
  resolveCursorEnd,
  textareaRef,
}: InlineSkillOverlayChipProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const chipStyle = useMemo(
    () =>
      ({
        "--composer-inline-skill-top": `${layout.top}px`,
        "--composer-inline-skill-left": `${layout.left}px`,
        "--composer-inline-skill-width": `${layout.width}px`,
        "--composer-inline-skill-height": `${layout.height}px`,
      }) as CSSProperties,
    [layout.height, layout.left, layout.top, layout.width]
  );

  useElementStyleMap(containerRef, chipStyle);
  useElementStyleMap(maskRef, chipStyle);
  useElementStyleMap(buttonRef, chipStyle);

  const focusTextareaAtSkillEnd = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const nextCursor = resolveCursorEnd(layout.end);
    textarea.focus();
    textarea.setSelectionRange(nextCursor, nextCursor);
    onSelectionChange(nextCursor);
  }, [layout.end, onSelectionChange, resolveCursorEnd, textareaRef]);

  const handleInlineSkillMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      focusTextareaAtSkillEnd();
    },
    [focusTextareaAtSkillEnd]
  );

  return (
    <div ref={containerRef}>
      <div
        ref={maskRef}
        className={joinClassNames(styles.inlineSkillMask, "composer-inline-skill-mask")}
      />
      <button
        ref={buttonRef}
        type="button"
        className={joinClassNames(styles.inlineSkillChip, "composer-inline-skill-chip")}
        title={layout.skill.description?.trim() || layout.label}
        onMouseDown={handleInlineSkillMouseDown}
        onClick={focusTextareaAtSkillEnd}
        tabIndex={-1}
      >
        <span
          className={joinClassNames(styles.inlineSkillIcon, "composer-inline-skill-icon")}
          aria-hidden
        >
          <Box size={12} />
        </span>
        <span className={joinClassNames(styles.inlineSkillLabel, "composer-inline-skill-label")}>
          {layout.label}
        </span>
      </button>
    </div>
  );
}
