import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useId,
  useState,
} from "react";
import { cx } from "./classNames";
import * as styles from "./Tabs.css";

type TabsOrientation = "horizontal" | "vertical";
type TabsActivationMode = "automatic" | "manual";

interface TabsContextValue {
  activationMode: TabsActivationMode;
  baseId: string;
  orientation: TabsOrientation;
  setValue: (value: string) => void;
  value: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const value = useContext(TabsContext);
  if (!value) {
    throw new Error("Tabs components must be used within <Tabs>.");
  }
  return value;
}

function moveFocus(current: HTMLButtonElement, key: string, orientation: TabsOrientation) {
  const isHorizontal = orientation === "horizontal";
  const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
  const previousKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
  if (key !== nextKey && key !== previousKey && key !== "Home" && key !== "End") {
    return null;
  }

  const list = current.closest('[role="tablist"]');
  if (!list) {
    return null;
  }

  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
  const currentIndex = tabs.indexOf(current);
  if (currentIndex < 0) {
    return null;
  }

  if (key === "Home") {
    return tabs[0] ?? null;
  }
  if (key === "End") {
    return tabs.at(-1) ?? null;
  }

  const delta = key === nextKey ? 1 : -1;
  const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
  return tabs[nextIndex] ?? null;
}

export interface TabsProps {
  children: ReactNode;
  className?: string;
  defaultValue?: string;
  idBase?: string;
  orientation?: TabsOrientation;
  value?: string;
  onValueChange?: (value: string) => void;
  activationMode?: TabsActivationMode;
}

export function Tabs({
  activationMode = "automatic",
  children,
  className,
  defaultValue = "",
  idBase,
  onValueChange,
  orientation = "horizontal",
  value: controlledValue,
}: TabsProps) {
  const generatedId = useId();
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;

  const contextValue: TabsContextValue = {
    activationMode,
    baseId: idBase ?? generatedId,
    orientation,
    setValue: (nextValue) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    value,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={cx(styles.root, className)}
        data-orientation={orientation}
        data-activation-mode={activationMode}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { orientation } = useTabsContext();
  return (
    <div
      {...props}
      className={cx(styles.list[orientation], className)}
      role="tablist"
      aria-orientation={orientation}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  disabled?: boolean;
}

export function TabsTrigger({
  children,
  className,
  disabled = false,
  onClick,
  onKeyDown,
  value,
  ...props
}: TabsTriggerProps) {
  const { activationMode, baseId, orientation, setValue, value: currentValue } = useTabsContext();
  const selected = currentValue === value;
  const triggerId = `${baseId}-${value}-trigger`;
  const contentId = `${baseId}-${value}-content`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }

    const nextTarget = moveFocus(event.currentTarget, event.key, orientation);
    if (!nextTarget) {
      return;
    }

    event.preventDefault();
    nextTarget.focus();
    if (activationMode === "automatic" && nextTarget.dataset.value) {
      setValue(nextTarget.dataset.value);
    }
  }

  return (
    <button
      {...props}
      id={triggerId}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={contentId}
      data-value={value}
      data-state={selected ? "active" : "inactive"}
      disabled={disabled}
      tabIndex={selected ? 0 : -1}
      className={cx(styles.trigger, selected && styles.triggerSelected, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setValue(value);
        }
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ children, className, value, ...props }: TabsContentProps) {
  const { baseId, value: currentValue } = useTabsContext();
  const selected = currentValue === value;
  const triggerId = `${baseId}-${value}-trigger`;
  const contentId = `${baseId}-${value}-content`;

  return (
    <div
      {...props}
      id={contentId}
      role="tabpanel"
      aria-labelledby={triggerId}
      data-state={selected ? "active" : "inactive"}
      hidden={!selected}
      className={cx(styles.content, className)}
    >
      {selected ? children : null}
    </div>
  );
}
