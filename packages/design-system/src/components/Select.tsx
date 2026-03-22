import { createPortal } from "react-dom";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "./classNames";
import { Field, joinFieldMessageIds } from "./Field";
import "./Select.css.ts";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  leading?: ReactNode;
};

type SelectMenuPlacement = "down" | "up";
type SelectAnchorAlign = "start" | "end" | "auto";

type SelectComputedLayout = {
  key: string;
  placement: SelectMenuPlacement;
  style: CSSProperties;
};

export type SelectTriggerRenderProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  ref: Ref<HTMLButtonElement>;
  open: boolean;
  hasSelection: boolean;
  selectionLabel: string;
  selectedOptions: SelectOption[];
  caret: ReactNode;
};

export type SelectProps = {
  ariaLabel?: string;
  "aria-label"?: string;
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode;
  invalid?: boolean;
  options: SelectOption[];
  value?: string | null;
  onValueChange?: (value: string) => void;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  formatSelectionLabel?: (selectedOptions: SelectOption[]) => string;
  renderTrigger?: (props: SelectTriggerRenderProps) => ReactNode;
  menuWidthMode?: "content" | "trigger";
  anchorAlign?: SelectAnchorAlign;
  minMenuWidth?: number;
  maxMenuWidth?: number;
  menuGap?: number;
  triggerDensity?: "default" | "compact";
};

const COMPACT_VIEWPORT_BREAKPOINT = 640;
const COMPACT_MIN_MENU_WIDTH_RATIO = 0.45;
const AUTO_ALIGN_END_SWITCH_DELTA_PX = 16;
const AUTO_ALIGN_END_MIN_START_OVERFLOW_PX = 8;

function normalizeUniqueValues(values: readonly string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function useDismissibleMenu({
  isOpen,
  containerRef,
  additionalRefs = [],
  onClose,
}: {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  additionalRefs?: Array<RefObject<HTMLElement | null>>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        onClose();
        return;
      }
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (additionalRefs.some((ref) => ref.current?.contains(target))) {
        return;
      }
      onClose();
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [additionalRefs, containerRef, isOpen, onClose]);
}

export function Select({
  ariaLabel,
  "aria-label": ariaLabelProp,
  label,
  description,
  errorMessage,
  invalid = false,
  options,
  value = null,
  onValueChange,
  values = [],
  onValuesChange,
  multiple = false,
  disabled = false,
  placeholder = "Select",
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
  formatSelectionLabel,
  renderTrigger,
  menuWidthMode = "content",
  anchorAlign = "auto",
  minMenuWidth,
  maxMenuWidth,
  menuGap,
  triggerDensity = "default",
}: SelectProps) {
  const resolvedAriaLabel = ariaLabel ?? ariaLabelProp ?? "Select";
  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<SelectMenuPlacement>("down");
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const listboxId = useId();
  const triggerId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const layoutKeyRef = useRef<string | null>(null);
  const positionFrameRef = useRef<number | null>(null);
  const descriptionId = description ? `${triggerId}-description` : undefined;
  const errorId = errorMessage ? `${triggerId}-error` : undefined;
  const describedBy = joinFieldMessageIds(descriptionId, errorId);

  const closeMenu = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) {
      triggerRef.current?.focus();
    }
  }, []);

  useDismissibleMenu({
    isOpen: open,
    containerRef,
    additionalRefs: [menuRef],
    onClose: () => closeMenu(false),
  });

  const selectedValues = useMemo(() => {
    if (multiple) {
      return normalizeUniqueValues(values);
    }
    return value ? [value] : [];
  }, [multiple, value, values]);

  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  );
  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map((selectedValue) => optionByValue.get(selectedValue))
        .filter((option): option is SelectOption => Boolean(option)),
    [optionByValue, selectedValues]
  );

  const selectionLabel = useMemo(() => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    if (formatSelectionLabel) {
      return formatSelectionLabel(selectedOptions);
    }
    if (multiple && selectedOptions.length > 1) {
      return `${selectedOptions.length} selected`;
    }
    return selectedOptions[0]?.label ?? placeholder;
  }, [formatSelectionLabel, multiple, placeholder, selectedOptions]);
  const hasSelection = selectedOptions.length > 0;
  const selectedLeading =
    !multiple && selectedOptions.length === 1 ? (selectedOptions[0]?.leading ?? null) : null;

  const handleOptionSelect = useCallback(
    (option: SelectOption) => {
      if (disabled || option.disabled) {
        return;
      }

      if (multiple) {
        if (!onValuesChange) {
          return;
        }
        const nextSet = new Set(selectedValues);
        if (nextSet.has(option.value)) {
          nextSet.delete(option.value);
        } else {
          nextSet.add(option.value);
        }
        const nextValues = options
          .filter((entry) => nextSet.has(entry.value))
          .map((entry) => entry.value);
        onValuesChange(nextValues);
        return;
      }

      if (!onValueChange) {
        return;
      }
      onValueChange(option.value);
      setOpen(false);
    },
    [disabled, multiple, onValueChange, onValuesChange, options, selectedValues]
  );

  const estimateMenuHeight = useCallback(() => {
    const menu = menuRef.current;
    if (menu && menu.offsetHeight > 0) {
      return menu.offsetHeight;
    }
    const optionCount = Math.max(1, options.length);
    return Math.min(240, optionCount * 34 + 12);
  }, [options.length]);

  const computeMenuLayout = useCallback((): SelectComputedLayout | null => {
    const trigger = triggerRef.current;
    const container = containerRef.current;
    const scopedAnchor = container?.closest<HTMLElement>("[data-ds-select-anchor]");
    const anchor = scopedAnchor ?? trigger ?? container;
    if (!anchor || typeof window === "undefined") {
      return null;
    }

    const visualViewport = window.visualViewport;
    const viewportWidth =
      typeof visualViewport?.width === "number" && visualViewport.width > 0
        ? visualViewport.width
        : window.innerWidth;
    const viewportHeight =
      typeof visualViewport?.height === "number" && visualViewport.height > 0
        ? visualViewport.height
        : window.innerHeight;
    const viewportLeftBoundary = 8;
    const viewportTopBoundary = 8;
    const viewportRightBoundary = viewportWidth - 8;
    const viewportBottomBoundary = viewportHeight - 8;
    const triggerRect = trigger?.getBoundingClientRect();
    const containerRect = container?.getBoundingClientRect();
    const scopedAnchorRect = scopedAnchor?.getBoundingClientRect();
    const baseRect =
      scopedAnchorRect ?? triggerRect ?? containerRect ?? anchor.getBoundingClientRect();
    const placementAnchorRect = scopedAnchorRect ?? triggerRect ?? containerRect ?? baseRect;
    const widthAnchorRect =
      menuWidthMode === "trigger"
        ? (scopedAnchorRect ?? triggerRect ?? baseRect)
        : placementAnchorRect;
    const horizontalAnchorRect = placementAnchorRect;
    const verticalAnchorRect = placementAnchorRect;
    const isCompactViewport = viewportWidth <= COMPACT_VIEWPORT_BREAKPOINT;
    const defaultGap = isCompactViewport ? 4 : 6;
    const resolvedGap =
      typeof menuGap === "number" && Number.isFinite(menuGap) ? Math.max(0, menuGap) : defaultGap;
    const menuHeight = estimateMenuHeight();
    const contentWidth = menuRef.current?.offsetWidth ?? widthAnchorRect.width;
    let menuWidth =
      menuWidthMode === "trigger"
        ? widthAnchorRect.width
        : Math.max(widthAnchorRect.width, contentWidth);
    let effectiveMinMenuWidth = minMenuWidth;
    if (typeof effectiveMinMenuWidth === "number" && Number.isFinite(effectiveMinMenuWidth)) {
      if (isCompactViewport) {
        const compactMinCap = Math.max(
          widthAnchorRect.width,
          Math.floor(viewportWidth * COMPACT_MIN_MENU_WIDTH_RATIO)
        );
        effectiveMinMenuWidth = Math.min(effectiveMinMenuWidth, compactMinCap);
      }
      menuWidth = Math.max(menuWidth, effectiveMinMenuWidth);
    }
    if (typeof maxMenuWidth === "number" && Number.isFinite(maxMenuWidth)) {
      menuWidth = Math.min(menuWidth, maxMenuWidth);
    }
    const width = Math.min(menuWidth, Math.max(0, viewportRightBoundary - viewportLeftBoundary));

    const spaceBelow = viewportBottomBoundary - verticalAnchorRect.bottom - resolvedGap;
    const spaceAbove = verticalAnchorRect.top - viewportTopBoundary - resolvedGap;
    const shouldOpenUp = spaceBelow < Math.min(menuHeight, 220) && spaceAbove > spaceBelow;

    const clampHorizontal = (candidateLeft: number) => {
      let nextLeft = candidateLeft;
      if (nextLeft + width > viewportRightBoundary) {
        nextLeft = viewportRightBoundary - width;
      }
      if (nextLeft < viewportLeftBoundary) {
        nextLeft = viewportLeftBoundary;
      }
      return nextLeft;
    };
    const startLeft = horizontalAnchorRect.left;
    const endLeft = horizontalAnchorRect.left + horizontalAnchorRect.width - width;
    const overflowPenalty = (candidateLeft: number) => {
      const overflowLeft = Math.max(0, viewportLeftBoundary - candidateLeft);
      const overflowRight = Math.max(0, candidateLeft + width - viewportRightBoundary);
      return overflowLeft + overflowRight;
    };
    const resolvedAlign =
      anchorAlign === "auto"
        ? (() => {
            const startPenalty = overflowPenalty(startLeft);
            const endPenalty = overflowPenalty(endLeft);
            if (startPenalty <= AUTO_ALIGN_END_MIN_START_OVERFLOW_PX) {
              return "start";
            }
            if (endPenalty + AUTO_ALIGN_END_SWITCH_DELTA_PX < startPenalty) {
              return "end";
            }
            return "start";
          })()
        : anchorAlign;
    const left = clampHorizontal(resolvedAlign === "end" ? endLeft : startLeft);

    if (shouldOpenUp) {
      const maxHeight = Math.max(96, spaceAbove);
      const bottom = viewportHeight - verticalAnchorRect.top + resolvedGap;
      const resolvedWidth = `${Math.round(width)}px`;
      const resolvedMinWidth = menuWidthMode === "trigger" ? resolvedWidth : undefined;
      return {
        key: `up:${Math.round(bottom)}:${Math.round(left)}:${Math.round(width)}:${Math.floor(maxHeight)}`,
        placement: "up",
        style: {
          position: "fixed",
          top: "auto",
          bottom: `${Math.round(bottom)}px`,
          left: `${Math.round(left)}px`,
          width: resolvedWidth,
          minWidth: resolvedMinWidth,
          maxHeight: `${Math.floor(maxHeight)}px`,
          zIndex: 1200,
        },
      };
    }

    const maxHeight = Math.max(96, spaceBelow);
    const top = Math.max(viewportTopBoundary, verticalAnchorRect.bottom + resolvedGap);
    const resolvedWidth = `${Math.round(width)}px`;
    const resolvedMinWidth = menuWidthMode === "trigger" ? resolvedWidth : undefined;
    return {
      key: `down:${Math.round(top)}:${Math.round(left)}:${Math.round(width)}:${Math.floor(maxHeight)}`,
      placement: "down",
      style: {
        position: "fixed",
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: resolvedWidth,
        minWidth: resolvedMinWidth,
        maxHeight: `${Math.floor(maxHeight)}px`,
        zIndex: 1200,
      },
    };
  }, [anchorAlign, estimateMenuHeight, maxMenuWidth, menuGap, menuWidthMode, minMenuWidth]);

  const applyMenuLayout = useCallback((layout: SelectComputedLayout | null) => {
    if (!layout || layout.key === layoutKeyRef.current) {
      return;
    }
    layoutKeyRef.current = layout.key;
    setMenuPlacement(layout.placement);
    setMenuStyle(layout.style);
  }, []);

  const updateMenuPosition = useCallback(() => {
    applyMenuLayout(computeMenuLayout());
  }, [applyMenuLayout, computeMenuLayout]);

  const cancelScheduledPositionUpdate = useCallback(() => {
    if (positionFrameRef.current === null) {
      return;
    }
    window.cancelAnimationFrame(positionFrameRef.current);
    positionFrameRef.current = null;
  }, []);

  const scheduleMenuPositionUpdate = useCallback(() => {
    if (positionFrameRef.current !== null) {
      return;
    }
    positionFrameRef.current = window.requestAnimationFrame(() => {
      positionFrameRef.current = null;
      updateMenuPosition();
    });
  }, [updateMenuPosition]);

  const isMenuVisibleInViewport = useCallback(() => {
    const menu = menuRef.current;
    if (!menu || typeof window === "undefined") {
      return false;
    }
    const rect = menu.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const visualViewport = window.visualViewport;
    const viewportWidth =
      typeof visualViewport?.width === "number" && visualViewport.width > 0
        ? visualViewport.width
        : window.innerWidth;
    const viewportHeight =
      typeof visualViewport?.height === "number" && visualViewport.height > 0
        ? visualViewport.height
        : window.innerHeight;

    return (
      rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight
    );
  }, []);

  const moveFocusWithinMenu = useCallback((direction: "first" | "last" | "next" | "prev") => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const enabledOptions = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[data-ui-select-option="true"]:not(:disabled)')
    );
    if (enabledOptions.length === 0) {
      return;
    }
    if (direction === "first") {
      enabledOptions[0]?.focus();
      return;
    }
    if (direction === "last") {
      enabledOptions.at(-1)?.focus();
      return;
    }

    const activeElement = document.activeElement;
    const currentIndex = enabledOptions.indexOf(activeElement as HTMLButtonElement);
    const fallbackIndex = direction === "next" ? 0 : enabledOptions.length - 1;
    const startIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const delta = direction === "next" ? 1 : -1;
    const nextIndex = (startIndex + delta + enabledOptions.length) % enabledOptions.length;
    enabledOptions[nextIndex]?.focus();
  }, []);

  const focusSelectedOrFirstOption = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const selectedOption = menu.querySelector<HTMLButtonElement>(
      '[data-ui-select-option="true"][data-selected="true"]:not(:disabled)'
    );
    if (selectedOption) {
      selectedOption.focus();
      return;
    }
    moveFocusWithinMenu("first");
  }, [moveFocusWithinMenu]);

  const handleMenuKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocusWithinMenu("next");
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocusWithinMenu("prev");
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        moveFocusWithinMenu("first");
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        moveFocusWithinMenu("last");
      }
    },
    [closeMenu, moveFocusWithinMenu]
  );

  const openMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    applyMenuLayout(computeMenuLayout());
    setOpen(true);
  }, [applyMenuLayout, computeMenuLayout, disabled]);

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        openMenu();
      }
    },
    [disabled, openMenu]
  );

  useLayoutEffect(() => {
    if (!open) {
      cancelScheduledPositionUpdate();
      layoutKeyRef.current = null;
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
  }, [cancelScheduledPositionUpdate, open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleWindowChange = () => {
      scheduleMenuPositionUpdate();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    window.visualViewport?.addEventListener("resize", handleWindowChange);
    window.visualViewport?.addEventListener("scroll", handleWindowChange);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleWindowChange) : null;
    const trigger = triggerRef.current;
    const container = containerRef.current;
    const menu = menuRef.current;
    const scopedAnchor = container?.closest<HTMLElement>("[data-ds-select-anchor]");
    if (trigger && resizeObserver) {
      resizeObserver.observe(trigger);
    }
    if (container && resizeObserver) {
      resizeObserver.observe(container);
    }
    if (scopedAnchor && scopedAnchor !== container && resizeObserver) {
      resizeObserver.observe(scopedAnchor);
    }
    if (menu && resizeObserver) {
      resizeObserver.observe(menu);
    }

    updateMenuPosition();

    const focusTimer = window.setTimeout(() => {
      focusSelectedOrFirstOption();
    }, 0);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
      window.visualViewport?.removeEventListener("resize", handleWindowChange);
      window.visualViewport?.removeEventListener("scroll", handleWindowChange);
      resizeObserver?.disconnect();
      cancelScheduledPositionUpdate();
      window.clearTimeout(focusTimer);
    };
  }, [
    cancelScheduledPositionUpdate,
    focusSelectedOrFirstOption,
    open,
    scheduleMenuPositionUpdate,
    updateMenuPosition,
  ]);

  const menu = open ? (
    <div
      ref={menuRef}
      className={cx("ds-select-menu", menuPlacement === "up" && "is-up", menuClassName)}
      style={menuStyle ?? undefined}
      id={listboxId}
      role="listbox"
      aria-label={resolvedAriaLabel}
      aria-multiselectable={multiple || undefined}
      data-placement={menuPlacement}
      data-ui-select-menu="true"
      onKeyDown={handleMenuKeyDown}
    >
      {options.length === 0 ? (
        <div className="ds-select-empty">No options</div>
      ) : (
        options.map((option) => {
          const selected = selectedValueSet.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={cx("ds-select-option", selected && "is-selected", optionClassName)}
              role="option"
              aria-selected={selected}
              data-selected={selected ? "true" : "false"}
              data-ui-select-option="true"
              disabled={disabled || option.disabled}
              onClick={() => handleOptionSelect(option)}
            >
              <span className="ds-select-option-body" data-ui-select-option-body="true">
                {option.leading ? (
                  <span
                    className="ds-select-option-leading"
                    data-ui-select-option-leading="true"
                    aria-hidden
                  >
                    {option.leading}
                  </span>
                ) : null}
                <span className="ds-select-option-label" data-ui-select-option-label="true">
                  {option.label}
                </span>
              </span>
              <span
                className="ds-select-option-check"
                data-ui-select-option-check="true"
                aria-hidden
              >
                {selected ? "✓" : ""}
              </span>
            </button>
          );
        })
      )}
    </div>
  ) : null;

  const triggerProps = {
    id: triggerId,
    type: "button" as const,
    className: cx("ds-select-trigger", open && "is-open", triggerClassName),
    "data-trigger-density": triggerDensity,
    "data-placeholder": hasSelection ? "false" : "true",
    "data-has-value": hasSelection ? "true" : "false",
    "data-ui-select-trigger": "true",
    "aria-label": label ? undefined : resolvedAriaLabel,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    "aria-haspopup": "listbox" as const,
    "aria-controls": open ? listboxId : undefined,
    "aria-expanded": open,
    onClick: () => {
      if (open) {
        if (isMenuVisibleInViewport()) {
          closeMenu(false);
        } else {
          updateMenuPosition();
        }
        return;
      }
      openMenu();
    },
    onKeyDown: handleTriggerKeyDown,
    disabled,
  };
  const caret = (
    <svg
      className="ds-select-trigger-caret"
      data-ui-select-trigger-caret="true"
      aria-hidden
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <Field
      label={label}
      htmlFor={triggerId}
      description={description}
      descriptionId={descriptionId}
      errorMessage={errorMessage}
      errorId={errorId}
    >
      <div
        ref={containerRef}
        className={cx("ds-select", className)}
        data-trigger-density={triggerDensity}
        data-placeholder={hasSelection ? "false" : "true"}
        data-has-value={hasSelection ? "true" : "false"}
        data-ui-select-root="true"
      >
        {renderTrigger ? (
          renderTrigger({
            ...triggerProps,
            ref: triggerRef,
            open,
            hasSelection,
            selectionLabel,
            selectedOptions,
            caret,
          })
        ) : (
          <button ref={triggerRef} {...triggerProps}>
            {selectedLeading ? (
              <span
                className="ds-select-trigger-leading"
                data-ui-select-trigger-leading="true"
                aria-hidden
              >
                {selectedLeading}
              </span>
            ) : null}
            <span className="ds-select-trigger-label" data-ui-select-trigger-label="true">
              {selectionLabel}
            </span>
            {caret}
          </button>
        )}
        {open && typeof document !== "undefined" ? createPortal(menu, document.body) : menu}
      </div>
    </Field>
  );
}
