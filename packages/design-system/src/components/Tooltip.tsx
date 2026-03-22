import {
  cloneElement,
  isValidElement,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from "react";
import { cx } from "./classNames";
import * as styles from "./Tooltip.css";

type TooltipSide = "top" | "bottom" | "left" | "right";

type TooltipTriggerProps = {
  "aria-describedby"?: string;
};

function mergeDescribedBy(existing: string | undefined, tooltipId: string) {
  return existing ? `${existing} ${tooltipId}` : tooltipId;
}

function isNode(value: EventTarget | null): value is Node {
  return value instanceof Node;
}

export interface TooltipProps {
  children: ReactElement<TooltipTriggerProps>;
  content: ReactNode;
  side?: TooltipSide;
  className?: string;
  contentClassName?: string;
}

export function Tooltip({
  children,
  className,
  content,
  contentClassName,
  side = "top",
}: TooltipProps) {
  if (!isValidElement<TooltipTriggerProps>(children)) {
    throw new Error("Tooltip expects a single React element child.");
  }

  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  function show() {
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    if (!isNode(event.relatedTarget) || !event.currentTarget.contains(event.relatedTarget)) {
      hide();
    }
  }

  function handleMouseLeave(event: MouseEvent<HTMLSpanElement>) {
    if (!isNode(event.relatedTarget) || !event.currentTarget.contains(event.relatedTarget)) {
      hide();
    }
  }

  const trigger = cloneElement(children, {
    "aria-describedby": open
      ? mergeDescribedBy(children.props["aria-describedby"], tooltipId)
      : children.props["aria-describedby"],
  });

  return (
    <span
      className={cx(styles.root, className)}
      data-family="tooltip"
      data-side={side}
      onBlur={handleBlur}
      onFocus={show}
      onMouseEnter={show}
      onMouseLeave={handleMouseLeave}
    >
      {trigger}
      {open ? (
        <>
          <span
            id={tooltipId}
            role="tooltip"
            data-side={side}
            className={cx(styles.content, styles.side[side], contentClassName)}
          >
            {content}
          </span>
          <span aria-hidden className={cx(styles.arrow, styles.arrowSide[side])} />
        </>
      ) : null}
    </span>
  );
}
