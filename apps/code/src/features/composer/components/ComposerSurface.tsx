import type { HTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "../../../utils/classNames";

type ComposerSurfaceKind = "home" | "workspace";

type ComposerSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  surface: ComposerSurfaceKind;
};

export function ComposerSurface({ children, className, surface, ...props }: ComposerSurfaceProps) {
  return (
    <div
      className={joinClassNames(
        "composer-surface",
        "composer-surface--thread-lane",
        `composer-surface--${surface}`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
