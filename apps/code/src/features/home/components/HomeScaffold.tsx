import type { HTMLAttributes, ReactNode } from "react";
import * as styles from "./HomeScaffold.css";

function joinClassName(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function HomeFrame({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.frame, className)} data-home-frame="true">
      {children}
    </div>
  );
}

export function HomeHero({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.hero, className)} data-home-hero="true">
      {children}
    </div>
  );
}

export function HomeSection({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.section, className)} data-home-section="true">
      {children}
    </div>
  );
}

export function HomeListRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.listRow, className)} data-home-list-row="true">
      {children}
    </div>
  );
}

export function HomeDock({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.dock, className)} data-home-dock="true">
      {children}
    </div>
  );
}
