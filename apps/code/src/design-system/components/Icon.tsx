import type { LucideIcon, LucideProps } from "lucide-react";
import { joinClassNames } from "../../utils/classNames";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

export type IconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  size?: IconSize | number;
  className?: string;
};

/** Icon size map aligned with CSS design tokens (ds-icon--sm, ds-icon--md, ds-icon--lg) */
const SIZE_MAP: Record<IconSize, number> = {
  xs: 12,
  sm: 16, // Matches ds-icon--sm
  md: 20, // Matches ds-icon--md
  lg: 24, // Matches ds-icon--lg
  xl: 32,
};

export function Icon({ icon: IconComponent, size = "md", className, ...props }: IconProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size];
  const classes = joinClassNames("ds-icon", className);

  return <IconComponent size={pixelSize} className={classes} {...props} />;
}
